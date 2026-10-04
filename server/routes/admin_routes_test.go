package routes

import (
	"bytes"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"ecoku-server/utils"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	adminTestOrigin  = "https://admin.example"
	adminTestFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.s{fill:#b8472f}</style><path class="s" d="M0 0h64v64H0z"/></svg>`
)

type adminEnvironment struct {
	router *gin.Engine
	token  string
}

type adminRoundTripFunc func(*http.Request) (*http.Response, error)

func (function adminRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func setupAdminTest(t *testing.T) adminEnvironment {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ECOKU_ADMIN_USERNAME", "instance-admin")
	t.Setenv("ECOKU_ADMIN_PASSWORD_HASH", string(hash))
	t.Setenv("ECOKU_ADMIN_TOKEN_KEY", strings.Repeat("t", 32))
	t.Setenv(config.EncryptionKeyEnv, base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	staticDir := filepath.Join(t.TempDir(), "admin")
	if err := os.MkdirAll(filepath.Join(staticDir, "assets"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<!doctype html><html><head></head><body></body></html>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "favicon.svg"), []byte(adminTestFavicon), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := config.ApplyConfig(&config.Config{
		Admin:         config.AdminConfig{AllowedOrigins: []string{adminTestOrigin}},
		Notifications: config.NotificationsConfig{InstancePublicURL: "https://comments.example"},
	}); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Paths.AdminStaticDir = staticDir
	if err := config.ValidateAdmin(); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/admin.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, database,
		testsite.Site{ID: "site-a", Name: "站点 A", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}},
		testsite.Site{ID: "site-b", Name: "站点 B", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}},
	)
	previous := model.DB
	model.DB = database
	t.Cleanup(func() { model.DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	login := requestJSON(t, router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{"username": "instance-admin", "password": "test-admin-password"})
	if login.Code != http.StatusOK {
		t.Fatalf("login=%d %s", login.Code, login.Body.String())
	}
	cookies := login.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Value == "" || strings.Contains(login.Body.String(), `"token"`) {
		t.Fatalf("invalid session response: %s", login.Body.String())
	}
	return adminEnvironment{router: router, token: cookies[0].Value}
}

func TestInitialSetupSessionIsRestrictedAndRotated(t *testing.T) {
	env := setupAdminTest(t)
	t.Cleanup(func() { config.SetAdminCredentials(nil) })
	hash, err := bcrypt.GenerateFromPassword([]byte("temporary-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	// A renamed account after admin reset-password must keep its name in the setup form.
	if err := model.CreateAdminAccount(model.AdminAccount{ID: 1, Username: "keeper", PasswordHash: string(hash), MustChangePassword: true, Revision: 1, CreatedAt: now, UpdatedAt: now}); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Paths.SQLitePath = filepath.Join(t.TempDir(), "runtime", "ecoku.sqlite3")
	config.SetAdminCredentials(&config.AdminCredentials{Username: "keeper", PasswordHash: string(hash), TokenKey: strings.Repeat("t", 32), TokenTTL: 8 * time.Hour, MustChangePassword: true})
	setupToken, _, err := utils.GenerateAdminSetupToken()
	if err != nil {
		t.Fatal(err)
	}
	if response := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites", adminTestOrigin, "Bearer "+setupToken, nil); response.Code != http.StatusForbidden {
		t.Fatalf("setup session accessed management API: %d", response.Code)
	}
	if session := requestJSON(t, env.router, http.MethodGet, "/api/admin/session", "", "Bearer "+setupToken, nil); session.Code != http.StatusOK || !strings.Contains(session.Body.String(), `"username":"keeper"`) {
		t.Fatalf("setup session did not return the current username: %d %s", session.Code, session.Body.String())
	}
	setup := requestJSON(t, env.router, http.MethodPost, "/api/admin/initial-setup", adminTestOrigin, "Bearer "+setupToken, map[string]any{"username": "owner", "password": "new-password-for-admin"})
	if setup.Code != http.StatusOK {
		t.Fatalf("initial setup=%d %s", setup.Code, setup.Body.String())
	}
	if requestJSON(t, env.router, http.MethodGet, "/api/admin/session", "", "Bearer "+setupToken, nil).Code != http.StatusUnauthorized {
		t.Fatal("temporary setup session remained valid")
	}
	cookies := setup.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatal("normal session was not issued after initial setup")
	}
	if session := requestJSON(t, env.router, http.MethodGet, "/api/admin/session", "", "Bearer "+cookies[0].Value, nil); session.Code != http.StatusOK || strings.Contains(session.Body.String(), `"username"`) {
		t.Fatalf("normal session after initial setup=%d %s", session.Code, session.Body.String())
	}
}

func TestAdminStaticCSPAllowsStyleAttributesAndNonceBootstrapWithoutUnsafeInline(t *testing.T) {
	env := setupAdminTest(t)
	request := httptest.NewRequest(http.MethodGet, "/admin/", nil)
	recorder := httptest.NewRecorder()
	env.router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("admin index status=%d", recorder.Code)
	}
	csp := recorder.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "style-src-attr 'unsafe-inline'") {
		t.Fatalf("style attributes are not allowed for browser annotation tools: %q", csp)
	}
	if strings.Contains(csp, "script-src 'unsafe-inline'") {
		t.Fatalf("administrator UI unexpectedly allows inline scripts: %q", csp)
	}
	if strings.Contains(csp, "'unsafe-eval'") || strings.Contains(csp, "'wasm-unsafe-eval'") || strings.Contains(csp, "worker-src blob:") {
		t.Fatalf("disabled CAPTCHA unexpectedly relaxes script or worker CSP: %q", csp)
	}
	if !strings.Contains(csp, "script-src 'self'") || !strings.Contains(csp, "style-src 'self'") {
		t.Fatalf("administrator UI lost its self-only script/style policy: %q", csp)
	}
	if !strings.Contains(csp, "img-src 'self' data: https: http://localhost:* http://127.0.0.1:*") {
		t.Fatalf("administrator UI cannot render configured Smoji images: %q", csp)
	}
	if !strings.Contains(csp, "https://challenges.cloudflare.com") || !strings.Contains(csp, "frame-src 'self' https://challenges.cloudflare.com") {
		t.Fatalf("administrator UI cannot load Turnstile: %q", csp)
	}
	if !strings.Contains(csp, "'nonce-") || !strings.Contains(recorder.Body.String(), "window.CAP_SCRIPT_NONCE") {
		t.Fatalf("administrator index is missing its per-response Cap nonce: csp=%q body=%s", csp, recorder.Body.String())
	}
}

func TestAdminStaticServesTheTabIcon(t *testing.T) {
	env := setupAdminTest(t)
	request := httptest.NewRequest(http.MethodGet, "/admin/favicon.svg", nil)
	recorder := httptest.NewRecorder()
	env.router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != adminTestFavicon {
		t.Fatalf("favicon status=%d body=%q", recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "image/svg+xml") {
		t.Fatalf("favicon content type=%q", contentType)
	}
	if csp := recorder.Header().Get("Content-Security-Policy"); csp != "default-src 'none'; style-src 'unsafe-inline'" {
		t.Fatalf("favicon CSP=%q", csp)
	}
	if recorder.Header().Get("X-Content-Type-Options") != "nosniff" || recorder.Header().Get("Cache-Control") != "public, max-age=86400" {
		t.Fatalf("favicon headers=%v", recorder.Header())
	}

	head := httptest.NewRequest(http.MethodHead, "/admin/favicon.svg", nil)
	headRecorder := httptest.NewRecorder()
	env.router.ServeHTTP(headRecorder, head)
	if headRecorder.Code != http.StatusOK || headRecorder.Body.Len() != 0 {
		t.Fatalf("HEAD favicon status=%d body=%d", headRecorder.Code, headRecorder.Body.Len())
	}
}

func TestAdminStaticStartsWithoutTheTabIcon(t *testing.T) {
	setupAdminTest(t)
	if err := os.Remove(filepath.Join(config.GetAdminStaticDir(), "favicon.svg")); err != nil {
		t.Fatal(err)
	}
	router, err := NewRouter()
	if err != nil {
		t.Fatalf("router without favicon: %v", err)
	}
	for path, want := range map[string]int{"/admin/": http.StatusOK, "/admin/favicon.svg": http.StatusNotFound} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != want {
			t.Fatalf("GET %s status=%d, want %d", path, recorder.Code, want)
		}
	}
}

func TestAdminTurnstileSettingsAndLoginChallenge(t *testing.T) {
	env := setupAdminTest(t)
	t.Setenv("ECOKU_ADMIN_LOCALE", "en")
	unauthenticated := requestJSON(t, env.router, http.MethodGet, "/api/admin/login-config", adminTestOrigin, "", nil)
	if unauthenticated.Code != http.StatusOK || !strings.Contains(unauthenticated.Body.String(), `"turnstileSitekey":""`) || !strings.Contains(unauthenticated.Body.String(), `"locale":"en"`) {
		t.Fatalf("empty login-config=%d %s", unauthenticated.Code, unauthenticated.Body.String())
	}
	saved := requestJSON(t, env.router, http.MethodPut, "/api/admin/turnstile", adminTestOrigin, "Bearer "+env.token, map[string]any{
		"enabled": true, "sitekey": "public-sitekey", "secret": "secret-private", "revision": 1,
	})
	if saved.Code != http.StatusOK {
		t.Fatalf("save=%d %s", saved.Code, saved.Body.String())
	}
	if strings.Contains(saved.Body.String(), "secret-private") {
		t.Fatalf("secret echoed: %s", saved.Body.String())
	}
	configResponse := requestJSON(t, env.router, http.MethodGet, "/api/admin/login-config", adminTestOrigin, "", nil)
	if configResponse.Code != http.StatusOK || !strings.Contains(configResponse.Body.String(), `"turnstileSitekey":"public-sitekey"`) {
		t.Fatalf("login-config=%d %s", configResponse.Code, configResponse.Body.String())
	}
	blocked := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{
		"username": "instance-admin", "password": "test-admin-password",
	})
	if blocked.Code != http.StatusBadRequest || !strings.Contains(blocked.Body.String(), "验证失败，请重试") {
		t.Fatalf("login without token=%d %s", blocked.Code, blocked.Body.String())
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": r.FormValue("response") == "good-token"})
	}))
	t.Cleanup(server.Close)
	restore := captcha.ConfigureTurnstileSiteverify(server.URL, server.Client())
	t.Cleanup(restore)
	wrongPassword := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{
		"username": "instance-admin", "password": "wrong-password", "turnstileToken": "good-token",
	})
	if wrongPassword.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password after challenge=%d %s", wrongPassword.Code, wrongPassword.Body.String())
	}
	ok := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{
		"username": "instance-admin", "password": "test-admin-password", "turnstileToken": "good-token",
	})
	if ok.Code != http.StatusOK {
		t.Fatalf("login with token=%d %s", ok.Code, ok.Body.String())
	}
}

