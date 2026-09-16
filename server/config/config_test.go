package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestApplyConfigRegistersSitesAndAppliesCommentDefaults(t *testing.T) {
	t.Setenv("ECOKU_TEST_SITE_KEY", strings.Repeat("k", 32))
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"HTTPS://Example.COM/"},
			ManagementKeyEnv: "ECOKU_TEST_SITE_KEY",
		}},
	}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	if limit, window := GetRateLimit("comment_list"); limit != 60 || window != time.Minute {
		t.Fatalf("list rate default=%d/%s", limit, window)
	}
	if loaded.Sites[0].AllowedOrigins[0] != "https://example.com" {
		t.Fatalf("normalized origin = %q", loaded.Sites[0].AllowedOrigins[0])
	}
	if loaded.Database.SQLite.Path != "./data/ecoku.bin" {
		t.Fatalf("default sqlite path = %q", loaded.Database.SQLite.Path)
	}
	if loaded.Site.LogPath != "" {
		t.Fatalf("empty log_path should stay stdout, got %q", loaded.Site.LogPath)
	}
	if _, ok := GetRegisteredSite("unknown"); ok {
		t.Fatal("unknown site was registered")
	}
	form, ok := GetCommentFormConfig("site-a")
	if !ok {
		t.Fatal("default form configuration unavailable")
	}
	if !form.EmailRequired || form.WebsiteRequired || form.Placeholder != DefaultCommentPlaceholder ||
		form.DefaultSort != DefaultCommentSort || form.LengthLimit != DefaultCommentLimit || form.EmptyMessage != DefaultEmptyMessage {
		t.Fatalf("default form configuration = %#v", form)
	}
}

func TestCommentListRateLimitConfiguration(t *testing.T) {
	for _, value := range []int{7, -1} {
		loaded := &Config{RateLimit: RateLimitConfig{CommentList: value, WindowSeconds: 30}}
		err := ApplyConfig(loaded)
		if value < 0 {
			if err == nil || !strings.Contains(err.Error(), "comment_list") {
				t.Fatalf("negative limit error=%v", err)
			}
		} else {
			if err != nil {
				t.Fatal(err)
			}
			if limit, window := GetRateLimit("comment_list"); limit != value || window != 30*time.Second {
				t.Fatalf("limit=%d window=%s", limit, window)
			}
		}
	}
}

func TestApplyConfigResolvesAndValidatesCommentFormConfiguration(t *testing.T) {
	t.Setenv("ECOKU_FORM_SITE_KEY", strings.Repeat("f", 32))
	emailRequired := false
	websiteRequired := true
	loaded := &Config{Sites: []RegisteredSiteConfig{{
		ID:               "site-form",
		AllowedOrigins:   []string{"https://form.example"},
		ManagementKeyEnv: "ECOKU_FORM_SITE_KEY",
		Comment: CommentConfig{
			EmailRequired:   &emailRequired,
			WebsiteRequired: &websiteRequired,
			Placeholder:     "  分享你的想法  ",
			DefaultSort:     "oldest",
			LengthLimit:     321,
			EmptyMessage:    "暂时没有评论",
		},
	}}}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("apply form config: %v", err)
	}
	form, ok := GetCommentFormConfig("site-form")
	if !ok || form.EmailRequired || !form.WebsiteRequired || form.Placeholder != "分享你的想法" ||
		form.DefaultSort != "oldest" || form.LengthLimit != 321 || form.EmptyMessage != "暂时没有评论" {
		t.Fatalf("resolved form configuration = %#v, %v", form, ok)
	}

	for name, placeholder := range map[string]string{
		"too long":  strings.Repeat("字", maximumCommentPlaceholderLength+1),
		"multiline": "第一行\n第二行",
	} {
		t.Run(name, func(t *testing.T) {
			candidate := *loaded
			candidate.Sites = append([]RegisteredSiteConfig(nil), loaded.Sites...)
			candidate.Sites[0].Comment.Placeholder = placeholder
			if err := ApplyConfig(&candidate); err == nil {
				t.Fatalf("invalid placeholder %q was accepted", placeholder)
			}
		})
	}
}

func TestApplyConfigAllowsSiteWithoutManagementSecret(t *testing.T) {
	loaded := &Config{Sites: []RegisteredSiteConfig{{
		ID:             "site-a",
		SiteURL:        "https://example.com",
		AllowedOrigins: []string{"https://example.com"},
	}}}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("site without optional management key: %v", err)
	}
	if _, ok := GetManagementKey("site-a"); ok {
		t.Fatal("site without a binding exposed a management key")
	}
}

