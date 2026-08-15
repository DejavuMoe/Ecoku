package admin

import (
	"ecoku-server/turnstile"
	"ecoku-server/utils"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetLoginConfig(c *gin.Context) {
	sitekey, err := turnstile.PublicSitekey()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取登录验证配置失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取登录验证配置成功", gin.H{"turnstileSitekey": sitekey})
}

func GetTurnstileSettings(c *gin.Context) {
	settings, err := turnstile.GetSettings()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取验证设置失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取验证设置成功", settings)
}

func SaveTurnstileSettings(c *gin.Context) {
	var request turnstile.Settings
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	updated, err := turnstile.Save(request)
	switch {
	case errors.Is(err, turnstile.ErrValidation):
		utils.SendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, turnstile.ErrConflict):
		utils.SendError(c, http.StatusConflict, "验证设置已被其他会话更新")
	case errors.Is(err, turnstile.ErrEncryptionKeyUnavailable):
		utils.SendError(c, http.StatusServiceUnavailable, "通知加密密钥尚未配置")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "保存验证设置失败")
	default:
		utils.SendResponse(c, http.StatusOK, "验证设置已保存", updated)
	}
}
