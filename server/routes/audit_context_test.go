package routes

import (
	"context"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TestAuditAdminBootstrapCancellation(t *testing.T) {
	for _, path := range []string{"/api/admin/login-config", "/admin/"} {
		t.Run(path, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			configureRoutesTest(t)
			directory := t.TempDir()
			if err := os.Mkdir(filepath.Join(directory, "assets"), 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("<!doctype html><html><head></head><body></body></html>"), 0o600); err != nil {
				t.Fatal(err)
			}
			config.GlobalConfig.Paths.AdminStaticDir = directory
			router, err := NewRouter()
			if err != nil {
				t.Fatal(err)
			}
			baseline := httptest.NewRecorder()
			router.ServeHTTP(baseline, httptest.NewRequest(http.MethodGet, path, nil))
			if baseline.Code != http.StatusOK {
				t.Fatalf("baseline status=%d", baseline.Code)
			}
			assertAuditPoolCancellation(t, router, httptest.NewRequest(http.MethodGet, path, nil), "captcha_settings", 1)
		})
	}
}

func TestAuditPublicConfigContextControl(t *testing.T) {
	configureRoutesTest(t)
	// Existing context-aware reader is the positive control, without a listener.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := captcha.PublicConfigWithContext(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	})
	assertAuditPoolCancellation(t, handler, httptest.NewRequest(http.MethodGet, "/", nil), "captcha_settings", 1)
}

func TestAuditSiteKeyBoundariesAndCancellation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		method string
		path   string
		status int
		prime  bool
	}{
		{"forbidden-route", http.MethodGet, "/api/admin/sites/site-a/comments/1", http.StatusForbidden, false},
		{"other-site", http.MethodDelete, "/api/admin/sites/site-b/comments/1", http.StatusForbidden, false},
		{"rate-limited", http.MethodDelete, "/api/admin/sites/site-a/comments/1", http.StatusTooManyRequests, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			configureRoutesTest(t)
			testsite.Create(t, model.DB, testsite.Site{ID: "site-b", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}})
			key := strings.Repeat("dummykey", 4)
			t.Setenv("ECOKU_AUDIT_SITE_KEY", key)
			if err := config.ApplyConfig(&config.Config{
				Sites: []config.RegisteredSiteConfig{{
					ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}, ManagementKeyEnv: "ECOKU_AUDIT_SITE_KEY",
				}},
				RateLimit: config.RateLimitConfig{CommentDelete: 1},
			}); err != nil {
				t.Fatal(err)
			}
			request := func(method, path string) *http.Request {
				req := httptest.NewRequest(method, path, nil)
				req.RemoteAddr = "192.0.2.10:1234"
				req.Header.Set("Authorization", "EcokuSite "+key)
				return req
			}
			newRouter := func(t *testing.T) *gin.Engine {
				t.Helper()
				router, err := NewRouter()
				if err != nil {
					t.Fatal(err)
				}
				if tc.prime {
					recorder := httptest.NewRecorder()
					// Consume one slot, but stop before any deletion transaction.
					router.ServeHTTP(recorder, request(http.MethodDelete, "/api/admin/sites/site-a/comments/invalid"))
					if recorder.Code != http.StatusBadRequest {
						t.Fatalf("limiter prime status=%d", recorder.Code)
					}
				}
				return router
			}
			assertRejected := func(t *testing.T, router *gin.Engine) {
				t.Helper()
				recorder := httptest.NewRecorder()
				router.ServeHTTP(recorder, request(tc.method, tc.path))
				if recorder.Code != tc.status {
					t.Fatalf("rejection status=%d, want %d", recorder.Code, tc.status)
				}
			}
			t.Run("baseline", func(t *testing.T) { assertRejected(t, newRouter(t)) })
			// The first existence read authenticates the key; the second checks
			// the requested site. Forbidden routes stop before that second read.
			stages := []string{"authentication"}
			if tc.method == http.MethodDelete {
				stages = append(stages, "site-access")
			}
			for index, stage := range stages {
				t.Run(stage, func(t *testing.T) {
					router := newRouter(t)
					assertAuditPoolCancellation(t, router, request(tc.method, tc.path), "sites", index+1)
					assertRejected(t, router)
				})
			}
		})
	}
}

// Like routes_test's pool-wait checks, this reserves the sole connection.
// Selecting the query lets the second SiteExists caller run after valid auth.
// One request, a 20 ms deadline, and an automatic 150 ms release bound the
// fixture; no locks, slow SQL, listeners, comments, or notification workers.
func assertAuditPoolCancellation(t *testing.T, handler http.Handler, req *http.Request, table string, queryNumber int) {
	t.Helper()
	database := model.DB
	sqlDB, err := database.DB()
	if err != nil {
		t.Fatal(err)
	}
	if sqlDB.Stats().MaxOpenConnections != 1 {
		t.Fatal("fixture requires exactly one database connection")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	var releaseOnce sync.Once
	var released atomic.Bool
	var release func()
	var timer *time.Timer
	var selectedQuery *gorm.DB
	queries := 0
	if err := database.Callback().Query().Before("gorm:query").Register("test:audit-pool", func(tx *gorm.DB) {
		if tx.Statement.Table != table {
			return
		}
		queries++
		if queries != queryNumber {
			return
		}
		connection, err := sqlDB.Conn(ctx)
		if err != nil {
			_ = tx.AddError(err)
			return
		}
		release = func() {
			releaseOnce.Do(func() {
				released.Store(true)
				_ = connection.Close()
			})
		}
		timer = time.AfterFunc(150*time.Millisecond, release)
		selectedQuery = tx
	}); err != nil {
		t.Fatal(err)
	}
	defer database.Callback().Query().Remove("test:audit-pool")
	waits := sqlDB.Stats().WaitCount
	recorder := httptest.NewRecorder()
	done := make(chan bool, 1)
	go func() {
		// Publish only after the handler and release callback have drained;
		// the failed baseline cannot leave a pool reservation behind.
		defer func() {
			beforeRelease := !released.Load()
			if timer != nil {
				timer.Stop()
				release()
			}
			done <- beforeRelease
		}()
		handler.ServeHTTP(recorder, req.WithContext(ctx))
	}()
	var beforeRelease bool
	select {
	case beforeRelease = <-done:
	case <-time.After(time.Second):
		t.Fatal("request did not drain after the automatic connection release")
	}
	if selectedQuery == nil {
		t.Fatalf("request did not reach query %d on %s before its deadline", queryNumber, table)
	}
	<-ctx.Done()
	queryContext := selectedQuery.Statement.Context
	stats := sqlDB.Stats()
	t.Logf("table=%s query=%d requestErr=%v queryContextErr=%v queryErr=%v rows=%d beforeRelease=%v status=%d waits=%d inUse=%d idle=%d",
		table, queryNumber, ctx.Err(), queryContext.Err(), selectedQuery.Error, selectedQuery.RowsAffected, beforeRelease, recorder.Code, stats.WaitCount-waits, stats.InUse, stats.Idle)
	if stats.WaitCount <= waits {
		t.Error("request never waited for the reserved connection")
	}
	if !beforeRelease {
		t.Error("canceled request waited for connection release")
	}
	if queryContext.Err() == nil {
		t.Error("database query discarded request cancellation")
	}
	if selectedQuery.Error == nil {
		t.Error("query succeeded despite cancellation while its connection was reserved")
	}
	if stats.InUse != 0 {
		t.Errorf("request left %d connections in use", stats.InUse)
	}
}
