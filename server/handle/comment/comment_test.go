package comment

import (
	"bytes"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type commentListEnvelope struct {
	Data struct {
		Data         []map[string]any         `json:"data"`
		Total        int64                    `json:"total"`
		CommentTotal int64                    `json:"commentTotal"`
		FormConfig   config.CommentFormConfig `json:"formConfig"`
		TimeZone     string                   `json:"timeZone"`
	} `json:"data"`
}

func setupCommentTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	emailOptional := false
	websiteRequired := true
	t.Setenv("ECOKU_COMMENT_SITE_A_KEY", strings.Repeat("a", 32))
	t.Setenv("ECOKU_COMMENT_SITE_B_KEY", strings.Repeat("b", 32))
	if err := config.ApplyConfig(&config.Config{Sites: []config.RegisteredSiteConfig{
		{ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}, ManagementKeyEnv: "ECOKU_COMMENT_SITE_A_KEY", Comment: config.CommentConfig{LengthLimit: 4}},
		{ID: "site-b", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}, ManagementKeyEnv: "ECOKU_COMMENT_SITE_B_KEY", Comment: config.CommentConfig{EmailRequired: &emailOptional, WebsiteRequired: &websiteRequired, Placeholder: "分享你的想法", DefaultSort: "oldest", LengthLimit: 321, EmptyMessage: "暂时没有评论"}},
	}}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/comments.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previous := model.DB
	model.DB = database
	t.Cleanup(func() { model.DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
	router := gin.New()
	router.POST("/submit", SubmitComment)
	router.GET("/list", GetComments)
	return router
}

func ptr[T any](value T) *T { return &value }

func createComment(t *testing.T, item model.Comment) model.Comment {
	t.Helper()
	if err := model.DB.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	return item
}

func TestPublicListReturnsDeepPublishedTreeWithoutPrivateFields(t *testing.T) {
	router := setupCommentTest(t)
	root := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", PageTitle: "文章", Username: "根", Email: ptr("private@example.com"), Content: "根"})
	child := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &root.ID, Username: "二", Email: ptr("two@example.com"), Content: "二"})
	grandchild := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &child.ID, Username: "三", Content: "三"})
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", ParentID: &grandchild.ID, Username: "四", Content: "四"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post&includePending=1", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var envelope commentListEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.Total != 1 || envelope.Data.CommentTotal != 4 || len(envelope.Data.Data) != 4 {
		t.Fatalf("unexpected list: %#v", envelope.Data)
	}
	for _, item := range envelope.Data.Data {
		for _, key := range []string{"email", "page_title", "ip", "ua", "location", "status", "deleted_at"} {
			if _, exists := item[key]; exists {
				t.Fatalf("public DTO contains %q: %#v", key, item)
			}
		}
	}
	if strings.Contains(recorder.Body.String(), "private@example.com") {
		t.Fatal("public response leaked email")
	}
}

func TestSubmitPublishesImmediatelyAndValidatesParentScope(t *testing.T) {
	router := setupCommentTest(t)
	parent := createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "根", Content: "根"})
	other := createComment(t, model.Comment{SiteID: "site-b", Mark: "/post", Username: "别站", Content: "根"})
	for _, test := range []struct {
		name     string
		parentID uint
		status   int
	}{
		{"missing", 99999, http.StatusNotFound},
		{"cross-site", other.ID, http.StatusConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			body := validSubmission("site-a", "/post", test.parentID)
			recorder := postJSON(t, router, body)
			if recorder.Code != test.status {
				t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
	body := validSubmission("site-a", "/post", parent.ID)
	body["pageTitle"] = "文章标题"
	body["content"] = "你好"
	body["ip"] = "198.51.100.8"
	recorder := postJSON(t, router, body)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Data struct {
			ID uint `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	var stored model.Comment
	if err := model.DB.First(&stored, response.Data.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.ParentValue() != parent.ID || stored.PageTitle != "文章标题" || stored.Content != "你好" {
		t.Fatalf("stored=%#v", stored)
	}
}

func TestSiteFormConfigurationAndUnicodeLengthLimit(t *testing.T) {
	router := setupCommentTest(t)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-b&key=/empty", nil))
	var envelope commentListEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	want := config.CommentFormConfig{EmailRequired: false, WebsiteRequired: true, Placeholder: "分享你的想法", DefaultSort: "oldest", LengthLimit: 321, EmptyMessage: "暂时没有评论"}
	if envelope.Data.FormConfig != want {
		t.Fatalf("form=%#v", envelope.Data.FormConfig)
	}
	if envelope.Data.TimeZone == "" {
		t.Fatal("missing timeZone")
	}

	valid := validSubmission("site-a", "/post", 0)
	valid["content"] = "你好世界"
	if got := postJSON(t, router, valid).Code; got != http.StatusCreated {
		t.Fatalf("four CJK runes status=%d", got)
	}
	valid["content"] = "你好世界！"
	if got := postJSON(t, router, valid).Code; got != http.StatusBadRequest {
		t.Fatalf("five CJK runes status=%d", got)
	}
}

func validSubmission(siteID, mark string, parent any) map[string]any {
	return map[string]any{"siteId": siteID, "mark": mark, "content": "test", "username": "Guest", "email": "guest@example.com", "url": "https://guest.example", "parent": parent}
}

func postJSON(t *testing.T, router http.Handler, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/submit", bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	if siteID, _ := body["siteId"].(string); siteID == "site-b" {
		request.Header.Set("Origin", "https://b.example")
	} else {
		request.Header.Set("Origin", "https://a.example")
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}
