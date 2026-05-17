package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Define Prometheus metrics
var (
	// PremiumCalculationDuration measures the duration of premium calculation activity.
	PremiumCalculationDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "openimis_premium_calc_duration_seconds",
		Help:    "Duration of OpenIMIS premium calculation API calls.",
		Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10},
	}, []string{"status"}) // status can be "success" or "failure"

	// CircuitBreakerState measures the current state of the circuit breaker.
	CircuitBreakerState = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "openimis_premium_cb_state",
		Help: "Current state of the OpenIMIS premium calculation circuit breaker (0=Closed, 1=Open, 2=Half-Open).",
	}, []string{"name"})

	// PolicyCreationTotal counts the total number of policy creation attempts.
	PolicyCreationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "policy_creation_total",
		Help: "Total number of policy creation attempts.",
	}, []string{"status"}) // status can be "success" or "failure"
)

// StateMapping maps gobreaker state to a numeric value for Prometheus.
func StateMapping(state string) float64 {
	switch state {
	case "closed":
		return 0
	case "open":
		return 1
	case "half-open":
		return 2
	default:
		return -1
	}
}
