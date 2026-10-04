package admin

import (
	"ecoku-server/adminidentity"
	"ecoku-server/captcha"
	"ecoku-server/config"
	"ecoku-server/middleware"
	"ecoku-server/utils"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
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
	ExpiresAt              string `json:"expires_at"`
	ExpiresIn              int64  `json:"expires_in"`
	RequiresPasswordChange bool   `json:"requires_password_change,omitempty"`
	// Username is only returned to a setup-only session so the setup form can
	// keep the account name after admin reset-password.
	Username string `json:"username,omitempty"`
}

type initialSetupRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Login(c *gin.Context) {
	if !middleware.CheckAdminOrigin(c) {
		return
	}
	normalizedOrigin, _ := config.NormalizeOrigin(c.GetHeader("Origin"))
	origin, _ := url.Parse(normalizedOrigin)
	if origin.Scheme != "https" && !loopbackHost(origin.Hostname()) {
		utils.SendError(c, http.StatusBadRequest, "管理员登录需要 HTTPS，回环开发地址除外")
		return
	}
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

	generateToken := utils.GenerateAdminToken
	if credentials.MustChangePassword {
		generateToken = utils.GenerateAdminSetupToken
	}
	token, expiresAt, err := generateToken()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "生成管理员会话失败")
		return
	}
	setSessionCookie(c, token, expiresAt, int(time.Until(expiresAt).Seconds()))
	response := loginResponse{
		ExpiresAt:              expiresAt.UTC().Format(time.RFC3339Nano),
		ExpiresIn:              int64(credentials.TokenTTL.Seconds()),
		RequiresPasswordChange: credentials.MustChangePassword,
	}
	if credentials.MustChangePassword {
		response.Username = credentials.Username
	}
	utils.SendResponse(c, http.StatusOK, "管理员登录成功", response)
}

func loginUnauthorized(c *gin.Context) {
	utils.SendError(c, http.StatusUnauthorized, "用户名或密码错误")
}

func Session(c *gin.Context) {
	_, claims := middleware.CurrentAdminSession(c)
	if claims == nil {
		utils.SendError(c, http.StatusUnauthorized, "管理员认证失败")
		return
	}
	response := loginResponse{
		ExpiresAt:              claims.ExpiresAt.UTC().Format(time.RFC3339Nano),
		ExpiresIn:              int64(time.Until(claims.ExpiresAt).Seconds()),
		RequiresPasswordChange: claims.SetupOnly,
	}
	if claims.SetupOnly {
		if credentials, ok := config.GetAdminCredentials(); ok {
			response.Username = credentials.Username
		}
	}
	utils.SendResponse(c, http.StatusOK, "管理员会话有效", response)
}

func InitialSetup(c *gin.Context) {
	var request initialSetupRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.SendJSONBindingError(c, err)
		return
	}
	credentials, ok := config.GetAdminCredentials()
	if !ok || bcrypt.CompareHashAndPassword([]byte(credentials.PasswordHash), []byte(request.Password)) == nil {
		utils.SendError(c, http.StatusBadRequest, "新密码不能与临时密码相同")
		return
	}
	if err := adminidentity.CompleteInitialSetup(request.Username, request.Password); err != nil {
		utils.SendError(c, http.StatusBadRequest, err.Error())
		return
	}
	token, expiresAt, err := utils.GenerateAdminToken()
	if err != nil {
		utils.SendError(c, http.StatusInternalServerError, "生成管理员会话失败")
		return
	}
	setSessionCookie(c, token, expiresAt, int(time.Until(expiresAt).Seconds()))
	utils.SendResponse(c, http.StatusOK, "管理员账户设置成功", loginResponse{
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339Nano),
		ExpiresIn: int64(time.Until(expiresAt).Seconds()),
	})
}

func Logout(c *gin.Context) {
	token, _ := middleware.CurrentAdminSession(c)
	if err := utils.RevokeAdminToken(token); err != nil {
		utils.SendError(c, http.StatusServiceUnavailable, "退出失败，请重试。")
		return
	}
	setSessionCookie(c, "", time.Unix(1, 0), -1)
	utils.SendSuccess(c, nil)
}

func loopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func setSessionCookie(c *gin.Context, token string, expires time.Time, maxAge int) {
	// Public HTTPS may terminate at the proxy, so never infer Secure from TLS
	// on the internal connection or untrusted forwarding headers.
	secure := true
	normalizedOrigin, _ := config.NormalizeOrigin(c.GetHeader("Origin"))
	origin, err := url.Parse(normalizedOrigin)
	if err == nil && origin.Scheme == "http" && loopbackHost(origin.Hostname()) {
		secure = false
	}
	http.SetCookie(c.Writer, &http.Cookie{Name: middleware.AdminSessionCookie, Value: token,
		Path: "/api/admin", HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode,
		Expires: expires, MaxAge: maxAge})
}
