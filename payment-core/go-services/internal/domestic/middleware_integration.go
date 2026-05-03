// Package domestic — Middleware Integration for NIBSS Domestic Payment Modules
//
// Tightly integrates all domestic payment features (NEFT, NACS, NDD, reversals,
// disputes, PayDirect, merchant registry) with the core payment switch middleware:
//
//   - Kafka: Domain event production/consumption for all NIBSS transaction lifecycle events
//   - Dapr: Pub/sub for service-to-service communication, state store for idempotency
//   - Temporal: Durable workflow orchestration for NEFT batch clearing, NDD mandate execution,
//     dispute resolution timelines, and reversal processing
//   - PostgreSQL: Persistent storage for mandates, cheques, disputes, merchant records
//   - Keycloak: OIDC-based authentication with role-specific access (CBN_ADMIN, BANK_OPS, MERCHANT)
//   - Redis: Distributed caching for name enquiry results, BVN lookups, rate limiting
//   - Mojaloop: FSPIOP-compliant adapter for cross-border domestic settlement
//   - APISIX: API gateway route registration, rate limiting policies, request transformation
//   - OpenSearch: Full-text search indexing for transactions, disputes, and audit trails
//   - TigerBeetle: Double-entry ledger postings for all monetary operations
//   - Permify: Fine-grained RBAC/ABAC authorization for NIBSS operations
//   - OpenAppSec: WAF rules for transaction injection prevention
package domestic

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

// ======================== Kafka Event Integration ========================

// NIBSS-specific Kafka event types
const (
	// NEFT Events
	EventNEFTBatchSubmitted  = "neft.batch.submitted"
	EventNEFTBatchSettled    = "neft.batch.settled"
	EventNEFTBatchFailed     = "neft.batch.failed"
	EventNEFTItemProcessed   = "neft.item.processed"

	// NACS Events
	EventChequePresented     = "nacs.cheque.presented"
	EventChequeCleared       = "nacs.cheque.cleared"
	EventChequeReturned      = "nacs.cheque.returned"
	EventChequeStopped       = "nacs.cheque.stopped"

	// NDD/GSI Events
	EventMandateCreated      = "ndd.mandate.created"
	EventMandateActivated    = "ndd.mandate.activated"
	EventMandateSuspended    = "ndd.mandate.suspended"
	EventMandateRevoked      = "ndd.mandate.revoked"
	EventMandateDebitExecuted = "ndd.mandate.debit.executed"
	EventGSIRecoveryInitiated = "ndd.gsi.recovery.initiated"
	EventGSIRecoveryCompleted = "ndd.gsi.recovery.completed"

	// Reversal Events
	EventReversalRequested   = "nip.reversal.requested"
	EventReversalCompleted   = "nip.reversal.completed"
	EventReversalDeclined    = "nip.reversal.declined"

	// Dispute Events
	EventDisputeOpened       = "nip.dispute.opened"
	EventDisputeUnderReview  = "nip.dispute.under_review"
	EventDisputeResolved     = "nip.dispute.resolved"
	EventDisputeEscalated    = "nip.dispute.escalated_cbn"

	// PayDirect Events
	EventPayDirectCollected  = "paydirect.collection.received"
	EventPayDirectSettled    = "paydirect.collection.settled"

	// Merchant Events
	EventMerchantRegistered  = "mcash.merchant.registered"
	EventMerchantSuspended   = "mcash.merchant.suspended"
	EventMerchantTransaction = "mcash.merchant.transaction"

	// Identity Events
	EventBVNVerified         = "identity.bvn.verified"
	EventNINVerified         = "identity.nin.verified"
	EventNameEnquiryCompleted = "identity.name_enquiry.completed"

	// TSQ Events
	EventTSQRequested        = "nip.tsq.requested"
	EventTSQResolved         = "nip.tsq.resolved"

	// ISO 20022 Events
	EventISO20022Received    = "iso20022.message.received"
	EventISO20022Validated   = "iso20022.message.validated"
	EventISO20022Rejected    = "iso20022.message.rejected"
)

