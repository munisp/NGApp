package metrics

import (
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all application-specific Prometheus metrics
type Metrics struct {
	ReserveCalculationDuration *prometheus.HistogramVec
	IBNRCalculationCounter     *prometheus.CounterVec
	TemporalWorkflowCounter    *prometheus.CounterVec
}

// NewMetrics initializes and registers all metrics
func NewMetrics() *Metrics {
	m := &Metrics{
		ReserveCalculationDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "reserve_calculation_duration_seconds",
				Help:    "Duration of reserve calculation in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"type"}, // e.g., "individual", "ibnr"
		),
		IBNRCalculationCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ibnr_calculation_total",
				Help: "Total number of IBNR calculations triggered.",
			},
			[]string{"status"}, // e.g., "success", "failure"
		),
		TemporalWorkflowCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "temporal_workflow_total",
				Help: "Total number of Temporal workflows started.",
			},
			[]string{"workflow_name", "status"}, // e.g., "ReserveAdjustmentWorkflow", "started", "completed"
		),
	}

	prometheus.MustRegister(m.ReserveCalculationDuration)
	prometheus.MustRegister(m.IBNRCalculationCounter)
	prometheus.MustRegister(m.TemporalWorkflowCounter)

	return m
}

// StartMetricsServer starts a simple HTTP server for Prometheus metrics
func StartMetricsServer(port int) {
	http.Handle("/metrics", promhttp.Handler())
	go func() {
		fmt.Printf("Starting metrics server on :%d\n", port)
		if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
			fmt.Printf("Metrics server failed: %v\n", err)
		}
	}()
}
