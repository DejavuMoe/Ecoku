package notifications

import (
	"bytes"
	"context"
	"ecoku-server/model"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

func enableBothChannels(t *testing.T) {
	t.Helper()
	if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.com", Port: 465, Encryption: "tls", Username: "mailer", Password: "password", FromAddress: "sender@example.com", Recipients: []string{"admin@example.com"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTelegram(TelegramConfig{Enabled: true, Token: "123:token", Targets: []string{"123456"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
}

func createAndEnqueue(t *testing.T, database *gorm.DB, comment *model.Comment) {
	t.Helper()
	if err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(comment).Error; err != nil {
			return err
		}
		return EnqueueNewComment(tx, *comment)
	}); err != nil {
		t.Fatal(err)
	}
}

func outboxStatus(t *testing.T, database *gorm.DB, eventType string, commentID uint) (string, string) {
	t.Helper()
	var row outboxRow
	if err := database.Table("notification_outbox").Where("event_type = ? AND comment_id = ?", eventType, commentID).First(&row).Error; err != nil {
		t.Fatalf("%s for comment %d: %v", eventType, commentID, err)
	}
	code := ""
	if row.LastErrorCode != nil {
		code = *row.LastErrorCode
	}
	return row.Status, code
}

func TestEmailUsesExplicitSmojiImageOrigin(t *testing.T) {
	site := model.Site{SmojiEnabled: true, SmojiManifestURL: "https://blog.example/smoji.json", SmojiImageOrigin: "https://cdn.example"}
	content := "![smoji:允许](https://cdn.example/face.webp) ![smoji:拒绝](https://blog.example/face.webp)"
	got := emailContentHTML(content, site)
	if !strings.Contains(got, `<img src="https://cdn.example/face.webp"`) || strings.Contains(got, `<img src="https://blog.example/face.webp"`) {
		t.Fatalf("wrong trust boundary: %s", got)
	}
	site.SmojiEnabled = false
	if strings.Contains(emailContentHTML(content, site), "<img") {
		t.Fatal("disabled stickers rendered in email")
	}
}

func TestEmailV6RendersSmojiTimeZoneAndDesignTokens(t *testing.T) {
	database := setupNotificationTest(t)
	t.Setenv("TZ", "Asia/Shanghai")
	site := model.Site{ID: "site-a", Domain: "site.example", SiteURL: "https://site.example", SmojiEnabled: true, SmojiManifestURL: "https://static.example/smoji.json", BloggerBadge: "[博主]"}
	parent := model.Comment{SiteID: "site-a", Mark: "/post", PageTitle: "文章", Username: "站长", IsBlogger: true, Content: "第一行\n第二行"}
	if err := database.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	reply := model.Comment{
		ID: 900, SiteID: "site-a", Mark: "/post", PageTitle: "文章", ParentID: &parent.ID, Username: "访客",
		Content:   "好 ![smoji:挥手](https://static.example/cats/wave.webp) ![smoji:外站](https://other.example/x.webp)",
		CreatedAt: time.Date(2026, 9, 29, 2, 3, 0, 0, time.UTC),
	}
	message, err := renderBloggerEmail(reply, site)
	if err != nil {
		t.Fatal(err)
	}
	if message.Subject != "您在 site.example 上有新回复：文章" || message.SenderName != "site.example" {
		t.Fatalf("subject=%q sender=%q", message.Subject, message.SenderName)
	}
	for _, want := range []string{
		`<img src="https://static.example/cats/wave.webp" alt="[表情：挥手]" height="28"`,
		"[表情：外站]",
		"2026/09/29 10:03 (UTC+8)",
		"第一行<br>第二行",
		`>[博主]</span> 的评论`,
		"color:#9a4733",
		"font-family:-apple-system",
		`<!--[if mso]>`,
		`class="email-seal"`,
		`background-color:#b8472f`,
		`@media (prefers-color-scheme:dark)`,
		"#ecoku-comment-900",
	} {
		if !strings.Contains(message.HTML, want) {
			t.Fatalf("HTML missing %q", want)
		}
	}
	for _, unwanted := range []string{"![smoji:", "other.example", "font-family:Arial", "display:grid", "white-space:pre-wrap", "rgb(43,91,113)"} {
		if strings.Contains(message.HTML, unwanted) {
			t.Fatalf("HTML contains %q", unwanted)
		}
	}
	if !strings.Contains(message.Text, "站长 [博主] 的评论：\n第一行\n第二行") || !strings.Contains(message.Text, "访客 的回复：\n好 [表情：挥手] [表情：外站]") {
		t.Fatalf("text=%q", message.Text)
	}
	telegram, err := renderTelegram(reply, site)
	if err != nil || strings.Contains(telegram, "![smoji:") || !strings.Contains(telegram, "发布时间：2026/09/29 10:03 (UTC+8)") || !strings.Contains(telegram, "[表情：挥手]") {
		t.Fatalf("telegram=%q err=%v", telegram, err)
	}
	for seconds, want := range map[int]string{0: "UTC+0", 28800: "UTC+8", -12600: "UTC-3:30", 20700: "UTC+5:45"} {
		if got := utcOffsetLabel(seconds); got != want {
			t.Fatalf("offset %d = %q, want %q", seconds, got, want)
		}
	}
}

