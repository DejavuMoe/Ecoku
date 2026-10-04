package comment

import (
	"bytes"
	"context"
	"database/sql"
	"ecoku-server/captcha"
	"ecoku-server/model"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestSubmitCancellationWhileWaitingForWriteConnection(t *testing.T) {
	router := setupCommentTest(t)
	enableCommentTurnstile(t, "good-token")
	sqlDB, err := model.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	// Take the connection after all validation reads, immediately before the
	// handler begins its write transaction. The fake verifier never uses a network.
	held := make(chan *sql.Conn, 1)
	restore := captcha.ConfigureTurnstileSiteverify("https://captcha.example.test/siteverify", &http.Client{
		Transport: commentRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			connection, err := sqlDB.Conn(request.Context())
			if err != nil {
				return nil, err
			}
			held <- connection
			return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"success":true}`))}, nil
		}),
	})
	defer restore()
	body := validSubmission("site-a", "/post", 0)
	body["captchaToken"] = "good-token"
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest(http.MethodPost, "/submit", bytes.NewReader(encoded)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	waits := sqlDB.Stats().WaitCount
	go func() { router.ServeHTTP(recorder, req); close(done) }()
	var connection *sql.Conn
	select {
	case connection = <-held:
	case <-done:
		t.Fatalf("request never reached verification: %d %s", recorder.Code, recorder.Body.String())
	case <-time.After(time.Second):
		cancel()
		<-done
		t.Fatal("request did not reach verification")
	}
	defer func() { cancel(); _ = connection.Close(); <-done }()
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	timeout := time.NewTimer(time.Second)
	defer timeout.Stop()
	for sqlDB.Stats().WaitCount == waits {
		select {
		case <-ticker.C:
		case <-timeout.C:
			t.Fatal("submission never waited for the write connection")
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("submission ignored cancellation while waiting for SQLite")
	}
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("canceled status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	_ = connection.Close()
	assertNoSubmittedRows(t)
}

func TestSubmitCancellationRollsBackCommentAndOutbox(t *testing.T) {
	router := setupCommentTest(t)
	// Only queue a notification; this fixture never starts a delivery worker.
	if err := model.DB.Exec(`UPDATE notification_settings SET enabled = 1, config_json = ? WHERE channel = 'email'`,
		`{"recipients":["owner@example.test"]}`).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	queued := false
	if err := model.DB.Callback().Raw().After("gorm:raw").Register("test:cancel-submit", func(tx *gorm.DB) {
		if strings.HasPrefix(tx.Statement.SQL.String(), "INSERT INTO notification_outbox") && tx.Error == nil && tx.RowsAffected == 1 {
			queued = true
			cancel()
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Raw().Remove("test:cancel-submit")
	encoded, err := json.Marshal(validSubmission("site-a", "/post", 0))
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/submit", bytes.NewReader(encoded)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if !queued || recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("queued=%v status=%d body=%s", queued, recorder.Code, recorder.Body.String())
	}
	assertNoSubmittedRows(t)
}

func assertNoSubmittedRows(t *testing.T) {
	t.Helper()
	for _, table := range []string{"comments", "notification_outbox"} {
		var count int64
		if err := model.DB.Table(table).Count(&count).Error; err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("canceled submission left %d rows in %s", count, table)
		}
	}
}

func TestPublicHandlersReuseValidatedSite(t *testing.T) {
	router := setupCommentTest(t)
	queries := 0
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:site-loads", func(tx *gorm.DB) {
		if tx.Statement.Table == "sites" {
			queries++
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:site-loads")
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		queries = 0
		var result *httptest.ResponseRecorder
		if method == http.MethodGet {
			result = listRequest(router, "")
		} else {
			result = postJSON(t, router, validSubmission("site-a", "/post", 0))
		}
		if result.Code >= 300 || queries != 1 {
			t.Fatalf("%s status=%d site queries=%d", method, result.Code, queries)
		}
	}
}
