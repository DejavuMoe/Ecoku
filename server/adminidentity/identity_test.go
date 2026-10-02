package adminidentity

import (
	"ecoku-server/config"
	"ecoku-server/instancekeys"
	"ecoku-server/model"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func setupIdentityTest(t *testing.T) string {
	t.Helper()
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatal(err)
	}
	dataDir := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(filepath.Join(dataDir, "ecoku.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previous := model.DB
	model.DB = database
	t.Cleanup(func() {
		model.DB = previous
		_ = model.CloseSQLiteDatabase(database)
		config.SetAdminCredentials(nil)
		instancekeys.ResetForTests()
	})
	config.GlobalConfig.Paths.SQLitePath = filepath.Join(t.TempDir(), "runtime", "ecoku.sqlite3")
	return filepath.Dir(config.GetInstanceSecretsPath())
}

func TestFirstStartupCreatesTemporaryAdminAndSetupCompletes(t *testing.T) {
	secretsDir := setupIdentityTest(t)
	t.Setenv("ECOKU_ADMIN_USERNAME", "")
	t.Setenv("ECOKU_ADMIN_PASSWORD_HASH", "")
	t.Setenv("ECOKU_ADMIN_TOKEN_KEY", "")
	t.Setenv(config.EncryptionKeyEnv, "")
	if err := Initialize(); err != nil {
		t.Fatal(err)
	}
	account, err := model.GetAdminAccount()
	if err != nil || account == nil || account.Username != "admin" || !account.MustChangePassword {
		t.Fatalf("initial account=%#v error=%v", account, err)
	}
	if _, err := os.Stat(filepath.Join(secretsDir, "ecoku-secrets.json")); err != nil {
		t.Fatal(err)
	}
	if err := CompleteInitialSetup("owner", "new-admin-password"); err != nil {
		t.Fatal(err)
	}
	account, err = model.GetAdminAccount()
	if err != nil || account == nil || account.Username != "owner" || account.MustChangePassword || account.ManagedByEnvironment {
		t.Fatalf("completed account=%#v error=%v", account, err)
	}
	credentials, ok := config.GetAdminCredentials()
	if !ok || credentials.Username != "owner" || credentials.MustChangePassword {
		t.Fatalf("runtime credentials=%#v available=%v", credentials, ok)
	}
}

func TestLegacyEnvironmentCredentialsAreImportedWithoutForcedSetup(t *testing.T) {
	setupIdentityTest(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("legacy-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ECOKU_ADMIN_USERNAME", "legacy-admin")
	t.Setenv("ECOKU_ADMIN_PASSWORD_HASH", string(hash))
	t.Setenv("ECOKU_ADMIN_TOKEN_KEY", strings.Repeat("k", 32))
	t.Setenv(config.EncryptionKeyEnv, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	if err := Initialize(); err != nil {
		t.Fatal(err)
	}
	account, err := model.GetAdminAccount()
	if err != nil || account == nil || account.Username != "legacy-admin" || account.MustChangePassword || !account.ManagedByEnvironment {
		t.Fatalf("legacy account=%#v error=%v", account, err)
	}
}

func TestInitialSetupRollsBackWhenSessionRevocationFails(t *testing.T) {
	setupIdentityTest(t)
	t.Setenv("ECOKU_ADMIN_USERNAME", "")
	t.Setenv("ECOKU_ADMIN_PASSWORD_HASH", "")
	t.Setenv("ECOKU_ADMIN_TOKEN_KEY", "")
	t.Setenv(config.EncryptionKeyEnv, "")
	if err := Initialize(); err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Exec("INSERT INTO admin_sessions (token_digest, expires_at) VALUES (?, ?)", strings.Repeat("a", 64), time.Now().Add(time.Hour).Unix()).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Exec(`CREATE TRIGGER fail_admin_session_revoke BEFORE DELETE ON admin_sessions BEGIN SELECT RAISE(ABORT, 'fixture'); END`).Error; err != nil {
		t.Fatal(err)
	}
	if err := CompleteInitialSetup("owner", "new-password-for-admin"); err == nil {
		t.Fatal("setup succeeded despite session revocation failure")
	}
	if err := model.DB.Exec(`DROP TRIGGER fail_admin_session_revoke`).Error; err != nil {
		t.Fatal(err)
	}
	account, err := model.GetAdminAccount()
	if err != nil || account == nil || account.Username != "admin" || !account.MustChangePassword {
		t.Fatalf("setup transaction partially committed: %#v error=%v", account, err)
	}
}
