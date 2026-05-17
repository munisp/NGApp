package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// PolicyCreationTotal is a counter for policy creation attempts, labeled by type and status.
var PolicyCreationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "policy_creation_total",
	Help: "Total number of policy creation attempts.",
}, []string{"policy_type", "status"})

// HTTPRequestDurationSeconds is a histogram for HTTP request latencies.
var HTTPRequestDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name: "http_request_duration_seconds",
	Help: "Duration of HTTP requests.",
	Buckets: prometheus.DefBuckets,
}, []string{"path", "method", "status"})

// TemporalWorkflowDurationSeconds is a histogram for Temporal workflow execution times.
var TemporalWorkflowDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name: "temporal_workflow_duration_seconds",
	Help: "Duration of Temporal workflows.",
	Buckets: prometheus.DefBuckets,
}, []string{"workflow_name", "status"})
