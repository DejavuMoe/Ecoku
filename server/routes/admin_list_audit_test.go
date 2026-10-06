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
		queries, grouped, standalone := 0, 0, 0
		observe := func(tx *gorm.DB) {
			sql := tx.Statement.SQL.String()
			if tx.Statement.Table != "comments" && !strings.Contains(sql, "FROM comments WHERE site_id") {
				return
			}
			queries++
			if strings.Contains(sql, "GROUP BY deleted_at IS NOT NULL") {
				grouped++
			}
			if strings.Contains(strings.ToLower(sql), "count(*)") && !strings.Contains(strings.ToUpper(sql), "GROUP BY") {
				standalone++
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
			queries, grouped, standalone = 0, 0, 0
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
			wantQueries := 3 // One grouped count, one page, one child-count group.
			if len(tc.ids) == 0 {
				wantQueries = 2
			}
			if queries != wantQueries || grouped != 1 || standalone != 0 {
				t.Fatalf("queries=%d want=%d grouped=%d standalone=%d", queries, wantQueries, grouped, standalone)
			}
		}
	})
	t.Run("canceled-page-query", func(t *testing.T) {
		// Reuse the bounded sole-connection fixture after authentication and
		// aggregation have completed; no auth query can mask the handler check.
		assertAuditPoolCancellation(t, env.router, request("/api/admin/sites/site-a/comments"), "comments", 1)
	})
}
