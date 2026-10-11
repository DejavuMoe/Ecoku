package model

import (
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func TestEC13StartupRejectsStoredOriginOverlap(t *testing.T) {
	previousConfig, previousDB := config.GlobalConfig, DB
	t.Cleanup(func() { config.GlobalConfig, DB = previousConfig, previousDB })
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "stored.sqlite3")
	config.GlobalConfig.Paths.SQLitePath = path
	if err := InitDatabase(); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, DB, exampleSite)
	before, err := GetSite("site-a")
	if err != nil {
		t.Fatal(err)
	}
	if err := CloseDatabase(); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://example.test"}
	err = InitDatabase()
	if err == nil {
		t.Error("EC-13: startup accepted admin origin overlapping a database-only site")
	} else if !strings.Contains(err.Error(), "来源") {
		t.Errorf("unexpected startup failure: %v", err)
	}
	if DB != nil {
		_ = CloseDatabase()
	}
	database, err := OpenSQLiteDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	afterRejected, err := getSite(database, "site-a")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, afterRejected) {
		t.Fatalf("startup rewrote stored site: %+v", afterRejected)
	}
	_ = CloseSQLiteDatabase(database)
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://admin.example"}
	if err := InitDatabase(); err != nil {
		t.Fatal(err)
	}
	after, err := GetSite("site-a")
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatalf("startup changed database-owned site: %v", err)
	}
	if err := CloseDatabase(); err != nil {
		t.Fatal(err)
	}
}

func TestEC13ReviewLegacyIPv6StartupConflict(t *testing.T) {
	previousConfig, previousDB := config.GlobalConfig, DB
	t.Cleanup(func() { config.GlobalConfig, DB = previousConfig, previousDB })
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Paths.SQLitePath = filepath.Join(t.TempDir(), "ipv6.sqlite3")
	if err := InitDatabase(); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, DB, exampleSite)
	const storedOrigin = "https://[0:0:0:0:0:0:0:1]:08443"
	if err := DB.Exec("UPDATE site_origins SET origin = ?", storedOrigin).Error; err != nil {
		t.Fatal(err)
	}
	if err := CloseDatabase(); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://[::1]:8443"}
	if err := InitDatabase(); err == nil {
		t.Error("EC-13 review: startup accepted expanded legacy IPv6 overlap")
		_ = CloseDatabase()
	} else if !strings.Contains(err.Error(), "来源") {
		t.Errorf("unexpected startup error: %v", err)
	}
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://[::1]:9443"}
	if err := InitDatabase(); err != nil {
		t.Fatalf("distinct IPv6 port rejected: %v", err)
	}
	site, err := GetSite("site-a")
	if err != nil || len(site.AllowedOrigins) != 1 || site.AllowedOrigins[0] != storedOrigin {
		t.Errorf("startup rewrote legacy origin: %+v %v", site.AllowedOrigins, err)
	}
	if err := CloseDatabase(); err != nil {
		t.Fatal(err)
	}
}

func TestEC13StartupRejectsLegacyDefaultPortOverlap(t *testing.T) {
	previousConfig, previousDB := config.GlobalConfig, DB
	t.Cleanup(func() { config.GlobalConfig, DB = previousConfig, previousDB })
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{"https://admin.example"}}}); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Paths.SQLitePath = filepath.Join(t.TempDir(), "legacy.sqlite3")
	if err := InitDatabase(); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, DB, exampleSite)
	if err := DB.Exec("UPDATE site_origins SET origin = 'https://example.test:00443'").Error; err != nil {
		t.Fatal(err)
	}
	if err := CloseDatabase(); err != nil {
		t.Fatal(err)
	}
	config.GlobalConfig.Admin.AllowedOrigins = []string{"https://example.test"}
	if err := InitDatabase(); err == nil {
		_ = CloseDatabase()
		t.Fatal("legacy default-port overlap accepted")
	}
}

func TestEC14FreshSeedFailureIsAtomic(t *testing.T) {
	previous := config.GlobalConfig
	t.Cleanup(func() { config.GlobalConfig = previous })
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{ID: "seed", SiteURL: "https://seed.example", AllowedOrigins: []string{"https://seed.example"}, Locale: "en"}}}); err != nil {
		t.Fatal(err)
	}
	database, err := OpenSQLiteDatabase(filepath.Join(t.TempDir(), "atomic.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = CloseSQLiteDatabase(database) })
	if err := database.Callback().Raw().Before("gorm:raw").Register("ec14:fail-seed", func(tx *gorm.DB) {
		if strings.HasPrefix(tx.Statement.SQL.String(), "UPDATE sites SET i18n_locale") {
			tx.AddError(fmt.Errorf("EC-14 fixture seed failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err == nil {
		t.Fatal("seed failure ignored")
	}
	empty, err := isDatabaseEmpty(database)
	if err != nil || !empty {
		t.Fatalf("failed seed persisted partial database: empty=%t err=%v", empty, err)
	}
	if err := database.Callback().Raw().Remove("ec14:fail-seed"); err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	site, err := getSite(database, "seed")
	if err != nil || site.Locale != "en" {
		t.Fatalf("retry lost seed locale: %q %v", site.Locale, err)
	}
}

func TestEC14FreshSeedLocale(t *testing.T) {
	for _, locale := range []string{"en", "zh-Hant", ""} {
		t.Run(locale, func(t *testing.T) {
			previous := config.GlobalConfig
			t.Cleanup(func() { config.GlobalConfig = previous })
			if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{{ID: "seed", SiteURL: "https://seed.example", AllowedOrigins: []string{"https://seed.example"}, Locale: locale}}}); err != nil {
				t.Fatal(err)
			}
			database, err := OpenSQLiteDatabase(filepath.Join(t.TempDir(), "seed.sqlite3"))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = CloseSQLiteDatabase(database) })
			if err := PrepareDatabaseForStartup(database); err != nil {
				t.Fatal(err)
			}
			site, err := getSite(database, "seed")
			if err != nil {
				t.Fatal(err)
			}
			if want := string(config.NormalizeLocale(locale)); site.Locale != want {
				t.Errorf("EC-14: fresh seed locale=%q, want %q", site.Locale, want)
			}
			if err := database.Exec("UPDATE sites SET i18n_locale = 'zh-Hant' WHERE id = 'seed'").Error; err != nil {
				t.Fatal(err)
			}
			config.GlobalConfig.Sites[0].Locale = "en"
			if err := PrepareDatabaseForStartup(database); err != nil {
				t.Fatal(err)
			}
			site, err = getSite(database, "seed")
			if err != nil || site.Locale != "zh-Hant" {
				t.Fatalf("restart overwrote locale: %q, %v", site.Locale, err)
			}
		})
	}
}
