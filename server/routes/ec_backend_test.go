package routes

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func TestEC18DeleteReportsChildren(t *testing.T) {
	env := setupAdminTest(t)
	root := model.Comment{SiteID: "site-a", Mark: "/post", Username: "parent", Content: "root"}
	if err := model.DB.Create(&root).Error; err != nil {
		t.Fatal(err)
	}
	child := model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "child", Content: "reply"}
	if err := model.DB.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		id       uint
		children bool
	}{{root.ID, true}, {child.ID, false}} {
		path := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", tc.id)
		for attempt := range 2 {
			response := requestJSON(t, env.router, http.MethodDelete, path, adminTestOrigin, "Bearer "+env.token, nil)
			if response.Code != http.StatusOK {
				t.Fatalf("delete=%d %s", response.Code, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), fmt.Sprintf(`"has_children":%t`, tc.children)) {
				t.Errorf("EC-18: DELETE attempt %d id %d wrong child state: %s", attempt, tc.id, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), fmt.Sprintf(`"unchanged":%t`, attempt > 0)) {
				t.Errorf("wrong idempotence: %s", response.Body.String())
			}
		}
		response := requestJSON(t, env.router, http.MethodGet, path, adminTestOrigin, "Bearer "+env.token, nil)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), fmt.Sprintf(`"has_children":%t`, tc.children)) {
			t.Fatalf("GET child state=%d %s", response.Code, response.Body.String())
		}
	}
	path := fmt.Sprintf("/api/admin/sites/site-a/comments/%d/permanent", root.ID)
	if got := requestJSON(t, env.router, http.MethodDelete, path, adminTestOrigin, "Bearer "+env.token, nil).Code; got != http.StatusConflict {
		t.Fatalf("parent permanent deletion=%d", got)
	}
}

