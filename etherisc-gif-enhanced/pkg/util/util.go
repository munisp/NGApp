package util

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// --- Prometheus Metrics ---

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "Duration of HTTP requests.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
}

// PrometheusMiddleware is a Gin middleware for Prometheus metrics.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := prometheus.NewTimer(httpRequestDuration.WithLabelValues(c.Request.Method, c.Request.URL.Path))
		c.Next()
		status := http.StatusText(c.Writer.Status())
		httpRequestsTotal.WithLabelValues(c.Request.Method, c.Request.URL.Path, status).Inc()
		start.ObserveDuration()
	}
}

// PrometheusHandler returns the Gin handler for the metrics endpoint.
func PrometheusHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// --- Authentication Middleware ---

// AuthMiddleware is a Gin middleware for API Key authentication.
func AuthMiddleware(apiKeyHeader string, validKeys []string) gin.HandlerFunc {
	validKeysMap := make(map[string]bool)
	for _, key := range validKeys {
		validKeysMap[key] = true
	}

	return func(c *gin.Context) {
		apiKey := c.GetHeader(apiKeyHeader)
		if apiKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API key required"})
			return
		}

		if !validKeysMap[apiKey] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Invalid API key"})
			return
		}

		// Optionally, you can fetch the reinsurer details based on the key and set it in context
		// c.Set("reinsurerID", "reinsurer-a-id")

		c.Next()
	}
}
