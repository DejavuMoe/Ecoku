package notifications

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/base64"
	"slices"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func setupNotificationTest(t *testing.T) *gorm.DB {
	t.Helper()
	key := base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	t.Setenv("ECOKU_NOTIFICATION_TEST_KEY", key)
	if err := config.ApplyConfig(&config.Config{
		Sites:         []config.RegisteredSiteConfig{{ID: "site-a", Name: "示例站点", SiteURL: "https://site.example", AllowedOrigins: []string{"https://site.example"}}},
		Notifications: config.NotificationsConfig{EncryptionKeyEnv: "ECOKU_NOTIFICATION_TEST_KEY", InstancePublicURL: "https://comments.example"},
	}); err != nil {
		t.Fatal(err)
	}
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/notifications.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previous := model.DB
	model.DB = database
	t.Cleanup(func() { model.DB = previous; sqlDB, _ := database.DB(); _ = sqlDB.Close() })
	return database
}

func TestBloggerIdentityNotificationMatrix(t *testing.T) {
	tests := []struct {
		name          string
		submitter     string
		submitterMail string
		parent        string
		parentMail    string
		expected      []string
	}{
		{name: "visitor root", submitter: "访客", submitterMail: "visitor@example.test", expected: []string{EventBloggerEmail, EventBloggerTelegram}},
		{name: "visitor replies visitor", submitter: "访客二", submitterMail: "visitor2@example.test", parent: "访客一", parentMail: "visitor1@example.test", expected: []string{EventBloggerEmail, EventBloggerTelegram, EventVisitorReply}},
		{name: "visitor replies blogger", submitter: "访客", submitterMail: "visitor@example.test", parent: "站长", parentMail: "OWNER@EXAMPLE.TEST", expected: []string{EventBloggerEmail, EventBloggerTelegram}},
		{name: "blogger root", submitter: "站长", submitterMail: "OWNER@example.test"},
		{name: "blogger replies visitor", submitter: "站长", submitterMail: "owner@example.test", parent: "访客", parentMail: "visitor@example.test", expected: []string{EventVisitorReply}},
		{name: "blogger replies blogger", submitter: "站长", submitterMail: "owner@example.test", parent: "站长", parentMail: "OWNER@example.test"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			database := setupNotificationTest(t)
			if err := database.Exec(`UPDATE sites SET blogger_nickname = '站长', blogger_email = 'owner@example.test' WHERE id = 'site-a'`).Error; err != nil {
				t.Fatal(err)
			}
			if err := database.Exec(`UPDATE notification_settings SET enabled = 1 WHERE channel IN ('email', 'telegram')`).Error; err != nil {
				t.Fatal(err)
			}
			var parentID *uint
			if test.parent != "" {
				parentEmail := test.parentMail
				parent := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", Username: test.parent, Email: &parentEmail, Content: "parent", IsBlogger: test.parent == "站长"}
				if err := database.Create(&parent).Error; err != nil {
					t.Fatal(err)
				}
				parentID = &parent.ID
			}
			submitterEmail := test.submitterMail
			comment := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", ParentID: parentID, Username: test.submitter, Email: &submitterEmail, Content: "comment", IsBlogger: test.submitter == "站长"}
			if err := database.Transaction(func(tx *gorm.DB) error {
				if err := tx.Create(&comment).Error; err != nil {
					return err
				}
				return EnqueueNewComment(tx, comment)
			}); err != nil {
				t.Fatal(err)
			}
			var events []string
			if err := database.Table("notification_outbox").Where("comment_id = ?", comment.ID).Order("event_type ASC").Pluck("event_type", &events).Error; err != nil {
				t.Fatal(err)
			}
			expected := append([]string(nil), test.expected...)
			slices.Sort(expected)
			if !slices.Equal(events, expected) {
				t.Fatalf("events=%v expected=%v", events, expected)
			}
		})
	}
}

