package model

import (
	"fmt"
	"gorm.io/gorm"
	"time"
)

const (
	adminSessionSchemaVersion    = 8
	adminSessionSchemaName       = "revocable_admin_sessions"
	adminSessionSchemaDefinition = "sqlite3:v8:admin-session-token-digest-expiry"
)

func migrateAdminSessions(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`CREATE TABLE admin_sessions (
  token_digest TEXT PRIMARY KEY CHECK (length(token_digest) = 64),
  expires_at INTEGER NOT NULL CHECK (expires_at > 0)
)`).Error; err != nil {
			return fmt.Errorf("创建管理员会话表: %w", err)
		}
		if err := tx.Exec(`CREATE INDEX idx_admin_sessions_expiry ON admin_sessions (expires_at)`).Error; err != nil {
			return err
		}
		return tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
			adminSessionSchemaVersion, adminSessionSchemaName, schemaChecksum(adminSessionSchemaDefinition), time.Now().UTC()).Error
	})
}
