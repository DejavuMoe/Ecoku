package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	smojiImageOriginSchemaVersion    = 11
	smojiImageOriginSchemaName       = "site_smoji_image_origin"
	smojiImageOriginSchemaDefinition = "sqlite3:v11:sites-smoji-image-origin"
)

func migrateSmojiImageOrigin(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`ALTER TABLE sites ADD COLUMN smoji_image_origin TEXT NOT NULL DEFAULT '' CHECK (length(smoji_image_origin) <= 2048)`).Error; err != nil {
			return fmt.Errorf("迁移表情图片来源: %w", err)
		}
		return tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
			smojiImageOriginSchemaVersion, smojiImageOriginSchemaName, schemaChecksum(smojiImageOriginSchemaDefinition), time.Now().UTC()).Error
	})
}
