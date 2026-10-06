package routes

import (
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TestServerListenAddressRuntime(t *testing.T) {
	previous := config.GlobalConfig
	config.GlobalConfig = &config.Config{Site: config.SiteConfig{Port: 12345}}
	t.Cleanup(func() { config.GlobalConfig = previous })
	for _, tc := range []struct{ runtime, address string }{
		{"", "127.0.0.1:12345"},
		{"container", ":12345"},
	} {
		t.Run(tc.address, func(t *testing.T) {
			t.Setenv("ECOKU_RUNTIME", tc.runtime)
			if got := serverListenAddress(); got != tc.address {
				t.Fatalf("address=%q want=%q", got, tc.address)
			}
		})
	}
}

func TestConfiguredSiteKeyOnlyTombstonesItsOwnSite(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	key := strings.Repeat("dummykey", 4)
	t.Setenv("ECOKU_HARDENING_SITE_KEY", key)
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{
		{ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}, ManagementKeyEnv: "ECOKU_HARDENING_SITE_KEY"},
	}}); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, model.DB, testsite.Site{ID: "site-b", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}})
	comments := []model.Comment{
		{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "own comment"},
		{SiteID: "site-b", Mark: "/post", Username: "Other", Content: "other comment"},
	}
	if err := model.DB.Create(&comments).Error; err != nil {
		t.Fatal(err)
	}
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	ownPath := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", comments[0].ID)
	if got := requestJSON(t, router, http.MethodDelete, ownPath, "", "EcokuSite "+key, nil); got.Code != http.StatusOK {
		t.Fatalf("same-site tombstone=%d %s", got.Code, got.Body.String())
	}
	for _, tc := range []struct{ method, path string }{
		{http.MethodDelete, fmt.Sprintf("/api/admin/sites/site-b/comments/%d", comments[1].ID)},
		{http.MethodGet, "/api/admin/sites/site-a/comments"},
		{http.MethodGet, ownPath},
		{http.MethodDelete, ownPath + "/permanent"},
		{http.MethodPut, "/api/admin/sites/site-a"},
		{http.MethodPut, "/api/admin/captcha"},
	} {
		if got := requestJSON(t, router, tc.method, tc.path, "", "EcokuSite "+key, nil); got.Code != http.StatusForbidden {
			t.Fatalf("%s %s status=%d", tc.method, tc.path, got.Code)
		}
	}
	var own, other model.Comment
	if err := model.DB.First(&own, comments[0].ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.First(&other, comments[1].ID).Error; err != nil {
		t.Fatal(err)
	}
	if own.DeletedAt == nil || own.Content != "" || own.Username != "" || other.DeletedAt != nil || other.Content != comments[1].Content {
		t.Fatal("site-key boundary changed comment state unexpectedly")
	}
}

func TestUnknownPublicAPISkipsOriginLookupWithoutChangingPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configureRoutesTest(t)
	router, err := NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	queries := 0
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:unknown-api", func(tx *gorm.DB) {
		if tx.Statement.Table == "site_origins" {
			queries++
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:unknown-api")
	for _, path := range []string{"/api", "/api/not-registered", "/api/count/batch"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Origin", "https://a.example")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusNotFound || queries != 0 {
			t.Fatalf("%s status=%d origin queries=%d", path, recorder.Code, queries)
		}
	}
	for _, tc := range []struct {
		origin string
		status int
	}{
		{"https://a.example", http.StatusNoContent},
		{"https://unregistered.example", http.StatusForbidden},
	} {
		req := httptest.NewRequest(http.MethodOptions, "/api/not-registered", nil)
		req.Header.Set("Origin", tc.origin)
		recorder := httptest.NewRecorder()
		queries = 0
		router.ServeHTTP(recorder, req)
		if recorder.Code != tc.status || queries != 1 {
			t.Fatalf("preflight status=%d want=%d origin queries=%d", recorder.Code, tc.status, queries)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", nil)
	req.Header.Set("Origin", "https://a.example")
	recorder := httptest.NewRecorder()
	queries = 0
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK || queries == 0 {
		t.Fatalf("registered route status=%d origin queries=%d", recorder.Code, queries)
	}
}