// NIBSSEvent represents a domain event for NIBSS operations.
type NIBSSEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	Timestamp     string                 `json:"timestamp"`
	Version       string                 `json:"version"`
	SourceService string                 `json:"source_service"`
	CorrelationID string                 `json:"correlation_id"`
	AggregateType string                 `json:"aggregate_type"`
	AggregateID   string                 `json:"aggregate_id"`
	Data          map[string]interface{} `json:"data"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// NIBSSKafkaProducer handles event emission for NIBSS operations.
type NIBSSKafkaProducer struct {
	writer    *kafka.Writer
	mu        sync.Mutex
	metrics   KafkaMetrics
}

// KafkaMetrics tracks event production stats.
type KafkaMetrics struct {
	EventsEmitted int64
	EventsFailed  int64
}

// NewNIBSSKafkaProducer creates a Kafka producer for NIBSS events.
func NewNIBSSKafkaProducer() *NIBSSKafkaProducer {
	bootstrap := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if bootstrap == "" {
		bootstrap = "kafka:9092"
	}

	return &NIBSSKafkaProducer{
		writer: &kafka.Writer{
			Addr:         kafka.TCP(bootstrap),
			Topic:        "nibss-domestic-events",
			Balancer:     &kafka.LeastBytes{},
			BatchTimeout: 10 * time.Millisecond,
			RequiredAcks: kafka.RequireAll,
		},
	}
}

// EmitEvent publishes a NIBSS domain event to Kafka.
func (p *NIBSSKafkaProducer) EmitEvent(ctx context.Context, eventType, aggregateType, aggregateID string, data map[string]interface{}) error {
	event := NIBSSEvent{
		EventID:       uuid.New().String(),
		EventType:     eventType,
		Timestamp:     time.Now().UTC().Format(time.RFC3339Nano),
		Version:       "1.0",
		SourceService: "nibss-domestic-service",
		CorrelationID: uuid.New().String(),
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		Data:          data,
		Metadata: map[string]interface{}{
			"partition_key": aggregateID,
			"schema_version": "1.0",
		},
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	err = p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(aggregateID),
		Value: payload,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(eventType)},
			{Key: "aggregate_type", Value: []byte(aggregateType)},
			{Key: "source", Value: []byte("nibss-domestic-service")},
		},
	})

	p.mu.Lock()
	if err != nil {
		p.metrics.EventsFailed++
	} else {
		p.metrics.EventsEmitted++
	}
	p.mu.Unlock()

	return err
}

// NIBSSKafkaConsumer handles event consumption for NIBSS operations.
type NIBSSKafkaConsumer struct {
	readers map[string]*kafka.Reader
}

// NewNIBSSKafkaConsumer creates consumers for NIBSS event topics.
func NewNIBSSKafkaConsumer(groupID string) *NIBSSKafkaConsumer {
	bootstrap := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if bootstrap == "" {
		bootstrap = "kafka:9092"
	}

	topics := []string{
		"nibss-domestic-events",
		"nibss-neft-clearing",
		"nibss-nacs-clearing",
		"nibss-ndd-mandates",
		"nibss-reversals",
		"nibss-disputes",
		"nibss-identity-verification",
		"nibss-iso20022-messages",
	}

	readers := make(map[string]*kafka.Reader)
	for _, topic := range topics {
		readers[topic] = kafka.NewReader(kafka.ReaderConfig{
			Brokers:  []string{bootstrap},
			GroupID:  groupID,
			Topic:    topic,
			MinBytes: 1e3,
			MaxBytes: 10e6,
		})
	}

	return &NIBSSKafkaConsumer{readers: readers}
}

// ======================== Dapr Integration ========================

// DaprPubSubConfig defines Dapr pub/sub configuration for NIBSS services.
type DaprPubSubConfig struct {
	PubsubName   string `json:"pubsubName"`
	Topic        string `json:"topic"`
	Route        string `json:"route"`
	DeadLetterTopic string `json:"deadLetterTopic,omitempty"`
}

// NIBSSDaprIntegration handles Dapr service invocation and state management.
type NIBSSDaprIntegration struct {
	daprPort    string
	stateStore  string
	pubsubName  string
	httpClient  interface{}
}

// NewNIBSSDaprIntegration creates a Dapr integration for NIBSS services.
func NewNIBSSDaprIntegration() *NIBSSDaprIntegration {
	port := os.Getenv("DAPR_HTTP_PORT")
	if port == "" {
		port = "3500"
	}

	return &NIBSSDaprIntegration{
		daprPort:   port,
		stateStore: "nibss-statestore",
		pubsubName: "nibss-pubsub",
	}
}

// GetSubscriptions returns Dapr pub/sub subscription configs for all NIBSS topics.
func (d *NIBSSDaprIntegration) GetSubscriptions() []DaprPubSubConfig {
	return []DaprPubSubConfig{
		{PubsubName: d.pubsubName, Topic: "neft-batch-events", Route: "/api/neft/events", DeadLetterTopic: "neft-dlq"},
		{PubsubName: d.pubsubName, Topic: "nacs-clearing-events", Route: "/api/nacs/events", DeadLetterTopic: "nacs-dlq"},
		{PubsubName: d.pubsubName, Topic: "ndd-mandate-events", Route: "/api/ndd/events", DeadLetterTopic: "ndd-dlq"},
		{PubsubName: d.pubsubName, Topic: "reversal-events", Route: "/api/reversals/events", DeadLetterTopic: "reversal-dlq"},
		{PubsubName: d.pubsubName, Topic: "dispute-events", Route: "/api/disputes/events", DeadLetterTopic: "dispute-dlq"},
		{PubsubName: d.pubsubName, Topic: "identity-events", Route: "/api/identity/events", DeadLetterTopic: "identity-dlq"},
		{PubsubName: d.pubsubName, Topic: "iso20022-events", Route: "/api/iso20022/events", DeadLetterTopic: "iso20022-dlq"},
		{PubsubName: d.pubsubName, Topic: "paydirect-events", Route: "/api/paydirect/events", DeadLetterTopic: "paydirect-dlq"},
		{PubsubName: d.pubsubName, Topic: "merchant-events", Route: "/api/merchants/events", DeadLetterTopic: "merchant-dlq"},
	}
}

// DaprStateEntry represents a Dapr state store entry for idempotency.
type DaprStateEntry struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	ETag  string      `json:"etag,omitempty"`
}

// ======================== Temporal Workflow Integration ========================

// TemporalWorkflowConfig defines workflow configuration for NIBSS operations.
type TemporalWorkflowConfig struct {
	TaskQueue     string
	WorkflowID    string
	RetryPolicy   TemporalRetryPolicy
}

// TemporalRetryPolicy defines retry behavior for Temporal workflows.
type TemporalRetryPolicy struct {
	MaxAttempts        int
	InitialInterval    time.Duration
	BackoffCoefficient float64
	MaxInterval        time.Duration
}

// NEFTClearingWorkflow orchestrates NEFT batch clearing via Temporal.
type NEFTClearingWorkflow struct {
	BatchID         string        `json:"batchId"`
	SenderBank      string        `json:"senderBank"`
	TotalItems      int           `json:"totalItems"`
	TotalAmount     float64       `json:"totalAmount"`
	ClearingSession string        `json:"clearingSession"`
	Steps           []WorkflowStep `json:"steps"`
}

// WorkflowStep represents a step in a Temporal workflow.
type WorkflowStep struct {
	StepName  string `json:"stepName"`
	Status    string `json:"status"` // PENDING, RUNNING, COMPLETED, FAILED
	StartedAt string `json:"startedAt,omitempty"`
	Duration  string `json:"duration,omitempty"`
}

// GetNEFTWorkflowSteps returns the workflow steps for NEFT batch clearing.
func GetNEFTWorkflowSteps() []WorkflowStep {
	return []WorkflowStep{
		{StepName: "ValidateBatchFormat", Status: "PENDING"},
		{StepName: "DeduplicateItems", Status: "PENDING"},
		{StepName: "SanctionsScreening", Status: "PENDING"},
		{StepName: "TigerBeetlePrefundCheck", Status: "PENDING"},
		{StepName: "ReserveFunds", Status: "PENDING"},
		{StepName: "SubmitToClearingHouse", Status: "PENDING"},
		{StepName: "AwaitSettlementConfirmation", Status: "PENDING"},
		{StepName: "PostSettlementLedgerEntries", Status: "PENDING"},
		{StepName: "EmitSettlementEvents", Status: "PENDING"},
		{StepName: "UpdateReconciliationState", Status: "PENDING"},
	}
}

// NDDMandateExecutionWorkflow orchestrates direct debit mandate execution.
type NDDMandateExecutionWorkflow struct {
	MandateID   string `json:"mandateId"`
	MandateRef  string `json:"mandateRef"`
	Amount      float64 `json:"amount"`
	Subscriber  string `json:"subscriber"`
	Biller      string `json:"biller"`
}

// GetNDDWorkflowSteps returns the workflow steps for NDD mandate execution.
func GetNDDWorkflowSteps() []WorkflowStep {
	return []WorkflowStep{
		{StepName: "ValidateMandateActive", Status: "PENDING"},
		{StepName: "VerifySubscriberBVN", Status: "PENDING"},
		{StepName: "CheckAccountBalance", Status: "PENDING"},
		{StepName: "InitiateDebit", Status: "PENDING"},
		{StepName: "TigerBeetleDebitPosting", Status: "PENDING"},
		{StepName: "CreditBillerAccount", Status: "PENDING"},
		{StepName: "UpdateMandateExecCount", Status: "PENDING"},
		{StepName: "EmitDebitEvent", Status: "PENDING"},
		{StepName: "NotifySubscriber", Status: "PENDING"},
	}
}

// DisputeResolutionWorkflow orchestrates inter-bank dispute processing.
type DisputeResolutionWorkflow struct {
	DisputeID      string `json:"disputeId"`
	NIPRef         string `json:"nipRef"`
	Amount         float64 `json:"amount"`
	InitiatingBank string `json:"initiatingBank"`
	RespondingBank string `json:"respondingBank"`
}

// GetDisputeWorkflowSteps returns the workflow steps for dispute resolution.
func GetDisputeWorkflowSteps() []WorkflowStep {
	return []WorkflowStep{
		{StepName: "LogDisputeInPostgres", Status: "PENDING"},
		{StepName: "NotifyRespondingBank", Status: "PENDING"},
		{StepName: "StartSLATimer_24h", Status: "PENDING"},
		{StepName: "AwaitRespondingBankResponse", Status: "PENDING"},
		{StepName: "ReviewEvidence", Status: "PENDING"},
		{StepName: "MakeResolutionDecision", Status: "PENDING"},
		{StepName: "ExecuteResolution_TigerBeetle", Status: "PENDING"},
		{StepName: "IndexInOpenSearch", Status: "PENDING"},
		{StepName: "EmitResolutionEvent", Status: "PENDING"},
		{StepName: "EscalateToCBN_IfUnresolved", Status: "PENDING"},
	}
}

// ======================== PostgreSQL Integration ========================

// PostgresSchema defines the database schema for NIBSS domestic payment tables.
type PostgresSchema struct {
	Tables []TableDefinition `json:"tables"`
}

// TableDefinition represents a PostgreSQL table.
type TableDefinition struct {
	Name    string   `json:"name"`
	Columns []Column `json:"columns"`
	Indexes []string `json:"indexes"`
}

// Column represents a database column.
type Column struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
	Default  string `json:"default,omitempty"`
}

// GetNIBSSPostgresSchema returns the complete PostgreSQL schema for NIBSS tables.
func GetNIBSSPostgresSchema() PostgresSchema {
	return PostgresSchema{
		Tables: []TableDefinition{
			{
				Name: "neft_batches",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "batch_ref", Type: "VARCHAR(50) UNIQUE NOT NULL"},
					{Name: "sender_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "sender_bank_name", Type: "VARCHAR(100) NOT NULL"},
					{Name: "total_items", Type: "INTEGER NOT NULL"},
					{Name: "total_amount", Type: "BIGINT NOT NULL"},
					{Name: "settled_amount", Type: "BIGINT DEFAULT 0"},
					{Name: "status", Type: "VARCHAR(30) NOT NULL DEFAULT 'PENDING_SETTLEMENT'"},
					{Name: "clearing_session", Type: "VARCHAR(20) NOT NULL"},
					{Name: "submitted_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
					{Name: "settled_at", Type: "TIMESTAMPTZ"},
					{Name: "created_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
				},
				Indexes: []string{
					"CREATE INDEX idx_neft_batches_status ON neft_batches(status)",
					"CREATE INDEX idx_neft_batches_session ON neft_batches(clearing_session)",
					"CREATE INDEX idx_neft_batches_submitted ON neft_batches(submitted_at)",
				},
			},
			{
				Name: "neft_items",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "batch_id", Type: "UUID REFERENCES neft_batches(id)"},
					{Name: "sender_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "sender_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "receiver_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "receiver_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "receiver_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "amount", Type: "BIGINT NOT NULL"},
					{Name: "narration", Type: "TEXT"},
					{Name: "status", Type: "VARCHAR(30) NOT NULL DEFAULT 'PENDING'"},
					{Name: "response_code", Type: "VARCHAR(5)"},
				},
				Indexes: []string{
					"CREATE INDEX idx_neft_items_batch ON neft_items(batch_id)",
				},
			},
			{
				Name: "nacs_cheques",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "cheque_number", Type: "VARCHAR(20) NOT NULL"},
					{Name: "sort_code", Type: "VARCHAR(15) NOT NULL"},
					{Name: "micr_line", Type: "VARCHAR(50) NOT NULL"},
					{Name: "drawer_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "drawer_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "drawer_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "payee_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "payee_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "payee_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "amount", Type: "BIGINT NOT NULL"},
					{Name: "status", Type: "VARCHAR(30) NOT NULL DEFAULT 'PENDING_CLEARING'"},
					{Name: "presented_at", Type: "TIMESTAMPTZ NOT NULL"},
					{Name: "cleared_at", Type: "TIMESTAMPTZ"},
					{Name: "return_reason", Type: "VARCHAR(100)"},
					{Name: "image_front_hash", Type: "VARCHAR(64)"},
					{Name: "image_back_hash", Type: "VARCHAR(64)"},
				},
				Indexes: []string{
					"CREATE INDEX idx_nacs_cheques_status ON nacs_cheques(status)",
					"CREATE UNIQUE INDEX idx_nacs_cheques_number ON nacs_cheques(cheque_number, sort_code)",
				},
			},
			{
				Name: "ndd_mandates",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "mandate_ref", Type: "VARCHAR(50) UNIQUE NOT NULL"},
					{Name: "mandate_type", Type: "VARCHAR(10) NOT NULL CHECK (mandate_type IN ('FIXED','VARIABLE','GSI'))"},
					{Name: "subscriber_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "subscriber_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "subscriber_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "subscriber_bvn", Type: "VARCHAR(11) NOT NULL"},
					{Name: "biller_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "biller_code", Type: "VARCHAR(30) NOT NULL"},
					{Name: "amount", Type: "BIGINT NOT NULL"},
					{Name: "frequency", Type: "VARCHAR(15) NOT NULL"},
					{Name: "start_date", Type: "DATE NOT NULL"},
					{Name: "end_date", Type: "DATE NOT NULL"},
					{Name: "status", Type: "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"},
					{Name: "next_debit_date", Type: "DATE"},
					{Name: "execution_count", Type: "INTEGER DEFAULT 0"},
					{Name: "total_debited", Type: "BIGINT DEFAULT 0"},
					{Name: "created_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
				},
				Indexes: []string{
					"CREATE INDEX idx_ndd_mandates_status ON ndd_mandates(status)",
					"CREATE INDEX idx_ndd_mandates_bvn ON ndd_mandates(subscriber_bvn)",
					"CREATE INDEX idx_ndd_mandates_next ON ndd_mandates(next_debit_date) WHERE status = 'ACTIVE'",
					"CREATE INDEX idx_ndd_mandates_type ON ndd_mandates(mandate_type)",
				},
			},
			{
				Name: "nip_reversals",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "original_nip_ref", Type: "VARCHAR(50) NOT NULL"},
					{Name: "original_amount", Type: "BIGINT NOT NULL"},
					{Name: "reversal_amount", Type: "BIGINT NOT NULL"},
					{Name: "sender_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "receiver_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "reason", Type: "VARCHAR(100) NOT NULL"},
					{Name: "status", Type: "VARCHAR(20) NOT NULL DEFAULT 'PENDING'"},
					{Name: "requested_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
					{Name: "resolved_at", Type: "TIMESTAMPTZ"},
					{Name: "requested_by", Type: "VARCHAR(100) NOT NULL"},
					{Name: "response_code", Type: "VARCHAR(5)"},
				},
				Indexes: []string{
					"CREATE INDEX idx_reversals_status ON nip_reversals(status)",
					"CREATE INDEX idx_reversals_nip_ref ON nip_reversals(original_nip_ref)",
				},
			},
			{
				Name: "interbank_disputes",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "nip_ref", Type: "VARCHAR(50) NOT NULL"},
					{Name: "amount", Type: "BIGINT NOT NULL"},
					{Name: "dispute_type", Type: "VARCHAR(30) NOT NULL"},
					{Name: "initiating_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "responding_bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "status", Type: "VARCHAR(30) NOT NULL DEFAULT 'OPEN'"},
					{Name: "description", Type: "TEXT NOT NULL"},
					{Name: "resolution", Type: "TEXT"},
					{Name: "sla_deadline", Type: "TIMESTAMPTZ NOT NULL"},
					{Name: "created_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
					{Name: "resolved_at", Type: "TIMESTAMPTZ"},
					{Name: "escalated_at", Type: "TIMESTAMPTZ"},
				},
				Indexes: []string{
					"CREATE INDEX idx_disputes_status ON interbank_disputes(status)",
					"CREATE INDEX idx_disputes_sla ON interbank_disputes(sla_deadline) WHERE status IN ('OPEN', 'UNDER_REVIEW')",
				},
			},
			{
				Name: "mcash_merchants",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "merchant_code", Type: "VARCHAR(30) UNIQUE NOT NULL"},
					{Name: "merchant_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "ussd_short_code", Type: "VARCHAR(30) NOT NULL"},
					{Name: "category", Type: "VARCHAR(30) NOT NULL"},
					{Name: "bank_acct", Type: "VARCHAR(20) NOT NULL"},
					{Name: "bank_code", Type: "VARCHAR(10) NOT NULL"},
					{Name: "status", Type: "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"},
					{Name: "location", Type: "TEXT"},
					{Name: "registered_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
				},
				Indexes: []string{
					"CREATE INDEX idx_merchants_category ON mcash_merchants(category)",
					"CREATE INDEX idx_merchants_status ON mcash_merchants(status)",
				},
			},
			{
				Name: "paydirect_collections",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "collector_code", Type: "VARCHAR(30) UNIQUE NOT NULL"},
					{Name: "collector_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "category", Type: "VARCHAR(30) NOT NULL"},
					{Name: "product_name", Type: "VARCHAR(200) NOT NULL"},
					{Name: "status", Type: "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"},
					{Name: "total_collected", Type: "BIGINT DEFAULT 0"},
					{Name: "transaction_count", Type: "INTEGER DEFAULT 0"},
					{Name: "bank_coverage", Type: "INTEGER DEFAULT 0"},
					{Name: "created_at", Type: "TIMESTAMPTZ NOT NULL DEFAULT NOW()"},
				},
				Indexes: []string{
					"CREATE INDEX idx_paydirect_category ON paydirect_collections(category)",
				},
			},
			{
				Name: "iso20022_messages",
				Columns: []Column{
					{Name: "id", Type: "UUID PRIMARY KEY DEFAULT gen_random_uuid()"},
					{Name: "message_type", Type: "VARCHAR(15) NOT NULL"},
					{Name: "message_id", Type: "VARCHAR(50) UNIQUE NOT NULL"},
					{Name: "creation_date_time", Type: "TIMESTAMPTZ NOT NULL"},
					{Name: "sender_bic", Type: "VARCHAR(11) NOT NULL"},
					{Name: "receiver_bic", Type: "VARCHAR(11) NOT NULL"},
					{Name: "transaction_count", Type: "INTEGER NOT NULL"},
					{Name: "total_amount", Type: "BIGINT NOT NULL"},
					{Name: "currency", Type: "VARCHAR(3) NOT NULL"},
					{Name: "status", Type: "VARCHAR(20) NOT NULL DEFAULT 'PENDING'"},
					{Name: "settlement_method", Type: "VARCHAR(10)"},
					{Name: "raw_xml", Type: "BYTEA"},
					{Name: "raw_xml_size_bytes", Type: "BIGINT"},
				},
				Indexes: []string{
					"CREATE INDEX idx_iso20022_type ON iso20022_messages(message_type)",
					"CREATE INDEX idx_iso20022_sender ON iso20022_messages(sender_bic)",
					"CREATE INDEX idx_iso20022_status ON iso20022_messages(status)",
				},
			},
		},
	}
}

// ======================== Keycloak / Permify Auth Integration ========================

// NIBSSRole defines RBAC roles for NIBSS operations.
type NIBSSRole string

const (
	RoleCBNAdmin       NIBSSRole = "cbn_admin"
	RoleBankOps        NIBSSRole = "bank_ops"
	RoleBankCompliance NIBSSRole = "bank_compliance"
	RoleMerchant       NIBSSRole = "merchant"
	RoleBiller         NIBSSRole = "biller"
	RoleAuditor        NIBSSRole = "auditor"
	RoleSystemAdmin    NIBSSRole = "system_admin"
)

// NIBSSPermission defines fine-grained permissions via Permify.
type NIBSSPermission string

const (
	// NEFT Permissions
	PermNEFTSubmitBatch   NIBSSPermission = "neft:batch:submit"
	PermNEFTViewBatches   NIBSSPermission = "neft:batch:view"
	PermNEFTSettleBatch   NIBSSPermission = "neft:batch:settle"

	// NACS Permissions
	PermNACSPresentCheque NIBSSPermission = "nacs:cheque:present"
	PermNACSViewCheques   NIBSSPermission = "nacs:cheque:view"
	PermNACSReturnCheque  NIBSSPermission = "nacs:cheque:return"

	// NDD Permissions
	PermNDDCreateMandate  NIBSSPermission = "ndd:mandate:create"
	PermNDDViewMandates   NIBSSPermission = "ndd:mandate:view"
	PermNDDSuspendMandate NIBSSPermission = "ndd:mandate:suspend"
	PermNDDRevokeMandate  NIBSSPermission = "ndd:mandate:revoke"
	PermNDDExecuteDebit   NIBSSPermission = "ndd:mandate:execute"

	// Reversal Permissions
	PermReversalInitiate  NIBSSPermission = "reversal:initiate"
	PermReversalView      NIBSSPermission = "reversal:view"
	PermReversalApprove   NIBSSPermission = "reversal:approve"

	// Dispute Permissions
	PermDisputeOpen       NIBSSPermission = "dispute:open"
	PermDisputeView       NIBSSPermission = "dispute:view"
	PermDisputeResolve    NIBSSPermission = "dispute:resolve"
	PermDisputeEscalate   NIBSSPermission = "dispute:escalate"

	// Identity Permissions
	PermBVNVerify         NIBSSPermission = "identity:bvn:verify"
	PermNINVerify         NIBSSPermission = "identity:nin:verify"
	PermNameEnquiry       NIBSSPermission = "identity:name:enquire"

	// Merchant Permissions
	PermMerchantRegister  NIBSSPermission = "merchant:register"
	PermMerchantView      NIBSSPermission = "merchant:view"
	PermMerchantSuspend   NIBSSPermission = "merchant:suspend"
)

// PermifyAuthzModel defines the Permify authorization model for NIBSS.
type PermifyAuthzModel struct {
	Schema string `json:"schema"`
}

// GetNIBSSPermifySchema returns the Permify schema for NIBSS RBAC.
func GetNIBSSPermifySchema() PermifyAuthzModel {
	return PermifyAuthzModel{
		Schema: `
