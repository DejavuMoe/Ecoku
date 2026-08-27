package comment

import (
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type PublicCommentResponse struct {
	ID        uint    `json:"id"`
	SiteID    string  `json:"site_id"`
	Mark      string  `json:"mark"`
	Content   string  `json:"content"`
	Parent    uint    `json:"parent"`
	Deleted   bool    `json:"deleted"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
	Username  string  `json:"username"`
	URL       *string `json:"url,omitempty"`
	IsBlogger bool    `json:"isBlogger"`
}

func legacyTurnstileSitekey(value config.CaptchaPublicConfig) string {
	if value.Provider == captcha.ProviderTurnstile {
		return value.Sitekey
	}
	return ""
}

// GetComments returns published root threads and every published descendant of
// the roots on the requested page.
func GetComments(c *gin.Context) {
	siteID, ok := requireRegisteredSite(c, c.Query("siteId"), false)
	if !ok {
		return
	}
	site, err := model.GetSite(siteID)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取评论表单配置失败")
		return
	}
	captchaConfig, err := captcha.PublicConfig()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取验证配置失败")
		return
	}
	formConfig := config.CommentFormConfig{
		EmailRequired:       site.EmailRequired,
		WebsiteRequired:     site.WebsiteRequired,
		Placeholder:         site.Placeholder,
		DefaultSort:         site.DefaultSort,
		LengthLimit:         site.CommentLimit,
		EmptyMessage:        site.EmptyMessage,
		BloggerBadge:        site.BloggerBadge,
		Captcha:             captchaConfig,
		TurnstileSitekey:    legacyTurnstileSitekey(captchaConfig),
		BloggerProofEnabled: site.BloggerProofConfigured(),
		Smoji: config.SmojiPublicConfig{
			Enabled: site.SmojiEnabled, ManifestURL: site.SmojiManifestURL,
		},
	}
	key := strings.TrimSpace(c.Query("key"))
	if key == "" || textLength(key) > maxPageKeyLength {
		utils.SendError(c, http.StatusBadRequest, "key 参数无效")
		return
	}

	page, err := parseOptionalPositiveInt(c.Query("page"), 1, 0)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "page 参数无效")
		return
	}
	pageSize, err := parseOptionalPositiveInt(c.Query("pageSize"), defaultPageSize, maxPageSize)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "pageSize 参数无效")
		return
	}
	sortValue := strings.TrimSpace(c.Query("sort"))
	if sortValue == "" {
		sortValue = site.DefaultSort
	}
	sortOrder, err := parseCommentSort(sortValue)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "sort 只支持 oldest 或 newest")
		return
	}

	commentTotal, err := countPublicComments(siteID, key)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "统计评论失败")
		return
	}
	rootQuery := model.DB.Where(
		"site_id = ? AND mark = ? AND parent_id IS NULL",
		siteID,
		key,
	)

	var total int64
	if err := rootQuery.Model(&model.Comment{}).Count(&total).Error; err != nil {
		utils.SendError(c, http.StatusInternalServerError, "统计评论失败")
		return
	}

	var roots []model.Comment
	offset := (page - 1) * pageSize
	if err := rootQuery.Order(sortOrder).Limit(pageSize).Offset(offset).Find(&roots).Error; err != nil {
		utils.SendError(c, http.StatusInternalServerError, "查询评论失败")
		return
	}

	comments, err := loadPublicDescendants(siteID, key, roots)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "查询评论回复失败")
		return
	}

	responses := make([]PublicCommentResponse, 0, len(comments))
	for _, item := range comments {
		deleted := item.DeletedAt != nil
		username := strings.TrimSpace(item.Username)
		content := item.Content
		website := item.URL
		if deleted {
			username = "已删除"
			content = "[该评论已删除]"
			website = nil
		} else if username == "" {
			username = "匿名用户"
		}
		responses = append(responses, PublicCommentResponse{
			ID:        item.ID,
			SiteID:    item.SiteID,
			Mark:      item.Mark,
			Content:   content,
			Parent:    item.ParentValue(),
			Deleted:   deleted,
			CreatedAt: item.CreatedAt.UTC().Format(time.RFC3339Nano),
			UpdatedAt: item.UpdatedAt.UTC().Format(time.RFC3339Nano),
			Username:  username,
			URL:       website,
			IsBlogger: !deleted && item.IsBlogger,
		})
	}

	pageCount := 0
	if total > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(pageSize)))
	}

	utils.SendResponse(c, http.StatusOK, "获取评论成功", gin.H{
		"data":         responses,
		"total":        total,
		"commentTotal": commentTotal,
		"page":         page,
		"pageSize":     pageSize,
		"pageCount":    pageCount,
		"formConfig":   formConfig,
		"timeZone":     utils.DisplayTimeZone(),
	})
}

// countPublicComments counts comments reachable from a root so the public total
// stays aligned with complete-thread pagination.
func countPublicComments(siteID, key string) (int64, error) {
	var result struct {
		Total int64 `gorm:"column:total"`
	}
	err := model.DB.Raw(`
WITH RECURSIVE public_comments(id) AS (
  SELECT id
  FROM comments
  WHERE site_id = ? AND mark = ? AND parent_id IS NULL
  UNION
  SELECT child.id
  FROM comments AS child
  JOIN public_comments AS parent ON child.parent_id = parent.id
  WHERE child.site_id = ? AND child.mark = ?
)
SELECT COUNT(*) AS total FROM public_comments
`, siteID, key, siteID, key).Scan(&result).Error
	return result.Total, err
}

func loadPublicDescendants(siteID, key string, roots []model.Comment) ([]model.Comment, error) {
	result := make([]model.Comment, 0, len(roots))
	result = append(result, roots...)
	frontier := make([]uint, 0, len(roots))
	seen := make(map[uint]struct{}, len(roots))
	for _, root := range roots {
		frontier = append(frontier, root.ID)
		seen[root.ID] = struct{}{}
	}

	for len(frontier) > 0 {
		var children []model.Comment
		if err := model.DB.Where(
			"site_id = ? AND mark = ? AND parent_id IN ?",
			siteID,
			key,
			frontier,
		).Order("parent_id ASC, created_at ASC, id ASC").Find(&children).Error; err != nil {
			return nil, err
		}

		next := make([]uint, 0, len(children))
		for _, child := range children {
			if _, exists := seen[child.ID]; exists {
				continue
			}
			seen[child.ID] = struct{}{}
			result = append(result, child)
			next = append(next, child.ID)
		}
		frontier = next
	}

	return result, nil
}

func parseOptionalPositiveInt(value string, fallback, maximum int) (int, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 || (maximum > 0 && parsed > maximum) {
		return 0, strconv.ErrSyntax
	}
	return parsed, nil
}

func parseCommentSort(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "newest":
		return "created_at DESC, id DESC", nil
	case "oldest":
		return "created_at ASC, id ASC", nil
	default:
		return "", strconv.ErrSyntax
	}
}
