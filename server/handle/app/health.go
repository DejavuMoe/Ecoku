package app

import (
	"ecoku-server/utils"
	"time"

	"github.com/gin-gonic/gin"
)

func HealthCheck(c *gin.Context) {
	var HealthData = map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
	}
	utils.SendSuccess(c, HealthData)
}
