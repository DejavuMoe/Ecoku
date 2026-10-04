package comment

import (
	"bytes"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"encoding/base64"
	"encoding/json"
	"io"
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

type commentRoundTripFunc func(*http.Request) (*http.Response, error)

func (function commentRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func setupCommentTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	if err := config.ApplyConfig(&config.Config{}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/comments.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	testsite.Create(t, database,
		testsite.Site{ID: "site-a", SiteURL: "https://a.example", AllowedOrigins: []string{"https://a.example"}, LengthLimit: 4},
		testsite.Site{ID: "site-b", SiteURL: "https://b.example", AllowedOrigins: []string{"https://b.example"}, EmailRequired: ptr(false), WebsiteRequired: true, Placeholder: "分享你的想法", DefaultSort: "oldest", LengthLimit: 321, EmptyMessage: "暂时没有评论"},
	)
	previous := model.DB
	model.DB = database
	t.Cleanup(func() { model.DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
	router := gin.New()
	router.POST("/submit", PublicSubmitBudget, SubmitComment)
	router.GET("/list", PublicListBudget, GetComments)
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

func TestPublicListMarksBloggerWithoutExposingEmail(t *testing.T) {
	router := setupCommentTest(t)
	if err := model.DB.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test', blogger_badge = '[OP]' WHERE id = 'site-a'`).Error; err != nil {
		t.Fatal(err)
	}
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "站长", Email: ptr("OWNER@example.test"), Content: "博主留言", IsBlogger: true})
	createComment(t, model.Comment{SiteID: "site-a", Mark: "/post", Username: "站长", Email: ptr("visitor@example.test"), Content: "同名访客"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var envelope commentListEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.FormConfig.BloggerBadge != "[OP]" {
		t.Fatalf("badge=%q", envelope.Data.FormConfig.BloggerBadge)
	}
	if len(envelope.Data.Data) != 2 {
		t.Fatalf("comments=%d", len(envelope.Data.Data))
	}
	byContent := map[string]map[string]any{}
	for _, item := range envelope.Data.Data {
		content, _ := item["content"].(string)
		byContent[content] = item
	}
	if byContent["博主留言"]["isBlogger"] != true || byContent["同名访客"]["isBlogger"] != false {
		t.Fatalf("isBlogger mismatch: %#v", envelope.Data.Data)
	}
	for _, item := range envelope.Data.Data {
		if _, exists := item["email"]; exists {
			t.Fatalf("public DTO contains email: %#v", item)
		}
	}
	if strings.Contains(recorder.Body.String(), "owner@example.test") || strings.Contains(recorder.Body.String(), "visitor@example.test") {
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

func TestSubmitRejectsAbsolutePageKeys(t *testing.T) {
	router := setupCommentTest(t)
	for _, test := range []struct {
		name string
		mark string
		code int
	}{
		{name: "https", mark: "https://evil.example/phish", code: http.StatusBadRequest},
		{name: "http", mark: "http://evil.example/phish", code: http.StatusBadRequest},
		{name: "protocol-relative", mark: "//evil.example/phish", code: http.StatusBadRequest},
		{name: "triple-slash", mark: "///evil.example/phish", code: http.StatusBadRequest},
		{name: "javascript", mark: "javascript:alert(1)", code: http.StatusBadRequest},
		{name: "same-site-absolute", mark: "https://a.example/post", code: http.StatusBadRequest},
		{name: "embedded-newline", mark: "post\n/x", code: http.StatusBadRequest},
		{name: "rooted-path", mark: "/post", code: http.StatusCreated},
		{name: "plain-key", mark: "article-a", code: http.StatusCreated},
		{name: "nested-key", mark: "article/stable-key", code: http.StatusCreated},
		{name: "permalink", mark: "/posts/test/", code: http.StatusCreated},
		{name: "query", mark: "/posts/test/?utm=1", code: http.StatusBadRequest},
		{name: "fragment", mark: "/posts/test/#section", code: http.StatusBadRequest},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := postJSON(t, router, validSubmission("site-a", test.mark, 0)).Code; got != test.code {
				t.Fatalf("status=%d mark=%q", got, test.mark)
			}
		})
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
	want := config.CommentFormConfig{Locale: "zh-CN", EmailRequired: false, WebsiteRequired: true, Placeholder: "分享你的想法", DefaultSort: "oldest", LengthLimit: 321, EmptyMessage: "暂时没有评论", BloggerBadge: model.DefaultBloggerBadge, Captcha: config.CaptchaPublicConfig{Provider: captcha.ProviderOff}}
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

func enableCommentTurnstile(t *testing.T, successToken string) {
	t.Helper()
	t.Setenv(config.EncryptionKeyEnv, base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	if _, err := captcha.Save(captcha.Settings{
		Provider:  captcha.ProviderTurnstile,
		Turnstile: captcha.ProviderSettings{Sitekey: "public-sitekey", Secret: "secret-private"},
		Revision:  1,
	}); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": r.FormValue("response") == successToken})
	}))
	t.Cleanup(server.Close)
	restore := captcha.ConfigureTurnstileSiteverify(server.URL, server.Client())
	t.Cleanup(restore)
}

func enableCommentCap(t *testing.T, successToken string) {
	t.Helper()
	t.Setenv(config.EncryptionKeyEnv, base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	if _, err := captcha.Save(captcha.Settings{
		Provider: captcha.ProviderCap,
		Cap:      captcha.CapSettings{InstanceURL: "https://cap.example.com", Sitekey: "cap-public", Secret: "cap-private"},
		Revision: 1,
	}); err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: commentRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(request.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		success := request.URL.String() == "https://cap.example.com/cap-public/siteverify" && payload["secret"] == "cap-private" && payload["response"] == successToken
		response, _ := json.Marshal(map[string]bool{"success": success})
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(response))), Header: make(http.Header)}, nil
	})}
	restore := captcha.ConfigureCapSiteverify(client)
	t.Cleanup(restore)
}

