package notifications

import (
	"context"
	"ecoku-server/model"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"
)

var errDeliveryCancelled = errors.New("notification delivery cancelled")

type Worker struct {
	done <-chan struct{}
}

func (worker *Worker) Wait() {
	if worker == nil || worker.done == nil {
		return
	}
	<-worker.done
}

func EnqueueNewComment(tx *gorm.DB, comment model.Comment) error {
	emailRow, err := loadSetting(tx, ChannelEmail)
	if err != nil {
		return err
	}
	telegramRow, err := loadSetting(tx, ChannelTelegram)
	if err != nil {
		return err
	}
	if !comment.IsBlogger && emailRow.Enabled {
		emailConfig, err := emailFromRow(emailRow, false)
		if err != nil {
			return err
		}
		for _, recipient := range emailConfig.Recipients {
			if err := enqueue(tx, EventBloggerEmail, comment.ID, recipient); err != nil {
				return err
			}
		}
	}
	if !comment.IsBlogger && telegramRow.Enabled {
		telegramConfig, err := telegramFromRow(telegramRow, false)
		if err != nil {
			return err
		}
		for _, target := range telegramConfig.Targets {
			if err := enqueue(tx, EventBloggerTelegram, comment.ID, target); err != nil {
				return err
			}
		}
	}
	if comment.ParentID == nil || !emailRow.Enabled {
		return nil
	}
	var parent model.Comment
	if err := tx.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
		return err
	}
	if parent.DeletedAt != nil || parent.IsBlogger || parent.Email == nil || strings.TrimSpace(*parent.Email) == "" {
		return nil
	}
	if comment.Email != nil && strings.EqualFold(strings.TrimSpace(*comment.Email), strings.TrimSpace(*parent.Email)) {
		return nil
	}
	return enqueue(tx, EventVisitorReply, comment.ID, strings.TrimSpace(*parent.Email))
}

func enqueue(tx *gorm.DB, eventType string, commentID uint, target string) error {
	target = strings.TrimSpace(target)
	if target == "" {
		return fmt.Errorf("notification target is empty")
	}
	now := time.Now().UTC()
	return tx.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, NULL)
  ON CONFLICT(event_type, comment_id, target) DO NOTHING`, eventType, commentID, target, now, now, now).Error
}

// CancelForDeletedComment runs inside the tombstone transaction. Queued
// notifications about the comment are cancelled, reply emails addressed to
// its now-erased private email are removed, and Telegram messages that were
// already sent (or are being sent right now) are queued for retraction.
// Emails that already left the SMTP server cannot be recalled.
func CancelForDeletedComment(tx *gorm.DB, commentID uint) error {
	now := time.Now().UTC()
	if err := tx.Exec(`UPDATE notification_outbox
SET status = 'cancelled', last_error_code = 'comment_deleted', locked_at = NULL, updated_at = ?
WHERE comment_id = ? AND status IN ('pending', 'failed') AND event_type IN (?, ?, ?)`,
		now, commentID, EventBloggerEmail, EventBloggerTelegram, EventVisitorReply).Error; err != nil {
		return err
	}
	if err := tx.Exec(`DELETE FROM notification_outbox
WHERE event_type = ? AND comment_id IN (SELECT id FROM comments WHERE parent_id = ?)`,
		EventVisitorReply, commentID).Error; err != nil {
		return err
	}
	return tx.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, target, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at, provider_message_id)
SELECT ?, comment_id, target, 'pending', 0, ?, NULL, NULL, ?, ?, NULL, NULL
FROM notification_outbox
WHERE comment_id = ? AND event_type = ? AND status IN ('sent', 'processing')
ON CONFLICT(event_type, comment_id, target) DO NOTHING`,
		EventBloggerTelegramRetract, now, now, now, commentID, EventBloggerTelegram).Error
}

