package model

import (
	"crypto/sha256"
	"ecoku-server/config"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	LatestSchemaVersion               = 7
	freshSchemaVersion                = 1
	freshSchemaName                   = "fresh_published_comments"
	freshSchemaDefinition             = "sqlite3:fresh-v1:published-comments:site-display-config:notifications:tombstones"
	bloggerIdentitySchemaVersion      = 2
	bloggerIdentitySchemaName         = "site_blogger_identity"
	bloggerIdentitySchemaDefinition   = "sqlite3:v2:sites-blogger-nickname-email"
	bloggerBadgeSchemaVersion         = 3
	bloggerBadgeSchemaName            = "site_blogger_badge"
	bloggerBadgeSchemaDefinition      = "sqlite3:v3:sites-blogger-badge"
	turnstileSettingsSchemaVersion    = 4
	turnstileSettingsSchemaName       = "instance_turnstile_settings"
	turnstileSettingsSchemaDefinition = "sqlite3:v4:turnstile-settings"
	bloggerProofSchemaVersion         = 5
	bloggerProofSchemaName            = "blogger_passphrase_outbox_targets"
	bloggerProofSchemaDefinition      = "sqlite3:v5:blogger-passphrase:comment-is-blogger:outbox-target-snapshot"
	captchaProviderSchemaVersion      = 6
	captchaProviderSchemaName         = "captcha_provider_cap_standalone"
	captchaProviderSchemaDefinition   = "sqlite3:v6:captcha-provider:cap-standalone"
	smojiSiteSchemaVersion            = 7
	smojiSiteSchemaName               = "site_smoji_manifest"
	smojiSiteSchemaDefinition         = "sqlite3:v7:sites-smoji-enabled-manifest-url"
	DefaultBloggerBadge               = "[博主]"
	legacyOutboxTarget                = "*"
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
		freshSchemaVersion:             {name: freshSchemaName, definition: freshSchemaDefinition},
		bloggerIdentitySchemaVersion:   {name: bloggerIdentitySchemaName, definition: bloggerIdentitySchemaDefinition},
		bloggerBadgeSchemaVersion:      {name: bloggerBadgeSchemaName, definition: bloggerBadgeSchemaDefinition},
		turnstileSettingsSchemaVersion: {name: turnstileSettingsSchemaName, definition: turnstileSettingsSchemaDefinition},
		bloggerProofSchemaVersion:      {name: bloggerProofSchemaName, definition: bloggerProofSchemaDefinition},
		captchaProviderSchemaVersion:   {name: captchaProviderSchemaName, definition: captchaProviderSchemaDefinition},
		smojiSiteSchemaVersion:         {name: smojiSiteSchemaName, definition: smojiSiteSchemaDefinition},
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
		case bloggerBadgeSchemaVersion:
			if err := migrateSiteBloggerBadge(database); err != nil {
				return err
			}
		case turnstileSettingsSchemaVersion:
			if err := migrateTurnstileSettings(database); err != nil {
				return err
			}
		case bloggerProofSchemaVersion:
			if err := migrateBloggerProofAndOutboxTargets(database); err != nil {
				return err
			}
		case captchaProviderSchemaVersion:
			if err := migrateCaptchaProvider(database); err != nil {
				return err
			}
		case smojiSiteSchemaVersion:
			if err := migrateSiteSmoji(database); err != nil {
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

func migrateSiteBloggerBadge(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statement := `ALTER TABLE sites ADD COLUMN blogger_badge TEXT NOT NULL DEFAULT '[博主]' CHECK (length(blogger_badge) <= 64)`
		if err := tx.Exec(statement).Error; err != nil {
			return fmt.Errorf("迁移站点博主标志字段: %w", err)
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, bloggerBadgeSchemaVersion, bloggerBadgeSchemaName,
			schemaChecksum(bloggerBadgeSchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", bloggerBadgeSchemaVersion, err)
		}
		return nil
	})
}

func migrateTurnstileSettings(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`CREATE TABLE turnstile_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  sitekey TEXT NOT NULL DEFAULT '' CHECK (length(sitekey) <= 255),
  secret_cipher BLOB NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
)`).Error; err != nil {
			return fmt.Errorf("迁移 Turnstile 设置表: %w", err)
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO turnstile_settings
  (id, enabled, sitekey, secret_cipher, revision, created_at, updated_at)
  VALUES (1, 0, '', NULL, 1, ?, ?)`, now, now).Error; err != nil {
			return fmt.Errorf("初始化 Turnstile 设置: %w", err)
		}
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, turnstileSettingsSchemaVersion, turnstileSettingsSchemaName,
			schemaChecksum(turnstileSettingsSchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", turnstileSettingsSchemaVersion, err)
		}
		return nil
	})
}

func migrateBloggerProofAndOutboxTargets(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statements := []string{
			`ALTER TABLE sites ADD COLUMN blogger_passphrase_hash TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE comments ADD COLUMN is_blogger INTEGER NOT NULL DEFAULT 0 CHECK (is_blogger IN (0, 1))`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("迁移博主口令字段: %w", err)
			}
		}
		if err := rebuildNotificationOutboxWithTargets(tx); err != nil {
			return err
		}
		if err := backfillAllHistoricalBloggerComments(tx); err != nil {
			return fmt.Errorf("回填历史博主评论: %w", err)
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, bloggerProofSchemaVersion, bloggerProofSchemaName,
			schemaChecksum(bloggerProofSchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", bloggerProofSchemaVersion, err)
		}
		return nil
	})
}

func migrateCaptchaProvider(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statements := []string{
			`ALTER TABLE turnstile_settings RENAME TO captcha_settings`,
			`ALTER TABLE captcha_settings ADD COLUMN provider TEXT NOT NULL DEFAULT 'turnstile' CHECK (provider IN ('turnstile', 'cap'))`,
			`ALTER TABLE captcha_settings ADD COLUMN cap_instance_url TEXT NOT NULL DEFAULT '' CHECK (length(cap_instance_url) <= 2048)`,
			`ALTER TABLE captcha_settings ADD COLUMN cap_sitekey TEXT NOT NULL DEFAULT '' CHECK (length(cap_sitekey) <= 255)`,
			`ALTER TABLE captcha_settings ADD COLUMN cap_secret_cipher BLOB NULL`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("迁移 CAPTCHA 提供方设置: %w", err)
			}
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, captchaProviderSchemaVersion, captchaProviderSchemaName,
			schemaChecksum(captchaProviderSchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", captchaProviderSchemaVersion, err)
		}
		return nil
	})
}

func migrateSiteSmoji(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		statements := []string{
			`ALTER TABLE sites ADD COLUMN smoji_enabled INTEGER NOT NULL DEFAULT 0 CHECK (smoji_enabled IN (0, 1))`,
			`ALTER TABLE sites ADD COLUMN smoji_manifest_url TEXT NOT NULL DEFAULT '' CHECK (length(smoji_manifest_url) <= 2048)`,
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("迁移站点表情包配置: %w", err)
			}
		}
		now := time.Now().UTC()
		if err := tx.Exec(`INSERT INTO schema_migrations (version, name, checksum, applied_at)
VALUES (?, ?, ?, ?)`, smojiSiteSchemaVersion, smojiSiteSchemaName,
			schemaChecksum(smojiSiteSchemaDefinition), now).Error; err != nil {
			return fmt.Errorf("记录 schema 版本 %d: %w", smojiSiteSchemaVersion, err)
		}
		return nil
	})
}

type legacyOutboxRow struct {
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

func rebuildNotificationOutboxWithTargets(tx *gorm.DB) error {
	if err := tx.Exec(`CREATE TABLE notification_outbox_v5 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('blogger_email_new', 'blogger_telegram_new', 'visitor_reply')),
  comment_id INTEGER NOT NULL,
  target TEXT NOT NULL CHECK (length(target) BETWEEN 1 AND 254),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  last_error_code TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  CONSTRAINT uq_notification_event UNIQUE (event_type, comment_id, target),
  CONSTRAINT fk_notification_comment FOREIGN KEY (comment_id) REFERENCES comments(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
)`).Error; err != nil {
		return fmt.Errorf("创建按目标拆分的通知队列: %w", err)
	}

	var rows []legacyOutboxRow
	if err := tx.Table("notification_outbox").Order("id ASC").Find(&rows).Error; err != nil {
		return fmt.Errorf("读取历史通知队列: %w", err)
	}
	emailRecipients, telegramTargets, err := loadNotificationTargets(tx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		targets := snapshotTargetsForLegacyOutbox(tx, row, emailRecipients, telegramTargets)
		for _, target := range targets {
			status := row.Status
			if target == legacyOutboxTarget && (status == "pending" || status == "failed" || status == "processing") {
				status = "cancelled"
			}
			if err := tx.Exec(`INSERT INTO notification_outbox_v5
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.EventType, row.CommentID, target, status, row.Attempts, row.AvailableAt,
				row.LockedAt, row.LastErrorCode, row.CreatedAt, row.UpdatedAt, row.SentAt,
			).Error; err != nil {
				return fmt.Errorf("拆分通知队列目标: %w", err)
			}
		}
	}
	if err := tx.Exec(`DROP TABLE notification_outbox`).Error; err != nil {
		return fmt.Errorf("替换历史通知队列: %w", err)
	}
	if err := tx.Exec(`ALTER TABLE notification_outbox_v5 RENAME TO notification_outbox`).Error; err != nil {
		return fmt.Errorf("启用按目标拆分的通知队列: %w", err)
	}
	if err := tx.Exec(`CREATE INDEX idx_notification_outbox_ready ON notification_outbox (status, available_at, id)`).Error; err != nil {
		return fmt.Errorf("重建通知队列索引: %w", err)
	}
	return nil
}