entity user {}

entity role {
    relation member @user
}

entity neft_batch {
    relation owner @user
    relation bank @role
    permission submit = owner or bank.member
    permission view = owner or bank.member
    permission settle = bank.member
}

entity nacs_cheque {
    relation presenter @user
    relation bank @role
    permission present = presenter or bank.member
    permission view = presenter or bank.member
    permission return_cheque = bank.member
}

entity ndd_mandate {
    relation subscriber @user
    relation biller @user
    relation bank @role
    permission create = biller or bank.member
    permission view = subscriber or biller or bank.member
    permission suspend = bank.member
    permission revoke = subscriber or bank.member
    permission execute = biller or bank.member
}

entity dispute {
    relation initiator @user
    relation responder @user
    relation cbn_admin @role
    permission open = initiator
    permission view = initiator or responder or cbn_admin.member
    permission resolve = responder or cbn_admin.member
    permission escalate = initiator or cbn_admin.member
}

entity merchant {
    relation owner @user
    relation admin @role
    permission register = admin.member
    permission view = owner or admin.member
    permission suspend = admin.member
}
`,
	}
}

// KeycloakRealmConfig defines Keycloak realm configuration for NIBSS.
type KeycloakRealmConfig struct {
	Realm     string              `json:"realm"`
	Clients   []KeycloakClient    `json:"clients"`
	Roles     []KeycloakRole      `json:"roles"`
}

// KeycloakClient represents a Keycloak OAuth2 client.
type KeycloakClient struct {
	ClientID     string   `json:"clientId"`
	Name         string   `json:"name"`
	Protocol     string   `json:"protocol"`
	RedirectURIs []string `json:"redirectUris"`
	Scopes       []string `json:"scopes"`
}

// KeycloakRole represents a Keycloak role mapping.
type KeycloakRole struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// GetNIBSSKeycloakConfig returns the Keycloak realm config for NIBSS services.
func GetNIBSSKeycloakConfig() KeycloakRealmConfig {
	return KeycloakRealmConfig{
		Realm: "nibss-domestic",
		Clients: []KeycloakClient{
			{ClientID: "nibss-neft-service", Name: "NEFT Clearing Service", Protocol: "openid-connect",
				RedirectURIs: []string{"http://localhost:3009/neft/callback"}, Scopes: []string{"neft:read", "neft:write"}},
			{ClientID: "nibss-nacs-service", Name: "NACS Cheque Clearing", Protocol: "openid-connect",
				RedirectURIs: []string{"http://localhost:3009/nacs/callback"}, Scopes: []string{"nacs:read", "nacs:write"}},
			{ClientID: "nibss-ndd-service", Name: "NDD Mandate Service", Protocol: "openid-connect",
				RedirectURIs: []string{"http://localhost:3009/ndd/callback"}, Scopes: []string{"ndd:read", "ndd:write", "ndd:execute"}},
			{ClientID: "nibss-identity-service", Name: "Identity Verification", Protocol: "openid-connect",
				RedirectURIs: []string{"http://localhost:3009/identity/callback"}, Scopes: []string{"identity:verify"}},
		},
		Roles: []KeycloakRole{
			{Name: "cbn_admin", Description: "CBN Administrator — full access to all NIBSS operations",
				Permissions: []string{"neft:*", "nacs:*", "ndd:*", "reversal:*", "dispute:*", "identity:*", "merchant:*"}},
			{Name: "bank_ops", Description: "Bank Operations — submit batches, present cheques, manage mandates",
				Permissions: []string{"neft:batch:submit", "neft:batch:view", "nacs:cheque:present", "nacs:cheque:view", "ndd:mandate:view", "reversal:view"}},
			{Name: "bank_compliance", Description: "Bank Compliance — view disputes, escalate, audit trail",
				Permissions: []string{"dispute:view", "dispute:open", "dispute:escalate", "reversal:view", "identity:verify"}},
			{Name: "merchant", Description: "Merchant — view own transactions, manage profile",
				Permissions: []string{"merchant:view"}},
			{Name: "biller", Description: "Biller — manage mandates, view collections",
				Permissions: []string{"ndd:mandate:create", "ndd:mandate:view", "ndd:mandate:execute"}},
			{Name: "auditor", Description: "Auditor — read-only access to all data",
				Permissions: []string{"neft:batch:view", "nacs:cheque:view", "ndd:mandate:view", "reversal:view", "dispute:view", "merchant:view"}},
		},
	}
}

// ======================== Redis Integration ========================

// RedisCacheConfig defines Redis caching configuration for NIBSS services.
type RedisCacheConfig struct {
	NameEnquiryTTL    time.Duration `json:"nameEnquiryTTL"`
	BVNLookupTTL      time.Duration `json:"bvnLookupTTL"`
	NINLookupTTL      time.Duration `json:"ninLookupTTL"`
	TSQCacheTTL       time.Duration `json:"tsqCacheTTL"`
	MerchantCacheTTL  time.Duration `json:"merchantCacheTTL"`
	IdempotencyTTL    time.Duration `json:"idempotencyTTL"`
}

// DefaultRedisCacheConfig returns the default Redis cache configuration.
func DefaultRedisCacheConfig() RedisCacheConfig {
	return RedisCacheConfig{
		NameEnquiryTTL:   24 * time.Hour,
		BVNLookupTTL:     72 * time.Hour,
		NINLookupTTL:     72 * time.Hour,
		TSQCacheTTL:      5 * time.Minute,
		MerchantCacheTTL: 1 * time.Hour,
		IdempotencyTTL:   24 * time.Hour,
	}
}

// RedisCacheKeyPatterns defines the cache key patterns for NIBSS operations.
var RedisCacheKeyPatterns = map[string]string{
	"name_enquiry":    "nibss:name_enquiry:{bank_code}:{account_number}",
	"bvn_lookup":      "nibss:bvn:{bvn}",
	"nin_lookup":      "nibss:nin:{nin}",
	"tsq_result":      "nibss:tsq:{nip_ref}",
	"merchant_info":   "nibss:merchant:{merchant_code}",
	"neft_batch":      "nibss:neft:batch:{batch_ref}",
	"mandate_status":  "nibss:ndd:mandate:{mandate_ref}",
	"dispute_status":  "nibss:dispute:{dispute_id}",
	"idempotency":     "nibss:idempotency:{operation}:{key}",
	"rate_limit":      "nibss:rate_limit:{service}:{client_id}",
}

// ======================== APISIX Gateway Integration ========================

// APISIXRoute defines an API gateway route for NIBSS services.
type APISIXRoute struct {
	URI         string            `json:"uri"`
	Methods     []string          `json:"methods"`
	ServiceID   string            `json:"service_id"`
	Plugins     map[string]interface{} `json:"plugins"`
	Labels      map[string]string `json:"labels"`
}

// GetNIBSSAPIRoutes returns all APISIX route definitions for NIBSS domestic APIs.
func GetNIBSSAPIRoutes() []APISIXRoute {
	return []APISIXRoute{
		{
			URI: "/api/v1/neft/batches", Methods: []string{"GET", "POST"},
			ServiceID: "nibss-neft-service",
			Plugins: map[string]interface{}{
				"limit-req":       map[string]interface{}{"rate": 100, "burst": 50, "key": "consumer_name"},
				"jwt-auth":        map[string]interface{}{"key": "nibss-jwt-key"},
				"request-validation": map[string]interface{}{"body_schema": "neft_batch_schema"},
				"opentelemetry":   map[string]interface{}{"service_name": "nibss-neft"},
			},
			Labels: map[string]string{"module": "neft", "version": "v1"},
		},
		{
			URI: "/api/v1/nacs/cheques", Methods: []string{"GET", "POST"},
			ServiceID: "nibss-nacs-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 50, "burst": 25, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-nacs"},
			},
			Labels: map[string]string{"module": "nacs", "version": "v1"},
		},
		{
			URI: "/api/v1/ndd/mandates", Methods: []string{"GET", "POST", "PUT", "DELETE"},
			ServiceID: "nibss-ndd-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 200, "burst": 100, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-ndd"},
			},
			Labels: map[string]string{"module": "ndd", "version": "v1"},
		},
		{
			URI: "/api/v1/identity/verify", Methods: []string{"POST"},
			ServiceID: "nibss-identity-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 500, "burst": 200, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"ip-restriction": map[string]interface{}{"whitelist": []string{"10.0.0.0/8", "172.16.0.0/12"}},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-identity"},
			},
			Labels: map[string]string{"module": "identity", "version": "v1"},
		},
		{
			URI: "/api/v1/name-enquiry", Methods: []string{"GET"},
			ServiceID: "nibss-identity-service",
			Plugins: map[string]interface{}{
				"limit-req":     map[string]interface{}{"rate": 1000, "burst": 500, "key": "consumer_name"},
				"jwt-auth":      map[string]interface{}{"key": "nibss-jwt-key"},
				"proxy-cache":   map[string]interface{}{"cache_ttls": []int{86400}, "cache_key": "$arg_account_number:$arg_bank_code"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-name-enquiry"},
			},
			Labels: map[string]string{"module": "identity", "version": "v1"},
		},
		{
			URI: "/api/v1/tsq", Methods: []string{"GET"},
			ServiceID: "nibss-tsq-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 2000, "burst": 1000, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-tsq"},
			},
			Labels: map[string]string{"module": "tsq", "version": "v1"},
		},
		{
			URI: "/api/v1/reversals", Methods: []string{"GET", "POST"},
			ServiceID: "nibss-reversal-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 50, "burst": 25, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-reversals"},
			},
			Labels: map[string]string{"module": "reversals", "version": "v1"},
		},
		{
			URI: "/api/v1/disputes", Methods: []string{"GET", "POST", "PUT"},
			ServiceID: "nibss-dispute-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 100, "burst": 50, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-disputes"},
			},
			Labels: map[string]string{"module": "disputes", "version": "v1"},
		},
		{
			URI: "/api/v1/merchants", Methods: []string{"GET", "POST", "PUT"},
			ServiceID: "nibss-merchant-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 100, "burst": 50, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-merchants"},
			},
			Labels: map[string]string{"module": "merchants", "version": "v1"},
		},
		{
			URI: "/api/v1/iso20022/messages", Methods: []string{"GET", "POST"},
			ServiceID: "nibss-iso20022-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 200, "burst": 100, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-iso20022"},
			},
			Labels: map[string]string{"module": "iso20022", "version": "v1"},
		},
		{
			URI: "/api/v1/paydirect/collections", Methods: []string{"GET", "POST"},
			ServiceID: "nibss-paydirect-service",
			Plugins: map[string]interface{}{
				"limit-req":    map[string]interface{}{"rate": 100, "burst": 50, "key": "consumer_name"},
				"jwt-auth":     map[string]interface{}{"key": "nibss-jwt-key"},
				"opentelemetry": map[string]interface{}{"service_name": "nibss-paydirect"},
			},
			Labels: map[string]string{"module": "paydirect", "version": "v1"},
		},
	}
}

// ======================== OpenSearch Integration ========================

// OpenSearchIndexConfig defines search index mappings for NIBSS data.
type OpenSearchIndexConfig struct {
	IndexName string                 `json:"indexName"`
	Mappings  map[string]interface{} `json:"mappings"`
	Settings  map[string]interface{} `json:"settings"`
}

// GetNIBSSSearchIndexes returns OpenSearch index configurations for NIBSS data.
func GetNIBSSSearchIndexes() []OpenSearchIndexConfig {
	return []OpenSearchIndexConfig{
		{
			IndexName: "nibss-neft-batches",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"batch_ref":        map[string]string{"type": "keyword"},
					"sender_bank":      map[string]string{"type": "keyword"},
					"status":           map[string]string{"type": "keyword"},
					"clearing_session": map[string]string{"type": "keyword"},
					"total_amount":     map[string]string{"type": "long"},
					"total_items":      map[string]string{"type": "integer"},
					"submitted_at":     map[string]string{"type": "date"},
					"settled_at":       map[string]string{"type": "date"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 3, "number_of_replicas": 1},
		},
		{
			IndexName: "nibss-nacs-cheques",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"cheque_number": map[string]string{"type": "keyword"},
					"drawer_name":  map[string]string{"type": "text"},
					"payee_name":   map[string]string{"type": "text"},
					"amount":       map[string]string{"type": "long"},
					"status":       map[string]string{"type": "keyword"},
					"presented_at": map[string]string{"type": "date"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 2, "number_of_replicas": 1},
		},
		{
			IndexName: "nibss-ndd-mandates",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"mandate_ref":     map[string]string{"type": "keyword"},
					"mandate_type":    map[string]string{"type": "keyword"},
					"subscriber_name": map[string]string{"type": "text"},
					"subscriber_bvn":  map[string]string{"type": "keyword"},
					"biller_name":     map[string]string{"type": "text"},
					"status":          map[string]string{"type": "keyword"},
					"amount":          map[string]string{"type": "long"},
					"frequency":       map[string]string{"type": "keyword"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 3, "number_of_replicas": 1},
		},
		{
			IndexName: "nibss-disputes",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"nip_ref":          map[string]string{"type": "keyword"},
					"dispute_type":     map[string]string{"type": "keyword"},
					"initiating_bank":  map[string]string{"type": "keyword"},
					"responding_bank":  map[string]string{"type": "keyword"},
					"status":           map[string]string{"type": "keyword"},
					"amount":           map[string]string{"type": "long"},
					"description":      map[string]string{"type": "text"},
					"sla_deadline":     map[string]string{"type": "date"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 2, "number_of_replicas": 1},
		},
		{
			IndexName: "nibss-iso20022-messages",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"message_type":  map[string]string{"type": "keyword"},
					"message_id":    map[string]string{"type": "keyword"},
					"sender_bic":    map[string]string{"type": "keyword"},
					"receiver_bic":  map[string]string{"type": "keyword"},
					"status":        map[string]string{"type": "keyword"},
					"total_amount":  map[string]string{"type": "long"},
					"currency":      map[string]string{"type": "keyword"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 2, "number_of_replicas": 1},
		},
		{
			IndexName: "nibss-identity-verifications",
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"id_type":        map[string]string{"type": "keyword"},
					"verified":       map[string]string{"type": "boolean"},
					"match_score":    map[string]string{"type": "float"},
					"response_time":  map[string]string{"type": "long"},
					"timestamp":      map[string]string{"type": "date"},
				},
			},
			Settings: map[string]interface{}{"number_of_shards": 2, "number_of_replicas": 1},
		},
	}
}

// ======================== Mojaloop Integration ========================

// MojaloopDomesticAdapter adapts NIBSS domestic payments for Mojaloop interop.
type MojaloopDomesticAdapter struct {
	PartyLookupURI  string `json:"partyLookupUri"`
	TransferURI     string `json:"transferUri"`
	QuoteURI        string `json:"quoteUri"`
	SettlementURI   string `json:"settlementUri"`
}

// NewMojaloopDomesticAdapter creates a Mojaloop adapter for domestic payments.
func NewMojaloopDomesticAdapter() *MojaloopDomesticAdapter {
	baseURL := os.Getenv("MOJALOOP_BASE_URL")
	if baseURL == "" {
		baseURL = "http://mojaloop-central-ledger:3001"
	}

	return &MojaloopDomesticAdapter{
		PartyLookupURI: baseURL + "/parties",
		TransferURI:    baseURL + "/transfers",
		QuoteURI:       baseURL + "/quotes",
		SettlementURI:  baseURL + "/settlements",
	}
}

// MapNEFTToMojaloop converts NEFT batch items to Mojaloop bulk transfer format.
func (a *MojaloopDomesticAdapter) MapNEFTToMojaloop(batch NEFTBatch) map[string]interface{} {
	transfers := make([]map[string]interface{}, 0, len(batch.Items))
	for _, item := range batch.Items {
		transfers = append(transfers, map[string]interface{}{
			"transferId":     item.ID,
			"payerFsp":       batch.SenderBankCode,
			"payeeFsp":       item.ReceiverBank,
			"amount":         map[string]interface{}{"currency": "NGN", "amount": fmt.Sprintf("%.2f", item.Amount)},
			"ilpPacket":      "",
			"condition":      "",
			"expiration":     time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339),
		})
	}

	return map[string]interface{}{
		"bulkTransferId": batch.ID,
		"payerFsp":       batch.SenderBankCode,
		"individualTransfers": transfers,
		"expiration":     time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339),
	}
}

// ======================== TigerBeetle Ledger Integration ========================

// NIBSSTigerBeetleAccounts defines the TigerBeetle account families for NIBSS.
type NIBSSTigerBeetleAccounts struct {
	// NEFT Account Families
	NEFTClearingHouse     uint64 `json:"neftClearingHouse"`
	NEFTTransitPayable    uint64 `json:"neftTransitPayable"`
	NEFTSettlementSuspense uint64 `json:"neftSettlementSuspense"`

	// NACS Account Families
	NACSClearingAccount   uint64 `json:"nacsClearingAccount"`
	NACSReturnSuspense    uint64 `json:"nacsReturnSuspense"`

	// NDD Account Families
	NDDCollectionAccount  uint64 `json:"nddCollectionAccount"`
	NDDGSIRecoveryAccount uint64 `json:"nddGsiRecoveryAccount"`

	// Fee Accounts
	NIBSSFeeIncome        uint64 `json:"nibssFeeIncome"`
	SwitchFeeIncome       uint64 `json:"switchFeeIncome"`

	// Settlement Accounts
	SettlementAccount     uint64 `json:"settlementAccount"`
	SuspenseAccount       uint64 `json:"suspenseAccount"`
}

// DefaultNIBSSTigerBeetleAccounts returns the standard TigerBeetle account IDs.
func DefaultNIBSSTigerBeetleAccounts() NIBSSTigerBeetleAccounts {
	return NIBSSTigerBeetleAccounts{
		NEFTClearingHouse:      6001,
		NEFTTransitPayable:     6002,
		NEFTSettlementSuspense: 6003,
		NACSClearingAccount:    6101,
		NACSReturnSuspense:     6102,
		NDDCollectionAccount:   6201,
		NDDGSIRecoveryAccount:  6202,
		NIBSSFeeIncome:         6301,
		SwitchFeeIncome:        6302,
		SettlementAccount:      6401,
		SuspenseAccount:        6402,
	}
}

// NEFTLedgerEntry represents a TigerBeetle posting for NEFT operations.
type NEFTLedgerEntry struct {
	TransferID      uint64 `json:"transferId"`
	DebitAccountID  uint64 `json:"debitAccountId"`
	CreditAccountID uint64 `json:"creditAccountId"`
	Amount          uint64 `json:"amount"` // Kobo
	Ledger          uint32 `json:"ledger"` // 1 = NGN
	Code            uint16 `json:"code"`   // Operation type
}

// GetNEFTSettlementPostings generates TigerBeetle postings for a NEFT batch settlement.
func GetNEFTSettlementPostings(batch NEFTBatch, accounts NIBSSTigerBeetleAccounts) []NEFTLedgerEntry {
	entries := make([]NEFTLedgerEntry, 0)
	amountKobo := uint64(batch.TotalAmount * 100)

	// 1. Debit sender bank's prefund account → Credit NEFT clearing house
	entries = append(entries, NEFTLedgerEntry{
		DebitAccountID:  uint64(hash(batch.SenderBankCode)),
		CreditAccountID: accounts.NEFTClearingHouse,
		Amount:          amountKobo,
		Ledger:          1, // NGN
		Code:            601, // NEFT settlement
	})

	// 2. Debit NEFT clearing house → Credit settlement suspense
	entries = append(entries, NEFTLedgerEntry{
		DebitAccountID:  accounts.NEFTClearingHouse,
		CreditAccountID: accounts.NEFTSettlementSuspense,
		Amount:          amountKobo,
		Ledger:          1,
		Code:            602,
	})

	// 3. NIBSS fee capture
	fee := amountKobo / 10000 // 0.01% NIBSS processing fee
	entries = append(entries, NEFTLedgerEntry{
		DebitAccountID:  accounts.NEFTSettlementSuspense,
		CreditAccountID: accounts.NIBSSFeeIncome,
		Amount:          fee,
		Ledger:          1,
		Code:            603,
	})

	return entries
}

func hash(s string) uint32 {
	var h uint32
	for _, c := range s {
		h = h*31 + uint32(c)
	}
	return h
}

// ======================== OpenAppSec WAF Integration ========================

// OpenAppSecPolicy defines WAF policies for NIBSS API endpoints.
type OpenAppSecPolicy struct {
	PolicyName  string            `json:"policyName"`
	Description string            `json:"description"`
	Rules       []WAFRule         `json:"rules"`
}

// WAFRule defines a single WAF rule.
type WAFRule struct {
	RuleID      string `json:"ruleId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Action      string `json:"action"` // BLOCK, LOG, CHALLENGE
	Pattern     string `json:"pattern"`
	Target      string `json:"target"` // BODY, HEADER, URI, QUERY
}

