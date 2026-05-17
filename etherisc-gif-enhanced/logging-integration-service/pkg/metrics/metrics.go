package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all application-specific Prometheus metrics.
type Metrics struct {
	// Counters
	HTTPRequestsTotal *prometheus.CounterVec
	GIFClientCallsTotal *prometheus.CounterVec

	// Histograms
	HTTPRequestDuration *prometheus.HistogramVec
	GIFClientDuration *prometheus.HistogramVec
}

// NewMetrics initializes and registers all Prometheus metrics.
func NewMetrics(serviceName string) *Metrics {
	m := &Metrics{
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: prometheus.BuildFQName(serviceName, "http", "requests_total"),
				Help: "Total number of HTTP requests.",
			},
			[]string{"method", "path", "status"},
		),
		GIFClientCallsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: prometheus.BuildFQName(serviceName, "gif_client", "calls_total"),
				Help: "Total number of calls to the GIF client.",
			},
			[]string{"method", "success"},
		),
		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: prometheus.BuildFQName(serviceName, "http", "request_duration_seconds"),
				Help: "Duration of HTTP requests.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "path"},
		),
		GIFClientDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: prometheus.BuildFQName(serviceName, "gif_client", "duration_seconds"),
				Help: "Duration of GIF client calls.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method"},
		),
	}
	return m
}