func loadNotificationTargets(tx *gorm.DB) ([]string, []string, error) {
	var emailRow struct {
		ConfigJSON string `gorm:"column:config_json"`
	}
	var telegramRow struct {
		ConfigJSON string `gorm:"column:config_json"`
	}
	if err := tx.Table("notification_settings").Where("channel = ?", "email").Take(&emailRow).Error; err != nil {
		return nil, nil, fmt.Errorf("读取邮件通知配置: %w", err)
	}
	if err := tx.Table("notification_settings").Where("channel = ?", "telegram").Take(&telegramRow).Error; err != nil {
		return nil, nil, fmt.Errorf("读取 Telegram 通知配置: %w", err)
	}
	var email struct {
		Recipients []string `json:"recipients"`
	}
	var telegram struct {
		Targets []string `json:"targets"`
	}
	_ = json.Unmarshal([]byte(emailRow.ConfigJSON), &email)
	_ = json.Unmarshal([]byte(telegramRow.ConfigJSON), &telegram)
	return uniqueNonEmpty(email.Recipients), uniqueNonEmpty(telegram.Targets), nil
}

func snapshotTargetsForLegacyOutbox(tx *gorm.DB, row legacyOutboxRow, emailRecipients, telegramTargets []string) []string {
	terminal := row.Status == "sent" || row.Status == "cancelled"
	switch row.EventType {
	case "blogger_email_new":
		if terminal || len(emailRecipients) == 0 {
			return []string{legacyOutboxTarget}
		}
		return emailRecipients
	case "blogger_telegram_new":
		if terminal || len(telegramTargets) == 0 {
			return []string{legacyOutboxTarget}
		}
		return telegramTargets
	case "visitor_reply":
		if terminal {
			return []string{legacyOutboxTarget}
		}
		var parentEmail *string
		err := tx.Raw(`SELECT parent.email
FROM comments AS child
JOIN comments AS parent ON parent.id = child.parent_id AND parent.site_id = child.site_id AND parent.mark = child.mark
WHERE child.id = ?`, row.CommentID).Scan(&parentEmail).Error
		if err != nil || parentEmail == nil || strings.TrimSpace(*parentEmail) == "" {
			return []string{legacyOutboxTarget}
		}
		return []string{strings.TrimSpace(*parentEmail)}
	default:
		return []string{legacyOutboxTarget}
	}
}

