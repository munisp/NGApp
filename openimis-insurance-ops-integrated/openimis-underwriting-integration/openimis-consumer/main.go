package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"openimis-consumer/config"
	"openimis-consumer/pkg/processor"
)

func init() {
	// Set up structured logging
	logrus.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
	})
	logrus.SetOutput(os.Stdout)
	logrus.SetLevel(logrus.InfoLevel)
}

func main() {
	cfg := config.LoadConfig()
	log := logrus.WithField("service", "openimis-consumer")

	// 1. Initialize Event Processor (Risk Model Updater)
	riskUpdater := processor.NewRiskModelUpdater()

	// 2. Initialize Kafka Consumer
	kc, err := processor.NewConsumer(cfg, riskUpdater)
	if err != nil {
		log.Fatalf("Failed to initialize Kafka Consumer: %v", err)
	}
	defer kc.Close()

	// 3. Start consumption loop
	ctx, cancel := context.WithCancel(context.Background())
	go kc.StartConsumption(ctx)

	// 4. Handle graceful shutdown
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)
	<-sigterm

	log.Info("Shutting down gracefully...")
	cancel() // Stop the consumption loop

	// Give the consumer a moment to finish processing the current message
	time.Sleep(2 * time.Second)
}
