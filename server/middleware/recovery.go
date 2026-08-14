package middleware

import (
	"ecoku-server/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Recovery returns the standard JSON envelope and deliberately avoids logging
// headers, request bodies, tokens, or panic values.
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				log.Print("请求处理发生内部异常")
				utils.SendError(c, http.StatusInternalServerError, "服务器内部错误")
				c.Abort()
			}
		}()
		c.Next()
	}
}
