package observability

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// OTelConfig holds OpenTelemetry configuration
type OTelConfig struct {
	ServiceName    string
	ServiceVersion string
	Environment    string
	OTLPEndpoint   string
}

// OTelProvider holds OpenTelemetry providers
type OTelProvider struct {
	TracerProvider *sdktrace.TracerProvider
	MeterProvider  *sdkmetric.MeterProvider
	Tracer         trace.Tracer
	Meter          metric.Meter
}

// PaymentOTelMetrics holds OpenTelemetry metrics for payment switch
type PaymentOTelMetrics struct {
	TransactionCounter    metric.Int64Counter
	TransactionDuration   metric.Float64Histogram
	TransactionInFlight   metric.Int64UpDownCounter
	CurrentTPS            metric.Float64Gauge
	ParticipantLatency    metric.Float64Histogram
	FraudAlertsOpen       metric.Int64UpDownCounter
	SettlementsPending    metric.Int64UpDownCounter
	KafkaConsumerLag      metric.Int64Gauge
	DeltaLakeWriteLatency metric.Float64Histogram
}

// InitOpenTelemetry initializes OpenTelemetry with OTLP exporters
func InitOpenTelemetry(ctx context.Context, cfg OTelConfig) (*OTelProvider, error) {
	if cfg.OTLPEndpoint == "" {
		cfg.OTLPEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
		if cfg.OTLPEndpoint == "" {
			cfg.OTLPEndpoint = "otel-collector:4317"
		}
	}

	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
			attribute.String("environment", cfg.Environment),
			attribute.String("platform", "payment-switch"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace exporter
	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Create tracer provider
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Create metric exporter
	metricExporter, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(cfg.OTLPEndpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create metric exporter: %w", err)
	}

	// Create meter provider
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(10*time.Second))),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(meterProvider)

	return &OTelProvider{
		TracerProvider: tracerProvider,
		MeterProvider:  meterProvider,
		Tracer:         tracerProvider.Tracer(cfg.ServiceName),
		Meter:          meterProvider.Meter(cfg.ServiceName),
	}, nil
}

// Shutdown gracefully shuts down OpenTelemetry providers
func (p *OTelProvider) Shutdown(ctx context.Context) error {
	if err := p.TracerProvider.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown tracer provider: %w", err)
	}
	if err := p.MeterProvider.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown meter provider: %w", err)
	}
	return nil
}

// InitPaymentMetrics initializes payment-specific OpenTelemetry metrics
func InitPaymentMetrics(meter metric.Meter) (*PaymentOTelMetrics, error) {
	transactionCounter, err := meter.Int64Counter(
		"payment_switch.transactions.total",
		metric.WithDescription("Total number of transactions processed"),
		metric.WithUnit("{transaction}"),
	)
	if err != nil {
		return nil, err
	}

	transactionDuration, err := meter.Float64Histogram(
		"payment_switch.transactions.duration",
		metric.WithDescription("Transaction processing duration"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	transactionInFlight, err := meter.Int64UpDownCounter(
		"payment_switch.transactions.in_flight",
		metric.WithDescription("Number of transactions currently being processed"),
		metric.WithUnit("{transaction}"),
	)
	if err != nil {
		return nil, err
	}

	participantLatency, err := meter.Float64Histogram(
		"payment_switch.participant.latency",
		metric.WithDescription("Participant response latency"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	fraudAlertsOpen, err := meter.Int64UpDownCounter(
		"payment_switch.fraud.alerts_open",
		metric.WithDescription("Number of open fraud alerts"),
		metric.WithUnit("{alert}"),
	)
	if err != nil {
		return nil, err
	}

	settlementsPending, err := meter.Int64UpDownCounter(
		"payment_switch.settlements.pending",
		metric.WithDescription("Number of pending settlements"),
		metric.WithUnit("{settlement}"),
	)
	if err != nil {
		return nil, err
	}

	deltaLakeWriteLatency, err := meter.Float64Histogram(
		"payment_switch.delta_lake.write_latency",
		metric.WithDescription("Delta Lake write latency"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	return &PaymentOTelMetrics{
		TransactionCounter:    transactionCounter,
		TransactionDuration:   transactionDuration,
		TransactionInFlight:   transactionInFlight,
		ParticipantLatency:    participantLatency,
		FraudAlertsOpen:       fraudAlertsOpen,
		SettlementsPending:    settlementsPending,
		DeltaLakeWriteLatency: deltaLakeWriteLatency,
	}, nil
}

// RecordTransaction records a transaction with OpenTelemetry
func (m *PaymentOTelMetrics) RecordTransaction(ctx context.Context, status, txType, currency, payer, payee string, duration time.Duration, amount float64) {
	attrs := []attribute.KeyValue{
		attribute.String("status", status),
		attribute.String("type", txType),
		attribute.String("currency", currency),
		attribute.String("payer", payer),
		attribute.String("payee", payee),
	}
	m.TransactionCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
	m.TransactionDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordParticipantLatency records participant latency with OpenTelemetry
func (m *PaymentOTelMetrics) RecordParticipantLatency(ctx context.Context, participantID string, latency time.Duration) {
	m.ParticipantLatency.Record(ctx, latency.Seconds(), metric.WithAttributes(
		attribute.String("participant_id", participantID),
	))
}

// RecordDeltaLakeWrite records Delta Lake write latency
func (m *PaymentOTelMetrics) RecordDeltaLakeWrite(ctx context.Context, table, layer string, latency time.Duration) {
	m.DeltaLakeWriteLatency.Record(ctx, latency.Seconds(), metric.WithAttributes(
		attribute.String("table", table),
		attribute.String("layer", layer),
	))
}

// StartTransactionSpan starts a new span for a transaction
func StartTransactionSpan(ctx context.Context, tracer trace.Tracer, transactionID, txType string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "process_transaction",
		trace.WithAttributes(
			attribute.String("transaction.id", transactionID),
			attribute.String("transaction.type", txType),
		),
		trace.WithSpanKind(trace.SpanKindServer),
	)
}

// AddTransactionAttributes adds transaction attributes to a span
func AddTransactionAttributes(span trace.Span, payer, payee, currency string, amount float64) {
	span.SetAttributes(
		attribute.String("transaction.payer", payer),
		attribute.String("transaction.payee", payee),
		attribute.String("transaction.currency", currency),
		attribute.Float64("transaction.amount", amount),
	)
}

// RecordTransactionError records an error on a transaction span
func RecordTransactionError(span trace.Span, err error) {
	span.RecordError(err)
	span.SetAttributes(attribute.String("transaction.status", "FAILED"))
}

// RecordTransactionSuccess records success on a transaction span
func RecordTransactionSuccess(span trace.Span, latencyMs int64) {
	span.SetAttributes(
		attribute.String("transaction.status", "COMMITTED"),
		attribute.Int64("transaction.latency_ms", latencyMs),
	)
}
