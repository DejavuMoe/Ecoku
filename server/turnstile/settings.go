package turnstile

import (
	"ecoku-server/model"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

const maxSitekeyLength = 255

var (
	ErrValidation = errors.New("turnstile settings validation failed")
	ErrConflict   = errors.New("turnstile settings changed concurrently")
)

type Settings struct {
	Enabled   bool   `json:"enabled"`
	Sitekey   string `json:"sitekey"`
	Secret    string `json:"secret,omitempty"`
	SecretSet bool   `json:"secret_set"`
	Revision  uint   `json:"revision"`
}

type settingRow struct {
	ID           uint      `gorm:"column:id"`
	Enabled      bool      `gorm:"column:enabled"`
	Sitekey      string    `gorm:"column:sitekey"`
	SecretCipher []byte    `gorm:"column:secret_cipher"`
	Revision     uint      `gorm:"column:revision"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func GetSettings() (Settings, error) {
	row, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	return fromRow(row), nil
}

func PublicSitekey() (string, error) {
	row, err := loadSetting()
	if err != nil {
		return "", err
	}
	if !row.Enabled {
		return "", nil
	}
	return row.Sitekey, nil
}

func Save(input Settings) (Settings, error) {
	current, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	input.Sitekey = strings.TrimSpace(input.Sitekey)
	input.Secret = strings.TrimSpace(input.Secret)
	if input.Revision == 0 {
		input.Revision = current.Revision
	}
	hasSecret := len(current.SecretCipher) > 0 || input.Secret != ""
	if err := validate(input, hasSecret); err != nil {
		return Settings{}, err
	}
	secret := current.SecretCipher
	if input.Secret != "" {
		secret, err = encryptSecret(input.Secret)
		if err != nil {
			return Settings{}, err
		}
	}
	if err := updateSetting(input.Enabled, input.Sitekey, secret, input.Revision); err != nil {
		return Settings{}, err
	}
	row, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	return fromRow(row), nil
}

func ValidateStoredSecret() error {
	if model.DB == nil {
		return fmt.Errorf("turnstile database unavailable")
	}
	row, err := loadSetting()
	if err != nil {
		return err
	}
	if len(row.SecretCipher) == 0 {
		return nil
	}
	if _, err := decryptSecret(row.SecretCipher); err != nil {
		return fmt.Errorf("无法解密 Turnstile Secret key: %w", err)
	}
	return nil
}

func loadSetting() (settingRow, error) {
	var row settingRow
	if model.DB == nil {
		return row, fmt.Errorf("turnstile database unavailable")
	}
	if err := model.DB.Table("turnstile_settings").Where("id = 1").First(&row).Error; err != nil {
		return row, err
	}
	return row, nil
}

func updateSetting(enabled bool, sitekey string, secret []byte, revision uint) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Table("turnstile_settings").Where("id = 1 AND revision = ?", revision).Updates(map[string]any{
			"enabled":       enabled,
			"sitekey":       sitekey,
			"secret_cipher": secret,
			"revision":      gorm.Expr("revision + 1"),
			"updated_at":    time.Now().UTC(),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrConflict
		}
		return nil
	})
}

func fromRow(row settingRow) Settings {
	return Settings{
		Enabled:   row.Enabled,
		Sitekey:   row.Sitekey,
		SecretSet: len(row.SecretCipher) > 0,
		Revision:  row.Revision,
	}
}

func validate(input Settings, hasSecret bool) error {
	if !input.Enabled && input.Sitekey == "" && input.Secret == "" {
		return nil
	}
	if input.Sitekey == "" || utf8.RuneCountInString(input.Sitekey) > maxSitekeyLength || strings.ContainsAny(input.Sitekey, "\r\n") {
		return fmt.Errorf("%w: Sitekey 不能为空", ErrValidation)
	}
	if input.Enabled && !hasSecret {
		return fmt.Errorf("%w: Secret key 不能为空", ErrValidation)
	}
	return nil
}
