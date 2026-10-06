package notifications

import (
	"context"
	"ecoku-server/internal/testsite"
	"ecoku-server/model"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

// These tests replace every transport, including channels a fixture disables.
// Do not run them in parallel: the existing notification fixtures use globals.
func auditLifecycleTransports(t *testing.T) {
	t.Helper()
	oldSMTP, oldSend, oldEdit := sendSMTPMessage, sendTelegramMessage, editTelegramMessage
	t.Cleanup(func() {
		sendSMTPMessage, sendTelegramMessage, editTelegramMessage = oldSMTP, oldSend, oldEdit
	})
	unexpected := func() error {
		t.Error("unexpected notification transport call")
		return errors.New("unexpected test transport")
	}
	sendSMTPMessage = func(context.Context, EmailConfig, string, emailMessage) error { return unexpected() }
	sendTelegramMessage = func(context.Context, string, string, string) (string, error) { return "", unexpected() }
	editTelegramMessage = func(context.Context, string, string, string, string) error { return unexpected() }
}

// Match admin.tombstoneComment's site-scoped update and same-transaction
// cancellation without importing the caller of package notifications.
func auditLifecycleTombstone(t *testing.T, database *gorm.DB, parent model.Comment) {
	t.Helper()
	if err := auditLifecycleDelete(database.Statement.Context, database, parent); err != nil {
		t.Fatal(err)
	}
	var stored model.Comment
	if err := database.Where("id = ? AND site_id = ?", parent.ID, parent.SiteID).First(&stored).Error; err != nil {
		t.Fatal(err)
	}
	if stored.DeletedAt == nil || stored.Username != "" || stored.Email != nil || stored.URL != nil || stored.Content != "" || stored.IsBlogger {
		t.Fatal("parent personal fields were not cleared")
	}
}

func auditLifecycleDelete(ctx context.Context, database *gorm.DB, parent model.Comment) error {
	return WithCommentLifecycle(ctx, func() error {
		return database.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			now := time.Now().UTC()
			result := tx.Model(&model.Comment{}).
				Where("id = ? AND site_id = ? AND deleted_at IS NULL", parent.ID, parent.SiteID).
				Updates(map[string]any{
					"username": "", "email": nil, "url": nil, "content": "",
					"is_blogger": false, "deleted_at": now, "updated_at": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("expected one live parent to tombstone")
			}
			return CancelForDeletedComment(tx, parent.ID)
		})
	})
}

