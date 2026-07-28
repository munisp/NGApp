package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

// OllamaDecisionEvent represents an AI agent decision event
type OllamaDecisionEvent struct {
	EventID       string                 `json:"event_id"`
	AgentName     string                 `json:"agent_name"`
	AgentVersion  string                 `json:"agent_version"`
	DecisionType  string                 `json:"decision_type"`
	Input         map[string]interface{} `json:"input"`
	Output        map[string]interface{} `json:"output"`
	Reasoning     string                 `json:"reasoning"`
	Confidence    float64                `json:"confidence"`
	TokensUsed    int                    `json:"tokens_used"`
	LatencyMs     float64                `json:"latency_ms"`
	Timestamp     time.Time              `json:"timestamp"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// OllamaKafkaProducer produces Ollama AI decisions to Kafka
type OllamaKafkaProducer struct {
	writer     *kafka.Writer
	topic      string
	metrics    *ProducerMetrics
	metricsMu  sync.RWMutex
}

// ProducerMetrics tracks producer performance
type ProducerMetrics struct {
	MessagesSent   int64
	BytesSent      int64
	Errors         int64
	LastSendTime   time.Time
}

// NewOllamaKafkaProducer creates a new Ollama Kafka producer
func NewOllamaKafkaProducer(topic string) *OllamaKafkaProducer {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "kafka-0:9092,kafka-1:9092,kafka-2:9092"
	}

	if topic == "" {
		topic = "ollama-decisions"
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
		Compression:  kafka.Gzip,
	}

	return &OllamaKafkaProducer{
		writer:  writer,
		topic:   topic,
		metrics: &ProducerMetrics{},
	}
}

// SendDecision sends an AI decision event to Kafka
func (p *OllamaKafkaProducer) SendDecision(ctx context.Context, event *OllamaDecisionEvent) error {
	if event.EventID == "" {
		event.EventID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(fmt.Sprintf("%s-%s", event.AgentName, event.EventID)),
		Value: data,
	}

	err = p.writer.WriteMessages(ctx, msg)
	if err != nil {
		p.metricsMu.Lock()
		p.metrics.Errors++
		p.metricsMu.Unlock()
		return fmt.Errorf("failed to send message: %w", err)
	}

	p.metricsMu.Lock()
	p.metrics.MessagesSent++
	p.metrics.BytesSent += int64(len(data))
	p.metrics.LastSendTime = time.Now()
	p.metricsMu.Unlock()

	return nil
}

// SendUnderwritingDecision sends an underwriting AI decision
func (p *OllamaKafkaProducer) SendUnderwritingDecision(
	ctx context.Context,
	applicationID string,
	customerID string,
	decision string,
	reasoning string,
	riskScore float64,
	premiumAdjustment float64,
	conditions []string,
	latencyMs float64,
) error {
	event := &OllamaDecisionEvent{
		AgentName:    "underwriting-agent",
		AgentVersion: "1.0.0",
		DecisionType: "underwriting",
		Input: map[string]interface{}{
			"application_id": applicationID,
			"customer_id":    customerID,
		},
		Output: map[string]interface{}{
			"decision":           decision,
			"risk_score":         riskScore,
			"premium_adjustment": premiumAdjustment,
			"conditions":         conditions,
		},
		Reasoning:  reasoning,
		Confidence: 1.0 - (riskScore * 0.5), // Higher risk = lower confidence
		LatencyMs:  latencyMs,
		Metadata: map[string]interface{}{
			"application_id": applicationID,
			"customer_id":    customerID,
		},
	}

	return p.SendDecision(ctx, event)
}

// SendClaimsAdjudicationDecision sends a claims adjudication AI decision
func (p *OllamaKafkaProducer) SendClaimsAdjudicationDecision(
	ctx context.Context,
	claimID string,
	policyID string,
	decision string,
	reasoning string,
	approvedAmount float64,
	fraudIndicators []string,
	latencyMs float64,
) error {
	event := &OllamaDecisionEvent{
		AgentName:    "claims-adjudication-agent",
		AgentVersion: "1.0.0",
		DecisionType: "claims_adjudication",
		Input: map[string]interface{}{
			"claim_id":  claimID,
			"policy_id": policyID,
		},
		Output: map[string]interface{}{
			"decision":         decision,
			"approved_amount":  approvedAmount,
			"fraud_indicators": fraudIndicators,
		},
		Reasoning:  reasoning,
		Confidence: 0.95,
		LatencyMs:  latencyMs,
		Metadata: map[string]interface{}{
			"claim_id":  claimID,
			"policy_id": policyID,
		},
	}

	return p.SendDecision(ctx, event)
}

// SendCustomerServiceDecision sends a customer service AI decision
func (p *OllamaKafkaProducer) SendCustomerServiceDecision(
	ctx context.Context,
	conversationID string,
	customerID string,
	intent string,
	response string,
	sentiment string,
	escalationRequired bool,
	latencyMs float64,
) error {
	event := &OllamaDecisionEvent{
		AgentName:    "customer-service-agent",
		AgentVersion: "1.0.0",
		DecisionType: "customer_service",
		Input: map[string]interface{}{
			"conversation_id": conversationID,
			"customer_id":     customerID,
		},
		Output: map[string]interface{}{
			"intent":              intent,
			"response":            response,
			"sentiment":           sentiment,
			"escalation_required": escalationRequired,
		},
		Reasoning:  fmt.Sprintf("Detected intent: %s, sentiment: %s", intent, sentiment),
		Confidence: 0.90,
		LatencyMs:  latencyMs,
		Metadata: map[string]interface{}{
			"conversation_id": conversationID,
			"customer_id":     customerID,
		},
	}

	return p.SendDecision(ctx, event)
}

// SendDocumentAnalysisDecision sends a document analysis AI decision
func (p *OllamaKafkaProducer) SendDocumentAnalysisDecision(
	ctx context.Context,
	documentID string,
	documentType string,
	extractedData map[string]interface{},
	validationResult string,
	confidence float64,
	latencyMs float64,
) error {
	event := &OllamaDecisionEvent{
		AgentName:    "document-analysis-agent",
		AgentVersion: "1.0.0",
		DecisionType: "document_analysis",
		Input: map[string]interface{}{
			"document_id":   documentID,
			"document_type": documentType,
		},
		Output: map[string]interface{}{
			"extracted_data":    extractedData,
			"validation_result": validationResult,
		},
		Reasoning:  fmt.Sprintf("Analyzed %s document with %d extracted fields", documentType, len(extractedData)),
		Confidence: confidence,
		LatencyMs:  latencyMs,
		Metadata: map[string]interface{}{
			"document_id":   documentID,
			"document_type": documentType,
		},
	}

	return p.SendDecision(ctx, event)
}

// GetMetrics returns current producer metrics
func (p *OllamaKafkaProducer) GetMetrics() ProducerMetrics {
	p.metricsMu.RLock()
	defer p.metricsMu.RUnlock()
	return *p.metrics
}

// Close closes the Kafka producer
func (p *OllamaKafkaProducer) Close() error {
	return p.writer.Close()
}

func main() {
	log.Println("Starting Ollama Kafka Producer...")

	producer := NewOllamaKafkaProducer("ollama-decisions")
	defer producer.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down...")
		cancel()
	}()

	// Example: Send sample decisions
	err := producer.SendUnderwritingDecision(
		ctx,
		"app-12345",
		"cust-67890",
		"APPROVED",
		"Customer has good credit history and low risk profile",
		0.25,
		-5.0,
		[]string{"annual_checkup_required"},
		150.5,
	)
	if err != nil {
		log.Printf("Failed to send underwriting decision: %v", err)
	}

	err = producer.SendClaimsAdjudicationDecision(
		ctx,
		"claim-12345",
		"policy-67890",
		"APPROVED",
		"Claim is valid and within policy coverage",
		250000.0,
		[]string{},
		200.3,
	)
	if err != nil {
		log.Printf("Failed to send claims decision: %v", err)
	}

	log.Println("Sample decisions sent successfully")
	log.Printf("Metrics: %+v", producer.GetMetrics())
}
