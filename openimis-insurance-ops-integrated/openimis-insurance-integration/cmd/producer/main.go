package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"openimis-insurance-integration/internal/events"
	"openimis-insurance-integration/internal/metrics"
	"openimis-insurance-integration/pkg/config"
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

	log := logrus.WithField("component", "OpenIMIS-Mock-Producer")
	log.Infof("Starting OpenIMIS Mock Producer with config: %+v", cfg)

	// Initialize Metrics
	metrics := metrics.NewMetrics("openimis_producer")
	metrics.StartMetricsServer(":9090", log.WithField("service", "metrics"))

	producer, err := events.NewProducer(cfg, metrics)
	if err != nil {
		log.Fatalf("Failed to initialize Kafka producer: %v", err)
	}
	defer producer.Close()

	// Start delivery report handler in a goroutine
	go producer.DeliveryReportHandler()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigchan
		log.Info("Received shutdown signal, stopping producer...")
		cancel()
	}()

	// Start event generation loop
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info("Producer stopped.")
			return
		case <-ticker.C:
			if err := generateAndProduceEvent(ctx, producer); err != nil {
				log.WithError(err).Error("Failed to generate and produce event")
			}
		}
	}
}

func generateAndProduceEvent(ctx context.Context, producer *events.Producer) error {
	eventTypes := []events.EventType{
		events.PremiumAdjustment,
		events.ReserveAdjustment,
		events.ProductConfigUpdate,
		events.LossRatioAlert,
	}
	eventType := eventTypes[rand.Intn(len(eventTypes))]
	eventID := fmt.Sprintf("event-%d", time.Now().UnixNano())

	var payload interface{}
	switch eventType {
	case events.PremiumAdjustment:
		payload = events.PremiumAdjustmentPayload{
			PolicyID:         fmt.Sprintf("POL-%d", rand.Intn(10000)),
			AdjustmentAmount: float64(rand.Intn(10000)) / 100.0,
			Reason:           "Actuarial review",
		}
	case events.ReserveAdjustment:
		reserveTypes := []string{"IBNR", "CaseReserve", "UnearnedPremium"}
		payload = events.ReserveAdjustmentPayload{
			PolicyID:         fmt.Sprintf("POL-%d", rand.Intn(10000)),
			ReserveType:      reserveTypes[rand.Intn(len(reserveTypes))],
			AdjustmentAmount: float64(rand.Intn(50000)) / 100.0,
		}
	case events.ProductConfigUpdate:
		fields := []string{"PremiumRate", "Deductible", "CoverageLimit"}
		payload = events.ProductConfigUpdatePayload{
			ProductID: fmt.Sprintf("PROD-%d", rand.Intn(100)),
			Field:     fields[rand.Intn(len(fields))],
			OldValue:  fmt.Sprintf("%v", rand.Intn(100)),
			NewValue:  fmt.Sprintf("%v", rand.Intn(100)),
		}
	case events.LossRatioAlert:
		alertLevels := []string{"Warning", "Critical"}
		payload = events.LossRatioAlertPayload{
			ProductID:        fmt.Sprintf("PROD-%d", rand.Intn(100)),
			CurrentLossRatio: float64(rand.Intn(150)) / 100.0,
			Threshold:        1.0,
			AlertLevel:       alertLevels[rand.Intn(len(alertLevels))],
		}
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	event := events.ActuarialEvent{
		EventID:   eventID,
		EventType: eventType,
		Payload:   payloadBytes,
	}

	return producer.ProduceEvent(ctx, event)
}
