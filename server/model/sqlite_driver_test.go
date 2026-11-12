package model

import (
	"path/filepath"
	"testing"
	"time"

	"ecoku-server/internal/testsite"
)

// legacyTimeLayout is how every released Ecoku version stored DATETIME columns.
// SQLite compares these TEXT values byte by byte, so a driver that writes any
// other layout would silently misorder new rows against existing ones.
const legacyTimeLayout = "2006-01-02 15:04:05.999999999-07:00"

func openDriverTestDatabase(t *testing.T) {
	t.Helper()
	database, err := OpenSQLiteDatabase(filepath.Join(t.TempDir(), "driver.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	if err := PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, database, testsite.Site{ID: "s", SiteURL: "https://s.example", AllowedOrigins: []string{"https://s.example"}})
	previous := DB
	DB = database
	t.Cleanup(func() {
		DB = previous
		_ = CloseSQLiteDatabase(database)
	})
}

func TestSQLiteDriverKeepsTheStoredTimeLayout(t *testing.T) {
	openDriverTestDatabase(t)
	for _, value := range []time.Time{
		time.Date(2026, 5, 1, 8, 30, 15, 123456789, time.FixedZone("CST", 8*3600)),
		time.Date(2026, 5, 1, 0, 30, 15, 0, time.UTC),
	} {
		comment := Comment{SiteID: "s", Mark: "/p", Username: "u", Content: "c", CreatedAt: value, UpdatedAt: value}
		if err := DB.Create(&comment).Error; err != nil {
			t.Fatal(err)
		}
		var stored string
		if err := DB.Raw("SELECT CAST(created_at AS BLOB) FROM comments WHERE id = ?", comment.ID).Row().Scan(&stored); err != nil {
			t.Fatal(err)
		}
		if want := value.Format(legacyTimeLayout); stored != want {
			t.Fatalf("stored created_at = %q, want %q", stored, want)
		}
	}
}

func TestSQLiteDriverReadsAndOrdersRowsFromEarlierReleases(t *testing.T) {
	openDriverTestDatabase(t)
	base := time.Date(2026, 5, 1, 8, 30, 15, 123456789, time.FixedZone("CST", 8*3600))
	// Rows written by an earlier driver, inserted as the exact stored text.
	for index, offset := range []time.Duration{0, 2 * time.Hour} {
		stamp := base.Add(offset).Format(legacyTimeLayout)
		if err := DB.Exec(`INSERT INTO comments (site_id, mark, page_title, username, content, is_blogger, created_at, updated_at)
VALUES ('s', '/p', '', 'u', ?, 0, ?, ?)`, []string{"legacy0", "legacy2"}[index], stamp, stamp).Error; err != nil {
			t.Fatal(err)
		}
	}
	current := Comment{SiteID: "s", Mark: "/p", Username: "u", Content: "current1", CreatedAt: base.Add(time.Hour), UpdatedAt: base}
	if err := DB.Create(&current).Error; err != nil {
		t.Fatal(err)
	}
	var comments []Comment
	if err := DB.Order("created_at ASC, id ASC").Find(&comments).Error; err != nil {
		t.Fatal(err)
	}
	want := []string{"legacy0", "current1", "legacy2"}
	if len(comments) != len(want) {
		t.Fatalf("rows=%d", len(comments))
	}
	for index, comment := range comments {
		if comment.Content != want[index] {
			t.Fatalf("order[%d]=%s want %s", index, comment.Content, want[index])
		}
	}
	if !comments[0].CreatedAt.Equal(base) || !comments[2].CreatedAt.Equal(base.Add(2*time.Hour)) {
		t.Fatalf("legacy times misread: %v %v", comments[0].CreatedAt, comments[2].CreatedAt)
	}
	var later int64
	if err := DB.Model(&Comment{}).Where("created_at > ?", base.Add(30*time.Minute)).Count(&later).Error; err != nil || later != 2 {
		t.Fatalf("time comparison across rows: %d %v", later, err)
	}
}
