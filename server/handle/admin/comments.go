package admin

import (
	"context"
	"ecoku-server/middleware"
	"ecoku-server/model"
	"ecoku-server/utils"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	defaultAdminPageSize = 20
	maximumAdminPageSize = 100
	maximumAdminPage     = 1_000_000
)

type CommentReviewDTO struct {
	ID          uint    `json:"id"`
	SiteID      string  `json:"site_id"`
	Mark        string  `json:"mark"`
	PageTitle   string  `json:"page_title"`
	Parent      uint    `json:"parent"`
	Status      string  `json:"status"`
	Deleted     bool    `json:"deleted"`
	HasChildren bool    `json:"has_children"`
	Username    string  `json:"username"`
	Email       *string `json:"email,omitempty"`
	URL         *string `json:"url,omitempty"`
	Content     string  `json:"content"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

func ListComments(c *gin.Context) {
	siteID, ok := authorizedSite(c)
	if !ok {
		return
	}
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status == "" {
		status = "published"
	}
	if status != "published" && status != "deleted" {
		utils.SendError(c, http.StatusBadRequest, "status 只支持 published 或 deleted")
		return
	}
	page, err := parseAdminPositiveInt(c.Query("page"), 1, maximumAdminPage)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "page 参数无效")
		return
	}
	pageSize, err := parseAdminPositiveInt(c.Query("pageSize"), defaultAdminPageSize, maximumAdminPageSize)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "pageSize 参数无效")
		return
	}
	sortOrder := strings.ToLower(strings.TrimSpace(c.Query("sort")))
	if sortOrder == "" {
		sortOrder = "newest"
	}
	orderClause := "created_at DESC, id DESC"
	if sortOrder == "oldest" {
		orderClause = "created_at ASC, id ASC"
	} else if sortOrder != "newest" {
		utils.SendError(c, http.StatusBadRequest, "sort 只支持 oldest 或 newest")
		return
	}

	var counts map[string]int64
	var comments []model.Comment
	var childCounts map[uint]int64
	failureMessage := "查询管理评论失败"
	err = model.ReadDB().WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var err error
		counts, err = commentManagementCounts(tx, siteID)
		if err != nil {
			failureMessage = "统计管理评论失败"
			return err
		}
		query := tx.Model(&model.Comment{}).Where("site_id = ?", siteID)
		if status == "deleted" {
			query = query.Where("deleted_at IS NOT NULL")
		} else {
			query = query.Where("deleted_at IS NULL")
		}
		if err := query.Order(orderClause).Limit(pageSize).Offset((page - 1) * pageSize).Find(&comments).Error; err != nil {
			return err
		}
		childCounts, err = reviewChildCounts(tx, comments)
		if err != nil {
			failureMessage = "查询评论后代失败"
		}
		return err
	})
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, failureMessage)
		return
	}
	dtos := make([]CommentReviewDTO, 0, len(comments))
	for _, comment := range comments {
		dtos = append(dtos, commentReviewDTO(comment, childCounts[comment.ID] > 0))
	}
	pageCount := int64(0)
	total := counts[status]
	if total > 0 {
		pageCount = (total + int64(pageSize) - 1) / int64(pageSize)
	}
	utils.SendResponse(c, http.StatusOK, "获取管理评论成功", gin.H{
		"data": dtos, "counts": counts, "total": total,
		"page": page, "pageSize": pageSize, "pageCount": pageCount,
	})
}

func commentManagementCounts(db *gorm.DB, siteID string) (map[string]int64, error) {
	var totals struct {
		Published int64
		Deleted   int64
	}
	err := db.Raw(`SELECT COUNT(*) - COUNT(deleted_at) AS published, COUNT(deleted_at) AS deleted
FROM comments WHERE site_id = ?`, siteID).Scan(&totals).Error
	if err != nil {
		return nil, err
	}
	return map[string]int64{"published": totals.Published, "deleted": totals.Deleted}, nil
}

func GetComment(c *gin.Context) {
	siteID, ok := authorizedSite(c)
	if !ok {
		return
	}
	commentID, ok := parseCommentID(c)
	if !ok {
		return
	}
	var comment model.Comment
	err := model.DB.WithContext(c.Request.Context()).Where("id = ? AND site_id = ?", commentID, siteID).First(&comment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		utils.SendError(c, http.StatusNotFound, "评论不存在")
		return
	}
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "查询评论失败")
		return
	}
	children, err := directChildCount(c.Request.Context(), comment.ID)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "查询评论后代失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取管理评论成功", commentReviewDTO(comment, children > 0))
}

func authorizedSite(c *gin.Context) (string, bool) {
	siteID, ok := middleware.AuthorizedAdminSiteID(c)
	if !ok {
		utils.SendError(c, http.StatusUnauthorized, "管理员认证失败")
		return "", false
	}
	return siteID, true
}

func parseCommentID(c *gin.Context) (uint, bool) {
	value, err := strconv.ParseUint(strings.TrimSpace(c.Param("commentId")), 10, 64)
	if err != nil || value == 0 || uint64(uint(value)) != value {
		utils.SendError(c, http.StatusBadRequest, "commentId 参数无效")
		return 0, false
	}
	return uint(value), true
}

func parseAdminPositiveInt(value string, fallback, maximum int) (int, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 || parsed > maximum {
		return 0, strconv.ErrSyntax
	}
	return parsed, nil
}

func commentReviewDTO(comment model.Comment, hasChildren bool) CommentReviewDTO {
	deleted := comment.DeletedAt != nil
	username, content, email, website := comment.Username, comment.Content, comment.Email, comment.URL
	status := "published"
	if deleted {
		status = "deleted"
		username, content, email, website = "—", "该评论已删除", nil, nil
	}
	return CommentReviewDTO{
		ID: comment.ID, SiteID: comment.SiteID, Mark: comment.Mark, PageTitle: comment.PageTitle,
		Parent: comment.ParentValue(), Status: status, Deleted: deleted,
		HasChildren: hasChildren, Username: username,
		Email: email, URL: website, Content: content,
		CreatedAt: comment.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: comment.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func directChildCount(ctx context.Context, commentID uint) (int64, error) {
	var count int64
	err := model.DB.WithContext(ctx).Model(&model.Comment{}).Where("parent_id = ?", commentID).Count(&count).Error
	return count, err
}

func reviewChildCounts(db *gorm.DB, comments []model.Comment) (map[uint]int64, error) {
	result := make(map[uint]int64, len(comments))
	if len(comments) == 0 {
		return result, nil
	}
	ids := make([]uint, 0, len(comments))
	for _, comment := range comments {
		ids = append(ids, comment.ID)
	}
	type row struct {
		ParentID uint  `gorm:"column:parent_id"`
		Total    int64 `gorm:"column:total"`
	}
	var rows []row
	if err := db.Model(&model.Comment{}).Select("parent_id, COUNT(*) AS total").Where("parent_id IN ?", ids).Group("parent_id").Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, item := range rows {
		result[item.ParentID] = item.Total
	}
	return result, nil
}
