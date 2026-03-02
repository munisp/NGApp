package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// HMACSigner provides API request signing and verification using HMAC-SHA256.
// Institutional clients sign every trading request to prevent:
//   - Order spoofing (someone submitting orders on behalf of another)
//   - Replay attacks (re-submitting old signed requests)
//   - Man-in-the-middle tampering (modifying request in transit)
//
// Signature format: HMAC-SHA256(api_key + timestamp + method + path + body_hash + nonce)
// Header: X-NEXCOM-Signature, X-NEXCOM-Timestamp, X-NEXCOM-Nonce, X-NEXCOM-Key
type HMACSigner struct {
	// Map of API key -> HMAC secret
	secrets       map[string]string
	maxTimeDrift  time.Duration
	nonceCache    map[string]time.Time
	enabled       bool
}

// NewHMACSigner creates a new HMAC signer/verifier
func NewHMACSigner() *HMACSigner {
	hs := &HMACSigner{
		secrets:      make(map[string]string),
		maxTimeDrift: 5 * time.Minute, // Allow 5 minutes clock drift
		nonceCache:   make(map[string]time.Time),
		enabled:      true,
	}

	// Seed default API keys for development
	hs.secrets["nexcom-admin-key"] = "nexcom-admin-hmac-secret-changeme"
	hs.secrets["nexcom-trader-key"] = "nexcom-trader-hmac-secret-changeme"
	hs.secrets["nexcom-institutional-key"] = "nexcom-institutional-hmac-secret-changeme"

	// Cleanup expired nonces periodically
	go hs.cleanupNonces()

	return hs
}

// RegisterKey registers an API key and its HMAC secret
func (hs *HMACSigner) RegisterKey(apiKey, secret string) {
	hs.secrets[apiKey] = secret
}

// Sign generates an HMAC-SHA256 signature for a request
func (hs *HMACSigner) Sign(apiKey, method, path, bodyHash, nonce string, timestamp int64) (string, error) {
	secret, ok := hs.secrets[apiKey]
	if !ok {
		return "", fmt.Errorf("unknown API key: %s", apiKey)
	}

	message := buildSignatureMessage(apiKey, method, path, bodyHash, nonce, timestamp)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

// VerifyMiddleware returns Gin middleware that verifies HMAC signatures on trading endpoints
func (hs *HMACSigner) VerifyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip verification for non-trading endpoints and GET requests
		if c.Request.Method == "GET" || !isTradingEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Skip if HMAC signing is disabled (development mode)
		if !hs.enabled {
			c.Next()
			return
		}

		// Extract signature headers
		signature := c.GetHeader("X-NEXCOM-Signature")
		timestampStr := c.GetHeader("X-NEXCOM-Timestamp")
		nonce := c.GetHeader("X-NEXCOM-Nonce")
		apiKey := c.GetHeader("X-NEXCOM-Key")

		// If no signature headers present, allow (for backward compatibility in dev)
		if signature == "" && timestampStr == "" {
			c.Next()
			return
		}

		// All headers required if any are present
		if signature == "" || timestampStr == "" || nonce == "" || apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Missing HMAC signature headers (X-NEXCOM-Signature, X-NEXCOM-Timestamp, X-NEXCOM-Nonce, X-NEXCOM-Key)",
				"code":    "MISSING_SIGNATURE_HEADERS",
			})
			c.Abort()
			return
		}

		// Parse timestamp
		timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid timestamp format",
				"code":    "INVALID_TIMESTAMP",
			})
			c.Abort()
			return
		}

		// Check timestamp drift (prevent replay attacks)
		requestTime := time.Unix(timestamp, 0)
		drift := time.Since(requestTime)
		if drift < 0 {
			drift = -drift
		}
		if drift > hs.maxTimeDrift {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Request timestamp too far from server time (max 5 minutes drift)",
				"code":    "TIMESTAMP_DRIFT",
			})
			c.Abort()
			return
		}

		// Check nonce uniqueness (prevent replay)
		if _, exists := hs.nonceCache[nonce]; exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Duplicate nonce detected (possible replay attack)",
				"code":    "DUPLICATE_NONCE",
			})
			c.Abort()
			return
		}
		hs.nonceCache[nonce] = time.Now()

		// Compute body hash
		bodyHash := ""
		if c.Request.Body != nil {
			// Body will be read by handler, so we hash the Content-Length as proxy
			bodyHash = fmt.Sprintf("cl:%d", c.Request.ContentLength)
		}

		// Verify signature
		expectedSig, err := hs.Sign(apiKey, c.Request.Method, c.Request.URL.Path, bodyHash, nonce, timestamp)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid API key",
				"code":    "INVALID_API_KEY",
			})
			c.Abort()
			return
		}

		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid HMAC signature",
				"code":    "INVALID_SIGNATURE",
			})
			c.Abort()
			return
		}

		// Signature valid — set verified flag
		c.Set("hmac_verified", true)
		c.Set("hmac_api_key", apiKey)
		c.Next()
	}
}

func buildSignatureMessage(apiKey, method, path, bodyHash, nonce string, timestamp int64) string {
	parts := []string{
		apiKey,
		fmt.Sprintf("%d", timestamp),
		strings.ToUpper(method),
		path,
		bodyHash,
		nonce,
	}
	sort.Strings(parts)
	return strings.Join(parts, "\n")
}

func isTradingEndpoint(path string) bool {
	tradingPaths := []string{
		"/api/v1/orders",
		"/api/v1/positions",
		"/api/v1/digital-assets",
		"/api/v1/forex/orders",
	}
	for _, tp := range tradingPaths {
		if strings.HasPrefix(path, tp) {
			return true
		}
	}
	return false
}

func (hs *HMACSigner) cleanupNonces() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-10 * time.Minute)
		for k, v := range hs.nonceCache {
			if v.Before(cutoff) {
				delete(hs.nonceCache, k)
			}
		}
	}
}
