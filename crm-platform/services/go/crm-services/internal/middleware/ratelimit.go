package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int
	burst    int
	window   time.Duration
}

type visitor struct {
	tokens    int
	lastReset time.Time
}

func NewRateLimiter(rate, burst int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for key, v := range rl.visitors {
			if time.Since(v.lastReset) > rl.window*2 {
				delete(rl.visitors, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(key string) (bool, int, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[key]
	now := time.Now()

	if !exists {
		rl.visitors[key] = &visitor{tokens: rl.burst - 1, lastReset: now}
		return true, rl.burst - 1, rl.window
	}

	elapsed := now.Sub(v.lastReset)
	if elapsed >= rl.window {
		v.tokens = rl.burst - 1
		v.lastReset = now
		return true, v.tokens, rl.window
	}

	if v.tokens > 0 {
		v.tokens--
		return true, v.tokens, rl.window - elapsed
	}

	return false, 0, rl.window - elapsed
}

func (rl *rateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		if tenantID := c.GetHeader("X-Tenant-ID"); tenantID != "" {
			key = tenantID + ":" + key
		}

		allowed, remaining, resetAfter := rl.allow(key)

		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.burst))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(resetAfter).Unix(), 10))

		if !allowed {
			c.Header("Retry-After", strconv.Itoa(int(resetAfter.Seconds())))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate_limit_exceeded",
				"message":     "Too many requests",
				"retry_after": int(resetAfter.Seconds()),
			})
			return
		}

		c.Next()
	}
}
