package comment

import (
	"context"
	"ecoku-server/captcha"
	"ecoku-server/model"
	"ecoku-server/notifications"
	"ecoku-server/utils"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const publicSubmitTimeout = 8 * time.Second

// PublicSubmitBudget runs before CORS so origin checks, CAPTCHA verification
// and the write transaction share a deadline, with headroom for the SDK's 10s timeout.
func PublicSubmitBudget(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), publicSubmitTimeout)
	defer cancel()
	c.Request = c.Request.WithContext(ctx)
	c.Next()
}

type SubmitCommentRequest struct {
	SiteID         string      `json:"siteId"`
	Mark           string      `json:"mark"`
	PageTitle      string      `json:"pageTitle,omitempty"`
	Content        string      `json:"content"`
	Username       string      `json:"username"`
	Email          string      `json:"email"`
	Parent         FlexibleInt `json:"parent,omitempty"`
	URL            string      `json:"url,omitempty"`
	CaptchaToken   string      `json:"captchaToken,omitempty"`
	TurnstileToken string      `json:"turnstileToken,omitempty"`
}

// FlexibleInt keeps compatibility with older clients that sent parent as a
// JSON string while rejecting non-integer values.
type FlexibleInt int

func (f *FlexibleInt) UnmarshalJSON(data []byte) error {
	if string(data) == "null" || len(data) == 0 {
		*f = 0
		return nil
	}
	if data[0] == '"' {
		var value string
		if err := json.Unmarshal(data, &value); err != nil {
			return err
		}
		value = strings.TrimSpace(value)
		if value == "" {
			*f = 0
			return nil
		}
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return err
		}
		*f = FlexibleInt(parsed)
		return nil
	}

	var value int
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	*f = FlexibleInt(value)
	return nil
}

// SubmitComment stores guest-authored comments only. Client-provided IP, user
// agent, location, avatar, token, and user identifiers are not request fields
// and therefore can never be persisted by this handler.
func SubmitComment(c *gin.Context) {
	var req SubmitCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}

	site, ok := requireRegisteredSite(c, req.SiteID, true)
	if !ok {
		return
	}
	siteID := site.ID
	mark := strings.TrimSpace(req.Mark)
	pageTitle := strings.TrimSpace(req.PageTitle)
	content := strings.TrimSpace(req.Content)
	username := strings.TrimSpace(req.Username)
	email := strings.TrimSpace(req.Email)
	website := strings.TrimSpace(req.URL)

	if !validPageKey(mark) {
		utils.SendError(c, http.StatusBadRequest, "页面 key 无效")
		return
	}
	if strings.ContainsRune(content, 0) || strings.ContainsRune(username, 0) || strings.ContainsRune(email, 0) || strings.ContainsRune(website, 0) || strings.ContainsRune(pageTitle, 0) {
		utils.SendError(c, http.StatusBadRequest, "评论内容无效")
		return
	}
	if pageTitle != "" && textLength(pageTitle) > 200 {
		utils.SendError(c, http.StatusBadRequest, "文章标题无效")
		return
	}

	if content == "" || textLength(content) > site.CommentLimit {
		utils.SendError(c, http.StatusBadRequest, "评论内容无效")
		return
	}
	if !validSmojiContent(content, site) {
		utils.SendError(c, http.StatusBadRequest, "评论内容包含无效表情")
		return
	}

	if err := captcha.Verify(c.Request.Context(), captcha.Tokens{Captcha: req.CaptchaToken, Turnstile: req.TurnstileToken}); err != nil {
		if errors.Is(err, captcha.ErrFailed) {
			utils.SendError(c, http.StatusBadRequest, "请完成验证后再发布。")
			return
		}
		utils.SendError(c, http.StatusServiceUnavailable, "验证服务暂时不可用")
		return
	}

	blogger := site.MatchesBloggerPassphrase(username)
	if blogger {
		if !site.BloggerProofConfigured() {
			utils.SendError(c, http.StatusBadRequest, "评论内容无效")
			return
		}
		username = strings.TrimSpace(site.BloggerNickname)
		email = strings.TrimSpace(site.BloggerEmail)
		website = strings.TrimSpace(site.SiteURL)
	}

	if username == "" || textLength(username) > maxNicknameLength {
		utils.SendError(c, http.StatusBadRequest, "昵称无效")
		return
	}
	if (site.EmailRequired && !blogger && email == "") || (email != "" && !validEmail(email)) {
		utils.SendError(c, http.StatusBadRequest, "邮箱无效")
		return
	}
	if (site.WebsiteRequired && !blogger && website == "") || !validWebsiteURL(website) {
		utils.SendError(c, http.StatusBadRequest, "网址无效，仅支持 http 或 https")
		return
	}

	parentValue := int(req.Parent)
	if parentValue < 0 {
		utils.SendError(c, http.StatusBadRequest, "父评论 ID 无效")
		return
	}
	var parentID *uint
	if parentValue > 0 {
		value := uint(parentValue)
		if int(value) != parentValue {
			utils.SendError(c, http.StatusBadRequest, "父评论 ID 无效")
			return
		}
		parentID = &value
	}

	comment := model.Comment{
		SiteID:    siteID,
		Mark:      mark,
		PageTitle: pageTitle,
		Content:   content,
		ParentID:  parentID,
		Username:  username,
		IsBlogger: blogger,
	}
	if email != "" {
		emailValue := email
		comment.Email = &emailValue
	}
	if website != "" {
		websiteValue := website
		comment.URL = &websiteValue
	}

	if err := model.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if parentID != nil {
			var parent model.Comment
			err := tx.Where("id = ?", *parentID).First(&parent).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errParentNotFound
			}
			if err != nil {
				return err
			}
			if parent.SiteID != siteID || parent.Mark != mark {
				return errParentConflict
			}
			if parent.DeletedAt != nil {
				return errParentUnavailable
			}
			// Count only the bounded ancestor chain, inside the write transaction.
			ancestor := parent
			for depth := 1; ; depth++ {
				if depth > maxPublicListDepth {
					return errReplyDepth
				}
				if ancestor.ParentID == nil {
					break
				}
				nextID := *ancestor.ParentID
				ancestor = model.Comment{}
				if err := tx.Where("id = ? AND site_id = ? AND mark = ?", nextID, siteID, mark).First(&ancestor).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Create(&comment).Error; err != nil {
			return err
		}
		return notifications.EnqueueNewComment(tx, comment)
	}); err != nil {
		switch {
		case c.Request.Context().Err() != nil:
			utils.SendError(c, http.StatusServiceUnavailable, "评论提交超时，请先确认是否已发布")
		case errors.Is(err, errParentNotFound):
			utils.SendError(c, http.StatusNotFound, "父评论不存在")
		case errors.Is(err, errParentConflict):
			utils.SendError(c, http.StatusConflict, "父评论不属于当前站点和页面")
		case errors.Is(err, errReplyDepth):
			utils.SendError(c, http.StatusUnprocessableEntity, "回复层级已达上限，请回复较上层的评论")
		case errors.Is(err, errParentUnavailable):
			utils.SendError(c, http.StatusConflict, "不能回复已删除评论")
		default:
			utils.SendError(c, http.StatusInternalServerError, "保存评论失败")
		}
		return
	}

	utils.SendResponse(c, http.StatusCreated, "评论提交成功", gin.H{"id": comment.ID, "isBlogger": comment.IsBlogger})
}

var (
	errReplyDepth        = errors.New("reply depth exceeded")
	errParentNotFound    = errors.New("parent comment not found")
	errParentConflict    = errors.New("parent comment conflict")
	errParentUnavailable = errors.New("parent comment unavailable")
)
