package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/client"
	"openimis-insurance-integration/internal/events"
	"openimis-insurance-integration/internal/metrics"
	"openimis-insurance-integration/internal/temporal"
	"openimis-insurance-integration/pkg/config"
)

const (
	ConsumerGroupID = "underwriting-service-group"
)

func init() {
	// Set up logging
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetOutput(os.Stdout)
	logrus.SetLevel(logrus.InfoLevel)
}

func main() {
	cfg := config.LoadConfig()
	if level, err := logrus.ParseLevel(cfg.LogLevel); err == nil {
		logrus.SetLevel(level)
	}

	log := logrus.WithField("component", "UnderwritingConsumer")
	log.Infof("Starting Underwriting Service Kafka Consumer. Temporal Host: %s", cfg.TemporalHostPort)

	// Initialize Metrics
	metrics := metrics.NewMetrics("underwriting_consumer")
	metrics.StartMetricsServer(":9093", log.WithField("service", "metrics"))

	// 1. Initialize Temporal Client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHostPort,
		Namespace: cfg.TemporalNamespace,
		Logger:    temporal.NewTemporalLogger(log),
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer temporalClient.Close()

	// 2. Define topics to subscribe to
	topics := []string{
		cfg.KafkaTopicPrefix + string(events.ProductConfigUpdate),
		cfg.KafkaTopicPrefix + string(events.LossRatioAlert),
	}

	// 3. Initialize Kafka Consumer
	consumer, err := events.NewConsumer(cfg, ConsumerGroupID, topics, temporalClient, metrics)
	if err != nil {
		log.Fatalf("Failed to initialize Kafka consumer: %v", err)
	}
	defer consumer.Close()

	// 4. Start consumption loop
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigchan
		log.Info("Received shutdown signal, stopping consumer...")
		cancel()
	}()

	if err := consumer.StartConsumption(ctx); err != nil {
		log.Fatalf("Kafka consumption failed: %v", err)
	}

	log.Info("Underwriting Service Kafka Consumer stopped.")
}
