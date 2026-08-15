package comment

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	maxSiteIDLength   = 100
	maxPageKeyLength  = 512
	maxNicknameLength = 80
	maxEmailLength    = 254
	maxWebsiteLength  = 2048
	maxCommentLength  = 10000
	defaultPageSize   = 10
	maxPageSize       = 100
)

func requireRegisteredSite(c *gin.Context, rawSiteID string, requireOrigin bool) (string, bool) {
	siteID := strings.TrimSpace(rawSiteID)
	if siteID == "" || textLength(siteID) > maxSiteIDLength {
		utils.SendError(c, http.StatusBadRequest, "siteId 参数无效")
		return "", false
	}
	_, err := model.GetSite(siteID)
	if err == model.ErrSiteNotFound {
		utils.SendError(c, http.StatusNotFound, "站点不存在")
		return "", false
	}
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取站点配置失败")
		return "", false
	}
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if requireOrigin && origin == "" {
		utils.SendError(c, http.StatusForbidden, "评论提交必须来自已注册来源")
		return "", false
	}
	normalizedOrigin := ""
	if origin != "" {
		normalizedOrigin, err = config.NormalizeOrigin(origin)
		if err != nil {
			utils.SendError(c, http.StatusForbidden, "来源不属于当前站点")
			return "", false
		}
	}
	allowed, err := model.IsSiteOriginAllowed(siteID, normalizedOrigin)
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "验证站点来源失败")
		return "", false
	}
	if !allowed {
		utils.SendError(c, http.StatusForbidden, "来源不属于当前站点")
		return "", false
	}
	return siteID, true
}

func validPageKey(value string) bool {
	if value == "" || textLength(value) > maxPageKeyLength {
		return false
	}
	for _, r := range value {
		if r < 0x20 || r == 0x7f || r == '\\' {
			return false
		}
	}
	return pageKeyHasNoLocation(value) && pageKeyHasNoLocation(strings.TrimPrefix(value, "/"))
}

func pageKeyHasNoLocation(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.Scheme == "" && parsed.Host == "" && parsed.User == nil && !parsed.IsAbs()
}

func validEmail(value string) bool {
	if value == "" || textLength(value) > maxEmailLength {
		return false
	}
	address, err := mail.ParseAddress(value)
	return err == nil && strings.EqualFold(address.Address, value)
}

func validWebsiteURL(value string) bool {
	if value == "" {
		return true
	}
	if textLength(value) > maxWebsiteLength {
		return false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return false
	}
	scheme := strings.ToLower(parsed.Scheme)
	return scheme == "http" || scheme == "https"
}

func textLength(value string) int {
	return utf8.RuneCountInString(value)
}
