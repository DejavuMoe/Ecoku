package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger deliberately excludes client IPs, query strings, headers,
// bodies, and Gin context errors from the default access log.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()
		path := c.FullPath()
		if path == "" {
			path = "<unmatched>"
		}
		log.Printf(
			"HTTP method=%s path=%s status=%d duration_ms=%d",
			c.Request.Method,
			path,
			c.Writer.Status(),
			time.Since(startedAt).Milliseconds(),
		)
	}
}
