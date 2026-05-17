package main

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"github.com/google/uuid"

	"github.com/openimis/policy-producer/configs"
	"github.com/openimis/policy-producer/pkg/events"
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

	// Initialize Kafka Producer
	producerLog := log.WithField("component", "kafka-producer")
	producer, err := events.NewPolicyEventProducer(cfg.KafkaBroker, cfg.KafkaTopic, producerLog)
	if err != nil {
		producerLog.Fatalf("Failed to initialize Kafka producer: %v", err)
	}
	defer producer.Close()

	// Start Prometheus metrics server
	go startMetricsServer(cfg.MetricsPort)

	// Start mock event generation loop
	ctx, cancel := context.WithCancel(context.Background())
	go mockEventGenerator(ctx, producer)

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

func mockEventGenerator(ctx context.Context, producer *events.PolicyEventProducer) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	policyIDs := []string{"POL-001", "POL-002", "POL-003", "POL-004", "POL-005"}
	eventTypes := []events.PolicyEventType{events.PolicyEventTypeCREATED, events.PolicyEventTypeRENEWED, events.PolicyEventTypeCANCELLED, events.PolicyEventTypeLAPSED}

	for {
		select {
		case <-ctx.Done():
			log.Info("Mock event generator stopped.")
			return
		case <-ticker.C:
			// Generate a mock event
			policyID := policyIDs[rand.Intn(len(policyIDs))]
			eventType := eventTypes[rand.Intn(len(eventTypes))]
			
			// Mock Policy Data
			premium := rand.Float64() * 1000
			
			event := events.PolicyEvent{
				EventID:   uuid.New().String(),
				Timestamp: time.Now().UnixMilli(),
				EventType: eventType,
				PolicyID:  policyID,
				PolicyData: events.PolicyData{
					HolderID:       fmt.Sprintf("HOLDER-%d", rand.Intn(1000)),
					StartDate:      time.Now().Format("2006-01-02"),
					EndDate:        time.Now().AddDate(1, 0, 0).Format("2006-01-02"),
					PremiumAmount:  premium,
					// ActuarialMetadata will be enriched by the producer
				},
			}

			// Add trace ID to context
			traceCtx := context.WithValue(ctx, "trace_id", uuid.New().String())

			if err := producer.Produce(traceCtx, event); err != nil {
				log.Errorf("Failed to produce event: %v", err)
			}
		}
	}
}
