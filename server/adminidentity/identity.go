package adminidentity

import (
	"crypto/rand"
	"ecoku-server/config"
	"ecoku-server/instancekeys"
	"ecoku-server/model"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	minimumPasswordRunes = 12
	maximumPasswordBytes = 72
)

// Initialize loads the legacy environment credentials when present, or
// creates the first persistent administrator on a new database.
func Initialize() error {
	legacy, legacyAvailable := config.GetAdminCredentials()
	legacyNotificationKey := os.Getenv(config.GetNotificationsConfig().EncryptionKeyEnv)
	legacyTokenKey := ""
	if legacyAvailable {
		legacyTokenKey = legacy.TokenKey
	}
	keys, err := instancekeys.Initialize(config.GetInstanceSecretsPath(), legacyTokenKey, legacyNotificationKey)
	if err != nil {
		return err
	}

	account, err := model.GetAdminAccount()
	if err != nil {
		return err
	}
	if account == nil {
		if legacyAvailable {
			account = &model.AdminAccount{
				ID:                   1,
				Username:             legacy.Username,
				PasswordHash:         legacy.PasswordHash,
				ManagedByEnvironment: true,
				Revision:             1,
				CreatedAt:            time.Now().UTC(),
				UpdatedAt:            time.Now().UTC(),
			}
			if err := model.CreateAdminAccount(*account); err != nil {
				return fmt.Errorf("导入旧管理员账户: %w", err)
			}
		} else {
			password, passwordHash, err := newTemporaryPassword()
			if err != nil {
				return err
			}
			now := time.Now().UTC()
			account = &model.AdminAccount{ID: 1, Username: "admin", PasswordHash: passwordHash, MustChangePassword: true, Revision: 1, CreatedAt: now, UpdatedAt: now}
			if err := model.CreateAdminAccount(*account); err != nil {
				return fmt.Errorf("创建初始管理员账户: %w", err)
			}
			log.Printf("Ecoku 首次启动管理员账户：admin；临时密码：%s；请登录后台后立即修改密码", password)
		}
	} else if account.ManagedByEnvironment && legacyAvailable {
		if account.Username != legacy.Username || account.PasswordHash != legacy.PasswordHash {
			account.Username = legacy.Username
			account.PasswordHash = legacy.PasswordHash
			if err := model.UpdateAdminAccount(*account); err != nil {
				return err
			}
			account, err = model.GetAdminAccount()
			if err != nil {
				return err
			}
		}
	} else if account.ManagedByEnvironment && !legacyAvailable {
		account.ManagedByEnvironment = false
		if err := model.UpdateAdminAccount(*account); err != nil {
			return err
		}
		account, err = model.GetAdminAccount()
		if err != nil {
			return err
		}
	}

	credentials := &config.AdminCredentials{
		Username:             account.Username,
		PasswordHash:         account.PasswordHash,
		TokenKey:             keys.AdminTokenKey,
		TokenTTL:             8 * time.Hour,
		MustChangePassword:   account.MustChangePassword,
		ManagedByEnvironment: account.ManagedByEnvironment,
	}
	config.SetAdminCredentials(credentials)
	return nil
}

func CompleteInitialSetup(username, password string) error {
	username = strings.TrimSpace(username)
	if username == "" || len([]rune(username)) > 80 {
		return fmt.Errorf("管理员用户名必须为 1 到 80 个字符")
	}
	if len([]rune(password)) < minimumPasswordRunes || len([]byte(password)) > maximumPasswordBytes {
		return fmt.Errorf("管理员密码至少需要 12 个字符，且不能超过 72 个 UTF-8 字节")
	}
	account, err := model.GetAdminAccount()
	if err != nil {
		return err
	}
	if account == nil || !account.MustChangePassword {
		return fmt.Errorf("当前管理员账户不需要首次设置")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("生成管理员密码哈希: %w", err)
	}
	account.Username = username
	account.PasswordHash = string(hash)
	account.MustChangePassword = false
	account.ManagedByEnvironment = false
	if err := model.UpdateAdminAccountAndRevokeSessions(*account); err != nil {
		return err
	}
	return Initialize()
}

func ResetTemporaryPassword() (string, error) {
	account, err := model.GetAdminAccount()
	if err != nil {
		return "", err
	}
	if account == nil {
		return "", fmt.Errorf("管理员账户尚未初始化")
	}
	password, hash, err := newTemporaryPassword()
	if err != nil {
		return "", err
	}
	account.PasswordHash = hash
	account.MustChangePassword = true
	account.ManagedByEnvironment = false
	if err := model.UpdateAdminAccountAndRevokeSessions(*account); err != nil {
		return "", err
	}
	if err := Initialize(); err != nil {
		return "", err
	}
	return password, nil
}

func newTemporaryPassword() (string, string, error) {
	data := make([]byte, 24)
	if _, err := rand.Read(data); err != nil {
		return "", "", fmt.Errorf("生成管理员临时密码: %w", err)
	}
	password := base64.RawURLEncoding.EncodeToString(data)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", "", fmt.Errorf("生成管理员临时密码哈希: %w", err)
	}
	return password, string(hash), nil
}
