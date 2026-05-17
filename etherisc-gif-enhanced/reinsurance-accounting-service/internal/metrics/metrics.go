package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all Prometheus metrics for the service.
type Metrics struct {
	ReinsurerCreationCounter *prometheus.CounterVec
	TransactionCounter       *prometheus.CounterVec
	SettlementWorkflowStarts prometheus.Counter
	APIRequestDuration       *prometheus.HistogramVec
}

// NewMetrics initializes and registers all Prometheus metrics.
func NewMetrics() *Metrics {
	m := &Metrics{
		ReinsurerCreationCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "reinsurer_creation_total",
				Help: "Total number of reinsurers created.",
			},
			[]string{"status"},
		),
		TransactionCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "reinsurance_transaction_total",
				Help: "Total number of reinsurance transactions recorded.",
			},
			[]string{"type", "status"},
		),
		SettlementWorkflowStarts: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "settlement_workflow_starts_total",
				Help: "Total number of reinsurance settlement workflows started.",
			},
		),
		APIRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "api_request_duration_seconds",
				Help: "API request duration histogram.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"endpoint", "method", "status"},
		),
	}

	prometheus.MustRegister(
		m.ReinsurerCreationCounter,
		m.TransactionCounter,
		m.SettlementWorkflowStarts,
		m.APIRequestDuration,
	)

	return m
}

// PrometheusHandler returns the HTTP handler for Prometheus metrics.
func PrometheusHandler() http.Handler {
	return promhttp.Handler()
}
