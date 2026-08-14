package routes

import (
	"bytes"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	adminTestOrigin = "https://admin.example"
	adminSiteAKey   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	adminSiteBKey   = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

type adminEnvironment struct {
	router *gin.Engine
	token  string
}

func setupAdminTest(t *testing.T) adminEnvironment {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ECOKU_ADMIN_SITE_A_KEY", adminSiteAKey)
	t.Setenv("ECOKU_ADMIN_SITE_B_KEY", adminSiteBKey)
	t.Setenv("ECOKU_ADMIN_USERNAME", "instance-admin")
	t.Setenv("ECOKU_ADMIN_PASSWORD_HASH", string(hash))
	t.Setenv("ECOKU_ADMIN_TOKEN_KEY", strings.Repeat("t", 32))
	t.Setenv("ECOKU_NOTIFICATION_KEY", base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	staticDir := filepath.Join(t.TempDir(), "admin")
	if err := os.MkdirAll(filepath.Join(staticDir, "assets"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(staticDir, "templates"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<!doctype html>"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"email-blogger-new-comment.html", "email-blogger-new-reply.html", "email-visitor-reply.html", "telegram-notification.html"} {
		if err := os.WriteFile(filepath.Join(staticDir, "templates", name), []byte("<!doctype html>"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := config.ApplyConfig(&config.Config{
		Sites: []config.RegisteredSiteConfig{
			{ID: "site-a", Name: "站点 A", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}, ManagementKeyEnv: "ECOKU_ADMIN_SITE_A_KEY"},
			{ID: "site-b", Name: "站点 B", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}, ManagementKeyEnv: "ECOKU_ADMIN_SITE_B_KEY"},
		},
		Admin:         config.AdminConfig{Enabled: true, StaticDir: staticDir, UsernameEnv: "ECOKU_ADMIN_USERNAME", PasswordHashEnv: "ECOKU_ADMIN_PASSWORD_HASH", TokenKeyEnv: "ECOKU_ADMIN_TOKEN_KEY", AllowedOrigins: []string{adminTestOrigin}},
		Notifications: config.NotificationsConfig{EncryptionKeyEnv: "ECOKU_NOTIFICATION_KEY", InstancePublicURL: "https://comments.example"},
	}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/admin.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
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
	var envelope struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &envelope); err != nil || envelope.Data.Token == "" {
		t.Fatalf("login response=%s err=%v", login.Body.String(), err)
	}
	return adminEnvironment{router: router, token: envelope.Data.Token}
}

func TestAdminStaticCSPAllowsStyleAttributesWithoutInlineScripts(t *testing.T) {
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
	if !strings.Contains(csp, "script-src 'self'") || !strings.Contains(csp, "style-src 'self'") {
		t.Fatalf("administrator UI lost its self-only script/style policy: %q", csp)
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
	wrongSite := requestJSON(t, env.router, http.MethodGet, "/api/admin/sites/site-b/comments", "", "EcokuSite "+adminSiteAKey, nil)
	if wrongSite.Code != http.StatusForbidden {
		t.Fatalf("wrong-site=%d", wrongSite.Code)
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
		deleted := requestJSON(t, env.router, http.MethodDelete, path, "", "EcokuSite "+adminSiteAKey, nil)
		if deleted.Code != http.StatusOK {
			t.Fatalf("delete=%d %s", deleted.Code, deleted.Body.String())
		}
	}
	var stored model.Comment
	if err := model.DB.First(&stored, root.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.DeletedAt == nil || stored.Email != nil || stored.Content != "" || stored.Username != "" {
		t.Fatalf("tombstone=%#v", stored)
	}
	permanentRoot := requestJSON(t, env.router, http.MethodDelete, path+"/permanent", adminTestOrigin, "Bearer "+env.token, nil)
	if permanentRoot.Code != http.StatusConflict {
		t.Fatalf("parent permanent=%d", permanentRoot.Code)
	}
	childPath := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", child.ID)
	if got := requestJSON(t, env.router, http.MethodDelete, childPath, "", "EcokuSite "+adminSiteAKey, nil).Code; got != http.StatusOK {
		t.Fatalf("child tombstone=%d", got)
	}
	if got := requestJSON(t, env.router, http.MethodDelete, childPath+"/permanent", "", "EcokuSite "+adminSiteAKey, nil).Code; got != http.StatusForbidden {
		t.Fatalf("site-key permanent=%d", got)
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
		"email_required": false, "website_required": true, "placeholder": "说点什么",
		"comment_limit": 2048, "empty_message": "暂时没有评论",
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
	if !strings.Contains(body, "站点 C") || !strings.Contains(body, "\"comment_limit\":2048") {
		t.Fatalf("response=%s", body)
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
