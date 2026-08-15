package admin

import (
	"ecoku-server/model"
	"ecoku-server/utils"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	errCommentNotFound           = errors.New("comment not found")
	errCommentDeleteConflict     = errors.New("comment delete conflict")
	errCommentDeleteStateChanged = errors.New("comment deletion state changed concurrently")
)

// DeleteComment replaces a comment with a privacy-preserving tombstone. It
// never deletes descendants and repeated deletion is idempotent.
func DeleteComment(c *gin.Context) {
	siteID, ok := authorizedSite(c)
	if !ok {
		return
	}
	commentID, ok := parseCommentID(c)
	if !ok {
		return
	}

	comment, unchanged, err := tombstoneComment(siteID, commentID, time.Now().UTC())
	switch {
	case errors.Is(err, errCommentNotFound):
		utils.SendError(c, http.StatusNotFound, "评论不存在")
	case errors.Is(err, errCommentDeleteStateChanged):
		utils.SendError(c, http.StatusConflict, "评论删除状态冲突")
	case errors.Is(err, errCommentDeleteConflict):
		utils.SendError(c, http.StatusConflict, "评论删除状态冲突")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "删除评论失败")
	default:
		utils.SendResponse(c, http.StatusOK, "评论已删除", gin.H{
			"comment":   commentReviewDTO(comment),
			"unchanged": unchanged,
		})
	}
}

func tombstoneComment(siteID string, commentID uint, deletedAt time.Time) (model.Comment, bool, error) {
	var updated model.Comment
	changed := false
	err := model.DB.Transaction(func(transaction *gorm.DB) error {
		var current model.Comment
		err := transaction.Where("id = ? AND site_id = ?", commentID, siteID).First(&current).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errCommentNotFound
		}
		if err != nil {
			return err
		}
		if current.DeletedAt != nil {
			updated = current
			return nil
		}

		result := transaction.Model(&model.Comment{}).
			Where("id = ? AND site_id = ? AND deleted_at IS NULL", commentID, siteID).
			Updates(map[string]any{
				"username":   "",
				"email":      nil,
				"url":        nil,
				"content":    "",
				"is_blogger": false,
				"deleted_at": deletedAt,
				"updated_at": deletedAt,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errCommentDeleteStateChanged
		}
		if err := transaction.Where("id = ? AND site_id = ?", commentID, siteID).First(&updated).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	if errors.Is(err, errCommentDeleteStateChanged) {
		var current model.Comment
		reloadError := model.DB.Where("id = ? AND site_id = ?", commentID, siteID).First(&current).Error
		if errors.Is(reloadError, gorm.ErrRecordNotFound) {
			return model.Comment{}, false, errCommentNotFound
		}
		if reloadError != nil {
			return model.Comment{}, false, reloadError
		}
		if current.DeletedAt != nil {
			return current, true, nil
		}
		return model.Comment{}, false, errCommentDeleteStateChanged
	}
	if err != nil {
		return model.Comment{}, false, err
	}
	return updated, !changed, nil
}

// PermanentlyDeleteComment removes only a tombstone with no direct
// or indirect descendants. The route is restricted to the instance
// administrator so a site automation key cannot erase audit structure.
func PermanentlyDeleteComment(c *gin.Context) {
	siteID, ok := authorizedSite(c)
	if !ok {
		return
	}
	commentID, ok := parseCommentID(c)
	if !ok {
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var current model.Comment
		err := tx.Where("id = ? AND site_id = ?", commentID, siteID).First(&current).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errCommentNotFound
		}
		if err != nil {
			return err
		}
		if current.DeletedAt == nil {
			return errCommentDeleteConflict
		}
		var children int64
		if err := tx.Model(&model.Comment{}).Where("parent_id = ?", commentID).Count(&children).Error; err != nil {
			return err
		}
		if children != 0 {
			return errCommentDeleteConflict
		}
		result := tx.Where("id = ? AND site_id = ? AND deleted_at IS NOT NULL", commentID, siteID).Delete(&model.Comment{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errCommentDeleteStateChanged
		}
		return nil
	})
	switch {
	case errors.Is(err, errCommentNotFound):
		utils.SendError(c, http.StatusNotFound, "评论不存在")
	case errors.Is(err, errCommentDeleteConflict), errors.Is(err, errCommentDeleteStateChanged):
		utils.SendError(c, http.StatusConflict, "只有没有后代的墓碑可以彻底删除")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "彻底删除评论失败")
	default:
		utils.SendResponse(c, http.StatusOK, "墓碑已彻底删除", gin.H{"id": commentID})
	}
}
