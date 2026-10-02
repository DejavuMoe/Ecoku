package comment

import (
	"context"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxPublicCountNodes = 10000
	maxPublicListNodes  = 200 // Includes roots and descendants.
	maxPublicListDepth  = 16  // Roots are depth zero.
	maxPublicListBytes  = 1 << 20
	publicListTimeout   = 2 * time.Second
)

var (
	errPublicListBudget = errors.New("public comment list budget exceeded")
	publicListSlots     = make(chan struct{}, 4)
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

// PublicListBudget must run before CORS so origin lookups share admission and
// the request deadline, including requests that CORS will reject.
func PublicListBudget(c *gin.Context) {
	select {
	case publicListSlots <- struct{}{}:
		defer func() { <-publicListSlots }()
	default:
		c.Header("Retry-After", "1")
		utils.SendError(c, http.StatusServiceUnavailable, "评论读取繁忙，请稍后重试")
		c.Abort()
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), publicListTimeout)
	defer cancel()
	c.Request = c.Request.WithContext(ctx)
	c.Next()
}

// GetComments returns complete root threads within a fixed budget. Explicit
// parentId requests use single-level cursor pagination without tree expansion.
func GetComments(c *gin.Context) {
	ctx := c.Request.Context()
	siteID, ok := requireRegisteredSite(c, c.Query("siteId"), false)
	if !ok {
		return
	}
	site, err := model.GetSiteWithContext(ctx, siteID)
	if err != nil {
		sendPublicListError(c, err)
		return
	}
	captchaConfig, err := captcha.PublicConfigWithContext(ctx)
	if err != nil {
		sendPublicListError(c, err)
		return
	}
	formConfig := config.CommentFormConfig{
		Locale:              string(config.NormalizeLocale(site.Locale)),
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
			ImageOrigin: site.SmojiImageOrigin,
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

	parentID, afterID, cursorMode, err := parseChildCursor(c)
	if err != nil {
		utils.SendError(c, http.StatusBadRequest, "parentId/afterId 无效，不能与 page 或 sort 混用")
		return
	}
	var comments []model.Comment
	var total, commentTotal int64
	var hasMore bool
	// Keep the budget probe and reads in one snapshot so concurrent writes
	// cannot invalidate the bound or make the tree grow during traversal.
	err = model.DB.WithContext(ctx).Transaction(func(db *gorm.DB) error {
		if cursorMode {
			comments, hasMore, err = loadPublicChildren(db, siteID, key, parentID, afterID, pageSize)
			return err
		}
		commentTotal, total, err = countPublicComments(db, siteID, key)
		if err != nil {
			return err
		}
		// Compare before multiplying so huge pages cannot overflow to page 1.
		if int64(page-1) > total/int64(pageSize) {
			return nil
		}
		var roots []model.Comment
		if err := db.Where("site_id = ? AND mark = ? AND parent_id IS NULL", siteID, key).
			Order(sortOrder).Limit(pageSize).Offset((page - 1) * pageSize).Find(&roots).Error; err != nil {
			return err
		}
		comments, err = loadPublicDescendants(db, siteID, key, roots)
		return err
	})
	if err != nil {
		sendPublicListError(c, err)
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
		pageCount = int((total + int64(pageSize) - 1) / int64(pageSize))
	}

	payload := gin.H{
		"data":         responses,
		"total":        total,
		"commentTotal": commentTotal,
		"page":         page,
		"pageSize":     pageSize,
		"pageCount":    pageCount,
		"formConfig":   formConfig,
		"timeZone":     utils.DisplayTimeZone(),
	}
	if cursorMode {
		var nextAfterID uint
		if hasMore && len(comments) > 0 {
			nextAfterID = comments[len(comments)-1].ID
		}
		payload = gin.H{"data": responses, "parentId": parentID, "pageSize": pageSize,
			"hasMore": hasMore, "nextAfterId": nextAfterID,
			"formConfig": formConfig, "timeZone": utils.DisplayTimeZone()}
	}
	// Bound the actual escaped JSON envelope before writing any response bytes.
	encoded, err := json.Marshal(utils.NewResponse(http.StatusOK, "获取评论成功", payload))
	if err != nil {
		sendPublicListError(c, err)
		return
	}
	if len(encoded) > maxPublicListBytes {
		sendPublicListError(c, errPublicListBudget)
		return
	}
	if err := ctx.Err(); err != nil {
		sendPublicListError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", encoded)
}

func sendPublicListError(c *gin.Context, err error) {
	if contextErr := c.Request.Context().Err(); contextErr != nil {
		err = contextErr
	}
	switch {
	case errors.Is(err, errPublicListBudget):
		utils.SendError(c, http.StatusUnprocessableEntity, "评论列表超出读取预算，请减小 pageSize 或使用 parentId 分页")
	case errors.Is(err, gorm.ErrRecordNotFound):
		utils.SendError(c, http.StatusNotFound, "父评论不存在")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		utils.SendError(c, http.StatusServiceUnavailable, "评论读取超时，请稍后重试")
	default:
		utils.SendError(c, http.StatusInternalServerError, "查询评论失败")
	}
}

func parseChildCursor(c *gin.Context) (uint64, uint64, bool, error) {
	query := c.Request.URL.Query()
	parents, cursorMode := query["parentId"]
	if !cursorMode {
		if _, exists := query["afterId"]; exists {
			return 0, 0, false, strconv.ErrSyntax
		}
		return 0, 0, false, nil
	}
	if len(parents) != 1 || query.Has("page") || query.Has("sort") {
		return 0, 0, true, strconv.ErrSyntax
	}
	parentID, err := strconv.ParseUint(parents[0], 10, 63)
	if err != nil {
		return 0, 0, true, err
	}
	var afterID uint64
	if values, exists := query["afterId"]; exists {
		if len(values) != 1 {
			return 0, 0, true, strconv.ErrSyntax
		}
		afterID, err = strconv.ParseUint(values[0], 10, 63)
	}
	return parentID, afterID, true, err
}

// Read only bounded IDs/edges, never a recursive SQL queue or an unbounded
// COUNT. Iterative reachability preserves exact totals, including tombstones.
func countPublicComments(db *gorm.DB, siteID, key string) (int64, int64, error) {
	var nodes []struct {
		ID       uint
		ParentID *uint
	}
	if err := db.Model(&model.Comment{}).Select("id, parent_id").
		Where("site_id = ? AND mark = ?", siteID, key).
		Limit(maxPublicCountNodes + 1).Find(&nodes).Error; err != nil {
		return 0, 0, err
	}
	if len(nodes) > maxPublicCountNodes {
		return 0, 0, errPublicListBudget
	}
	children := make(map[uint][]uint)
	var queue []uint
	for _, node := range nodes {
		if node.ParentID == nil {
			queue = append(queue, node.ID)
		} else {
			children[*node.ParentID] = append(children[*node.ParentID], node.ID)
		}
	}
	roots := int64(len(queue))
	seen := make(map[uint]bool, len(nodes))
	for i := 0; i < len(queue); i++ {
		if err := db.Statement.Context.Err(); err != nil {
			return 0, 0, err
		}
		id := queue[i]
		if seen[id] {
			continue
		}
		seen[id] = true
		queue = append(queue, children[id]...)
	}
	return int64(len(seen)), roots, nil
}

func loadPublicChildren(db *gorm.DB, siteID, key string, parentID, afterID uint64, pageSize int) ([]model.Comment, bool, error) {
	query := db.Where("site_id = ? AND mark = ?", siteID, key)
	if parentID == 0 {
		query = query.Where("parent_id IS NULL")
	} else {
		var parent model.Comment
		if err := db.Select("id").Where("site_id = ? AND mark = ? AND id = ?", siteID, key, parentID).First(&parent).Error; err != nil {
			return nil, false, err
		}
		query = query.Where("parent_id = ?", parentID)
	}
	var children []model.Comment
	if err := query.Where("id > ?", afterID).Order("id ASC").Limit(pageSize + 1).Find(&children).Error; err != nil {
		return nil, false, err
	}
	hasMore := len(children) > pageSize
	if hasMore {
		children = children[:pageSize]
	}
	return children, hasMore, nil
}

func loadPublicDescendants(db *gorm.DB, siteID, key string, roots []model.Comment) ([]model.Comment, error) {
	if len(roots) > maxPublicListNodes {
		return nil, errPublicListBudget
	}
	result := append([]model.Comment(nil), roots...)
	frontier := make([]uint, 0, len(roots))
	seen := make(map[uint]bool, len(roots))
	for _, root := range roots {
		frontier = append(frontier, root.ID)
		seen[root.ID] = true
	}
	for depth := 0; len(frontier) > 0; depth++ {
		var next []uint
		// Each parent lookup uses the existing sibling-order index. An IN
		// query could sort an arbitrarily broad level before applying LIMIT.
		sort.Slice(frontier, func(i, j int) bool { return frontier[i] < frontier[j] })
		for _, parentID := range frontier {
			remaining := maxPublicListNodes - len(result)
			if depth == maxPublicListDepth {
				remaining = 0
			}
			var children []model.Comment
			if err := db.Where("site_id = ? AND mark = ? AND parent_id = ?", siteID, key, parentID).
				Order("created_at ASC, id ASC").Limit(remaining + 1).Find(&children).Error; err != nil {
				return nil, err
			}
			if len(children) > remaining {
				return nil, errPublicListBudget
			}
			for _, child := range children {
				if seen[child.ID] {
					continue
				}
				seen[child.ID] = true
				result = append(result, child)
				next = append(next, child.ID)
			}
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
