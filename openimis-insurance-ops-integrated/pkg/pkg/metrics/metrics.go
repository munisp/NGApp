package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for the application.
type Metrics struct {
	ClaimsProcessedCounter *prometheus.CounterVec
	ClaimsFailedCounter    *prometheus.CounterVec
	EnrichmentLatency      prometheus.Histogram
	AggregationLatency     prometheus.Histogram
	DataQualityGauge       prometheus.Gauge
	LateDataCounter        prometheus.Counter
}

// NewMetrics initializes and registers all Prometheus metrics.
func NewMetrics() *Metrics {
	m := &Metrics{
		ClaimsProcessedCounter: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "actuarial_claims_processed_total",
			Help: "Total number of claims processed, labeled by status (success/failure) and region.",
		}, []string{"status", "region"}),

		ClaimsFailedCounter: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "actuarial_claims_failed_total",
			Help: "Total number of claims that failed processing, labeled by reason.",
		}, []string{"reason"}),

		EnrichmentLatency: promauto.NewHistogram(prometheus.HistogramOpts{
			Name: "actuarial_enrichment_latency_seconds",
			Help: "Latency of the operational context enrichment API calls.",
			Buckets: prometheus.DefBuckets,
		}),

		AggregationLatency: promauto.NewHistogram(prometheus.HistogramOpts{
			Name: "actuarial_aggregation_latency_seconds",
			Help: "Latency of the in-memory aggregation process.",
			Buckets: prometheus.DefBuckets,
		}),

		DataQualityGauge: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "actuarial_last_claim_data_quality_score",
			Help: "Data quality score of the last processed claim.",
		}),

		LateDataCounter: promauto.NewCounter(prometheus.CounterOpts{
			Name: "actuarial_late_data_total",
			Help: "Total number of late-arriving claims detected.",
		}),
	}
	return m
}