func TestAdminCapSettingsLoginAndCSP(t *testing.T) {
	env := setupAdminTest(t)
	saved := requestJSON(t, env.router, http.MethodPut, "/api/admin/captcha", adminTestOrigin, "Bearer "+env.token, map[string]any{
		"provider":  "cap",
		"turnstile": map[string]any{"sitekey": "turnstile-public", "secret": "turnstile-private"},
		"cap":       map[string]any{"instance_url": "https://cap.example.com", "sitekey": "cap-public", "secret": "cap-private"},
		"revision":  1,
	})
	if saved.Code != http.StatusOK {
		t.Fatalf("save Cap=%d %s", saved.Code, saved.Body.String())
	}
	for _, secret := range []string{"turnstile-private", "cap-private"} {
		if strings.Contains(saved.Body.String(), secret) {
			t.Fatalf("secret echoed: %s", saved.Body.String())
		}
	}
	loginConfig := requestJSON(t, env.router, http.MethodGet, "/api/admin/login-config", adminTestOrigin, "", nil)
	if loginConfig.Code != http.StatusOK || !strings.Contains(loginConfig.Body.String(), `"provider":"cap"`) || !strings.Contains(loginConfig.Body.String(), `"instanceUrl":"https://cap.example.com"`) || strings.Contains(loginConfig.Body.String(), "cap-private") {
		t.Fatalf("Cap login config=%d %s", loginConfig.Code, loginConfig.Body.String())
	}

	indexRequest := httptest.NewRequest(http.MethodGet, "/admin/", nil)
	indexRecorder := httptest.NewRecorder()
	env.router.ServeHTTP(indexRecorder, indexRequest)
	csp := indexRecorder.Header().Get("Content-Security-Policy")
	for _, required := range []string{"https://cap.example.com", "'wasm-unsafe-eval'", "'unsafe-eval'", "worker-src blob:", "'nonce-"} {
		if !strings.Contains(csp, required) {
			t.Fatalf("Cap CSP missing %q: %s", required, csp)
		}
	}
	if !strings.Contains(indexRecorder.Body.String(), "window.CAP_CSS_NONCE") || !strings.Contains(indexRecorder.Body.String(), "window.CAP_SCRIPT_NONCE") {
		t.Fatalf("Cap nonce bootstrap missing: %s", indexRecorder.Body.String())
	}

	client := &http.Client{Transport: adminRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(request.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		success := request.URL.String() == "https://cap.example.com/cap-public/siteverify" && payload["secret"] == "cap-private" && payload["response"] == "good-cap-token"
		response, _ := json.Marshal(map[string]bool{"success": success})
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(response))), Header: make(http.Header)}, nil
	})}
	restore := captcha.ConfigureCapSiteverify(client)
	t.Cleanup(restore)
	blocked := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{
		"username": "instance-admin", "password": "test-admin-password", "turnstileToken": "good-cap-token",
	})
	if blocked.Code != http.StatusBadRequest {
		t.Fatalf("Cap accepted legacy token=%d %s", blocked.Code, blocked.Body.String())
	}
	ok := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{
		"username": "instance-admin", "password": "test-admin-password", "captchaToken": "good-cap-token",
	})
	if ok.Code != http.StatusOK {
		t.Fatalf("Cap login=%d %s", ok.Code, ok.Body.String())
	}

	settings, err := captcha.GetSettings()
	if err != nil {
		t.Fatal(err)
	}
	for _, provider := range []string{captcha.ProviderTurnstile, captcha.ProviderOff} {
		settings.Provider = provider
		settings, err = captcha.Save(settings)
		if err != nil {
			t.Fatalf("switch to %s: %v", provider, err)
		}
		inactiveRequest := httptest.NewRequest(http.MethodGet, "/admin/", nil)
		inactiveRecorder := httptest.NewRecorder()
		env.router.ServeHTTP(inactiveRecorder, inactiveRequest)
		inactiveCSP := inactiveRecorder.Header().Get("Content-Security-Policy")
		for _, forbidden := range []string{"https://cap.example.com", "'wasm-unsafe-eval'", "'unsafe-eval'", "worker-src blob:"} {
			if strings.Contains(inactiveCSP, forbidden) {
				t.Fatalf("%s CSP retained inactive Cap source %q: %s", provider, forbidden, inactiveCSP)
			}
		}
		if settings.Cap.InstanceURL != "https://cap.example.com" || !settings.Cap.SecretSet {
			t.Fatalf("%s switch discarded Cap settings: %#v", provider, settings.Cap)
		}
	}
}

