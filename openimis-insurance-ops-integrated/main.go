package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openimis/actuarial-data-transformer/config"
	"github.com/openimis/actuarial-data-transformer/pkg/aggregator"
	"github.com/openimis/actuarial-data-transformer/pkg/kafka"
	"github.com/openimis/actuarial-data-transformer/pkg/logging"
	"github.com/openimis/actuarial-data-transformer/pkg/metrics"
	"github.com/openimis/actuarial-data-transformer/pkg/models"
	"github.com/openimis/actuarial-data-transformer/pkg/transformer"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// Service encapsulates the main application logic.
type Service struct {
	cfg *config.Config
	log *logrus.Entry
	metrics *metrics.Metrics
	consumer *kafka.Consumer
	producer *kafka.Producer
	transformer *transformer.Transformer
	aggregator *aggregator.Aggregator
}

// NewService creates a new Service instance.
func NewService(cfg *config.Config) (*Service, error) {
	// 1. Initialize Logging
	logging.SetLevel(cfg.LogLevel)
	log := logging.Logger.WithField("service", cfg.ServiceName)

	// 2. Initialize Metrics
	m := metrics.NewMetrics()

	// 3. Initialize Components
	consumer := kafka.NewConsumer(cfg)
	producer := kafka.NewProducer(cfg)
	enrichmentClient := transformer.NewHTTPEnrichmentClient(cfg.Data.EnrichmentAPIURL)
	trans := transformer.NewTransformer(cfg, enrichmentClient)
	agg := aggregator.NewAggregator(cfg)

	return &Service{
		cfg: cfg,
		log: log,
		metrics: m,
		consumer: consumer,
		producer: producer,
		transformer: trans,
		aggregator: agg,
	}, nil
}

// Run starts the main processing loop and the metrics server.
func (s *Service) Run(ctx context.Context) error {
	s.log.Infof("Starting %s service...", s.cfg.ServiceName)

	// Start Prometheus metrics server
	go s.startMetricsServer()

	// Main processing loop
	for {
		select {
		case <-ctx.Done():
			s.log.Info("Context cancelled, shutting down processing loop.")
			return nil
		default:
			// Use a separate context for the Kafka read operation with a timeout
			readCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			event, err := s.consumer.ReadMessage(readCtx)
			cancel() // Always call cancel to avoid context leak

			if err == context.DeadlineExceeded {
				// Expected when no message is available within the timeout
				continue
			}
			if err != nil {
				s.log.WithError(err).Error("Error reading message from Kafka")
				s.metrics.ClaimsFailedCounter.WithLabelValues("kafka_read_error").Inc()
				// Implement retry logic/circuit breaker here if needed, for now, continue
				time.Sleep(1 * time.Second)
				continue
			}

			// Process the event
			s.processEvent(ctx, event)
		}
	}
}

// processEvent handles the transformation and aggregation of a single claim event.
func (s *Service) processEvent(ctx context.Context, event *models.ClaimEvent) {
	// 1. Transformation (Data Quality, Enrichment, Late Data Check)
	start := time.Now()
	enriched, err := s.transformer.Transform(ctx, *event)
	s.metrics.EnrichmentLatency.Observe(time.Since(start).Seconds())

	if err != nil {
		s.log.WithFields(logrus.Fields{
			"claim_id": event.ClaimID,
			"trace_id": event.ClaimID, // Using ClaimID as a simple trace ID for this example
		}).WithError(err).Error("Transformation failed")
		s.metrics.ClaimsFailedCounter.WithLabelValues("transformation_error").Inc()
		return
	}

	// Update metrics based on transformation result
	s.metrics.ClaimsProcessedCounter.WithLabelValues("success", enriched.Region).Inc()
	s.metrics.DataQualityGauge.Set(enriched.DataQualityScore)
	if enriched.IsLate {
		s.metrics.LateDataCounter.Inc()
		s.log.WithField("claim_id", enriched.ClaimID).Warn("Detected late-arriving data")
	}

	// 2. Aggregation
	start = time.Now()
	aggregations := s.aggregator.ProcessClaim(enriched)
	s.metrics.AggregationLatency.Observe(time.Since(start).Seconds())

	// 3. Produce Aggregations to Kafka
	for _, agg := range aggregations {
		if err := s.producer.ProduceAggregation(ctx, agg); err != nil {
			s.log.WithFields(logrus.Fields{
				"key": agg.AggregationKey,
				"trace_id": enriched.ClaimID,
			}).WithError(err).Error("Failed to produce aggregation to Kafka")
			// Circuit breaker logic could trip here
		}
	}
}

// startMetricsServer runs a simple HTTP server for Prometheus metrics.
func (s *Service) startMetricsServer() {
	http.Handle("/metrics", promhttp.Handler())
	s.log.Info("Metrics server listening on :8080/metrics")
	if err := http.ListenAndServe(":8080", nil); err != nil && err != http.ErrServerClosed {
		s.log.Fatalf("Could not start metrics server: %v", err)
	}
}

// Close gracefully closes all resources.
func (s *Service) Close() {
	s.log.Info("Closing Kafka consumer and producer...")
	if err := s.consumer.Close(); err != nil {
		s.log.WithError(err).Error("Error closing Kafka consumer")
	}
	if err := s.producer.Close(); err != nil {
		s.log.WithError(err).Error("Error closing Kafka producer")
	}
	s.log.Info("Service resources closed.")
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		logrus.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize service
	svc, err := NewService(cfg)
	if err != nil {
		logrus.Fatalf("Failed to initialize service: %v", err)
	}
	defer svc.Close()

	// Setup context and signal handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		svc.log.Infof("Received signal %v, initiating graceful shutdown...", sig)
		cancel()
	}()

	// Run the service
	if err := svc.Run(ctx); err != nil {
		svc.log.Fatalf("Service stopped with error: %v", err)
	}

	svc.log.Info("Service shut down gracefully.")
}
