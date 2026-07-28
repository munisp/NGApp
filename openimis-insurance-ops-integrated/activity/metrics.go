package activity

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
)

var (
	// Metrics
	claimsSynced = promauto.NewCounter(prometheus.CounterOpts{
		Name: "claims_sync_total",
		Help: "The total number of claims synced to OpenIMIS.",
	})
	reserveAdjustmentsApplied = promauto.NewCounter(prometheus.CounterOpts{
		Name: "reserve_adjustments_applied_total",
		Help: "The total number of reserve adjustments applied to Claims service.",
	})
	lossRatioUpdates = promauto.NewCounter(prometheus.CounterOpts{
		Name: "loss_ratio_updates_total",
		Help: "The total number of loss ratio updates performed.",
	})
	syncDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name: "claims_sync_duration_seconds",
		Help: "Duration of claim sync operations.",
		Buckets: prometheus.DefBuckets,
	})

	// Logger
	log = logrus.New()
)

func init() {
	log.SetFormatter(&logrus.JSONFormatter{})
}

// GetLogger returns the structured logger.
func GetLogger() *logrus.Logger {
	return log
}
