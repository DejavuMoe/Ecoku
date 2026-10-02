package config

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

const (
	minimumSecretLength        = 32
	adminTokenTTL              = 8 * time.Hour
	maximumAdminUsernameLength = 80
	DefaultCommentPlaceholder  = "写下评论（仅支持纯文本）"
	DefaultCommentSort         = "newest"
	DefaultCommentLimit        = 1000
	DefaultEmptyMessage        = "还没有评论\n成为第一个留下评论的人。"

	// Secrets are read only from these environment variables.
	adminUsernameEnv     = "ECOKU_ADMIN_USERNAME"
	adminPasswordHashEnv = "ECOKU_ADMIN_PASSWORD_HASH"
	adminTokenKeyEnv     = "ECOKU_ADMIN_TOKEN_KEY"
	EncryptionKeyEnv     = "ECOKU_NOTIFICATION_ENCRYPTION_KEY"

	// The official image sets ECOKU_RUNTIME=container and ships its files at
	// the paths in runtimePaths.
	runtimeEnvironment = "ECOKU_RUNTIME"
	containerRuntime   = "container"
)

var siteIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`)

// Config is the complete server configuration.
type Config struct {
	Site          SiteConfig          `yaml:"site"`
	RateLimit     RateLimitConfig     `yaml:"rate_limit"`
	Admin         AdminConfig         `yaml:"admin"`
	Notifications NotificationsConfig `yaml:"notifications"`

	// Paths is fixed by the runtime and never read from config.yaml.
	Paths RuntimePaths `yaml:"-"`
}

// SiteConfig contains process-level settings. Sites themselves, with their
// browser origins, live in SQLite and are managed in the admin console.
type SiteConfig struct {
	TrustedProxies []string `yaml:"trusted_proxies"`
}

type RateLimitConfig struct {
	WindowSeconds    int `yaml:"window_seconds"`
	CommentSubmit    int `yaml:"comment_submit"`
	CommentList      int `yaml:"comment_list"`
	CommentDelete    int `yaml:"comment_delete"`
	AdminLogin       int `yaml:"admin_login"`
	NotificationTest int `yaml:"notification_test"`
}

// NotificationsConfig contains only process-level notification integration
// boundaries. Channel settings and encrypted credentials live in SQLite.
type NotificationsConfig struct {
	InstancePublicURL string `yaml:"instance_public_url"`
}

// AdminConfig configures the admin console, which is always enabled.
type AdminConfig struct {
	AllowedOrigins []string `yaml:"allowed_origins"`
}

// RuntimePaths are where the browser assets, the admin console and the
// database live. A source run serves no static files.
type RuntimePaths struct {
	ClientStaticDir string
	AdminStaticDir  string
	SQLitePath      string
}

// CaptchaPublicConfig is the active, non-secret CAPTCHA configuration exposed
// to the administrator login page and public comment SDK.
type CaptchaPublicConfig struct {
	Provider    string `json:"provider"`
	Sitekey     string `json:"sitekey"`
	InstanceURL string `json:"instanceUrl,omitempty"`
}

// CommentFormConfig is the public, non-secret subset of one site's comment
// form configuration. It is safe to return to the browser SDK.
type CommentFormConfig struct {
	EmailRequired       bool                `json:"emailRequired"`
	WebsiteRequired     bool                `json:"websiteRequired"`
	Placeholder         string              `json:"placeholder"`
	DefaultSort         string              `json:"defaultSort"`
	LengthLimit         int                 `json:"lengthLimit"`
	EmptyMessage        string              `json:"emptyMessage"`
	BloggerBadge        string              `json:"bloggerBadge"`
	TurnstileSitekey    string              `json:"turnstileSitekey"`
	BloggerProofEnabled bool                `json:"bloggerProofEnabled"`
	Captcha             CaptchaPublicConfig `json:"captcha"`
	Smoji               SmojiPublicConfig   `json:"smoji"`
}

type SmojiPublicConfig struct {
	Enabled     bool   `json:"enabled"`
	ManifestURL string `json:"manifestUrl"`
}

// AdminCredentials contains the runtime-only administrator secrets resolved
// from environment variables. It must never be serialized or logged.
type AdminCredentials struct {
	Username     string
	PasswordHash string
	TokenKey     string
	TokenTTL     time.Duration
}

var GlobalConfig *Config

// InitConfigFile loads config.yaml from the process working directory.
func InitConfigFile() {
	if err := LoadConfigFile("config.yaml"); err != nil {
		log.Fatalln("配置文件初始化失败：", err)
	}
}

// LoadConfigFile parses, validates, and installs a configuration.
func LoadConfigFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("读取 %s: %w", path, err)
	}

	var loaded Config
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	decoder.KnownFields(true)
	if err := decoder.Decode(&loaded); err != nil {
		return fmt.Errorf("解析 YAML: %w", err)
	}
	var extraDocument any
	if err := decoder.Decode(&extraDocument); err != io.EOF {
		if err != nil {
			return fmt.Errorf("解析 YAML: %w", err)
		}
		return fmt.Errorf("配置文件只允许一个 YAML 文档")
	}

	return ApplyConfig(&loaded)
}

// ApplyConfig applies defaults, validates security boundaries, and installs
// the configuration. It is also the seam used by isolated tests.
func ApplyConfig(loaded *Config) error {
	if loaded == nil {
		return fmt.Errorf("配置不能为空")
	}

	applyDefaults(loaded)
	if err := validateConfig(loaded); err != nil {
		return err
	}
	GlobalConfig = loaded
	return nil
}

func runtimePaths() RuntimePaths {
	if os.Getenv(runtimeEnvironment) == containerRuntime {
		return RuntimePaths{
			ClientStaticDir: "/app/client",
			AdminStaticDir:  "/app/admin",
			SQLitePath:      "/data/ecoku.sqlite3",
		}
	}
	return RuntimePaths{SQLitePath: "./data/ecoku.bin"}
}

func applyDefaults(loaded *Config) {
	loaded.Paths = runtimePaths()
	for i := range loaded.Site.TrustedProxies {
		loaded.Site.TrustedProxies[i] = strings.TrimSpace(loaded.Site.TrustedProxies[i])
	}

	if loaded.RateLimit.WindowSeconds == 0 {
		loaded.RateLimit.WindowSeconds = 60
	}
	if loaded.RateLimit.CommentSubmit == 0 {
		loaded.RateLimit.CommentSubmit = 5
	}
	if loaded.RateLimit.CommentList == 0 {
		loaded.RateLimit.CommentList = 60
	}
	if loaded.RateLimit.CommentDelete == 0 {
		loaded.RateLimit.CommentDelete = 30
	}
	if loaded.RateLimit.AdminLogin == 0 {
		loaded.RateLimit.AdminLogin = 5
	}
	if loaded.RateLimit.NotificationTest == 0 {
		loaded.RateLimit.NotificationTest = 5
	}

	for i := range loaded.Admin.AllowedOrigins {
		loaded.Admin.AllowedOrigins[i] = strings.TrimSpace(loaded.Admin.AllowedOrigins[i])
	}
	loaded.Notifications.InstancePublicURL = strings.TrimSpace(loaded.Notifications.InstancePublicURL)
	// The admin console is served from the instance itself, so its public URL
	// is the natural admin origin when none is listed explicitly.
	if len(loaded.Admin.AllowedOrigins) == 0 && loaded.Notifications.InstancePublicURL != "" {
		if parsed, err := url.Parse(loaded.Notifications.InstancePublicURL); err == nil && parsed.Host != "" {
			loaded.Admin.AllowedOrigins = []string{parsed.Scheme + "://" + parsed.Host}
		}
	}
}

func validateConfig(loaded *Config) error {
	if err := validateTrustedProxies(loaded.Site.TrustedProxies); err != nil {
		return err
	}
	if err := validateRateLimits(loaded.RateLimit); err != nil {
		return err
	}
	if err := validateAdminOrigins(loaded); err != nil {
		return err
	}
	if loaded.Notifications.InstancePublicURL != "" {
		normalizedPublicURL, err := NormalizeSiteURL(loaded.Notifications.InstancePublicURL)
		if err != nil {
			return fmt.Errorf("notifications.instance_public_url: %w", err)
		}
		loaded.Notifications.InstancePublicURL = normalizedPublicURL
	}
	return nil
}

func validateRateLimits(limits RateLimitConfig) error {
	values := map[string]int{
		"window_seconds":    limits.WindowSeconds,
		"comment_submit":    limits.CommentSubmit,
		"comment_list":      limits.CommentList,
		"comment_delete":    limits.CommentDelete,
		"admin_login":       limits.AdminLogin,
		"notification_test": limits.NotificationTest,
	}
	for name, value := range values {
		if value <= 0 {
			return fmt.Errorf("rate_limit.%s 必须大于 0", name)
		}
	}
	return nil
}

func validateAdminOrigins(loaded *Config) error {
	seenAdminOrigins := make(map[string]struct{}, len(loaded.Admin.AllowedOrigins))
	for i, rawOrigin := range loaded.Admin.AllowedOrigins {
		normalized, err := NormalizeOrigin(rawOrigin)
		if err != nil {
			return fmt.Errorf("admin.allowed_origins[%d]: %w", i, err)
		}
		if _, exists := seenAdminOrigins[normalized]; exists {
			return fmt.Errorf("管理员来源 %q 重复", normalized)
		}
		seenAdminOrigins[normalized] = struct{}{}
		loaded.Admin.AllowedOrigins[i] = normalized
	}
	return nil
}

// ValidateAdmin checks what the admin console needs before the server starts:
// a browser origin and the secrets in its environment variables. The CLI
// commands do not serve the console and do not call it.
func ValidateAdmin() error {
	if GlobalConfig == nil {
		return fmt.Errorf("配置尚未加载")
	}
	if len(GlobalConfig.Admin.AllowedOrigins) == 0 {
		return fmt.Errorf("管理后台需要 notifications.instance_public_url 或 admin.allowed_origins")
	}

	username, err := requiredEnvironmentValue(adminUsernameEnv)
	if err != nil {
		return err
	}
	username = strings.TrimSpace(username)
	if username == "" || utf8.RuneCountInString(username) > maximumAdminUsernameLength {
		return fmt.Errorf("环境变量 %s 中的管理员用户名必须为 1 到 %d 个字符", adminUsernameEnv, maximumAdminUsernameLength)
	}

	passwordHash, err := requiredEnvironmentValue(adminPasswordHashEnv)
	if err != nil {
		return err
	}
	cost, err := bcrypt.Cost([]byte(passwordHash))
	if err != nil {
		return fmt.Errorf("环境变量 %s 必须包含有效的 bcrypt 密码哈希", adminPasswordHashEnv)
	}
	if cost < bcrypt.DefaultCost {
		return fmt.Errorf("环境变量 %s 中的 bcrypt cost 不能低于 %d", adminPasswordHashEnv, bcrypt.DefaultCost)
	}

	tokenKey, err := requiredEnvironmentValue(adminTokenKeyEnv)
	if err != nil {
		return err
	}
	if len(tokenKey) < minimumSecretLength {
		return fmt.Errorf("环境变量 %s 必须至少包含 %d 个字符", adminTokenKeyEnv, minimumSecretLength)
	}
	if tokenKey == passwordHash {
		return fmt.Errorf("管理员 token 签名密钥不能复用管理员密码哈希")
	}
	return nil
}

func requiredEnvironmentValue(name string) (string, error) {
	value := os.Getenv(name)
	if value == "" {
		return "", fmt.Errorf("环境变量 %s 不能为空", name)
	}
	return value, nil
}

func validateTrustedProxies(proxies []string) error {
	for i, value := range proxies {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return fmt.Errorf("site.trusted_proxies[%d] 不能为空", i)
		}
		if net.ParseIP(trimmed) != nil {
			continue
		}
		_, network, err := net.ParseCIDR(trimmed)
		if err != nil {
			return fmt.Errorf("site.trusted_proxies[%d] 必须是明确的 IP 或 CIDR", i)
		}
		ones, _ := network.Mask.Size()
		if ones == 0 {
			return fmt.Errorf("site.trusted_proxies[%d] 禁止任意信任（含 0.0.0.0/0 与 ::/0）", i)
		}
	}
	return nil
}

func GetAdminAllowedOrigins() []string {
	if GlobalConfig == nil {
		return nil
	}
	return append([]string(nil), GlobalConfig.Admin.AllowedOrigins...)
}

func NormalizeOrigin(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("来源格式无效")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("来源只支持 http 或 https")
	}
	if parsed.Host == "" || parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("来源必须只包含 scheme、host 和可选端口")
	}
	return strings.ToLower(parsed.Scheme) + "://" + strings.ToLower(parsed.Host), nil
}

// NormalizeSiteURL validates a canonical site or instance URL. Paths are
// allowed for installations mounted below a host, but credentials, query and
// fragment components are rejected.
func NormalizeSiteURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("网址格式无效")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("网址只支持 http 或 https")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	if parsed.Path == "/" {
		parsed.Path = ""
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

// NormalizeSmojiManifestURL limits remote sticker manifests to HTTPS. Plain
// HTTP is accepted only for loopback hosts so local development remains usable.
func NormalizeSmojiManifestURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.ForceQuery || strings.Contains(trimmed, "#") {
		return "", fmt.Errorf("表情包清单网址格式无效")
	}
	hostname := parsed.Hostname()
	loopback := strings.EqualFold(hostname, "localhost")
	if ip := net.ParseIP(hostname); ip != nil {
		loopback = ip.IsLoopback()
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopback) {
		return "", fmt.Errorf("表情包清单网址必须使用 HTTPS")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	if port := parsed.Port(); port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return "", fmt.Errorf("表情包清单网址端口无效")
		}
		parsed.Host = net.JoinHostPort(strings.ToLower(parsed.Hostname()), strconv.Itoa(value))
		if (parsed.Scheme == "https" && value == 443) || (parsed.Scheme == "http" && value == 80) {
			parsed.Host = strings.ToLower(parsed.Hostname())
			if strings.Contains(parsed.Host, ":") {
				parsed.Host = "[" + parsed.Host + "]"
			}
		}
	}
	return parsed.String(), nil
}

func IsValidSiteID(siteID string) bool {
	return siteIDPattern.MatchString(strings.TrimSpace(siteID))
}

func GetAdminCredentials() (*AdminCredentials, bool) {
	if GlobalConfig == nil {
		return nil, false
	}
	username := strings.TrimSpace(os.Getenv(adminUsernameEnv))
	passwordHash := os.Getenv(adminPasswordHashEnv)
	tokenKey := os.Getenv(adminTokenKeyEnv)
	if username == "" || passwordHash == "" || len(tokenKey) < minimumSecretLength {
		return nil, false
	}
	return &AdminCredentials{
		Username:     username,
		PasswordHash: passwordHash,
		TokenKey:     tokenKey,
		TokenTTL:     adminTokenTTL,
	}, true
}

func GetRateLimit(action string) (int, time.Duration) {
	if GlobalConfig == nil {
		return 1, time.Minute
	}
	limits := GlobalConfig.RateLimit
	limit := 1
	switch action {
	case "comment_submit":
		limit = limits.CommentSubmit
	case "comment_list":
		limit = limits.CommentList
	case "comment_delete":
		limit = limits.CommentDelete
	case "admin_login":
		limit = limits.AdminLogin
	case "notification_test":
		limit = limits.NotificationTest
	}
	return limit, time.Duration(limits.WindowSeconds) * time.Second
}

func GetNotificationsConfig() NotificationsConfig {
	if GlobalConfig == nil {
		return NotificationsConfig{}
	}
	return GlobalConfig.Notifications
}

func GetTrustedProxies() []string {
	if GlobalConfig == nil {
		return nil
	}
	return append([]string(nil), GlobalConfig.Site.TrustedProxies...)
}

func GetAdminStaticDir() string {
	if GlobalConfig == nil {
		return ""
	}
	return GlobalConfig.Paths.AdminStaticDir
}

func GetClientStaticDir() string {
	if GlobalConfig == nil {
		return ""
	}
	return GlobalConfig.Paths.ClientStaticDir
}

func GetSQLitePath() string {
	if GlobalConfig == nil {
		return ""
	}
	return GlobalConfig.Paths.SQLitePath
}
