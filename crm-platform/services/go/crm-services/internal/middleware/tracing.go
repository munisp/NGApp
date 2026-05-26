package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// TraceContext holds distributed trace information
type TraceContext struct {
	TraceID   string `json:"trace_id"`
	SpanID    string `json:"span_id"`
	ParentID  string `json:"parent_id,omitempty"`
	Service   string `json:"service"`
	Operation string `json:"operation"`
	StartTime time.Time
}

// DistributedTracing adds OpenTelemetry-compatible trace headers to requests.
// When a real OTEL collector is configured, replace this with the official SDK.
func DistributedTracing(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = c.GetHeader("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%016x%016x", time.Now().UnixNano(), time.Now().UnixMicro())
		}

		spanID := fmt.Sprintf("%016x", time.Now().UnixNano())

		c.Set("trace_id", traceID)
		c.Set("span_id", spanID)
		c.Set("service_name", serviceName)

		// Propagate trace context downstream
		c.Header("X-Trace-ID", traceID)
		c.Header("X-Span-ID", spanID)
		c.Header("X-Service-Name", serviceName)

		c.Next()
	}
}
