package turnstile

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecoku-server/config"
	"ecoku-server/model"
)

func setupTurnstileTest(t *testing.T) {
	t.Helper()
	key := base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	t.Setenv("ECOKU_TURNSTILE_TEST_KEY", key)
	t.Setenv("ECOKU_TURNSTILE_SITE_KEY", strings.Repeat("s", 32))
	if err := config.ApplyConfig(&config.Config{
		Sites: []config.RegisteredSiteConfig{{
			ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"},
			ManagementKeyEnv: "ECOKU_TURNSTILE_SITE_KEY",
		}},
		Notifications: config.NotificationsConfig{EncryptionKeyEnv: "ECOKU_TURNSTILE_TEST_KEY"},
	}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/turnstile.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previous := model.DB
	model.DB = database
	t.Cleanup(func() { model.DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
}

func TestPublicSitekeyEmptyWhenDisabled(t *testing.T) {
	setupTurnstileTest(t)
	sitekey, err := PublicSitekey()
	if err != nil {
		t.Fatal(err)
	}
	if sitekey != "" {
		t.Fatalf("disabled sitekey=%q", sitekey)
	}
}

func TestSaveEncryptsSecretAndOmitsPlaintext(t *testing.T) {
	setupTurnstileTest(t)
	saved, err := Save(Settings{Enabled: true, Sitekey: "sitekey-public", Secret: "secret-private", Revision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !saved.Enabled || saved.Sitekey != "sitekey-public" || saved.Secret != "" || !saved.SecretSet || saved.Revision != 2 {
		t.Fatalf("saved=%#v", saved)
	}
	public, err := PublicSitekey()
	if err != nil || public != "sitekey-public" {
		t.Fatalf("public=%q err=%v", public, err)
	}
	if err := ValidateStoredSecret(); err != nil {
		t.Fatal(err)
	}
}

func TestSaveRequiresSecretWhenEnabling(t *testing.T) {
	setupTurnstileTest(t)
	if _, err := Save(Settings{Enabled: true, Sitekey: "sitekey-public", Revision: 1}); err == nil {
		t.Fatal("enabled without secret")
	}
}

func TestVerifyDisabledAllowsEmptyToken(t *testing.T) {
	setupTurnstileTest(t)
	if err := Verify(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyFailClosedWithoutRemoteIP(t *testing.T) {
	setupTurnstileTest(t)
	if _, err := Save(Settings{Enabled: true, Sitekey: "sitekey-public", Secret: "secret-private", Revision: 1}); err != nil {
		t.Fatal(err)
	}
	var posted string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		posted = r.PostForm.Encode()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": r.FormValue("response") == "good-token"})
	}))
	t.Cleanup(server.Close)
	previousURL, previousClient := siteverifyURL, httpClient
	siteverifyURL = server.URL
	httpClient = server.Client()
	t.Cleanup(func() { siteverifyURL = previousURL; httpClient = previousClient })

	if err := Verify(context.Background(), ""); err != ErrFailed {
		t.Fatalf("empty token err=%v", err)
	}
	if err := Verify(context.Background(), "bad-token"); err != ErrFailed {
		t.Fatalf("invalid token err=%v", err)
	}
	if err := Verify(context.Background(), "good-token"); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(posted, "remoteip") {
		t.Fatalf("siteverify posted remoteip: %s", posted)
	}
}
