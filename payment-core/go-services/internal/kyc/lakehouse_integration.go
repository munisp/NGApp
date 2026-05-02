// Package kyc provides lakehouse integration for KYC/KYB events
package kyc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

// Resilience configuration constants
const (
	maxRetries          = 5
	initialRetryDelay   = 100 * time.Millisecond
	maxRetryDelay       = 30 * time.Second
	circuitBreakerThreshold = 5
	circuitBreakerTimeout   = 30 * time.Second
	deadLetterQueueSize     = 10000
)

// CircuitState represents circuit breaker state
type CircuitState int32

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

// LakehouseCircuitBreaker provides circuit breaker for lakehouse operations
type LakehouseCircuitBreaker struct {
	state           int32
	failures        int32
	lastFailureTime int64
	threshold       int32
	timeout         time.Duration
}

// NewLakehouseCircuitBreaker creates a new circuit breaker
func NewLakehouseCircuitBreaker() *LakehouseCircuitBreaker {
	return &LakehouseCircuitBreaker{
		state:     int32(CircuitClosed),
		threshold: circuitBreakerThreshold,
		timeout:   circuitBreakerTimeout,
	}
}

// CanExecute checks if the circuit allows execution
func (cb *LakehouseCircuitBreaker) CanExecute() bool {
	state := CircuitState(atomic.LoadInt32(&cb.state))
	switch state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Now().UnixNano()-atomic.LoadInt64(&cb.lastFailureTime) > cb.timeout.Nanoseconds() {
			atomic.StoreInt32(&cb.state, int32(CircuitHalfOpen))
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return false
}

// RecordSuccess records a successful operation
func (cb *LakehouseCircuitBreaker) RecordSuccess() {
	atomic.StoreInt32(&cb.failures, 0)
	atomic.StoreInt32(&cb.state, int32(CircuitClosed))
}

// RecordFailure records a failed operation
func (cb *LakehouseCircuitBreaker) RecordFailure() {
	atomic.StoreInt64(&cb.lastFailureTime, time.Now().UnixNano())
	failures := atomic.AddInt32(&cb.failures, 1)
	if failures >= cb.threshold {
		atomic.StoreInt32(&cb.state, int32(CircuitOpen))
	}
}

// State returns current circuit state
func (cb *LakehouseCircuitBreaker) State() CircuitState {
	return CircuitState(atomic.LoadInt32(&cb.state))
}

// DeadLetterQueue stores failed events for later retry
type DeadLetterQueue struct {
	events   []*LakehouseEvent
	mu       sync.Mutex
	maxSize  int
	filePath string
}

// NewDeadLetterQueue creates a new dead letter queue
func NewDeadLetterQueue(filePath string) *DeadLetterQueue {
	dlq := &DeadLetterQueue{
		events:   make([]*LakehouseEvent, 0),
		maxSize:  deadLetterQueueSize,
		filePath: filePath,
	}
	dlq.loadFromDisk()
	return dlq
}

// Add adds an event to the dead letter queue
func (dlq *DeadLetterQueue) Add(event *LakehouseEvent) {
	dlq.mu.Lock()
	defer dlq.mu.Unlock()
	
	if len(dlq.events) >= dlq.maxSize {
		dlq.events = dlq.events[1:]
	}
	dlq.events = append(dlq.events, event)
	dlq.persistToDisk()
}

// GetAll returns all events in the queue
func (dlq *DeadLetterQueue) GetAll() []*LakehouseEvent {
	dlq.mu.Lock()
	defer dlq.mu.Unlock()
	result := make([]*LakehouseEvent, len(dlq.events))
	copy(result, dlq.events)
	return result
}

// Remove removes an event from the queue
func (dlq *DeadLetterQueue) Remove(eventID string) {
	dlq.mu.Lock()
	defer dlq.mu.Unlock()
	
	for i, e := range dlq.events {
		if e.EventID == eventID {
			dlq.events = append(dlq.events[:i], dlq.events[i+1:]...)
			break
		}
	}
	dlq.persistToDisk()
}

// Size returns the number of events in the queue
func (dlq *DeadLetterQueue) Size() int {
	dlq.mu.Lock()
	defer dlq.mu.Unlock()
	return len(dlq.events)
}

// persistToDisk saves the queue to disk
func (dlq *DeadLetterQueue) persistToDisk() {
	if dlq.filePath == "" {
		return
	}
	data, err := json.Marshal(dlq.events)
	if err != nil {
		log.Printf("Failed to marshal DLQ: %v", err)
		return
	}
	if err := os.WriteFile(dlq.filePath, data, 0644); err != nil {
		log.Printf("Failed to persist DLQ: %v", err)
	}
}

// loadFromDisk loads the queue from disk
func (dlq *DeadLetterQueue) loadFromDisk() {
	if dlq.filePath == "" {
		return
	}
	data, err := os.ReadFile(dlq.filePath)
	if err != nil {
		return
	}
	var events []*LakehouseEvent
	if err := json.Unmarshal(data, &events); err != nil {
		log.Printf("Failed to unmarshal DLQ: %v", err)
		return
	}
	dlq.events = events
}

// LakehouseEventType represents the type of event for lakehouse
type LakehouseEventType string

const (
	EventKYCCaseCreated       LakehouseEventType = "kyc.case.created"
	EventKYCCaseUpdated       LakehouseEventType = "kyc.case.updated"
	EventKYCDocumentUploaded  LakehouseEventType = "kyc.document.uploaded"
	EventKYCDocumentVerified  LakehouseEventType = "kyc.document.verified"
	EventKYCIdentityVerified  LakehouseEventType = "kyc.identity.verified"
	EventKYCRiskScored        LakehouseEventType = "kyc.risk.scored"
	EventKYCDecisionMade      LakehouseEventType = "kyc.decision.made"
	EventKYBCaseCreated       LakehouseEventType = "kyb.case.created"
	EventKYBCaseUpdated       LakehouseEventType = "kyb.case.updated"
	EventKYBCompanyVerified   LakehouseEventType = "kyb.company.verified"
	EventKYBDirectorVerified  LakehouseEventType = "kyb.director.verified"
	EventKYBDecisionMade      LakehouseEventType = "kyb.decision.made"
	EventOCRProcessed         LakehouseEventType = "ocr.document.processed"
	EventVLMAnalyzed          LakehouseEventType = "vlm.document.analyzed"
	EventSanctionsScreened    LakehouseEventType = "sanctions.screened"
	EventPEPScreened          LakehouseEventType = "pep.screened"
	EventAdverseMediaScreened LakehouseEventType = "adverse_media.screened"
)

// LakehouseEvent represents an event to be sent to the lakehouse
type LakehouseEvent struct {
	EventID     string                 `json:"event_id"`
	EventType   LakehouseEventType     `json:"event_type"`
	EventTime   time.Time              `json:"event_time"`
	Source      string                 `json:"source"`
	Version     string                 `json:"version"`
	CaseID      string                 `json:"case_id,omitempty"`
	EntityID    string                 `json:"entity_id,omitempty"`
	EntityType  string                 `json:"entity_type,omitempty"` // PERSON, ORGANIZATION
	Data        map[string]interface{} `json:"data"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CorrelationID string               `json:"correlation_id,omitempty"`
}

// KYCCaseEvent represents a KYC case event for lakehouse
type KYCCaseEvent struct {
	CaseID           string    `json:"case_id"`
	PersonID         string    `json:"person_id"`
	PersonName       string    `json:"person_name"`
	OrganizationID   string    `json:"organization_id,omitempty"`
	OrganizationName string    `json:"organization_name,omitempty"`
	Status           string    `json:"status"`
	RiskLevel        string    `json:"risk_level,omitempty"`
	RiskScore        int       `json:"risk_score,omitempty"`
	Country          string    `json:"country"`
	IDType           string    `json:"id_type,omitempty"`
	IDNumber         string    `json:"id_number,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	ReviewerID       string    `json:"reviewer_id,omitempty"`
	Decision         string    `json:"decision,omitempty"`
	DecisionReason   string    `json:"decision_reason,omitempty"`
}

// KYBCaseEvent represents a KYB case event for lakehouse
type KYBCaseEvent struct {
	CaseID             string    `json:"case_id"`
	OrganizationID     string    `json:"organization_id"`
	OrganizationName   string    `json:"organization_name"`
	RegistrationNumber string    `json:"registration_number"`
	StakeholderType    string    `json:"stakeholder_type"`
	Status             string    `json:"status"`
	RiskLevel          string    `json:"risk_level,omitempty"`
	RiskScore          int       `json:"risk_score,omitempty"`
	Country            string    `json:"country"`
	DirectorCount      int       `json:"director_count"`
	ShareholderCount   int       `json:"shareholder_count"`
	UBOCount           int       `json:"ubo_count"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	CompletedAt        *time.Time `json:"completed_at,omitempty"`
	ReviewerID         string    `json:"reviewer_id,omitempty"`
	Decision           string    `json:"decision,omitempty"`
	DecisionReason     string    `json:"decision_reason,omitempty"`
}

// DocumentEvent represents a document processing event for lakehouse
type DocumentEvent struct {
	DocumentID      string    `json:"document_id"`
	CaseID          string    `json:"case_id"`
	DocumentType    string    `json:"document_type"`
	FileName        string    `json:"file_name"`
	FileSize        int64     `json:"file_size"`
	MimeType        string    `json:"mime_type"`
	Status          string    `json:"status"`
	OCRConfidence   float64   `json:"ocr_confidence,omitempty"`
	VLMConfidence   float64   `json:"vlm_confidence,omitempty"`
	ExtractedFields int       `json:"extracted_fields,omitempty"`
	ValidationScore float64   `json:"validation_score,omitempty"`
	ProcessingTime  int64     `json:"processing_time_ms"`
	ProcessedAt     time.Time `json:"processed_at"`
	ErrorMessage    string    `json:"error_message,omitempty"`
}

// IdentityVerificationEvent represents an identity verification event for lakehouse
type IdentityVerificationEvent struct {
	VerificationID string    `json:"verification_id"`
	CaseID         string    `json:"case_id"`
	PersonID       string    `json:"person_id,omitempty"`
	OrganizationID string    `json:"organization_id,omitempty"`
	IDType         string    `json:"id_type"` // NIN, BVN, CAC, PASSPORT
	IDNumber       string    `json:"id_number"`
	Provider       string    `json:"provider"` // NIMC, NIBSS, CAC, IMMIGRATION
	Status         string    `json:"status"`
	MatchScore     float64   `json:"match_score"`
	ResponseTime   int64     `json:"response_time_ms"`
	VerifiedAt     time.Time `json:"verified_at"`
	ErrorMessage   string    `json:"error_message,omitempty"`
}

// ScreeningEvent represents a screening event for lakehouse
type ScreeningEvent struct {
	ScreeningID    string    `json:"screening_id"`
	CaseID         string    `json:"case_id"`
	EntityID       string    `json:"entity_id"`
	EntityType     string    `json:"entity_type"` // PERSON, ORGANIZATION
	EntityName     string    `json:"entity_name"`
	ScreeningType  string    `json:"screening_type"` // SANCTIONS, PEP, ADVERSE_MEDIA
	Status         string    `json:"status"`         // CLEAR, POTENTIAL_MATCH, CONFIRMED_MATCH
	MatchCount     int       `json:"match_count"`
	HighestScore   float64   `json:"highest_score,omitempty"`
	Sources        []string  `json:"sources,omitempty"`
	ResponseTime   int64     `json:"response_time_ms"`
	ScreenedAt     time.Time `json:"screened_at"`
	ReviewedBy     string    `json:"reviewed_by,omitempty"`
	ReviewDecision string    `json:"review_decision,omitempty"`
}

// RiskScoringEvent represents a risk scoring event for lakehouse
type RiskScoringEvent struct {
	ScoringID         string             `json:"scoring_id"`
	CaseID            string             `json:"case_id"`
	EntityID          string             `json:"entity_id"`
	EntityType        string             `json:"entity_type"`
	OverallScore      int                `json:"overall_score"`
	RiskLevel         string             `json:"risk_level"`
	JurisdictionRisk  int                `json:"jurisdiction_risk"`
	EntityTypeRisk    int                `json:"entity_type_risk"`
	PEPRisk           int                `json:"pep_risk"`
	SanctionsRisk     int                `json:"sanctions_risk"`
	AdverseMediaRisk  int                `json:"adverse_media_risk"`
	DocumentRisk      int                `json:"document_risk"`
	FactorCount       int                `json:"factor_count"`
	ModelVersion      string             `json:"model_version"`
	ScoredAt          time.Time          `json:"scored_at"`
	Recommendations   []string           `json:"recommendations,omitempty"`
}

// OllamaAnalysisEvent represents an Ollama/LLaVA analysis event for lakehouse
type OllamaAnalysisEvent struct {
	AnalysisID      string                 `json:"analysis_id"`
	CaseID          string                 `json:"case_id"`
	DocumentID      string                 `json:"document_id"`
	Model           string                 `json:"model"` // llava, llava:13b, etc.
	AnalysisType    string                 `json:"analysis_type"` // DOCUMENT_EXTRACTION, FRAUD_DETECTION, FACE_MATCH
	Prompt          string                 `json:"prompt,omitempty"`
	ResponseTokens  int                    `json:"response_tokens"`
	Confidence      float64                `json:"confidence"`
	ExtractedData   map[string]interface{} `json:"extracted_data,omitempty"`
	ProcessingTime  int64                  `json:"processing_time_ms"`
	AnalyzedAt      time.Time              `json:"analyzed_at"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
}

// KYCLakehousePublisher publishes KYC/KYB events to the lakehouse
type KYCLakehousePublisher struct {
	kafkaBootstrap    string
	kafkaTopic        string
	flinkEndpoint     string
	deltaLakePath     string
	httpClient        *http.Client
	eventBuffer       []*LakehouseEvent
	bufferMu          sync.Mutex
	flushInterval     time.Duration
	batchSize         int
	circuitBreaker    *LakehouseCircuitBreaker
	deadLetterQueue   *DeadLetterQueue
	healthy           int32
	metricsPublished  int64
	metricsFailed     int64
	dlqRetryInterval  time.Duration
	stopCh            chan struct{}
	fallbackEnabled   bool
	localBufferPath   string
}

// NewKYCLakehousePublisher creates a new KYC lakehouse publisher with full resilience
func NewKYCLakehousePublisher(kafkaBootstrap, kafkaTopic, flinkEndpoint, deltaLakePath string) *KYCLakehousePublisher {
	dlqPath := os.Getenv("LAKEHOUSE_DLQ_PATH")
	if dlqPath == "" {
		dlqPath = "/tmp/lakehouse_dlq.json"
	}
	
	localBufferPath := os.Getenv("LAKEHOUSE_LOCAL_BUFFER_PATH")
	if localBufferPath == "" {
		localBufferPath = "/tmp/lakehouse_buffer.json"
	}

	publisher := &KYCLakehousePublisher{
		kafkaBootstrap:   kafkaBootstrap,
		kafkaTopic:       kafkaTopic,
		flinkEndpoint:    flinkEndpoint,
		deltaLakePath:    deltaLakePath,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		eventBuffer:      make([]*LakehouseEvent, 0),
		flushInterval:    5 * time.Second,
		batchSize:        100,
		circuitBreaker:   NewLakehouseCircuitBreaker(),
		deadLetterQueue:  NewDeadLetterQueue(dlqPath),
		healthy:          1,
		dlqRetryInterval: 60 * time.Second,
		stopCh:           make(chan struct{}),
		fallbackEnabled:  true,
		localBufferPath:  localBufferPath,
	}

	// Start background flusher
	go publisher.backgroundFlusher()
	
	// Start DLQ retry processor
	go publisher.processDLQ()
	
	// Start health checker
	go publisher.healthChecker()

	return publisher
}

// Stop gracefully stops the publisher
func (p *KYCLakehousePublisher) Stop() {
	close(p.stopCh)
	p.flush(context.Background())
}

// IsHealthy returns whether the publisher is healthy
func (p *KYCLakehousePublisher) IsHealthy() bool {
	return atomic.LoadInt32(&p.healthy) == 1
}

// GetMetrics returns publisher metrics
func (p *KYCLakehousePublisher) GetMetrics() map[string]interface{} {
	return map[string]interface{}{
		"published":        atomic.LoadInt64(&p.metricsPublished),
		"failed":           atomic.LoadInt64(&p.metricsFailed),
		"dlq_size":         p.deadLetterQueue.Size(),
		"buffer_size":      len(p.eventBuffer),
		"circuit_state":    p.circuitBreaker.State(),
		"healthy":          p.IsHealthy(),
	}
}

// healthChecker periodically checks Kafka connectivity
func (p *KYCLakehousePublisher) healthChecker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopCh:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			err := p.checkKafkaHealth(ctx)
			cancel()
			
			if err != nil {
				atomic.StoreInt32(&p.healthy, 0)
				log.Printf("Lakehouse health check failed: %v", err)
			} else {
				atomic.StoreInt32(&p.healthy, 1)
			}
		}
	}
}

