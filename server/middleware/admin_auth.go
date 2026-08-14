package middleware

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	adminPrincipalContextKey = "ecoku.admin.principal"
	adminSiteIDContextKey    = "ecoku.admin.site_id"
	maximumAuthorizationSize = 16 * 1024
)

type adminPrincipal struct {
	instanceAdmin bool
	siteID        string
}

// AdminAuthentication accepts either an instance administrator bearer token
// or an EcokuSite credential reserved for trusted server-side automation.
func AdminAuthentication() gin.HandlerFunc {
	return func(c *gin.Context) {
		scheme, credential, ok := parseAuthorizationHeader(c.GetHeader("Authorization"))
		if !ok {
			unauthorizedAdmin(c)
			return
		}

		var principal adminPrincipal
		switch {
		case strings.EqualFold(scheme, "Bearer"):
			if _, err := utils.ParseAdminToken(credential); err != nil {
				unauthorizedAdmin(c)
				return
			}
			principal.instanceAdmin = true
		case strings.EqualFold(scheme, "EcokuSite"):
			siteID, authenticated := authenticateManagementKey(credential)
			if !authenticated {
				unauthorizedAdmin(c)
				return
			}
			principal.siteID = siteID
		default:
			unauthorizedAdmin(c)
			return
		}

		c.Set(adminPrincipalContextKey, principal)
		c.Next()
	}
}

// RequireAdminSiteAccess validates the explicit site path parameter after the
// caller has authenticated. Instance administrators can access every
// registered site; a management key is restricted to its own site.
func RequireAdminSiteAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		siteID := strings.TrimSpace(c.Param("siteId"))
		if siteID == "" || !config.IsValidSiteID(siteID) {
			utils.SendError(c, http.StatusBadRequest, "siteId 参数无效")
			c.Abort()
			return
		}
		exists, err := model.SiteExists(siteID)
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

		value, exists := c.Get(adminPrincipalContextKey)
		principal, valid := value.(adminPrincipal)
		if !exists || !valid {
			unauthorizedAdmin(c)
			return
		}
		if !principal.instanceAdmin && principal.siteID != siteID {
			utils.SendError(c, http.StatusForbidden, "无权管理该站点")
			c.Abort()
			return
		}

		c.Set(adminSiteIDContextKey, siteID)
		c.Next()
	}
}

// RequireInstanceAdmin restricts instance-wide capabilities such as site
// discovery to a Bearer administrator session. A site management key remains
// valid only for its explicit site-scoped automation endpoints.
func RequireInstanceAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		value, exists := c.Get(adminPrincipalContextKey)
		principal, valid := value.(adminPrincipal)
		if !exists || !valid {
			unauthorizedAdmin(c)
			return
		}
		if !principal.instanceAdmin {
			utils.SendError(c, http.StatusForbidden, "站点管理凭据无权访问实例信息")
			c.Abort()
			return
		}
		c.Next()
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

func authenticateManagementKey(candidate string) (string, bool) {
	if candidate == "" || len(candidate) > maximumAuthorizationSize {
		return "", false
	}
	matchedSiteID := ""
	matchCount := 0
	for _, site := range config.GetRegisteredSites() {
		key, available := config.GetManagementKey(site.ID)
		if !available {
			continue
		}
		if utils.ConstantTimeSecretEqual(candidate, key) {
			exists, err := model.SiteExists(site.ID)
			if err == nil && exists {
				matchedSiteID = site.ID
				matchCount++
			}
		}
	}
	return matchedSiteID, matchCount == 1
}

func unauthorizedAdmin(c *gin.Context) {
	utils.SendError(c, http.StatusUnauthorized, "管理员认证失败")
	c.Abort()
}
