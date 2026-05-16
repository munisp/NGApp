package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	dapr "github.com/dapr/go-sdk/client"
	"github.com/dapr/go-sdk/service/common"
	daprd "github.com/dapr/go-sdk/service/http"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	appPort        = "8081"
	daprPubsubName = "pubsub"
	topicClaims    = "claim_submitted"
	secretStore    = "secretstore"
	secretKey      = "api-key"
)

var (
	logger log.Logger

	// Prometheus Metrics
	claimsProcessed = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "insurance_ops_claims_processed_total",
			Help: "Total number of claims processed.",
		},
	)
	premiumCalculations = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "insurance_ops_premium_calculations_total",
			Help: "Total number of premium calculations performed.",
		},
	)
)

func init() {
	// Structured Logging setup
	logger = log.NewJSONLogger(log.NewSyncWriter(os.Stderr))
	logger = log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)

	// Prometheus registration
	prometheus.MustRegister(claimsProcessed)
	prometheus.MustRegister(premiumCalculations)
}

// ClaimEvent represents the data structure for a claim submission event
type ClaimEvent struct {
	ClaimID string `json:"claimId"`
	Scheme  string `json:"scheme"`
	Amount  float64 `json:"amount"`
}

// Service Invocation Handler: Calculate Premium
func calculatePremiumHandler(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	premiumCalculations.Inc()
	
	// 1. Dapr Secrets Management
	// Retrieve a mock external API key from the secret store
	daprClient, err := dapr.NewClient()
	if err != nil {
		level.Error(logger).Log("msg", "Failed to create Dapr client for secret retrieval", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer daprClient.Close()

	secret, err := daprClient.GetSecret(ctx, secretStore, secretKey, nil)
	if err != nil {
		level.Error(logger).Log("msg", "Failed to retrieve secret", "error", err, "secret_store", secretStore, "secret_key", secretKey)
		http.Error(w, "Internal Server Error: Could not retrieve API key", http.StatusInternalServerError)
		return
	}
	
	apiKey := secret[secretKey]
	level.Info(logger).Log("msg", "Successfully retrieved API key", "api_key_length", len(apiKey))

	// Mock business logic for premium calculation
	var reqBody map[string]string
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	schemeID := reqBody["schemeId"]

	var premium float64
	switch schemeID {
	case "SCHEME_A":
		premium = 100.50
	case "SCHEME_B":
		premium = 250.75
	default:
		premium = 50.00
	}

	// Simulate external API call using the retrieved secret
	level.Info(logger).Log("msg", "Calculating premium using external API", "scheme_id", schemeID, "premium", premium)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"schemeId": schemeID,
		"premium":  premium,
		"status":   "calculated",
	})
}

// Pub/Sub Subscriber Handler: Process Claim
func processClaimHandler(ctx context.Context, e *common.TopicEvent) (retry bool, err error) {
	claimsProcessed.Inc()
	
	var event ClaimEvent
	if err := json.Unmarshal(e.Data, &event); err != nil {
		level.Error(logger).Log("msg", "Failed to unmarshal claim event", "error", err, "topic", e.Topic)
		// Do not retry on unmarshal error, as it's likely a permanent data issue
		return false, err
	}

	// Mock business logic for claim processing
	level.Info(logger).Log("msg", "Processing claim event", "claim_id", event.ClaimID, "scheme", event.Scheme, "amount", event.Amount)
	
	// Simulate a transient error to test Dapr resiliency (retry policy)
	if time.Now().Second()%10 == 0 {
		level.Error(logger).Log("msg", "Simulating transient error for claim processing", "claim_id", event.ClaimID)
		// Return true to signal Dapr to retry the message based on the resiliency policy
		return true, fmt.Errorf("simulated transient error for claim %s", event.ClaimID)
	}

	// Successful processing
	level.Info(logger).Log("msg", "Claim processed successfully", "claim_id", event.ClaimID)
	return false, nil
}

func main() {
	level.Info(logger).Log("msg", "Starting Insurance Operations Service")

	// Create Dapr service
	s := daprd.NewService(":" + appPort)

	// Register Dapr Pub/Sub Subscription
	if err := s.AddTopicEventHandler(&common.Subscription{
		PubsubName: daprPubsubName,
		Topic:      topicClaims,
		Route:      "/process-claim",
	}, processClaimHandler); err != nil {
		level.Error(logger).Log("msg", "Failed to add topic handler", "error", err)
		os.Exit(1)
	}

	// Register Dapr Service Invocation Handler
	if err := s.AddServiceInvocationHandler("/calculate-premium", calculatePremiumHandler); err != nil {
		level.Error(logger).Log("msg", "Failed to add service invocation handler", "error", err)
		os.Exit(1)
	}

	// Add Prometheus Metrics Endpoint
	http.Handle("/metrics", promhttp.Handler())
	
	// Health Check Endpoint
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Start the Dapr service
	level.Info(logger).Log("msg", "Server listening", "port", appPort)
	if err := s.Start(); err != nil && err != http.ErrServerClosed {
		level.Error(logger).Log("msg", "Server failed to start", "error", err)
		os.Exit(1)
	}
}
