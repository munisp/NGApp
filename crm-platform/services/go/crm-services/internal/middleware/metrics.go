package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "crm_http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status", "tenant_id"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "crm_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path", "tenant_id"},
	)

	httpResponseSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "crm_http_response_size_bytes",
			Help:    "HTTP response size in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 10, 7),
		},
		[]string{"method", "path"},
	)

	activeConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "crm_active_connections",
			Help: "Number of active connections",
		},
	)

	CustomersTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "crm_customers_total",
			Help: "Total number of customers per tenant",
		},
		[]string{"tenant_id", "status"},
	)

	CampaignsSent = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "crm_campaigns_sent_total",
			Help: "Total campaign messages sent",
		},
		[]string{"tenant_id", "channel"},
	)

	TransactionVolume = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "crm_transaction_volume_total",
			Help: "Total transaction volume in minor currency units",
		},
		[]string{"tenant_id", "type", "currency"},
	)
)

func PrometheusMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		activeConnections.Inc()
		defer activeConnections.Dec()

		start := time.Now()
		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}

		tenantID := ""
		if tid, exists := c.Get("tenant_id"); exists {
			tenantID, _ = tid.(string)
		}

		httpRequestsTotal.WithLabelValues(c.Request.Method, path, status, tenantID).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, path, tenantID).Observe(duration)
		httpResponseSize.WithLabelValues(c.Request.Method, path).Observe(float64(c.Writer.Size()))
	}
}
