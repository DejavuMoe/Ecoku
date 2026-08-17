package admin

import (
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/utils"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	maximumAdminLoginUsernameLength = 80
	maximumBcryptPasswordBytes      = 72
)

type loginRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	CaptchaToken   string `json:"captchaToken"`
	TurnstileToken string `json:"turnstileToken"`
}

type loginResponse struct {
	Token     string `json:"token"`
	TokenType string `json:"token_type"`
	ExpiresAt string `json:"expires_at"`
	ExpiresIn int64  `json:"expires_in"`
}

func Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		if errors.Is(err, io.EOF) {
			loginUnauthorized(c)
			return
		}
		utils.SendJSONBindingError(c, err)
		return
	}

	credentials, available := config.GetAdminCredentials()
	if !available {
		utils.SendError(c, http.StatusInternalServerError, "管理员认证不可用")
		return
	}

	if err := captcha.Verify(c.Request.Context(), captcha.Tokens{Captcha: request.CaptchaToken, Turnstile: request.TurnstileToken}); err != nil {
		if errors.Is(err, captcha.ErrFailed) {
			utils.SendError(c, http.StatusBadRequest, "验证失败，请重试。")
			return
		}
		utils.SendError(c, http.StatusServiceUnavailable, "验证服务暂时不可用")
		return
	}

	username := strings.TrimSpace(request.Username)
	usernameMatches := username != "" && len([]rune(username)) <= maximumAdminLoginUsernameLength && utils.ConstantTimeStringEqual(username, credentials.Username)
	passwordCandidateValid := request.Password != "" && len([]byte(request.Password)) <= maximumBcryptPasswordBytes
	passwordMatches := bcrypt.CompareHashAndPassword([]byte(credentials.PasswordHash), []byte(request.Password)) == nil
	if !usernameMatches || !passwordCandidateValid || !passwordMatches {
		loginUnauthorized(c)
		return
	}

	token, expiresAt, err := utils.GenerateAdminToken()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "生成管理员会话失败")
		return
	}
	utils.SendResponse(c, http.StatusOK, "管理员登录成功", loginResponse{
		Token:     token,
		TokenType: "Bearer",
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339Nano),
		ExpiresIn: int64(credentials.TokenTTL.Seconds()),
	})
}

func loginUnauthorized(c *gin.Context) {
	utils.SendError(c, http.StatusUnauthorized, "用户名或密码错误")
}