func TestAdminNotificationTemplatePreviewsAreNotPublic(t *testing.T) {
	env := setupAdminTest(t)
	for _, name := range []string{
		"email-blogger-new-comment.html",
		"email-blogger-new-reply.html",
		"email-visitor-reply.html",
		"telegram-notification.html",
	} {
		request := httptest.NewRequest(http.MethodGet, "/admin/templates/"+name, nil)
		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("template %s status=%d, want 404", name, recorder.Code)
		}
	}
}

func TestCommentManagementIsPublishedDeletedOnlyAndSiteIsolated(t *testing.T) {
	env := setupAdminTest(t)
	email := "private@example.com"
	a := model.Comment{SiteID: "site-a", Mark: "/post", PageTitle: "文章", Username: "访客", Email: &email, Content: "正文"}
	b := model.Comment{SiteID: "site-b", Mark: "/other", Username: "其他", Content: "秘密"}
	if err := model.DB.Create(&a).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Create(&b).Error; err != nil {
		t.Fatal(err)
	}

	unauthenticated := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites/site-a/comments", "", "", nil)
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated=%d", unauthenticated.Code)
	}
	// Site management keys were removed; the scheme is no longer accepted.
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		path := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", a.ID)
		if got := requestJSON(t, env.router, method, path, "", "EcokuSite "+strings.Repeat("a", 32), nil).Code; got != http.StatusUnauthorized {
			t.Fatalf("EcokuSite %s=%d", method, got)
		}
	}
	list := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites/site-a/comments?status=published", adminTestOrigin, "Bearer "+env.token, nil)
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), "private@example.com") || strings.Contains(list.Body.String(), "秘密") {
		t.Fatalf("list=%d %s", list.Code, list.Body.String())
	}
	invalid := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites/site-a/comments?status=pending", adminTestOrigin, "Bearer "+env.token, nil)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("unsupported status filter=%d", invalid.Code)
	}
	for _, path := range []string{
		fmt.Sprintf("/api/admin/sites/site-a/comments/%d/approve", a.ID),
		"/api/admin/sites/site-a/comments/batch",
	} {
		response := requestJSON(t, env.router, http.MethodPatch, path, adminTestOrigin, "Bearer "+env.token, map[string]any{})
		if response.Code != http.StatusNotFound {
			t.Fatalf("legacy route %s=%d", path, response.Code)
		}
	}
}

