package middleware

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Cors allows only origins explicitly registered for at least one configured
// site. Individual handlers additionally enforce that the origin belongs to
// the requested site rather than merely another site in the same process.
func Cors() gin.HandlerFunc {
	adminOrigins := make(map[string]struct{})
	for _, origin := range config.GetAdminAllowedOrigins() {
		adminOrigins[origin] = struct{}{}
	}

	return func(c *gin.Context) {
		// CORS is an API boundary. Browsers also attach an Origin header to
		// same-origin module and stylesheet requests when the generated admin
		// HTML uses crossorigin attributes. Applying the site registry to those
		// static files would reject the admin application's own assets.
		if !isAPIPath(c.Request.URL.Path) {
			c.Next()
			return
		}

		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			normalized, err := config.NormalizeOrigin(origin)
			if err != nil {
				utils.SendError(c, http.StatusForbidden, "来源不被允许")
				c.Abort()
				return
			}
			allowed := false
			if isAdminAPIPath(c.Request.URL.Path) {
				_, allowed = adminOrigins[normalized]
			} else {
				var queryErr error
				allowed, queryErr = model.IsPublicOriginAllowedWithContext(c.Request.Context(), normalized)
				if queryErr != nil {
					status := http.StatusInternalServerError
					if c.Request.Context().Err() != nil {
						status = http.StatusServiceUnavailable
					}
					utils.SendError(c, status, "验证来源失败")
					c.Abort()
					return
				}
			}
			if !allowed {
				utils.SendError(c, http.StatusForbidden, "来源不被允许")
				c.Abort()
				return
			}
			c.Header("Access-Control-Allow-Origin", normalized)
			c.Header("Vary", "Origin")
		}

		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isAPIPath(path string) bool {
	return path == "/api" || strings.HasPrefix(path, "/api/")
}

func isAdminAPIPath(path string) bool {
	return path == "/api/admin" || strings.HasPrefix(path, "/api/admin/")
}
