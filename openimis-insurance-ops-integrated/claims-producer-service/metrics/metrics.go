package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// KafkaMessagesProduced counts the number of messages successfully produced.
	KafkaMessagesProduced = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_producer_messages_produced_total",
		Help: "Total number of Kafka messages produced.",
	}, []string{"topic"})

	// KafkaProduceErrors counts the number of errors during message production.
	KafkaProduceErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_producer_produce_errors_total",
		Help: "Total number of errors when producing Kafka messages.",
	}, []string{"topic"})

	// KafkaDeliverySuccesses counts the number of successful message deliveries.
	KafkaDeliverySuccesses = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_producer_delivery_successes_total",
		Help: "Total number of successful Kafka message deliveries.",
	}, []string{"topic"})

	// KafkaDeliveryErrors counts the number of failed message deliveries.
	KafkaDeliveryErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_producer_delivery_errors_total",
		Help: "Total number of failed Kafka message deliveries.",
	}, []string{"topic"})

	// HTTPRequestDuration measures the duration of HTTP requests.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name: "http_request_duration_seconds",
		Help: "Duration of HTTP requests.",
		Buckets: prometheus.DefBuckets,
	}, []string{"path", "method", "status"})
)
