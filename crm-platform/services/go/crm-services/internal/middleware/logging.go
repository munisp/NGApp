package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func StructuredLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = c.Writer.Header().Get("X-Request-ID")
		}

		c.Set("request_id", requestID)
		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		entry := logger.WithFields(logrus.Fields{
			"request_id": requestID,
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"status":     status,
			"latency_ms": latency.Milliseconds(),
			"client_ip":  c.ClientIP(),
			"user_agent": c.Request.UserAgent(),
		})

		if tenantID, exists := c.Get("tenant_id"); exists {
			entry = entry.WithField("tenant_id", tenantID)
		}
		if userID, exists := c.Get("user_id"); exists {
			entry = entry.WithField("user_id", userID)
		}

		if status >= 500 {
			entry.Error("Server error")
		} else if status >= 400 {
			entry.Warn("Client error")
		} else {
			entry.Info("Request completed")
		}
	}
}