func TestAuditV4DeletedParentStopsClaimedReplyEmail(t *testing.T) {
	for _, stage := range []string{"after_parent_check_before_settings", "before_parent_read"} {
		t.Run(stage, func(t *testing.T) {
			database := setupNotificationTest(t)
			auditLifecycleTransports(t)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			database = database.WithContext(ctx)
			model.DB = database
			if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.test", Port: 465, Encryption: "tls", Password: "dummy-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}, Revision: 1}); err != nil {
				t.Fatal(err)
			}
			parentEmail, replyEmail, parentURL := "parent@example.test", "reply@example.test", "https://parent.example.test"
			parent := model.Comment{SiteID: "site-a", Mark: "/article", Username: "ParentDummy", Email: &parentEmail, URL: &parentURL, Content: "PARENT_MARKER_7Q"}
			createAndEnqueue(t, database, &parent)
			reply := model.Comment{SiteID: "site-a", Mark: parent.Mark, ParentID: &parent.ID, Username: "ReplyDummy", Email: &replyEmail, Content: "REPLY_MARKER_8Q"}
			createAndEnqueue(t, database, &reply)
			if err := database.Exec(`UPDATE notification_outbox SET available_at = ? WHERE NOT (event_type = ? AND comment_id = ?)`, time.Now().UTC().Add(time.Hour), EventVisitorReply, reply.ID).Error; err != nil {
				t.Fatal(err)
			}
			calls := 0
			var recipient string
			var message emailMessage
			sendSMTPMessage = func(_ context.Context, _ EmailConfig, target string, body emailMessage) error {
				calls++
				recipient, message = target, body
				return nil
			}
			sqlDB, err := database.DB()
			if err != nil {
				t.Fatal(err)
			}
			armed, replyRead, parentRead, deleted := true, false, false, false
			const observe = "audit_v4_observe_parent"
			if err := database.Callback().Query().After("gorm:query").Register(observe, func(tx *gorm.DB) {
				comment, ok := tx.Statement.Dest.(*model.Comment)
				if !armed || !ok || tx.Error != nil || tx.RowsAffected != 1 {
					return
				}
				if comment.ID == reply.ID {
					replyRead = true
				}
				if comment.ID == parent.ID {
					if comment.DeletedAt != nil || comment.Email == nil || *comment.Email != parentEmail || comment.Content != parent.Content {
						t.Fatal("worker did not read the live parent fixture")
					}
					parentRead = true
				}
			}); err != nil {
				t.Fatal(err)
			}
			defer database.Callback().Query().Remove(observe)
			const barrier = "audit_v4_delete_before_query"
			if err := database.Callback().Query().Before("gorm:query").Register(barrier, func(tx *gorm.DB) {
				if !armed || !replyRead {
					return
				}
				beforeParent := stage == "before_parent_read"
				if (beforeParent && tx.Statement.Table != "comments") || (!beforeParent && tx.Statement.Table != "notification_settings") {
					return
				}
				if parentRead == beforeParent {
					t.Fatal("wrong parent-read ordering at deletion barrier")
				}
				// Query callbacks run synchronously. Returning resumes the worker;
				// the settings barrier is after the parent's DeletedAt guard.
				armed = false
				if calls != 0 || sqlDB.Stats().InUse != 0 {
					t.Fatal("barrier must precede sending and hold no database connection")
				}
				if status, _ := outboxStatus(t, database, EventVisitorReply, reply.ID); status != "processing" {
					t.Fatalf("reply email status at barrier=%q", status)
				}
				auditLifecycleTombstone(t, database, parent)
				var remaining int64
				if err := database.Table("notification_outbox").Where("event_type = ? AND comment_id = ?", EventVisitorReply, reply.ID).Count(&remaining).Error; err != nil || remaining != 0 {
					t.Fatalf("reply email remains after deletion: count=%d err=%v", remaining, err)
				}
				deleted = true
			}); err != nil {
				t.Fatal(err)
			}
			defer database.Callback().Query().Remove(barrier)
			processed, err := ProcessPendingOnce(ctx)
			if err != nil || !processed || !deleted || ctx.Err() != nil {
				t.Fatalf("processed=%v deleted=%v err=%v context=%v", processed, deleted, err, ctx.Err())
			}
			if calls != 0 {
				t.Fatalf("sender called after parent deletion: calls=%d recipient=%q parent_in_text=%v parent_in_html=%v", calls, recipient, strings.Contains(message.Text, parent.Content), strings.Contains(message.HTML, parent.Content))
			}
		})
	}
}

