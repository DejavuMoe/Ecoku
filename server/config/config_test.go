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

func TestApplyConfigFillsRateLimitDefaults(t *testing.T) {
	if err := ApplyConfig(&Config{}); err != nil {
		t.Fatalf("apply config: %v", err)
	}
	if limit, window := GetRateLimit("comment_list"); limit != 60 || window != time.Minute {
		t.Fatalf("list rate default=%d/%s", limit, window)
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

func TestTrustedProxyMustBeExactIPOrCIDR(t *testing.T) {
	if err := ApplyConfig(&Config{Site: SiteConfig{TrustedProxies: []string{"*"}}}); err == nil {
		t.Fatal("wildcard trusted proxy was accepted")
	}
}

func TestTrustedProxyRejectsArbitraryNetworks(t *testing.T) {
	for _, network := range []string{"0.0.0.0/0", "::/0"} {
		if err := ApplyConfig(&Config{Site: SiteConfig{TrustedProxies: []string{network}}}); err == nil {
			t.Fatalf("arbitrary trusted proxy %q was accepted", network)
		}
	}
	if err := ApplyConfig(&Config{Site: SiteConfig{TrustedProxies: []string{"172.17.0.1/32"}}}); err != nil {
		t.Fatalf("docker gateway proxy rejected: %v", err)
	}
}

func TestExampleConfigurationLoads(t *testing.T) {
	if err := LoadConfigFile("../config.yaml.example"); err != nil {
		t.Fatalf("load example config: %v", err)
	}
}

func TestConfigFileRejectsUnknownFields(t *testing.T) {
	if err := LoadConfigFile(writeConfig(t, "unknown_field: true\n")); err == nil {
		t.Fatal("unknown YAML field was accepted")
	}
}

func TestRemovedConfigurationIsRejected(t *testing.T) {
	for name, data := range map[string]string{
		"ordinary user auth": "auth:\n  user_enabled: true\n",
		"smtp":               "smtp:\n  enabled: false\n",
		"mysql":              "database:\n  type: mysql\n  mysql:\n    host: localhost\n",
		"drop table":         "site:\n  drop_table: true\n",
		"port":               "site:\n  port: 12123\n",
		"log path":           "site:\n  log_path: \"/var/log/ecoku/ecoku.log\"\n",
		"client static dir":  "client:\n  static_dir: \"/app/client\"\n",
		"admin static dir":   "admin:\n  static_dir: \"/app/admin\"\n",
		"sqlite path":        "database:\n  sqlite:\n    path: \"/data/ecoku.sqlite3\"\n",
		"sites":              "sites:\n  - id: \"blog\"\n    site_url: \"https://blog.example.com\"\n",
		"admin enabled":      "admin:\n  enabled: true\n",
		"admin token ttl":    "admin:\n  token_ttl_minutes: 480\n",
		"admin env name":     "admin:\n  username_env: \"ECOKU_ADMIN_USERNAME\"\n",
		"encryption env":     "notifications:\n  encryption_key_env: \"ECOKU_NOTIFICATION_ENCRYPTION_KEY\"\n",
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
	if err := ApplyConfig(&Config{Admin: AdminConfig{AllowedOrigins: []string{"HTTPS://ADMIN.EXAMPLE/"}}}); err != nil {
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

func TestAdminSigningKeyCannotReusePasswordHash(t *testing.T) {
	passwordHash := setAdminEnvironment(t, strings.Repeat("t", 32))
	t.Setenv(adminTokenKeyEnv, passwordHash)
	if err := ApplyConfig(&Config{Admin: AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateAdmin(); err == nil {
		t.Fatal("administrator signing key was allowed to reuse the password hash")
	}
}

func TestLegacyPlaintextAdminConfigurationIsRejected(t *testing.T) {
	data := "admin:\n  username: admin\n  password: plaintext\n  email: admin@example.com\n"
	if err := LoadConfigFile(writeConfig(t, data)); err == nil {
		t.Fatal("legacy plaintext administrator fields were accepted")
	}
}

func TestContainerRuntimeUsesImagePathsAndDerivesAdminOrigin(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "container")
	setAdminEnvironment(t, strings.Repeat("k", 32))
	if err := LoadConfigFile(writeConfig(t, "notifications:\n  instance_public_url: \"https://Ecoku.Example.com/\"\n")); err != nil {
		t.Fatalf("minimal container config rejected: %v", err)
	}
	if err := ValidateAdmin(); err != nil {
		t.Fatalf("minimal container config cannot serve the admin console: %v", err)
	}
	if GetAdminStaticDir() != "/app/admin" || GetClientStaticDir() != "/app/client" || GetSQLitePath() != "/data/ecoku.sqlite3" {
		t.Fatalf("paths=%#v", GlobalConfig.Paths)
	}
	if got := GetAdminAllowedOrigins(); len(got) != 1 || got[0] != "https://ecoku.example.com" {
		t.Fatalf("admin origins=%v", got)
	}
}

func TestSourceRuntimeServesNoStaticFiles(t *testing.T) {
	t.Setenv("ECOKU_RUNTIME", "")
	if err := LoadConfigFile(writeConfig(t, "notifications:\n  instance_public_url: \"https://ecoku.example.com\"\n")); err != nil {
		t.Fatal(err)
	}
	if GetAdminStaticDir() != "" || GetClientStaticDir() != "" || GetSQLitePath() != "./data/ecoku.bin" {
		t.Fatalf("source paths changed: %#v", GlobalConfig.Paths)
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