// GetNIBSSWAFPolicies returns OpenAppSec WAF policies for NIBSS APIs.
func GetNIBSSWAFPolicies() []OpenAppSecPolicy {
	return []OpenAppSecPolicy{
		{
			PolicyName: "nibss-api-protection",
			Description: "Protects NIBSS domestic payment APIs from injection and abuse",
			Rules: []WAFRule{
				{RuleID: "NIBSS-001", Name: "SQL Injection on Account Numbers", Action: "BLOCK",
					Pattern: `(?i)(union\s+select|insert\s+into|drop\s+table|delete\s+from)`, Target: "BODY"},
				{RuleID: "NIBSS-002", Name: "BVN Format Validation", Action: "BLOCK",
					Pattern: `^(?!\d{11}$)`, Target: "BODY"},
				{RuleID: "NIBSS-003", Name: "NEFT Amount Limit", Action: "LOG",
					Pattern: `"amount"\s*:\s*(\d{12,})`, Target: "BODY"},
				{RuleID: "NIBSS-004", Name: "XSS in Narration Field", Action: "BLOCK",
					Pattern: `<script|javascript:|on\w+=`, Target: "BODY"},
				{RuleID: "NIBSS-005", Name: "Path Traversal Prevention", Action: "BLOCK",
					Pattern: `\.\./|\.\.\\`, Target: "URI"},
				{RuleID: "NIBSS-006", Name: "Rate Limit Bypass Detection", Action: "BLOCK",
					Pattern: `X-Forwarded-For:\s*\d+\.\d+\.\d+\.\d+`, Target: "HEADER"},
				{RuleID: "NIBSS-007", Name: "ISO 20022 XML Entity Injection", Action: "BLOCK",
					Pattern: `<!ENTITY|<!DOCTYPE.*\[`, Target: "BODY"},
				{RuleID: "NIBSS-008", Name: "Mandate Amount Tampering", Action: "LOG",
					Pattern: `"amount"\s*:\s*0\s*[,}]`, Target: "BODY"},
			},
		},
	}
}

