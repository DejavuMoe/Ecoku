package captcha

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

const (
	ProviderOff       = "off"
	ProviderTurnstile = "turnstile"
	ProviderCap       = "cap"
	maxSitekeyLength  = 255
	maxInstanceLength = 2048
)

var (
	ErrValidation = errors.New("CAPTCHA settings validation failed")
	ErrConflict   = errors.New("CAPTCHA settings changed concurrently")
)

type ProviderSettings struct {
	Sitekey   string `json:"sitekey"`
	Secret    string `json:"secret,omitempty"`
	SecretSet bool   `json:"secret_set"`
}

type CapSettings struct {
	InstanceURL string `json:"instance_url"`
	Sitekey     string `json:"sitekey"`
	Secret      string `json:"secret,omitempty"`
	SecretSet   bool   `json:"secret_set"`
}

type Settings struct {
	Provider  string           `json:"provider"`
	Turnstile ProviderSettings `json:"turnstile"`
	Cap       CapSettings      `json:"cap"`
	Revision  uint             `json:"revision"`
}

type LegacyTurnstileSettings struct {
	Enabled   bool   `json:"enabled"`
	Sitekey   string `json:"sitekey"`
	Secret    string `json:"secret,omitempty"`
	SecretSet bool   `json:"secret_set"`
	Revision  uint   `json:"revision"`
}

type settingRow struct {
	ID                    uint      `gorm:"column:id"`
	Enabled               bool      `gorm:"column:enabled"`
	Provider              string    `gorm:"column:provider"`
	Sitekey               string    `gorm:"column:sitekey"`
	SecretCipher          []byte    `gorm:"column:secret_cipher"`
	CapInstanceURL        string    `gorm:"column:cap_instance_url"`
	CapSitekey            string    `gorm:"column:cap_sitekey"`
	CapSecretCipher       []byte    `gorm:"column:cap_secret_cipher"`
	Revision              uint      `gorm:"column:revision"`
	CreatedAt             time.Time `gorm:"column:created_at"`
	UpdatedAt             time.Time `gorm:"column:updated_at"`
}

func GetSettings() (Settings, error) {
	row, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	return fromRow(row), nil
}

func GetLegacyTurnstileSettings() (LegacyTurnstileSettings, error) {
	row, err := loadSetting()
	if err != nil {
		return LegacyTurnstileSettings{}, err
	}
	return LegacyTurnstileSettings{
		Enabled:   row.Enabled && row.Provider == ProviderTurnstile,
		Sitekey:   row.Sitekey,
		SecretSet: len(row.SecretCipher) > 0,
		Revision:  row.Revision,
	}, nil
}

func PublicConfig() (config.CaptchaPublicConfig, error) {
	row, err := loadSetting()
	if err != nil {
		return config.CaptchaPublicConfig{}, err
	}
	if !row.Enabled {
		return config.CaptchaPublicConfig{Provider: ProviderOff}, nil
	}
	switch row.Provider {
	case ProviderTurnstile:
		return config.CaptchaPublicConfig{Provider: ProviderTurnstile, Sitekey: row.Sitekey}, nil
	case ProviderCap:
		return config.CaptchaPublicConfig{Provider: ProviderCap, Sitekey: row.CapSitekey, InstanceURL: row.CapInstanceURL}, nil
	default:
		return config.CaptchaPublicConfig{}, fmt.Errorf("未知 CAPTCHA 提供方")
	}
}

func ActiveCapOrigin() (string, error) {
	row, err := loadSetting()
	if err != nil {
		return "", err
	}
	if !row.Enabled || row.Provider != ProviderCap {
		return "", nil
	}
	if strings.TrimSpace(row.CapInstanceURL) == "" {
		return "", nil
	}
	parsed, err := url.Parse(row.CapInstanceURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", fmt.Errorf("Cap 实例地址无效")
	}
	return "https://" + strings.ToLower(parsed.Host), nil
}