func TestAuditV5ParentTombstoneRefreshesSentTelegramReply(t *testing.T) {
	database := setupNotificationTest(t)
	auditLifecycleTransports(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	database = database.WithContext(ctx)
	model.DB = database
	testsite.Create(t, database, testsite.Site{ID: "site-b", Name: "OtherSite", SiteURL: "https://site-b.example.test"})
	if _, err := SaveTelegram(TelegramConfig{Enabled: true, Token: "123:token", Targets: []string{"123456"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	parentEmail, parentURL := "parent@example.test", "https://parent.example.test"
	parent := model.Comment{SiteID: "site-a", Mark: "/article", PageTitle: "ArticleDummy", Username: "ParentDummy", Email: &parentEmail, URL: &parentURL, Content: "PARENT_MARKER_7Q"}
	createAndEnqueue(t, database, &parent)
	reply := model.Comment{SiteID: parent.SiteID, Mark: parent.Mark, PageTitle: parent.PageTitle, ParentID: &parent.ID, Username: "ReplyDummy", Content: "REPLY_MARKER_8Q"}
	createAndEnqueue(t, database, &reply)
	unrelated := model.Comment{SiteID: "site-b", Mark: parent.Mark, PageTitle: parent.PageTitle, Username: "UnrelatedDummy", Content: "UNRELATED_MARKER_9Q"}
	createAndEnqueue(t, database, &unrelated)
	// Keys are (target, provider message ID), just as an edit addresses a message.
	messages := map[[2]string]string{}
	edits := map[[2]string]int{}
	sends := 0
	sendTelegramMessage = func(_ context.Context, _, target, message string) (string, error) {
		sends++
		id := strconv.Itoa(100 + sends)
		messages[[2]string{target, id}] = message
		return id, nil
	}
	editTelegramMessage = func(_ context.Context, _, target, id, message string) error {
		key := [2]string{target, id}
		if _, ok := messages[key]; !ok {
			t.Error("edit targeted an unknown mock message")
			return errors.New("unknown mock message")
		}
		messages[key] = message
		edits[key]++
		return nil
	}
	keys := map[uint][2]string{}
	for _, comment := range []model.Comment{parent, reply, unrelated} {
		if processed, err := ProcessPendingOnce(ctx); err != nil || !processed {
			t.Fatalf("initial delivery: processed=%v err=%v", processed, err)
		}
		var row outboxRow
		if err := database.Table("notification_outbox").Where("event_type = ? AND comment_id = ?", EventBloggerTelegram, comment.ID).First(&row).Error; err != nil {
			t.Fatal(err)
		}
		if row.Status != "sent" || row.ProviderMessageID == nil || *row.ProviderMessageID == "" || row.Target != "123456" {
			t.Fatalf("comment %d has no sent Telegram receipt", comment.ID)
		}
		key := [2]string{row.Target, *row.ProviderMessageID}
		keys[comment.ID] = key
		if !strings.Contains(messages[key], comment.Content) {
			t.Fatalf("initial message missing comment %d", comment.ID)
		}
	}
	p, r, u := keys[parent.ID], keys[reply.ID], keys[unrelated.ID]
	if p == r || p == u || r == u || len(messages) != 3 || sends != 3 {
		t.Fatal("initial notifications must have three distinct provider message IDs")
	}
	if !strings.Contains(messages[r], parent.Content) || !strings.Contains(messages[r], parent.Username) {
		t.Fatal("reply did not initially quote the live parent")
	}
	unrelatedBefore := messages[u]
	auditLifecycleTombstone(t, database, parent)
	for range 4 {
		processed, err := ProcessPendingOnce(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if !processed {
			break
		}
	}
	var unfinished int64
	if err := database.Table("notification_outbox").Where("status IN ('pending', 'failed', 'processing')").Count(&unfinished).Error; err != nil || unfinished != 0 || ctx.Err() != nil {
		t.Fatalf("retraction did not finish within four calls: unfinished=%d err=%v context=%v", unfinished, err, ctx.Err())
	}
	if edits[p] == 0 || strings.Contains(messages[p], parent.Content) || strings.Contains(messages[p], parent.Username) || !strings.Contains(messages[p], parent.PageTitle) {
		t.Errorf("parent message was not redacted: edits=%d text=%q", edits[p], messages[p])
	}
	if edits[r] == 0 || strings.Contains(messages[r], parent.Content) || strings.Contains(messages[r], parent.Username) {
		t.Errorf("sent reply retains deleted parent reference: edits=%d text=%q", edits[r], messages[r])
	}
	if !strings.Contains(messages[r], reply.Content) || !strings.Contains(messages[r], reply.Username) {
		t.Error("refresh removed the live reply's own content")
	}
	if messages[u] != unrelatedBefore || edits[u] != 0 || sends != 3 {
		t.Error("retraction changed another site's message or sent a new message")
	}
	var liveReply model.Comment
	if err := database.First(&liveReply, reply.ID).Error; err != nil || liveReply.DeletedAt != nil || liveReply.Content != reply.Content || liveReply.Username != reply.Username {
		t.Fatalf("reply must remain live and unchanged: err=%v", err)
	}
	// The existing unique retract row must be rearmed when R itself is deleted.
	auditLifecycleTombstone(t, database, reply)
	if processed, err := ProcessPendingOnce(ctx); err != nil || !processed {
		t.Fatalf("reply retraction: processed=%v err=%v", processed, err)
	}
	if edits[r] != 2 || strings.Contains(messages[r], reply.Content) || strings.Contains(messages[r], reply.Username) || messages[u] != unrelatedBefore || edits[u] != 0 || sends != 3 {
		t.Fatal("deleting the previously refreshed reply did not retract its own message")
	}
}

func TestAuditV4LifecycleGateOrdersSendAndDeletion(t *testing.T) {
	for _, cancelSend := range []bool{false, true} {
		t.Run(strconv.FormatBool(cancelSend), func(t *testing.T) {
			database := setupNotificationTest(t)
			auditLifecycleTransports(t)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.test", Port: 465, Encryption: "tls", Password: "dummy-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}, Revision: 1}); err != nil {
				t.Fatal(err)
			}
			comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "Dummy", Content: "DUMMY_MARKER"}
			createAndEnqueue(t, database, &comment)
			sqlDB, err := database.DB()
			if err != nil {
				t.Fatal(err)
			}
			entered, release, senderDone := make(chan struct{}), make(chan struct{}), make(chan struct{})
			sendSMTPMessage = func(sendCtx context.Context, _ EmailConfig, _ string, _ emailMessage) error {
				defer close(senderDone)
				if sqlDB.Stats().InUse != 0 {
					t.Error("transport retained a database connection/transaction")
				}
				close(entered)
				select {
				case <-release:
					return nil
				case <-sendCtx.Done():
					return sendCtx.Err()
				}
			}
			workerCtx, stopWorker := context.WithCancel(ctx)
			defer stopWorker()
			workerDone := make(chan error, 1)
			go func() { _, err := ProcessPendingOnce(workerCtx); workerDone <- err }()
			workerJoined := false
			// Always drain before global mock/database cleanup, including failed assertions.
			defer func() {
				stopWorker()
				if workerJoined {
					return
				}
				select {
				case <-workerDone:
				case <-time.After(time.Second):
					t.Error("notification worker did not stop")
				}
			}()
			select {
			case <-entered:
			case <-ctx.Done():
				t.Fatal("sender did not enter")
			}
			waitCtx, stopWait := context.WithTimeout(ctx, 25*time.Millisecond)
			err = auditLifecycleDelete(waitCtx, database, comment)
			stopWait()
			if !errors.Is(err, context.DeadlineExceeded) {
				t.Fatalf("deletion must wait for sender and honor cancellation: %v", err)
			}
			var stored model.Comment
			if err := database.WithContext(ctx).First(&stored, comment.ID).Error; err != nil || stored.DeletedAt != nil {
				t.Fatalf("cancelled gate waiter changed the comment: %v", err)
			}
			const ordering = "audit_v4_delete_order"
			if err := database.Callback().Update().Before("gorm:begin_transaction").Register(ordering, func(tx *gorm.DB) {
				if tx.Statement.Table == "comments" {
					select {
					case <-senderDone:
					default:
						t.Error("deletion started before active sender finished")
					}
				}
			}); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = database.Callback().Update().Remove(ordering) })
			deletionDone := make(chan error, 1)
			go func() { deletionDone <- auditLifecycleDelete(ctx, database, comment) }()
			deletionJoined := false
			defer func() {
				cancel()
				if !deletionJoined {
					select {
					case <-deletionDone:
					case <-time.After(time.Second):
						t.Error("deletion did not stop")
					}
				}
			}()
			if cancelSend {
				stopWorker()
			} else {
				close(release)
			}
			select {
			case err := <-deletionDone:
				deletionJoined = true
				if err != nil {
					t.Fatal(err)
				}
			case <-ctx.Done():
				t.Fatal("deletion did not proceed after sender stopped")
			}
			select {
			case err := <-workerDone:
				workerJoined = true
				if (!cancelSend && err != nil) || (cancelSend && !errors.Is(err, context.Canceled)) {
					t.Fatalf("worker completion error=%v cancelSend=%v", err, cancelSend)
				}
			case <-ctx.Done():
				t.Fatal("worker did not finish")
			}
		})
	}
}

