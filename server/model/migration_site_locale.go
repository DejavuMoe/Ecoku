package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	siteLocaleSchemaVersion    = 12
	siteLocaleSchemaName       = "site_i18n_locale"
	siteLocaleSchemaDefinition = "sqlite3:v12:sites-i18n-locale"
)

func migrateSiteLocale(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`ALTER TABLE sites ADD COLUMN i18n_locale TEXT NOT NULL DEFAULT 'zh-CN' CHECK (i18n_locale IN ('zh-CN', 'zh-Hant', 'en'))`).Error; err != nil {
			return fmt.Errorf("迁移站点界面语言: %w", err)
		}
		return tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
			siteLocaleSchemaVersion, siteLocaleSchemaName, schemaChecksum(siteLocaleSchemaDefinition), time.Now().UTC()).Error
	})
}
