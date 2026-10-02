package middleware

import (
	"bytes"
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"ecoku-server/utils"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimiterBoundsAddressStateWithoutEvictingActiveBuckets(t *testing.T) {
	limiter := NewIPRateLimiter(1, time.Minute)
	now := time.Now()
	limiter.now = func() time.Time { return now }
	for i := 0; i < maxIPRateLimitEntries; i++ {
		limiter.entries["comment_list\x00"+strconv.Itoa(i)] = rateLimitEntry{count: 1, resetTime: now.Add(time.Minute)}
	}
	if allowed, _ := limiter.allow("comment_list", "new-address"); allowed {
		t.Fatal("address budget bypassed")
	}
	if allowed, _ := limiter.allow("comment_list", "0"); allowed {
		t.Fatal("active bucket evicted")
	}
	if len(limiter.entries) != maxIPRateLimitEntries {
		t.Fatal("limiter state grew")
	}
	now = now.Add(time.Minute)
	if allowed, _ := limiter.allow("comment_list", "new-address"); !allowed {
		t.Fatal("expired capacity not released")
	}
	if len(limiter.entries) != 1 {
		t.Fatalf("expired entries=%d", len(limiter.entries))
	}
}

func configureMiddlewareTestSite(t *testing.T) {
	t.Helper()
	if err := config.ApplyConfig(&config.Config{}); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/middleware.sqlite3")
	if err != nil {
		t.Fatalf("open middleware database: %v", err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("initialize middleware database: %v", err)
	}
	testsite.Create(t, database, testsite.Site{ID: "site-a", SiteURL: "https://site-a.example", AllowedOrigins: []string{"https://site-a.example"}})
	previous := model.DB
	model.DB = database
	t.Cleanup(func() {
		model.DB = previous
		sqlDatabase, _ := database.DB()
		_ = sqlDatabase.Close()
	})
}

func TestCorsAllowsExactOriginAndRejectsOthers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureMiddlewareTestSite(t)
	router := gin.New()
	router.Use(Cors())
	router.GET("/api/comment/list", func(c *gin.Context) { utils.SendSuccess(c, nil) })

	allowedRequest := httptest.NewRequest(http.MethodGet, "/api/comment/list", nil)
	allowedRequest.Header.Set("Origin", "https://site-a.example")
	allowedRecorder := httptest.NewRecorder()
	router.ServeHTTP(allowedRecorder, allowedRequest)
	if allowedRecorder.Code != http.StatusOK {
		t.Fatalf("allowed status = %d", allowedRecorder.Code)
	}
	if got := allowedRecorder.Header().Get("Access-Control-Allow-Origin"); got != "https://site-a.example" {
		t.Fatalf("allow origin header = %q", got)
	}

	deniedRequest := httptest.NewRequest(http.MethodGet, "/api/comment/list", nil)
	deniedRequest.Header.Set("Origin", "https://evil.example")
	deniedRecorder := httptest.NewRecorder()
	router.ServeHTTP(deniedRecorder, deniedRequest)
	if deniedRecorder.Code != http.StatusForbidden {
		t.Fatalf("denied status = %d", deniedRecorder.Code)
	}
	var deniedBody utils.Response
	if err := json.Unmarshal(deniedRecorder.Body.Bytes(), &deniedBody); err != nil {
		t.Fatalf("decode denied response: %v", err)
	}
	if deniedBody.Code != http.StatusForbidden {
		t.Fatalf("denied body code = %d", deniedBody.Code)
	}
}

func TestCorsDoesNotApplySiteRegistryToStaticAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureMiddlewareTestSite(t)
	router := gin.New()
	router.Use(Cors())
	router.GET("/admin/assets/app.js", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/javascript; charset=utf-8", []byte("export {}"))
	})

	request := httptest.NewRequest(http.MethodGet, "/admin/assets/app.js", nil)
	request.Header.Set("Origin", "https://admin.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("static asset status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("static asset CORS header = %q", got)
	}
}

func TestCorsPreflightUsesExactOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureMiddlewareTestSite(t)
	router := gin.New()
	router.Use(Cors())

	request := httptest.NewRequest(http.MethodOptions, "/api/comment/submit", nil)
	request.Header.Set("Origin", "https://site-a.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d", recorder.Code)
	}
}

func TestAdminCorsUsesIndependentExactOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureMiddlewareTestSite(t)
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://admin.example"}
	router := gin.New()
	router.Use(Cors())
	router.PATCH("/api/admin/test", func(c *gin.Context) { utils.SendSuccess(c, nil) })

	publicOriginRequest := httptest.NewRequest(http.MethodPatch, "/api/admin/test", nil)
	publicOriginRequest.Header.Set("Origin", "https://site-a.example")
	publicOriginRecorder := httptest.NewRecorder()
	router.ServeHTTP(publicOriginRecorder, publicOriginRequest)
	if publicOriginRecorder.Code != http.StatusForbidden {
		t.Fatalf("public origin status = %d", publicOriginRecorder.Code)
	}

	adminOriginRequest := httptest.NewRequest(http.MethodPatch, "/api/admin/test", nil)
	adminOriginRequest.Header.Set("Origin", "https://admin.example")
	adminOriginRecorder := httptest.NewRecorder()
	router.ServeHTTP(adminOriginRecorder, adminOriginRequest)
	if adminOriginRecorder.Code != http.StatusOK {
		t.Fatalf("administrator origin status = %d", adminOriginRecorder.Code)
	}

	preflight := httptest.NewRequest(http.MethodOptions, "/api/admin/test", nil)
	preflight.Header.Set("Origin", "https://admin.example")
	preflightRecorder := httptest.NewRecorder()
	router.ServeHTTP(preflightRecorder, preflight)
	allowedMethods := preflightRecorder.Header().Get("Access-Control-Allow-Methods")
	if preflightRecorder.Code != http.StatusNoContent || !strings.Contains(allowedMethods, http.MethodPatch) || !strings.Contains(allowedMethods, http.MethodDelete) {
		t.Fatalf("administrator preflight = %d, methods = %q", preflightRecorder.Code, preflightRecorder.Header().Get("Access-Control-Allow-Methods"))
	}
}

