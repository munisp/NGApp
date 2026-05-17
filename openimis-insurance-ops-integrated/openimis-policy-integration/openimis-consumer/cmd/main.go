package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"

	"github.com/openimis/openimis-consumer/configs"
	"github.com/openimis/openimis-consumer/pkg/actuarial"
)

var log = logrus.New()

func init() {
	log.SetFormatter(&logrus.JSONFormatter{})
	log.SetOutput(os.Stdout)
	log.SetLevel(logrus.DebugLevel)
}

func main() {
	// Load configuration
	cfg, err := configs.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize Actuarial Model Updater (with mock DB)
	updaterLog := log.WithField("component", "actuarial-updater")
	updater, err := actuarial.NewActuarialModelUpdater(cfg.DBConnStr, updaterLog)
	if err != nil {
		updaterLog.Fatalf("Failed to initialize Actuarial Model Updater: %v", err)
	}
	defer updater.Close()

	// Initialize Kafka Consumer
	consumerLog := log.WithField("component", "kafka-consumer")
	consumer, err := actuarial.NewPolicyEventConsumer(cfg.KafkaBroker, cfg.KafkaGroup, cfg.KafkaTopic, updater, consumerLog)
	if err != nil {
		consumerLog.Fatalf("Failed to initialize Kafka consumer: %v", err)
	}
	defer consumer.Close()

	// Start Prometheus metrics server
	go startMetricsServer(cfg.MetricsPort)

	// Start consuming events
	ctx, cancel := context.WithCancel(context.Background())
	go consumer.StartConsuming(ctx)

	// Graceful shutdown
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)
	<-sigterm

	log.Info("Shutting down gracefully...")
	cancel()
	time.Sleep(2 * time.Second) // Give time for goroutines to finish
	log.Info("Shutdown complete.")
}

func startMetricsServer(port string) {
	http.Handle("/metrics", promhttp.Handler())
	log.Infof("Starting metrics server on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Could not start metrics server: %v", err)
	}
}
