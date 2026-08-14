package model

import (
	"crypto/sha256"
	"ecoku-server/config"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	LatestSchemaVersion             = 2
	freshSchemaVersion              = 1
	freshSchemaName                 = "fresh_published_comments"
	freshSchemaDefinition           = "sqlite3:fresh-v1:published-comments:site-display-config:notifications:tombstones"
	bloggerIdentitySchemaVersion    = 2
	bloggerIdentitySchemaName       = "site_blogger_identity"
	bloggerIdentitySchemaDefinition = "sqlite3:v2:sites-blogger-nickname-email"
)

type schemaMigration struct {
	Version   int       `gorm:"column:version"`
	Name      string    `gorm:"column:name"`
	Checksum  string    `gorm:"column:checksum"`
	AppliedAt time.Time `gorm:"column:applied_at"`
}

// PrepareDatabaseForStartup creates a new database at v1 and then applies every
// known migration in order. Existing v1 databases are upgraded in place inside
// SQLite transactions; migration history is retained and no database or backup
// file is ever deleted automatically.
func PrepareDatabaseForStartup(database *gorm.DB) error {
	exists, err := hasTable(database, "schema_migrations")
	if err != nil {
		return err
	}
	if !exists {
		empty, err := isDatabaseEmpty(database)
		if err != nil {
			return err
		}
		if !empty {
			return fmt.Errorf("检测到旧版或未版本化数据库；本版本不执行历史迁移，请备份后删除数据库并重新初始化")
		}
		if err := createFreshSchema(database); err != nil {
			return err
		}
	}
	currentVersion, err := validateKnownSchemaHistory(database)
	if err != nil {
		return err
	}
	if currentVersion < LatestSchemaVersion {
		if err := migrateSchema(database, currentVersion); err != nil {
			return err
		}
	}
	if err := validateCurrentSchema(database); err != nil {
		return err
	}
	return verifyForeignKeys(database)
}

