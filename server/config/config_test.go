package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// setAdminEnvironment provides valid administrator secrets and returns the
// password hash.
func setAdminEnvironment(t *testing.T, tokenKey string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	t.Setenv(adminUsernameEnv, "instance-admin")
	t.Setenv(adminPasswordHashEnv, string(hash))
	t.Setenv(adminTokenKeyEnv, tokenKey)
	return string(hash)
}

func writeConfig(t *testing.T, data string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	return path
}

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
	comment := loaded.Sites[0].Comment
	if !*comment.EmailRequired || *comment.WebsiteRequired || comment.Placeholder != DefaultCommentPlaceholder ||
		comment.DefaultSort != DefaultCommentSort || comment.LengthLimit != DefaultCommentLimit || comment.EmptyMessage != DefaultEmptyMessage {
		t.Fatalf("default comment configuration = %#v", comment)
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
	comment := loaded.Sites[0].Comment
	if *comment.EmailRequired || !*comment.WebsiteRequired || comment.Placeholder != "分享你的想法" ||
		comment.DefaultSort != "oldest" || comment.LengthLimit != 321 || comment.EmptyMessage != "暂时没有评论" {
		t.Fatalf("resolved comment configuration = %#v", comment)
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
	if err := LoadConfigFile(writeConfig(t, "unknown_field: true\n")); err == nil {
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
			if err := LoadConfigFile(writeConfig(t, data)); err == nil {
				t.Fatalf("removed %s configuration was accepted", name)
			}
		})
	}
}

func TestCommandsLoadConfigWithoutAdminCredentials(t *testing.T) {
	t.Setenv(adminUsernameEnv, "")
	t.Setenv(adminPasswordHashEnv, "")
	t.Setenv(adminTokenKeyEnv, "")
	if err := ApplyConfig(&Config{Admin: AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatalf("CLI commands must load a config without admin credentials: %v", err)
	}
	if _, ok := GetAdminCredentials(); ok {
		t.Fatal("missing administrator credentials were available")
	}
	if err := ValidateAdmin(); err == nil || !strings.Contains(err.Error(), adminUsernameEnv) {
		t.Fatalf("server startup accepted missing admin credentials: %v", err)
	}
}

func TestAdminConsoleNeedsAnOrigin(t *testing.T) {
	setAdminEnvironment(t, strings.Repeat("t", 32))
	if err := ApplyConfig(&Config{}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateAdmin(); err == nil || !strings.Contains(err.Error(), "instance_public_url") {
		t.Fatalf("admin console started without an origin: %v", err)
	}
}

func TestAdminCredentialsComeFromEnvironment(t *testing.T) {
	passwordHash := setAdminEnvironment(t, strings.Repeat("t", 32))
	t.Setenv("ECOKU_ADMIN_VALID_SITE_KEY", strings.Repeat("s", 32))
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://site.example"},
			ManagementKeyEnv: "ECOKU_ADMIN_VALID_SITE_KEY",
		}},
		Admin: AdminConfig{AllowedOrigins: []string{"HTTPS://ADMIN.EXAMPLE/"}},
	}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	if err := ValidateAdmin(); err != nil {
		t.Fatalf("validate admin: %v", err)
	}
	credentials, ok := GetAdminCredentials()
	if !ok {
		t.Fatal("administrator credentials unavailable")
	}
	if credentials.Username != "instance-admin" || credentials.PasswordHash != passwordHash || credentials.TokenKey != strings.Repeat("t", 32) {
		t.Fatal("administrator credentials were not loaded from their environment variables")
	}
	if credentials.TokenTTL != 8*time.Hour {
		t.Fatalf("administrator token TTL = %s", credentials.TokenTTL)
	}
	if got := GetAdminAllowedOrigins(); len(got) != 1 || got[0] != "https://admin.example" {
		t.Fatalf("administrator origins = %#v", got)
	}
}

func TestAdminOriginAndSigningKeyMustBeIndependent(t *testing.T) {
	sharedKey := strings.Repeat("x", 32)
	setAdminEnvironment(t, sharedKey)
	t.Setenv("ECOKU_ADMIN_INDEPENDENCE_SITE_KEY", sharedKey)
	loaded := &Config{
		Sites: []RegisteredSiteConfig{{
			ID:               "site-a",
			AllowedOrigins:   []string{"https://shared.example"},
			ManagementKeyEnv: "ECOKU_ADMIN_INDEPENDENCE_SITE_KEY",
		}},
		Admin: AdminConfig{AllowedOrigins: []string{"https://shared.example"}},
	}
	if err := ApplyConfig(loaded); err == nil {
		t.Fatal("administrator origin was allowed to reuse a public-site origin")
	}

	loaded.Admin.AllowedOrigins = []string{"https://admin.example"}
	if err := ApplyConfig(loaded); err != nil {
		t.Fatal(err)
	}
	if err := ValidateAdmin(); err == nil {
		t.Fatal("administrator signing key was allowed to reuse a site management key")
	}
}