func TestTombstoneAndPermanentDeleteSemantics(t *testing.T) {
	env := setupAdminTest(t)
	email := "visitor@example.com"
	root := model.Comment{SiteID: "site-a", Mark: "/post", Username: "根", Email: &email, Content: "正文"}
	if err := model.DB.Create(&root).Error; err != nil {
		t.Fatal(err)
	}
	child := model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "回复", Content: "保留"}
	if err := model.DB.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", root.ID)
	for range 2 {
		deleted := requestJSON(t, env.router, http.MethodDelete, path, adminTestOrigin, "Bearer "+env.token, nil)
		if deleted.Code != http.StatusOK {
			t.Fatalf("delete=%d %s", deleted.Code, deleted.Body.String())
		}
	}
	var stored model.Comment
	if err := model.DB.First(&stored, root.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.DeletedAt == nil || stored.Email != nil || stored.Content != "" || stored.Username != "" || stored.IsBlogger {
		t.Fatalf("tombstone=%#v", stored)
	}
	permanentRoot := requestJSON(t, env.router, http.MethodDelete, path+"/permanent", adminTestOrigin, "Bearer "+env.token, nil)
	if permanentRoot.Code != http.StatusConflict {
		t.Fatalf("parent permanent=%d", permanentRoot.Code)
	}
	childPath := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", child.ID)
	if got := requestJSON(t, env.router, http.MethodDelete, childPath, adminTestOrigin, "Bearer "+env.token, nil).Code; got != http.StatusOK {
		t.Fatalf("child tombstone=%d", got)
	}
	if got := requestJSON(t, env.router, http.MethodDelete, childPath+"/permanent", adminTestOrigin, "Bearer "+env.token, nil).Code; got != http.StatusOK {
		t.Fatalf("admin permanent=%d", got)
	}
}

