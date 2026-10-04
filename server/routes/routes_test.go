package routes

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/middleware"
	"ecoku-server/model"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TestPublicListAdmissionPrecedesCORSDatabaseWork(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	config.GlobalConfig.RateLimit.CommentList = 1
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	queries := 0
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:origin", func(tx *gorm.DB) {
		if tx.Statement.Table == "site_origins" {
			queries++
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:origin")
	for _, want := range []int{http.StatusForbidden, http.StatusTooManyRequests} {
		req := httptest.NewRequest(http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", nil)
		req.Header.Set("Origin", "https://unregistered.example")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		if recorder.Code != want || queries != 1 {
			t.Fatalf("status=%d want=%d origin queries=%d", recorder.Code, want, queries)
		}
	}
	sqlDB, err := model.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	connection, err := sqlDB.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", nil).WithContext(ctx)
	req.RemoteAddr = "192.0.2.99:1"
	req.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() { router.ServeHTTP(recorder, req); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		_ = connection.Close()
		<-done
		t.Fatal("CORS ignored the deadline while waiting for SQLite")
	}
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("CORS wait status=%d", recorder.Code)
	}
}

func TestPublicSubmitDeadlineIncludesCORSDatabaseWork(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	budgetObserved := false
	if err := model.DB.Callback().Query().Before("gorm:query").Register("test:submit-budget", func(tx *gorm.DB) {
		if tx.Statement.Table == "site_origins" {
			deadline, ok := tx.Statement.Context.Deadline()
			budgetObserved = ok && time.Until(deadline) > 0 && time.Until(deadline) < 10*time.Second
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:submit-budget")
	req := httptest.NewRequest(http.MethodOptions, "/api/comment/submit", nil)
	req.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNoContent || !budgetObserved {
		t.Fatalf("preflight status=%d budget=%v", recorder.Code, budgetObserved)
	}
	sqlDB, err := model.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	connection, err := sqlDB.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	req = httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader(`{}`)).WithContext(ctx)
	req.Header.Set("Origin", "https://a.example")
	recorder = httptest.NewRecorder()
	done := make(chan struct{})
	go func() { router.ServeHTTP(recorder, req); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		_ = connection.Close()
		<-done
		t.Fatal("submission CORS ignored cancellation while waiting for SQLite")
	}
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("canceled CORS status=%d", recorder.Code)
	}
}

func TestClientStaticAssetsAreServedWithCrossOriginSafeHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	directory := t.TempDir()
	for name, body := range map[string]string{
		"ecoku.umd.js":       "globalThis.Ecoku = function () {};",
		"ecoku-loader.js":    "void 0;",
		"ecoku.css":          ".ecoku-comments{}",
		"ecoku.unstyled.css": ".ecoku-comments{}",
	} {
		if err := os.WriteFile(filepath.Join(directory, name), []byte(body), 0o600); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	config.GlobalConfig.Paths.ClientStaticDir = directory
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("new router: %v", err)
	}

	for _, name := range []string{"ecoku.umd.js", "ecoku-loader.js", "ecoku.css", "ecoku.unstyled.css"} {
		request := httptest.NewRequest(http.MethodGet, "/client/"+name, nil)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Fatalf("GET %s status = %d", name, recorder.Code)
		}
		if recorder.Header().Get("Cross-Origin-Resource-Policy") != "cross-origin" {
			t.Fatalf("GET %s missing cross-origin resource policy", name)
		}
		if recorder.Header().Get("Cache-Control") != "public, max-age=3600" {
			t.Fatalf("GET %s unexpected cache policy", name)
		}

		head := httptest.NewRequest(http.MethodHead, "/client/"+name, nil)
		headRecorder := httptest.NewRecorder()
		router.ServeHTTP(headRecorder, head)
		if headRecorder.Code != http.StatusOK || headRecorder.Body.Len() != 0 {
			t.Fatalf("HEAD %s status=%d body=%d", name, headRecorder.Code, headRecorder.Body.Len())
		}
	}
}

func TestClientStaticAssetsMustBeComplete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "ecoku.umd.js"), []byte("void 0;"), 0o600); err != nil {
		t.Fatalf("write asset: %v", err)
	}
	config.GlobalConfig.Paths.ClientStaticDir = directory
	if _, err := NewRouter(); err == nil || !strings.Contains(err.Error(), "ecoku-loader.js") {
		t.Fatalf("missing loader error = %v", err)
	}
}

