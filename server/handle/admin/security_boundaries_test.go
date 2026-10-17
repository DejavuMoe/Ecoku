package admin

import (
	"ecoku-server/config"
	"ecoku-server/middleware"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestCommentIDRejectsOverflowWithoutTruncation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		input string
		want  uint64
		ok    bool
	}{
		{"1", 1, true},
		{"4294967295", 4294967295, true},
		{"4294967296", 4294967296, strconv.IntSize == 64},
		{"4294967297", 4294967297, strconv.IntSize == 64},
		{"18446744073709551615", 18446744073709551615, strconv.IntSize == 64},
		{"18446744073709551616", 0, false},
		{"0", 0, false}, {"-1", 0, false}, {"1x", 0, false},
	} {
		t.Run(tc.input, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Params = gin.Params{{Key: "commentId", Value: tc.input}}
			got, ok := parseCommentID(ctx)
			if ok != tc.ok || (ok && uint64(got) != tc.want) || (!ok && (got != 0 || recorder.Code != http.StatusBadRequest)) {
				t.Fatalf("%d-bit parse: value=%d ok=%v status=%d", strconv.IntSize, got, ok, recorder.Code)
			}
		})
	}
}

func TestSessionCookieSecureOnlyAllowsExplicitLoopbackHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const origin = "https://admin.example.test"
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{origin}}}); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		origin string
		secure bool
	}{
		{origin, true}, {"http://admin.example.test", true}, {"", true}, {"null", true},
		{"http://localhost.example.test", true}, {"http://192.168.1.1", true},
		{"https://localhost", true}, {"http://localhost:5173", false},
		{"http://127.0.0.1:5173", false}, {"http://[::1]:5173", false},
	} {
		t.Run(tc.origin, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/admin/login", nil)
			ctx.Request.Header.Set("Origin", tc.origin)
			ctx.Request.Header.Set("X-Forwarded-Proto", "http")
			setSessionCookie(ctx, "fixture-token", time.Now().Add(time.Hour), 3600)
			cookies := recorder.Result().Cookies()
			if len(cookies) != 1 || cookies[0].Secure != tc.secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode {
				t.Fatalf("unexpected cookie flags: %#v", cookies)
			}
		})
	}
	router := gin.New()
	router.Use(middleware.Cors())
	router.POST("/api/admin/login", func(ctx *gin.Context) {
		if middleware.CheckAdminOrigin(ctx) {
			setSessionCookie(ctx, "fixture-token", time.Now().Add(time.Hour), 3600)
		}
	})
	for _, untrusted := range []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173", ""} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/admin/login", nil)
		request.Header.Set("Origin", untrusted)
		router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusForbidden || len(recorder.Result().Cookies()) != 0 {
			t.Fatalf("unconfigured origin %q issued a cookie: status=%d", untrusted, recorder.Code)
		}
	}
}
