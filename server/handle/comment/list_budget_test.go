package comment

import (
	"context"
	"ecoku-server/model"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

func listRequest(router http.Handler, query string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post"+query, nil))
	return recorder
}

func seedSiblings(t *testing.T, parentID *uint, count int, content string) []model.Comment {
	t.Helper()
	items := make([]model.Comment, count)
	for i := range items {
		items[i] = model.Comment{SiteID: "site-a", Mark: "/post", ParentID: parentID, Username: "Guest", Content: content}
	}
	if err := model.DB.CreateInBatches(&items, 100).Error; err != nil {
		t.Fatal(err)
	}
	return items
}

func TestPublicListDepthBudgetDoesNotSilentlyTruncate(t *testing.T) {
	router := setupCommentTest(t)
	root := seedSiblings(t, nil, 1, "root")[0]
	parent := root
	for i := 0; i < maxPublicListDepth; i++ {
		parent = createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: ptr(parent.ID), Username: "Guest", Content: "child"})
	}
	if got := listRequest(router, "&pageSize=1"); got.Code != http.StatusOK {
		t.Fatalf("exact depth: %d %s", got.Code, got.Body.String())
	}
	seedSiblings(t, &parent.ID, 1, "too deep")
	queries := 0
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:depth", func(tx *gorm.DB) {
		if tx.Statement.Table == "comments" {
			queries++
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:depth")
	items, err := loadPublicDescendants(model.DB, "site-a", "/post", []model.Comment{root})
	if !errors.Is(err, errPublicListBudget) || items != nil || queries > maxPublicListDepth+1 {
		t.Fatalf("items=%d err=%v queries=%d", len(items), err, queries)
	}
	got := listRequest(router, "&pageSize=1&includePending=1")
	if got.Code != http.StatusUnprocessableEntity || strings.Contains(got.Body.String(), `"data"`) {
		t.Fatalf("oversized tree was not rejected: %d %s", got.Code, got.Body.String())
	}
}

