package notifications

import "time"

const (
	ChannelEmail    = "email"
	ChannelTelegram = "telegram"

	EventBloggerEmail    = "blogger_email_new"
	EventBloggerTelegram = "blogger_telegram_new"
	EventVisitorReply    = "visitor_reply"
)

type EmailConfig struct {
	Enabled     bool     `json:"enabled"`
	Host        string   `json:"host"`
	Port        int      `json:"port"`
	Encryption  string   `json:"encryption"`
	Username    string   `json:"username"`
	Password    string   `json:"password,omitempty"`
	PasswordSet bool     `json:"password_set"`
	FromAddress string   `json:"from_address"`
	Recipients  []string `json:"recipients"`
	Revision    uint     `json:"revision"`
}

type TelegramConfig struct {
	Enabled  bool     `json:"enabled"`
	Token    string   `json:"token,omitempty"`
	TokenSet bool     `json:"token_set"`
	Targets  []string `json:"targets"`
	Revision uint     `json:"revision"`
}

type storedEmailConfig struct {
	Host        string   `json:"host"`
	Port        int      `json:"port"`
	Encryption  string   `json:"encryption"`
	Username    string   `json:"username"`
	FromAddress string   `json:"from_address"`
	Recipients  []string `json:"recipients"`
}

type storedTelegramConfig struct {
	Targets []string `json:"targets"`
}

type settingRow struct {
	Channel      string    `gorm:"column:channel"`
	Enabled      bool      `gorm:"column:enabled"`
	ConfigJSON   string    `gorm:"column:config_json"`
	SecretCipher []byte    `gorm:"column:secret_cipher"`
	Revision     uint      `gorm:"column:revision"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

type outboxRow struct {
	ID            uint       `gorm:"column:id"`
	EventType     string     `gorm:"column:event_type"`
	CommentID     uint       `gorm:"column:comment_id"`
	Status        string     `gorm:"column:status"`
	Attempts      int        `gorm:"column:attempts"`
	AvailableAt   time.Time  `gorm:"column:available_at"`
	LockedAt      *time.Time `gorm:"column:locked_at"`
	LastErrorCode *string    `gorm:"column:last_error_code"`
	CreatedAt     time.Time  `gorm:"column:created_at"`
	UpdatedAt     time.Time  `gorm:"column:updated_at"`
	SentAt        *time.Time `gorm:"column:sent_at"`
}
