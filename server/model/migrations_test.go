package model

import (
	"ecoku-server/config"
	"reflect"
	"strings"
	"testing"
	"time"
)

func freshTestDatabase(t *testing.T) {
	t.Helper()
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/fresh.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previous := DB
	DB = database
	t.Cleanup(func() { DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
}

func TestV1DatabaseMigratesInPlaceWithoutLosingBusinessData(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/v1.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, _ := database.DB()
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := createFreshSchema(database); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 14, 1, 2, 3, 0, time.UTC)
	if err := database.Exec(`INSERT INTO comments
  (site_id, mark, page_title, parent_id, username, email, url, content, deleted_at, created_at, updated_at)
  VALUES ('site-a', '/post', '文章', NULL, '访客', 'reader@example.test', 'https://reader.example.test', '保留正文', NULL, ?, ?)`, now, now).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`UPDATE notification_settings SET enabled = 1, config_json = '{"recipients":["owner@example.test"]}', secret_cipher = X'010203', revision = 7 WHERE channel = 'email'`).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES ('blogger_email_new', 1, 'failed', 2, ?, NULL, 'smtp_failed', ?, ?, NULL)`, now, now, now).Error; err != nil {
		t.Fatal(err)
	}

	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("migrate v1 to current: %v", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("repeat current startup: %v", err)
	}

	type migratedComment struct {
		Username string
		Email    string
		URL      string
		Content  string
	}
	var comment migratedComment
	if err := database.Raw(`SELECT username, email, url, content FROM comments WHERE id = 1`).Scan(&comment).Error; err != nil {
		t.Fatal(err)
	}
	if comment != (migratedComment{Username: "访客", Email: "reader@example.test", URL: "https://reader.example.test", Content: "保留正文"}) {
		t.Fatalf("comment changed during migration: %#v", comment)
	}
	var site Site
	if err := database.Where("id = ?", "site-a").First(&site).Error; err != nil {
		t.Fatal(err)
	}
	if site.Name != "Example" || site.BloggerNickname != "" || site.BloggerEmail != "" || site.BloggerBadge != DefaultBloggerBadge {
		t.Fatalf("site migration mismatch: %#v", site)
	}
	var setting struct {
		Enabled      bool
		ConfigJSON   string `gorm:"column:config_json"`
		SecretCipher []byte `gorm:"column:secret_cipher"`
		Revision     uint
	}
	if err := database.Table("notification_settings").Where("channel = 'email'").First(&setting).Error; err != nil {
		t.Fatal(err)
	}
	if !setting.Enabled || setting.ConfigJSON != `{"recipients":["owner@example.test"]}` || !reflect.DeepEqual(setting.SecretCipher, []byte{1, 2, 3}) || setting.Revision != 7 {
		t.Fatalf("notification settings changed: %#v", setting)
	}
	var outboxCount int64
	database.Table("notification_outbox").Where("comment_id = 1 AND status = 'failed' AND attempts = 2 AND last_error_code = 'smtp_failed'").Count(&outboxCount)
	if outboxCount != 1 {
		t.Fatal("notification outbox row was not preserved")
	}
	var versions []int
	if err := database.Table("schema_migrations").Order("version ASC").Pluck("version", &versions).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(versions, []int{1, 2, 3, 4, 5, 6}) {
		t.Fatalf("migration history mismatch: %v", versions)
	}
	var turnstileCount int64
	database.Table("captcha_settings").Where("id = 1 AND enabled = 0 AND provider = 'turnstile' AND sitekey = ''").Count(&turnstileCount)
	if turnstileCount != 1 {
		t.Fatal("turnstile settings were not initialized")
	}
}

func TestFailedV2MigrationDoesNotRecordCompletion(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/failed-v2.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, _ := database.DB()
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := createFreshSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`ALTER TABLE sites ADD COLUMN blogger_nickname TEXT NOT NULL DEFAULT ''`).Error; err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err == nil {
		t.Fatal("partially incompatible v1 schema was accepted")
	}
	var version2 int64
	database.Table("schema_migrations").Where("version = 2").Count(&version2)
	if version2 != 0 {
		t.Fatal("failed migration was recorded as complete")
	}
	var bloggerEmail int64
	database.Raw("SELECT COUNT(*) FROM pragma_table_info('sites') WHERE name = 'blogger_email'").Scan(&bloggerEmail)
	if bloggerEmail != 0 {
		t.Fatal("failed migration left a partial blogger_email column")
	}
}

func TestV2DatabaseMigratesBloggerBadgeInPlace(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/v2.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, _ := database.DB()
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := createFreshSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateSiteBloggerIdentity(database); err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}

	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("migrate v2 to current: %v", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("repeat current startup: %v", err)
	}

	var site Site
	if err := database.Where("id = ?", "site-a").First(&site).Error; err != nil {
		t.Fatal(err)
	}
	if site.BloggerNickname != "站长" || site.BloggerEmail != "owner@example.test" || site.BloggerBadge != DefaultBloggerBadge {
		t.Fatalf("blogger badge migration mismatch: %#v", site)
	}
	var versions []int
	if err := database.Table("schema_migrations").Order("version ASC").Pluck("version", &versions).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(versions, []int{1, 2, 3, 4, 5, 6}) {
		t.Fatalf("migration history mismatch: %v", versions)
	}
	var turnstileCount int64
	database.Table("captcha_settings").Where("id = 1 AND enabled = 0 AND provider = 'turnstile' AND sitekey = ''").Count(&turnstileCount)
	if turnstileCount != 1 {
		t.Fatal("turnstile settings were not initialized")
	}
}

func TestV3DatabaseMigratesTurnstileSettingsInPlace(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/v3.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, _ := database.DB()
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := createFreshSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateSiteBloggerIdentity(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateSiteBloggerBadge(database); err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test', blogger_badge = '[OP]' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}

	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("migrate v3 to current: %v", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("repeat current startup: %v", err)
	}

	var site Site
	if err := database.Where("id = ?", "site-a").First(&site).Error; err != nil {
		t.Fatal(err)
	}
	if site.BloggerNickname != "站长" || site.BloggerEmail != "owner@example.test" || site.BloggerBadge != "[OP]" {
		t.Fatalf("v3 data changed during v4 migration: %#v", site)
	}
	var enabled int
	var sitekey string
	var revision int
	if err := database.Raw(`SELECT enabled, sitekey, revision FROM captcha_settings WHERE id = 1`).Row().Scan(&enabled, &sitekey, &revision); err != nil {
		t.Fatal(err)
	}
	if enabled != 0 || sitekey != "" || revision != 1 {
		t.Fatalf("turnstile defaults mismatch enabled=%d sitekey=%q revision=%d", enabled, sitekey, revision)
	}
	var versions []int
	if err := database.Table("schema_migrations").Order("version ASC").Pluck("version", &versions).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(versions, []int{1, 2, 3, 4, 5, 6}) {
		t.Fatalf("migration history mismatch: %v", versions)
	}
}

func TestFreshSchemaInitializesAndIsRepeatable(t *testing.T) {
	freshTestDatabase(t)
	if err := PrepareDatabaseForStartup(DB); err != nil {
		t.Fatalf("repeat startup: %v", err)
	}
	for _, table := range []string{"sites", "site_origins", "comments", "notification_settings", "notification_outbox", "captcha_settings"} {
		if ok, err := hasTable(DB, table); err != nil || !ok {
			t.Fatalf("missing %s: %v", table, err)
		}
	}
	var statusColumn, triggerColumn int64
	DB.Raw("SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name = 'status'").Scan(&statusColumn)
	DB.Raw("SELECT COUNT(*) FROM pragma_table_info('notification_settings') WHERE name = 'trigger_mode'").Scan(&triggerColumn)
	if statusColumn != 0 || triggerColumn != 0 {
		t.Fatalf("legacy columns remain: status=%d trigger=%d", statusColumn, triggerColumn)
	}
	var bloggerFlag, outboxTarget int64
	DB.Raw("SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name = 'is_blogger'").Scan(&bloggerFlag)
	DB.Raw("SELECT COUNT(*) FROM pragma_table_info('notification_outbox') WHERE name = 'target'").Scan(&outboxTarget)
	if bloggerFlag != 1 || outboxTarget != 1 {
		t.Fatalf("v5 columns missing is_blogger=%d target=%d", bloggerFlag, outboxTarget)
	}
}

func TestOldOrUnknownSchemaIsRejected(t *testing.T) {
	database, err := OpenSQLiteDatabase(t.TempDir() + "/old.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, err := database.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := database.Exec("CREATE TABLE comments (id INTEGER PRIMARY KEY, status INTEGER)").Error; err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err == nil {
		t.Fatal("old unversioned database accepted")
	}
	_ = database.Exec("DROP TABLE comments").Error
	if err := database.Exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, checksum TEXT, applied_at DATETIME)").Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec("INSERT INTO schema_migrations VALUES (99, 'future', 'x', ?)", time.Now()).Error; err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err == nil {
		t.Fatal("future database accepted")
	}
}

func TestFreshCommentScopeAndTombstoneConstraints(t *testing.T) {
	freshTestDatabase(t)
	root := Comment{SiteID: "site-a", Mark: "/post", PageTitle: "文章", Username: "访客", Content: "正文", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := DB.Create(&root).Error; err != nil {
		t.Fatal(err)
	}
	child := Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "回复", Content: "内容", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := DB.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	wrong := child
	wrong.ID = 0
	wrong.Mark = "/other"
	if err := DB.Create(&wrong).Error; err == nil {
		t.Fatal("cross-page parent accepted")
	}
	deleted := time.Now()
	root.DeletedAt = &deleted
	root.Username = ""
	root.Email = nil
	root.URL = nil
	root.Content = ""
	if err := DB.Save(&root).Error; err != nil {
		t.Fatalf("privacy tombstone: %v", err)
	}
}

func TestV4DatabaseMigratesBloggerProofOutboxTargetsAndBackfill(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(t.TempDir() + "/v4.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase, _ := database.DB()
	t.Cleanup(func() { _ = sqlDatabase.Close() })
	if err := createFreshSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateSiteBloggerIdentity(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateSiteBloggerBadge(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateTurnstileSettings(database); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 15, 1, 2, 3, 0, time.UTC)
	if err := database.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`INSERT INTO comments
  (site_id, mark, page_title, parent_id, username, email, url, content, deleted_at, created_at, updated_at)
  VALUES ('site-a', '/post', '文章', NULL, '站长', 'OWNER@example.test', NULL, '历史博主', NULL, ?, ?),
         ('site-a', '/post', '文章', NULL, '访客', 'reader@example.test', NULL, '访客', NULL, ?, ?)`, now, now, now, now).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`UPDATE notification_settings
  SET enabled = 1, config_json = '{"recipients":["owner@example.test","ops@example.test"]}'
  WHERE channel = 'email'`).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES ('blogger_email_new', 1, 'pending', 0, ?, NULL, NULL, ?, ?, NULL),
         ('blogger_telegram_new', 1, 'sent', 1, ?, NULL, NULL, ?, ?, ?)`, now, now, now, now, now, now, now).Error; err != nil {
		t.Fatal(err)
	}

	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("migrate v4 to v5: %v", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("repeat v5 startup: %v", err)
	}

	var flagged, guest int
	if err := database.Raw(`SELECT is_blogger FROM comments WHERE content = '历史博主'`).Scan(&flagged).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Raw(`SELECT is_blogger FROM comments WHERE content = '访客'`).Scan(&guest).Error; err != nil {
		t.Fatal(err)
	}
	if flagged != 1 || guest != 0 {
		t.Fatalf("backfill mismatch flagged=%d guest=%d", flagged, guest)
	}
	var pending []string
	if err := database.Table("notification_outbox").Where("event_type = 'blogger_email_new' AND status = 'pending'").Order("target ASC").Pluck("target", &pending).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(pending, []string{"ops@example.test", "owner@example.test"}) {
		t.Fatalf("pending targets=%v", pending)
	}
	var sentTarget string
	if err := database.Raw(`SELECT target FROM notification_outbox WHERE event_type = 'blogger_telegram_new' AND status = 'sent'`).Scan(&sentTarget).Error; err != nil {
		t.Fatal(err)
	}
	if sentTarget != "*" {
		t.Fatalf("terminal outbox target=%q", sentTarget)
	}
	var versions []int
	if err := database.Table("schema_migrations").Order("version ASC").Pluck("version", &versions).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(versions, []int{1, 2, 3, 4, 5, 6}) {
		t.Fatalf("migration history mismatch: %v", versions)
	}
}