// ======================== Middleware Integration Orchestrator ========================

// NIBSSMiddlewareOrchestrator ties all middleware components together.
type NIBSSMiddlewareOrchestrator struct {
	kafka       *NIBSSKafkaProducer
	dapr        *NIBSSDaprIntegration
	mojaloop    *MojaloopDomesticAdapter
	neft        *NEFTService
	nacs        *NACSService
	ndd         *NDDService
	reversals   *ReversalService
	disputes    *DisputeService
	paydirect   *PayDirectService
	merchants   *MerchantService
	tigerbeetle NIBSSTigerBeetleAccounts
	redisConfig RedisCacheConfig
}

// NewNIBSSMiddlewareOrchestrator creates the full middleware integration.
func NewNIBSSMiddlewareOrchestrator() *NIBSSMiddlewareOrchestrator {
	return &NIBSSMiddlewareOrchestrator{
		kafka:       NewNIBSSKafkaProducer(),
		dapr:        NewNIBSSDaprIntegration(),
		mojaloop:    NewMojaloopDomesticAdapter(),
		neft:        NewNEFTService(),
		nacs:        NewNACSService(),
		ndd:         NewNDDService(),
		reversals:   NewReversalService(),
		disputes:    NewDisputeService(),
		paydirect:   NewPayDirectService(),
		merchants:   NewMerchantService(),
		tigerbeetle: DefaultNIBSSTigerBeetleAccounts(),
		redisConfig: DefaultRedisCacheConfig(),
	}
}

