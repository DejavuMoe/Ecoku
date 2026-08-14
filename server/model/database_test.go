package model

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func TestOpenSQLiteDatabaseConfiguresWALAndSafetyPragmas(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.sqlite3")
	database, err := OpenSQLiteDatabase(path)
	if err != nil {
		t.Fatal(err)
	}

	assertSQLiteRuntimePragmas(t, database)
	if err := database.Exec("CREATE TABLE wal_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)").Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Exec("INSERT INTO wal_probe (value) VALUES (?)", "persisted").Error; err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path + "-wal"); err != nil {
		t.Fatalf("WAL sidecar missing before close: %v", err)
	}
	if err := CloseSQLiteDatabase(database); err != nil {
		t.Fatal(err)
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		if _, err := os.Stat(path + suffix); !os.IsNotExist(err) {
			t.Fatalf("SQLite sidecar remains after graceful close: %s err=%v", suffix, err)
		}
	}

	reopened, err := OpenSQLiteDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = CloseSQLiteDatabase(reopened) })
	assertSQLiteRuntimePragmas(t, reopened)

	var value string
	if err := reopened.Raw("SELECT value FROM wal_probe WHERE id = 1").Scan(&value).Error; err != nil {
		t.Fatal(err)
	}
	if value != "persisted" {
		t.Fatalf("reopened database lost data: %q", value)
	}
}

func assertSQLiteRuntimePragmas(t *testing.T, database *gorm.DB) {
	t.Helper()
	var journalMode string
	var busyTimeout, synchronous, foreignKeys int
	if err := database.Raw("PRAGMA journal_mode").Scan(&journalMode).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Raw("PRAGMA busy_timeout").Scan(&busyTimeout).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Raw("PRAGMA synchronous").Scan(&synchronous).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Raw("PRAGMA foreign_keys").Scan(&foreignKeys).Error; err != nil {
		t.Fatal(err)
	}
	if !strings.EqualFold(journalMode, "wal") || busyTimeout != sqliteBusyTimeoutMilliseconds || synchronous != 1 || foreignKeys != 1 {
		t.Fatalf("unexpected SQLite pragmas: journal_mode=%q busy_timeout=%d synchronous=%d foreign_keys=%d", journalMode, busyTimeout, synchronous, foreignKeys)
	}
}