func configureRoutesTest(t *testing.T, trustedProxies ...string) {
	t.Helper()
	err := config.ApplyConfig(&config.Config{
		Site:      config.SiteConfig{TrustedProxies: trustedProxies},
		RateLimit: config.RateLimitConfig{CommentSubmit: 1},
	})
	if err != nil {
		t.Fatalf("apply config: %v", err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/routes.sqlite3")
	if err != nil {
		t.Fatalf("open routes database: %v", err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("initialize routes database: %v", err)
	}
	testsite.Create(t, database, testsite.Site{ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}})
	previous := model.DB
	model.DB = database
	t.Cleanup(func() {
		model.DB = previous
		sqlDatabase, _ := database.DB()
		_ = sqlDatabase.Close()
	})
}

func TestConfiguredTrustedProxyControlsForwardedRateLimitIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t, "192.0.2.50")
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("new router: %v", err)
	}

	request := func(remoteAddress, forwardedFor string) *httptest.ResponseRecorder {
		body := strings.NewReader("{")
		incoming := httptest.NewRequest(http.MethodPost, "/api/comment/submit", body)
		incoming.RemoteAddr = remoteAddress
		incoming.Header.Set("Origin", "https://a.example")
		incoming.Header.Set("Content-Type", "application/json")
		incoming.Header.Set("X-Forwarded-For", forwardedFor)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, incoming)
		return recorder
	}

	if first := request("192.0.2.50:1000", "198.51.100.1"); first.Code != http.StatusBadRequest {
		t.Fatalf("first trusted proxy request = %d", first.Code)
	}
	if differentClient := request("192.0.2.50:1001", "198.51.100.2"); differentClient.Code != http.StatusBadRequest {
		t.Fatalf("different forwarded client = %d", differentClient.Code)
	}
	if repeatedClient := request("192.0.2.50:1002", "198.51.100.1"); repeatedClient.Code != http.StatusTooManyRequests {
		t.Fatalf("repeated forwarded client = %d", repeatedClient.Code)
	}
	if untrustedPeer := request("192.0.2.60:1000", "198.51.100.3"); untrustedPeer.Code != http.StatusBadRequest {
		t.Fatalf("untrusted peer first request = %d", untrustedPeer.Code)
	}
	if spoofedUntrustedPeer := request("192.0.2.60:1001", "198.51.100.4"); spoofedUntrustedPeer.Code != http.StatusTooManyRequests {
		t.Fatalf("untrusted peer spoof bypass = %d", spoofedUntrustedPeer.Code)
	}
}

func TestUserAndCountRoutesAreNotRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("new router: %v", err)
	}

	for _, path := range []string{"/api/user/login", "/api/user/register", "/api/count/batch", "/api/increment/batch"} {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader("{}"))
		request.Header.Set("Origin", "https://a.example")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("%s status = %d", path, recorder.Code)
		}
	}
}

func TestCommentRouteEnforcesBodyLimitAndConfiguredRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("new router: %v", err)
	}

	largeRequest := httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader(strings.Repeat("x", int(middleware.MaxCommentRequestBodyBytes)+1)))
	largeRequest.Header.Set("Origin", "https://a.example")
	largeRecorder := httptest.NewRecorder()
	router.ServeHTTP(largeRecorder, largeRequest)
	if largeRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large body status = %d", largeRecorder.Code)
	}

	first := httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader("{"))
	first.RemoteAddr = "192.0.2.50:1000"
	first.Header.Set("Origin", "https://a.example")
	first.Header.Set("Content-Type", "application/json")
	first.Header.Set("X-Forwarded-For", "198.51.100.1")
	firstRecorder := httptest.NewRecorder()
	router.ServeHTTP(firstRecorder, first)
	if firstRecorder.Code != http.StatusBadRequest {
		t.Fatalf("first status = %d", firstRecorder.Code)
	}

	second := httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader("{"))
	second.RemoteAddr = "192.0.2.50:2000"
	second.Header.Set("Origin", "https://a.example")
	second.Header.Set("Content-Type", "application/json")
	second.Header.Set("X-Forwarded-For", "203.0.113.2")
	secondRecorder := httptest.NewRecorder()
	router.ServeHTTP(secondRecorder, second)
	if secondRecorder.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d", secondRecorder.Code)
	}
}

func TestRouterRecoveryReturns500(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("new router: %v", err)
	}
	router.GET("/panic", func(*gin.Context) { panic("do not expose") })

	request := httptest.NewRequest(http.MethodGet, "/panic", nil)
	request.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("panic status = %d", recorder.Code)
	}
}

func TestPublicListRouteRateLimitCannotBeBypassedByQueryOrForwardedIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	config.GlobalConfig.RateLimit.CommentList = 1
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	request := func(query, remote, forwarded string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/comment/list?siteId=site-a&key=/post"+query, nil)
		req.RemoteAddr = remote
		req.Header.Set("X-Forwarded-For", forwarded)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	if got := request("", "192.0.2.1:1", "198.51.100.1"); got.Code != http.StatusOK {
		t.Fatalf("first=%d", got.Code)
	}
	for _, query := range []string{"&page=2", "&sort=oldest", "&parentId=0&afterId=5"} {
		got := request(query, "192.0.2.1:2", "203.0.113.2")
		if got.Code != http.StatusTooManyRequests || got.Header().Get("Retry-After") == "" {
			t.Fatalf("%s status=%d", query, got.Code)
		}
	}
	if got := request("&parentId=0", "192.0.2.2:1", ""); got.Code != http.StatusOK {
		t.Fatalf("other IP=%d", got.Code)
	}
	// A list read must not consume the separate submission bucket.
	req := httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader("{"))
	req.RemoteAddr = "192.0.2.1:1"
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("submit bucket status=%d", recorder.Code)
	}
}