func uniqueNonEmpty(values []string) []string {
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
	return result
}

func validateCurrentSchema(database *gorm.DB) error {
	currentVersion, err := validateKnownSchemaHistory(database)
	if err != nil {
		return err
	}
	if currentVersion != LatestSchemaVersion {
		return fmt.Errorf("数据库 schema 版本 %d 未升级到 %d", currentVersion, LatestSchemaVersion)
	}
	for _, table := range []string{"sites", "site_origins", "comments", "notification_settings", "notification_outbox", "captcha_settings"} {
		exists, err := hasTable(database, table)
		if err != nil || !exists {
			return fmt.Errorf("数据库缺少当前 schema 表 %s", table)
		}
	}
	for _, column := range []string{"blogger_nickname", "blogger_email", "blogger_badge", "blogger_passphrase_hash", "smoji_enabled", "smoji_manifest_url"} {
		var count int64
		if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('sites') WHERE name = ?", column).Scan(&count).Error; err != nil || count != 1 {
			return fmt.Errorf("数据库缺少当前 schema 字段 sites.%s", column)
		}
	}
	var bloggerFlag int64
	if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name = ?", "is_blogger").Scan(&bloggerFlag).Error; err != nil || bloggerFlag != 1 {
		return fmt.Errorf("数据库缺少当前 schema 字段 comments.is_blogger")
	}
	var outboxTarget int64
	if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('notification_outbox') WHERE name = ?", "target").Scan(&outboxTarget).Error; err != nil || outboxTarget != 1 {
		return fmt.Errorf("数据库缺少当前 schema 字段 notification_outbox.target")
	}
	for _, column := range []string{"provider", "cap_instance_url", "cap_sitekey", "cap_secret_cipher"} {
		var count int64
		if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('captcha_settings') WHERE name = ?", column).Scan(&count).Error; err != nil || count != 1 {
			return fmt.Errorf("数据库缺少当前 schema 字段 captcha_settings.%s", column)
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
