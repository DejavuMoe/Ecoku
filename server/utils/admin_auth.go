package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"strings"
	"time"
)

const (
	adminTokenAudience      = "ecoku-admin-v1"
	maximumAdminTokenLength = 8192
)

var ErrAdminSessionUnavailable = errors.New("管理员会话存储不可用")

type adminTokenPayload struct {
	SessionID         string `json:"sid"`
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
	now := time.Now()
	token, expiry, err := generateAdminTokenAt(credentials, now)
	if err != nil {
		return "", time.Time{}, err
	}
	if model.DB == nil {
		return "", time.Time{}, ErrAdminSessionUnavailable
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM admin_sessions WHERE expires_at <= ?", now.Unix()).Error; err != nil {
			return err
		}
		return tx.Exec("INSERT INTO admin_sessions (token_digest, expires_at) VALUES (?, ?)", adminTokenDigest(token), expiry.Unix()).Error
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("保存管理员会话失败")
	}
	return token, expiry, nil
}

func generateAdminTokenAt(credentials *config.AdminCredentials, now time.Time) (string, time.Time, error) {
	if credentials == nil || credentials.Username == "" || credentials.PasswordHash == "" || credentials.TokenKey == "" || credentials.TokenTTL <= 0 {
		return "", time.Time{}, fmt.Errorf("管理员认证未安全配置")
	}

	issuedAt := time.Unix(now.Unix(), 0).UTC()
	expiresAt := issuedAt.Add(credentials.TokenTTL)
	sessionID := make([]byte, 32)
	if _, err := rand.Read(sessionID); err != nil {
		return "", time.Time{}, fmt.Errorf("生成管理员会话失败")
	}
	payload := adminTokenPayload{
		SessionID:         base64.RawURLEncoding.EncodeToString(sessionID),
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
	now := time.Now()
	claims, err := parseAdminTokenAt(token, credentials, now)
	if err != nil {
		return nil, err
	}
	if model.DB == nil {
		return nil, ErrAdminSessionUnavailable
	}
	var count int64
	if err := model.DB.Table("admin_sessions").Where("token_digest = ? AND expires_at > ?", adminTokenDigest(token), now.Unix()).Count(&count).Error; err != nil {
		return nil, ErrAdminSessionUnavailable
	}
	if count != 1 {
		return nil, fmt.Errorf("管理员会话已失效")
	}
	return claims, nil
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

func adminTokenDigest(token string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return fmt.Sprintf("%x", digest)
}

func RevokeAdminToken(token string) error {
	if model.DB == nil {
		return ErrAdminSessionUnavailable
	}
	return model.DB.Exec("DELETE FROM admin_sessions WHERE token_digest = ?", adminTokenDigest(token)).Error
}
