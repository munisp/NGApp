package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/segmentio/kafka-go"
)

// RetryRequest represents a payment retry request
type RetryRequest struct {
	TransactionID  string                 `json:"transaction_id"`
	SessionID      string                 `json:"session_id"`
	RetryStrategy  string                 `json:"retry_strategy"` // immediate, exponential, scheduled
	MaxAttempts    int                    `json:"max_attempts"`
	RetryInterval  int                    `json:"retry_interval"` // seconds
	AlternativeMethod string              `json:"alternative_method,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// RetryResponse represents a payment retry response
type RetryResponse struct {
	RetryID       string    `json:"retry_id"`
	Status        string    `json:"status"`
	NextRetryAt   time.Time `json:"next_retry_at,omitempty"`
	AttemptsLeft  int       `json:"attempts_left"`
	ScheduledJobs []string  `json:"scheduled_jobs,omitempty"`
}

// RetryAttempt represents a retry attempt record
type RetryAttempt struct {
	ID            int
	TransactionID string
	AttemptNumber int
	Status        string
	ErrorMessage  string
	AttemptedAt   time.Time
}

var (
	db          *sql.DB
	kafkaWriter *kafka.Writer
)

func main() {
	// Initialize database
	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			log.Printf("Failed to connect to database: %v", err)
		} else {
			defer db.Close()
		}
	}

	// Initialize Kafka
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}

	kafkaWriter = &kafka.Writer{
		Addr:     kafka.TCP(kafkaBrokers),
		Topic:    "payment.retry",
		Balancer: &kafka.LeastBytes{},
	}
	defer kafkaWriter.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/retry", retryPaymentHandler)
	http.HandleFunc("/status", retryStatusHandler)
	http.HandleFunc("/cancel", cancelRetryHandler)

	log.Printf("Payment Retry Service starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "payment-retry",
	})
}

func retryPaymentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RetryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.TransactionID == "" && req.SessionID == "" {
		http.Error(w, "Either transaction_id or session_id is required", http.StatusBadRequest)
		return
	}

	if req.MaxAttempts == 0 {
		req.MaxAttempts = 3 // Default
	}

	if req.RetryInterval == 0 {
		req.RetryInterval = 300 // Default 5 minutes
	}

	// Generate retry ID
	retryID := fmt.Sprintf("retry_%d", time.Now().Unix())

	// Determine retry strategy
	var nextRetryAt time.Time
	var scheduledJobs []string

	switch req.RetryStrategy {
	case "immediate":
		// Retry immediately
		go executeRetry(req, 1)
		nextRetryAt = time.Now()

	case "exponential":
		// Schedule retries with exponential backoff
		for i := 1; i <= req.MaxAttempts; i++ {
			delay := time.Duration(req.RetryInterval*(1<<uint(i-1))) * time.Second
			retryTime := time.Now().Add(delay)
			jobID := scheduleRetry(req, i, retryTime)
			scheduledJobs = append(scheduledJobs, jobID)
		}
		nextRetryAt = time.Now().Add(time.Duration(req.RetryInterval) * time.Second)

	case "scheduled":
		// Schedule retries at fixed intervals
		for i := 1; i <= req.MaxAttempts; i++ {
			delay := time.Duration(req.RetryInterval*i) * time.Second
			retryTime := time.Now().Add(delay)
			jobID := scheduleRetry(req, i, retryTime)
			scheduledJobs = append(scheduledJobs, jobID)
		}
		nextRetryAt = time.Now().Add(time.Duration(req.RetryInterval) * time.Second)

	default:
		// Default to immediate
		go executeRetry(req, 1)
		nextRetryAt = time.Now()
	}

	// Publish retry event to Kafka
	publishRetryEvent(retryID, req)

	response := RetryResponse{
		RetryID:       retryID,
		Status:        "scheduled",
		NextRetryAt:   nextRetryAt,
		AttemptsLeft:  req.MaxAttempts,
		ScheduledJobs: scheduledJobs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func retryStatusHandler(w http.ResponseWriter, r *http.Request) {
	retryID := r.URL.Query().Get("retry_id")
	if retryID == "" {
		http.Error(w, "Missing retry_id parameter", http.StatusBadRequest)
		return
	}

	// In production, query from database
	status := map[string]interface{}{
		"retry_id":      retryID,
		"status":        "in_progress",
		"attempts_made": 2,
		"attempts_left": 1,
		"last_attempt":  time.Now().Add(-5 * time.Minute),
		"next_attempt":  time.Now().Add(5 * time.Minute),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func cancelRetryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RetryID string `json:"retry_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Cancel scheduled retries
	// In production, remove from job queue

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"retry_id": req.RetryID,
		"status":   "cancelled",
	})
}

func executeRetry(req RetryRequest, attemptNumber int) {
	log.Printf("Executing retry attempt %d for transaction %s", attemptNumber, req.TransactionID)

	// In production, this would:
	// 1. Retrieve original payment details
	// 2. Attempt payment with same or alternative method
	// 3. Record attempt in database
	// 4. Publish result event
	// 5. Schedule next retry if failed and attempts remaining

	// Simulate retry logic
	time.Sleep(2 * time.Second)

	// Record attempt
	recordRetryAttempt(req.TransactionID, attemptNumber, "completed", "")

	log.Printf("Retry attempt %d completed for transaction %s", attemptNumber, req.TransactionID)
}

func scheduleRetry(req RetryRequest, attemptNumber int, retryTime time.Time) string {
	jobID := fmt.Sprintf("job_%s_%d", req.TransactionID, attemptNumber)

	// In production, schedule job in job queue (e.g., Temporal, Celery, etc.)
	log.Printf("Scheduled retry attempt %d for %s at %s", attemptNumber, req.TransactionID, retryTime)

	// For now, schedule with goroutine
	go func() {
		time.Sleep(time.Until(retryTime))
		executeRetry(req, attemptNumber)
	}()

	return jobID
}

func publishRetryEvent(retryID string, req RetryRequest) {
	event := map[string]interface{}{
		"retry_id":       retryID,
		"transaction_id": req.TransactionID,
		"session_id":     req.SessionID,
		"strategy":       req.RetryStrategy,
		"max_attempts":   req.MaxAttempts,
		"timestamp":      time.Now().Unix(),
	}

	eventJSON, _ := json.Marshal(event)

	err := kafkaWriter.WriteMessages(r.Context(), kafka.Message{
		Key:   []byte(retryID),
		Value: eventJSON,
	})

	if err != nil {
		log.Printf("Failed to publish retry event: %v", err)
	}
}

func recordRetryAttempt(transactionID string, attemptNumber int, status, errorMessage string) {
	if db == nil {
		return
	}

	query := `
		INSERT INTO payment_retry_attempts 
		(transaction_id, attempt_number, status, error_message, attempted_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := db.Exec(query, transactionID, attemptNumber, status, errorMessage, time.Now())
	if err != nil {
		log.Printf("Failed to record retry attempt: %v", err)
	}
}
