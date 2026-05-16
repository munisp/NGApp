package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// KafkaMessagesProcessed counts the number of messages successfully processed.
	KafkaMessagesProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_consumer_messages_processed_total",
		Help: "Total number of Kafka messages successfully processed.",
	}, []string{"topic"})

	// KafkaProcessingErrors counts the number of errors during message processing.
	KafkaProcessingErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_consumer_processing_errors_total",
		Help: "Total number of errors during Kafka message processing (e.g., deserialization, business logic).",
	}, []string{"error_type"})

	// DBErrors counts the number of database operation errors.
	DBErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "db_operation_errors_total",
		Help: "Total number of database operation errors.",
	}, []string{"operation"})
)
