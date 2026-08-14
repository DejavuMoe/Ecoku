package routes

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func configureRoutesTest(t *testing.T, trustedProxies ...string) {
	t.Helper()
	t.Setenv("ECOKU_ROUTES_SITE_KEY", strings.Repeat("r", 32))
	err := config.ApplyConfig(&config.Config{
		Site:      config.SiteConfig{TrustedProxies: trustedProxies},
		RateLimit: config.RateLimitConfig{CommentSubmit: 1},
		Sites: []config.RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://a.example"},
			ManagementKeyEnv: "ECOKU_ROUTES_SITE_KEY",
		}},
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

	for _, path := range []string{"/api/admin/login", "/api/user/login", "/api/user/register", "/api/count/batch", "/api/increment/batch"} {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader("{}"))
		if path != "/api/admin/login" {
			request.Header.Set("Origin", "https://a.example")
		}
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

	largeRequest := httptest.NewRequest(http.MethodPost, "/api/comment/submit", strings.NewReader(strings.Repeat("x", 17*1024)))
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
