package routes

import (
	"ecoku-server/middleware"
	"ecoku-server/model"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAdminCookieSessionRevocationAndCSRF(t *testing.T) {
	env := setupAdminTest(t)
	call := func(method, path, origin string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, path, nil)
		request.AddCookie(&http.Cookie{Name: middleware.AdminSessionCookie, Value: env.token})
		if origin != "" {
			request.Header.Set("Origin", origin)
		}
		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, request)
		return recorder
	}
	first := call("GET", "/api/admin/session", "")
	if first.Code != 200 || first.Header().Get("Set-Cookie") != "" {
		t.Fatalf("restore: %d %s", first.Code, first.Body.String())
	}
	if strings.Contains(first.Body.String(), env.token) {
		t.Fatal("session response leaks token")
	}
	// Recreating the router simulates a fresh runtime using the same session DB.
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	env.router = router
	restored := call("GET", "/api/admin/session", "")
	var firstData, restoredData struct {
		Data struct {
			ExpiresAt string `json:"expires_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &firstData); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(restored.Body.Bytes(), &restoredData); err != nil {
		t.Fatal(err)
	}
	if restored.Code != 200 || firstData.Data.ExpiresAt != restoredData.Data.ExpiresAt {
		t.Fatal("restore extended expiry")
	}
	for _, origin := range []string{"", "null", "https://a.example", "https://evil.example"} {
		if response := call("POST", "/api/admin/logout", origin); response.Code != 403 {
			t.Fatalf("CSRF accepted %q: %d", origin, response.Code)
		}
	}
	if response := requestJSON(t, env.router, "POST", "/api/admin/login", "", "", map[string]any{"username": "instance-admin", "password": "test-admin-password"}); response.Code != 403 {
		t.Fatal("login without Origin accepted")
	}
	for _, path := range []string{"/api/admin/session", "/api/admin/logout"} {
		method := "GET"
		if strings.HasSuffix(path, "logout") {
			method = "POST"
		}
		if got := requestJSON(t, env.router, method, path, adminTestOrigin, "EcokuSite "+adminSiteAKey, nil).Code; got != 403 {
			t.Fatalf("site key session access: %d", got)
		}
	}
	// A logout write failure must preserve the live session and cookie.
	if err := model.DB.Exec(`CREATE TRIGGER fail_logout BEFORE DELETE ON admin_sessions BEGIN SELECT RAISE(ABORT, 'fixture'); END`).Error; err != nil {
		t.Fatal(err)
	}
	failed := call("POST", "/api/admin/logout", adminTestOrigin)
	if failed.Code != 503 || failed.Header().Get("Set-Cookie") != "" {
		t.Fatal("logout failure pretended to succeed")
	}
	if err := model.DB.Exec(`DROP TRIGGER fail_logout`).Error; err != nil {
		t.Fatal(err)
	}
	if call("GET", "/api/admin/session", "").Code != 200 {
		t.Fatal("failed logout lost session")
	}
	response := call("POST", "/api/admin/logout", adminTestOrigin)
	if response.Code != 200 || len(response.Result().Cookies()) != 1 || response.Result().Cookies()[0].MaxAge != -1 {
		t.Fatalf("logout: %d", response.Code)
	}
	if call("GET", "/api/admin/session", "").Code != 401 {
		t.Fatal("revoked cookie accepted")
	}
	if requestJSON(t, env.router, "GET", "/api/admin/sites", "", "Bearer "+env.token, nil).Code != 401 {
		t.Fatal("Bearer bypasses logout")
	}
}

func TestAdminSessionCookieFlagsExpiryAndMissingStorage(t *testing.T) {
	env := setupAdminTest(t)
	login := requestJSON(t, env.router, "POST", "/api/admin/login", adminTestOrigin, "", map[string]any{"username": "instance-admin", "password": "test-admin-password"})
	cookies := login.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatal("missing cookie")
	}
	cookie := cookies[0]
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode || cookie.Domain != "" || cookie.Path != "/api/admin" || cookie.MaxAge < 28790 || cookie.MaxAge > 28800 {
		t.Fatalf("unsafe cookie flags: %#v", cookie)
	}
	if cookie.Value == env.token {
		t.Fatal("two logins share a token")
	}
	if err := model.DB.Exec("UPDATE admin_sessions SET expires_at = ?", time.Now().Add(-time.Minute).Unix()).Error; err != nil {
		t.Fatal(err)
	}
	if requestJSON(t, env.router, "GET", "/api/admin/session", "", "Bearer "+cookie.Value, nil).Code != 401 {
		t.Fatal("expired session accepted")
	}
	// Old signed tokens with no registered session cannot fall back to HMAC-only auth.
	if err := model.DB.Exec("DELETE FROM admin_sessions").Error; err != nil {
		t.Fatal(err)
	}
	if requestJSON(t, env.router, "GET", "/api/admin/session", "", "Bearer "+env.token, nil).Code != 401 {
		t.Fatal("unregistered token accepted")
	}
	previous := model.DB
	model.DB = nil
	defer func() { model.DB = previous }()
	if requestJSON(t, env.router, "GET", "/api/admin/session", "", "Bearer "+env.token, nil).Code != 503 {
		t.Fatal("storage failure must fail closed as unavailable")
	}
}
