module mfa-service

go 1.21

require (
	github.com/gorilla/mux v1.8.0
	github.com/pquerna/otp v1.4.0
	go.opentelemetry.io/otel v1.26.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.26.0
	go.opentelemetry.io/otel/sdk v1.26.0
	go.opentelemetry.io/otel/semconv/v1.26.0 v1.26.0
	go.opentelemetry.io/otel/trace v1.26.0
	golang.org/x/time v0.5.0
)

require (
	github.com/boombuler/barcode v1.0.1-0.20190219062509-6c824513bacc // indirect
)
