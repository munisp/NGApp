// Package onboarding provides transactional outbox pattern for reliable event publishing
package onboarding

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

// NotificationRequest represents a notification request
type NotificationRequest struct {
	Type      string                 `json:"type"`
	CaseID    string                 `json:"case_id"`
	Recipient string                 `json:"recipient"`
	Subject   string                 `json:"subject"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// Notifier interface for sending notifications
type Notifier interface {
	Send(ctx context.Context, req NotificationRequest) error
}

// OutboxPublisher publishes events from the outbox to Kafka
type OutboxPublisher struct {
	store        OutboxStore
	writer       *kafka.Writer
	topic        string
	pollInterval time.Duration
	batchSize    int
	running      bool
	stopCh       chan struct{}
	wg           sync.WaitGroup
}

// OutboxStore interface for outbox operations
type OutboxStore interface {
	GetUnpublishedEvents(ctx context.Context, limit int) ([]OutboxEvent, error)
	MarkEventPublished(ctx context.Context, eventID string) error
	MarkEventFailed(ctx context.Context, eventID string, errMsg string) error
}

// OutboxPublisherConfig holds configuration for the outbox publisher
type OutboxPublisherConfig struct {
	KafkaBrokers string
	Topic        string
	PollInterval time.Duration
	BatchSize    int
}

// DefaultOutboxPublisherConfig returns default configuration
func DefaultOutboxPublisherConfig() *OutboxPublisherConfig {
	return &OutboxPublisherConfig{
		KafkaBrokers: getEnv("KAFKA_BROKERS", "kafka.payment-switch.svc.cluster.local:9092"),
		Topic:        getEnv("KAFKA_ONBOARDING_TOPIC", "onboarding.events"),
		PollInterval: 5 * time.Second,
		BatchSize:    100,
	}
}

// NewOutboxPublisher creates a new outbox publisher
func NewOutboxPublisher(store OutboxStore, config *OutboxPublisherConfig) (*OutboxPublisher, error) {
	if config == nil {
		config = DefaultOutboxPublisherConfig()
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(config.KafkaBrokers),
		Topic:        config.Topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		MaxAttempts:  3,
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
	}

	return &OutboxPublisher{
		store:        store,
		writer:       writer,
		topic:        config.Topic,
		pollInterval: config.PollInterval,
		batchSize:    config.BatchSize,
		stopCh:       make(chan struct{}),
	}, nil
}

// Start starts the outbox publisher
func (p *OutboxPublisher) Start() {
	p.running = true
	p.wg.Add(1)

	go func() {
		defer p.wg.Done()
		ticker := time.NewTicker(p.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-p.stopCh:
				return
			case <-ticker.C:
				p.publishBatch()
			}
		}
	}()

	// Start delivery report handler
	go p.handleDeliveryReports()
}

// Stop stops the outbox publisher
func (p *OutboxPublisher) Stop() {
	if !p.running {
		return
	}

	close(p.stopCh)
	p.wg.Wait()

	// Close the writer
	p.writer.Close()

	p.running = false
}

// handleDeliveryReports handles Kafka delivery reports (no-op for segmentio/kafka-go)
func (p *OutboxPublisher) handleDeliveryReports() {
	// segmentio/kafka-go handles delivery synchronously in WriteMessages
	// This method is kept for API compatibility
}

// publishBatch publishes a batch of events from the outbox
func (p *OutboxPublisher) publishBatch() {
	ctx := context.Background()

	events, err := p.store.GetUnpublishedEvents(ctx, p.batchSize)
	if err != nil {
		fmt.Printf("Failed to get unpublished events: %v\n", err)
		return
	}

	for _, event := range events {
		if err := p.publishEvent(event); err != nil {
			p.store.MarkEventFailed(ctx, event.ID, err.Error())
		}
	}
}

// publishEvent publishes a single event to Kafka
func (p *OutboxPublisher) publishEvent(event OutboxEvent) error {
	ctx := context.Background()

	// Create Kafka message
	msg := kafka.Message{
		Key:   []byte(event.AggregateID),
		Value: event.Payload,
		Headers: []kafka.Header{
			{Key: "event_id", Value: []byte(event.ID)},
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "aggregate_type", Value: []byte(event.AggregateType)},
			{Key: "aggregate_id", Value: []byte(event.AggregateID)},
			{Key: "timestamp", Value: []byte(event.CreatedAt.Format(time.RFC3339))},
		},
	}

	// Write message synchronously
	err := p.writer.WriteMessages(ctx, msg)
	if err != nil {
		p.store.MarkEventFailed(ctx, event.ID, err.Error())
		return fmt.Errorf("failed to produce message: %w", err)
	}

	// Mark as published on success
	p.store.MarkEventPublished(ctx, event.ID)
	return nil
}

// OnboardingEvent represents a domain event for onboarding
type OnboardingEvent struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	AggregateID   string                 `json:"aggregate_id"`
	AggregateType string                 `json:"aggregate_type"`
	Timestamp     time.Time              `json:"timestamp"`
	Version       int                    `json:"version"`
	Data          map[string]interface{} `json:"data"`
	Metadata      EventMetadata          `json:"metadata"`
}

// EventMetadata contains metadata about the event
type EventMetadata struct {
	UserID        string `json:"user_id"`
	Username      string `json:"username"`
	IPAddress     string `json:"ip_address"`
	UserAgent     string `json:"user_agent"`
	CorrelationID string `json:"correlation_id"`
}

// Event types
const (
	EventCaseCreated            = "onboarding.case.created"
	EventCaseSubmitted          = "onboarding.case.submitted"
	EventCaseStatusChanged      = "onboarding.case.status_changed"
	EventRequirementApproved    = "onboarding.requirement.approved"
	EventRequirementRejected    = "onboarding.requirement.rejected"
	EventDocumentUploaded       = "onboarding.document.uploaded"
	EventDocumentVerified       = "onboarding.document.verified"
	EventReviewerAssigned       = "onboarding.reviewer.assigned"
	EventSLABreached            = "onboarding.sla.breached"
	EventProvisioningStarted    = "onboarding.provisioning.started"
	EventProvisioningCompleted  = "onboarding.provisioning.completed"
	EventProvisioningFailed     = "onboarding.provisioning.failed"
	EventProvisioningRolledBack = "onboarding.provisioning.rolled_back"
	EventParticipantActivated   = "onboarding.participant.activated"
	EventParticipantSuspended   = "onboarding.participant.suspended"
	EventReworkRequested        = "onboarding.rework.requested"
	EventApplicationRejected    = "onboarding.application.rejected"
)

// TransactionalEventEmitter emits events within a database transaction
type TransactionalEventEmitter struct {
	store *PostgresStore
}

// NewTransactionalEventEmitter creates a new transactional event emitter
func NewTransactionalEventEmitter(store *PostgresStore) *TransactionalEventEmitter {
	return &TransactionalEventEmitter{store: store}
}

// Emit emits an event to the outbox (within the same transaction as the business operation)
func (e *TransactionalEventEmitter) Emit(ctx context.Context, event OnboardingEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	return e.store.AddOutboxEvent(ctx, event.AggregateType, event.AggregateID, event.Type, json.RawMessage(payload))
}

// EmitCaseCreated emits a case created event
func (e *TransactionalEventEmitter) EmitCaseCreated(ctx context.Context, c *OnboardingCase, metadata EventMetadata) error {
	return e.Emit(ctx, OnboardingEvent{
		ID:            fmt.Sprintf("evt-%s-%d", c.ID, time.Now().UnixNano()),
		Type:          EventCaseCreated,
		AggregateID:   c.ID,
		AggregateType: "OnboardingCase",
		Timestamp:     time.Now(),
		Version:       1,
		Data: map[string]interface{}{
			"case_id":           c.ID,
			"organization_name": c.OrganizationName,
			"stakeholder_type":  c.StakeholderType,
			"country":           c.Country,
			"contact_email":     c.ContactEmail,
		},
		Metadata: metadata,
	})
}

// EmitStatusChanged emits a status changed event
func (e *TransactionalEventEmitter) EmitStatusChanged(ctx context.Context, caseID string, previousStatus, newStatus string, metadata EventMetadata) error {
	return e.Emit(ctx, OnboardingEvent{
		ID:            fmt.Sprintf("evt-%s-%d", caseID, time.Now().UnixNano()),
		Type:          EventCaseStatusChanged,
		AggregateID:   caseID,
		AggregateType: "OnboardingCase",
		Timestamp:     time.Now(),
		Version:       1,
		Data: map[string]interface{}{
			"case_id":         caseID,
			"previous_status": previousStatus,
			"new_status":      newStatus,
		},
		Metadata: metadata,
	})
}

// EmitRequirementApproved emits a requirement approved event
func (e *TransactionalEventEmitter) EmitRequirementApproved(ctx context.Context, caseID, requirementID, requirementName string, metadata EventMetadata) error {
	return e.Emit(ctx, OnboardingEvent{
		ID:            fmt.Sprintf("evt-%s-%d", requirementID, time.Now().UnixNano()),
		Type:          EventRequirementApproved,
		AggregateID:   caseID,
		AggregateType: "OnboardingCase",
		Timestamp:     time.Now(),
		Version:       1,
		Data: map[string]interface{}{
			"case_id":          caseID,
			"requirement_id":   requirementID,
			"requirement_name": requirementName,
		},
		Metadata: metadata,
	})
}

// EmitProvisioningCompleted emits a provisioning completed event
func (e *TransactionalEventEmitter) EmitProvisioningCompleted(ctx context.Context, caseID, environment string, result *ProvisioningResult, metadata EventMetadata) error {
	return e.Emit(ctx, OnboardingEvent{
		ID:            fmt.Sprintf("evt-%s-%d", caseID, time.Now().UnixNano()),
		Type:          EventProvisioningCompleted,
		AggregateID:   caseID,
		AggregateType: "OnboardingCase",
		Timestamp:     time.Now(),
		Version:       1,
		Data: map[string]interface{}{
			"case_id":                caseID,
			"environment":            environment,
			"keycloak_client_id":     result.KeycloakClientID,
			"apisix_route_id":        result.APISIXRouteID,
			"tigerbeetle_account_id": result.TigerBeetleAccountID,
		},
		Metadata: metadata,
	})
}

// EmitParticipantActivated emits a participant activated event
func (e *TransactionalEventEmitter) EmitParticipantActivated(ctx context.Context, caseID, participantID string, metadata EventMetadata) error {
	return e.Emit(ctx, OnboardingEvent{
		ID:            fmt.Sprintf("evt-%s-%d", caseID, time.Now().UnixNano()),
		Type:          EventParticipantActivated,
		AggregateID:   caseID,
		AggregateType: "OnboardingCase",
		Timestamp:     time.Now(),
		Version:       1,
		Data: map[string]interface{}{
			"case_id":        caseID,
			"participant_id": participantID,
			"activated_at":   time.Now().Format(time.RFC3339),
		},
		Metadata: metadata,
	})
}

// ImmutableAuditLog provides tamper-evident audit logging
type ImmutableAuditLog struct {
	store *PostgresStore
}

// NewImmutableAuditLog creates a new immutable audit log
func NewImmutableAuditLog(store *PostgresStore) *ImmutableAuditLog {
	return &ImmutableAuditLog{store: store}
}

// Log logs an audit entry
func (l *ImmutableAuditLog) Log(ctx context.Context, entry AuditEntry) error {
	return l.store.AddAuditEntry(ctx, entry)
}

// LogAction is a convenience method for logging actions
func (l *ImmutableAuditLog) LogAction(ctx context.Context, caseID, action string, user *UserContext, details map[string]interface{}, r *http.Request) error {
	entry := AuditEntry{
		CaseID:    caseID,
		Action:    action,
		UserID:    user.UserID,
		Username:  user.Username,
		Details:   details,
		Timestamp: time.Now(),
	}

	if r != nil {
		entry.IPAddress = r.RemoteAddr
		entry.UserAgent = r.UserAgent()
	}

	if len(user.Roles) > 0 {
		entry.Role = string(user.Roles[0])
	}

	return l.Log(ctx, entry)
}
