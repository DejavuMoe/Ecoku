package comment

import (
	"ecoku-server/model"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// setupCachedCommentTest attaches the production read pool, which enables the
// data_version stamp and every public cache.
func setupCachedCommentTest(t *testing.T) *gin.Engine {
	t.Helper()
	_, path := setupCommentTestAt(t)
	if err := model.AttachReadPool(model.DB, path); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = model.DetachReadPool() })
	stamped := gin.New()
	stamped.Use(func(c *gin.Context) {
		if ctx, err := model.WithDataStamp(c.Request.Context()); err == nil {
			c.Request = c.Request.WithContext(ctx)
		}
		c.Next()
	})
	stamped.POST("/submit", PublicSubmitBudget, SubmitComment)
	stamped.GET("/list", PublicListBudget, GetComments)
	return stamped
}

func countReaderQueries(t *testing.T) *int {
	t.Helper()
	queries := 0
	reader := model.ReadDB()
	if reader == model.DB {
		t.Fatal("read pool not attached")
	}
	if err := reader.Callback().Query().After("gorm:query").Register("test:reader-queries", func(*gorm.DB) { queries++ }); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { reader.Callback().Query().Remove("test:reader-queries") })
	return &queries
}

func TestPublicListCacheServesUnchangedDataWithoutQueries(t *testing.T) {
	router := setupCachedCommentTest(t)
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "first"})
	first := listRequest(router, "")
	if first.Code != http.StatusOK {
		t.Fatalf("first: %d %s", first.Code, first.Body.String())
	}
	queries := countReaderQueries(t)
	second := listRequest(router, "")
	if second.Code != http.StatusOK || second.Body.String() != first.Body.String() {
		t.Fatalf("cached response changed: %d", second.Code)
	}
	if *queries != 0 {
		t.Fatalf("cached list ran %d reader queries", *queries)
	}
	if second.Header().Get("ETag") == "" || second.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("cache headers: %v", second.Header())
	}
}

func TestPublicListCacheSeesEveryCommittedWrite(t *testing.T) {
	router := setupCachedCommentTest(t)
	root := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "root"})
	before := listRequest(router, "")
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "Guest", Content: "reply"})
	after := listRequest(router, "")
	var envelope commentListEnvelope
	if err := json.Unmarshal(after.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.CommentTotal != 2 || before.Header().Get("ETag") == after.Header().Get("ETag") {
		t.Fatalf("stale list after write: total=%d", envelope.Data.CommentTotal)
	}
	// Site settings live in the same database and invalidate the same way.
	if err := model.DB.Table("sites").Where("id = ?", "site-a").Update("placeholder", "新的提示").Error; err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(listRequest(router, "").Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.FormConfig.Placeholder != "新的提示" {
		t.Fatalf("stale site config: %q", envelope.Data.FormConfig.Placeholder)
	}
}

func TestPublicListRevalidatesWithETag(t *testing.T) {
	router := setupCachedCommentTest(t)
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "root"})
	first := listRequest(router, "")
	etag := first.Header().Get("ETag")
	request := httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil)
	request.Header.Set("If-None-Match", "W/"+etag)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotModified || recorder.Body.Len() != 0 || recorder.Header().Get("ETag") != etag {
		t.Fatalf("revalidation: %d %q", recorder.Code, recorder.Body.String())
	}
	request = httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil)
	request.Header.Set("If-None-Match", `"other"`)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("mismatched etag: %d", recorder.Code)
	}
}

func TestPublicListCacheStillEnforcesSiteOrigin(t *testing.T) {
	router := setupCachedCommentTest(t)
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "root"})
	if got := listRequest(router, ""); got.Code != http.StatusOK {
		t.Fatalf("warm cache: %d", got.Code)
	}
	// site-b's origin is registered, but not for site-a.
	request := httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil)
	request.Header.Set("Origin", "https://b.example")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("cached list ignored the site origin: %d", recorder.Code)
	}
}

func TestPublicListCacheKeepsErrorsUncached(t *testing.T) {
	router := setupCachedCommentTest(t)
	if got := listRequest(router, "&page=0"); got.Code != http.StatusBadRequest || got.Header().Get("ETag") != "" {
		t.Fatalf("invalid page: %d", got.Code)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=missing&key=/post", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("missing site: %d", recorder.Code)
	}
}

func TestPublicListOrdersBatchedDescendantsLikeSiblingQueries(t *testing.T) {
	router := setupCommentTest(t)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	rootA := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "A", Content: "a", CreatedAt: base})
	rootB := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "B", Content: "b", CreatedAt: base.Add(time.Minute)})
	// IDs and creation times disagree, so the order must come from created_at.
	lateA := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &rootA.ID, Username: "A2", Content: "a2", CreatedAt: base.Add(3 * time.Minute)})
	earlyA := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &rootA.ID, Username: "A1", Content: "a1", CreatedAt: base.Add(2 * time.Minute)})
	childB := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &rootB.ID, Username: "B1", Content: "b1", CreatedAt: base.Add(time.Minute)})
	deep := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &earlyA.ID, Username: "A11", Content: "a11", CreatedAt: base.Add(5 * time.Minute)})
	var envelope commentListEnvelope
	if err := json.Unmarshal(listRequest(router, "&sort=oldest").Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	want := []uint{rootA.ID, rootB.ID, earlyA.ID, lateA.ID, childB.ID, deep.ID}
	if len(envelope.Data.Data) != len(want) {
		t.Fatalf("items=%d", len(envelope.Data.Data))
	}
	for index, item := range envelope.Data.Data {
		if uint(item["id"].(float64)) != want[index] {
			t.Fatalf("order[%d]=%v want %d", index, item["id"], want[index])
		}
	}
}