func TestAuditV4ClaimedBloggerNotificationRechecksTombstone(t *testing.T) {
	for _, channel := range []string{ChannelEmail, ChannelTelegram} {
		t.Run(channel, func(t *testing.T) {
			database := setupNotificationTest(t)
			auditLifecycleTransports(t)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			database = database.WithContext(ctx)
			model.DB = database
			event := EventBloggerTelegram
			if channel == ChannelEmail {
				event = EventBloggerEmail
				if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.test", Port: 465, Encryption: "tls", Password: "dummy-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}, Revision: 1}); err != nil {
					t.Fatal(err)
				}
			} else if _, err := SaveTelegram(TelegramConfig{Enabled: true, Token: "123:token", Targets: []string{"123456"}, Revision: 1}); err != nil {
				t.Fatal(err)
			}
			comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "Dummy", Content: "DUMMY_MARKER"}
			createAndEnqueue(t, database, &comment)
			deleted := false
			const barrier = "audit_v4_blogger_delete"
			if err := database.Callback().Query().Before("gorm:query").Register(barrier, func(tx *gorm.DB) {
				if deleted || tx.Statement.Table != "notification_settings" {
					return
				}
				deleted = true
				auditLifecycleTombstone(t, database, comment)
				if status, _ := outboxStatus(t, database, event, comment.ID); status != "processing" {
					t.Fatalf("fixture must retain the original claim: %q", status)
				}
			}); err != nil {
				t.Fatal(err)
			}
			defer database.Callback().Query().Remove(barrier)
			if processed, err := ProcessPendingOnce(ctx); err != nil || !processed || !deleted {
				t.Fatalf("processed=%v deleted=%v err=%v", processed, deleted, err)
			}
			if status, _ := outboxStatus(t, database, event, comment.ID); status != "cancelled" {
				t.Fatalf("tombstone claim was not cancelled: %q", status)
			}
		})
	}
}