func StartWorker(ctx context.Context) (*Worker, error) {
	now := time.Now().UTC()
	if err := model.DB.Exec(`UPDATE notification_outbox
SET status = CASE WHEN attempts >= ? THEN 'exhausted' ELSE 'failed' END,
    locked_at = NULL, last_error_code = 'worker_recovered', available_at = ?, updated_at = ?
WHERE status = 'processing'`, maxDeliveryAttempts, now, now).Error; err != nil {
		return nil, err
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		var lastPrune time.Time
		for {
			if ctx.Err() != nil {
				return
			}
			if time.Since(lastPrune) >= pruneInterval {
				if err := pruneOutbox(ctx, time.Now().UTC()); err != nil && ctx.Err() == nil {
					log.Print("notification worker: prune_failed")
				}
				lastPrune = time.Now()
			}
			for i := 0; i < 10; i++ {
				processed, err := ProcessPendingOnce(ctx)
				if err != nil && ctx.Err() == nil {
					log.Print("notification worker: processing_failed")
				}
				if !processed {
					break
				}
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	return &Worker{done: done}, nil
}

// pruneOutbox removes finished rows once they are older than the retention
// window. Pending, failed and processing rows are never pruned.
func pruneOutbox(ctx context.Context, now time.Time) error {
	return model.DB.WithContext(ctx).Exec(`DELETE FROM notification_outbox
WHERE status IN ('sent', 'cancelled', 'exhausted') AND updated_at < ?`, now.Add(-outboxRetention)).Error
}

func ProcessPendingOnce(ctx context.Context) (bool, error) {
	if model.DB == nil {
		return false, fmt.Errorf("notification database unavailable")
	}
	now := time.Now().UTC()
	var event outboxRow
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("notification_outbox").
			Where("status IN ('pending', 'failed') AND attempts < ? AND available_at <= ?", maxDeliveryAttempts, now).
			Order("available_at ASC, id ASC").First(&event).Error; err != nil {
			return err
		}
		result := tx.Table("notification_outbox").Where("id = ? AND status IN ('pending', 'failed')", event.ID).Updates(map[string]any{
			"status": "processing", "attempts": gorm.Expr("attempts + 1"),
			"locked_at": now, "updated_at": now,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	messageID, deliveryErr := deliverEvent(ctx, event)
	finish := time.Now().UTC()
	attempts := event.Attempts + 1
	updates := map[string]any{"locked_at": nil, "updated_at": finish}
	var failure *deliveryFailure
	permanent := errors.As(deliveryErr, &failure) && failure.permanent
	switch {
	case errors.Is(deliveryErr, errDeliveryCancelled):
		updates["status"] = "cancelled"
	case deliveryErr == nil:
		updates["status"], updates["last_error_code"], updates["sent_at"] = "sent", nil, finish
		if messageID != "" {
			updates["provider_message_id"] = messageID
		}
	case permanent || attempts >= maxDeliveryAttempts:
		code := outboxErrorCode(deliveryErr)
		updates["status"], updates["last_error_code"] = "exhausted", code
		log.Printf("notification event=%d code=%s attempts=%d", event.ID, code, attempts)
	default:
		code := outboxErrorCode(deliveryErr)
		delay := time.Duration(1<<min(attempts, 8)) * time.Minute
		if failure != nil && failure.retryAfter > delay {
			delay = failure.retryAfter
		}
		updates["status"], updates["last_error_code"] = "failed", code
		updates["available_at"] = finish.Add(delay)
		log.Printf("notification event=%d code=%s attempts=%d", event.ID, code, attempts)
	}
	// Keep the delivery result in this worker until storage recovers. Retrying
	// only the write avoids sending the same message again after a transient fault.
	for {
		err = model.DB.WithContext(ctx).Table("notification_outbox").Where("id = ?", event.ID).Updates(updates).Error
		if err == nil {
			return true, nil
		}
		if ctx.Err() != nil {
			return true, ctx.Err()
		}
		log.Printf("notification event=%d code=completion_write_failed", event.ID)
		timer := time.NewTimer(3 * time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return true, ctx.Err()
		case <-timer.C:
		}
	}
}

func invalidTarget(target string) bool {
	return strings.TrimSpace(target) == "" || target == "*"
}

// deliverEvent sends one outbox row and returns the provider message id when
// the channel reports one.
func deliverEvent(ctx context.Context, event outboxRow) (string, error) {
	var comment model.Comment
	if err := model.DB.Where("id = ?", event.CommentID).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errDeliveryCancelled
		}
		return "", err
	}
	site, err := model.GetSite(comment.SiteID)
	if err != nil {
		return "", err
	}
	switch event.EventType {
	case EventBloggerEmail:
		// A tombstone has no nickname or body left; never mail an empty notice.
		if invalidTarget(event.Target) || comment.DeletedAt != nil {
			return "", errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelEmail)
		if err != nil {
			return "", err
		}
		settings, err := emailFromRow(row, true)
		if err != nil {
			return "", err
		}
		message, err := renderBloggerEmail(comment, site)
		if err != nil {
			return "", err
		}
		return "", sendSMTPMessage(ctx, settings, event.Target, message)
	case EventBloggerTelegram:
		if invalidTarget(event.Target) || comment.DeletedAt != nil {
			return "", errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelTelegram)
		if err != nil {
			return "", err
		}
		settings, err := telegramFromRow(row, true)
		if err != nil {
			return "", err
		}
		message, err := renderTelegram(comment, site)
		if err != nil {
			return "", err
		}
		return sendTelegramMessage(ctx, settings.Token, event.Target, message)
	case EventBloggerTelegramRetract:
		if invalidTarget(event.Target) || comment.DeletedAt == nil {
			return "", errDeliveryCancelled
		}
		var original outboxRow
		err := model.DB.Table("notification_outbox").
			Where("event_type = ? AND comment_id = ? AND target = ?", EventBloggerTelegram, comment.ID, event.Target).
			First(&original).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errDeliveryCancelled
		}
		if err != nil {
			return "", err
		}
		if original.Status == "processing" {
			return "", &deliveryFailure{code: "retract_waiting"}
		}
		if original.Status != "sent" || original.ProviderMessageID == nil || *original.ProviderMessageID == "" {
			return "", errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelTelegram)
		if err != nil {
			return "", err
		}
		settings, err := telegramFromRow(row, true)
		if err != nil {
			return "", err
		}
		return "", editTelegramMessage(ctx, settings.Token, event.Target, *original.ProviderMessageID, renderTelegramRetracted(comment, site))
	case EventVisitorReply:
		if comment.ParentID == nil || comment.DeletedAt != nil || invalidTarget(event.Target) {
			return "", errDeliveryCancelled
		}
		var parent model.Comment
		if err := model.DB.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
			return "", errDeliveryCancelled
		}
		if parent.DeletedAt != nil {
			return "", errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelEmail)
		if err != nil {
			return "", err
		}
		settings, err := emailFromRow(row, true)
		if err != nil {
			return "", err
		}
		return "", sendSMTPMessage(ctx, settings, event.Target, renderReplyEmail(comment, parent, site, pageURL(site, comment.Mark)))
	default:
		return "", errDeliveryCancelled
	}
}

func SendTestEmail(ctx context.Context, input EmailConfig) string {
	input.Enabled = true
	settings, err := resolveEmailForTest(input)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			return "validation_failed"
		}
		return deliveryErrorCode(err)
	}
	message := renderTestEmail()
	for _, recipient := range settings.Recipients {
		if err := sendSMTPMessage(ctx, settings, recipient, message); err != nil {
			return deliveryErrorCode(err)
		}
	}
	return ""
}

func SendTestTelegram(ctx context.Context, input TelegramConfig) string {
	input.Enabled = true
	settings, err := resolveTelegramForTest(input)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			return "validation_failed"
		}
		return deliveryErrorCode(err)
	}
	for _, target := range settings.Targets {
		if _, err := sendTelegramMessage(ctx, settings.Token, target, "<b>Ecoku 测试消息</b>\n\nTelegram 通知连接正常。"); err != nil {
			return deliveryErrorCode(err)
		}
	}
	return ""
}