func createFreshSchema(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statements := []string{
			`CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at DATETIME NOT NULL
)`,
			`CREATE TABLE sites (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  site_url TEXT NOT NULL CHECK (length(site_url) BETWEEN 8 AND 2048),
  domain TEXT NOT NULL CHECK (length(domain) BETWEEN 1 AND 255),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 120),
  default_sort TEXT NOT NULL DEFAULT 'newest' CHECK (default_sort IN ('newest', 'oldest')),
  email_required INTEGER NOT NULL DEFAULT 1 CHECK (email_required IN (0, 1)),
  website_required INTEGER NOT NULL DEFAULT 0 CHECK (website_required IN (0, 1)),
  placeholder TEXT NOT NULL CHECK (length(placeholder) BETWEEN 1 AND 80),
  comment_limit INTEGER NOT NULL DEFAULT 1000 CHECK (comment_limit BETWEEN 1 AND 10000),
  empty_message TEXT NOT NULL CHECK (length(empty_message) BETWEEN 1 AND 240),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
)`,
			`CREATE TABLE site_origins (
  site_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (length(origin) BETWEEN 8 AND 2048),
  PRIMARY KEY (site_id, origin),
  CONSTRAINT fk_site_origins_site FOREIGN KEY (site_id) REFERENCES sites(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
)`,
			`CREATE INDEX idx_site_origins_origin ON site_origins (origin, site_id)`,
			`CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL CHECK (length(site_id) BETWEEN 1 AND 100),
  mark TEXT NOT NULL CHECK (length(mark) BETWEEN 1 AND 512),
  page_title TEXT NOT NULL DEFAULT '' CHECK (length(page_title) <= 200),
  parent_id INTEGER NULL,
  username TEXT NOT NULL CHECK (length(username) <= 80),
  email TEXT NULL CHECK (email IS NULL OR length(email) <= 254),
  url TEXT NULL CHECK (url IS NULL OR length(url) <= 2048),
  content TEXT NOT NULL CHECK (length(content) <= 10000),
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT ck_comments_active_identity CHECK (
    deleted_at IS NOT NULL OR (length(trim(username)) > 0 AND length(trim(content)) > 0)
  ),
  CONSTRAINT ck_comments_tombstone_privacy CHECK (
    deleted_at IS NULL OR (username = '' AND email IS NULL AND url IS NULL AND content = '')
  ),
  CONSTRAINT uq_comments_scope_identity UNIQUE (id, site_id, mark),
  CONSTRAINT fk_comments_site FOREIGN KEY (site_id) REFERENCES sites(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_comments_parent_scope FOREIGN KEY (parent_id, site_id, mark)
    REFERENCES comments (id, site_id, mark)
    ON UPDATE RESTRICT ON DELETE RESTRICT
)`,
			`CREATE INDEX idx_comments_public_thread ON comments (site_id, mark, parent_id, created_at, id)`,
			`CREATE INDEX idx_comments_admin_state ON comments (site_id, deleted_at, created_at, id)`,
			`CREATE INDEX idx_comments_parent_scope ON comments (parent_id, site_id, mark)`,
			`CREATE TABLE notification_settings (
  channel TEXT PRIMARY KEY CHECK (channel IN ('email', 'telegram')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  secret_cipher BLOB NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
)`,
			`CREATE TABLE notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('blogger_email_new', 'blogger_telegram_new', 'visitor_reply')),
  comment_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  last_error_code TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  CONSTRAINT uq_notification_event UNIQUE (event_type, comment_id),
  CONSTRAINT fk_notification_comment FOREIGN KEY (comment_id) REFERENCES comments(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
)`,
			`CREATE INDEX idx_notification_outbox_ready ON notification_outbox (status, available_at, id)`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("创建全新 SQLite schema: %w", err)
			}
		}
		now := time.Now().UTC()
		for _, channel := range []string{"email", "telegram"} {
			if err := tx.Exec(`INSERT INTO notification_settings
  (channel, enabled, config_json, secret_cipher, revision, created_at, updated_at)
  VALUES (?, 0, '{}', NULL, 1, ?, ?)`, channel, now, now).Error; err != nil {
				return fmt.Errorf("初始化通知设置: %w", err)
			}
		}
		if err := seedConfiguredSites(tx, now); err != nil {
			return err
		}
		checksum := schemaChecksum(freshSchemaDefinition)
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, freshSchemaVersion, freshSchemaName, checksum, now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本: %w", err)
		}
		return nil
	})
}