func TestNotificationSecretsAreEncryptedAndRedacted(t *testing.T) {
	database := setupNotificationTest(t)
	saved, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.com", Port: 465, Encryption: "tls", Username: "mailer", Password: "private-smtp-password", FromAddress: "sender@example.com", Recipients: []string{"admin@example.com"}, Revision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !saved.PasswordSet || saved.Password != "" {
		t.Fatalf("saved=%#v", saved)
	}
	var row settingRow
	if err := database.Table("notification_settings").Where("channel = ?", ChannelEmail).First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if len(row.SecretCipher) == 0 || strings.Contains(string(row.SecretCipher), "private-smtp-password") {
		t.Fatal("SMTP password not encrypted")
	}
	email, telegram, err := GetSettings()
	if err != nil || email.Password != "" || telegram.Token != "" {
		t.Fatalf("settings leaked secret: %#v %#v %v", email, telegram, err)
	}
	if err := ValidateStoredSecrets(); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(row.ConfigJSON, "trigger") {
		t.Fatalf("removed trigger mode persisted: %s", row.ConfigJSON)
	}
}

func TestNewReplyQueuesBloggerAndDirectParentMailExactlyOnce(t *testing.T) {
	database := setupNotificationTest(t)
	if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.com", Port: 465, Encryption: "tls", Username: "mailer", Password: "password", FromAddress: "sender@example.com", Recipients: []string{"admin@example.com"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	parentEmail := "parent@example.com"
	parent := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", Username: "Parent", Email: &parentEmail, Content: "parent"}
	if err := database.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	replyEmail := "reply@example.com"
	reply := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", ParentID: &parent.ID, Username: "Reply", Email: &replyEmail, Content: "reply"}
	if err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&reply).Error; err != nil {
			return err
		}
		return EnqueueNewComment(tx, reply)
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.Transaction(func(tx *gorm.DB) error { return EnqueueNewComment(tx, reply) }); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := database.Table("notification_outbox").Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("outbox count=%d err=%v", count, err)
	}
	previousSender := sendSMTPMessage
	var recipients []string
	sendSMTPMessage = func(_ context.Context, _ EmailConfig, recipient string, _ emailMessage) error {
		recipients = append(recipients, recipient)
		return nil
	}
	t.Cleanup(func() { sendSMTPMessage = previousSender })
	for range 2 {
		processed, err := ProcessPendingOnce(context.Background())
		if err != nil || !processed {
			t.Fatalf("processed=%v err=%v", processed, err)
		}
	}
	if strings.Join(recipients, ",") != "admin@example.com,parent@example.com" {
		t.Fatalf("recipients=%#v", recipients)
	}
}

func TestPageURLStaysOnSiteHost(t *testing.T) {
	site := model.Site{SiteURL: "https://site.example"}
	tests := []struct {
		mark string
		want string
	}{
		{mark: "/post", want: "https://site.example/post"},
		{mark: "article-a", want: "https://site.example/article-a"},
		{mark: "https://evil.example/phish", want: "https://site.example"},
		{mark: "http://evil.example/phish", want: "https://site.example"},
		{mark: "//evil.example/phish", want: "https://site.example"},
		{mark: "///evil.example/phish", want: "https://site.example"},
		{mark: "javascript:alert(1)", want: "https://site.example"},
	}
	for _, test := range tests {
		if got := pageURL(site, test.mark); got != test.want {
			t.Fatalf("mark=%q got=%q want=%q", test.mark, got, test.want)
		}
	}
}

