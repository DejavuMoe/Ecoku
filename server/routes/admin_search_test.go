package routes

import (
	"ecoku-server/model"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	adminhandler "ecoku-server/handle/admin"
)

func TestAdminCommentSearch(t *testing.T) {
	env := setupAdminTest(t)
	now := time.Now().UTC()
	text := func(value string) *string { return &value }
	comments := []model.Comment{
		{ID: 1, SiteID: "site-a", Mark: "/posts/waf/", PageTitle: "Cloudflare WAF 指南", Username: "Alice", Email: text("alice@example.com"), URL: text("https://alice.example"), Content: "Hello 世界"},
		{ID: 2, SiteID: "site-a", Mark: "/posts/notes/", PageTitle: "Notes", Username: "Bob", Content: "上海见面 100%_done"},
		{ID: 3, SiteID: "site-a", Mark: "/posts/waf/", PageTitle: "Cloudflare WAF 指南", DeletedAt: &now},
		// A tombstone has no name, email, website or text left; only its page and ID can match.
		{ID: 4, SiteID: "site-a", Mark: "/posts/old/", PageTitle: "Old", DeletedAt: &now},
		{ID: 5, SiteID: "site-a", Mark: "/c/", PageTitle: "x", Username: "Carol", Content: `C:\path`},
		{ID: 6, SiteID: "site-b", Mark: "/posts/waf/", PageTitle: "Cloudflare", Username: "Alice", Content: "other site"},
	}
	for i := range comments {
		comments[i].CreatedAt = now.Add(time.Duration(i) * time.Minute)
		if err := model.DB.Create(&comments[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	type page struct {
		Data      []adminhandler.CommentReviewDTO
		Counts    map[string]int64
		Total     int64
		PageCount int64
	}
	list := func(t *testing.T, status, q string, pageSize int) (int, page) {
		t.Helper()
		query := url.Values{"status": {status}, "q": {q}, "sort": {"oldest"}}
		if pageSize > 0 {
			query.Set("pageSize", strconv.Itoa(pageSize))
		}
		req := httptest.NewRequest(http.MethodGet, "/api/admin/sites/site-a/comments?"+query.Encode(), nil)
		req.Header.Set("Authorization", "Bearer "+env.token)
		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, req)
		var envelope struct{ Data page }
		if recorder.Code == http.StatusOK {
			if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
				t.Fatal(err)
			}
		}
		return recorder.Code, envelope.Data
	}
	ids := func(rows []adminhandler.CommentReviewDTO) []uint {
		result := []uint{}
		for _, row := range rows {
			result = append(result, row.ID)
		}
		return result
	}

	for _, tc := range []struct {
		name      string
		status    string
		q         string
		ids       []uint
		published int64
		deleted   int64
	}{
		{"name", "published", "alice", []uint{1}, 1, 0},
		{"ascii case folded", "published", "ALICE", []uint{1}, 1, 0},
		{"email", "published", "@example.com", []uint{1}, 1, 0},
		{"website", "published", "alice.example", []uint{1}, 1, 0},
		{"page title in both states", "published", "cloudflare", []uint{1}, 1, 1},
		{"deleted by page title", "deleted", "cloudflare", []uint{3}, 1, 1},
		{"deleted by page key", "deleted", "/posts/old/", []uint{4}, 0, 1},
		{"deleted comments have no name to match", "deleted", "alice", []uint{}, 1, 0},
		{"every word must match", "published", "上海 alice", []uint{}, 0, 0},
		{"full-width space separates words", "published", "上海\u3000见面", []uint{2}, 1, 0},
		{"percent is literal", "published", "100%", []uint{2}, 1, 0},
		{"lone percent is literal", "published", "%", []uint{2}, 1, 0},
		{"underscore is literal", "published", "_", []uint{2}, 1, 0},
		{"backslash is literal", "published", `\`, []uint{5}, 1, 0},
		{"comment ID", "published", "#2", []uint{2}, 1, 0},
		{"deleted comment ID", "deleted", "#3", []uint{3}, 0, 1},
		{"ID with text", "published", "#1 hello", []uint{1}, 1, 0},
		{"bare hash is text", "published", "#", []uint{}, 0, 0},
		{"other site never matches", "published", "other site", []uint{}, 0, 0},
		{"blank search lists everything", "published", "   ", []uint{1, 2, 5}, 3, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			code, data := list(t, tc.status, tc.q, 0)
			want := int64(len(tc.ids))
			if code != http.StatusOK || !reflect.DeepEqual(ids(data.Data), tc.ids) || data.Counts["published"] != tc.published || data.Counts["deleted"] != tc.deleted || data.Total != want {
				t.Fatalf("q=%q status=%d ids=%v counts=%v total=%d; want ids=%v published=%d deleted=%d", tc.q, code, ids(data.Data), data.Counts, data.Total, tc.ids, tc.published, tc.deleted)
			}
		})
	}

	t.Run("pages through matches", func(t *testing.T) {
		code, data := list(t, "published", "/posts/", 1)
		if code != http.StatusOK || data.Total != 2 || data.PageCount != 2 || !reflect.DeepEqual(ids(data.Data), []uint{1}) {
			t.Fatalf("status=%d data=%+v", code, data)
		}
	})
	t.Run("only the first eight distinct words count", func(t *testing.T) {
		// Nine words, the ninth matching nothing; repeats of the same word count once.
		code, data := list(t, "published", "alice ALICE a l i c e hello example zzz-no-match", 0)
		if code != http.StatusOK || !reflect.DeepEqual(ids(data.Data), []uint{1}) {
			t.Fatalf("status=%d ids=%v", code, ids(data.Data))
		}
	})
	t.Run("limits", func(t *testing.T) {
		if code, _ := list(t, "published", strings.Repeat("评", 100), 0); code != http.StatusOK {
			t.Fatalf("100 characters: status=%d", code)
		}
		if code, _ := list(t, "published", strings.Repeat("评", 101), 0); code != http.StatusBadRequest {
			t.Fatalf("101 characters: status=%d", code)
		}
		req := httptest.NewRequest(http.MethodGet, "/api/admin/sites/site-a/comments?q=%ff", nil)
		req.Header.Set("Authorization", "Bearer "+env.token)
		recorder := httptest.NewRecorder()
		env.router.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("invalid UTF-8: status=%d", recorder.Code)
		}
	})
}