func TestSiteWriteContractOmitsDerivedDomainAndReviewMode(t *testing.T) {
	env := setupAdminTest(t)
	payload := map[string]any{
		"id": "site-c", "site_url": "https://c.example/path", "name": "站点 C",
		"allowed_origins": []string{"https://c.example"}, "default_sort": "oldest",
		"i18n": "en",
		"email_required": false, "website_required": true, "placeholder": "说点什么",
		"comment_limit": 2048, "empty_message": "暂时没有评论",
		"smoji_enabled": true, "smoji_manifest_url": "https://static.example/smoji.json",
	}
	created := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, payload)
	if created.Code != http.StatusCreated {
		t.Fatalf("create=%d %s", created.Code, created.Body.String())
	}
	body := created.Body.String()
	for _, forbidden := range []string{"\"domain\"", "default_status", "review_mode"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response contains %s: %s", forbidden, body)
		}
	}
	if !strings.Contains(body, "站点 C") || !strings.Contains(body, `"i18n":"en"`) || !strings.Contains(body, "\"comment_limit\":2048") || !strings.Contains(body, `"smoji_enabled":true`) || !strings.Contains(body, `"smoji_manifest_url":"https://static.example/smoji.json"`) {
		t.Fatalf("response=%s", body)
	}
	delete(payload, "i18n")
	payload["revision"] = 1
	updated := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-c", adminTestOrigin, "Bearer "+env.token, payload)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"i18n":"en"`) {
		t.Fatalf("omitted i18n changed the site locale: %d %s", updated.Code, updated.Body.String())
	}
	public := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-c&key=/post", "https://c.example", "", nil)
	if public.Code != http.StatusOK || !strings.Contains(public.Body.String(), `"i18n":"en"`) {
		t.Fatalf("public form config lost the site locale: %d %s", public.Code, public.Body.String())
	}
	payload["revision"] = 2
	payload["i18n"] = "fr"
	unknown := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-c", adminTestOrigin, "Bearer "+env.token, payload)
	if unknown.Code != http.StatusBadRequest || !strings.Contains(unknown.Body.String(), "评论区语言无效") {
		t.Fatalf("unknown locale was not rejected: %d %s", unknown.Code, unknown.Body.String())
	}
	delete(payload, "i18n")
	delete(payload, "revision")
	payload["id"] = "site-http-smoji"
	payload["smoji_manifest_url"] = "http://static.example/smoji.json"
	invalid := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, payload)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("non-HTTPS Smoji manifest accepted: %d %s", invalid.Code, invalid.Body.String())
	}
}

