package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "crm_http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status", "tenant"},
	)
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "crm_http_request_duration_seconds",
			Help:    "HTTP request duration",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "tenant"},
	)
	activeRequests = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "crm_active_requests",
			Help: "Currently active requests",
		},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, activeRequests)
}

func Observability(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		tenant := c.GetHeader("X-Tenant-ID")
		activeRequests.Inc()

		c.Next()

		duration := time.Since(start)
		status := strconv.Itoa(c.Writer.Status())
		activeRequests.Dec()

		httpRequestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), status, tenant).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, c.FullPath(), tenant).Observe(duration.Seconds())

		if c.Writer.Status() >= http.StatusBadRequest {
			logger.WithFields(logrus.Fields{
				"method":   c.Request.Method,
				"path":     c.Request.URL.Path,
				"status":   status,
				"duration": duration.String(),
				"tenant":   tenant,
				"error":    c.Errors.String(),
			}).Warn("request error")
		}
	}
}
