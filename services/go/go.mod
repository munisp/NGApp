module github.com/munisp/NGApp/services/go

go 1.22

require (
	github.com/confluentinc/confluent-kafka-go/v2 v2.6.1
	github.com/gorilla/websocket v1.5.3
	github.com/jackc/pgx/v5 v5.7.2
	github.com/prometheus/client_golang v1.20.5
	github.com/redis/go-redis/v9 v9.7.0
	go.opentelemetry.io/otel v1.32.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.32.0
	go.opentelemetry.io/otel/sdk v1.32.0
	go.uber.org/zap v1.27.0
	google.golang.org/grpc v1.69.2
	google.golang.org/protobuf v1.36.1
)
