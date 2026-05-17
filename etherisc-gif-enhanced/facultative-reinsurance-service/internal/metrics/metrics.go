package metrics

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// WorkflowStartedCount tracks the number of reinsurance workflows started
	WorkflowStartedCount = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "reinsurance_workflow_started_total",
		Help: "Total number of facultative reinsurance workflows started.",
	}, []string{"workflow_type"})

	// QuoteStatusCount tracks the status of quotes
	QuoteStatusCount = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "reinsurance_quote_status_total",
		Help: "Total number of quotes by status (requested, accepted, rejected).",
	}, []string{"status"})

	// GIFIntegrationLatency tracks the duration of GIF integration calls
	GIFIntegrationLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name: "gif_integration_duration_seconds",
		Help: "Latency of Etherisc GIF integration calls.",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation", "success"})

	// CededPremiumTotal tracks the total ceded premium
	CededPremiumTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "reinsurance_ceded_premium_total",
		Help: "Total premium ceded to reinsurers.",
	})

	// CededClaimAmountTotal tracks the total claim amount ceded
	CededClaimAmountTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "reinsurance_ceded_claim_amount_total",
		Help: "Total claim amount ceded to reinsurers.",
	})
)

// RecordWorkflowStart increments the counter for a started workflow.
func RecordWorkflowStart(workflowType string) {
	WorkflowStartedCount.WithLabelValues(workflowType).Inc()
}

// RecordQuoteStatus increments the counter for a quote status change.
func RecordQuoteStatus(status string) {
	QuoteStatusCount.WithLabelValues(status).Inc()
}

// RecordGIFIntegrationLatency records the duration of a GIF integration call.
func RecordGIFIntegrationLatency(operation string, success bool, duration time.Duration) {
	successStr := fmt.Sprintf("%t", success)
	GIFIntegrationLatency.WithLabelValues(operation, successStr).Observe(duration.Seconds())
}

// RecordCededPremium updates the total ceded premium.
func RecordCededPremium(amount float64) {
	CededPremiumTotal.Add(amount)
}

// RecordCededClaimAmount updates the total ceded claim amount.
func RecordCededClaimAmount(amount float64) {
	CededClaimAmountTotal.Add(amount)
}