func TestTrustedProxyMustBeExactIPOrCIDR(t *testing.T) {
	t.Setenv("ECOKU_PROXY_SITE_KEY", strings.Repeat("p", 32))
	loaded := &Config{
		Site: SiteConfig{TrustedProxies: []string{"*"}},
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://example.com"},
			ManagementKeyEnv: "ECOKU_PROXY_SITE_KEY",
		}},
	}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("wildcard trusted proxy was accepted")
	}
}

func TestTrustedProxyRejectsArbitraryNetworks(t *testing.T) {
	t.Setenv("ECOKU_PROXY_SITE_KEY", strings.Repeat("p", 32))
	for _, network := range []string{"0.0.0.0/0", "::/0"} {
		loaded := &Config{
			Site: SiteConfig{TrustedProxies: []string{network}},
			Sites: []RegisteredSiteConfig{{
				ID:               "site-a",
				AllowedOrigins:   []string{"https://example.com"},
				ManagementKeyEnv: "ECOKU_PROXY_SITE_KEY",
			}},
		}
		if err := ApplyConfig(loaded); err == nil {
			t.Fatalf("arbitrary trusted proxy %q was accepted", network)
		}
	}
	loaded := &Config{
		Site: SiteConfig{TrustedProxies: []string{"172.17.0.1/32"}},
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://example.com"},
			ManagementKeyEnv: "ECOKU_PROXY_SITE_KEY",
		}},
	}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("docker gateway proxy rejected: %v", err)
	}
}

func TestExampleConfigurationLoads(t *testing.T) {
	t.Setenv("ECOKU_EXAMPLE_SITE_MANAGEMENT_KEY", strings.Repeat("e", 32))
	if err := LoadConfigFile("../config.yaml.example"); err != nil {
		t.Fatalf("load example config: %v", err)
	}
}

func TestSitesCannotShareManagementCredentials(t *testing.T) {
	sharedKey := strings.Repeat("q", 32)
	t.Setenv("ECOKU_SHARED_SITE_KEY_A", sharedKey)
	t.Setenv("ECOKU_SHARED_SITE_KEY_B", sharedKey)
	loaded := &Config{Sites: []RegisteredSiteConfig{
		{ID: "site-a", AllowedOrigins: []string{"https://a.example"}, ManagementKeyEnv: "ECOKU_SHARED_SITE_KEY_A"},
		{ID: "site-b", AllowedOrigins: []string{"https://b.example"}, ManagementKeyEnv: "ECOKU_SHARED_SITE_KEY_B"},
	}}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("sites sharing the same management credential were accepted")
	}
}

func TestConfigFileRejectsUnknownFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("unknown_field: true\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	if err := LoadConfigFile(path); err == nil {
		t.Fatal("unknown YAML field was accepted")
	}
}

func TestRemovedUserAndMySQLConfigurationIsRejected(t *testing.T) {
	for name, data := range map[string]string{
		"ordinary user auth": "auth:\n  user_enabled: true\n",
		"smtp":               "smtp:\n  enabled: false\n",
		"mysql":              "database:\n  type: mysql\n  mysql:\n    host: localhost\n",
		"drop table":         "site:\n  drop_table: true\n",
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "config.yaml")
			if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
				t.Fatalf("write config: %v", err)
			}
			if err := LoadConfigFile(path); err == nil {
				t.Fatalf("removed %s configuration was accepted", name)
			}
		})
	}
}

func TestAdminAuthenticationIsDisabledWithoutCredentials(t *testing.T) {
	t.Setenv("ECOKU_DISABLED_ADMIN_SITE_KEY", strings.Repeat("d", 32))
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://site.example"},
			ManagementKeyEnv: "ECOKU_DISABLED_ADMIN_SITE_KEY",
		}},
	}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	if IsAdminEnabled() {
		t.Fatal("administrator authentication was enabled by default")
	}
	if _, ok := GetAdminCredentials(); ok {
		t.Fatal("disabled administrator credentials were available")
	}
}

