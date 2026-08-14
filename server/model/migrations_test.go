package model

import (
	"ecoku-server/config"
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
