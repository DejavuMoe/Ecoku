package model

import (
	"context"
	"testing"
)

func openPooledTestDatabase(t *testing.T) string {
	t.Helper()
	path := t.TempDir() + "/pool.sqlite3"
	database, err := OpenSQLiteDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)").Error; err != nil {
		t.Fatal(err)
	}
	previous := DB
	DB = database
	if err := AttachReadPool(database, path); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = DetachReadPool()
		DB = previous
		_ = CloseSQLiteDatabase(database)
	})
	return path
}

func TestReadPoolIsReadOnlyAndSeesCommits(t *testing.T) {
	openPooledTestDatabase(t)
	reader := ReadDB()
	if reader == DB {
		t.Fatal("ReadDB fell back to the writer")
	}
	if err := reader.Exec("INSERT INTO notes (body) VALUES ('x')").Error; err == nil {
		t.Fatal("read pool accepted a write")
	}
	before, ok, err := CurrentDataStamp(context.Background())
	if err != nil || !ok {
		t.Fatalf("stamp: ok=%v err=%v", ok, err)
	}
	if err := DB.Exec("INSERT INTO notes (body) VALUES ('y')").Error; err != nil {
		t.Fatal(err)
	}
	after, _, err := CurrentDataStamp(context.Background())
	if err != nil || after == before {
		t.Fatalf("data_version did not move after a commit: %v", err)
	}
	var count int64
	if err := reader.Table("notes").Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("reader count=%d err=%v", count, err)
	}
}

func TestReadDBFallsBackWhenDBIsSwapped(t *testing.T) {
	openPooledTestDatabase(t)
	other, err := OpenSQLiteDatabase(t.TempDir() + "/other.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	defer CloseSQLiteDatabase(other)
	pooled := DB
	DB = other
	defer func() { DB = pooled }()
	if ReadDB() != other {
		t.Fatal("ReadDB returned a pool owned by another database")
	}
	if _, ok, _ := CurrentDataStamp(context.Background()); ok {
		t.Fatal("caching enabled without a matching pool")
	}
}

func TestVersionedCacheDropsOtherStamps(t *testing.T) {
	cache := NewVersionedCache[string, int](2, 10)
	first := DataStamp{pool: 1, version: 1}
	cache.Put(first, "a", 1, 4)
	if value, ok := cache.Get(first, "a"); !ok || value != 1 {
		t.Fatal("missing value")
	}
	if _, ok := cache.Get(DataStamp{pool: 2, version: 1}, "a"); ok {
		t.Fatal("stamp from another pool hit")
	}
	cache.Put(DataStamp{pool: 1, version: 2}, "b", 2, 4)
	if _, ok := cache.Get(first, "a"); ok {
		t.Fatal("older stamp survived a newer store")
	}
	cache.Put(DataStamp{pool: 1, version: 2}, "huge", 3, 11)
	if _, ok := cache.Get(DataStamp{pool: 1, version: 2}, "huge"); ok {
		t.Fatal("entry above the cost bound was stored")
	}
}