func TestAuditV4WorkerWaitsHonorContext(t *testing.T) {
	for _, resource := range []string{"gate", "database"} {
		t.Run(resource, func(t *testing.T) {
			database := setupNotificationTest(t)
			auditLifecycleTransports(t)
			if _, err := SaveTelegram(TelegramConfig{Enabled: true, Token: "123:token", Targets: []string{"123456"}, Revision: 1}); err != nil {
				t.Fatal(err)
			}
			comment := model.Comment{SiteID: "site-a", Mark: "/article", Username: "Dummy", Content: "DUMMY_MARKER"}
			createAndEnqueue(t, database, &comment)
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			result := make(chan error, 1)
			joined := false
			check := func() error {
				waitCtx, stop := context.WithTimeout(ctx, 25*time.Millisecond)
				defer stop()
				go func() { _, err := ProcessPendingOnce(waitCtx); result <- err }()
				select {
				case err := <-result:
					joined = true
					if !errors.Is(err, context.DeadlineExceeded) {
						t.Errorf("worker waiting for %s did not return context deadline: %v", resource, err)
					}
				case <-time.After(250 * time.Millisecond):
					t.Errorf("worker did not stop while %s remained held", resource)
				}
				return nil
			}
			if resource == "gate" {
				if err := WithCommentLifecycle(ctx, check); err != nil {
					t.Fatal(err)
				}
			} else {
				sqlDB, err := database.DB()
				if err != nil {
					t.Fatal(err)
				}
				connection, err := sqlDB.Conn(ctx)
				if err != nil {
					t.Fatal(err)
				}
				_ = check()
				_ = connection.Close()
			}
			// Release the held resource even on a cancellation regression, then join.
			if !joined {
				select {
				case <-result:
				case <-time.After(time.Second):
					t.Fatal("worker did not drain after resource release")
				}
			}
		})
	}
}