func TestEnabledAdminRequiresSecureEnvironmentCredentials(t *testing.T) {
	t.Setenv("ECOKU_ADMIN_REQUIRED_SITE_KEY", strings.Repeat("s", 32))
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://site.example"},
			ManagementKeyEnv: "ECOKU_ADMIN_REQUIRED_SITE_KEY",
		}},
		Admin: AdminConfig{
			Enabled:         true,
			UsernameEnv:     "ECOKU_MISSING_ADMIN_USERNAME",
			PasswordHashEnv: "ECOKU_MISSING_ADMIN_PASSWORD_HASH",
			TokenKeyEnv:     "ECOKU_MISSING_ADMIN_TOKEN_KEY",
			AllowedOrigins:  []string{"https://admin.example"},
		},
	}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("enabled administrator authentication accepted missing environment credentials")
	}
}

func TestEnabledAdminUsesIndependentEnvironmentCredentials(t *testing.T) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	t.Setenv("ECOKU_ADMIN_VALID_SITE_KEY", strings.Repeat("s", 32))
	t.Setenv("ECOKU_ADMIN_VALID_USERNAME", "instance-admin")
	t.Setenv("ECOKU_ADMIN_VALID_PASSWORD_HASH", string(passwordHash))
	t.Setenv("ECOKU_ADMIN_VALID_TOKEN_KEY", strings.Repeat("t", 32))
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://site.example"},
			ManagementKeyEnv: "ECOKU_ADMIN_VALID_SITE_KEY",
		}},
		Admin: AdminConfig{
			Enabled:         true,
			UsernameEnv:     "ECOKU_ADMIN_VALID_USERNAME",
			PasswordHashEnv: "ECOKU_ADMIN_VALID_PASSWORD_HASH",
			TokenKeyEnv:     "ECOKU_ADMIN_VALID_TOKEN_KEY",
			AllowedOrigins:  []string{"HTTPS://ADMIN.EXAMPLE/"},
		},
	}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	credentials, ok := GetAdminCredentials()
	if !ok {
		t.Fatal("enabled administrator credentials unavailable")
	}
	if credentials.Username != "instance-admin" || credentials.PasswordHash != string(passwordHash) || credentials.TokenKey != strings.Repeat("t", 32) {
		t.Fatal("administrator credentials were not loaded from their environment variables")
	}
	if credentials.TokenTTL != 8*time.Hour {
		t.Fatalf("administrator token TTL = %s", credentials.TokenTTL)
	}
	if got := GetAdminAllowedOrigins(); len(got) != 1 || got[0] != "https://admin.example" {
		t.Fatalf("administrator origins = %#v", got)
	}
	loaded.Admin.TokenTTLMinutes = 60
	if err := ApplyConfig(loaded); err == nil || !strings.Contains(err.Error(), "480") {
		t.Fatal("custom TTL must explain the fixed lifetime")
	}
	loaded.Admin.TokenTTLMinutes = 480
	if err := ApplyConfig(loaded); err != nil {
		t.Fatal(err)
	}
}

func TestAdminOriginAndSigningKeyMustBeIndependent(t *testing.T) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	sharedKey := strings.Repeat("x", 32)
	t.Setenv("ECOKU_ADMIN_INDEPENDENCE_SITE_KEY", sharedKey)
	t.Setenv("ECOKU_ADMIN_INDEPENDENCE_USERNAME", "admin")
	t.Setenv("ECOKU_ADMIN_INDEPENDENCE_PASSWORD_HASH", string(passwordHash))
	t.Setenv("ECOKU_ADMIN_INDEPENDENCE_TOKEN_KEY", sharedKey)
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://shared.example"},
			ManagementKeyEnv: "ECOKU_ADMIN_INDEPENDENCE_SITE_KEY",
		}},
		Admin: AdminConfig{
			Enabled:         true,
			UsernameEnv:     "ECOKU_ADMIN_INDEPENDENCE_USERNAME",
			PasswordHashEnv: "ECOKU_ADMIN_INDEPENDENCE_PASSWORD_HASH",
			TokenKeyEnv:     "ECOKU_ADMIN_INDEPENDENCE_TOKEN_KEY",
			AllowedOrigins:  []string{"https://shared.example"},
		},
	}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("administrator origin or signing key was allowed to reuse a public-site boundary")
	}

	loaded.Admin.AllowedOrigins = []string{"https://admin.example"}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("administrator signing key was allowed to reuse a site management key")
	}
}

func TestLegacyPlaintextAdminConfigurationIsRejected(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	data := "admin:\n  username: admin\n  password: plaintext\n  email: admin@example.com\n"
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	if err := LoadConfigFile(path); err == nil {
		t.Fatal("legacy plaintext administrator fields were accepted")
	}
}
