package captcha

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecoku-server/config"
	"ecoku-server/model"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func setupCaptchaTest(t *testing.T) {
	t.Helper()
	key := base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	t.Setenv("ECOKU_CAPTCHA_TEST_KEY", key)
	t.Setenv("ECOKU_CAPTCHA_SITE_KEY", strings.Repeat("s", 32))
	if err := config.ApplyConfig(&config.Config{
		Sites: []config.RegisteredSiteConfig{{
			ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"},
			ManagementKeyEnv: "ECOKU_CAPTCHA_SITE_KEY",
		}},
		Notifications: config.NotificationsConfig{EncryptionKeyEnv: "ECOKU_CAPTCHA_TEST_KEY"},
	}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/captcha.sqlite3")
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

func TestDisabledCaptchaPublishesNoChallenge(t *testing.T) {
	setupCaptchaTest(t)
	public, err := PublicConfig()
	if err != nil {
		t.Fatal(err)
	}
	if public.Provider != ProviderOff || public.Sitekey != "" || public.InstanceURL != "" {
		t.Fatalf("public=%#v", public)
	}
	if err := Verify(context.Background(), Tokens{}); err != nil {
		t.Fatal(err)
	}
}

func TestSettingsEncryptBothSecretsAndRetainInactiveProvider(t *testing.T) {
	setupCaptchaTest(t)
	saved, err := Save(Settings{
		Provider: ProviderTurnstile,
		Turnstile: ProviderSettings{Sitekey: "turnstile-public", Secret: "turnstile-private"},
		Cap: CapSettings{InstanceURL: "https://cap.example.com", Sitekey: "cap-public", Secret: "cap-private"},
		Revision: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Provider != ProviderTurnstile || saved.Revision != 2 || !saved.Turnstile.SecretSet || !saved.Cap.SecretSet || saved.Turnstile.Secret != "" || saved.Cap.Secret != "" {
		t.Fatalf("saved=%#v", saved)
	}
	var plaintextCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM captcha_settings
WHERE CAST(secret_cipher AS TEXT) LIKE '%turnstile-private%'
   OR CAST(cap_secret_cipher AS TEXT) LIKE '%cap-private%'`).Scan(&plaintextCount)
	if plaintextCount != 0 {
		t.Fatal("plaintext secret stored")
	}
	if err := ValidateStoredSecrets(); err != nil {
		t.Fatal(err)
	}
	turnstilePublic, err := PublicConfig()
	if err != nil || turnstilePublic.Provider != ProviderTurnstile || turnstilePublic.Sitekey != "turnstile-public" || turnstilePublic.InstanceURL != "" {
		t.Fatalf("Turnstile public=%#v err=%v", turnstilePublic, err)
	}
	if origin, err := ActiveCapOrigin(); err != nil || origin != "" {
		t.Fatalf("inactive Cap origin=%q err=%v", origin, err)
	}

	saved.Provider = ProviderCap
	switched, err := Save(saved)
	if err != nil {
		t.Fatal(err)
	}
	if switched.Provider != ProviderCap || switched.Turnstile.Sitekey != "turnstile-public" || switched.Cap.Sitekey != "cap-public" || !switched.Turnstile.SecretSet || !switched.Cap.SecretSet {
		t.Fatalf("switched=%#v", switched)
	}
	public, err := PublicConfig()
	if err != nil || public.Provider != ProviderCap || public.Sitekey != "cap-public" || public.InstanceURL != "https://cap.example.com" {
		t.Fatalf("public=%#v err=%v", public, err)
	}
	origin, err := ActiveCapOrigin()
	if err != nil || origin != "https://cap.example.com" {
		t.Fatalf("origin=%q err=%v", origin, err)
	}

	switched.Provider = ProviderOff
	disabled, err := Save(switched)
	if err != nil {
		t.Fatal(err)
	}
	if disabled.Provider != ProviderOff || disabled.Cap.InstanceURL != "https://cap.example.com" || !disabled.Cap.SecretSet {
		t.Fatalf("disabled=%#v", disabled)
	}
	if origin, err := ActiveCapOrigin(); err != nil || origin != "" {
		t.Fatalf("disabled Cap origin=%q err=%v", origin, err)
	}

	disabled.Provider = ProviderTurnstile
	turnedBack, err := Save(disabled)
	if err != nil {
		t.Fatal(err)
	}
	if turnedBack.Provider != ProviderTurnstile || turnedBack.Cap.InstanceURL != "https://cap.example.com" || !turnedBack.Cap.SecretSet {
		t.Fatalf("Turnstile restore=%#v", turnedBack)
	}
	if origin, err := ActiveCapOrigin(); err != nil || origin != "" {
		t.Fatalf("Turnstile Cap origin=%q err=%v", origin, err)
	}
}

func TestCapInstanceRejectsNonHTTPSAndPrivateTargets(t *testing.T) {
	setupCaptchaTest(t)
	for _, instance := range []string{
		"http://cap.example.com",
		"https://localhost",
		"https://127.0.0.1",
		"https://10.0.0.2",
		"https://169.254.169.254/latest/meta-data",
		"https://user:pass@cap.example.com",
		"https://cap.example.com?secret=x",
	} {
		_, err := Save(Settings{
			Provider: ProviderCap,
			Cap: CapSettings{InstanceURL: instance, Sitekey: "cap-public", Secret: "cap-private"},
			Revision: 1,
		})
		if !errors.Is(err, ErrValidation) {
			t.Fatalf("instance %q err=%v", instance, err)
		}
	}
}

func TestCapSitekeyRejectsPathDelimiters(t *testing.T) {
	setupCaptchaTest(t)
	_, err := Save(Settings{
		Provider: ProviderCap,
		Cap: CapSettings{InstanceURL: "https://cap.example.com", Sitekey: "site/key", Secret: "cap-private"},
		Revision: 1,
	})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("path-like Cap Site key err=%v", err)
	}
}

func TestTurnstileVerificationAcceptsGenericAndLegacyTokensWithoutRemoteIP(t *testing.T) {
	setupCaptchaTest(t)
	if _, err := Save(Settings{
		Provider: ProviderTurnstile,
		Turnstile: ProviderSettings{Sitekey: "public-sitekey", Secret: "secret-private"},
		Revision: 1,
	}); err != nil {
		t.Fatal(err)
	}
	var posted string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		posted = r.PostForm.Encode()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": r.FormValue("response") == "good-token"})
	}))
	t.Cleanup(server.Close)
	restore := ConfigureTurnstileSiteverify(server.URL, server.Client())
	t.Cleanup(restore)

	if err := Verify(context.Background(), Tokens{Captcha: "bad-token"}); !errors.Is(err, ErrFailed) {
		t.Fatalf("invalid token err=%v", err)
	}
	if err := Verify(context.Background(), Tokens{Captcha: "good-token"}); err != nil {
		t.Fatal(err)
	}
	if err := Verify(context.Background(), Tokens{Turnstile: "good-token"}); err != nil {
		t.Fatal(err)
	}
	if err := Verify(context.Background(), Tokens{Captcha: "good-token", Turnstile: "different"}); !errors.Is(err, ErrFailed) {
		t.Fatalf("conflicting tokens err=%v", err)
	}
	if strings.Contains(posted, "remoteip") {
		t.Fatalf("siteverify posted remoteip: %s", posted)
	}
}

func TestTurnstileVerificationRejectsRedirects(t *testing.T) {
	for _, status := range []int{200, 301, 302, 303, 307, 308} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			calls := 0
			client := *turnstileClient
			client.Transport = roundTripFunc(func(request *http.Request) (*http.Response, error) {
				calls++
				code := status
				if calls > 1 {
					code = http.StatusOK
				}
				return &http.Response{
					StatusCode: code, Header: http.Header{"Location": {"https://redirect.example/siteverify"}},
					Body: io.NopCloser(strings.NewReader(`{"success":true}`)), Request: request,
				}, nil
			})
			t.Cleanup(ConfigureTurnstileSiteverify("", &client))
			err := verifyTurnstile(context.Background(), "test-token", "test-secret")
			if calls != 1 || (status == http.StatusOK && err != nil) || (status != http.StatusOK && !errors.Is(err, ErrUnavailable)) {
				t.Fatalf("status=%d calls=%d err=%v", status, calls, err)
			}
		})
	}
}

func TestCapVerificationUsesJSONAndRejectsLegacyToken(t *testing.T) {
	setupCaptchaTest(t)
	if _, err := Save(Settings{
		Provider: ProviderCap,
		Cap: CapSettings{InstanceURL: "https://cap.example.com", Sitekey: "public-cap", Secret: "private-cap"},
		Revision: 1,
	}); err != nil {
		t.Fatal(err)
	}
	var capturedURL, capturedType string
	var capturedBody map[string]string
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		capturedURL = request.URL.String()
		capturedType = request.Header.Get("Content-Type")
		body, _ := io.ReadAll(request.Body)
		_ = json.Unmarshal(body, &capturedBody)
		success := capturedBody["response"] == "good-token" && capturedBody["secret"] == "private-cap"
		payload, _ := json.Marshal(map[string]bool{"success": success})
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(payload))), Header: make(http.Header)}, nil
	})}
	restore := ConfigureCapSiteverify(client)
	t.Cleanup(restore)

	if err := Verify(context.Background(), Tokens{Captcha: "good-token"}); err != nil {
		t.Fatal(err)
	}
	if capturedURL != "https://cap.example.com/public-cap/siteverify" || capturedType != "application/json" {
		t.Fatalf("url=%q content-type=%q", capturedURL, capturedType)
	}
	if err := Verify(context.Background(), Tokens{Turnstile: "good-token"}); !errors.Is(err, ErrFailed) {
		t.Fatalf("legacy token accepted by Cap: %v", err)
	}
	if err := Verify(context.Background(), Tokens{Captcha: "bad-token"}); !errors.Is(err, ErrFailed) {
		t.Fatalf("invalid Cap token err=%v", err)
	}
}

func TestDisableIsIdempotentAndPreservesCredentials(t *testing.T) {
	setupCaptchaTest(t)
	if _, err := Save(Settings{
		Provider: ProviderCap,
		Turnstile: ProviderSettings{Sitekey: "turnstile-public", Secret: "turnstile-private"},
		Cap: CapSettings{InstanceURL: "https://cap.example.com", Sitekey: "cap-public", Secret: "cap-private"},
		Revision: 1,
	}); err != nil {
		t.Fatal(err)
	}
	changed, err := Disable()
	if err != nil || !changed {
		t.Fatalf("disable changed=%t err=%v", changed, err)
	}
	changed, err = Disable()
	if err != nil || changed {
		t.Fatalf("second disable changed=%t err=%v", changed, err)
	}
	settings, err := GetSettings()
	if err != nil {
		t.Fatal(err)
	}
	if settings.Provider != ProviderOff || settings.Turnstile.Sitekey != "turnstile-public" || settings.Cap.Sitekey != "cap-public" || !settings.Turnstile.SecretSet || !settings.Cap.SecretSet {
		t.Fatalf("settings=%#v", settings)
	}
}