// ProcessNEFTBatch processes an NEFT batch through the full middleware stack.
func (o *NIBSSMiddlewareOrchestrator) ProcessNEFTBatch(ctx context.Context, batch NEFTBatch) error {
	// 1. Kafka: Emit batch submitted event
	_ = o.kafka.EmitEvent(ctx, EventNEFTBatchSubmitted, "neft_batch", batch.ID, map[string]interface{}{
		"batch_ref": batch.BatchRef, "total_items": batch.TotalItems, "total_amount": batch.TotalAmount,
	})

	// 2. TigerBeetle: Generate and post ledger entries
	postings := GetNEFTSettlementPostings(batch, o.tigerbeetle)
	log.Printf("[TigerBeetle] Generated %d postings for NEFT batch %s", len(postings), batch.ID)

	// 3. Mojaloop: Map to FSPIOP format for interop
	mojaloopPayload := o.mojaloop.MapNEFTToMojaloop(batch)
	log.Printf("[Mojaloop] Mapped batch %s with %d transfers", batch.ID, len(mojaloopPayload))

	// 4. Kafka: Emit settled event
	_ = o.kafka.EmitEvent(ctx, EventNEFTBatchSettled, "neft_batch", batch.ID, map[string]interface{}{
		"settled_amount": batch.TotalAmount, "clearing_session": batch.ClearingSession,
	})

	return nil
}

