package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	dapr "github.com/dapr/go-sdk/client"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	appPort        = "8080"
	daprPubsubName = "pubsub"
	daprStateStore = "statestore"
	topicClaims    = "claim_submitted"
	insuranceAppID = "insurance-ops-service"
)

var (
	logger log.Logger

	// Prometheus Metrics
	claimsSubmitted = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "openimis_claims_submitted_total",
			Help: "Total number of claims submitted.",
		},
	)
	invocationLatency = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "openimis_actuarial_invocation_latency_seconds",
			Help:    "Latency of actuarial data service invocation.",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func init() {
	// Structured Logging setup
	logger = log.NewJSONLogger(log.NewSyncWriter(os.Stderr))
	logger = log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)

	// Prometheus registration
	prometheus.MustRegister(claimsSubmitted)
	prometheus.MustRegister(invocationLatency)
}

// ClaimEvent represents the data structure for a claim submission event
type ClaimEvent struct {
	ClaimID string `json:"claimId"`
	Scheme  string `json:"scheme"`
	Amount  float64 `json:"amount"`
}

// ActuarialData represents the data structure for cached actuarial data
type ActuarialData struct {
	SchemeID string `json:"schemeId"`
	Premium  float64 `json:"premium"`
	LastUpdated time.Time `json:"lastUpdated"`
}

// Service Invocation Handler: Get Premium Calculation
func getPremiumCalculation(daprClient dapr.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		schemeID := vars["schemeId"]
		ctx := r.Context()

		level.Info(logger).Log("msg", "Invoking insurance-ops-service for premium calculation", "scheme_id", schemeID)

		// 1. Dapr Service Invocation
		// The Dapr sidecar handles the service discovery, mTLS, and resiliency policies (retries, circuit breakers)
		// defined in the resiliency.yaml component.
		start := time.Now()
		
		// Mock request body for the invoked service
		reqBody := map[string]string{"schemeId": schemeID}
		reqBodyBytes, _ := json.Marshal(reqBody)

		content := &dapr.DataContent{
			ContentType: "application/json",
			Data:        reqBodyBytes,
		}

		resp, err := daprClient.InvokeMethodWithContent(ctx, insuranceAppID, "calculate-premium", http.MethodPost, content)
		
		invocationLatency.Observe(time.Since(start).Seconds())

		if err != nil {
			level.Error(logger).Log("msg", "Service invocation failed", "error", err, "target_app", insuranceAppID)
			http.Error(w, fmt.Sprintf("Service invocation failed: %v", err), http.StatusInternalServerError)
			return
		}

		// Assuming the response is a JSON object with the calculated premium
		var result map[string]interface{}
		if err := json.Unmarshal(resp, &result); err != nil {
			level.Error(logger).Log("msg", "Failed to unmarshal service invocation response", "error", err)
			http.Error(w, "Failed to process response", http.StatusInternalServerError)
			return
		}

		level.Info(logger).Log("msg", "Successfully received premium calculation", "scheme_id", schemeID, "premium", result["premium"])
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(resp)
	}
}

// Pub/Sub Handler: Submit Claim
func submitClaim(daprClient dapr.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var event ClaimEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		
		event.ClaimID = fmt.Sprintf("CLAIM-%d", time.Now().UnixNano())
		eventBytes, _ := json.Marshal(event)

		// 2. Dapr Pub/Sub Publish
		// The Dapr sidecar handles the message broker interaction and uses the resiliency policy
		// defined in the resiliency.yaml component for the 'pubsub' component.
		ctx := r.Context()
		if err := daprClient.PublishEvent(ctx, daprPubsubName, topicClaims, eventBytes); err != nil {
			level.Error(logger).Log("msg", "Failed to publish claim event", "error", err, "claim_id", event.ClaimID)
			http.Error(w, fmt.Sprintf("Failed to publish event: %v", err), http.StatusInternalServerError)
			return
		}

		claimsSubmitted.Inc()
		level.Info(logger).Log("msg", "Claim event published successfully", "claim_id", event.ClaimID, "topic", topicClaims)
		
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "accepted", "claimId": event.ClaimID})
	}
}

// State Management Handler: Cache Actuarial Data
func cacheActuarialData(daprClient dapr.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data ActuarialData
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		data.LastUpdated = time.Now()
		
		// 3. Dapr State Management Save
		ctx := r.Context()
		item := &dapr.SetStateItem{
			Key:   data.SchemeID,
			Value: data,
			Options: &dapr.StateOptions{
				Concurrency: dapr.StateConcurrencyFirstWrite,
				Consistency: dapr.StateConsistencyStrong,
			},
		}

		if err := daprClient.SaveState(ctx, daprStateStore, item); err != nil {
			level.Error(logger).Log("msg", "Failed to save state", "error", err, "key", data.SchemeID)
			http.Error(w, fmt.Sprintf("Failed to save state: %v", err), http.StatusInternalServerError)
			return
		}

		level.Info(logger).Log("msg", "Actuarial data cached successfully", "scheme_id", data.SchemeID)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "cached", "schemeId": data.SchemeID})
	}
}

// State Management Handler: Get Cached Actuarial Data
func getCachedActuarialData(daprClient dapr.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		schemeID := vars["schemeId"]
		ctx := r.Context()

		// 4. Dapr State Management Get
		item, err := daprClient.GetState(ctx, daprStateStore, schemeID)
		if err != nil {
			level.Error(logger).Log("msg", "Failed to get state", "error", err, "key", schemeID)
			http.Error(w, fmt.Sprintf("Failed to get state: %v", err), http.StatusInternalServerError)
			return
		}

		if item.Value == nil {
			level.Warn(logger).Log("msg", "Actuarial data not found in cache", "scheme_id", schemeID)
			http.Error(w, "Actuarial data not found", http.StatusNotFound)
			return
		}

		var data ActuarialData
		if err := json.Unmarshal(item.Value, &data); err != nil {
			level.Error(logger).Log("msg", "Failed to unmarshal cached data", "error", err, "key", schemeID)
			http.Error(w, "Failed to process cached data", http.StatusInternalServerError)
			return
		}

		level.Info(logger).Log("msg", "Actuarial data retrieved from cache", "scheme_id", schemeID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(data)
	}
}

func main() {
	level.Info(logger).Log("msg", "Starting OpenIMIS Service")

	// Create Dapr client
	daprClient, err := dapr.NewClient()
	if err != nil {
		level.Error(logger).Log("msg", "Failed to create Dapr client", "error", err)
		os.Exit(1)
	}
	defer daprClient.Close()

	// Setup HTTP router
	r := mux.NewRouter()

	// API Endpoints
	r.HandleFunc("/api/v1/actuarial-data/{schemeId}", getPremiumCalculation(daprClient)).Methods("POST")
	r.HandleFunc("/api/v1/claims-submitted", submitClaim(daprClient)).Methods("POST")
	r.HandleFunc("/api/v1/cache-actuarial-data", cacheActuarialData(daprClient)).Methods("POST")
	r.HandleFunc("/api/v1/cache-actuarial-data/{schemeId}", getCachedActuarialData(daprClient)).Methods("GET")

	// Prometheus Metrics Endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Health Check Endpoint
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}).Methods("GET")

	level.Info(logger).Log("msg", "Server listening", "port", appPort)
	if err := http.ListenAndServe(":"+appPort, r); err != nil {
		level.Error(logger).Log("msg", "Server failed to start", "error", err)
		os.Exit(1)
	}
}
