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
	minimumSecretLength             = 32
	adminTokenTTLMinutes            = 8 * 60
	maximumAdminUsernameLength      = 80
	maximumCommentPlaceholderLength = 80
	DefaultCommentPlaceholder       = "写下评论（仅支持纯文本）"
	DefaultCommentSort              = "newest"
	DefaultCommentLimit             = 1000
	DefaultEmptyMessage             = "还没有评论\n成为第一个留下评论的人。"
	DefaultBloggerBadge             = "[博主]"

	// Secrets are read only from these environment variables.
	adminUsernameEnv     = "ECOKU_ADMIN_USERNAME"
	adminPasswordHashEnv = "ECOKU_ADMIN_PASSWORD_HASH"
	adminTokenKeyEnv     = "ECOKU_ADMIN_TOKEN_KEY"
	EncryptionKeyEnv     = "ECOKU_NOTIFICATION_ENCRYPTION_KEY"

	// The official image sets ECOKU_RUNTIME=container. Its fixed paths then
	// become the defaults, so a mounted config.yaml only carries choices an
	// operator actually makes.
	runtimeEnvironment       = "ECOKU_RUNTIME"
	containerRuntime         = "container"
	containerLogPath         = "/var/log/ecoku/ecoku.log"
	containerClientStaticDir = "/app/client"
	containerAdminStaticDir  = "/app/admin"
	containerSQLitePath      = "/data/ecoku.sqlite3"
)

var siteIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`)

// Config is the complete server configuration.
type Config struct {
	Site          SiteConfig             `yaml:"site"`
	Client        ClientConfig           `yaml:"client"`
	RateLimit     RateLimitConfig        `yaml:"rate_limit"`
	Sites         []RegisteredSiteConfig `yaml:"sites"`
	Admin         AdminConfig            `yaml:"admin"`
	Notifications NotificationsConfig    `yaml:"notifications"`
	Database      DatabaseConfig         `yaml:"database"`
}

// ClientConfig controls the optional browser assets served by the Go process.
// Keeping this path explicit avoids making source-only development depend on
// frontend build output that may not exist yet.
type ClientConfig struct {
	StaticDir string `yaml:"static_dir"`
}

// SiteConfig contains process-level settings. Browser origins belong to each
// registered site instead of this global section.
type SiteConfig struct {
	Port           int      `yaml:"port"`
	LogPath        string   `yaml:"log_path"`
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

type RegisteredSiteConfig struct {
	ID               string        `yaml:"id"`
	SiteURL          string        `yaml:"site_url"`
	Name             string        `yaml:"name"`
	AllowedOrigins   []string      `yaml:"allowed_origins"`
	ManagementKeyEnv string        `yaml:"management_key_env"`
	Comment          CommentConfig `yaml:"comment"`
}

// NotificationsConfig contains only process-level notification integration
// boundaries. Channel settings and encrypted credentials live in SQLite.
type NotificationsConfig struct {
	InstancePublicURL string `yaml:"instance_public_url"`

	// Retired: the master key is always read from EncryptionKeyEnv.
	EncryptionKeyEnv string `yaml:"encryption_key_env"`
}

type CommentConfig struct {
	EmailRequired   *bool  `yaml:"email_required"`
	WebsiteRequired *bool  `yaml:"website_required"`
	Placeholder     string `yaml:"placeholder"`
	DefaultSort     string `yaml:"default_sort"`
	LengthLimit     int    `yaml:"length_limit"`
	EmptyMessage    string `yaml:"empty_message"`
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

type DatabaseConfig struct {
	SQLite SQLiteConfig `yaml:"sqlite"`
}

type SQLiteConfig struct {
	Path string `yaml:"path"`
}

// AdminConfig configures the admin console, which is always enabled.
type AdminConfig struct {
	StaticDir      string   `yaml:"static_dir"`
	AllowedOrigins []string `yaml:"allowed_origins"`

	// Retired keys stay parseable so that older config files still load;
	// validateRetiredKeys accepts only the values that are now fixed.
	Enabled         *bool  `yaml:"enabled"`
	UsernameEnv     string `yaml:"username_env"`
	PasswordHashEnv string `yaml:"password_hash_env"`
	TokenKeyEnv     string `yaml:"token_key_env"`
	TokenTTLMinutes int    `yaml:"token_ttl_minutes"`
}

// AdminCredentials contains the runtime-only administrator secrets resolved
// from environment variables. It must never be serialized or logged.
type AdminCredentials struct {
	Username     string
	PasswordHash string
	TokenKey     string
	TokenTTL     time.Duration
}

var (
	Port         string
	LogFilePath  string
	GlobalConfig *Config
)

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
	installGlobals(loaded)
	return nil
}

func applyDefaults(loaded *Config) {
	container := os.Getenv(runtimeEnvironment) == containerRuntime
	if loaded.Site.Port == 0 {
		loaded.Site.Port = 12123
	}
	loaded.Site.LogPath = strings.TrimSpace(loaded.Site.LogPath)
	if container && loaded.Site.LogPath == "" {
		loaded.Site.LogPath = containerLogPath
	}
	if strings.TrimSpace(loaded.Database.SQLite.Path) == "" {
		loaded.Database.SQLite.Path = "./data/ecoku.bin"
		if container {
			loaded.Database.SQLite.Path = containerSQLitePath
		}
	}
	for i := range loaded.Site.TrustedProxies {
		loaded.Site.TrustedProxies[i] = strings.TrimSpace(loaded.Site.TrustedProxies[i])
	}
	loaded.Client.StaticDir = strings.TrimSpace(loaded.Client.StaticDir)
	if container && loaded.Client.StaticDir == "" {
		loaded.Client.StaticDir = containerClientStaticDir
	}
	loaded.Admin.StaticDir = strings.TrimSpace(loaded.Admin.StaticDir)
	if container && loaded.Admin.StaticDir == "" {
		loaded.Admin.StaticDir = containerAdminStaticDir
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

	for i := range loaded.Sites {
		loaded.Sites[i].ID = strings.TrimSpace(loaded.Sites[i].ID)
		loaded.Sites[i].SiteURL = strings.TrimSpace(loaded.Sites[i].SiteURL)
		loaded.Sites[i].Name = strings.TrimSpace(loaded.Sites[i].Name)
		loaded.Sites[i].ManagementKeyEnv = strings.TrimSpace(loaded.Sites[i].ManagementKeyEnv)
		if loaded.Sites[i].SiteURL == "" && len(loaded.Sites[i].AllowedOrigins) > 0 {
			// Compatibility for the YAML-to-SQLite seed: historical site entries
			// had no canonical URL. The first explicit origin is the only safe
			// source from which it can be derived.
			loaded.Sites[i].SiteURL = strings.TrimSpace(loaded.Sites[i].AllowedOrigins[0])
		}
		if loaded.Sites[i].Comment.EmailRequired == nil {
			value := true
			loaded.Sites[i].Comment.EmailRequired = &value
		}
		if loaded.Sites[i].Comment.WebsiteRequired == nil {
			value := false
			loaded.Sites[i].Comment.WebsiteRequired = &value
		}
		placeholder := strings.TrimSpace(loaded.Sites[i].Comment.Placeholder)
		if placeholder == "" {
			placeholder = DefaultCommentPlaceholder
		}
		loaded.Sites[i].Comment.Placeholder = placeholder
		sortMode := strings.ToLower(strings.TrimSpace(loaded.Sites[i].Comment.DefaultSort))
		if sortMode == "" {
			sortMode = DefaultCommentSort
		}
		loaded.Sites[i].Comment.DefaultSort = sortMode
		if loaded.Sites[i].Comment.LengthLimit == 0 {
			loaded.Sites[i].Comment.LengthLimit = DefaultCommentLimit
		}
		emptyMessage := strings.TrimSpace(loaded.Sites[i].Comment.EmptyMessage)
		if emptyMessage == "" {
			emptyMessage = DefaultEmptyMessage
		}
		loaded.Sites[i].Comment.EmptyMessage = emptyMessage
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
	if err := validateRetiredKeys(loaded); err != nil {
		return err
	}
	if loaded.Site.Port < 1 || loaded.Site.Port > 65535 {
		return fmt.Errorf("site.port 必须在 1 到 65535 之间")
	}
	if err := validateTrustedProxies(loaded.Site.TrustedProxies); err != nil {
		return err
	}
	if err := validateRateLimits(loaded.RateLimit); err != nil {
		return err
	}
	seenSites := make(map[string]struct{}, len(loaded.Sites))
	seenManagementEnvironments := make(map[string]string, len(loaded.Sites))
	seenManagementKeys := make(map[string]string, len(loaded.Sites))
	for i := range loaded.Sites {
		site := &loaded.Sites[i]
		if !siteIDPattern.MatchString(site.ID) {
			return fmt.Errorf("sites[%d].id 只能包含字母、数字、点、下划线和连字符，且长度不超过 100", i)
		}
		if _, exists := seenSites[site.ID]; exists {
			return fmt.Errorf("站点 ID %q 重复", site.ID)
		}
		seenSites[site.ID] = struct{}{}
		normalizedSiteURL, err := NormalizeSiteURL(site.SiteURL)
		if err != nil {
			return fmt.Errorf("站点 %q 的 site_url: %w", site.ID, err)
		}
		site.SiteURL = normalizedSiteURL

		if len(site.AllowedOrigins) == 0 {
			return fmt.Errorf("站点 %q 至少需要一个 allowed_origins", site.ID)
		}
		seenOrigins := make(map[string]struct{}, len(site.AllowedOrigins))
		for originIndex, rawOrigin := range site.AllowedOrigins {
			normalized, err := NormalizeOrigin(rawOrigin)
			if err != nil {
				return fmt.Errorf("站点 %q 的 allowed_origins[%d]: %w", site.ID, originIndex, err)
			}
			if _, exists := seenOrigins[normalized]; exists {
				return fmt.Errorf("站点 %q 的来源 %q 重复", site.ID, normalized)
			}
			seenOrigins[normalized] = struct{}{}
			site.AllowedOrigins[originIndex] = normalized
		}

		if site.ManagementKeyEnv != "" {
			if err := validateSecretEnvironment("站点 "+site.ID+" 的 management_key_env", site.ManagementKeyEnv); err != nil {
				return err
			}
			if previousSite, exists := seenManagementEnvironments[site.ManagementKeyEnv]; exists {
				return fmt.Errorf("站点 %q 与站点 %q 不能共享 management_key_env", site.ID, previousSite)
			}
			seenManagementEnvironments[site.ManagementKeyEnv] = site.ID
			managementKey := os.Getenv(site.ManagementKeyEnv)
			if previousSite, exists := seenManagementKeys[managementKey]; exists {
				return fmt.Errorf("站点 %q 与站点 %q 必须使用不同的管理凭据", site.ID, previousSite)
			}
			seenManagementKeys[managementKey] = site.ID
		}
		if site.Comment.DefaultSort != "newest" && site.Comment.DefaultSort != "oldest" {
			return fmt.Errorf("站点 %q 的 comment.default_sort 只支持 newest 或 oldest", site.ID)
		}
		if site.Comment.LengthLimit < 1 || site.Comment.LengthLimit > 10000 {
			return fmt.Errorf("站点 %q 的 comment.length_limit 必须在 1 到 10000 之间", site.ID)
		}
		if utf8.RuneCountInString(site.Name) > 120 {
			return fmt.Errorf("站点 %q 的 name 不能超过 120 个字符", site.ID)
		}
		if utf8.RuneCountInString(site.Comment.EmptyMessage) > 240 {
			return fmt.Errorf("站点 %q 的 comment.empty_message 不能超过 240 个字符", site.ID)
		}
		if utf8.RuneCountInString(site.Comment.Placeholder) > maximumCommentPlaceholderLength {
			return fmt.Errorf("站点 %q 的 comment.placeholder 不能超过 %d 个字符", site.ID, maximumCommentPlaceholderLength)
		}
		if strings.ContainsAny(site.Comment.Placeholder, "\r\n") {
			return fmt.Errorf("站点 %q 的 comment.placeholder 不能包含换行", site.ID)
		}
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

	if strings.TrimSpace(loaded.Database.SQLite.Path) == "" {
		return fmt.Errorf("database.sqlite.path 不能为空")
	}

	return nil
}

// validateRetiredKeys rejects any retired key that still carries a value other
// than the one now fixed, so that startup names the line to delete instead of
// silently changing behaviour.
func validateRetiredKeys(loaded *Config) error {
	admin := loaded.Admin
	if admin.Enabled != nil && !*admin.Enabled {
		return fmt.Errorf("管理后台始终启用；请删除 admin.enabled")
	}
	if admin.TokenTTLMinutes != 0 && admin.TokenTTLMinutes != adminTokenTTLMinutes {
		return fmt.Errorf("管理员会话固定为 8 小时；请删除 admin.token_ttl_minutes 或设为 480")
	}
	for _, key := range []struct{ name, value, fixed string }{
		{"admin.username_env", admin.UsernameEnv, adminUsernameEnv},
		{"admin.password_hash_env", admin.PasswordHashEnv, adminPasswordHashEnv},
		{"admin.token_key_env", admin.TokenKeyEnv, adminTokenKeyEnv},
		{"notifications.encryption_key_env", loaded.Notifications.EncryptionKeyEnv, EncryptionKeyEnv},
	} {
		if value := strings.TrimSpace(key.value); value != "" && value != key.fixed {
			return fmt.Errorf("环境变量名已固定为 %s；请删除 %s，并在 ecoku.env 中改用 %s", key.fixed, key.name, key.fixed)
		}
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
	publicOrigins := make(map[string]struct{})
	for _, site := range loaded.Sites {
		for _, origin := range site.AllowedOrigins {
			publicOrigins[origin] = struct{}{}
		}
	}
	seenAdminOrigins := make(map[string]struct{}, len(loaded.Admin.AllowedOrigins))
	for i, rawOrigin := range loaded.Admin.AllowedOrigins {
		normalized, err := NormalizeOrigin(rawOrigin)
		if err != nil {
			return fmt.Errorf("admin.allowed_origins[%d]: %w", i, err)
		}
		if _, exists := seenAdminOrigins[normalized]; exists {
			return fmt.Errorf("管理员来源 %q 重复", normalized)
		}
		if _, exists := publicOrigins[normalized]; exists {
			return fmt.Errorf("管理员来源 %q 不能复用公开站点来源", normalized)
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
	for _, site := range GlobalConfig.Sites {
		if site.ManagementKeyEnv != "" && os.Getenv(site.ManagementKeyEnv) == tokenKey {
			return fmt.Errorf("管理员 token 签名密钥不能复用站点管理凭据")
		}
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

func validateSecretEnvironment(label, environmentName string) error {
	environmentName = strings.TrimSpace(environmentName)
	if environmentName == "" {
		return fmt.Errorf("%s 不能为空", label)
	}
	secret := os.Getenv(environmentName)
	if len(secret) < minimumSecretLength {
		return fmt.Errorf("环境变量 %s 必须至少包含 %d 个字符", environmentName, minimumSecretLength)
	}
	return nil
}

func installGlobals(loaded *Config) {
	GlobalConfig = loaded
	Port = strconv.Itoa(loaded.Site.Port)
	LogFilePath = loaded.Site.LogPath
}

func GetRegisteredSite(siteID string) (*RegisteredSiteConfig, bool) {
	if GlobalConfig == nil {
		return nil, false
	}
	trimmed := strings.TrimSpace(siteID)
	for i := range GlobalConfig.Sites {
		if GlobalConfig.Sites[i].ID == trimmed {
			return &GlobalConfig.Sites[i], true
		}
	}
	return nil, false
}

func GetAdminAllowedOrigins() []string {
	if GlobalConfig == nil {
		return nil
	}
	return append([]string(nil), GlobalConfig.Admin.AllowedOrigins...)
}

func GetRegisteredSites() []RegisteredSiteConfig {
	if GlobalConfig == nil {
		return nil
	}
	return append([]RegisteredSiteConfig(nil), GlobalConfig.Sites...)
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

func GetManagementKey(siteID string) (string, bool) {
	site, ok := GetRegisteredSite(siteID)
	if !ok {
		return "", false
	}
	key := os.Getenv(site.ManagementKeyEnv)
	return key, len(key) >= minimumSecretLength
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
		TokenTTL:     adminTokenTTLMinutes * time.Minute,
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
	return strings.TrimSpace(GlobalConfig.Admin.StaticDir)
}

func GetClientStaticDir() string {
	if GlobalConfig == nil {
		return ""
	}
	return strings.TrimSpace(GlobalConfig.Client.StaticDir)
}

func GetSQLiteConfig() *SQLiteConfig {
	if GlobalConfig == nil {
		return nil
	}
	return &GlobalConfig.Database.SQLite
}