func TestSMTPPayloadCarriesDateMessageIDAndAutomationHeaders(t *testing.T) {
	payload, err := buildSMTPPayload("notify@mail.example", "owner@example.test", emailMessage{
		Subject: "您在 A 上有新评论：标题\r\nBcc: someone@example.test", SenderName: "Dejavu's Blog", Text: "t", HTML: "<p>h</p>",
	})
	if err != nil {
		t.Fatal(err)
	}
	header := string(payload[:bytes.Index(payload, []byte("\r\n\r\n"))])
	for _, want := range []string{"From: \"Dejavu's Blog\" <notify@mail.example>\r\n", "To: <owner@example.test>\r\n", "\r\nDate: ", "\r\nAuto-Submitted: auto-generated\r\n", "\r\nX-Auto-Response-Suppress: All\r\n"} {
		if !strings.Contains(header, want) {
			t.Fatalf("header missing %q:\n%s", want, header)
		}
	}
	if !regexp.MustCompile(`\r\nMessage-ID: <[0-9a-f]{32}@mail\.example>\r\n`).MatchString(header) {
		t.Fatalf("Message-ID missing:\n%s", header)
	}
	if strings.Contains(header, "\r\nBcc:") {
		t.Fatalf("subject injected a header:\n%s", header)
	}
}

func TestDeletedCommentCancelsQueueRemovesReplyMailAndRetractsTelegram(t *testing.T) {
	database := setupNotificationTest(t)
	enableBothChannels(t)
	parentEmail := "parent@example.test"
	deleted := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", Username: "将被删除", Email: &parentEmail, Content: "私密内容"}
	createAndEnqueue(t, database, &deleted)
	replyEmail := "reply@example.test"
	reply := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "文章", ParentID: &deleted.ID, Username: "回复者", Email: &replyEmail, Content: "回复内容"}
	createAndEnqueue(t, database, &reply)

	// Only the Telegram notice for the soon-deleted comment goes out first.
	future := time.Now().UTC().Add(time.Hour)
	if err := database.Exec(`UPDATE notification_outbox SET available_at = ? WHERE NOT (event_type = ? AND comment_id = ?)`, future, EventBloggerTelegram, deleted.ID).Error; err != nil {
		t.Fatal(err)
	}
	oldSend, oldEdit := sendTelegramMessage, editTelegramMessage
	t.Cleanup(func() { sendTelegramMessage, editTelegramMessage = oldSend, oldEdit })
	sendTelegramMessage = func(context.Context, string, string, string) (string, error) { return "77", nil }
	var editedID, editedText string
	editTelegramMessage = func(_ context.Context, _, _, messageID, message string) error {
		editedID, editedText = messageID, message
		return nil
	}
	if processed, err := ProcessPendingOnce(context.Background()); err != nil || !processed {
		t.Fatalf("processed=%v err=%v", processed, err)
	}

	if err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Comment{}).Where("id = ?", deleted.ID).Updates(map[string]any{
			"username": "", "email": nil, "url": nil, "content": "", "is_blogger": false, "deleted_at": time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
		return CancelForDeletedComment(tx, deleted.ID)
	}); err != nil {
		t.Fatal(err)
	}

	if status, code := outboxStatus(t, database, EventBloggerEmail, deleted.ID); status != "cancelled" || code != "comment_deleted" {
		t.Fatalf("deleted comment email status=%q code=%q", status, code)
	}
	var replyMail int64
	database.Table("notification_outbox").Where("event_type = ? AND comment_id = ?", EventVisitorReply, reply.ID).Count(&replyMail)
	if replyMail != 0 {
		t.Fatal("reply mail to the erased address is still queued")
	}
	if status, _ := outboxStatus(t, database, EventBloggerEmail, reply.ID); status != "pending" {
		t.Fatalf("unrelated reply notification status=%q", status)
	}
	if status, _ := outboxStatus(t, database, EventBloggerTelegramRetract, deleted.ID); status != "pending" {
		t.Fatalf("retract status=%q", status)
	}

	if processed, err := ProcessPendingOnce(context.Background()); err != nil || !processed {
		t.Fatalf("retract processed=%v err=%v", processed, err)
	}
	if editedID != "77" || !strings.Contains(editedText, "这条评论已被删除，通知内容已移除。") || strings.Contains(editedText, "将被删除") || strings.Contains(editedText, "私密内容") {
		t.Fatalf("edited id=%q text=%q", editedID, editedText)
	}
	if status, _ := outboxStatus(t, database, EventBloggerTelegramRetract, deleted.ID); status != "sent" {
		t.Fatalf("retract status after delivery=%q", status)
	}
	// Deleting again queues nothing new.
	if err := CancelForDeletedComment(database, deleted.ID); err != nil {
		t.Fatal(err)
	}
	var retracts int64
	database.Table("notification_outbox").Where("event_type = ?", EventBloggerTelegramRetract).Count(&retracts)
	if retracts != 1 {
		t.Fatalf("retract rows=%d", retracts)
	}
}

