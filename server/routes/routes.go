package routes

import (
	"bytes"
	"context"
	"crypto/rand"
	"ecoku-server/captcha"
	"ecoku-server/config"
	adminhandler "ecoku-server/handle/admin"
	"ecoku-server/handle/app"
	"ecoku-server/handle/comment"
	"ecoku-server/middleware"
	"ecoku-server/utils"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Include preflights and rejected Origins in list admission before CORS can
// touch SQLite. Other API and static routes retain their existing middleware.
func forCommentList(handler gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/api/comment/list" {
			handler(c)
		} else {
			c.Next()
		}
	}
}

func NewRouter() (*gin.Engine, error) {
	r := gin.New()
	if err := r.SetTrustedProxies(config.GetTrustedProxies()); err != nil {
		return nil, err
	}
	r.Use(middleware.RequestLogger(), middleware.Recovery(),
		forCommentList(middleware.RateLimit("comment_list")),
		forCommentList(comment.PublicListBudget), middleware.Cors())
	if directory := config.GetClientStaticDir(); directory != "" {
		if err := registerClientStatic(r, directory); err != nil {
			return nil, err
		}
	}
	if config.IsAdminEnabled() {
		if err := registerAdminStatic(r, config.GetAdminStaticDir()); err != nil {
			return nil, err
		}
	}
	r.NoRoute(func(c *gin.Context) {
		utils.SendError(c, http.StatusNotFound, "接口不存在")
	})
	r.NoMethod(func(c *gin.Context) {
		utils.SendError(c, http.StatusMethodNotAllowed, "请求方法不被允许")
	})

	public := r.Group("api")
	{
		public.GET("/health", app.HealthCheck)

		public.POST(
			"/comment/submit",
			middleware.LimitRequestBody(middleware.MaxCommentRequestBodyBytes),
			middleware.RateLimit("comment_submit"),
			comment.SubmitComment,
		)
		public.GET("/comment/list", comment.GetComments)

		if config.IsAdminEnabled() {
			admin := public.Group("/admin")
			admin.Use(middleware.NoStore())
			admin.POST(
				"/login",
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				middleware.RateLimit("admin_login"),
				adminhandler.Login,
			)
			admin.GET("/login-config", adminhandler.GetLoginConfig)

			protected := admin.Group("")
			protected.Use(middleware.AdminAuthentication())
			protected.GET("/session", middleware.RequireInstanceAdmin(), adminhandler.Session)
			protected.POST("/logout", middleware.RequireInstanceAdmin(), adminhandler.Logout)
			protected.GET("/sites", middleware.RequireInstanceAdmin(), adminhandler.ListSites)
			protected.POST(
				"/sites",
				middleware.RequireInstanceAdmin(),
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.CreateSite,
			)
			protected.GET("/sites/:siteId", middleware.RequireInstanceAdmin(), adminhandler.GetSite)
			protected.PUT(
				"/sites/:siteId",
				middleware.RequireInstanceAdmin(),
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.UpdateSite,
			)
			protected.GET("/notifications", middleware.RequireInstanceAdmin(), adminhandler.GetNotificationSettings)
			protected.GET("/captcha", middleware.RequireInstanceAdmin(), adminhandler.GetCaptchaSettings)
			protected.PUT(
				"/captcha",
				middleware.RequireInstanceAdmin(),
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.SaveCaptchaSettings,
			)
			protected.GET("/turnstile", middleware.RequireInstanceAdmin(), adminhandler.GetTurnstileSettings)
			protected.PUT(
				"/turnstile",
				middleware.RequireInstanceAdmin(),
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.SaveTurnstileSettings,
			)
			protected.PUT(
				"/notifications/email",
				middleware.RequireInstanceAdmin(), middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.SaveEmailNotificationSettings,
			)
			protected.POST(
				"/notifications/email/test",
				middleware.RequireInstanceAdmin(), middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				middleware.RateLimit("notification_test"), adminhandler.TestEmailNotification,
			)
			protected.PUT(
				"/notifications/telegram",
				middleware.RequireInstanceAdmin(), middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				adminhandler.SaveTelegramNotificationSettings,
			)
			protected.POST(
				"/notifications/telegram/test",
				middleware.RequireInstanceAdmin(), middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				middleware.RateLimit("notification_test"), adminhandler.TestTelegramNotification,
			)
			site := protected.Group("/sites/:siteId")
			site.Use(middleware.RequireAdminSiteAccess())
			site.GET("/comments", middleware.RequireInstanceAdmin(), adminhandler.ListComments)
			site.GET("/comments/:commentId", middleware.RequireInstanceAdmin(), adminhandler.GetComment)
			site.DELETE(
				"/comments/:commentId",
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				middleware.RateLimit("comment_delete"),
				adminhandler.DeleteComment,
			)
			site.DELETE(
				"/comments/:commentId/permanent",
				middleware.RequireInstanceAdmin(),
				middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
				middleware.RateLimit("comment_delete"),
				adminhandler.PermanentlyDeleteComment,
			)
		}

	}

	return r, nil
}

