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
		t.Fatalf("migrate v1 to v2: %v", err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatalf("repeat v2 startup: %v", err)
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
	if site.Name != "Example" || site.BloggerNickname != "" || site.BloggerEmail != "" {
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
	if !reflect.DeepEqual(versions, []int{1, 2}) {
		t.Fatalf("migration history mismatch: %v", versions)
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

func TestFreshSchemaInitializesAndIsRepeatable(t *testing.T) {
	freshTestDatabase(t)
	if err := PrepareDatabaseForStartup(DB); err != nil {
		t.Fatalf("repeat startup: %v", err)
	}
	for _, table := range []string{"sites", "site_origins", "comments", "notification_settings", "notification_outbox"} {
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