func Save(input Settings) (Settings, error) {
	current, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	if input.Revision == 0 {
		input.Revision = current.Revision
	}
	input.Provider = strings.ToLower(strings.TrimSpace(input.Provider))
	input.Turnstile.Sitekey = strings.TrimSpace(input.Turnstile.Sitekey)
	input.Turnstile.Secret = strings.TrimSpace(input.Turnstile.Secret)
	input.Cap.InstanceURL = strings.TrimSpace(input.Cap.InstanceURL)
	input.Cap.Sitekey = strings.TrimSpace(input.Cap.Sitekey)
	input.Cap.Secret = strings.TrimSpace(input.Cap.Secret)

	if input.Cap.InstanceURL != "" {
		input.Cap.InstanceURL, err = normalizeCapInstanceURL(input.Cap.InstanceURL)
		if err != nil {
			return Settings{}, fmt.Errorf("%w: %v", ErrValidation, err)
		}
	}
	if err := validateSitekey("Turnstile Sitekey", input.Turnstile.Sitekey); err != nil {
		return Settings{}, err
	}
	if err := validateSitekey("Cap Site key", input.Cap.Sitekey); err != nil {
		return Settings{}, err
	}
	turnstileHasSecret := len(current.SecretCipher) > 0 || input.Turnstile.Secret != ""
	capHasSecret := len(current.CapSecretCipher) > 0 || input.Cap.Secret != ""
	if err := validateSelectedProvider(input, turnstileHasSecret, capHasSecret); err != nil {
		return Settings{}, err
	}

	turnstileSecret := current.SecretCipher
	if input.Turnstile.Secret != "" {
		turnstileSecret, err = encryptSecret(input.Turnstile.Secret, turnstileSecretAAD)
		if err != nil {
			return Settings{}, err
		}
	}
	capSecret := current.CapSecretCipher
	if input.Cap.Secret != "" {
		capSecret, err = encryptSecret(input.Cap.Secret, capSecretAAD)
		if err != nil {
			return Settings{}, err
		}
	}

	enabled := input.Provider != ProviderOff
	storedProvider := current.Provider
	if storedProvider != ProviderTurnstile && storedProvider != ProviderCap {
		storedProvider = ProviderTurnstile
	}
	if enabled {
		storedProvider = input.Provider
	}
	if err := updateSetting(settingRow{
		Enabled:         enabled,
		Provider:        storedProvider,
		Sitekey:         input.Turnstile.Sitekey,
		SecretCipher:    turnstileSecret,
		CapInstanceURL:  input.Cap.InstanceURL,
		CapSitekey:      input.Cap.Sitekey,
		CapSecretCipher: capSecret,
		Revision:        input.Revision,
	}); err != nil {
		return Settings{}, err
	}
	row, err := loadSetting()
	if err != nil {
		return Settings{}, err
	}
	return fromRow(row), nil
}

func SaveLegacyTurnstile(input LegacyTurnstileSettings) (LegacyTurnstileSettings, error) {
	current, err := GetSettings()
	if err != nil {
		return LegacyTurnstileSettings{}, err
	}
	current.Provider = ProviderOff
	if input.Enabled {
		current.Provider = ProviderTurnstile
	}
	current.Turnstile.Sitekey = input.Sitekey
	current.Turnstile.Secret = input.Secret
	current.Revision = input.Revision
	saved, err := Save(current)
	if err != nil {
		return LegacyTurnstileSettings{}, err
	}
	return LegacyTurnstileSettings{
		Enabled:   saved.Provider == ProviderTurnstile,
		Sitekey:   saved.Turnstile.Sitekey,
		SecretSet: saved.Turnstile.SecretSet,
		Revision:  saved.Revision,
	}, nil
}

func Disable() (bool, error) {
	row, err := loadSetting()
	if err != nil {
		return false, err
	}
	if !row.Enabled {
		return false, nil
	}
	result := model.DB.Table("captcha_settings").Where("id = 1 AND revision = ?", row.Revision).Updates(map[string]any{
		"enabled":    false,
		"revision":   gorm.Expr("revision + 1"),
		"updated_at": time.Now().UTC(),
	})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected != 1 {
		return false, ErrConflict
	}
	return true, nil
}

