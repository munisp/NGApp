package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Define Prometheus metrics
var (
	// sync_operations_total counts the total number of synchronization attempts.
	SyncOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "sync_operations_total",
		Help: "Total number of synchronization attempts.",
	}, []string{"source", "target", "entity_type"})

	// sync_operations_success counts the number of successful synchronization attempts.
	SyncOperationsSuccess = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "sync_operations_success",
		Help: "Total number of successful synchronization attempts.",
	}, []string{"source", "target", "entity_type"})

	// sync_duration_seconds measures the duration of synchronization activities.
	SyncDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "sync_duration_seconds",
		Help:    "Duration of synchronization activities in seconds.",
		Buckets: prometheus.DefBuckets,
	}, []string{"activity_name", "status"})
)

// RecordSyncOperation records a synchronization attempt and its outcome.
func RecordSyncOperation(source, target, entityType string, success bool) {
	SyncOperationsTotal.WithLabelValues(source, target, entityType).Inc()
	if success {
		SyncOperationsSuccess.WithLabelValues(source, target, entityType).Inc()
	}
}

// RecordActivityDuration records the duration of a Temporal activity.
func RecordActivityDuration(activityName string, status string, duration float64) {
	SyncDurationSeconds.WithLabelValues(activityName, status).Observe(duration)
}