func TestV5CaptchaProviderMigrationPreservesTurnstileState(t *testing.T) {
	t.Setenv("ECOKU_MODEL_SITE_KEY", strings.Repeat("m", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{
		ID: "site-a", SiteURL: "https://example.test", AllowedOrigins: []string{"https://example.test"},
		ManagementKeyEnv: "ECOKU_MODEL_SITE_KEY", Name: "Example",
	}}}); err != nil {
		t.Fatal(err)
	}

	for _, fixture := range []struct {
		name    string
		enabled bool
	}{
		{name: "enabled", enabled: true},
		{name: "disabled", enabled: false},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			database, err := OpenSQLiteDatabase(t.TempDir() + "/v5.sqlite3")
			if err != nil {
				t.Fatal(err)
			}
			sqlDatabase, _ := database.DB()
			t.Cleanup(func() { _ = sqlDatabase.Close() })
			if err := createFreshSchema(database); err != nil {
				t.Fatal(err)
			}
			if err := migrateSiteBloggerIdentity(database); err != nil {
				t.Fatal(err)
			}
			if err := migrateSiteBloggerBadge(database); err != nil {
				t.Fatal(err)
			}
			if err := migrateTurnstileSettings(database); err != nil {
				t.Fatal(err)
			}
			if err := migrateBloggerProofAndOutboxTargets(database); err != nil {
				t.Fatal(err)
			}
			if err := database.Exec(`UPDATE turnstile_settings
SET enabled = ?, sitekey = 'legacy-public', secret_cipher = X'010203', revision = 7
WHERE id = 1`, fixture.enabled).Error; err != nil {
				t.Fatal(err)
			}

			if err := PrepareDatabaseForStartup(database); err != nil {
				t.Fatalf("migrate v5 to v6: %v", err)
			}
			var row struct {
				Enabled         bool
				Provider        string
				Sitekey         string
				SecretCipher    []byte `gorm:"column:secret_cipher"`
				CapInstanceURL  string `gorm:"column:cap_instance_url"`
				CapSitekey      string `gorm:"column:cap_sitekey"`
				CapSecretCipher []byte `gorm:"column:cap_secret_cipher"`
				Revision        uint
			}
			if err := database.Table("captcha_settings").Where("id = 1").First(&row).Error; err != nil {
				t.Fatal(err)
			}
			if row.Enabled != fixture.enabled || row.Provider != "turnstile" || row.Sitekey != "legacy-public" || !reflect.DeepEqual(row.SecretCipher, []byte{1, 2, 3}) || row.Revision != 7 {
				t.Fatalf("legacy Turnstile settings changed: %#v", row)
			}
			if row.CapInstanceURL != "" || row.CapSitekey != "" || len(row.CapSecretCipher) != 0 {
				t.Fatalf("Cap defaults mismatch: %#v", row)
			}
			if exists, err := hasTable(database, "turnstile_settings"); err != nil || exists {
				t.Fatalf("legacy table still exists: exists=%t err=%v", exists, err)
			}
			var versions []int
			if err := database.Table("schema_migrations").Order("version ASC").Pluck("version", &versions).Error; err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(versions, []int{1, 2, 3, 4, 5, 6}) {
				t.Fatalf("migration history mismatch: %v", versions)
			}
		})
	}
}
