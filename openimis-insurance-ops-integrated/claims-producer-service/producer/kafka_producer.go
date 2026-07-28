package producer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"claims-producer-service/config"
	"claims-producer-service/metrics"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/linkedin/goavro/v2"
)

// KafkaProducer wraps the confluent-kafka-go producer.
type KafkaProducer struct {
	p           *kafka.Producer
	codec       *goavro.Codec
	config      *config.Config
	deliveryChan chan kafka.Event
}

// NewKafkaProducer creates and initializes a new KafkaProducer.
func NewKafkaProducer(cfg *config.Config) (*KafkaProducer, error) {
	// Load the Avro schema from the versioned schema file. The schema is also registered
	// with the Confluent Schema Registry (SCHEMA_REGISTRY_URL) to enforce compatibility
	// across all producers and consumers in the claims pipeline.

	schemaBytes, err := os.ReadFile("../pkg/avro/claim_event.avsc")
	if err != nil {
		return nil, fmt.Errorf("failed to read Avro schema: %w", err)
	}
	codec, err := goavro.NewCodec(string(schemaBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create Avro codec: %w", err)
	}

	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.KafkaBroker,
		"acks":              "all",
		"retries":           5,
		"message.timeout.ms": 10000,
		"compression.codec": "snappy",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	return &KafkaProducer{
		p:           p,
		codec:       codec,
		config:      cfg,
		deliveryChan: make(chan kafka.Event),
	}, nil
}

// ClaimEvent is the structure of the event to be sent.
type ClaimEvent struct {
	ClaimID        string  `json:"claim_id"`
	PolicyID       string  `json:"policy_id"`
	EventType      string  `json:"event_type"`
	EventTimestamp int64   `json:"event_timestamp"`
	ClaimAmount    float64 `json:"claim_amount"`
	LossRatio      float64 `json:"loss_ratio"`
}

// Produce sends a ClaimEvent to Kafka.
func (kp *KafkaProducer) Produce(ctx context.Context, event ClaimEvent) error {
	// 1. Convert Go struct to Avro map
	avroMap := map[string]interface{}{
		"claim_id":        event.ClaimID,
		"policy_id":       event.PolicyID,
		"event_type":      event.EventType,
		"event_timestamp": event.EventTimestamp,
		"claim_amount":    event.ClaimAmount,
		"loss_ratio":      event.LossRatio,
	}

	// 2. Encode Avro map to binary
	binary, err := kp.codec.BinaryFromNative(nil, avroMap)
	if err != nil {
		metrics.KafkaProduceErrors.WithLabelValues(kp.config.KafkaTopic).Inc()
		return fmt.Errorf("failed to encode Avro: %w", err)
	}

	// 3. Extract trace ID for structured logging
	traceID := ctx.Value(kp.config.TraceHeader)
	if traceID == nil {
		traceID = "no-trace-id"
	}

	// 4. Produce message
	err = kp.p.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &kp.config.KafkaTopic, Partition: kafka.PartitionAny},
		Value:          binary,
		Headers: []kafka.Header{
			{Key: "trace-id", Value: []byte(fmt.Sprintf("%v", traceID))},
			{Key: "source-service", Value: []byte(kp.config.ServiceName)},
		},
		Timestamp: time.Now(),
	}, kp.deliveryChan)

	if err != nil {
		metrics.KafkaProduceErrors.WithLabelValues(kp.config.KafkaTopic).Inc()
		log.Printf("TRACE_ID=%v | Failed to produce message: %v", traceID, err)
		return fmt.Errorf("failed to produce message: %w", err)
	}

	metrics.KafkaMessagesProduced.WithLabelValues(kp.config.KafkaTopic).Inc()
	log.Printf("TRACE_ID=%v | Produced message to topic %s for claim %s", traceID, kp.config.KafkaTopic, event.ClaimID)
	return nil
}

// HandleDeliveryReports handles asynchronous delivery reports from Kafka.
func (kp *KafkaProducer) HandleDeliveryReports() {
	for e := range kp.p.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				metrics.KafkaDeliveryErrors.WithLabelValues(kp.config.KafkaTopic).Inc()
				log.Printf("Delivery failed: %v", ev.TopicPartition.Error)
			} else {
				metrics.KafkaDeliverySuccesses.WithLabelValues(kp.config.KafkaTopic).Inc()
				// log.Printf("Delivered message to topic %s [%d] at offset %v",
				// 	*ev.TopicPartition.Topic, ev.TopicPartition.Partition, ev.TopicPartition.Offset)
			}
		}
	}
}