func TestEC12ReviewLegacyIPv6Admission(t *testing.T) {
	for _, tc := range []struct{ stored, browser, other string }{
		{"https://[0:0:0:0:0:0:0:1]:08443", "https://[::1]:8443", "https://[::1]:9443"},
		{"https://[0:0:0:0:0:0:0:1]", "https://[::1]", "https://[::1]:9443"},
		{"https://[0:0:0:0:0:ffff:c000:201]:08443", "https://[::ffff:c000:201]:8443", "https://192.0.2.1:8443"},
	} {
		t.Run(tc.stored, func(t *testing.T) {
			env := setupAdminTest(t)
			if err := model.DB.Exec("UPDATE site_origins SET origin = ? WHERE site_id = 'site-a'", tc.stored).Error; err != nil {
				t.Fatal(err)
			}
			response := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", tc.browser, "", nil)
			if response.Code != http.StatusOK {
				t.Errorf("EC-12 review: legacy IPv6 list=%d %s", response.Code, response.Body.String())
			} else if response.Header().Get("Access-Control-Allow-Origin") != tc.browser {
				t.Errorf("CORS header differs from serialized browser origin: %q", response.Header().Get("Access-Control-Allow-Origin"))
			}
			response = requestJSON(t, env.router, http.MethodPost, "/api/comment/submit", tc.browser, "", map[string]any{"siteId": "site-a", "mark": "/post", "username": "Guest", "email": "guest@example.test", "content": "test", "parent": 0})
			if response.Code != http.StatusCreated {
				t.Errorf("EC-12 review: legacy IPv6 submit=%d %s", response.Code, response.Body.String())
			}
			// CORS may admit site-a's origin, but it must not authorize site-b.
			response = requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-b&key=/post", tc.browser, "", nil)
			if response.Code != http.StatusForbidden {
				t.Errorf("cross-site IPv6 admission=%d", response.Code)
			}
			// Give the negative origin a global match to exercise the scoped comparison too.
			if err := model.DB.Exec("UPDATE site_origins SET origin = ? WHERE site_id = 'site-b'", tc.other).Error; err != nil {
				t.Fatal(err)
			}
			response = requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", tc.other, "", nil)
			if response.Code != http.StatusForbidden {
				t.Errorf("distinct port/address admitted=%d", response.Code)
			}
			// Now admit canonical IPv6 globally and verify the legacy row at the site boundary.
			if err := model.DB.Exec("UPDATE site_origins SET origin = ? WHERE site_id = 'site-b'", tc.browser).Error; err != nil {
				t.Fatal(err)
			}
			response = requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=site-a&key=/post", tc.browser, "", nil)
			if response.Code != http.StatusOK {
				t.Errorf("EC-12 review: scoped legacy IPv6 list=%d %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestEC12OriginAdmission(t *testing.T) {
	for _, tc := range []struct{ stored, browser string }{
		{"https://ports.example:443", "https://ports.example"},
		{"http://ports.example:00080", "http://ports.example"},
		{"https://[::1]:00443", "https://[::1]"},
		{"https://ports.example:08443", "https://ports.example:8443"},
	} {
		t.Run(tc.stored, func(t *testing.T) {
			env := setupAdminTest(t)
			created := requestJSON(t, env.router, http.MethodPost, "/api/admin/sites", adminTestOrigin, "Bearer "+env.token, map[string]any{"id": "ports", "site_url": tc.browser, "allowed_origins": []string{tc.stored}})
			if created.Code != http.StatusCreated {
				t.Fatalf("create=%d %s", created.Code, created.Body.String())
			}
			for _, legacy := range []bool{false, true} {
				if legacy {
					if err := model.DB.Exec("UPDATE site_origins SET origin = ? WHERE site_id = 'ports'", tc.stored).Error; err != nil {
						t.Fatal(err)
					}
				}
				response := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=ports&key=/post", tc.browser, "", nil)
				if response.Code != http.StatusOK {
					t.Errorf("EC-12: public list legacy=%t status=%d %s", legacy, response.Code, response.Body.String())
				}
				request := httptest.NewRequest(http.MethodOptions, "/api/comment/submit", nil)
				request.Header.Set("Origin", tc.browser)
				request.Header.Set("Access-Control-Request-Method", "POST")
				preflight := httptest.NewRecorder()
				env.router.ServeHTTP(preflight, request)
				if preflight.Code != http.StatusNoContent {
					t.Errorf("EC-12: preflight legacy=%t status=%d", legacy, preflight.Code)
				}
				submitted := requestJSON(t, env.router, http.MethodPost, "/api/comment/submit", tc.browser, "", map[string]any{"siteId": "ports", "mark": "/post", "username": "Guest", "email": "guest@example.test", "content": "test", "parent": 0})
				if submitted.Code != http.StatusCreated {
					t.Errorf("EC-12: submit legacy=%t status=%d %s", legacy, submitted.Code, submitted.Body.String())
				}
			}
			// Another site's exact match admits CORS; the target still needs its own compatible registration.
			if err := model.DB.Exec("UPDATE site_origins SET origin = ? WHERE site_id = 'site-b'", tc.browser).Error; err != nil {
				t.Fatal(err)
			}
			response := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=ports&key=/post", tc.browser, "", nil)
			if response.Code != http.StatusOK {
				t.Errorf("EC-12: site-specific admission=%d %s", response.Code, response.Body.String())
			}
			if err := model.DB.Exec("UPDATE site_origins SET origin = 'https://ports.example:9443' WHERE site_id = 'ports'").Error; err != nil {
				t.Fatal(err)
			}
			response = requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=ports&key=/post", tc.browser, "", nil)
			if response.Code != http.StatusForbidden {
				t.Fatalf("nondefault-port isolation=%d", response.Code)
			}
		})
	}
}

func TestEC12AdminDefaultPortLogin(t *testing.T) {
	env := setupAdminTest(t)
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{adminTestOrigin + ":00443"}}}); err != nil {
		t.Fatal(err)
	}
	var err error
	env.router, err = NewRouter()
	if err != nil {
		t.Fatal(err)
	}
	response := requestJSON(t, env.router, http.MethodPost, "/api/admin/login", adminTestOrigin, "", map[string]any{"username": "instance-admin", "password": "test-admin-password"})
	if response.Code != http.StatusOK {
		t.Errorf("EC-12: default-port admin login=%d %s", response.Code, response.Body.String())
	}
	response = requestJSON(t, env.router, http.MethodPost, "/api/admin/login", "https://other.example", "", map[string]any{"username": "instance-admin", "password": "test-admin-password"})
	if response.Code != http.StatusForbidden {
		t.Fatalf("unregistered admin origin=%d", response.Code)
	}
}

func TestEC14SeedLocalePublicProjection(t *testing.T) {
	for _, locale := range []string{"en", "zh-Hant", ""} {
		t.Run(locale, func(t *testing.T) {
			env := setupAdminTest(t)
			if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{ID: "seed", SiteURL: "https://seed.example", AllowedOrigins: []string{"https://seed.example"}, Locale: locale}}}); err != nil {
				t.Fatal(err)
			}
			database, err := model.OpenSQLiteDatabase(filepath.Join(t.TempDir(), "locale.sqlite3"))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = model.CloseSQLiteDatabase(database) })
			if err := model.PrepareDatabaseForStartup(database); err != nil {
				t.Fatal(err)
			}
			model.DB = database
			response := requestJSON(t, env.router, http.MethodGet, "/api/comment/list?siteId=seed&key=/post", "https://seed.example", "", nil)
			if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"i18n":"`+string(config.NormalizeLocale(locale))+`"`) {
				t.Fatalf("EC-14: public locale=%d %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestEC18ChildQueryFailureRollsBack(t *testing.T) {
	env := setupAdminTest(t)
	comment := model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "retained"}
	if err := model.DB.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
	injected := false
	if err := model.DB.Callback().Query().Before("gorm:query").Register("ec18:fail-count", func(tx *gorm.DB) {
		if _, count := tx.Statement.Dest.(*int64); tx.Statement.Table == "comments" && count {
			injected = true
			tx.AddError(fmt.Errorf("EC-18 fixture query failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("ec18:fail-count")
	path := fmt.Sprintf("/api/admin/sites/site-a/comments/%d", comment.ID)
	response := requestJSON(t, env.router, http.MethodDelete, path, adminTestOrigin, "Bearer "+env.token, nil)
	if !injected {
		t.Fatal("child query failure was not injected")
	}
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("child query error ignored: %d %s", response.Code, response.Body.String())
	}
	var stored model.Comment
	if err := model.DB.First(&stored, comment.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.DeletedAt != nil || stored.Content != comment.Content {
		t.Fatal("failed delete changed comment")
	}
}
