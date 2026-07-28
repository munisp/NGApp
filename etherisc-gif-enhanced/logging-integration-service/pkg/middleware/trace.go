package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type contextKey string

const (
	// TraceIDKey is the key used to store the trace ID in the request context.
	TraceIDKey contextKey = "traceID"
)

// GetTraceID extracts the trace ID from the request context.
func GetTraceID(ctx context.Context) string {
	if traceID, ok := ctx.Value(TraceIDKey).(string); ok {
		return traceID
	}
	return ""
}

// TraceIDMiddleware is a middleware that generates a unique trace ID for each request
// and adds it to the request context.
func TraceIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Check for existing trace ID in headers (e.g., for distributed tracing)
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			// 2. Generate a new trace ID if none is found
			traceID = uuid.New().String()
		}

		// 3. Add the trace ID to the request context
		ctx := context.WithValue(r.Context(), TraceIDKey, traceID)
		r = r.WithContext(ctx)

		// 4. Add the trace ID to the response header for client-side tracing
		w.Header().Set("X-Trace-ID", traceID)

		// 5. Serve the next handler
		next.ServeHTTP(w, r)
	})
}

// LoggerMiddleware is a middleware that injects a request-scoped logger with the trace ID
// into the request context.
func LoggerMiddleware(log zerolog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := GetTraceID(r.Context())
		if traceID != "" {
			// Create a new logger with the trace ID and store it in the context
			requestLogger := log.With().Str("trace_id", traceID).Logger()
			ctx := context.WithValue(r.Context(), logger.ContextLoggerKey, requestLogger)
			r = r.WithContext(ctx)
		}

		next.ServeHTTP(w, r)
	})
}
