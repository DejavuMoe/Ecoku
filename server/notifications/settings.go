package notifications

import (
	"ecoku-server/config"
	"ecoku-server/masterkey"
	"ecoku-server/model"
	"encoding/json"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

const secretAAD = "ecoku-notification-secret-v1"

var (
	ErrValidation = errors.New("notification settings validation failed")
	ErrConflict   = errors.New("notification settings changed concurrently")
	targetPattern = regexp.MustCompile(`^-?[0-9]+$`)
)

func GetSettings() (EmailConfig, TelegramConfig, error) {
	emailRow, err := loadSetting(model.DB, ChannelEmail)
	if err != nil {
		return EmailConfig{}, TelegramConfig{}, err
	}
	telegramRow, err := loadSetting(model.DB, ChannelTelegram)
	if err != nil {
		return EmailConfig{}, TelegramConfig{}, err
	}
	emailConfig, err := emailFromRow(emailRow, false)
	if err != nil {
		return EmailConfig{}, TelegramConfig{}, err
	}
	telegramConfig, err := telegramFromRow(telegramRow, false)
	return emailConfig, telegramConfig, err
}

func SaveEmail(input EmailConfig) (EmailConfig, error) {
	current, err := loadSetting(model.DB, ChannelEmail)
	if err != nil {
		return EmailConfig{}, err
	}
	input = normalizeEmail(input)
	if input.Revision == 0 {
		input.Revision = current.Revision
	}
	if err := validateEmail(input, len(current.SecretCipher) > 0 || input.Password != ""); err != nil {
		return EmailConfig{}, err
	}
	payload, _ := json.Marshal(storedEmailConfig{
		Host: input.Host, Port: input.Port, Encryption: input.Encryption,
		Username: input.Username, FromAddress: input.FromAddress, Recipients: input.Recipients,
	})
	secret := current.SecretCipher
	if input.Password != "" {
		secret, err = masterkey.Encrypt(input.Password, secretAAD)
		if err != nil {
			return EmailConfig{}, err
		}
	}
	if err := updateSetting(ChannelEmail, input.Enabled, payload, secret, input.Revision); err != nil {
		return EmailConfig{}, err
	}
	row, err := loadSetting(model.DB, ChannelEmail)
	if err != nil {
		return EmailConfig{}, err
	}
	return emailFromRow(row, false)
}

func SaveTelegram(input TelegramConfig) (TelegramConfig, error) {
	current, err := loadSetting(model.DB, ChannelTelegram)
	if err != nil {
		return TelegramConfig{}, err
	}
	input = normalizeTelegram(input)
	if input.Revision == 0 {
		input.Revision = current.Revision
	}
	if err := validateTelegram(input, len(current.SecretCipher) > 0 || input.Token != ""); err != nil {
		return TelegramConfig{}, err
	}
	payload, _ := json.Marshal(storedTelegramConfig{Targets: input.Targets})
	secret := current.SecretCipher
	if input.Token != "" {
		secret, err = masterkey.Encrypt(input.Token, secretAAD)
		if err != nil {
			return TelegramConfig{}, err
		}
	}
	if err := updateSetting(ChannelTelegram, input.Enabled, payload, secret, input.Revision); err != nil {
		return TelegramConfig{}, err
	}
	row, err := loadSetting(model.DB, ChannelTelegram)
	if err != nil {
		return TelegramConfig{}, err
	}
	return telegramFromRow(row, false)
}

func ValidateStoredSecrets() error {
	if model.DB == nil {
		return fmt.Errorf("notification database unavailable")
	}
	var rows []settingRow
	if err := model.DB.Table("notification_settings").Where("secret_cipher IS NOT NULL").Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if _, err := masterkey.Decrypt(row.SecretCipher, secretAAD); err != nil {
			return fmt.Errorf("无法解密 %s 通知凭据: %w", row.Channel, err)
		}
	}
	return nil
}

func resolveEmailForTest(input EmailConfig) (EmailConfig, error) {
	current, err := loadSetting(model.DB, ChannelEmail)
	if err != nil {
		return EmailConfig{}, err
	}
	input = normalizeEmail(input)
	if input.Password == "" {
		input.Password, err = masterkey.Decrypt(current.SecretCipher, secretAAD)
		if err != nil {
			return EmailConfig{}, err
		}
	}
	if err := validateEmail(input, input.Password != ""); err != nil {
		return EmailConfig{}, err
	}
	return input, nil
}

func resolveTelegramForTest(input TelegramConfig) (TelegramConfig, error) {
	current, err := loadSetting(model.DB, ChannelTelegram)
	if err != nil {
		return TelegramConfig{}, err
	}
	input = normalizeTelegram(input)
	if input.Token == "" {
		input.Token, err = masterkey.Decrypt(current.SecretCipher, secretAAD)
		if err != nil {
			return TelegramConfig{}, err
		}
	}
	if err := validateTelegram(input, input.Token != ""); err != nil {
		return TelegramConfig{}, err
	}
	return input, nil
}

