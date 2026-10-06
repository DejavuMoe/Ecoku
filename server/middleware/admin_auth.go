package middleware

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	adminPrincipalContextKey = "ecoku.admin.principal"
	adminSiteIDContextKey    = "ecoku.admin.site_id"
	maximumAuthorizationSize = 16 * 1024
	AdminSessionCookie       = "ecoku_admin_session"
)

type adminPrincipal struct {
	token        string
	claims       *utils.AdminTokenClaims
	legacySiteID string
}

// AdminAuthentication accepts an instance administrator session, either from
// the session cookie or as a Bearer token.
func AdminAuthentication() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		scheme, credential, ok := parseAuthorizationHeader(header)
		if header == "" {
			value, err := c.Cookie(AdminSessionCookie)
			if err == nil && value != "" {
				if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
					if !CheckAdminOrigin(c) {
						return
					}
				}
				scheme, credential, ok = "Bearer", value, true
			}
		}
		if !ok {
			unauthorizedAdmin(c)
			return
		}
		if strings.EqualFold(scheme, "EcokuSite") {
			siteID, authenticated := authenticateManagementKey(c.Request.Context(), credential)
			if !authenticated {
				unauthorizedAdmin(c)
				return
			}
			c.Set(adminPrincipalContextKey, adminPrincipal{token: credential, legacySiteID: siteID})
			c.Next()
			return
		}
		if !strings.EqualFold(scheme, "Bearer") {
			unauthorizedAdmin(c)
			return
		}

		claims, err := utils.ParseAdminToken(credential)
		if err != nil {
			if errors.Is(err, utils.ErrAdminSessionUnavailable) {
				utils.SendError(c, http.StatusServiceUnavailable, "管理员会话存储不可用")
				c.Abort()
				return
			}
			unauthorizedAdmin(c)
			return
		}

		c.Set(adminPrincipalContextKey, adminPrincipal{token: credential, claims: claims})
		c.Next()
	}
}

// RequireAdminSiteAccess validates the explicit site path parameter after the
// administrator has authenticated.
func RequireAdminSiteAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		siteID := strings.TrimSpace(c.Param("siteId"))
		if siteID == "" || !config.IsValidSiteID(siteID) {
			utils.SendError(c, http.StatusBadRequest, "siteId 参数无效")
			c.Abort()
			return
		}
		exists, err := model.SiteExists(c.Request.Context(), siteID)
		if err != nil {
			utils.SendError(c, http.StatusInternalServerError, "读取站点配置失败")
			c.Abort()
			return
		}
		if !exists {
			utils.SendError(c, http.StatusNotFound, "站点不存在")
			c.Abort()
			return
		}
		if value, exists := c.Get(adminPrincipalContextKey); exists {
			principal, valid := value.(adminPrincipal)
			if valid && principal.legacySiteID != "" && principal.legacySiteID != siteID {
				utils.SendError(c, http.StatusForbidden, "无权管理该站点")
				c.Abort()
				return
			}
		}

		c.Set(adminSiteIDContextKey, siteID)
		c.Next()
	}
}

// RequireCompletedAdmin blocks a temporary first-login session from reaching
// the normal management API. Session, logout and initial setup are the only
// endpoints available to that session.
func RequireCompletedAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, claims := CurrentAdminSession(c)
		principalValue, _ := c.Get(adminPrincipalContextKey)
		principal, _ := principalValue.(adminPrincipal)
		if principal.legacySiteID != "" {
			if c.Request.Method == http.MethodDelete && strings.HasSuffix(c.FullPath(), "/comments/:commentId") {
				c.Next()
				return
			}
			utils.SendError(c, http.StatusForbidden, "站点管理凭据不能访问此接口")
			c.Abort()
			return
		}
		if claims == nil || !claims.SetupOnly || strings.HasSuffix(c.FullPath(), "/session") || strings.HasSuffix(c.FullPath(), "/logout") || strings.HasSuffix(c.FullPath(), "/initial-setup") {
			c.Next()
			return
		}
		utils.SendError(c, http.StatusForbidden, "请先完成管理员首次设置")
		c.Abort()
	}
}

func authenticateManagementKey(ctx context.Context, candidate string) (string, bool) {
	if candidate == "" || len(candidate) > maximumAuthorizationSize {
		return "", false
	}
	matchedSiteID := ""
	matchCount := 0
	for _, site := range config.GetRegisteredSites() {
		key, available := config.GetManagementKey(site.ID)
		if !available || !utils.ConstantTimeStringEqual(candidate, key) {
			continue
		}
		exists, err := model.SiteExists(ctx, site.ID)
		if err == nil && exists {
			matchedSiteID = site.ID
			matchCount++
		}
	}
	return matchedSiteID, matchCount == 1
}

func RequireInitialSetup() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, claims := CurrentAdminSession(c)
		if claims != nil && claims.SetupOnly {
			c.Next()
			return
		}
		utils.SendError(c, http.StatusForbidden, "当前会话不需要管理员首次设置")
		c.Abort()
	}
}

func AuthorizedAdminSiteID(c *gin.Context) (string, bool) {
	value, exists := c.Get(adminSiteIDContextKey)
	if !exists {
		return "", false
	}
	siteID, ok := value.(string)
	return siteID, ok && siteID != ""
}

func NoStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("Pragma", "no-cache")
		c.Next()
	}
}

func parseAuthorizationHeader(header string) (string, string, bool) {
	header = strings.TrimSpace(header)
	if header == "" || len(header) > maximumAuthorizationSize {
		return "", "", false
	}
	parts := strings.Fields(header)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func unauthorizedAdmin(c *gin.Context) {
	utils.SendError(c, http.StatusUnauthorized, "管理员认证失败")
	c.Abort()
}

// Cookie writes and login require an explicit trusted browser origin. A
// Bearer token in the Authorization header does not depend on Origin.
func CheckAdminOrigin(c *gin.Context) bool {
	origin, err := config.NormalizeOrigin(c.GetHeader("Origin"))
	if err == nil {
		for _, allowed := range config.GetAdminAllowedOrigins() {
			if origin == allowed {
				return true
			}
		}
	}
	utils.SendError(c, http.StatusForbidden, "管理员请求来源无效")
	c.Abort()
	return false
}

func CurrentAdminSession(c *gin.Context) (string, *utils.AdminTokenClaims) {
	value, _ := c.Get(adminPrincipalContextKey)
	principal, _ := value.(adminPrincipal)
	return principal.token, principal.claims
}
