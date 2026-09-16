package importer

import (
	"context"
	"encoding/json"
	"fmt"
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
	if result.Orphaned != 1 || result.Roots != 1 || result.Replies != 0 {
		t.Fatalf("expected one orphan, got %+v", result)
	}
	var comment model.Comment
	if err := model.DB.First(&comment).Error; err != nil || comment.ParentID != nil {
		t.Fatalf("orphan was not retained as a root: %+v err=%v", comment, err)
	}
}

func TestImportTwikooUnorderedHierarchy(t *testing.T) {
	for _, order := range [][]int{{0, 1, 2}, {0, 2, 1}, {1, 0, 2}, {1, 2, 0}, {2, 0, 1}, {2, 1, 0}} {
		t.Run(fmt.Sprint(order), func(t *testing.T) {
			twikooTestDatabase(t)
			rows := []twikooComment{
				{ObjectID: "root", PageKey: "/", Nickname: "root", Content: "root"},
				{ObjectID: "child", ParentID: "root", RootID: "root", PageKey: "/", Nickname: "child", Content: "child"},
				{ObjectID: "grandchild", ParentID: "child", RootID: "root", PageKey: "/", Nickname: "grandchild", Content: "grandchild"},
			}
			data, err := json.Marshal([]twikooComment{rows[order[0]], rows[order[1]], rows[order[2]]})
			if err != nil {
				t.Fatal(err)
			}
			result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(string(data)), TwikooImportOptions{SiteID: "blog"})
			if err != nil {
				t.Fatal(err)
			}
			var child, grandchild model.Comment
			if err := model.DB.Where("username = ?", "child").First(&child).Error; err != nil {
				t.Fatal(err)
			}
			if err := model.DB.Where("username = ?", "grandchild").First(&grandchild).Error; err != nil {
				t.Fatal(err)
			}
			if grandchild.ParentID == nil || *grandchild.ParentID != child.ID || result.Roots != 1 || result.Replies != 2 {
				t.Fatalf("hierarchy/counts: %+v", result)
			}
		})
	}
}

func TestImportTwikooCycleCounts(t *testing.T) {
	twikooTestDatabase(t)
	data := `[{"_id":"a","pid":"b","url":"/","comment":"a"},{"_id":"b","pid":"a","url":"/","comment":"b"}]`
	result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(data), TwikooImportOptions{SiteID: "blog"})
	if err != nil || result.Roots != 2 || result.Replies != 0 || result.Orphaned != 2 {
		t.Fatalf("result=%+v err=%v", result, err)
	}
}