// checkKafkaHealth checks if Kafka is reachable
func (p *KYCLakehousePublisher) checkKafkaHealth(ctx context.Context) error {
	if p.kafkaBootstrap == "" {
		return nil
	}
	
	healthURL := fmt.Sprintf("http://%s/", p.kafkaBootstrap)
	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		return err
	}
	
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	return nil
}

// processDLQ periodically retries events in the dead letter queue
func (p *KYCLakehousePublisher) processDLQ() {
	ticker := time.NewTicker(p.dlqRetryInterval)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopCh:
			return
		case <-ticker.C:
			if !p.circuitBreaker.CanExecute() {
				continue
			}
			
			events := p.deadLetterQueue.GetAll()
			for _, event := range events {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				err := p.sendToKafkaWithRetry(ctx, event)
				cancel()
				
				if err == nil {
					p.deadLetterQueue.Remove(event.EventID)
					atomic.AddInt64(&p.metricsPublished, 1)
					log.Printf("Successfully retried DLQ event: %s", event.EventID)
				}
			}
		}
	}
}

// Publish publishes an event to the lakehouse
func (p *KYCLakehousePublisher) Publish(ctx context.Context, topic string, event interface{}) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:   uuid.New().String(),
		EventTime: time.Now(),
		Source:    "kyc-service",
		Version:   "1.0",
	}

	// Convert event to lakehouse event
	switch e := event.(type) {
	case *KYCCaseEvent:
		lakehouseEvent.EventType = EventKYCCaseUpdated
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.PersonID
		lakehouseEvent.EntityType = "PERSON"
		lakehouseEvent.Data = structToMap(e)
	case *KYBCaseEvent:
		lakehouseEvent.EventType = EventKYBCaseUpdated
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.OrganizationID
		lakehouseEvent.EntityType = "ORGANIZATION"
		lakehouseEvent.Data = structToMap(e)
	case *DocumentEvent:
		lakehouseEvent.EventType = EventKYCDocumentVerified
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.DocumentID
		lakehouseEvent.Data = structToMap(e)
	case *IdentityVerificationEvent:
		lakehouseEvent.EventType = EventKYCIdentityVerified
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.VerificationID
		lakehouseEvent.Data = structToMap(e)
	case *ScreeningEvent:
		switch e.ScreeningType {
		case "SANCTIONS":
			lakehouseEvent.EventType = EventSanctionsScreened
		case "PEP":
			lakehouseEvent.EventType = EventPEPScreened
		case "ADVERSE_MEDIA":
			lakehouseEvent.EventType = EventAdverseMediaScreened
		}
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.EntityID
		lakehouseEvent.EntityType = e.EntityType
		lakehouseEvent.Data = structToMap(e)
	case *RiskScoringEvent:
		lakehouseEvent.EventType = EventKYCRiskScored
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.EntityID
		lakehouseEvent.EntityType = e.EntityType
		lakehouseEvent.Data = structToMap(e)
	case *OllamaAnalysisEvent:
		lakehouseEvent.EventType = EventVLMAnalyzed
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.EntityID = e.DocumentID
		lakehouseEvent.Data = structToMap(e)
	case *VerificationEvent:
		lakehouseEvent.EventType = LakehouseEventType(e.EventType)
		lakehouseEvent.CaseID = e.CaseID
		lakehouseEvent.Data = structToMap(e)
	default:
		// Generic event
		lakehouseEvent.Data = structToMap(event)
	}

	// Add to buffer
	p.bufferMu.Lock()
	p.eventBuffer = append(p.eventBuffer, lakehouseEvent)
	shouldFlush := len(p.eventBuffer) >= p.batchSize
	p.bufferMu.Unlock()

	if shouldFlush {
		return p.flush(ctx)
	}

	return nil
}

