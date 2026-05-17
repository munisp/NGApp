package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"actuarial-lake-service/pkg/iceberg"
	"actuarial-lake-service/pkg/metrics"

	"github.com/dapr/go-sdk/service/common"
	"go.uber.org/zap"
)

// PremiumCalculatedEvent represents the structure of the Kafka event payload
type PremiumCalculatedEvent struct {
	PolicyID       string  `json:"policy_id"`
	ProductID      int     `json:"product_id"`
	CalculationDate string `json:"calculation_date"`
	PremiumAmount  float64 `json:"premium_amount"`
	RiskScore      float64 `json:"risk_score"`
}

// PremiumCalculatedHandler returns a Dapr TopicEventHandler function
func PremiumCalculatedHandler(logger *zap.Logger, ic *iceberg.Client) common.TopicEventHandler {
	return func(ctx context.Context, e *common.TopicEvent) (retry bool, err error) {
		metrics.IngestionCounter.WithLabelValues("kafka_premium").Inc()
		logger.Info("received Kafka event",
			zap.String("pubsub", e.PubsubName),
			zap.String("topic", e.Topic),
			zap.String("trace_id", e.TraceID),
		)

		var event PremiumCalculatedEvent
		if err := json.Unmarshal(e.Data, &event); err != nil {
			logger.Error("failed to unmarshal event data", zap.Error(err))
			// Do not retry on unmarshal error, as it's likely a permanent data format issue
			return false, fmt.Errorf("failed to unmarshal event: %w", err)
		}

		logger.Info("processing premium calculated event",
			zap.String("policy_id", event.PolicyID),
			zap.Float64("premium_amount", event.PremiumAmount),
		)

		// In a real scenario, we would call the Iceberg client to ingest the data
		// err = ic.IngestPremiumCalculation(ctx, event)
		// if err != nil {
		// 	logger.Error("failed to ingest data into Iceberg", zap.Error(err))
		// 	// Retry on ingestion failure (e.g., transient network error)
		// 	return true, fmt.Errorf("failed to ingest data: %w", err)
		// }

		logger.Info("successfully processed and simulated ingestion of premium event")
		return false, nil // Success, do not retry
	}
}
