package admin

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"errors"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const (
	maximumSiteURLLength   = 2048
	maximumSiteOrigins     = 32
	maximumSitePlaceholder = 80
	maximumSiteName        = 120
	maximumEmptyMessage    = 240
	maximumBloggerNickname = 80
	maximumBloggerEmail    = 254
	maximumBloggerBadge    = 16
)

type SiteDTO struct {
	ID              string   `json:"id"`
	SiteURL         string   `json:"site_url"`
	Name            string   `json:"name"`
	AllowedOrigins  []string `json:"allowed_origins"`
	DefaultSort     string   `json:"default_sort"`
	EmailRequired   bool     `json:"email_required"`
	WebsiteRequired bool     `json:"website_required"`
	Placeholder     string   `json:"placeholder"`
	CommentLimit    int      `json:"comment_limit"`
	EmptyMessage    string   `json:"empty_message"`
	BloggerNickname string   `json:"blogger_nickname"`
	BloggerEmail    string   `json:"blogger_email"`
	BloggerBadge    string   `json:"blogger_badge"`
	Revision        uint     `json:"revision"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

type SiteWriteRequest struct {
	ID              string   `json:"id"`
	SiteURL         string   `json:"site_url"`
	Name            string   `json:"name"`
	AllowedOrigins  []string `json:"allowed_origins"`
	DefaultSort     string   `json:"default_sort"`
	EmailRequired   *bool    `json:"email_required"`
	WebsiteRequired *bool    `json:"website_required"`
	Placeholder     string   `json:"placeholder"`
	CommentLimit    int      `json:"comment_limit"`
	EmptyMessage    string   `json:"empty_message"`
	BloggerNickname string   `json:"blogger_nickname"`
	BloggerEmail    string   `json:"blogger_email"`
	BloggerBadge    string   `json:"blogger_badge"`
	Revision        uint     `json:"revision"`
}

func ListSites(c *gin.Context) {
	sites, err := model.ListSites()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取站点列表失败")
		return
	}
	result := make([]SiteDTO, 0, len(sites))
	for _, site := range sites {
		result = append(result, siteDTO(site))
	}
	utils.SendResponse(c, http.StatusOK, "获取站点列表成功", gin.H{"data": result})
}

func GetSite(c *gin.Context) {
	site, err := model.GetSite(strings.TrimSpace(c.Param("siteId")))
	if errors.Is(err, model.ErrSiteNotFound) {
		utils.SendError(c, http.StatusNotFound, "站点不存在")
		return
	}
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取站点失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取站点成功", gin.H{"site": siteDTO(site)})
}

func CreateSite(c *gin.Context) {
	var request SiteWriteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	input, ok := validateSiteWrite(c, request, true)
	if !ok {
		return
	}
	created, err := model.CreateSite(input, time.Now().UTC())
	if err != nil {
		if exists, lookupErr := model.SiteExists(input.ID); lookupErr == nil && exists {
			utils.SendError(c, http.StatusConflict, "站点 ID 已存在")
			return
		}
		utils.SendError(c, http.StatusInternalServerError, "创建站点失败")
		return
	}
	utils.SendResponse(c, http.StatusCreated, "站点已创建", gin.H{"site": siteDTO(created)})
}

func UpdateSite(c *gin.Context) {
	var request SiteWriteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	pathID := strings.TrimSpace(c.Param("siteId"))
	if request.ID != "" && strings.TrimSpace(request.ID) != pathID {
		utils.SendError(c, http.StatusBadRequest, "站点 ID 不可修改")
		return
	}
	request.ID = pathID
	input, ok := validateSiteWrite(c, request, false)
	if !ok {
		return
	}
	updated, err := model.UpdateSite(pathID, input, time.Now().UTC())
	switch {
	case errors.Is(err, model.ErrSiteNotFound):
		utils.SendError(c, http.StatusNotFound, "站点不存在")
	case errors.Is(err, model.ErrSiteConflict):
		utils.SendError(c, http.StatusConflict, "站点配置已被其他会话更新")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "更新站点失败")
	default:
		utils.SendResponse(c, http.StatusOK, "站点已更新", gin.H{"site": siteDTO(updated)})
	}
}

func validateSiteWrite(c *gin.Context, request SiteWriteRequest, creating bool) (model.SiteWrite, bool) {
	id := strings.TrimSpace(request.ID)
	if !config.IsValidSiteID(id) {
		utils.SendError(c, http.StatusBadRequest, "站点 ID 无效")
		return model.SiteWrite{}, false
	}
	siteURL, err := config.NormalizeSiteURL(request.SiteURL)
	if err != nil || utf8.RuneCountInString(siteURL) > maximumSiteURLLength {
		utils.SendError(c, http.StatusBadRequest, "站点网址无效")
		return model.SiteWrite{}, false
	}
	parsed, _ := url.Parse(siteURL)
	origins := make([]string, 0, len(request.AllowedOrigins))
	seen := make(map[string]struct{}, len(request.AllowedOrigins))
	if len(request.AllowedOrigins) == 0 || len(request.AllowedOrigins) > maximumSiteOrigins {
		utils.SendError(c, http.StatusBadRequest, "至少需要一个且最多允许 32 个来源")
		return model.SiteWrite{}, false
	}
	adminOrigins := make(map[string]struct{})
	for _, origin := range config.GetAdminAllowedOrigins() {
		adminOrigins[origin] = struct{}{}
	}
	for _, raw := range request.AllowedOrigins {
		normalized, normalizeErr := config.NormalizeOrigin(raw)
		if normalizeErr != nil {
			utils.SendError(c, http.StatusBadRequest, "允许来源无效")
			return model.SiteWrite{}, false
		}
		if _, reserved := adminOrigins[normalized]; reserved {
			utils.SendError(c, http.StatusConflict, "公开站点来源不能复用管理端来源")
			return model.SiteWrite{}, false
		}
		if _, duplicate := seen[normalized]; duplicate {
			continue
		}
		seen[normalized] = struct{}{}
		origins = append(origins, normalized)
	}
	defaultSort := strings.ToLower(strings.TrimSpace(request.DefaultSort))
	if defaultSort == "" {
		defaultSort = config.DefaultCommentSort
	}
	if defaultSort != "newest" && defaultSort != "oldest" {
		utils.SendError(c, http.StatusBadRequest, "默认评论排序无效")
		return model.SiteWrite{}, false
	}
	name := strings.TrimSpace(request.Name)
	if utf8.RuneCountInString(name) > maximumSiteName || strings.ContainsAny(name, "\r\n") {
		utils.SendError(c, http.StatusBadRequest, "站点名称无效")
		return model.SiteWrite{}, false
	}
	placeholder := strings.TrimSpace(request.Placeholder)
	if placeholder == "" {
		placeholder = config.DefaultCommentPlaceholder
	}
	if utf8.RuneCountInString(placeholder) > maximumSitePlaceholder || strings.ContainsAny(placeholder, "\r\n") {
		utils.SendError(c, http.StatusBadRequest, "评论框占位文案无效")
		return model.SiteWrite{}, false
	}
	if !creating && request.Revision == 0 {
		utils.SendError(c, http.StatusBadRequest, "revision 参数无效")
		return model.SiteWrite{}, false
	}
	emailRequired := true
	if request.EmailRequired != nil {
		emailRequired = *request.EmailRequired
	}
	websiteRequired := false
	if request.WebsiteRequired != nil {
		websiteRequired = *request.WebsiteRequired
	}
	commentLimit := request.CommentLimit
	if commentLimit == 0 {
		commentLimit = config.DefaultCommentLimit
	}
	if commentLimit < 1 || commentLimit > 10000 {
		utils.SendError(c, http.StatusBadRequest, "评论长度上限无效")
		return model.SiteWrite{}, false
	}
	emptyMessage := strings.TrimSpace(request.EmptyMessage)
	if emptyMessage == "" {
		emptyMessage = config.DefaultEmptyMessage
	}
	if utf8.RuneCountInString(emptyMessage) > maximumEmptyMessage {
		utils.SendError(c, http.StatusBadRequest, "无评论文案无效")
		return model.SiteWrite{}, false
	}
	bloggerNickname := strings.TrimSpace(request.BloggerNickname)
	bloggerEmail := strings.TrimSpace(request.BloggerEmail)
	if (bloggerNickname == "") != (bloggerEmail == "") {
		utils.SendError(c, http.StatusBadRequest, "博主昵称和邮箱必须同时填写或同时留空")
		return model.SiteWrite{}, false
	}
	if utf8.RuneCountInString(bloggerNickname) > maximumBloggerNickname || strings.ContainsAny(bloggerNickname, "\r\n") {
		utils.SendError(c, http.StatusBadRequest, "博主昵称无效")
		return model.SiteWrite{}, false
	}
	if bloggerEmail != "" {
		parsedEmail, parseErr := mail.ParseAddress(bloggerEmail)
		if parseErr != nil || parsedEmail.Address != bloggerEmail || utf8.RuneCountInString(bloggerEmail) > maximumBloggerEmail || strings.ContainsAny(bloggerEmail, "\r\n") {
			utils.SendError(c, http.StatusBadRequest, "博主邮箱无效")
			return model.SiteWrite{}, false
		}
	}
	bloggerBadge := strings.TrimSpace(request.BloggerBadge)
	if utf8.RuneCountInString(bloggerBadge) > maximumBloggerBadge || strings.ContainsAny(bloggerBadge, "\r\n") {
		utils.SendError(c, http.StatusBadRequest, "评论区标志无效")
		return model.SiteWrite{}, false
	}
	return model.SiteWrite{
		ID: id, SiteURL: siteURL, Domain: strings.ToLower(parsed.Hostname()),
		Name: name, DefaultSort: defaultSort, EmailRequired: emailRequired,
		WebsiteRequired: websiteRequired, Placeholder: placeholder,
		CommentLimit: commentLimit, EmptyMessage: emptyMessage,
		BloggerNickname: bloggerNickname, BloggerEmail: bloggerEmail,
		BloggerBadge:   bloggerBadge,
		AllowedOrigins: origins, Revision: request.Revision,
	}, true
}

func siteDTO(site model.Site) SiteDTO {
	return SiteDTO{
		ID: site.ID, SiteURL: site.SiteURL, Name: site.Name,
		AllowedOrigins: append([]string(nil), site.AllowedOrigins...),
		DefaultSort:    site.DefaultSort, EmailRequired: site.EmailRequired,
		WebsiteRequired: site.WebsiteRequired, Placeholder: site.Placeholder,
		CommentLimit: site.CommentLimit, EmptyMessage: site.EmptyMessage,
		BloggerNickname: site.BloggerNickname, BloggerEmail: site.BloggerEmail,
		BloggerBadge: site.BloggerBadge,
		Revision:     site.Revision, CreatedAt: site.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: site.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}
