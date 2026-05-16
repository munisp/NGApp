package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTPRequestsTotal is a counter for total HTTP requests.
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"method", "path", "code"},
	)

	// PolicyEventsProcessed is a counter for policy events processed.
	PolicyEventsProcessed = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "policy_events_processed_total",
			Help: "Total number of blockchain policy events processed.",
		},
	)

	// ClaimEventsProcessed is a counter for claim events processed.
	ClaimEventsProcessed = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "claim_events_processed_total",
			Help: "Total number of blockchain claim events processed.",
		},
	)

	// PolicyEventProcessingErrors is a counter for errors during policy event processing.
	PolicyEventProcessingErrors = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "policy_event_processing_errors_total",
			Help: "Total number of errors during policy event processing.",
		},
	)

	// ClaimEventProcessingErrors is a counter for errors during claim event processing.
	ClaimEventProcessingErrors = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "claim_event_processing_errors_total",
			Help: "Total number of errors during claim event processing.",
		},
	)

	// AnalyticsViewQueries is a counter for analytics view queries.
	AnalyticsViewQueries = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "analytics_view_queries_total",
			Help: "Total number of analytics view queries.",
		},
		[]string{"view_name"},
	)

	// AnalyticsViewQueryErrors is a counter for errors during analytics view queries.
	AnalyticsViewQueryErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "analytics_view_query_errors_total",
			Help: "Total number of errors during analytics view queries.",
		},
		[]string{"view_name"},
	)
)

// InitMetrics registers all defined metrics.
func InitMetrics() {
	prometheus.MustRegister(HTTPRequestsTotal)
	prometheus.MustRegister(PolicyEventsProcessed)
	prometheus.MustRegister(ClaimEventsProcessed)
	prometheus.MustRegister(PolicyEventProcessingErrors)
	prometheus.MustRegister(ClaimEventProcessingErrors)
	prometheus.MustRegister(AnalyticsViewQueries)
	prometheus.MustRegister(AnalyticsViewQueryErrors)
}

// Handler returns the Prometheus HTTP handler.
func Handler() http.Handler {
	return promhttp.Handler()
}