func TestPublicListNodeBudgetBoundsDatabaseMaterialization(t *testing.T) {
	router := setupCommentTest(t)
	root := seedSiblings(t, nil, 1, "root")[0]
	seedSiblings(t, &root.ID, maxPublicListNodes-1, "child")
	if got := listRequest(router, "&pageSize=1"); got.Code != http.StatusOK {
		t.Fatalf("exact node budget: %d %s", got.Code, got.Body.String())
	}
	seedSiblings(t, &root.ID, 50, "excess")
	var rows int64
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:rows", func(tx *gorm.DB) {
		if tx.Statement.Table == "comments" {
			rows += tx.RowsAffected
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:rows")
	items, err := loadPublicDescendants(model.DB, "site-a", "/post", []model.Comment{root})
	if !errors.Is(err, errPublicListBudget) || items != nil || rows != maxPublicListNodes {
		t.Fatalf("items=%d err=%v materialized=%d", len(items), err, rows)
	}
	if got := listRequest(router, "&pageSize=1"); got.Code != http.StatusUnprocessableEntity {
		t.Fatalf("wide tree status=%d", got.Code)
	}
}

func TestPublicCountBudgetAndCursorEscapeHatch(t *testing.T) {
	router := setupCommentTest(t)
	seedSiblings(t, nil, maxPublicCountNodes, "root")
	total, roots, err := countPublicComments(model.DB, "site-a", "/post")
	if err != nil || total != maxPublicCountNodes || roots != total {
		t.Fatalf("total=%d roots=%d err=%v", total, roots, err)
	}
	seedSiblings(t, nil, 20, "excess")
	var rows int64
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:count", func(tx *gorm.DB) {
		if tx.Statement.Table == "comments" {
			rows += tx.RowsAffected
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:count")
	_, _, err = countPublicComments(model.DB, "site-a", "/post")
	if !errors.Is(err, errPublicListBudget) || rows != maxPublicCountNodes+1 {
		t.Fatalf("err=%v materialized=%d", err, rows)
	}
	if got := listRequest(router, "&pageSize=1"); got.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d", got.Code)
	}
	if got := listRequest(router, "&parentId=0&pageSize=1"); got.Code != http.StatusOK {
		t.Fatalf("cursor status=%d %s", got.Code, got.Body.String())
	}
}

func TestPublicChildrenCursorIsScopedCompleteAndSingleLevel(t *testing.T) {
	router := setupCommentTest(t)
	now := time.Now().UTC()
	root := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", DeletedAt: &now})
	children := seedSiblings(t, &root.ID, maxPublicListNodes+3, "child")
	seedSiblings(t, &children[0].ID, 1, "grandchild")
	other := createComment(t, model.Comment{SiteID: "site-b", Mark: "/post", Username: "Guest", Content: "other site"})
	otherPage := createComment(t, model.Comment{SiteID: "site-a", Mark: "/other", Username: "Guest", Content: "other page"})
	var after uint
	var ids []uint
	for attempts := 0; attempts <= len(children); attempts++ {
		got := listRequest(router, fmt.Sprintf("&parentId=%d&afterId=%d&pageSize=40", root.ID, after))
		if got.Code != http.StatusOK {
			t.Fatalf("status=%d %s", got.Code, got.Body.String())
		}
		var envelope struct {
			Data struct {
				Data        []PublicCommentResponse
				HasMore     bool
				NextAfterID uint
			}
		}
		if err := json.Unmarshal(got.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		if len(envelope.Data.Data) > 40 {
			t.Fatal("page size ignored")
		}
		for _, item := range envelope.Data.Data {
			if item.Parent != root.ID || item.ID <= after {
				t.Fatalf("unexpected child: %+v", item)
			}
			ids = append(ids, item.ID)
		}
		if !envelope.Data.HasMore {
			break
		}
		if envelope.Data.NextAfterID <= after {
			t.Fatal("non-progressing cursor")
		}
		after = envelope.Data.NextAfterID
	}
	if len(ids) != len(children) {
		t.Fatalf("got=%d want=%d", len(ids), len(children))
	}
	for i, child := range children {
		if ids[i] != child.ID {
			t.Fatalf("duplicate/missing child at %d", i)
		}
	}
	for _, id := range []uint{other.ID, otherPage.ID, 999999} {
		if got := listRequest(router, fmt.Sprintf("&parentId=%d", id)); got.Code != http.StatusNotFound {
			t.Fatalf("parent %d status=%d", id, got.Code)
		}
	}
}

func TestPublicListPayloadBudgetMeasuresEscapedJSON(t *testing.T) {
	router := setupCommentTest(t)
	// '<' takes six bytes in JSON; raw UTF-8 content fits below 1 MiB.
	seedSiblings(t, nil, 20, strings.Repeat("<", maxCommentLength))
	for _, query := range []string{"&pageSize=20", "&parentId=0&pageSize=20"} {
		got := listRequest(router, query)
		if got.Code != http.StatusUnprocessableEntity || got.Body.Len() > maxPublicListBytes || strings.Contains(got.Body.String(), `"data"`) {
			t.Fatalf("payload status=%d bytes=%d", got.Code, got.Body.Len())
		}
	}
	if got := listRequest(router, "&pageSize=1"); got.Code != http.StatusOK || got.Body.Len() > maxPublicListBytes {
		t.Fatalf("small page status=%d", got.Code)
	}
}

func TestPublicListInvalidCursorAndHugePage(t *testing.T) {
	router := setupCommentTest(t)
	seedSiblings(t, nil, 1, "root")
	for _, query := range []string{"&parentId=-1", "&parentId=", "&parentId=9223372036854775808", "&parentId=0&parentId=1", "&parentId=0&afterId=-1", "&parentId=0&afterId=1&afterId=2", "&afterId=1", "&parentId=0&page=1", "&parentId=0&sort=oldest"} {
		if got := listRequest(router, query); got.Code != http.StatusBadRequest {
			t.Fatalf("%s status=%d", query, got.Code)
		}
	}
	got := listRequest(router, "&pageSize=100&page="+strconv.Itoa(int(^uint(0)>>1)))
	var envelope commentListEnvelope
	if err := json.Unmarshal(got.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if got.Code != http.StatusOK || len(envelope.Data.Data) != 0 || envelope.Data.Total != 1 {
		t.Fatalf("huge page: %d %s", got.Code, got.Body.String())
	}
}

func TestPublicListCancellationAndConcurrencyBudget(t *testing.T) {
	router := setupCommentTest(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	request := httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("canceled status=%d", recorder.Code)
	}
	if len(publicListSlots) != 0 {
		t.Fatal("slot leaked after cancellation")
	}
	for i := 0; i < cap(publicListSlots); i++ {
		publicListSlots <- struct{}{}
	}
	func() {
		defer func() {
			for i := 0; i < cap(publicListSlots); i++ {
				<-publicListSlots
			}
		}()
		got := listRequest(router, "")
		if got.Code != http.StatusServiceUnavailable || got.Header().Get("Retry-After") != "1" {
			t.Fatalf("saturated status=%d", got.Code)
		}
	}()
	if got := listRequest(router, ""); got.Code != http.StatusOK {
		t.Fatalf("slot not released: %d", got.Code)
	}
}

func TestPublicListDeadlineIncludesWaitingForDatabaseConnection(t *testing.T) {
	router := setupCommentTest(t)
	sqlDB, err := model.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	connection, err := sqlDB.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() { router.ServeHTTP(recorder, req); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		_ = connection.Close()
		<-done
		t.Fatal("list ignored the deadline while waiting for SQLite")
	}
	if recorder.Code != http.StatusServiceUnavailable || len(publicListSlots) != 0 {
		t.Fatalf("deadline status=%d slots=%d", recorder.Code, len(publicListSlots))
	}
}

func TestPublicListUsesOneSnapshotAcrossCountAndDescendants(t *testing.T) {
	router := setupCommentTest(t)
	root := seedSiblings(t, nil, 1, "root")[0]
	var files []struct {
		Name string
		File string
	}
	if err := model.DB.Raw("PRAGMA database_list").Scan(&files).Error; err != nil {
		t.Fatal(err)
	}
	var path string
	for _, file := range files {
		if file.Name == "main" {
			path = file.File
		}
	}
	writer, err := model.OpenSQLiteDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { sqlDB, _ := writer.DB(); _ = sqlDB.Close() }()
	written := false
	var writeErr error
	if err := model.DB.Callback().Query().After("gorm:query").Register("test:snapshot", func(tx *gorm.DB) {
		if written || tx.Statement.Table != "comments" || len(tx.Statement.Selects) != 1 || tx.Statement.Selects[0] != "id, parent_id" {
			return
		}
		written = true
		writeErr = writer.Create(&model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "Guest", Content: "concurrent"}).Error
	}); err != nil {
		t.Fatal(err)
	}
	defer model.DB.Callback().Query().Remove("test:snapshot")
	for _, want := range []int{1, 2} {
		got := listRequest(router, "")
		var envelope commentListEnvelope
		if err := json.Unmarshal(got.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		if got.Code != http.StatusOK || !written || writeErr != nil || len(envelope.Data.Data) != want || envelope.Data.CommentTotal != int64(want) {
			t.Fatalf("snapshot status=%d written=%v err=%v data=%+v want=%d", got.Code, written, writeErr, envelope.Data, want)
		}
	}
}
