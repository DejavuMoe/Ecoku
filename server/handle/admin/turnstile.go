package admin

import (
	"ecoku-server/captcha"
	"ecoku-server/utils"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetLoginConfig(c *gin.Context) {
	public, err := captcha.PublicConfig()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取登录验证配置失败")
		return
	}
	legacySitekey := ""
	if public.Provider == captcha.ProviderTurnstile {
		legacySitekey = public.Sitekey
	}
	utils.SendResponse(c, http.StatusOK, "获取登录验证配置成功", gin.H{
		"captcha":          public,
		"turnstileSitekey": legacySitekey,
	})
}

func GetCaptchaSettings(c *gin.Context) {
	settings, err := captcha.GetSettings()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取验证设置失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取验证设置成功", settings)
}

func SaveCaptchaSettings(c *gin.Context) {
	var request captcha.Settings
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	updated, err := captcha.Save(request)
	sendCaptchaSaveResult(c, updated, err)
}

func GetTurnstileSettings(c *gin.Context) {
	settings, err := captcha.GetLegacyTurnstileSettings()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "读取验证设置失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "获取验证设置成功", settings)
}

func SaveTurnstileSettings(c *gin.Context) {
	var request captcha.LegacyTurnstileSettings
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	updated, err := captcha.SaveLegacyTurnstile(request)
	sendCaptchaSaveResult(c, updated, err)
}

func sendCaptchaSaveResult(c *gin.Context, updated any, err error) {
	switch {
	case errors.Is(err, captcha.ErrValidation):
		utils.SendError(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, captcha.ErrConflict):
		utils.SendError(c, http.StatusConflict, "验证设置已被其他会话更新")
	case errors.Is(err, captcha.ErrEncryptionKeyUnavailable):
		utils.SendError(c, http.StatusServiceUnavailable, "验证凭据加密密钥尚未配置")
	case err != nil:
		utils.SendError(c, http.StatusInternalServerError, "保存验证设置失败")
	default:
		utils.SendResponse(c, http.StatusOK, "验证设置已保存", updated)
	}
}
