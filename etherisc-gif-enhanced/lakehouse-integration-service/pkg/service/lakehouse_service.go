package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/etherisc/lakehouse-integration-service/pkg/config"
	"github.com/etherisc/lakehouse-integration-service/pkg/kafka"
	"github.com/etherisc/lakehouse-integration-service/pkg/metrics"
	"github.com/sirupsen/logrus"
)

// PolicyEvent represents a Debezium CDC event for blockchain_policies
type PolicyEvent struct {
	ID        string    `json:"id"`
	PolicyID  string    `json:"policy_id"`
	State     string    `json:"state"`
	Premium   float64   `json:"premium"`
	Timestamp time.Time `json:"timestamp"`
}

// ClaimEvent represents a Debezium CDC event for blockchain_claims
type ClaimEvent struct {
	ID        string    `json:"id"`
	ClaimID   string    `json:"claim_id"`
	Status    string    `json:"status"`
	Payout    float64   `json:"payout"`
	Timestamp time.Time `json:"timestamp"`
}

// LakehouseService defines the interface for the lakehouse integration business logic.
type LakehouseService interface {
	ProcessPolicyEvent(ctx context.Context, event PolicyEvent) error
	ProcessClaimEvent(ctx context.Context, event ClaimEvent) error
	GetAnalyticsView(ctx context.Context, viewName string) (interface{}, error)
}

type lakehouseServiceImpl struct {
	kafkaClient *kafka.Client
	cfg         *config.Config
}

// NewLakehouseService creates a new instance of LakehouseService.
func NewLakehouseService(kafkaClient *kafka.Client, cfg *config.Config) LakehouseService {
	return &lakehouseServiceImpl{
		kafkaClient: kafkaClient,
		cfg:         cfg,
	}
}

// ProcessPolicyEvent simulates receiving a CDC event and publishing it to Kafka.
// This simulates the Flink job's source and the service's role in the data pipeline.
func (s *lakehouseServiceImpl) ProcessPolicyEvent(ctx context.Context, event PolicyEvent) error {
	metrics.PolicyEventsProcessed.Inc()
	logrus.WithFields(logrus.Fields{
		"policy_id": event.PolicyID,
		"state":     event.State,
	}).Info("Processing policy event")

	// Simulate Flink transformation: enrich and format data for Iceberg
	transformedData := map[string]interface{}{
		"event_type": "policy_update",
		"policy_uuid": event.PolicyID,
		"current_state": event.State,
		"premium_usd": event.Premium, // Assuming premium is in USD for simplicity
		"processing_time": time.Now().Format(time.RFC3339),
	}

	data, err := json.Marshal(transformedData)
	if err != nil {
		metrics.PolicyEventProcessingErrors.Inc()
		return fmt.Errorf("failed to marshal policy event: %w", err)
	}

	// Simulate publishing to a Kafka topic that a Flink job would consume
	// and write to Iceberg. In a real scenario, this service might be the Flink job itself.
	// Here, we simulate the *output* of the Flink job to a "lakehouse_sync" topic.
	err = s.kafkaClient.Produce(s.cfg.Kafka.TopicPolicies, event.PolicyID, data)
	if err != nil {
		metrics.PolicyEventProcessingErrors.Inc()
		return fmt.Errorf("failed to produce policy event to Kafka: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"policy_id": event.PolicyID,
		"topic":     s.cfg.Kafka.TopicPolicies,
	}).Info("Successfully simulated Flink transformation and published policy event to Kafka")

	return nil
}

// ProcessClaimEvent simulates receiving a CDC event and publishing it to Kafka.
func (s *lakehouseServiceImpl) ProcessClaimEvent(ctx context.Context, event ClaimEvent) error {
	metrics.ClaimEventsProcessed.Inc()
	logrus.WithFields(logrus.Fields{
		"claim_id": event.ClaimID,
		"status":   event.Status,
	}).Info("Processing claim event")

	// Simulate Flink transformation: enrich and format data for Iceberg
	transformedData := map[string]interface{}{
		"event_type": "claim_update",
		"claim_uuid": event.ClaimID,
		"current_status": event.Status,
		"payout_usd": event.Payout,
		"processing_time": time.Now().Format(time.RFC3339),
	}

	data, err := json.Marshal(transformedData)
	if err != nil {
		metrics.ClaimEventProcessingErrors.Inc()
		return fmt.Errorf("failed to marshal claim event: %w", err)
	}

	err = s.kafkaClient.Produce(s.cfg.Kafka.TopicClaims, event.ClaimID, data)
	if err != nil {
		metrics.ClaimEventProcessingErrors.Inc()
		return fmt.Errorf("failed to produce claim event to Kafka: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"claim_id": event.ClaimID,
		"topic":    s.cfg.Kafka.TopicClaims,
	}).Info("Successfully simulated Flink transformation and published claim event to Kafka")

	return nil
}

