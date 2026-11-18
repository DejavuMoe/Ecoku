package routes

import (
	"context"
	adminhandler "ecoku-server/handle/admin"
	"ecoku-server/model"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestAdminListUsesOneSnapshotDuringConcurrentWrite(t *testing.T) {
	env := setupAdminTest(t)
	if err := model.AttachReadPool(model.DB, env.databasePath); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := model.DetachReadPool(); err != nil {
			t.Error(err)
		}
	})
	root := model.Comment{SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "root"}
	if err := model.DB.Create(&root).Error; err != nil {
		t.Fatal(err)
	}
	inserted := false
	// Commit a reply immediately before the page query, after the list has counted comments.
	for _, db := range []*gorm.DB{model.DB, model.ReadDB()} {
		if err := db.Callback().Query().Before("gorm:query").Register("test:insert-reply", func(tx *gorm.DB) {
			if inserted || tx.Statement.Table != "comments" {
				return
			}
			reply := model.Comment{SiteID: root.SiteID, Mark: root.Mark, ParentID: &root.ID, Username: "Guest", Content: "reply"}
			if err := model.DB.WithContext(tx.Statement.Context).Create(&reply).Error; err != nil {
				_ = tx.AddError(err)
				return
			}
			inserted = true
		}); err != nil {
			t.Fatal(err)
		}
	}
	for _, want := range []int{1, 2} {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		req := httptest.NewRequest(http.MethodGet, "/api/admin/sites/site-a/comments?pageSize=1&sort=oldest", nil).WithContext(ctx)
		req.Header.Set("Authorization", "Bearer "+env.token)
		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, req)
		var envelope struct {
			Data struct {
				Data      []adminhandler.CommentReviewDTO
				Counts    map[string]int
				Total     int
				PageCount int
			}
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		data := envelope.Data
		if recorder.Code != http.StatusOK || !inserted || data.Counts["published"] != want || data.Total != want || data.PageCount != want || len(data.Data) != 1 || data.Data[0].ID != root.ID || data.Data[0].HasChildren != (want == 2) {
			t.Errorf("status=%d inserted=%t data=%+v; want %d comment(s) and has_children=%t", recorder.Code, inserted, data, want, want == 2)
		}
	}
}

