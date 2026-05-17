package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"claims-producer-service/config"
	"claims-producer-service/producer"
	"github.com/google/uuid"
)

// ClaimsService handles the business logic for claims.
type ClaimsService struct {
	mockService *producer.MockClaimsService
	config      *config.Config
}

// NewClaimsService creates a new ClaimsService.
func NewClaimsService(p *producer.KafkaProducer, topic string) *ClaimsService {
	cfg, _ := config.LoadConfig() // Config is already loaded in main, but load again for simplicity in this file
	mockService := producer.NewMockClaimsService(p, topic, cfg)
	return &ClaimsService{
		mockService: mockService,
		config:      cfg,
	}
}

// ReportClaimHandler simulates an API endpoint that receives a claim update
// and triggers the Kafka event production.
func (cs *ClaimsService) ReportClaimHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Setup Context with Trace ID
	traceID := r.Header.Get(cs.config.TraceHeader)
	if traceID == "" {
		traceID = uuid.New().String()
	}
	ctx := context.WithValue(r.Context(), cs.config.TraceHeader, traceID)

	log.Printf("TRACE_ID=%s | Received claim update request", traceID)

	// 2. Decode Request Body
	var update producer.MockClaimUpdate
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("TRACE_ID=%s | Error reading request body: %v", traceID, err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := json.Unmarshal(body, &update); err != nil {
		log.Printf("TRACE_ID=%s | Error unmarshalling request body: %v", traceID, err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Mock: If claim doesn't exist, create a mock claim for the first REPORTED event
	if _, exists := producer.MockClaimsData[update.ClaimID]; !exists && update.Status == "REPORTED" {
		// Simulate a new claim being reported
		producer.MockClaimsData[update.ClaimID] = producer.ClaimEvent{
			ClaimID:        update.ClaimID,
			PolicyID:       fmt.Sprintf("POL-%d", time.Now().UnixNano()%2+1001), // Mock policy ID
			EventType:      "REPORTED",
			EventTimestamp: time.Now().UnixMilli(),
			ClaimAmount:    1500.00, // Mock amount
			LossRatio:      0.0,
		}
		log.Printf("TRACE_ID=%s | Mocked new claim %s with policy %s", traceID, update.ClaimID, producer.MockClaimsData[update.ClaimID].PolicyID)
	}

	// 3. Process Claim Update and Produce Kafka Event
	if err := cs.mockService.ProcessClaimUpdate(ctx, update); err != nil {
		log.Printf("TRACE_ID=%s | Error processing claim update: %v", traceID, err)
		http.Error(w, fmt.Sprintf("Failed to process claim update: %v", err), http.StatusInternalServerError)
		return
	}

	// 4. Respond
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Claim %s status updated to %s and event produced successfully. Trace ID: %s", update.ClaimID, update.Status, traceID)))
	log.Printf("TRACE_ID=%s | Successfully processed claim update for %s", traceID, update.ClaimID)
}