func seedConfiguredSites(tx *gorm.DB, now time.Time) error {
	for _, seed := range config.GetRegisteredSites() {
		parsed, err := url.Parse(seed.SiteURL)
		if err != nil || parsed.Hostname() == "" {
			return fmt.Errorf("初始化站点 %q 失败", seed.ID)
		}
		emailRequired := seed.Comment.EmailRequired == nil || *seed.Comment.EmailRequired
		websiteRequired := seed.Comment.WebsiteRequired != nil && *seed.Comment.WebsiteRequired
		if err := tx.Exec(`INSERT INTO sites (
  id, site_url, domain, name, default_sort, email_required, website_required,
  placeholder, comment_limit, empty_message, revision, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			seed.ID, seed.SiteURL, strings.ToLower(parsed.Hostname()), seed.Name,
			seed.Comment.DefaultSort, emailRequired, websiteRequired,
			seed.Comment.Placeholder, seed.Comment.LengthLimit, seed.Comment.EmptyMessage,
			now, now,
		).Error; err != nil {
			return fmt.Errorf("初始化站点 %q: %w", seed.ID, err)
		}
		for _, origin := range seed.AllowedOrigins {
			if err := tx.Exec("INSERT INTO site_origins (site_id, origin) VALUES (?, ?)", seed.ID, origin).Error; err != nil {
				return fmt.Errorf("初始化站点 %q 来源: %w", seed.ID, err)
			}
		}
	}
	return nil
}

func validateKnownSchemaHistory(database *gorm.DB) (int, error) {
	var rows []schemaMigration
	if err := database.Raw("SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version").Scan(&rows).Error; err != nil {
		return 0, fmt.Errorf("读取 schema 版本: %w", err)
	}
	if len(rows) == 0 {
		return 0, fmt.Errorf("数据库缺少 schema 版本记录")
	}
	expected := map[int]struct {
		name       string
		definition string
	}{
		freshSchemaVersion:           {name: freshSchemaName, definition: freshSchemaDefinition},
		bloggerIdentitySchemaVersion: {name: bloggerIdentitySchemaName, definition: bloggerIdentitySchemaDefinition},
	}
	for index, row := range rows {
		version := index + 1
		if row.Version != version {
			return 0, fmt.Errorf("数据库 schema 版本记录不连续")
		}
		definition, known := expected[row.Version]
		if !known {
			if row.Version > LatestSchemaVersion {
				return 0, fmt.Errorf("数据库 schema 版本 %d 高于当前程序支持的 %d", row.Version, LatestSchemaVersion)
			}
			return 0, fmt.Errorf("数据库包含未知 schema 版本 %d", row.Version)
		}
		if row.Name != definition.name || row.Checksum != schemaChecksum(definition.definition) {
			return 0, fmt.Errorf("数据库 schema 版本 %d 校验失败", row.Version)
		}
	}
	return rows[len(rows)-1].Version, nil
}

func migrateSchema(database *gorm.DB, currentVersion int) error {
	for version := currentVersion + 1; version <= LatestSchemaVersion; version++ {
		switch version {
		case bloggerIdentitySchemaVersion:
			if err := migrateSiteBloggerIdentity(database); err != nil {
				return err
			}
		default:
			return fmt.Errorf("没有可用的 schema 迁移版本 %d", version)
		}
	}
	return nil
}

func migrateSiteBloggerIdentity(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statements := []string{
			`ALTER TABLE sites ADD COLUMN blogger_nickname TEXT NOT NULL DEFAULT '' CHECK (length(blogger_nickname) <= 80)`,
			`ALTER TABLE sites ADD COLUMN blogger_email TEXT NOT NULL DEFAULT '' CHECK (length(blogger_email) <= 254)`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("迁移站点博主身份字段: %w", err)
			}
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, bloggerIdentitySchemaVersion, bloggerIdentitySchemaName,
			schemaChecksum(bloggerIdentitySchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", bloggerIdentitySchemaVersion, err)
		}
		return nil
	})
}

func validateCurrentSchema(database *gorm.DB) error {
	currentVersion, err := validateKnownSchemaHistory(database)
	if err != nil {
		return err
	}
	if currentVersion != LatestSchemaVersion {
		return fmt.Errorf("数据库 schema 版本 %d 未升级到 %d", currentVersion, LatestSchemaVersion)
	}
	for _, table := range []string{"sites", "site_origins", "comments", "notification_settings", "notification_outbox"} {
		exists, err := hasTable(database, table)
		if err != nil || !exists {
			return fmt.Errorf("数据库缺少当前 schema 表 %s", table)
		}
	}
	for _, column := range []string{"blogger_nickname", "blogger_email"} {
		var count int64
		if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('sites') WHERE name = ?", column).Scan(&count).Error; err != nil || count != 1 {
			return fmt.Errorf("数据库缺少当前 schema 字段 sites.%s", column)
		}
	}
	return nil
}

func verifyForeignKeys(database *gorm.DB) error {
	type violation struct {
		Table string `gorm:"column:table"`
	}
	var rows []violation
	if err := database.Raw("PRAGMA foreign_key_check").Scan(&rows).Error; err != nil {
		return fmt.Errorf("检查 SQLite 外键: %w", err)
	}
	if len(rows) > 0 {
		return fmt.Errorf("SQLite 外键检查失败")
	}
	return nil
}

func hasTable(database *gorm.DB, name string) (bool, error) {
	var count int64
	err := database.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?", name).Scan(&count).Error
	return count == 1, err
}

func isDatabaseEmpty(database *gorm.DB) (bool, error) {
	var count int64
	err := database.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").Scan(&count).Error
	return count == 0, err
}

func schemaChecksum(definition string) string {
	sum := sha256.Sum256([]byte(definition))
	return hex.EncodeToString(sum[:])
}