func ValidateStoredSecrets() error {
	if model.DB == nil {
		return fmt.Errorf("CAPTCHA database unavailable")
	}
	row, err := loadSetting()
	if err != nil {
		return err
	}
	if len(row.SecretCipher) > 0 {
		if _, err := decryptSecret(row.SecretCipher, turnstileSecretAAD); err != nil {
			return fmt.Errorf("无法解密 Turnstile Secret key: %w", err)
		}
	}
	if len(row.CapSecretCipher) > 0 {
		if _, err := decryptSecret(row.CapSecretCipher, capSecretAAD); err != nil {
			return fmt.Errorf("无法解密 Cap Secret key: %w", err)
		}
	}
	return nil
}

func loadSetting() (settingRow, error) {
	var row settingRow
	if model.DB == nil {
		return row, fmt.Errorf("CAPTCHA database unavailable")
	}
	if err := model.DB.Table("captcha_settings").Where("id = 1").First(&row).Error; err != nil {
		return row, err
	}
	return row, nil
}

func updateSetting(row settingRow) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Table("captcha_settings").Where("id = 1 AND revision = ?", row.Revision).Updates(map[string]any{
			"enabled":             row.Enabled,
			"provider":            row.Provider,
			"sitekey":             row.Sitekey,
			"secret_cipher":       row.SecretCipher,
			"cap_instance_url":    row.CapInstanceURL,
			"cap_sitekey":         row.CapSitekey,
			"cap_secret_cipher":   row.CapSecretCipher,
			"revision":            gorm.Expr("revision + 1"),
			"updated_at":          time.Now().UTC(),
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
	provider := ProviderOff
	if row.Enabled {
		provider = row.Provider
	}
	return Settings{
		Provider: provider,
		Turnstile: ProviderSettings{
			Sitekey:   row.Sitekey,
			SecretSet: len(row.SecretCipher) > 0,
		},
		Cap: CapSettings{
			InstanceURL: row.CapInstanceURL,
			Sitekey:     row.CapSitekey,
			SecretSet:   len(row.CapSecretCipher) > 0,
		},
		Revision: row.Revision,
	}
}

func validateSelectedProvider(input Settings, turnstileHasSecret, capHasSecret bool) error {
	switch input.Provider {
	case ProviderOff:
		return nil
	case ProviderTurnstile:
		if input.Turnstile.Sitekey == "" {
			return fmt.Errorf("%w: Turnstile Sitekey 不能为空", ErrValidation)
		}
		if !turnstileHasSecret {
			return fmt.Errorf("%w: Turnstile Secret key 不能为空", ErrValidation)
		}
	case ProviderCap:
		if input.Cap.InstanceURL == "" {
			return fmt.Errorf("%w: Cap 实例地址不能为空", ErrValidation)
		}
		if input.Cap.Sitekey == "" {
			return fmt.Errorf("%w: Cap Site key 不能为空", ErrValidation)
		}
		if !capHasSecret {
			return fmt.Errorf("%w: Cap Secret key 不能为空", ErrValidation)
		}
	default:
		return fmt.Errorf("%w: 验证方式无效", ErrValidation)
	}
	return nil
}

func validateSitekey(label, value string) error {
	invalidCapPath := label == "Cap Site key" && strings.ContainsAny(value, "/?#\\")
	if utf8.RuneCountInString(value) > maxSitekeyLength || strings.ContainsAny(value, "\r\n") || invalidCapPath {
		return fmt.Errorf("%w: %s 无效", ErrValidation, label)
	}
	return nil
}

func normalizeCapInstanceURL(raw string) (string, error) {
	if len(raw) > maxInstanceLength || strings.ContainsAny(raw, "\r\n\\") {
		return "", fmt.Errorf("Cap 实例地址无效")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.RawPath != "" {
		return "", fmt.Errorf("Cap 实例地址必须是公开 HTTPS 地址")
	}
	hostname := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if hostname == "" || hostname == "localhost" || strings.HasSuffix(hostname, ".localhost") {
		return "", fmt.Errorf("Cap 实例地址必须使用公网主机")
	}
	if address := net.ParseIP(hostname); address != nil && !isPublicIP(address) {
		return "", fmt.Errorf("Cap 实例地址不能使用非公网 IP")
	}
	parsed.Scheme = "https"
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}