// flush sends buffered events to Kafka/Flink with full resilience
func (p *KYCLakehousePublisher) flush(ctx context.Context) error {
	p.bufferMu.Lock()
	if len(p.eventBuffer) == 0 {
		p.bufferMu.Unlock()
		return nil
	}
	events := p.eventBuffer
	p.eventBuffer = make([]*LakehouseEvent, 0)
	p.bufferMu.Unlock()

	for _, event := range events {
		err := p.sendToKafkaWithRetry(ctx, event)
		if err != nil {
			log.Printf("Failed to send event to Kafka after retries: %v, adding to DLQ", err)
			p.deadLetterQueue.Add(event)
			atomic.AddInt64(&p.metricsFailed, 1)
		} else {
			atomic.AddInt64(&p.metricsPublished, 1)
		}
	}

	return nil
}

// sendToKafkaWithRetry sends an event to Kafka with exponential backoff retry
func (p *KYCLakehousePublisher) sendToKafkaWithRetry(ctx context.Context, event *LakehouseEvent) error {
	var lastErr error
	delay := initialRetryDelay

	for attempt := 1; attempt <= maxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := p.sendToKafka(ctx, event)
		if err == nil {
			p.circuitBreaker.RecordSuccess()
			return nil
		}

		lastErr = err
		p.circuitBreaker.RecordFailure()

		if attempt == maxRetries {
			break
		}

		log.Printf("Kafka send attempt %d failed: %v, retrying in %v", attempt, err, delay)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}

		delay = time.Duration(float64(delay) * 2)
		if delay > maxRetryDelay {
			delay = maxRetryDelay
		}
	}

	return fmt.Errorf("max retries (%d) exceeded: %w", maxRetries, lastErr)
}