func TestBloggerNotificationForTombstoneIsCancelledAtDelivery(t *testing.T) {
	database := setupNotificationTest(t)
	enableBothChannels(t)
	comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "访客", Content: "内容"}
	createAndEnqueue(t, database, &comment)
	// A row already claimed when the comment was deleted is re-checked before sending.
	if err := database.Model(&model.Comment{}).Where("id = ?", comment.ID).Updates(map[string]any{"username": "", "content": "", "deleted_at": time.Now().UTC()}).Error; err != nil {
		t.Fatal(err)
	}
	oldSMTP, oldSend := sendSMTPMessage, sendTelegramMessage
	t.Cleanup(func() { sendSMTPMessage, sendTelegramMessage = oldSMTP, oldSend })
	sendSMTPMessage = func(context.Context, EmailConfig, string, emailMessage) error {
		t.Fatal("mail sent for tombstone")
		return nil
	}
	sendTelegramMessage = func(context.Context, string, string, string) (string, error) {
		t.Fatal("telegram sent for tombstone")
		return "", nil
	}
	for range 2 {
		if processed, err := ProcessPendingOnce(context.Background()); err != nil || !processed {
			t.Fatalf("processed=%v err=%v", processed, err)
		}
	}
	for _, event := range []string{EventBloggerEmail, EventBloggerTelegram} {
		if status, _ := outboxStatus(t, database, event, comment.ID); status != "cancelled" {
			t.Fatalf("%s status=%q", event, status)
		}
	}
}

func TestPermanentFailuresAndAttemptLimitExhaustRows(t *testing.T) {
	database := setupNotificationTest(t)
	if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.com", Port: 465, Encryption: "tls", Password: "password", FromAddress: "sender@example.com", Recipients: []string{"admin@example.com"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	oldSMTP := sendSMTPMessage
	t.Cleanup(func() { sendSMTPMessage = oldSMTP })
	tests := []struct {
		name     string
		attempts int
		err      error
		status   string
		code     string
		delay    time.Duration
	}{
		{name: "retryable", attempts: 0, err: errors.New("connection reset"), status: "failed", code: "delivery_failed", delay: 2 * time.Minute},
		{name: "permanent", attempts: 0, err: &deliveryFailure{code: "recipient_rejected", permanent: true}, status: "exhausted", code: "recipient_rejected"},
		{name: "last attempt", attempts: maxDeliveryAttempts - 1, err: errors.New("connection reset"), status: "exhausted", code: "delivery_failed"},
		{name: "retry after", attempts: 0, err: &deliveryFailure{code: "rate_limited", retryAfter: 15 * time.Minute}, status: "failed", code: "rate_limited", delay: 15 * time.Minute},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			comment := model.Comment{SiteID: "site-a", Mark: "/", Username: "guest", Content: test.name}
			createAndEnqueue(t, database, &comment)
			if err := database.Exec(`UPDATE notification_outbox SET attempts = ? WHERE comment_id = ?`, test.attempts, comment.ID).Error; err != nil {
				t.Fatal(err)
			}
			sendSMTPMessage = func(context.Context, EmailConfig, string, emailMessage) error { return test.err }
			started := time.Now().UTC()
			if processed, err := ProcessPendingOnce(context.Background()); err != nil || !processed {
				t.Fatalf("processed=%v err=%v", processed, err)
			}
			var row outboxRow
			if err := database.Table("notification_outbox").Where("comment_id = ?", comment.ID).First(&row).Error; err != nil {
				t.Fatal(err)
			}
			if row.Status != test.status || row.LastErrorCode == nil || *row.LastErrorCode != test.code {
				t.Fatalf("status=%q code=%v", row.Status, row.LastErrorCode)
			}
			if test.delay > 0 && (row.AvailableAt.Before(started.Add(test.delay-time.Second)) || row.AvailableAt.After(started.Add(test.delay+time.Minute))) {
				t.Fatalf("available_at=%s started=%s delay=%s", row.AvailableAt, started, test.delay)
			}
			if processed, err := ProcessPendingOnce(context.Background()); err != nil || processed {
				t.Fatalf("row was claimed again processed=%v err=%v", processed, err)
			}
		})
	}
}

