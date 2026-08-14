package notifications

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/base64"
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
	telegram, err := renderTelegram(reply, site)
	if err != nil || strings.Contains(telegram, "审核") || !strings.Contains(telegram, "您在 Dejavu&#39;s Blog 上有新回复") {
		t.Fatalf("telegram=%q err=%v", telegram, err)
	}
}
