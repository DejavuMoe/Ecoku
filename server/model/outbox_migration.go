package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	outboxDeliveryStateSchemaVersion    = 9
	outboxDeliveryStateSchemaName       = "notification_outbox_delivery_state"
	outboxDeliveryStateSchemaDefinition = "sqlite3:v9:outbox-exhausted-status:telegram-retract-event:provider-message-id:comment-index"
)

// migrateOutboxDeliveryState rebuilds notification_outbox in place because
// SQLite cannot alter CHECK constraints. Every row keeps its id, target and
// timestamps; failed rows that already used all attempts become exhausted.
func migrateOutboxDeliveryState(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		var sequence int64
		if err := tx.Raw(`SELECT COALESCE(MAX(seq), 0) FROM sqlite_sequence WHERE name = 'notification_outbox'`).Scan(&sequence).Error; err != nil {
			return fmt.Errorf("读取通知队列序号: %w", err)
		}
		statements := []string{
			`CREATE TABLE notification_outbox_v9 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('blogger_email_new', 'blogger_telegram_new', 'visitor_reply', 'blogger_telegram_retract')),
  comment_id INTEGER NOT NULL,
  target TEXT NOT NULL CHECK (length(target) BETWEEN 1 AND 254),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'exhausted')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  last_error_code TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  provider_message_id TEXT NULL CHECK (provider_message_id IS NULL OR length(provider_message_id) BETWEEN 1 AND 64),
  CONSTRAINT uq_notification_event UNIQUE (event_type, comment_id, target),
  CONSTRAINT fk_notification_comment FOREIGN KEY (comment_id) REFERENCES comments(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
)`,
			`INSERT INTO notification_outbox_v9
  (id, event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at, provider_message_id)
SELECT id, event_type, comment_id, target,
  CASE WHEN status = 'failed' AND attempts >= 8 THEN 'exhausted' ELSE status END,
  attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at, NULL
FROM notification_outbox ORDER BY id`,
			`DROP TABLE notification_outbox`,
			`ALTER TABLE notification_outbox_v9 RENAME TO notification_outbox`,
			`CREATE INDEX idx_notification_outbox_ready ON notification_outbox (status, available_at, id)`,
			`CREATE INDEX idx_notification_outbox_comment ON notification_outbox (comment_id)`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("重建通知队列投递状态: %w", err)
			}
		}
		// Keep AUTOINCREMENT from reusing ids of rows deleted before the rebuild.
		if sequence > 0 {
			if err := tx.Exec(`INSERT INTO sqlite_sequence (name, seq)
SELECT 'notification_outbox', 0 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'notification_outbox')`).Error; err != nil {
				return fmt.Errorf("保留通知队列序号: %w", err)
			}
			if err := tx.Exec(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'notification_outbox' AND seq < ?`, sequence, sequence).Error; err != nil {
				return fmt.Errorf("保留通知队列序号: %w", err)
			}
		}
		return tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
			outboxDeliveryStateSchemaVersion, outboxDeliveryStateSchemaName,
			schemaChecksum(outboxDeliveryStateSchemaDefinition), time.Now().UTC()).Error
	})
}