func TestSiteSmojiImageOriginRoundTrip(t *testing.T) {
	env := setupAdminTest(t)
	payload := map[string]any{
		"id": "site-smoji", "site_url": "https://blog.example", "allowed_origins": []string{"https://blog.example"},
		"smoji_enabled": true, "smoji_manifest_url": "https://blog.example/smoji.json", "smoji_image_origin": "https://CDN.example:443/",
	}
	created := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, payload)
	if created.Code != http.StatusCreated || !strings.Contains(created.Body.String(), `"smoji_image_origin":"https://cdn.example"`) {
		t.Fatalf("create=%d %s", created.Code, created.Body.String())
	}
	public := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-smoji&key=/post", "https://blog.example", "", nil)
	if public.Code != http.StatusOK || !strings.Contains(public.Body.String(), `"imageOrigin":"https://cdn.example"`) {
		t.Fatalf("public=%d %s", public.Code, public.Body.String())
	}
	delete(payload, "smoji_image_origin")
	payload["revision"] = 1
	updated := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-smoji", adminTestOrigin, "Bearer "+env.token, payload)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"smoji_image_origin":"https://cdn.example"`) {
		t.Fatalf("legacy write lost origin: %d %s", updated.Code, updated.Body.String())
	}
	payload["revision"] = 2
	for _, invalid := range []string{"http://cdn.example", "https://cdn.example/path", "https://cdn.example?", "https://cdn.example#", "https://*.example"} {
		payload["smoji_image_origin"] = invalid
		rejected := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-smoji", adminTestOrigin, "Bearer "+env.token, payload)
		if rejected.Code != http.StatusBadRequest {
			t.Fatalf("invalid origin %q: %d %s", invalid, rejected.Code, rejected.Body.String())
		}
	}
	payload["smoji_image_origin"] = ""
	cleared := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-smoji", adminTestOrigin, "Bearer "+env.token, payload)
	if cleared.Code != http.StatusOK {
		t.Fatalf("clear=%d %s", cleared.Code, cleared.Body.String())
	}
	site, err := model.GetSite("site-smoji")
	if err != nil || site.SmojiImageOrigin != "" || site.SmojiOrigin() != "https://blog.example" {
		t.Fatalf("clear did not restore same origin: %#v %v", site, err)
	}
}