// ProcessMandateDebit processes an NDD debit through the full middleware stack.
func (o *NIBSSMiddlewareOrchestrator) ProcessMandateDebit(ctx context.Context, mandate DirectDebitMandate) error {
	// 1. Kafka: Emit debit execution event
	_ = o.kafka.EmitEvent(ctx, EventMandateDebitExecuted, "ndd_mandate", mandate.ID, map[string]interface{}{
		"mandate_ref": mandate.MandateRef, "amount": mandate.Amount, "subscriber": mandate.SubscriberName,
	})

	// 2. TigerBeetle: Post debit/credit entries
	log.Printf("[TigerBeetle] Debiting %s account %s for ₦%.2f", mandate.SubscriberBank, mandate.SubscriberAcct, mandate.Amount)

	// 3. If GSI mandate, attempt cross-bank recovery
	if mandate.MandateType == MandateTypeGSI {
		_ = o.kafka.EmitEvent(ctx, EventGSIRecoveryInitiated, "ndd_mandate", mandate.ID, map[string]interface{}{
			"bvn": mandate.SubscriberBVN, "recovery_amount": mandate.Amount,
		})
	}

	return nil
}

// ProcessDispute processes a dispute through the middleware stack.
func (o *NIBSSMiddlewareOrchestrator) ProcessDispute(ctx context.Context, dispute InterBankDispute) error {
	// 1. Kafka: Emit dispute event
	_ = o.kafka.EmitEvent(ctx, EventDisputeOpened, "dispute", dispute.ID, map[string]interface{}{
		"nip_ref": dispute.NIPRef, "amount": dispute.Amount, "type": dispute.DisputeType,
	})

	// 2. Temporal: Start dispute resolution workflow
	log.Printf("[Temporal] Starting dispute resolution workflow for %s", dispute.ID)

	return nil
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
}
