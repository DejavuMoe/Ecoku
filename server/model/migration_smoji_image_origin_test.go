package model

import (
	"ecoku-server/internal/testsite"
	"reflect"
	"testing"

	"gorm.io/gorm"
)

func TestV10ToV11PreservesSmojiAndRollsBackOnFailure(t *testing.T) {
	database, err := OpenSQLiteDatabase(t.TempDir() + "/v10.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := database.DB()
	t.Cleanup(func() { _ = sqlDB.Close() })
	for _, migrate := range []func(*gorm.DB) error{createFreshSchema, migrateSiteBloggerIdentity, migrateSiteBloggerBadge, migrateTurnstileSettings, migrateBloggerProofAndOutboxTargets, migrateCaptchaProvider, migrateSiteSmoji, migrateAdminSessions, migrateOutboxDeliveryState, migrateAdminAccount} {
		if err := migrate(database); err != nil {
			t.Fatal(err)
		}
	}
	testsite.Create(t, database, exampleSite)
	if err := database.Exec(`UPDATE sites SET smoji_enabled = 1, smoji_manifest_url = 'https://cdn.example/smoji.json' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}
	var before []schemaMigration
	if err := database.Table("schema_migrations").Order("version").Find(&before).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec(`CREATE TRIGGER fail_v11 BEFORE INSERT ON schema_migrations WHEN NEW.version = 11 BEGIN SELECT RAISE(ABORT,'fixture'); END`).Error; err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err == nil {
		t.Fatal("migration failure ignored")
	}
	var column int64
	if err := database.Raw("SELECT COUNT(*) FROM pragma_table_info('sites') WHERE name = 'smoji_image_origin'").Scan(&column).Error; err != nil || column != 0 {
		t.Fatalf("failed migration left column: %d, %v", column, err)
	}
	if err := database.Exec("DROP TRIGGER fail_v11").Error; err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := PrepareDatabaseForStartup(database); err != nil {
			t.Fatal(err)
		}
	}
	var site Site
	if err := database.First(&site, "id = ?", "site-a").Error; err != nil {
		t.Fatal(err)
	}
	if !site.SmojiEnabled || site.SmojiManifestURL != "https://cdn.example/smoji.json" || site.SmojiImageOrigin != "" || site.SmojiOrigin() != "https://cdn.example" {
		t.Fatalf("legacy configuration changed: %#v", site)
	}
	if site.Locale != "zh-CN" {
		t.Fatalf("default site locale changed: %q", site.Locale)
	}
	var after []schemaMigration
	if err := database.Table("schema_migrations").Where("version <= 10").Order("version").Find(&after).Error; err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, after) {
		t.Fatal("released history changed")
	}
	var count int64
	if err := database.Table("schema_migrations").Where("version = 11").Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("v11 history: %d, %v", count, err)
	}
	if err := database.Table("schema_migrations").Where("version = 12").Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("v12 history: %d, %v", count, err)
	}
}