func TestRateLimitUsesSocketAddressAndReturns429(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(NewIPRateLimiter(1, time.Minute).Middleware("comment_submit"))
	router.POST("/", func(c *gin.Context) { utils.SendSuccess(c, nil) })

	first := httptest.NewRequest(http.MethodPost, "/", nil)
	first.RemoteAddr = "192.0.2.10:1000"
	first.Header.Set("X-Forwarded-For", "198.51.100.1")
	firstRecorder := httptest.NewRecorder()
	router.ServeHTTP(firstRecorder, first)
	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("first status = %d", firstRecorder.Code)
	}

	second := httptest.NewRequest(http.MethodPost, "/", nil)
	second.RemoteAddr = "192.0.2.10:2000"
	second.Header.Set("X-Forwarded-For", "203.0.113.99")
	secondRecorder := httptest.NewRecorder()
	router.ServeHTTP(secondRecorder, second)
	if secondRecorder.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d", secondRecorder.Code)
	}
	if secondRecorder.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After header")
	}

	differentSocket := httptest.NewRequest(http.MethodPost, "/", nil)
	differentSocket.RemoteAddr = "192.0.2.11:1000"
	differentRecorder := httptest.NewRecorder()
	router.ServeHTTP(differentRecorder, differentSocket)
	if differentRecorder.Code != http.StatusOK {
		t.Fatalf("different socket status = %d", differentRecorder.Code)
	}
}

func TestRequestBodyLimitReturns413(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(LimitRequestBody(4))
	router.POST("/", func(c *gin.Context) { utils.SendSuccess(c, nil) })

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("12345"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d", recorder.Code)
	}
}

func TestStreamingRequestBodyLimitReturns413(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(LimitRequestBody(32))
	router.POST("/", func(c *gin.Context) {
		var body map[string]any
		if err := c.ShouldBindJSON(&body); err != nil {
			utils.SendJSONBindingError(c, err)
			return
		}
		utils.SendSuccess(c, nil)
	})

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"value":"`+strings.Repeat("x", 64)+`"}`))
	request.ContentLength = -1
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestRecoveryReturnsGeneric500WithoutLoggingPanicValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var logBuffer bytes.Buffer
	previousWriter := log.Writer()
	log.SetOutput(&logBuffer)
	t.Cleanup(func() { log.SetOutput(previousWriter) })

	router := gin.New()
	router.Use(Recovery())
	router.GET("/", func(*gin.Context) { panic("private-token-value") })
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", recorder.Code)
	}
	if strings.Contains(logBuffer.String(), "private-token-value") {
		t.Fatal("panic value leaked to logs")
	}
}

func TestRequestLoggerDoesNotLogIPQueryOrToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var logBuffer bytes.Buffer
	previousWriter := log.Writer()
	log.SetOutput(&logBuffer)
	t.Cleanup(func() { log.SetOutput(previousWriter) })

	router := gin.New()
	router.Use(RequestLogger())
	router.GET("/safe", func(c *gin.Context) { utils.SendSuccess(c, nil) })
	request := httptest.NewRequest(http.MethodGet, "/safe?email=private@example.com", nil)
	request.RemoteAddr = "192.0.2.99:1234"
	request.Header.Set("Authorization", "Bearer private-token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	logged := logBuffer.String()
	for _, forbidden := range []string{"192.0.2.99", "private@example.com", "private-token", "email="} {
		if strings.Contains(logged, forbidden) {
			t.Fatalf("access log leaked %q: %s", forbidden, logged)
		}
	}
	if !strings.Contains(logged, "method=GET path=/safe status=200") {
		t.Fatalf("missing safe access fields: %s", logged)
	}
}

func TestRequestLoggerRecordsOnlyRouteTemplates(t *testing.T) {
	var output bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previous) })
	router := gin.New()
	router.Use(RequestLogger())
	router.GET("/items/:id", func(c *gin.Context) { c.Status(200) })
	for _, path := range []string{"/unknown%0Aforged%1B%5B31m", "/items/private-value"} {
		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", path, nil))
	}
	logged := output.String()
	if strings.Count(logged, "\n") != 2 || strings.ContainsAny(logged, "\r\x1b") || strings.Contains(logged, "forged") || strings.Contains(logged, "private-value") {
		t.Fatalf("unsafe log: %q", logged)
	}
	if !strings.Contains(logged, "path=<unmatched>") || !strings.Contains(logged, "path=/items/:id") {
		t.Fatalf("missing templates: %q", logged)
	}
}
