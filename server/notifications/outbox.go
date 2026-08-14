package notifications

import (
	"context"
	"ecoku-server/model"
	"errors"
	"fmt"
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
	var site model.Site
	if err := tx.Where("id = ?", comment.SiteID).First(&site).Error; err != nil {
		return err
	}
	emailRow, err := loadSetting(tx, ChannelEmail)
	if err != nil {
		return err
	}
	telegramRow, err := loadSetting(tx, ChannelTelegram)
	if err != nil {
		return err
	}
	if !isBloggerComment(site, comment) && emailRow.Enabled {
		if err := enqueue(tx, EventBloggerEmail, comment.ID); err != nil {
			return err
		}
	}
	if !isBloggerComment(site, comment) && telegramRow.Enabled {
		if err := enqueue(tx, EventBloggerTelegram, comment.ID); err != nil {
			return err
		}
	}
	if comment.ParentID == nil || !emailRow.Enabled {
		return nil
	}
	var parent model.Comment
	if err := tx.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
		return err
	}
	if parent.DeletedAt != nil || parent.Email == nil || strings.TrimSpace(*parent.Email) == "" || isBloggerComment(site, parent) {
		return nil
	}
	if comment.Email != nil && strings.EqualFold(strings.TrimSpace(*comment.Email), strings.TrimSpace(*parent.Email)) {
		return nil
	}
	return enqueue(tx, EventVisitorReply, comment.ID)
}

func isBloggerComment(site model.Site, comment model.Comment) bool {
	nickname := strings.TrimSpace(site.BloggerNickname)
	email := strings.TrimSpace(site.BloggerEmail)
	if nickname == "" || email == "" || comment.Email == nil {
		return false
	}
	return strings.TrimSpace(comment.Username) == nickname &&
		strings.EqualFold(strings.TrimSpace(*comment.Email), email)
}

func enqueue(tx *gorm.DB, eventType string, commentID uint) error {
	now := time.Now().UTC()
	return tx.Exec(`INSERT INTO notification_outbox
  (event_type, comment_id, status, attempts, available_at, locked_at, last_error_code, created_at, updated_at, sent_at)
  VALUES (?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, NULL)
  ON CONFLICT(event_type, comment_id) DO NOTHING`, eventType, commentID, now, now, now).Error
}

func StartWorker(ctx context.Context) (*Worker, error) {
	cutoff := time.Now().UTC().Add(-10 * time.Minute)
	if err := model.DB.Table("notification_outbox").Where("status = 'processing' AND locked_at < ?", cutoff).Updates(map[string]any{
		"status": "failed", "locked_at": nil, "last_error_code": "worker_recovered",
		"available_at": time.Now().UTC(), "updated_at": time.Now().UTC(),
	}).Error; err != nil {
		return nil, err
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			if ctx.Err() != nil {
				return
			}
			for i := 0; i < 10; i++ {
				processed, _ := ProcessPendingOnce(ctx)
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

func ProcessPendingOnce(ctx context.Context) (bool, error) {
	if model.DB == nil {
		return false, fmt.Errorf("notification database unavailable")
	}
	now := time.Now().UTC()
	var event outboxRow
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("notification_outbox").
			Where("status IN ('pending', 'failed') AND attempts < 8 AND available_at <= ?", now).
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

	deliveryErr := deliverEvent(ctx, event)
	finish := time.Now().UTC()
	if errors.Is(deliveryErr, errDeliveryCancelled) {
		return true, model.DB.Table("notification_outbox").Where("id = ?", event.ID).Updates(map[string]any{
			"status": "cancelled", "locked_at": nil, "updated_at": finish,
		}).Error
	}
	if deliveryErr == nil {
		return true, model.DB.Table("notification_outbox").Where("id = ?", event.ID).Updates(map[string]any{
			"status": "sent", "locked_at": nil, "last_error_code": nil,
			"sent_at": finish, "updated_at": finish,
		}).Error
	}
	code := deliveryErrorCode(deliveryErr)
	backoff := time.Duration(1<<min(event.Attempts+1, 8)) * time.Minute
	err = model.DB.Table("notification_outbox").Where("id = ?", event.ID).Updates(map[string]any{
		"status": "failed", "locked_at": nil, "last_error_code": code,
		"available_at": finish.Add(backoff), "updated_at": finish,
	}).Error
	if err != nil {
		return true, err
	}
	return true, fmt.Errorf("notification delivery failed: %s", code)
}

func deliverEvent(ctx context.Context, event outboxRow) error {
	var comment model.Comment
	if err := model.DB.Where("id = ?", event.CommentID).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errDeliveryCancelled
		}
		return err
	}
	site, err := model.GetSite(comment.SiteID)
	if err != nil {
		return err
	}
	switch event.EventType {
	case EventBloggerEmail:
		if isBloggerComment(site, comment) {
			return errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelEmail)
		if err != nil {
			return err
		}
		if !row.Enabled {
			return errDeliveryCancelled
		}
		settings, err := emailFromRow(row, true)
		if err != nil {
			return err
		}
		message, err := renderBloggerEmail(comment, site)
		if err != nil {
			return err
		}
		for _, recipient := range settings.Recipients {
			if err := sendSMTPMessage(ctx, settings, recipient, message); err != nil {
				return err
			}
		}
		return nil
	case EventBloggerTelegram:
		if isBloggerComment(site, comment) {
			return errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelTelegram)
		if err != nil {
			return err
		}
		if !row.Enabled {
			return errDeliveryCancelled
		}
		settings, err := telegramFromRow(row, true)
		if err != nil {
			return err
		}
		message, err := renderTelegram(comment, site)
		if err != nil {
			return err
		}
		for _, target := range settings.Targets {
			if err := sendTelegramMessage(ctx, settings.Token, target, message); err != nil {
				return err
			}
		}
		return nil
	case EventVisitorReply:
		if comment.ParentID == nil || comment.DeletedAt != nil {
			return errDeliveryCancelled
		}
		var parent model.Comment
		if err := model.DB.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
			return errDeliveryCancelled
		}
		if parent.Email == nil || strings.TrimSpace(*parent.Email) == "" || parent.DeletedAt != nil {
			return errDeliveryCancelled
		}
		if isBloggerComment(site, parent) {
			return errDeliveryCancelled
		}
		if comment.Email != nil && strings.EqualFold(strings.TrimSpace(*comment.Email), strings.TrimSpace(*parent.Email)) {
			return errDeliveryCancelled
		}
		row, err := loadSetting(model.DB, ChannelEmail)
		if err != nil {
			return err
		}
		if !row.Enabled {
			return errDeliveryCancelled
		}
		settings, err := emailFromRow(row, true)
		if err != nil {
			return err
		}
		return sendSMTPMessage(ctx, settings, strings.TrimSpace(*parent.Email), renderReplyEmail(comment, parent, site, pageURL(site, comment.Mark)))
	default:
		return errDeliveryCancelled
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
	message := emailMessage{
		Subject: "Ecoku 测试邮件",
		Text:    "Ecoku 测试邮件已成功发送。",
		HTML:    emailShell("Ecoku 测试邮件", `<p style="margin:0;line-height:1.7">Ecoku 测试邮件已成功发送。</p>`),
	}
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
		if err := sendTelegramMessage(ctx, settings.Token, target, "<b>Ecoku 测试消息</b>\n\nTelegram 通知连接正常。"); err != nil {
			return deliveryErrorCode(err)
		}
	}
	return ""
}
