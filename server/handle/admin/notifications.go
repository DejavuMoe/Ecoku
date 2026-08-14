package admin

import (
	"ecoku-server/notifications"
	"ecoku-server/utils"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetNotificationSettings(c *gin.Context) {
	email, telegram, err := notifications.GetSettings()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取通知设置失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取通知设置成功", gin.H{"email": email, "telegram": telegram})
}

func SaveEmailNotificationSettings(c *gin.Context) {
	var request notifications.EmailConfig
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	updated, err := notifications.SaveEmail(request)
	switch {
	case errors.Is(err, notifications.ErrValidation):
		utils.SendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, notifications.ErrConflict):
		utils.SendError(c, http.StatusConflict, "通知设置已被其他会话更新")
	case errors.Is(err, notifications.ErrEncryptionKeyUnavailable):
		utils.SendError(c, http.StatusServiceUnavailable, "通知加密密钥尚未配置")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "保存电子邮件通知失败")
	default:
		utils.SendResponse(c, http.StatusOK, "电子邮件通知已保存", gin.H{"email": updated})
	}
}

func SaveTelegramNotificationSettings(c *gin.Context) {
	var request notifications.TelegramConfig
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	updated, err := notifications.SaveTelegram(request)
	switch {
	case errors.Is(err, notifications.ErrValidation):
		utils.SendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, notifications.ErrConflict):
		utils.SendError(c, http.StatusConflict, "通知设置已被其他会话更新")
	case errors.Is(err, notifications.ErrEncryptionKeyUnavailable):
		utils.SendError(c, http.StatusServiceUnavailable, "通知加密密钥尚未配置")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "保存 Telegram 通知失败")
	default:
		utils.SendResponse(c, http.StatusOK, "Telegram 通知已保存", gin.H{"telegram": updated})
	}
}

func TestEmailNotification(c *gin.Context) {
	var request notifications.EmailConfig
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	code := notifications.SendTestEmail(c.Request.Context(), request)
	if code == "validation_failed" {
		utils.SendError(c, http.StatusBadRequest, "电子邮件测试配置无效")
		return
	}
	if code != "" {
		utils.SendResponse(c, http.StatusBadGateway, "测试邮件发送失败", gin.H{"error_code": code})
		return
	}
	utils.SendResponse(c, http.StatusOK, "测试邮件已发送", nil)
}

func TestTelegramNotification(c *gin.Context) {
	var request notifications.TelegramConfig
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	code := notifications.SendTestTelegram(c.Request.Context(), request)
	if code == "validation_failed" {
		utils.SendError(c, http.StatusBadRequest, "Telegram 测试配置无效")
		return
	}
	if code != "" {
		utils.SendResponse(c, http.StatusBadGateway, "测试消息发送失败", gin.H{"error_code": code})
		return
	}
	utils.SendResponse(c, http.StatusOK, "测试消息已发送", nil)
}