func TestAuditV5RefreshCompletionCannotOverwriteRequeuedRetraction(t *testing.T) {
	database := setupNotificationTest(t)
	auditLifecycleTransports(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	database = database.WithContext(ctx)
	model.DB = database
	if _, err := SaveTelegram(TelegramConfig{Enabled: true, Token: "123:token", Targets: []string{"123456"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	parent := model.Comment{SiteID: "site-a", Mark: "/article", Username: "ParentDummy", Content: "PARENT_MARKER_7Q"}
	if err := database.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	reply := model.Comment{SiteID: parent.SiteID, Mark: parent.Mark, ParentID: &parent.ID, Username: "ReplyDummy", Content: "REPLY_MARKER_8Q"}
	createAndEnqueue(t, database, &reply)
	var message string
	sends, edits := 0, 0
	sendTelegramMessage = func(_ context.Context, _, _, text string) (string, error) {
		sends++
		message = text
		return "101", nil
	}
	editTelegramMessage = func(_ context.Context, _, target, id, text string) error {
		if target != "123456" || id != "101" {
			return errors.New("unexpected mock message address")
		}
		edits++
		message = text
		return nil
	}
	parentDeleted, requeued := false, false
	const completion = "audit_v5_requeue_before_completion"
	// Before the implicit update transaction acquires the sole DB connection.
	if err := database.Callback().Update().Before("gorm:begin_transaction").Register(completion, func(tx *gorm.DB) {
		values, ok := tx.Statement.Dest.(map[string]any)
		if !ok || values["status"] != "sent" {
			return
		}
		if edits == 0 && !parentDeleted {
			parentDeleted = true
			if status, _ := outboxStatus(t, database, EventBloggerTelegram, reply.ID); status != "processing" {
				t.Fatalf("original reply must still be processing at deletion: %q", status)
			}
			auditLifecycleTombstone(t, database, parent)
			return
		}
		if edits != 1 || requeued {
			return
		}
		requeued = true
		if strings.Contains(message, parent.Content) || !strings.Contains(message, reply.Content) {
			t.Fatal("first refresh did not preserve the live reply")
		}
		auditLifecycleTombstone(t, database, reply)
	}); err != nil {
		t.Fatal(err)
	}
	defer database.Callback().Update().Remove(completion)
	if processed, err := ProcessPendingOnce(ctx); err != nil || !processed || !parentDeleted || !strings.Contains(message, parent.Content) {
		t.Fatalf("initial reply delivery: processed=%v parentDeleted=%v err=%v", processed, parentDeleted, err)
	}
	if processed, err := ProcessPendingOnce(ctx); err != nil || !processed || !requeued {
		t.Fatalf("refresh completion: processed=%v requeued=%v err=%v", processed, requeued, err)
	}
	var row outboxRow
	if err := database.Table("notification_outbox").Where("event_type = ? AND comment_id = ?", EventBloggerTelegramRetract, reply.ID).First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.Status != "pending" || row.Attempts != 0 || row.LockedAt != nil || row.SentAt != nil {
		t.Fatalf("old completion overwrote requeued work: status=%s attempts=%d", row.Status, row.Attempts)
	}
	if processed, err := ProcessPendingOnce(ctx); err != nil || !processed {
		t.Fatalf("requeued retraction: processed=%v err=%v", processed, err)
	}
	if sends != 1 || edits != 2 || strings.Contains(message, parent.Content) || strings.Contains(message, reply.Content) || strings.Contains(message, reply.Username) {
		t.Fatalf("latest retraction lost: sends=%d edits=%d message=%q", sends, edits, message)
	}
	if status, _ := outboxStatus(t, database, EventBloggerTelegramRetract, reply.ID); status != "sent" {
		t.Fatalf("latest retraction status=%q", status)
	}
}
