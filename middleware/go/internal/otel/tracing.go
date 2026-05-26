// Package otel provides shared OpenTelemetry initialization for all OG-RMM Go services.
// Each service calls otel.Init() at startup to configure distributed tracing,
// metrics collection, and structured logging with trace correlation.
//
// Supported exporters (via environment variables):
//   OTEL_EXPORTER_OTLP_ENDPOINT  → OTLP gRPC endpoint (e.g. "otel-collector:4317")
//   OTEL_SERVICE_NAME             → Service name tag (e.g. "alarm-manager")
//   OTEL_ENVIRONMENT              → Deployment environment (e.g. "production")
//   OTEL_SAMPLE_RATE              → Sampling rate 0.0-1.0 (default: 1.0 in dev, 0.1 in prod)
package otel

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Provider holds the initialized OTel providers and a shutdown function.
type Provider struct {
	TracerProvider *sdktrace.TracerProvider
	MeterProvider  *sdkmetric.MeterProvider
	Shutdown       func(ctx context.Context) error
}

// Init initializes OpenTelemetry for the given service name.
// Call the returned Provider.Shutdown in a deferred function at main() exit.
func Init(ctx context.Context, serviceName string) (*Provider, error) {
	env := os.Getenv("OTEL_ENVIRONMENT")
	if env == "" {
		env = "development"
	}
	version := os.Getenv("SERVICE_VERSION")
	if version == "" {
		version = "1.0.0"
	}

	// Build resource with standard semantic conventions
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(version),
			attribute.String("deployment.environment", env),
			attribute.String("service.namespace", "og-rmm"),
		),
		resource.WithHost(),
		resource.WithProcess(),
	)
	if err != nil {
		return nil, fmt.Errorf("otel: create resource: %w", err)
	}

	// Configure sampling rate
	sampleRate := 1.0
	if env == "production" {
		sampleRate = 0.1
	}
	if sr := os.Getenv("OTEL_SAMPLE_RATE"); sr != "" {
		if v, err := strconv.ParseFloat(sr, 64); err == nil {
			sampleRate = v
		}
	}

	// Initialize trace provider
	tp, err := initTracer(ctx, res, sampleRate)
	if err != nil {
		return nil, err
	}
	otel.SetTracerProvider(tp)

	// Initialize metrics provider with Prometheus exporter
	mp, err := initMetrics(res)
	if err != nil {
		tp.Shutdown(ctx) //nolint:errcheck
		return nil, err
	}
	otel.SetMeterProvider(mp)

	shutdown := func(ctx context.Context) error {
		ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		var errs []error
		if err := tp.Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("tracer shutdown: %w", err))
		}
		if err := mp.Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("meter shutdown: %w", err))
		}
		if len(errs) > 0 {
			return fmt.Errorf("otel shutdown errors: %v", errs)
		}
		return nil
	}

	return &Provider{
		TracerProvider: tp,
		MeterProvider:  mp,
		Shutdown:       shutdown,
	}, nil
}

// initTracer sets up the OTLP gRPC trace exporter.
func initTracer(ctx context.Context, res *resource.Resource, sampleRate float64) (*sdktrace.TracerProvider, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "otel-collector:4317"
	}

	conn, err := grpc.DialContext(ctx, endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(5*time.Second),
	)
	if err != nil {
		// Fall back to no-op exporter if collector is unavailable
		fmt.Printf("[OTel] WARNING: OTLP endpoint %s unreachable, using no-op exporter: %v\n", endpoint, err)
		return sdktrace.NewTracerProvider(
			sdktrace.WithResource(res),
			sdktrace.WithSampler(sdktrace.TraceIDRatioBased(sampleRate)),
		), nil
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("otel: create OTLP exporter: %w", err)
	}

	return sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(sampleRate)),
	), nil
}

// initMetrics sets up the Prometheus metrics exporter.
func initMetrics(res *resource.Resource) (*sdkmetric.MeterProvider, error) {
	exporter, err := prometheus.New()
	if err != nil {
		return nil, fmt.Errorf("otel: create Prometheus exporter: %w", err)
	}
	return sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(exporter),
	), nil
}

// Tracer returns a named tracer from the global provider.
func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}

// Meter returns a named meter from the global provider.
func Meter(name string) metric.Meter {
	return otel.Meter(name)
}

// SpanFromContext extracts the current span from a context.
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddSpanAttributes adds key-value attributes to the current span.
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	trace.SpanFromContext(ctx).SetAttributes(attrs...)
}

// RecordError records an error on the current span.
func RecordError(ctx context.Context, err error) {
	if err != nil {
		trace.SpanFromContext(ctx).RecordError(err)
	}
}
