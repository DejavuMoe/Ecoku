package comment

import (
	"ecoku-server/model"
	"ecoku-server/notifications"
	"ecoku-server/utils"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SubmitCommentRequest struct {
	SiteID    string      `json:"siteId"`
	Mark      string      `json:"mark"`
	PageTitle string      `json:"pageTitle,omitempty"`
	Content   string      `json:"content"`
	Username  string      `json:"username"`
	Email     string      `json:"email"`
	Parent    FlexibleInt `json:"parent,omitempty"`
	URL       string      `json:"url,omitempty"`
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

	siteID, ok := requireRegisteredSite(c, req.SiteID, true)
	if !ok {
		return
	}
	site, err := model.GetSite(siteID)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取评论表单配置失败")
		return
	}
	mark := strings.TrimSpace(req.Mark)
	pageTitle := strings.TrimSpace(req.PageTitle)
	content := strings.TrimSpace(req.Content)
	username := strings.TrimSpace(req.Username)
	email := strings.TrimSpace(req.Email)
	website := strings.TrimSpace(req.URL)

	if mark == "" || textLength(mark) > maxPageKeyLength {
		utils.SendError(c, http.StatusBadRequest, "页面 key 无效")
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
	if username == "" || textLength(username) > maxNicknameLength {
		utils.SendError(c, http.StatusBadRequest, "昵称无效")
		return
	}
	if (site.EmailRequired && email == "") || (email != "" && !validEmail(email)) {
		utils.SendError(c, http.StatusBadRequest, "邮箱无效")
		return
	}
	if (site.WebsiteRequired && website == "") || !validWebsiteURL(website) {
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
		var parent model.Comment
		err := model.DB.Where("id = ?", parentValue).First(&parent).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.SendError(c, http.StatusNotFound, "父评论不存在")
			return
		}
		if err != nil {
			utils.SendError(c, http.StatusInternalServerError, "验证父评论失败")
			return
		}
		if parent.SiteID != siteID || parent.Mark != mark {
			utils.SendError(c, http.StatusConflict, "父评论不属于当前站点和页面")
			return
		}
		if parent.DeletedAt != nil {
			utils.SendError(c, http.StatusConflict, "不能回复已删除评论")
			return
		}
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
	}
	if email != "" {
		emailValue := email
		comment.Email = &emailValue
	}
	if website != "" {
		websiteValue := website
		comment.URL = &websiteValue
	}

	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&comment).Error; err != nil {
			return err
		}
		return notifications.EnqueueNewComment(tx, comment)
	}); err != nil {
		utils.SendError(c, http.StatusInternalServerError, "保存评论失败")
		return
	}

	utils.SendResponse(c, http.StatusCreated, "评论提交成功", gin.H{"id": comment.ID})
}
