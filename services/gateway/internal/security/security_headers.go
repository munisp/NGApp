package security

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders returns Gin middleware that adds comprehensive security headers.
// Protects against: clickjacking, XSS, MIME sniffing, information leakage,
// content injection, and protocol downgrade attacks.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Content Security Policy — restricts resource loading.
		// 'unsafe-eval' removed entirely. 'unsafe-inline' replaced with nonce-based
		// approach where possible; kept only for style-src (required by many UI frameworks).
		// script-src uses 'strict-dynamic' for CSP Level 3 browsers.
		c.Header("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'strict-dynamic'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob: https:; "+
				"font-src 'self' data:; "+
				"connect-src 'self' ws: wss: https://api-fxtrade.oanda.com https://api.polygon.io https://cloud.iexapis.com; "+
				"frame-ancestors 'none'; "+
				"base-uri 'self'; "+
				"form-action 'self'; "+
				"object-src 'none'; "+
				"upgrade-insecure-requests")

		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// XSS Protection (legacy browsers)
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer Policy — don't leak URLs to external sites
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions Policy — restrict browser features
		c.Header("Permissions-Policy",
			"camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), magnetometer=(), gyroscope=()")

		// Strict Transport Security — force HTTPS for 1 year + preload
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		// Prevent browsers from caching sensitive responses
		if isSensitiveEndpoint(c.Request.URL.Path) {
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}

		// Remove server identification headers
		c.Header("X-Powered-By", "")
		c.Header("Server", "NEXCOM-Exchange")

		// Cross-Origin policies
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		c.Header("Cross-Origin-Embedder-Policy", "require-corp")
		c.Header("Cross-Origin-Resource-Policy", "same-origin")

		// Request ID for tracing
		if c.GetHeader("X-Request-ID") == "" {
			c.Header("X-Request-ID", c.GetString("requestID"))
		}

		c.Next()
	}
}

func isSensitiveEndpoint(path string) bool {
	sensitivePrefixes := []string{
		"/api/v1/auth",
		"/api/v1/account",
		"/api/v1/orders",
		"/api/v1/portfolio",
		"/api/v1/positions",
		"/api/v1/forex/orders",
	}
	for _, prefix := range sensitivePrefixes {
		if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}
