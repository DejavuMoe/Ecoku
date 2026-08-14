package middleware

import (
	"ecoku-server/config"
	"ecoku-server/utils"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	count     int
	resetTime time.Time
}

// IPRateLimiter is intentionally process-local. Its state is cleared whenever
// the process restarts. Forwarded client addresses are used only when the
// direct socket peer matches an explicitly configured trusted proxy.
type IPRateLimiter struct {
	mu      sync.Mutex
	entries map[string]rateLimitEntry
	limit   int
	window  time.Duration
	now     func() time.Time
}

func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	return &IPRateLimiter{
		entries: make(map[string]rateLimitEntry),
		limit:   limit,
		window:  window,
		now:     time.Now,
	}
}

func RateLimit(action string) gin.HandlerFunc {
	limit, window := config.GetRateLimit(action)
	return NewIPRateLimiter(limit, window).Middleware(action)
}

func (limiter *IPRateLimiter) Middleware(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed, retryAfter := limiter.allow(action, rateLimitClientIP(c))
		if !allowed {
			seconds := int(retryAfter.Round(time.Second).Seconds())
			if seconds < 1 {
				seconds = 1
			}
			c.Header("Retry-After", strconv.Itoa(seconds))
			utils.SendError(c, http.StatusTooManyRequests, "请求过于频繁")
			c.Abort()
			return
		}
		c.Next()
	}
}

func rateLimitClientIP(c *gin.Context) string {
	socketAddress := socketIP(c.Request.RemoteAddr)
	if socketAddress == "unknown" || !isTrustedProxyAddress(socketAddress, config.GetTrustedProxies()) {
		return socketAddress
	}
	clientAddress := net.ParseIP(strings.TrimSpace(c.ClientIP()))
	if clientAddress == nil {
		return socketAddress
	}
	return clientAddress.String()
}

func isTrustedProxyAddress(address string, trustedProxies []string) bool {
	parsedAddress := net.ParseIP(address)
	if parsedAddress == nil {
		return false
	}
	for _, value := range trustedProxies {
		trimmed := strings.TrimSpace(value)
		if trustedIP := net.ParseIP(trimmed); trustedIP != nil {
			if trustedIP.Equal(parsedAddress) {
				return true
			}
			continue
		}
		_, network, err := net.ParseCIDR(trimmed)
		if err == nil && network.Contains(parsedAddress) {
			return true
		}
	}
	return false
}

func (limiter *IPRateLimiter) allow(action, ip string) (bool, time.Duration) {
	now := limiter.now()
	key := action + "\x00" + ip

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	entry, exists := limiter.entries[key]
	if !exists || !now.Before(entry.resetTime) {
		limiter.entries[key] = rateLimitEntry{count: 1, resetTime: now.Add(limiter.window)}
		limiter.removeExpired(now, key)
		return true, 0
	}
	if entry.count >= limiter.limit {
		return false, entry.resetTime.Sub(now)
	}
	entry.count++
	limiter.entries[key] = entry
	return true, 0
}

func (limiter *IPRateLimiter) removeExpired(now time.Time, keep string) {
	for key, entry := range limiter.entries {
		if key != keep && !now.Before(entry.resetTime) {
			delete(limiter.entries, key)
		}
	}
}

func socketIP(remoteAddress string) string {
	trimmed := strings.TrimSpace(remoteAddress)
	host, _, err := net.SplitHostPort(trimmed)
	if err == nil {
		if parsed := net.ParseIP(host); parsed != nil {
			return parsed.String()
		}
	}
	if parsed := net.ParseIP(trimmed); parsed != nil {
		return parsed.String()
	}
	return "unknown"
}
