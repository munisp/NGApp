package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// Metrics holds all Prometheus metrics for the application
type Metrics struct {
	EventsProduced *prometheus.CounterVec
	EventsConsumed *prometheus.CounterVec
	WorkflowStarts *prometheus.CounterVec
	WorkflowErrors *prometheus.CounterVec
	ActivityDuration *prometheus.HistogramVec
}

// NewMetrics initializes and registers all Prometheus metrics
func NewMetrics(serviceName string) *Metrics {
	m := &Metrics{
		EventsProduced: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: fmt.Sprintf("%s_events_produced_total", serviceName),
				Help: "Total number of events produced to Kafka.",
			},
			[]string{"event_type"},
		),
		EventsConsumed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: fmt.Sprintf("%s_events_consumed_total", serviceName),
				Help: "Total number of events consumed from Kafka.",
			},
			[]string{"event_type", "consumer_group"},
		),
		WorkflowStarts: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: fmt.Sprintf("%s_workflow_starts_total", serviceName),
				Help: "Total number of Temporal workflows started.",
			},
			[]string{"workflow_name"},
		),
		WorkflowErrors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: fmt.Sprintf("%s_workflow_errors_total", serviceName),
				Help: "Total number of Temporal workflows that failed.",
			},
			[]string{"workflow_name"},
		),
		ActivityDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: fmt.Sprintf("%s_activity_duration_seconds", serviceName),
				Help: "Duration of Temporal activities.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"activity_name", "status"},
		),
	}

	prometheus.MustRegister(m.EventsProduced)
	prometheus.MustRegister(m.EventsConsumed)
	prometheus.MustRegister(m.WorkflowStarts)
	prometheus.MustRegister(m.WorkflowErrors)
	prometheus.MustRegister(m.ActivityDuration)

	return m
}

// StartMetricsServer starts an HTTP server to expose Prometheus metrics
func StartMetricsServer(addr string, log *logrus.Entry) {
	http.Handle("/metrics", promhttp.Handler())
	log.Infof("Starting metrics server on %s", addr)
	go func() {
		if err := http.ListenAndServe(addr, nil); err != nil {
			log.WithError(err).Fatal("Failed to start metrics server")
		}
	}()
}
