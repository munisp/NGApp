package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for the service.
type Metrics struct {
	PaymentInitiatedCounter prometheus.Counter
	PaymentStatusGauge      *prometheus.GaugeVec
	PaymentDuration         *prometheus.HistogramVec
}

// NewMetrics initializes and registers Prometheus metrics.
func NewMetrics() *Metrics {
	m := &Metrics{
		PaymentInitiatedCounter: promauto.NewCounter(prometheus.CounterOpts{
			Name: "payment_initiated_total",
			Help: "Total number of payment workflows initiated.",
		}),
		PaymentStatusGauge: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "payment_status_current",
			Help: "Current status of a payment (1 for active, 0 for finished).",
		}, []string{"payment_id", "status"}),
		PaymentDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name: "payment_workflow_duration_seconds",
			Help: "Duration of the payment workflow from start to finish.",
			Buckets: []float64{0.1, 0.5, 1, 5, 10, 30, 60, 120, 300}, // 10s to 5m
		}, []string{"status"}),
	}
	return m
}

// Note: In a full implementation, these metrics would be integrated into the
// service layer and the Temporal activities/workflows. For this task,
// the structure is defined and the main.go file is updated to include
// the metrics handler.