func TestPublicListExposesTurnstileSitekeyWithoutSecret(t *testing.T) {
	router := setupCommentTest(t)
	enableCommentTurnstile(t, "ok")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-b&key=/empty", nil))
	var envelope commentListEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.FormConfig.TurnstileSitekey != "public-sitekey" {
		t.Fatalf("form=%#v", envelope.Data.FormConfig)
	}
	if envelope.Data.FormConfig.Captcha.Provider != captcha.ProviderTurnstile || envelope.Data.FormConfig.Captcha.Sitekey != "public-sitekey" || envelope.Data.FormConfig.Captcha.InstanceURL != "" {
		t.Fatalf("captcha=%#v", envelope.Data.FormConfig.Captcha)
	}
	if strings.Contains(recorder.Body.String(), "secret-private") {
		t.Fatal("secret leaked in public list")
	}
}

func TestSubmitRequiresTurnstileWhenEnabled(t *testing.T) {
	router := setupCommentTest(t)
	enableCommentTurnstile(t, "good-token")
	missing := validSubmission("site-a", "/post", 0)
	recorder := postJSON(t, router, missing)
	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "请完成验证后再发布") {
		t.Fatalf("missing token status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	invalid := validSubmission("site-a", "/post", 0)
	invalid["captchaToken"] = "bad-token"
	recorder = postJSON(t, router, invalid)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("invalid token status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	ok := validSubmission("site-a", "/post", 0)
	ok["captchaToken"] = "good-token"
	recorder = postJSON(t, router, ok)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("valid token status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	legacy := validSubmission("site-a", "/legacy", 0)
	legacy["turnstileToken"] = "good-token"
	recorder = postJSON(t, router, legacy)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("legacy Turnstile token status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	conflicting := validSubmission("site-a", "/conflict", 0)
	conflicting["captchaToken"] = "good-token"
	conflicting["turnstileToken"] = "different-token"
	if got := postJSON(t, router, conflicting).Code; got != http.StatusBadRequest {
		t.Fatalf("conflicting token status=%d", got)
	}
}

func TestPublicListAndSubmitUseCapWithoutLegacySecretFields(t *testing.T) {
	router := setupCommentTest(t)
	enableCommentCap(t, "good-cap-token")
	list := httptest.NewRecorder()
	router.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/cap", nil))
	var envelope commentListEnvelope
	if err := json.Unmarshal(list.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.FormConfig.Captcha.Provider != captcha.ProviderCap || envelope.Data.FormConfig.Captcha.Sitekey != "cap-public" || envelope.Data.FormConfig.Captcha.InstanceURL != "https://cap.example.com" || envelope.Data.FormConfig.TurnstileSitekey != "" {
		t.Fatalf("form=%#v", envelope.Data.FormConfig)
	}
	if strings.Contains(list.Body.String(), "cap-private") {
		t.Fatal("Cap secret leaked in public list")
	}
	legacy := validSubmission("site-a", "/cap", 0)
	legacy["turnstileToken"] = "good-cap-token"
	if got := postJSON(t, router, legacy).Code; got != http.StatusBadRequest {
		t.Fatalf("Cap accepted legacy token status=%d", got)
	}
	valid := validSubmission("site-a", "/cap", 0)
	valid["captchaToken"] = "good-cap-token"
	if got := postJSON(t, router, valid).Code; got != http.StatusCreated {
		t.Fatalf("Cap token status=%d", got)
	}
}

func TestSubmitBloggerPassphraseRewritesIdentity(t *testing.T) {
	router := setupCommentTest(t)
	hash, err := model.HashBloggerPassphrase("correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test', blogger_passphrase_hash = ? WHERE id = 'site-a'`, hash).Error; err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/list?siteId=site-a&key=/post", nil))
	var list commentListEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if !list.Data.FormConfig.BloggerProofEnabled {
		t.Fatal("formConfig should advertise blogger proof")
	}
	body := map[string]any{"siteId": "site-a", "mark": "/post", "content": "你好", "username": "correct-horse-battery", "parent": 0}
	created := postJSON(t, router, body)
	if created.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", created.Code, created.Body.String())
	}
	if strings.Contains(created.Body.String(), "correct-horse-battery") {
		t.Fatal("passphrase echoed in submit response")
	}
	var response struct {
		Data struct {
			ID        uint `json:"id"`
			IsBlogger bool `json:"isBlogger"`
		} `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Data.IsBlogger {
		t.Fatal("submit response missing isBlogger")
	}
	var stored model.Comment
	if err := model.DB.First(&stored, response.Data.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Username != "站长" || stored.Email == nil || *stored.Email != "owner@example.test" || stored.URL == nil || *stored.URL != "https://a.example" || !stored.IsBlogger {
		t.Fatalf("stored=%#v", stored)
	}
	wrong := map[string]any{"siteId": "site-a", "mark": "/post", "content": "你好", "username": "wrong-passphrase", "parent": 0}
	if got := postJSON(t, router, wrong).Code; got != http.StatusBadRequest {
		t.Fatalf("mistyped passphrase without email status=%d", got)
	}
}

func TestCaptchaPrecedesEveryBloggerIdentityBranch(t *testing.T) {
	for _, provider := range []string{"turnstile", "cap"} {
		t.Run(provider, func(t *testing.T) {
			router := setupCommentTest(t)
			if provider == "cap" {
				enableCommentCap(t, "good")
			} else {
				enableCommentTurnstile(t, "good")
			}
			hash, err := model.HashBloggerPassphrase("correct-horse-battery")
			if err != nil {
				t.Fatal(err)
			}
			if err := model.DB.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test', blogger_passphrase_hash = ? WHERE id = 'site-a'`, hash).Error; err != nil {
				t.Fatal(err)
			}
			for _, token := range []string{"", "wrong"} {
				for _, candidate := range []string{"correct-horse-battery", "wrong-passphrase"} {
					body := validSubmission("site-a", "/oracle", 0)
					body["username"], body["email"], body["url"], body["captchaToken"] = candidate, "bad-email", "bad-website", token
					response := postJSON(t, router, body)
					if response.Code != 400 || !strings.Contains(response.Body.String(), "请完成验证后再发布") {
						t.Fatalf("unexpected oracle response: %d %s", response.Code, response.Body.String())
					}
				}
			}
			var count int64
			model.DB.Model(&model.Comment{}).Count(&count)
			if count != 0 {
				t.Fatal("rejected challenge published a comment")
			}
			model.DB.Table("notification_outbox").Count(&count)
			if count != 0 {
				t.Fatal("rejected challenge queued a notification")
			}
			blogger := validSubmission("site-a", "/oracle", 0)
			blogger["username"], blogger["email"], blogger["url"], blogger["captchaToken"] = "correct-horse-battery", "", "", "good"
			if got := postJSON(t, router, blogger).Code; got != 201 {
				t.Fatalf("blogger control: %d", got)
			}
			visitor := validSubmission("site-a", "/oracle", 0)
			visitor["username"], visitor["captchaToken"] = "wrong-passphrase", "good"
			if got := postJSON(t, router, visitor).Code; got != 201 {
				t.Fatalf("visitor control: %d", got)
			}
		})
	}
}

func TestSubmitRejectsSeventeenthReplyDepth(t *testing.T) {
	router := setupCommentTest(t)
	var parent uint
	for depth := 0; depth <= maxPublicListDepth; depth++ {
		response := postJSON(t, router, validSubmission("site-a", "/depth", parent))
		if response.Code != 201 {
			t.Fatalf("depth %d: %s", depth, response.Body.String())
		}
		var envelope struct {
			Data struct {
				ID uint `json:"id"`
			} `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		parent = envelope.Data.ID
	}
	response := postJSON(t, router, validSubmission("site-a", "/depth", parent))
	if response.Code != 422 {
		t.Fatalf("depth 17: %d %s", response.Code, response.Body.String())
	}
	var count int64
	model.DB.Model(&model.Comment{}).Where("mark = ?", "/depth").Count(&count)
	if count != 17 {
		t.Fatalf("rejected reply was stored: %d", count)
	}
}