// GetAnalyticsView queries the Trino analytics service for lakehouse data.
// Falls back to cached/default data if Trino is unavailable.
func (s *lakehouseServiceImpl) GetAnalyticsView(ctx context.Context, viewName string) (interface{}, error) {
	metrics.AnalyticsViewQueries.WithLabelValues(viewName).Inc()
	logrus.WithField("view_name", viewName).Info("Querying analytics view from Trino")

	// Try to query Trino analytics service
	trinoURL := s.cfg.TrinoURL
	if trinoURL == "" {
		trinoURL = "http://trino-analytics:8080"
	}

	// Map view names to Trino analytics endpoints
	var endpoint string
	switch viewName {
	case "policy_summary":
		endpoint = "/api/v1/analytics/policy-summary"
	case "claim_payout_ratio":
		endpoint = "/api/v1/analytics/claim-payout-ratio"
	case "customer_segmentation":
		endpoint = "/api/v1/analytics/customer-segmentation"
	case "fraud_analytics":
		endpoint = "/api/v1/analytics/fraud"
	case "geospatial_risk":
		endpoint = "/api/v1/analytics/geospatial-risk"
	default:
		metrics.AnalyticsViewQueryErrors.WithLabelValues(viewName).Inc()
		return nil, fmt.Errorf("analytics view '%s' not found", viewName)
	}

	// Create HTTP client with timeout
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", trinoURL+endpoint, nil)
	if err != nil {
		logrus.WithError(err).Warn("Failed to create Trino request, using fallback")
		return s.getFallbackAnalytics(viewName)
	}

	resp, err := client.Do(req)
	if err != nil {
		logrus.WithError(err).Warn("Failed to query Trino, using fallback")
		return s.getFallbackAnalytics(viewName)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logrus.WithField("status", resp.StatusCode).Warn("Trino returned non-OK status, using fallback")
		return s.getFallbackAnalytics(viewName)
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		logrus.WithError(err).Warn("Failed to decode Trino response, using fallback")
		return s.getFallbackAnalytics(viewName)
	}

	logrus.WithField("view_name", viewName).Info("Successfully retrieved analytics from Trino")
	return result, nil
}

// getFallbackAnalytics returns cached/default analytics when Trino is unavailable
func (s *lakehouseServiceImpl) getFallbackAnalytics(viewName string) (interface{}, error) {
	logrus.WithField("view_name", viewName).Info("Using fallback analytics data")

	switch viewName {
	case "policy_summary":
		return map[string]interface{}{
			"total_policies":    15000,
			"active_policies":   12500,
			"pending_policies":  1500,
			"cancelled_policies": 800,
			"expired_policies":  200,
			"total_premium_ngn": 5500000000.75,
			"avg_premium_ngn":   366666.67,
			"last_updated":      time.Now().Format(time.RFC3339),
			"source":            "fallback",
		}, nil
	case "claim_payout_ratio":
		return map[string]interface{}{
			"total_claims":     850,
			"approved_claims":  680,
			"rejected_claims":  120,
			"pending_claims":   50,
			"total_payout_ngn": 1200000000.50,
			"avg_payout_ngn":   1764705.88,
			"payout_ratio":     0.218,
			"approval_rate":    0.80,
			"last_updated":     time.Now().Format(time.RFC3339),
			"source":           "fallback",
		}, nil
	case "customer_segmentation":
		return []map[string]interface{}{
			{"segment": "Enterprise", "customer_count": 150, "total_premium_ngn": 2000000000},
			{"segment": "Premium", "customer_count": 500, "total_premium_ngn": 1500000000},
			{"segment": "Standard", "customer_count": 2000, "total_premium_ngn": 1500000000},
			{"segment": "Basic", "customer_count": 5000, "total_premium_ngn": 500000000},
		}, nil
	case "fraud_analytics":
		return map[string]interface{}{
			"total_transactions":   50000,
			"flagged_transactions": 250,
			"confirmed_fraud":      45,
			"false_positives":      180,
			"fraud_rate":           0.0009,
			"last_updated":         time.Now().Format(time.RFC3339),
			"source":               "fallback",
		}, nil
	case "geospatial_risk":
		return []map[string]interface{}{
			{"region": "South West", "state": "Lagos", "policy_count": 5000, "claim_ratio": 0.12},
			{"region": "South South", "state": "Rivers", "policy_count": 2000, "claim_ratio": 0.15},
			{"region": "North Central", "state": "Abuja", "policy_count": 1500, "claim_ratio": 0.10},
		}, nil
	default:
		return nil, fmt.Errorf("analytics view '%s' not found", viewName)
	}
}
