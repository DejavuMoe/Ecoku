package routes

import (
	"ecoku-server/config"
	adminhandler "ecoku-server/handle/admin"
	"ecoku-server/handle/app"
	"ecoku-server/handle/comment"
	"ecoku-server/middleware"
	"ecoku-server/utils"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func NewRouter() (*gin.Engine, error) {
	r := gin.New()
	if err := r.SetTrustedProxies(config.GetTrustedProxies()); err != nil {
		return nil, err
	}
	r.Use(middleware.RequestLogger(), middleware.Recovery(), middleware.Cors())
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
			middleware.LimitRequestBody(middleware.MaxRequestBodyBytes),
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

			protected := admin.Group("")
			protected.Use(middleware.AdminAuthentication())
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
			site.GET("/comments", adminhandler.ListComments)
			site.GET("/comments/:commentId", adminhandler.GetComment)
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
	assetNames := []string{"ecoku.umd.js", "ecoku-loader.js"}
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
	assetsPath := filepath.Join(absoluteDirectory, "assets")
	assetsInfo, err := os.Stat(assetsPath)
	if err != nil || !assetsInfo.IsDir() {
		return fmt.Errorf("admin.static_dir 缺少 assets 目录")
	}
	templatesPath := filepath.Join(absoluteDirectory, "templates")
	templateNames := []string{
		"email-blogger-new-comment.html",
		"email-blogger-new-reply.html",
		"email-visitor-reply.html",
		"telegram-notification.html",
	}
	templatePaths := make(map[string]string, len(templateNames))
	for _, name := range templateNames {
		path := filepath.Join(templatesPath, name)
		info, statErr := os.Stat(path)
		if statErr != nil || !info.Mode().IsRegular() {
			return fmt.Errorf("admin.static_dir 缺少通知模板 %s", name)
		}
		templatePaths[name] = path
	}

	adminStatic := router.Group("/admin")
	adminStatic.Use(adminStaticSecurityHeaders())
	adminStatic.GET("", func(c *gin.Context) {
		c.Redirect(http.StatusPermanentRedirect, "/admin/")
	})
	adminStatic.GET("/", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.File(indexPath)
	})
	adminStatic.GET("/templates/:name", func(c *gin.Context) {
		path, ok := templatePaths[c.Param("name")]
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-store")
		c.File(path)
	})
	adminStatic.StaticFS("/assets", gin.Dir(assetsPath, false))
	return nil
}

func adminStaticSecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Keep scripts strict while allowing browser accessibility/annotation tools
		// to apply transient style attributes to the administrator UI.
		contentSecurityPolicy := "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'"
		if strings.HasPrefix(c.Request.URL.Path, "/admin/templates/") {
			// These built-in, immutable preview documents contain the inline CSS
			// and interaction script approved in the static prototype. They are served
			// from an explicit allowlist and cannot load remote resources.
			contentSecurityPolicy = "default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; img-src data:; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"
		}
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

func InitRouter() {
	r, err := NewRouter()
	if err != nil {
		log.Fatalln("路由初始化失败：", err)
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
	if err := server.ListenAndServe(); err != nil {
		log.Fatalln("服务器启动失败：", err)
	}
}
