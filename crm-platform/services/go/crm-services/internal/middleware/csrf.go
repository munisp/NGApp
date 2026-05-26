package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
)

var csrfSecret []byte

func init() {
	csrfSecret = make([]byte, 32)
	if _, err := rand.Read(csrfSecret); err != nil {
		panic("failed to generate CSRF secret: " + err.Error())
	}
}

func generateCSRFToken(sessionID string) string {
	mac := hmac.New(sha256.New, csrfSecret)
	mac.Write([]byte(sessionID))
	return hex.EncodeToString(mac.Sum(nil))
}

func validateCSRFToken(token, sessionID string) bool {
	expected := generateCSRFToken(sessionID)
	return hmac.Equal([]byte(token), []byte(expected))
}

func CSRFProtection() gin.HandlerFunc {
	safeMethods := map[string]bool{
		http.MethodGet:     true,
		http.MethodHead:    true,
		http.MethodOptions: true,
	}

	return func(c *gin.Context) {
		if safeMethods[c.Request.Method] {
			c.Next()
			return
		}

		token := c.GetHeader("X-CSRF-Token")
		if token == "" {
			token = c.PostForm("_csrf")
		}

		sessionID, _ := c.Get("user_id")
		sid, ok := sessionID.(string)
		if !ok || sid == "" {
			sid = c.ClientIP()
		}

		if token == "" || !validateCSRFToken(token, sid) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "csrf_validation_failed",
				"message": "Invalid or missing CSRF token",
			})
			return
		}

		c.Next()
	}
}

func CSRFTokenEndpoint() gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID, _ := c.Get("user_id")
		sid, ok := sessionID.(string)
		if !ok || sid == "" {
			sid = c.ClientIP()
		}
		c.JSON(http.StatusOK, gin.H{
			"csrf_token": generateCSRFToken(sid),
		})
	}
}