func TestLegacyPlaintextAdminConfigurationIsRejected(t *testing.T) {
	data := "admin:\n  username: admin\n  password: plaintext\n  email: admin@example.com\n"
	if err := LoadConfigFile(writeConfig(t, data)); err == nil {
		t.Fatal("legacy plaintext administrator fields were accepted")
	}
}

func TestContainerRuntimeFillsImagePathsAndDerivesAdminOrigin(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "container")
	setAdminEnvironment(t, strings.Repeat("k", 32))
	if err := LoadConfigFile(writeConfig(t, "notifications:\n  instance_public_url: \"https://Ecoku.Example.com/\"\n")); err != nil {
		t.Fatalf("minimal container config rejected: %v", err)
	}
	if err := ValidateAdmin(); err != nil {
		t.Fatalf("minimal container config cannot serve the admin console: %v", err)
	}
	if GetAdminStaticDir() != "/app/admin" || GetClientStaticDir() != "/app/client" {
		t.Fatalf("adminDir=%q clientDir=%q", GetAdminStaticDir(), GetClientStaticDir())
	}
	if LogFilePath != "/var/log/ecoku/ecoku.log" || GetSQLiteConfig().Path != "/data/ecoku.sqlite3" || Port != "12123" {
		t.Fatalf("log=%q db=%q port=%q", LogFilePath, GetSQLiteConfig().Path, Port)
	}
	if got := GetAdminAllowedOrigins(); len(got) != 1 || got[0] != "https://ecoku.example.com" {
		t.Fatalf("admin origins=%v", got)
	}

	// Explicit values still win.
	if err := LoadConfigFile(writeConfig(t, "site:\n  log_path: \"stdout\"\ndatabase:\n  sqlite:\n    path: \"/data/custom.sqlite3\"\n")); err != nil {
		t.Fatal(err)
	}
	if LogFilePath != "stdout" || GetSQLiteConfig().Path != "/data/custom.sqlite3" {
		t.Fatalf("explicit values overridden: log=%q db=%q", LogFilePath, GetSQLiteConfig().Path)
	}
}

func TestSourceRuntimeServesNoStaticFilesByDefault(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "")
	if err := LoadConfigFile(writeConfig(t, "notifications:\n  instance_public_url: \"https://ecoku.example.com\"\n")); err != nil {
		t.Fatal(err)
	}
	if GetAdminStaticDir() != "" || GetClientStaticDir() != "" || LogFilePath != "" || GetSQLiteConfig().Path != "./data/ecoku.bin" {
		t.Fatalf("source defaults changed: admin=%q client=%q log=%q db=%q", GetAdminStaticDir(), GetClientStaticDir(), LogFilePath, GetSQLiteConfig().Path)
	}
}

func TestDeploymentTemplateLoadsInContainerRuntime(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "container")
	setAdminEnvironment(t, strings.Repeat("k", 32))
	if err := LoadConfigFile("../../deploy/config.yaml.example"); err != nil {
		t.Fatalf("deploy template rejected: %v", err)
	}
	if err := ValidateAdmin(); err != nil {
		t.Fatalf("deploy template cannot serve the admin console: %v", err)
	}
}

func TestRetiredKeysAcceptOnlyTheirFixedValues(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "container")
	setAdminEnvironment(t, strings.Repeat("k", 32))
	template, err := os.ReadFile("testdata/v0.2.7-deploy.yaml")
	if err != nil {
		t.Fatal(err)
	}
	legacy := string(template)
	if err := LoadConfigFile(writeConfig(t, legacy)); err != nil {
		t.Fatalf("v0.2.7 deployment template rejected: %v", err)
	}
	if err := ValidateAdmin(); err != nil {
		t.Fatalf("v0.2.7 deployment template cannot serve the admin console: %v", err)
	}

	for key, change := range map[string][2]string{
		"admin.enabled":                    {"enabled: true", "enabled: false"},
		"admin.token_ttl_minutes":          {"token_ttl_minutes: 480", "token_ttl_minutes: 60"},
		"admin.username_env":               {`username_env: "ECOKU_ADMIN_USERNAME"`, `username_env: "CUSTOM_ADMIN_USERNAME"`},
		"admin.password_hash_env":          {`password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"`, `password_hash_env: "CUSTOM_ADMIN_HASH"`},
		"admin.token_key_env":              {`token_key_env: "ECOKU_ADMIN_TOKEN_KEY"`, `token_key_env: "CUSTOM_ADMIN_TOKEN_KEY"`},
		"notifications.encryption_key_env": {`encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"`, `encryption_key_env: "CUSTOM_KEY"`},
	} {
		t.Run(key, func(t *testing.T) {
			if !strings.Contains(legacy, change[0]) {
				t.Fatalf("fixture has no %q", change[0])
			}
			err := LoadConfigFile(writeConfig(t, strings.Replace(legacy, change[0], change[1], 1)))
			if err == nil || !strings.Contains(err.Error(), key) {
				t.Fatalf("changed %s error = %v", key, err)
			}
		})
	}
}