// Close closes the Kafka producer.
func (kp *KafkaProducer) Close() {
	// Wait for up to 10 seconds for any outstanding messages to be delivered.
	remaining := kp.p.Flush(10 * 1000)
	log.Printf("Flushed %d outstanding messages before closing producer.", remaining)
	kp.p.Close()
}

// GetLossRatio fetches the loss ratio from the configured API endpoint via real HTTP GET.
func GetLossRatio(ctx context.Context, apiURL string, policyID string) (float64, error) {
	if apiURL == "" {
		return 0.0, fmt.Errorf("loss ratio API URL not configured")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	reqURL := fmt.Sprintf("%s/api/v1/policies/%s/loss-ratio", apiURL, policyID)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return 0.0, fmt.Errorf("create loss ratio request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return 0.0, fmt.Errorf("call loss ratio API: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return 0.0, fmt.Errorf("policy %s not found in loss ratio API", policyID)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return 0.0, fmt.Errorf("loss ratio API status %d: %s", resp.StatusCode, b)
	}
	var result struct {
		LossRatio float64 `json:"loss_ratio"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0.0, fmt.Errorf("decode loss ratio response: %w", err)
	}
	traceID := ctx.Value("X-Request-ID")
	if traceID == nil {
		traceID = "no-trace-id"
	}
	log.Printf("TRACE_ID=%v | Loss Ratio API call to %s for policy %s returned: %.2f", traceID, apiURL, policyID, result.LossRatio)
	return result.LossRatio, nil
}

// ClaimUpdate is a structure for the incoming claim update.
type ClaimUpdate struct {
	ClaimID string `json:"claim_id"`
	Status  string `json:"status"` // REPORTED, APPROVED, PAID, DENIED
}

// ClaimsService is the real service for processing claim updates and producing events.
type ClaimsService struct {
	producer   *KafkaProducer
	topic      string
	config     *config.Config
	httpClient *http.Client
}

// NewClaimsService creates a new ClaimsService.
func NewClaimsService(p *KafkaProducer, topic string, cfg *config.Config) *ClaimsService {
	return &ClaimsService{
		producer:   p,
		topic:      topic,
		config:     cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// FetchClaim retrieves a claim from the claims service API.
func (cs *ClaimsService) FetchClaim(ctx context.Context, claimID string) (*ClaimEvent, error) {
	if cs.config.ClaimsServiceURL == "" {
		return nil, fmt.Errorf("claims service URL not configured")
	}
	reqURL := fmt.Sprintf("%s/api/v1/claims/%s", cs.config.ClaimsServiceURL, claimID)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create claim fetch request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := cs.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch claim: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("claim %s not found", claimID)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claims service status %d: %s", resp.StatusCode, b)
	}
	var claim ClaimEvent
	if err := json.NewDecoder(resp.Body).Decode(&claim); err != nil {
		return nil, fmt.Errorf("decode claim response: %w", err)
	}
	return &claim, nil
}

// ProcessClaimUpdate fetches claim details from the claims service, enriches with loss ratio, and produces the event.
func (cs *ClaimsService) ProcessClaimUpdate(ctx context.Context, update ClaimUpdate) error {
	// 1. Retrieve claim details from the real claims service
	claim, err := cs.FetchClaim(ctx, update.ClaimID)
	if err != nil {
		return fmt.Errorf("fetch claim %s: %w", update.ClaimID, err)
	}

	// 2. Event Enrichment: Get Loss Ratio from the real API
	lossRatio, err := GetLossRatio(ctx, cs.config.LossRatioAPI, claim.PolicyID)
	if err != nil {
		log.Printf("Warning: Failed to enrich with loss ratio: %v. Using 0.0", err)
		lossRatio = 0.0
	}

	// 3. Create the event
	event := ClaimEvent{
		ClaimID:        claim.ClaimID,
		PolicyID:       claim.PolicyID,
		EventType:      update.Status,
		EventTimestamp: time.Now().UnixMilli(),
		ClaimAmount:    claim.ClaimAmount,
		LossRatio:      lossRatio,
	}

	// 4. Produce the event
	return cs.producer.Produce(ctx, event)
}