func TestSiteWritePersistsBloggerBadge(t *testing.T) {
	env := setupAdminTest(t)
	payload := map[string]any{
		"id": "site-badge", "site_url": "https://badge.example",
		"allowed_origins":  []string{"https://badge.example"},
		"blogger_nickname": "站长", "blogger_email": "owner@example.test",
		"blogger_badge": "[OP]", "blogger_passphrase": "correct-horse-battery",
	}
	created := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, payload)
	if created.Code != http.StatusCreated {
		t.Fatalf("create=%d %s", created.Code, created.Body.String())
	}
	if strings.Contains(created.Body.String(), "correct-horse-battery") {
		t.Fatalf("passphrase echoed: %s", created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"blogger_badge":"[OP]"`) {
		t.Fatalf("missing badge: %s", created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"blogger_email":"owner@example.test"`) {
		t.Fatalf("admin DTO missing private blogger email: %s", created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"blogger_passphrase_set":true`) {
		t.Fatalf("admin DTO missing passphrase flag: %s", created.Body.String())
	}
}

func TestSiteUpdateDoesNotGrantUnprovenBloggerIdentity(t *testing.T) {
	env := setupAdminTest(t)
	ownerEmail := "OWNER@example.test"
	if err := model.DB.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}
	historical := model.Comment{SiteID: "site-a", Mark: "/post", Username: "站长", Email: &ownerEmail, Content: "历史博主"}
	guest := model.Comment{SiteID: "site-a", Mark: "/post", Username: "访客", Content: "普通访客"}
	if err := model.DB.Create(&historical).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Create(&guest).Error; err != nil {
		t.Fatal(err)
	}
	site := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites/site-a", adminTestOrigin, "Bearer "+env.token, nil)
	if site.Code != http.StatusOK {
		t.Fatalf("get site=%d %s", site.Code, site.Body.String())
	}
	var siteEnvelope struct {
		Data struct {
			Site struct {
				Revision uint `json:"revision"`
			} `json:"site"`
		} `json:"data"`
	}
	if err := json.Unmarshal(site.Body.Bytes(), &siteEnvelope); err != nil {
		t.Fatal(err)
	}
	updated := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-a", adminTestOrigin, "Bearer "+env.token, map[string]any{
		"site_url": "https://a.example", "allowed_origins": []string{"https://a.example"},
		"blogger_nickname": "站长", "blogger_email": "owner@example.test",
		"blogger_passphrase": "correct-horse-battery", "revision": siteEnvelope.Data.Site.Revision,
	})
	if updated.Code != http.StatusOK {
		t.Fatalf("update=%d %s", updated.Code, updated.Body.String())
	}
	var flagged, plain int64
	if err := model.DB.Model(&model.Comment{}).Where("id = ? AND is_blogger = 0", historical.ID).Count(&flagged).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Model(&model.Comment{}).Where("id = ? AND is_blogger = 0", guest.ID).Count(&plain).Error; err != nil {
		t.Fatal(err)
	}
	if flagged != 1 || plain != 1 {
		t.Fatalf("backfill mismatch flagged=%d plain=%d", flagged, plain)
	}
	for _, passphrase := range []string{"", "another-correct-passphrase"} {
		current, err := model.GetSite("site-a")
		if err != nil {
			t.Fatal(err)
		}
		payload := map[string]any{
			"site_url": "https://a.example", "allowed_origins": []string{"https://a.example"},
			"blogger_nickname": "站长", "blogger_email": "owner@example.test",
			"revision": current.Revision, "placeholder": "新提示",
		}
		if passphrase != "" {
			payload["blogger_passphrase"] = passphrase
		}
		response := requestJSON(t, env.router, http.MethodPut, "/api/admin/sites/site-a", adminTestOrigin, "Bearer "+env.token, payload)
		if response.Code != http.StatusOK {
			t.Fatalf("update=%d", response.Code)
		}
		var saved model.Comment
		if err := model.DB.First(&saved, historical.ID).Error; err != nil {
			t.Fatal(err)
		}
		if saved.IsBlogger {
			t.Fatal("unproven comment became blogger after save/rotation")
		}
	}

}

func TestSiteCreateDoesNotBackfillOtherSiteComments(t *testing.T) {
	env := setupAdminTest(t)
	ownerEmail := "owner@example.test"
	if err := model.DB.Exec(`UPDATE sites SET blogger_nickname = '', blogger_email = '' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}
	historical := model.Comment{SiteID: "site-a", Mark: "/legacy", Username: "站长", Email: &ownerEmail, Content: "升级前博主"}
	if err := model.DB.Create(&historical).Error; err != nil {
		t.Fatal(err)
	}
	created := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, map[string]any{
		"id": "site-backfill", "site_url": "https://backfill.example", "allowed_origins": []string{"https://backfill.example"},
		"blogger_nickname": "站长", "blogger_email": "owner@example.test",
		"blogger_passphrase": "correct-horse-battery",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("create=%d %s", created.Code, created.Body.String())
	}
	var flagged int64
	if err := model.DB.Model(&model.Comment{}).Where("id = ? AND is_blogger = 1", historical.ID).Count(&flagged).Error; err != nil {
		t.Fatal(err)
	}
	if flagged != 0 {
		t.Fatalf("create should not backfill comments on other sites, got=%d", flagged)
	}
}

func requestJSON(t *testing.T, handler http.Handler, method, path, origin, authorization string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, reader)
	request.RemoteAddr = "192.0.2.10:1234"
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	if authorization != "" {
		request.Header.Set("Authorization", authorization)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}