// sendToKafka sends an event to Kafka
func (p *KYCLakehousePublisher) sendToKafka(ctx context.Context, event *LakehouseEvent) error {
	if p.kafkaBootstrap == "" {
		if p.fallbackEnabled {
			return p.saveToLocalBuffer(event)
		}
		return nil
	}

	if !p.circuitBreaker.CanExecute() {
		if p.fallbackEnabled {
			return p.saveToLocalBuffer(event)
		}
		return fmt.Errorf("circuit breaker is open")
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	restProxyURL := fmt.Sprintf("http://%s/topics/%s", p.kafkaBootstrap, p.kafkaTopic)
	req, err := http.NewRequestWithContext(ctx, "POST", restProxyURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/vnd.kafka.json.v2+json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kafka REST proxy returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// saveToLocalBuffer saves event to local file buffer as fallback
func (p *KYCLakehousePublisher) saveToLocalBuffer(event *LakehouseEvent) error {
	p.bufferMu.Lock()
	defer p.bufferMu.Unlock()

	var events []*LakehouseEvent
	data, err := os.ReadFile(p.localBufferPath)
	if err == nil {
		json.Unmarshal(data, &events)
	}

	events = append(events, event)
	
	newData, err := json.Marshal(events)
	if err != nil {
		return err
	}

	return os.WriteFile(p.localBufferPath, newData, 0644)
}

// backgroundFlusher periodically flushes the event buffer
func (p *KYCLakehousePublisher) backgroundFlusher() {
	ticker := time.NewTicker(p.flushInterval)
	defer ticker.Stop()

	for range ticker.C {
		p.flush(context.Background())
	}
}

// PublishKYCCaseCreated publishes a KYC case created event
func (p *KYCLakehousePublisher) PublishKYCCaseCreated(ctx context.Context, event *KYCCaseEvent) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:    uuid.New().String(),
		EventType:  EventKYCCaseCreated,
		EventTime:  time.Now(),
		Source:     "kyc-service",
		Version:    "1.0",
		CaseID:     event.CaseID,
		EntityID:   event.PersonID,
		EntityType: "PERSON",
		Data:       structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishKYBCaseCreated publishes a KYB case created event
func (p *KYCLakehousePublisher) PublishKYBCaseCreated(ctx context.Context, event *KYBCaseEvent) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:    uuid.New().String(),
		EventType:  EventKYBCaseCreated,
		EventTime:  time.Now(),
		Source:     "kyb-service",
		Version:    "1.0",
		CaseID:     event.CaseID,
		EntityID:   event.OrganizationID,
		EntityType: "ORGANIZATION",
		Data:       structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishDocumentProcessed publishes a document processing event
func (p *KYCLakehousePublisher) PublishDocumentProcessed(ctx context.Context, event *DocumentEvent) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:   uuid.New().String(),
		EventType: EventOCRProcessed,
		EventTime: time.Now(),
		Source:    "document-processor",
		Version:   "1.0",
		CaseID:    event.CaseID,
		EntityID:  event.DocumentID,
		Data:      structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishOllamaAnalysis publishes an Ollama/LLaVA analysis event
func (p *KYCLakehousePublisher) PublishOllamaAnalysis(ctx context.Context, event *OllamaAnalysisEvent) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:   uuid.New().String(),
		EventType: EventVLMAnalyzed,
		EventTime: time.Now(),
		Source:    "ollama-vlm",
		Version:   "1.0",
		CaseID:    event.CaseID,
		EntityID:  event.DocumentID,
		Data:      structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishIdentityVerification publishes an identity verification event
func (p *KYCLakehousePublisher) PublishIdentityVerification(ctx context.Context, event *IdentityVerificationEvent) error {
	eventType := EventKYCIdentityVerified
	if event.OrganizationID != "" {
		eventType = EventKYBCompanyVerified
	}
	lakehouseEvent := &LakehouseEvent{
		EventID:   uuid.New().String(),
		EventType: eventType,
		EventTime: time.Now(),
		Source:    "identity-verification",
		Version:   "1.0",
		CaseID:    event.CaseID,
		EntityID:  event.VerificationID,
		Data:      structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishScreening publishes a screening event
func (p *KYCLakehousePublisher) PublishScreening(ctx context.Context, event *ScreeningEvent) error {
	var eventType LakehouseEventType
	switch event.ScreeningType {
	case "SANCTIONS":
		eventType = EventSanctionsScreened
	case "PEP":
		eventType = EventPEPScreened
	case "ADVERSE_MEDIA":
		eventType = EventAdverseMediaScreened
	default:
		eventType = EventSanctionsScreened
	}
	lakehouseEvent := &LakehouseEvent{
		EventID:    uuid.New().String(),
		EventType:  eventType,
		EventTime:  time.Now(),
		Source:     "screening-service",
		Version:    "1.0",
		CaseID:     event.CaseID,
		EntityID:   event.EntityID,
		EntityType: event.EntityType,
		Data:       structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// PublishRiskScoring publishes a risk scoring event
func (p *KYCLakehousePublisher) PublishRiskScoring(ctx context.Context, event *RiskScoringEvent) error {
	lakehouseEvent := &LakehouseEvent{
		EventID:    uuid.New().String(),
		EventType:  EventKYCRiskScored,
		EventTime:  time.Now(),
		Source:     "risk-scoring",
		Version:    "1.0",
		CaseID:     event.CaseID,
		EntityID:   event.EntityID,
		EntityType: event.EntityType,
		Data:       structToMap(event),
	}
	return p.Publish(ctx, p.kafkaTopic, lakehouseEvent)
}

// Helper function to convert struct to map
func structToMap(v interface{}) map[string]interface{} {
	data, _ := json.Marshal(v)
	var result map[string]interface{}
	json.Unmarshal(data, &result)
	return result
}

// FlinkKYCJob represents a Flink job for KYC/KYB analytics
type FlinkKYCJob struct {
	JobID          string `json:"job_id"`
	JobName        string `json:"job_name"`
	Status         string `json:"status"`
	SourceTopic    string `json:"source_topic"`
	SinkTable      string `json:"sink_table"`
	Parallelism    int    `json:"parallelism"`
	CheckpointPath string `json:"checkpoint_path"`
}

// FlinkKYCJobManager manages Flink jobs for KYC/KYB
type FlinkKYCJobManager struct {
	flinkEndpoint string
	httpClient    *http.Client
	jobs          map[string]*FlinkKYCJob
	jobsMu        sync.RWMutex
}

// NewFlinkKYCJobManager creates a new Flink job manager
func NewFlinkKYCJobManager(flinkEndpoint string) *FlinkKYCJobManager {
	return &FlinkKYCJobManager{
		flinkEndpoint: flinkEndpoint,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		jobs: make(map[string]*FlinkKYCJob),
	}
}

// SubmitKYCAnalyticsJob submits a Flink job for KYC analytics
func (m *FlinkKYCJobManager) SubmitKYCAnalyticsJob(ctx context.Context) (*FlinkKYCJob, error) {
	job := &FlinkKYCJob{
		JobID:          uuid.New().String(),
		JobName:        "kyc-analytics-job",
		Status:         "RUNNING",
		SourceTopic:    "kyc.verification.events",
		SinkTable:      "delta.kyc_analytics",
		Parallelism:    4,
		CheckpointPath: "s3://lakehouse/checkpoints/kyc-analytics",
	}

	m.jobsMu.Lock()
	m.jobs[job.JobID] = job
	m.jobsMu.Unlock()

	// In production, this would submit the job to Flink via REST API
	// The job would:
	// 1. Read from Kafka topic
	// 2. Process events (aggregations, windowing, etc.)
	// 3. Write to Delta Lake tables

	return job, nil
}

// GetJobStatus gets the status of a Flink job
func (m *FlinkKYCJobManager) GetJobStatus(ctx context.Context, jobID string) (*FlinkKYCJob, error) {
	m.jobsMu.RLock()
	defer m.jobsMu.RUnlock()

	if job, ok := m.jobs[jobID]; ok {
		return job, nil
	}
	return nil, fmt.Errorf("job %s not found", jobID)
}

// DeltaLakeKYCTables represents Delta Lake tables for KYC/KYB
type DeltaLakeKYCTables struct {
	BasePath string
}

// NewDeltaLakeKYCTables creates Delta Lake table definitions
func NewDeltaLakeKYCTables(basePath string) *DeltaLakeKYCTables {
	return &DeltaLakeKYCTables{BasePath: basePath}
}

// GetTableDefinitions returns SQL definitions for KYC/KYB Delta Lake tables
func (t *DeltaLakeKYCTables) GetTableDefinitions() map[string]string {
	return map[string]string{
		"kyc_cases": `
			CREATE TABLE IF NOT EXISTS kyc_cases (
				case_id STRING,
				person_id STRING,
				person_name STRING,
				organization_id STRING,
				organization_name STRING,
				status STRING,
				risk_level STRING,
				risk_score INT,
				country STRING,
				id_type STRING,
				created_at TIMESTAMP,
				updated_at TIMESTAMP,
				completed_at TIMESTAMP,
				reviewer_id STRING,
				decision STRING,
				decision_reason STRING,
				event_time TIMESTAMP,
				processing_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), country)
			LOCATION '` + t.BasePath + `/kyc_cases'
		`,
		"kyb_cases": `
			CREATE TABLE IF NOT EXISTS kyb_cases (
				case_id STRING,
				organization_id STRING,
				organization_name STRING,
				registration_number STRING,
				stakeholder_type STRING,
				status STRING,
				risk_level STRING,
				risk_score INT,
				country STRING,
				director_count INT,
				shareholder_count INT,
				ubo_count INT,
				created_at TIMESTAMP,
				updated_at TIMESTAMP,
				completed_at TIMESTAMP,
				reviewer_id STRING,
				decision STRING,
				decision_reason STRING,
				event_time TIMESTAMP,
				processing_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), country, stakeholder_type)
			LOCATION '` + t.BasePath + `/kyb_cases'
		`,
		"identity_verifications": `
			CREATE TABLE IF NOT EXISTS identity_verifications (
				verification_id STRING,
				case_id STRING,
				person_id STRING,
				organization_id STRING,
				id_type STRING,
				id_number STRING,
				provider STRING,
				status STRING,
				match_score DOUBLE,
				response_time_ms BIGINT,
				verified_at TIMESTAMP,
				error_message STRING,
				event_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), id_type, provider)
			LOCATION '` + t.BasePath + `/identity_verifications'
		`,
		"document_processing": `
			CREATE TABLE IF NOT EXISTS document_processing (
				document_id STRING,
				case_id STRING,
				document_type STRING,
				file_name STRING,
				file_size BIGINT,
				mime_type STRING,
				status STRING,
				ocr_confidence DOUBLE,
				vlm_confidence DOUBLE,
				extracted_fields INT,
				validation_score DOUBLE,
				processing_time_ms BIGINT,
				processed_at TIMESTAMP,
				error_message STRING,
				event_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), document_type)
			LOCATION '` + t.BasePath + `/document_processing'
		`,
		"screening_results": `
			CREATE TABLE IF NOT EXISTS screening_results (
				screening_id STRING,
				case_id STRING,
				entity_id STRING,
				entity_type STRING,
				entity_name STRING,
				screening_type STRING,
				status STRING,
				match_count INT,
				highest_score DOUBLE,
				sources ARRAY<STRING>,
				response_time_ms BIGINT,
				screened_at TIMESTAMP,
				reviewed_by STRING,
				review_decision STRING,
				event_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), screening_type, status)
			LOCATION '` + t.BasePath + `/screening_results'
		`,
		"risk_scores": `
			CREATE TABLE IF NOT EXISTS risk_scores (
				scoring_id STRING,
				case_id STRING,
				entity_id STRING,
				entity_type STRING,
				overall_score INT,
				risk_level STRING,
				jurisdiction_risk INT,
				entity_type_risk INT,
				pep_risk INT,
				sanctions_risk INT,
				adverse_media_risk INT,
				document_risk INT,
				factor_count INT,
				model_version STRING,
				scored_at TIMESTAMP,
				event_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), risk_level)
			LOCATION '` + t.BasePath + `/risk_scores'
		`,
		"ollama_analyses": `
			CREATE TABLE IF NOT EXISTS ollama_analyses (
				analysis_id STRING,
				case_id STRING,
				document_id STRING,
				model STRING,
				analysis_type STRING,
				response_tokens INT,
				confidence DOUBLE,
				processing_time_ms BIGINT,
				analyzed_at TIMESTAMP,
				error_message STRING,
				event_time TIMESTAMP
			) USING DELTA
			PARTITIONED BY (date(event_time), model, analysis_type)
			LOCATION '` + t.BasePath + `/ollama_analyses'
		`,
	}
}

// GetAnalyticsViews returns SQL definitions for analytics views
func (t *DeltaLakeKYCTables) GetAnalyticsViews() map[string]string {
	return map[string]string{
		"kyc_daily_metrics": `
			CREATE OR REPLACE VIEW kyc_daily_metrics AS
			SELECT 
				date(event_time) as date,
				country,
				COUNT(*) as total_cases,
				SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
				SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
				SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
				AVG(risk_score) as avg_risk_score,
				SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk_count
			FROM kyc_cases
			GROUP BY date(event_time), country
		`,
		"verification_performance": `
			CREATE OR REPLACE VIEW verification_performance AS
			SELECT 
				date(event_time) as date,
				provider,
				id_type,
				COUNT(*) as total_verifications,
				SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) as successful,
				SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
				AVG(match_score) as avg_match_score,
				AVG(response_time_ms) as avg_response_time_ms,
				PERCENTILE(response_time_ms, 0.95) as p95_response_time_ms
			FROM identity_verifications
			GROUP BY date(event_time), provider, id_type
		`,
		"document_processing_metrics": `
			CREATE OR REPLACE VIEW document_processing_metrics AS
			SELECT 
				date(event_time) as date,
				document_type,
				COUNT(*) as total_documents,
				AVG(ocr_confidence) as avg_ocr_confidence,
				AVG(vlm_confidence) as avg_vlm_confidence,
				AVG(processing_time_ms) as avg_processing_time_ms,
				SUM(CASE WHEN status = 'VALIDATED' THEN 1 ELSE 0 END) as validated,
				SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) as invalid
			FROM document_processing
			GROUP BY date(event_time), document_type
		`,
		"screening_summary": `
			CREATE OR REPLACE VIEW screening_summary AS
			SELECT 
				date(event_time) as date,
				screening_type,
				COUNT(*) as total_screenings,
				SUM(CASE WHEN status = 'CLEAR' THEN 1 ELSE 0 END) as clear,
				SUM(CASE WHEN status = 'POTENTIAL_MATCH' THEN 1 ELSE 0 END) as potential_matches,
				SUM(CASE WHEN status = 'CONFIRMED_MATCH' THEN 1 ELSE 0 END) as confirmed_matches,
				AVG(highest_score) as avg_match_score,
				AVG(response_time_ms) as avg_response_time_ms
			FROM screening_results
			GROUP BY date(event_time), screening_type
		`,
	}
}