func TestAdminListAuditCountsPaginationAndCancellation(t *testing.T) {
	env := setupAdminTest(t)
	now := time.Now().UTC()
	rootID, deletedRootID := uint(1), uint(4)
	comments := []model.Comment{
		{ID: 1, SiteID: "site-a", Mark: "/post", Username: "Guest", Content: "root"},
		{ID: 2, SiteID: "site-a", Mark: "/post", ParentID: &rootID, Username: "Guest", Content: "child"},
		{ID: 3, SiteID: "site-a", Mark: "/other", Username: "Guest", Content: "another page"},
		{ID: 4, SiteID: "site-a", Mark: "/post", DeletedAt: &now},
		{ID: 5, SiteID: "site-a", Mark: "/post", ParentID: &deletedRootID, DeletedAt: &now},
		{ID: 6, SiteID: "site-b", Mark: "/post", Username: "Other", Content: "other site"},
		{ID: 7, SiteID: "site-b", Mark: "/post", DeletedAt: &now},
	}
	for i := range comments {
		comments[i].CreatedAt = now
		if err := model.DB.Create(&comments[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	request := func(path string) *http.Request {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+env.token)
		return req
	}
	t.Run("counts-and-pages", func(t *testing.T) {
		type contextKey struct{}
		ctx := context.WithValue(context.Background(), contextKey{}, t.Name())
		queries, stateCounts, extraCounts := 0, 0, 0
		observe := func(tx *gorm.DB) {
			sql := tx.Statement.SQL.String()
			if tx.Statement.Table != "comments" && !strings.Contains(sql, "FROM comments WHERE site_id") {
				return
			}
			queries++
			hasGroup := strings.Contains(strings.ToUpper(sql), "GROUP BY")
			if !hasGroup && strings.Contains(sql, "COUNT(*) - COUNT(deleted_at) AS published, COUNT(deleted_at) AS deleted") {
				stateCounts++
			} else if !hasGroup && strings.Contains(strings.ToLower(sql), "count(*)") {
				extraCounts++
			}
			if tx.Statement.Context.Value(contextKey{}) != t.Name() {
				t.Error("comment query discarded the request context")
			}
		}
		if err := model.DB.Callback().Query().After("gorm:query").Register("test:admin-list", observe); err != nil {
			t.Fatal(err)
		}
		defer model.DB.Callback().Query().Remove("test:admin-list")
		if err := model.DB.Callback().Row().After("gorm:row").Register("test:admin-list", observe); err != nil {
			t.Fatal(err)
		}
		defer model.DB.Callback().Row().Remove("test:admin-list")
		for _, tc := range []struct {
			status string
			page   int
			size   int
			total  int64
			ids    []uint
		}{
			{"published", 1, 2, 3, []uint{1, 2}},
			{"published", 2, 2, 3, []uint{3}},
			{"deleted", 1, 1, 2, []uint{4}},
			{"deleted", 2, 1, 2, []uint{5}},
			{"deleted", 3, 1, 2, nil},
		} {
			queries, stateCounts, extraCounts = 0, 0, 0
			req := request(fmt.Sprintf("/api/admin/sites/site-a/comments?status=%s&page=%d&pageSize=%d&sort=oldest", tc.status, tc.page, tc.size)).WithContext(ctx)
			recorder := httptest.NewRecorder()
			env.router.ServeHTTP(recorder, req)
			var envelope struct {
				Data struct {
					Data      []adminhandler.CommentReviewDTO
					Counts    map[string]int64
					Total     int64
					Page      int
					PageSize  int
					PageCount int64
				}
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
				t.Fatal(err)
			}
			data := envelope.Data
			if recorder.Code != http.StatusOK || data.Total != tc.total || data.Counts["published"] != 3 || data.Counts["deleted"] != 2 || data.Page != tc.page || data.PageSize != tc.size || data.PageCount != 2 || len(data.Data) != len(tc.ids) {
				t.Fatalf("%s page=%d status=%d data=%+v", tc.status, tc.page, recorder.Code, data)
			}
			for i, item := range data.Data {
				if item.ID != tc.ids[i] || item.SiteID != "site-a" || item.Status != tc.status || item.HasChildren != (item.ID == rootID || item.ID == deletedRootID) {
					t.Fatalf("unexpected review row: %+v", item)
				}
			}
			wantQueries := 3 // One count for both states, one page, one child-count group.
			if len(tc.ids) == 0 {
				wantQueries = 2
			}
			if queries != wantQueries || stateCounts != 1 || extraCounts != 0 {
				t.Fatalf("queries=%d want=%d stateCounts=%d extraCounts=%d", queries, wantQueries, stateCounts, extraCounts)
			}
		}
	})
	t.Run("canceled-page-query", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		var pageQuery *gorm.DB
		if err := model.DB.Callback().Query().Before("gorm:query").Register("test:cancel-admin-page", func(tx *gorm.DB) {
			if tx.Statement.Table == "comments" {
				pageQuery = tx
				cancel()
			}
		}); err != nil {
			t.Fatal(err)
		}
		defer model.DB.Callback().Query().Remove("test:cancel-admin-page")

		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, request("/api/admin/sites/site-a/comments").WithContext(ctx))
		if pageQuery == nil || pageQuery.Statement.Context.Err() == nil || pageQuery.Error == nil || recorder.Code != http.StatusInternalServerError {
			t.Fatalf("expected the page query to fail after cancellation: status=%d body=%s", recorder.Code, recorder.Body)
		}
		sqlDB, err := model.DB.DB()
		if err != nil {
			t.Fatal(err)
		}
		wait, stop := context.WithTimeout(context.Background(), time.Second)
		defer stop()
		conn, err := sqlDB.Conn(wait)
		if err != nil {
			t.Fatalf("canceled read did not release its connection: %v", err)
		}
		_ = conn.Close()
	})
}