func registerClientStatic(router *gin.Engine, configuredDirectory string) error {
	directory := strings.TrimSpace(configuredDirectory)
	if directory == "" {
		return fmt.Errorf("client.static_dir 不能为空")
	}
	absoluteDirectory, err := filepath.Abs(directory)
	if err != nil {
		return fmt.Errorf("解析 client.static_dir: %w", err)
	}
	assetNames := []string{"ecoku.umd.js", "ecoku-loader.js", "ecoku.css", "ecoku.unstyled.css"}
	assetPaths := make(map[string]string, len(assetNames))
	for _, name := range assetNames {
		path := filepath.Join(absoluteDirectory, name)
		info, statErr := os.Stat(path)
		if statErr != nil || !info.Mode().IsRegular() {
			return fmt.Errorf("client.static_dir 缺少 %s", name)
		}
		assetPaths[name] = path
	}

	clientStatic := router.Group("/client")
	clientStatic.Use(func(c *gin.Context) {
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Cross-Origin-Resource-Policy", "cross-origin")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Next()
	})
	for name, path := range assetPaths {
		assetPath := path
		clientStatic.GET("/"+name, func(c *gin.Context) {
			c.File(assetPath)
		})
		clientStatic.HEAD("/"+name, func(c *gin.Context) {
			c.File(assetPath)
		})
	}
	return nil
}

func registerAdminStatic(router *gin.Engine, configuredDirectory string) error {
	directory := strings.TrimSpace(configuredDirectory)
	if directory == "" {
		return fmt.Errorf("admin.static_dir 不能为空")
	}
	absoluteDirectory, err := filepath.Abs(directory)
	if err != nil {
		return fmt.Errorf("解析 admin.static_dir: %w", err)
	}
	indexPath := filepath.Join(absoluteDirectory, "index.html")
	indexInfo, err := os.Stat(indexPath)
	if err != nil || !indexInfo.Mode().IsRegular() {
		return fmt.Errorf("admin.static_dir 缺少 index.html")
	}
	indexHTML, err := os.ReadFile(indexPath)
	if err != nil {
		return fmt.Errorf("读取 admin index.html: %w", err)
	}
	assetsPath := filepath.Join(absoluteDirectory, "assets")
	assetsInfo, err := os.Stat(assetsPath)
	if err != nil || !assetsInfo.IsDir() {
		return fmt.Errorf("admin.static_dir 缺少 assets 目录")
	}
	adminStatic := router.Group("/admin")
	adminStatic.Use(adminStaticSecurityHeaders())
	adminStatic.GET("", func(c *gin.Context) {
		c.Redirect(http.StatusPermanentRedirect, "/admin/")
	})
	adminStatic.GET("/", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		nonce, _ := c.Get(adminCSPNonceKey)
		body := renderAdminIndex(indexHTML, fmt.Sprint(nonce))
		c.Data(http.StatusOK, "text/html; charset=utf-8", body)
	})
	adminStatic.StaticFS("/assets", gin.Dir(assetsPath, false))
	// The tab icon is optional so that an older or custom static directory still starts.
	faviconPath := filepath.Join(absoluteDirectory, "favicon.svg")
	if faviconInfo, statErr := os.Stat(faviconPath); statErr == nil && faviconInfo.Mode().IsRegular() {
		serveFavicon := func(c *gin.Context) {
			// Opened on its own, the icon is a document: allow only its inline dark-mode style.
			c.Header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
			c.Header("Cache-Control", "public, max-age=86400")
			c.File(faviconPath)
		}
		adminStatic.GET("/favicon.svg", serveFavicon)
		adminStatic.HEAD("/favicon.svg", serveFavicon)
	}
	return nil
}

