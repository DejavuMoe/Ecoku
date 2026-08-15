package importer

import (
	"context"
	"strings"
	"testing"
	"time"

	"ecoku-server/model"
)

func twikooTestDatabase(t *testing.T) {
	t.Helper()
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/twikoo.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if err := database.Exec(`INSERT INTO sites
(id, site_url, domain, name, default_sort, email_required, website_required, placeholder, comment_limit, empty_message, revision, created_at, updated_at)
VALUES ('blog', 'https://blog.example.test', 'blog.example.test', 'Blog', 'newest', 1, 0, '写下评论', 1000, '还没有评论', 1, ?, ?)`, now, now).Error; err != nil {
		t.Fatal(err)
	}
	model.DB = database
	t.Cleanup(func() {
		sqlDatabase, _ := database.DB()
		_ = sqlDatabase.Close()
		model.DB = nil
	})
}

func TestImportTwikooPreservesHierarchyIdentityAndPlainText(t *testing.T) {
	twikooTestDatabase(t)
	fixture := `[
 {"_id":"root","url":"/posts/example/","nick":"Alice","mail":"alice@example.test","link":"example.test","comment":"<p>Hello <strong>world</strong></p><script>alert(1)</script>","created":1710000000000,"updated":1710000000000},
 {"_id":"child","pid":"root","rid":"root","url":"/posts/example/","nick":"Bob","mail":"bob@example.test","comment":"<p>First line<br>Second line</p>","created":1710000001000,"updated":1710000001000},
 {"_id":"grandchild","pid":"child","rid":"root","url":"/posts/example/","nick":"Carol","comment":"<p>Third level</p>","created":1710000002000,"updated":1710000002000}
]`
	result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Imported != 3 || result.Roots != 1 || result.Replies != 2 || result.Emails != 2 || result.Websites != 1 || result.DistinctPages != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
	var comments []model.Comment
	if err := model.DB.Order("id ASC").Find(&comments).Error; err != nil {
		t.Fatal(err)
	}
	if len(comments) != 3 || comments[1].ParentID == nil || *comments[1].ParentID != comments[0].ID || comments[2].ParentID == nil || *comments[2].ParentID != comments[1].ID {
		t.Fatalf("hierarchy was not preserved: %+v", comments)
	}
	if comments[0].Content != "Hello world" || strings.Contains(comments[0].Content, "alert") {
		t.Fatalf("HTML was not converted safely: %q", comments[0].Content)
	}
	if comments[1].Content != "First line\nSecond line" || comments[0].Email == nil || *comments[0].Email != "alice@example.test" {
		t.Fatalf("retained fields differ: %+v", comments)
	}
	if comments[0].URL == nil || *comments[0].URL != "https://example.test" {
		t.Fatalf("website was not normalized: %+v", comments[0].URL)
	}
}

func TestImportTwikooStripsQueryAndFragmentFromPageKey(t *testing.T) {
	twikooTestDatabase(t)
	fixture := `[{"_id":"one","url":"https://blog.example.test/posts/example/?utm=1#section","nick":"Alice","comment":"<p>Hello</p>","created":1710000000000}]`
	result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Imported != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
	var comment model.Comment
	if err := model.DB.First(&comment).Error; err != nil {
		t.Fatal(err)
	}
	if comment.Mark != "/posts/example/" {
		t.Fatalf("page key=%q", comment.Mark)
	}
}

func TestImportTwikooRequiresEmptySiteAndDryRunRollsBack(t *testing.T) {
	twikooTestDatabase(t)
	fixture := `[{"_id":"one","url":"/","nick":"Alice","mail":"alice@example.test","comment":"<p>Hello</p>","created":1710000000000}]`
	result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog", DryRun: true})
	if err != nil || result.Imported != 1 {
		t.Fatalf("dry run failed: result=%+v err=%v", result, err)
	}
	var count int64
	if err := model.DB.Table("comments").Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("dry run wrote comments: count=%d err=%v", count, err)
	}
	if _, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog"}); err != nil {
		t.Fatal(err)
	}
	if _, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog"}); err == nil {
		t.Fatal("expected non-empty destination to be rejected")
	}
}

func TestImportTwikooKeepsOrphanAsRoot(t *testing.T) {
	twikooTestDatabase(t)
	fixture := `[{"_id":"orphan","pid":"missing","rid":"missing","url":"/lost/","nick":"Alice","comment":"<p>Still here</p>","created":1710000000000}]`
	result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(fixture), TwikooImportOptions{SiteID: "blog"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Orphaned != 1 {
		t.Fatalf("expected one orphan, got %+v", result)
	}
	var comment model.Comment
	if err := model.DB.First(&comment).Error; err != nil || comment.ParentID != nil {
		t.Fatalf("orphan was not retained as a root: %+v err=%v", comment, err)
	}
}
