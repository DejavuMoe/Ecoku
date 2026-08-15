package middleware

import (
	"ecoku-server/utils"
	"net/http"

	"github.com/gin-gonic/gin"
)

const MaxRequestBodyBytes int64 = 16 * 1024
const MaxCommentRequestBodyBytes int64 = 80 * 1024

// LimitRequestBody enforces the same limit for declared and streaming bodies.
func LimitRequestBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body == nil {
			c.Next()
			return
		}
		if c.Request.ContentLength > maxBytes {
			utils.SendError(c, http.StatusRequestEntityTooLarge, "请求体过大")
			c.Abort()
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
