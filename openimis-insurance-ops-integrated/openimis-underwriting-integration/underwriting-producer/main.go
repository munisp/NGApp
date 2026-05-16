package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"underwriting-producer/config"
	"underwriting-producer/pkg/producer"
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
	log := logrus.WithField("service", "underwriting-producer")

	// 1. Initialize Kafka Producer
	kp, err := producer.NewProducer(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize Kafka Producer: %v", err)
	}
	defer kp.Close()

	// 2. Initialize Mock Underwriting Service
	mockService := producer.NewMockUnderwritingService(kp)

	// 3. Start event generation loop
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Info("Event generation stopped")
				return
			case <-ticker.C:
				// Simulate a new underwriting case every 5 seconds
				mockService.ProcessCase(ctx, "POL-"+time.Now().Format("20060102-150405"))
			}
		}
	}()

	// 4. Handle graceful shutdown
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)
	<-sigterm

	log.Info("Shutting down gracefully...")
	cancel() // Stop the event generation loop

	// Wait for any remaining messages to be delivered (optional, but good practice)
	remaining := kp.kp.Flush(5000)
	log.Infof("Producer flushed. %d messages still in queue.", remaining)
}
