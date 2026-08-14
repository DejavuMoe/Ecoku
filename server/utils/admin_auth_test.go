package utils

import (
	"ecoku-server/config"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestAdminTokenValidityExpiryAndFutureIssuedProtection(t *testing.T) {
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, time.UTC)
	credentials := testAdminCredentials()
	token, expiresAt, err := generateAdminTokenAt(credentials, now)
	if err != nil {
		t.Fatalf("generate administrator token: %v", err)
	}
	if expiresAt != now.Add(credentials.TokenTTL) {
		t.Fatalf("administrator token expiry = %s", expiresAt)
	}
	claims, err := parseAdminTokenAt(token, credentials, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("parse valid administrator token: %v", err)
	}
	if claims.Username != credentials.Username || !claims.ExpiresAt.Equal(expiresAt) {
		t.Fatalf("administrator claims = %#v", claims)
	}
	if _, err := parseAdminTokenAt(token, credentials, expiresAt); err == nil {
		t.Fatal("expired administrator token was accepted")
	}

	futureToken, _, err := generateAdminTokenAt(credentials, now.Add(6*time.Minute))
	if err != nil {
		t.Fatalf("generate future token fixture: %v", err)
	}
	if _, err := parseAdminTokenAt(futureToken, credentials, now); err == nil {
		t.Fatal("administrator token issued too far in the future was accepted")
	}
}

func TestAdminTokenCredentialRotationInvalidatesExistingTokens(t *testing.T) {
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, time.UTC)
	credentials := testAdminCredentials()
	token, _, err := generateAdminTokenAt(credentials, now)
	if err != nil {
		t.Fatalf("generate administrator token: %v", err)
	}

	rotatedPassword := *credentials
	rotatedPassword.PasswordHash = "$2a$10$rotated-password-hash-for-test"
	if _, err := parseAdminTokenAt(token, &rotatedPassword, now.Add(time.Minute)); err == nil {
		t.Fatal("password-hash rotation did not invalidate administrator token")
	}
	rotatedUsername := *credentials
	rotatedUsername.Username = "rotated-admin"
	if _, err := parseAdminTokenAt(token, &rotatedUsername, now.Add(time.Minute)); err == nil {
		t.Fatal("username rotation did not invalidate administrator token")
	}
	rotatedKey := *credentials
	rotatedKey.TokenKey = strings.Repeat("r", 32)
	if _, err := parseAdminTokenAt(token, &rotatedKey, now.Add(time.Minute)); err == nil {
		t.Fatal("signing-key rotation did not invalidate administrator token")
	}
}

func TestAdminTokenRejectsTamperingMalformedPayloadAndLegacyUserToken(t *testing.T) {
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, time.UTC)
	credentials := testAdminCredentials()
	token, _, err := generateAdminTokenAt(credentials, now)
	if err != nil {
		t.Fatalf("generate administrator token: %v", err)
	}
	parts := strings.Split(token, ".")
	parts[1] = base64.RawURLEncoding.EncodeToString([]byte("tampered-signature"))
	if _, err := parseAdminTokenAt(strings.Join(parts, "."), credentials, now); err == nil {
		t.Fatal("tampered administrator token was accepted")
	}

	legacyOrdinaryUserToken := base64.RawURLEncoding.EncodeToString([]byte("42:4102444800:credential:signature"))
	for name, candidate := range map[string]string{
		"empty":        "",
		"single part":  "payload-only",
		"legacy token": legacyOrdinaryUserToken,
		"oversized":    strings.Repeat("x", maximumAdminTokenLength+1),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := parseAdminTokenAt(candidate, credentials, now); err == nil {
				t.Fatalf("%s administrator token was accepted", name)
			}
		})
	}

	payload := adminTokenPayload{
		Version:           1,
		Subject:           credentials.Username,
		Audience:          "wrong-audience",
		IssuedAt:          now.Unix(),
		ExpiresAt:         now.Add(time.Hour).Unix(),
		CredentialVersion: adminCredentialVersion(credentials),
	}
	payloadJSON, _ := json.Marshal(payload)
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	wrongAudienceToken := encodedPayload + "." + base64.RawURLEncoding.EncodeToString(signAdminToken(encodedPayload, credentials.TokenKey))
	if _, err := parseAdminTokenAt(wrongAudienceToken, credentials, now); err == nil {
		t.Fatal("administrator token with wrong audience was accepted")
	}
}

func TestAdminTokenRequiresCredentialsAndConstantTimeComparisonsMatchValues(t *testing.T) {
	if _, _, err := generateAdminTokenAt(nil, time.Now()); err == nil {
		t.Fatal("administrator token was generated without credentials")
	}
	if _, err := parseAdminTokenAt("token", nil, time.Now()); err == nil {
		t.Fatal("administrator token was parsed without credentials")
	}
	if !ConstantTimeStringEqual("admin", "admin") || ConstantTimeStringEqual("admin", "other") {
		t.Fatal("identity comparison returned an incorrect result")
	}
	if !ConstantTimeSecretEqual("secret", "secret") || ConstantTimeSecretEqual("secret", "different") {
		t.Fatal("secret comparison returned an incorrect result")
	}
}

func testAdminCredentials() *config.AdminCredentials {
	return &config.AdminCredentials{
		Username:     "instance-admin",
		PasswordHash: "$2a$10$test-password-hash-placeholder",
		TokenKey:     strings.Repeat("t", 32),
		TokenTTL:     8 * time.Hour,
	}
}
