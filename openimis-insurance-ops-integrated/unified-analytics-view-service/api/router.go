package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"unified-analytics-view-service/pkg/service"
)

// NewRouter creates a new Gorilla Mux router with all routes and middleware.
func NewRouter(analyticsService service.AnalyticsService, logger *logrus.Entry) *mux.Router {
	handler := &Handler{
		AnalyticsService: analyticsService,
		Logger:           logger,
	}

	r := mux.NewRouter()

	// Middleware for logging and tracing (simulated)
	r.Use(loggingMiddleware(logger))

	// Routes for generating and publishing unified views
	r.HandleFunc("/views/{viewType}/{id}", handler.GenerateViewHandler).Methods("POST")

	// Route for regulatory reporting
	r.HandleFunc("/reports/regulatory/{period}", handler.GetRegulatoryReportHandler).Methods("GET")

	// Route for scheduling reports (Temporal)
	r.HandleFunc("/reports/schedule", handler.StartScheduledReportHandler).Methods("POST")

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	return r
}

// loggingMiddleware logs every request with structured logging.
func loggingMiddleware(logger *logrus.Entry) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			// Simulate trace ID generation
			traceID := "trace-" + start.Format("20060102150405.000000")

			ctx := context.WithValue(r.Context(), "traceID", traceID)
			r = r.WithContext(ctx)

			logger.WithFields(logrus.Fields{
				"method": r.Method,
				"path":   r.URL.Path,
				"trace_id": traceID,
			}).Info("Request started")

			next.ServeHTTP(w, r)

			logger.WithFields(logrus.Fields{
				"method": r.Method,
				"path":   r.URL.Path,
				"trace_id": traceID,
				"duration": time.Since(start).String(),
			}).Info("Request completed")
		})
	}
}
