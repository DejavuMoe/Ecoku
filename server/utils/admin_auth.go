package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"ecoku-server/config"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	adminTokenAudience      = "ecoku-admin-v1"
	maximumAdminTokenLength = 8192
)

type adminTokenPayload struct {
	Version           int    `json:"v"`
	Subject           string `json:"sub"`
	Audience          string `json:"aud"`
	IssuedAt          int64  `json:"iat"`
	ExpiresAt         int64  `json:"exp"`
	CredentialVersion string `json:"cv"`
}

type AdminTokenClaims struct {
	Username  string
	IssuedAt  time.Time
	ExpiresAt time.Time
}

// GenerateAdminToken creates an administrator-only bearer token. The token is
// signed with a key that is independent from ordinary user authentication and
// is bound to the current administrator password hash.
func GenerateAdminToken() (string, time.Time, error) {
	credentials, ok := config.GetAdminCredentials()
	if !ok {
		return "", time.Time{}, fmt.Errorf("管理员认证未安全配置")
	}
	return generateAdminTokenAt(credentials, time.Now())
}

func generateAdminTokenAt(credentials *config.AdminCredentials, now time.Time) (string, time.Time, error) {
	if credentials == nil || credentials.Username == "" || credentials.PasswordHash == "" || credentials.TokenKey == "" || credentials.TokenTTL <= 0 {
		return "", time.Time{}, fmt.Errorf("管理员认证未安全配置")
	}

	issuedAt := time.Unix(now.Unix(), 0).UTC()
	expiresAt := issuedAt.Add(credentials.TokenTTL)
	payload := adminTokenPayload{
		Version:           1,
		Subject:           credentials.Username,
		Audience:          adminTokenAudience,
		IssuedAt:          issuedAt.Unix(),
		ExpiresAt:         expiresAt.Unix(),
		CredentialVersion: adminCredentialVersion(credentials),
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("生成管理员令牌失败")
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signature := signAdminToken(encodedPayload, credentials.TokenKey)
	token := encodedPayload + "." + base64.RawURLEncoding.EncodeToString(signature)
	return token, expiresAt, nil
}

func ParseAdminToken(token string) (*AdminTokenClaims, error) {
	credentials, ok := config.GetAdminCredentials()
	if !ok {
		return nil, fmt.Errorf("管理员认证未安全配置")
	}
	return parseAdminTokenAt(token, credentials, time.Now())
}

func parseAdminTokenAt(token string, credentials *config.AdminCredentials, now time.Time) (*AdminTokenClaims, error) {
	token = strings.TrimSpace(token)
	if token == "" || len(token) > maximumAdminTokenLength || credentials == nil || credentials.TokenKey == "" {
		return nil, fmt.Errorf("管理员令牌无效")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, fmt.Errorf("管理员令牌无效")
	}

	providedSignature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("管理员令牌无效")
	}
	expectedSignature := signAdminToken(parts[0], credentials.TokenKey)
	if !hmac.Equal(providedSignature, expectedSignature) {
		return nil, fmt.Errorf("管理员令牌无效")
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("管理员令牌无效")
	}
	var payload adminTokenPayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("管理员令牌无效")
	}
	if payload.Version != 1 || !ConstantTimeStringEqual(payload.Audience, adminTokenAudience) || !ConstantTimeStringEqual(payload.Subject, credentials.Username) {
		return nil, fmt.Errorf("管理员令牌无效")
	}
	if !ConstantTimeStringEqual(payload.CredentialVersion, adminCredentialVersion(credentials)) {
		return nil, fmt.Errorf("管理员令牌已失效")
	}
	issuedAt := time.Unix(payload.IssuedAt, 0)
	expiresAt := time.Unix(payload.ExpiresAt, 0)
	if payload.IssuedAt <= 0 || payload.ExpiresAt <= payload.IssuedAt || issuedAt.After(now.Add(5*time.Minute)) || !now.Before(expiresAt) {
		return nil, fmt.Errorf("管理员令牌已过期或无效")
	}

	return &AdminTokenClaims{
		Username:  payload.Subject,
		IssuedAt:  issuedAt,
		ExpiresAt: expiresAt,
	}, nil
}

func adminCredentialVersion(credentials *config.AdminCredentials) string {
	mac := hmac.New(sha256.New, []byte(credentials.TokenKey))
	_, _ = mac.Write([]byte("admin-credential-v1\x00"))
	_, _ = mac.Write([]byte(credentials.Username))
	_, _ = mac.Write([]byte("\x00"))
	_, _ = mac.Write([]byte(credentials.PasswordHash))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func signAdminToken(encodedPayload, key string) []byte {
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte("admin-token-v1\x00"))
	_, _ = mac.Write([]byte(encodedPayload))
	return mac.Sum(nil)
}

// ConstantTimeStringEqual compares normalized identity strings through fixed
// size digests. ConstantTimeSecretEqual is used for opaque management keys.
func ConstantTimeStringEqual(left, right string) bool {
	leftDigest := sha256.Sum256([]byte(left))
	rightDigest := sha256.Sum256([]byte(right))
	return subtle.ConstantTimeCompare(leftDigest[:], rightDigest[:]) == 1
}

func ConstantTimeSecretEqual(left, right string) bool {
	leftDigest := sha256.Sum256([]byte(left))
	rightDigest := sha256.Sum256([]byte(right))
	return subtle.ConstantTimeCompare(leftDigest[:], rightDigest[:]) == 1
}