func TestNotificationTemplatesUseSiteNameArticleTitleAndEscapeText(t *testing.T) {
	setupNotificationTest(t)
	site := model.Site{ID: "site-a", Name: "Dejavu's Blog", Domain: "site.example", SiteURL: "https://site.example"}
	root := model.Comment{ID: 1, SiteID: "site-a", Mark: "/post", PageTitle: "文章标题", Username: "<作者>", Content: "<script>alert(1)</script>"}
	if err := model.DB.Create(&root).Error; err != nil {
		t.Fatal(err)
	}
	blogger, err := renderBloggerEmail(root, site)
	if err != nil {
		t.Fatal(err)
	}
	if blogger.Subject != "您在 Dejavu's Blog 上有新评论" || !strings.Contains(blogger.HTML, "文章标题") || strings.Contains(blogger.HTML, "<script>") {
		t.Fatalf("blogger template=%#v", blogger)
	}
	if !strings.Contains(blogger.HTML, "此邮件由 Dejavu&#39;s Blog 系统发送，请勿直接回复本邮件。") {
		t.Fatalf("footer missing: %s", blogger.HTML)
	}
	reply := model.Comment{ID: 2, SiteID: "site-a", Mark: "/post", PageTitle: "文章标题", ParentID: &root.ID, Username: "回复者", Content: "回复"}
	message, err := renderBloggerEmail(reply, site)
	if err != nil || message.Subject != "您在 Dejavu's Blog 上有新回复" {
		t.Fatalf("reply=%#v err=%v", message, err)
	}
	visitor := renderReplyEmail(reply, root, site, "https://site.example/post")
	if visitor.Subject != "你在 Dejavu's Blog 的评论收到了回复" {
		t.Fatalf("visitor subject=%q", visitor.Subject)
	}
	if !strings.Contains(blogger.HTML, "#ecoku-comment-1") || !strings.Contains(visitor.HTML, "#ecoku-comment-2") {
		t.Fatalf("missing comment anchors blogger=%s visitor=%s", blogger.HTML, visitor.HTML)
	}
	emptyTitle := model.Comment{ID: 3, SiteID: "site-a", Mark: "/untitled", Username: "访客", Content: "无标题"}
	untitled, err := renderBloggerEmail(emptyTitle, site)
	if err != nil || !strings.Contains(untitled.HTML, "这篇文章") {
		t.Fatalf("empty title=%#v err=%v", untitled, err)
	}
	telegram, err := renderTelegram(reply, site)
	if err != nil || strings.Contains(telegram, "审核") || !strings.Contains(telegram, "您在 Dejavu&#39;s Blog 上有新回复") {
		t.Fatalf("telegram=%q err=%v", telegram, err)
	}
	if !strings.Contains(telegram, "原评论") {
		t.Fatalf("telegram missing parent context: %q", telegram)
	}
}

func TestOutboxStoresOneRowPerTargetAndSkipsDuplicates(t *testing.T) {
	database := setupNotificationTest(t)
	if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.com", Port: 465, Encryption: "tls", Username: "mailer", Password: "password", FromAddress: "sender@example.com", Recipients: []string{"one@example.test", "two@example.test"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	email := "visitor@example.test"
	comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "访客", Email: &email, Content: "comment"}
	if err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&comment).Error; err != nil {
			return err
		}
		return EnqueueNewComment(tx, comment)
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.Transaction(func(tx *gorm.DB) error { return EnqueueNewComment(tx, comment) }); err != nil {
		t.Fatal(err)
	}
	var targets []string
	if err := database.Table("notification_outbox").Where("event_type = ?", EventBloggerEmail).Order("target ASC").Pluck("target", &targets).Error; err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(targets, []string{"one@example.test", "two@example.test"}) {
		t.Fatalf("targets=%v", targets)
	}
}

func TestStartWorkerRecoversAllProcessingRows(t *testing.T) {
	database := setupNotificationTest(t)
	email := "visitor@example.test"
	comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "访客", Email: &email, Content: "comment"}
	if err := database.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
	now := comment.CreatedAt
	if err := database.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, ?, 'processing', 1, ?, ?, NULL, ?, ?, NULL)`, EventBloggerEmail, comment.ID, "owner@example.test", now, now, now, now).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	worker, err := StartWorker(ctx)
	if err != nil {
		t.Fatal(err)
	}
	worker.Wait()
	var status, code string
	if err := database.Raw(`SELECT status, last_error_code FROM notification_outbox WHERE comment_id = ?`, comment.ID).Row().Scan(&status, &code); err != nil {
		t.Fatal(err)
	}
	if status != "failed" || code != "worker_recovered" {
		t.Fatalf("status=%q code=%q", status, code)
	}
}

func TestSMTPPayloadUsesRandomBoundaryAndQuotedPrintable(t *testing.T) {
	first, err := buildSMTPPayload("from@example.test", "to@example.test", emailMessage{Subject: "标题", Text: "plain", HTML: "<p>html</p>"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := buildSMTPPayload("from@example.test", "to@example.test", emailMessage{Subject: "标题", Text: "plain", HTML: "<p>html</p>"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(first), "Content-Transfer-Encoding: quoted-printable") {
		t.Fatalf("missing quoted-printable: %s", first)
	}
	if strings.Contains(string(first), "ecoku-boundary-7f53") {
		t.Fatal("fixed MIME boundary is still in use")
	}
	if string(first) == string(second) {
		t.Fatal("MIME boundary was not randomized")
	}
}
