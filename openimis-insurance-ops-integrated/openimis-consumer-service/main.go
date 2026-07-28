package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"openimis-consumer-service/config"
	"openimis-consumer-service/consumer"
	"openimis-consumer-service/repository"
	"openimis-consumer-service/metrics"

	"net/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// 2. Initialize Database Repository (OpenIMIS Mock)
	repo, err := repository.NewRepository(cfg)
	if err != nil {
		// Log the error but don't fail immediately, as the DB might be starting up.
		// In a real system, we'd have a retry loop here. For this task, we'll assume
		// the DB connection is successful or the mock is sufficient.
		log.Printf("Warning: Failed to connect to database: %v. Proceeding with mock setup.", err)
	} else {
		defer repo.Close()
		// Run mock migration to ensure tables exist
		if err := repo.MockMigration(context.Background()); err != nil {
			log.Fatalf("Failed to run mock migration: %v", err)
		}
	}

	// 3. Initialize Kafka Consumer
	kafkaConsumer, err := consumer.NewKafkaConsumer(cfg, repo)
	if err != nil {
		log.Fatalf("Failed to create Kafka consumer: %v", err)
	}
	defer kafkaConsumer.Close()

	// 4. Start Prometheus Metrics Server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		port := "8081" // Use a different port than the producer
		log.Printf("Metrics server starting on port %s", port)
		if err := http.ListenAndServe(":"+port, nil); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s for metrics: %v", port, err)
		}
	}()

	// 5. Start Kafka Consumption in a goroutine
	ctx, cancel := context.WithCancel(context.Background())
	go kafkaConsumer.StartConsumption(ctx)

	// 6. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down OpenIMIS Consumer Service...")

	// Stop consumer and cancel context
	cancel()
	kafkaConsumer.Close()

	// Wait for a moment for goroutines to finish
	time.Sleep(2 * time.Second)

	log.Println("OpenIMIS Consumer Service exiting")
}