func loadSetting(database *gorm.DB, channel string) (settingRow, error) {
	var row settingRow
	if database == nil {
		return row, fmt.Errorf("notification database unavailable")
	}
	if err := database.Table("notification_settings").Where("channel = ?", channel).First(&row).Error; err != nil {
		return row, err
	}
	return row, nil
}

func updateSetting(channel string, enabled bool, payload, secret []byte, revision uint) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Table("notification_settings").Where("channel = ? AND revision = ?", channel, revision).Updates(map[string]any{
			"enabled": enabled, "config_json": string(payload),
			"secret_cipher": secret, "revision": gorm.Expr("revision + 1"), "updated_at": time.Now().UTC(),
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

func emailFromRow(row settingRow, includeSecret bool) (EmailConfig, error) {
	var stored storedEmailConfig
	if err := json.Unmarshal([]byte(row.ConfigJSON), &stored); err != nil {
		return EmailConfig{}, err
	}
	result := EmailConfig{
		Enabled: row.Enabled, Host: stored.Host, Port: stored.Port,
		Encryption: stored.Encryption, Username: stored.Username,
		FromAddress: stored.FromAddress, Recipients: nonNil(stored.Recipients),
		PasswordSet: len(row.SecretCipher) > 0, Revision: row.Revision,
	}
	if includeSecret {
		secret, err := masterkey.Decrypt(row.SecretCipher, secretAAD)
		if err != nil {
			return EmailConfig{}, err
		}
		result.Password = secret
	}
	return result, nil
}

func telegramFromRow(row settingRow, includeSecret bool) (TelegramConfig, error) {
	var stored storedTelegramConfig
	if err := json.Unmarshal([]byte(row.ConfigJSON), &stored); err != nil {
		return TelegramConfig{}, err
	}
	result := TelegramConfig{
		Enabled: row.Enabled, Targets: nonNil(stored.Targets),
		TokenSet: len(row.SecretCipher) > 0, Revision: row.Revision,
	}
	if includeSecret {
		secret, err := masterkey.Decrypt(row.SecretCipher, secretAAD)
		if err != nil {
			return TelegramConfig{}, err
		}
		result.Token = secret
	}
	return result, nil
}

func normalizeEmail(input EmailConfig) EmailConfig {
	input.Host = strings.TrimSpace(input.Host)
	input.Encryption = strings.ToLower(strings.TrimSpace(input.Encryption))
	input.Username = strings.TrimSpace(input.Username)
	input.FromAddress = strings.TrimSpace(input.FromAddress)
	input.Password = strings.TrimSpace(input.Password)
	input.Recipients = normalizeValues(input.Recipients)
	if input.Encryption == "" {
		input.Encryption = "tls"
	}
	return input
}

func normalizeTelegram(input TelegramConfig) TelegramConfig {
	input.Token = strings.TrimSpace(input.Token)
	input.Targets = normalizeValues(input.Targets)
	return input
}

func validateEmail(input EmailConfig, hasSecret bool) error {
	if !input.Enabled && input.Host == "" && input.Port == 0 && input.FromAddress == "" && len(input.Recipients) == 0 {
		return nil
	}
	if input.Host == "" || len(input.Host) > 255 || input.Port < 1 || input.Port > 65535 {
		return fmt.Errorf("%w: SMTP 服务器或端口无效", ErrValidation)
	}
	if input.Encryption != "tls" && input.Encryption != "starttls" {
		return fmt.Errorf("%w: 加密方式无效", ErrValidation)
	}
	if input.Enabled && strings.TrimSpace(config.GetNotificationsConfig().InstancePublicURL) == "" {
		return fmt.Errorf("%w: 实例公开网址尚未配置", ErrValidation)
	}
	if !validAddress(input.FromAddress) || len(input.Recipients) == 0 {
		return fmt.Errorf("%w: 发件人或收件人无效", ErrValidation)
	}
	for _, recipient := range input.Recipients {
		if !validAddress(recipient) {
			return fmt.Errorf("%w: 收件人邮箱格式无效", ErrValidation)
		}
	}
	if !hasSecret {
		return fmt.Errorf("%w: SMTP 密码尚未设置", ErrValidation)
	}
	return nil
}

func validateTelegram(input TelegramConfig, hasSecret bool) error {
	if !input.Enabled && len(input.Targets) == 0 && input.Token == "" {
		return nil
	}
	if input.Enabled && strings.TrimSpace(config.GetNotificationsConfig().InstancePublicURL) == "" {
		return fmt.Errorf("%w: 实例公开网址尚未配置", ErrValidation)
	}
	if len(input.Targets) == 0 {
		return fmt.Errorf("%w: 接收目标不能为空", ErrValidation)
	}
	for _, target := range input.Targets {
		if !targetPattern.MatchString(target) || len(target) > 32 {
			return fmt.Errorf("%w: 接收目标 ID 格式无效", ErrValidation)
		}
	}
	if !hasSecret {
		return fmt.Errorf("%w: Bot Token 尚未设置", ErrValidation)
	}
	return nil
}

func validAddress(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && strings.EqualFold(address.Address, value) && len(value) <= 254
}

func normalizeValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
