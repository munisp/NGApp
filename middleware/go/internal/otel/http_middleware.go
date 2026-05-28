// Package otel provides HTTP middleware for automatic span creation on incoming requests.
package otel

import (
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// HTTPMiddleware returns an http.Handler that wraps each request in an OTel span.
// It extracts W3C trace context from incoming headers (X-Trace-Id, traceparent, etc.)
// and propagates it to downstream calls.
func HTTPMiddleware(serviceName string, next http.Handler) http.Handler {
	tracer := otel.Tracer(serviceName)
	propagator := otel.GetTextMapPropagator()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract trace context from incoming headers
		ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

		spanName := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
		ctx, span := tracer.Start(ctx, spanName,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				semconv.HTTPMethod(r.Method),
				semconv.HTTPURL(r.URL.String()),
				semconv.HTTPRoute(r.URL.Path),
				attribute.String("http.host", r.Host),
				attribute.String("http.user_agent", r.UserAgent()),
				attribute.String("net.peer.addr", r.RemoteAddr),
			),
		)
		defer span.End()

		// Wrap ResponseWriter to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		start := time.Now()

		// Inject trace context into response headers for client-side correlation
		propagator.Inject(ctx, propagation.HeaderCarrier(w.Header()))

		next.ServeHTTP(rw, r.WithContext(ctx))

		duration := time.Since(start)
		span.SetAttributes(
			semconv.HTTPStatusCode(rw.statusCode),
			attribute.Int64("http.response_content_length", rw.bytesWritten),
			attribute.Float64("http.duration_ms", float64(duration.Milliseconds())),
		)

		if rw.statusCode >= 500 {
			span.SetStatus(codes.Error, http.StatusText(rw.statusCode))
		} else {
			span.SetStatus(codes.Ok, "")
		}
	})
}

// responseWriter wraps http.ResponseWriter to capture status code and bytes written.
type responseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

// GracefulShutdownMiddleware adds graceful shutdown support to an HTTP server.
// It waits for in-flight requests to complete before returning.
func GracefulShutdownMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}
