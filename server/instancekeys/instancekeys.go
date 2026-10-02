// Package instancekeys stores the two process secrets that used to be
// supplied only through environment variables.
package instancekeys

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const fileVersion = 1

type Keys struct {
	AdminTokenKey          string
	NotificationEncryption []byte
}

type file struct {
	Version                   int    `json:"version"`
	AdminTokenKey             string `json:"admin_token_key"`
	NotificationEncryptionKey string `json:"notification_encryption_key"`
}

var active Keys

func Initialize(path, legacyAdminTokenKey, legacyNotificationKey string) (Keys, error) {
	legacyAdminTokenKey = strings.TrimSpace(legacyAdminTokenKey)
	legacyNotificationKey = strings.TrimSpace(legacyNotificationKey)
	var stored file

	data, err := os.ReadFile(path)
	switch {
	case err == nil:
		if err := json.Unmarshal(data, &stored); err != nil {
			return Keys{}, fmt.Errorf("解析持久密钥文件: %w", err)
		}
		if stored.Version != fileVersion {
			return Keys{}, fmt.Errorf("持久密钥文件版本 %d 不受支持", stored.Version)
		}
	case errors.Is(err, os.ErrNotExist):
		stored.Version = fileVersion
		stored.AdminTokenKey = legacyAdminTokenKey
		stored.NotificationEncryptionKey = legacyNotificationKey
		if stored.AdminTokenKey == "" {
			stored.AdminTokenKey, err = randomTextKey()
			if err != nil {
				return Keys{}, err
			}
		}
		if stored.NotificationEncryptionKey == "" {
			stored.NotificationEncryptionKey, err = randomNotificationKey()
			if err != nil {
				return Keys{}, err
			}
		}
		if err := writeFile(path, stored); err != nil {
			return Keys{}, err
		}
	default:
		return Keys{}, fmt.Errorf("读取持久密钥文件: %w", err)
	}

	if legacyAdminTokenKey != "" && legacyAdminTokenKey != stored.AdminTokenKey {
		stored.AdminTokenKey = legacyAdminTokenKey
		if err := writeFile(path, stored); err != nil {
			return Keys{}, fmt.Errorf("更新管理员签名密钥: %w", err)
		}
	}
	if legacyNotificationKey != "" && legacyNotificationKey != stored.NotificationEncryptionKey {
		return Keys{}, fmt.Errorf("持久通知加密主密钥与旧环境变量不一致；为避免无法解密已有凭据，已拒绝启动")
	}

	notificationKey, err := decodeNotificationKey(stored.NotificationEncryptionKey)
	if err != nil {
		return Keys{}, err
	}
	if len(stored.AdminTokenKey) < 32 {
		return Keys{}, fmt.Errorf("持久管理员签名密钥至少需要 32 个字符")
	}
	active = Keys{AdminTokenKey: stored.AdminTokenKey, NotificationEncryption: notificationKey}
	return active, nil
}

func Current() (Keys, error) {
	if active.AdminTokenKey == "" || len(active.NotificationEncryption) != 32 {
		return Keys{}, fmt.Errorf("持久密钥尚未初始化")
	}
	return Keys{AdminTokenKey: active.AdminTokenKey, NotificationEncryption: append([]byte(nil), active.NotificationEncryption...)}, nil
}

func ResetForTests() { active = Keys{} }

func randomTextKey() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("生成管理员签名密钥: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func randomNotificationKey() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("生成通知加密主密钥: %w", err)
	}
	return base64.RawStdEncoding.EncodeToString(data), nil
}

func decodeNotificationKey(raw string) ([]byte, error) {
	for _, encoding := range []*base64.Encoding{base64.RawStdEncoding, base64.StdEncoding} {
		if decoded, err := encoding.DecodeString(strings.TrimSpace(raw)); err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}
	return nil, fmt.Errorf("持久通知加密主密钥必须是 Base64 编码的 32 字节密钥")
}

func writeFile(path string, value file) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	temporary, err := os.CreateTemp(filepath.Dir(path), ".ecoku-secrets-*")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryName, path); err != nil {
		// Windows cannot replace an existing file with Rename. This fallback is
		// only used when rotating the admin signing key on the dev host.
		if removeErr := os.Remove(path); removeErr != nil {
			return err
		}
		if retryErr := os.Rename(temporaryName, path); retryErr != nil {
			return retryErr
		}
	}
	return nil
}