func TestTelegramAPIResponsesAreClassified(t *testing.T) {
	var lastPath string
	var lastBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastPath = r.URL.Path
		lastBody = map[string]any{}
		_ = json.NewDecoder(r.Body).Decode(&lastBody)
		switch lastBody["chat_id"] {
		case "ok":
			_, _ = w.Write([]byte(`{"ok":true,"result":{"message_id":321}}`))
		case "limited":
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"ok":false,"error_code":429,"description":"Too Many Requests","parameters":{"retry_after":900}}`))
		case "blocked":
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}`))
		case "token":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"ok":false,"error_code":401,"description":"Unauthorized"}`))
		case "same":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"ok":false,"error_code":400,"description":"Bad Request: message is not modified"}`))
		default:
			w.WriteHeader(http.StatusBadGateway)
		}
	}))
	defer server.Close()
	previous := telegramAPIBaseURL
	telegramAPIBaseURL = server.URL
	t.Cleanup(func() { telegramAPIBaseURL = previous })
	ctx := context.Background()

	id, err := deliverTelegram(ctx, "t", "ok", "<b>hi</b>")
	preview, _ := lastBody["link_preview_options"].(map[string]any)
	if err != nil || id != "321" || !strings.HasSuffix(lastPath, "/sendMessage") || preview["is_disabled"] != true {
		t.Fatalf("id=%q err=%v path=%q body=%v", id, err, lastPath, lastBody)
	}
	var failure *deliveryFailure
	if _, err := deliverTelegram(ctx, "t", "limited", "x"); !errors.As(err, &failure) || failure.permanent || failure.retryAfter != 900*time.Second {
		t.Fatalf("rate limit err=%v", err)
	}
	if _, err := deliverTelegram(ctx, "t", "blocked", "x"); !errors.As(err, &failure) || !failure.permanent || outboxErrorCode(err) != "telegram_rejected" {
		t.Fatalf("blocked err=%v", err)
	}
	if _, err := deliverTelegram(ctx, "t", "token", "x"); !errors.As(err, &failure) || failure.permanent || deliveryErrorCode(err) != "authentication_failed" {
		t.Fatalf("token err=%v", err)
	}
	if _, err := deliverTelegram(ctx, "t", "down", "x"); err == nil || errors.As(err, &failure) || deliveryErrorCode(err) != "delivery_failed" {
		t.Fatalf("upstream err=%v", err)
	}
	if err := editTelegram(ctx, "t", "same", "5", "x"); err != nil || !strings.HasSuffix(lastPath, "/editMessageText") || lastBody["message_id"] != float64(5) {
		t.Fatalf("edit err=%v path=%q body=%v", err, lastPath, lastBody)
	}
}

func TestPruneOutboxRemovesOnlyOldFinishedRows(t *testing.T) {
	database := setupNotificationTest(t)
	comment := model.Comment{SiteID: "site-a", Mark: "/", Username: "guest", Content: "hello"}
	if err := database.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	old := now.Add(-outboxRetention - time.Hour)
	rows := []struct {
		target  string
		status  string
		updated time.Time
	}{
		{"old-sent", "sent", old}, {"old-cancelled", "cancelled", old}, {"old-exhausted", "exhausted", old},
		{"old-failed", "failed", old}, {"old-pending", "pending", old}, {"recent-sent", "sent", now},
	}
	for _, row := range rows {
		if err := database.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, ?, ?, 1, ?, NULL, NULL, ?, ?, NULL)`, EventBloggerEmail, comment.ID, row.target, row.status, old, old, row.updated).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := pruneOutbox(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	var remaining []string
	if err := database.Table("notification_outbox").Order("target ASC").Pluck("target", &remaining).Error; err != nil {
		t.Fatal(err)
	}
	if strings.Join(remaining, ",") != "old-failed,old-pending,recent-sent" {
		t.Fatalf("remaining=%v", remaining)
	}
}

func TestStartWorkerExhaustsRecoveredRowsWithoutAttemptsLeft(t *testing.T) {
	database := setupNotificationTest(t)
	comment := model.Comment{SiteID: "site-a", Mark: "/", Username: "guest", Content: "hello"}
	if err := database.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if err := database.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, 'owner@example.test', 'processing', ?, ?, ?, NULL, ?, ?, NULL)`, EventBloggerEmail, comment.ID, maxDeliveryAttempts, now, now, now, now).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	worker, err := StartWorker(ctx)
	if err != nil {
		t.Fatal(err)
	}
	worker.Wait()
	if status, code := outboxStatus(t, database, EventBloggerEmail, comment.ID); status != "exhausted" || code != "worker_recovered" {
		t.Fatalf("status=%q code=%q", status, code)
	}
}