const adminCSPNonceKey = "ecoku_admin_csp_nonce"

func renderAdminIndex(indexHTML []byte, nonce string) []byte {
	bootstrap := fmt.Sprintf(`<script nonce="%s">window.CAP_CSS_NONCE=%q;window.CAP_SCRIPT_NONCE=%q;</script>`, nonce, nonce, nonce)
	return bytes.Replace(indexHTML, []byte("</head>"), []byte(bootstrap+"</head>"), 1)
}

func newAdminCSPNonce() string {
	value := make([]byte, 18)
	if _, err := rand.Read(value); err != nil {
		return ""
	}
	return base64.RawStdEncoding.EncodeToString(value)
}

func adminStaticSecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		nonce := newAdminCSPNonce()
		c.Set(adminCSPNonceKey, nonce)
		// Keep scripts strict while allowing browser accessibility/annotation tools
		// to apply transient style attributes to the administrator UI.
		capOrigin, _ := captcha.ActiveCapOrigin()
		scriptSources := "'self' https://challenges.cloudflare.com 'nonce-" + nonce + "'"
		connectSources := "'self' https://challenges.cloudflare.com"
		workerSources := "'none'"
		if capOrigin != "" {
			// Cap 3.x instrumentation runs eval/new Function inside its nonce-authorized
			// sandboxed srcdoc frame. CSP cannot scope unsafe-eval to that frame, so keep
			// the relaxation limited to requests where Cap is the active provider.
			scriptSources += " " + capOrigin + " 'wasm-unsafe-eval' 'unsafe-eval'"
			connectSources += " " + capOrigin
			workerSources = "blob:"
		}
		contentSecurityPolicy := "default-src 'self'; base-uri 'none'; connect-src " + connectSources + "; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'self' https://challenges.cloudflare.com; img-src 'self' data: https: http://localhost:* http://127.0.0.1:*; object-src 'none'; script-src " + scriptSources + "; style-src 'self' 'nonce-" + nonce + "'; style-src-attr 'unsafe-inline'; worker-src " + workerSources
		c.Header("Content-Security-Policy", contentSecurityPolicy)
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		if strings.HasPrefix(c.Request.URL.Path, "/admin/assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Next()
	}
}

func RunServer(ctx context.Context) error {
	r, err := NewRouter()
	if err != nil {
		return fmt.Errorf("路由初始化失败: %w", err)
	}
	log.Println("Server starting on :" + config.Port)
	server := &http.Server{
		Addr:              ":" + config.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 * 1024,
	}
	shutdownDone := make(chan error, 1)
	go func() {
		<-ctx.Done()
		shutdownContext, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		shutdownDone <- server.Shutdown(shutdownContext)
	}()

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("服务器启动失败: %w", err)
	}
	if ctx.Err() != nil {
		if err := <-shutdownDone; err != nil {
			return fmt.Errorf("服务器优雅关闭失败: %w", err)
		}
	}
	return nil
}

func InitRouter() {
	if err := RunServer(context.Background()); err != nil {
		log.Fatalln(err)
	}
}
