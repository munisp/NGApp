package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CRMEvent represents an event in the CRM system for audit trail and event sourcing
type CRMEvent struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	EventType     string                 `json:"event_type" gorm:"not null;index"`
	EntityType    string                 `json:"entity_type" gorm:"not null;index"`
	EntityID      uuid.UUID              `json:"entity_id" gorm:"type:uuid;not null;index"`
	UserID        *uuid.UUID             `json:"user_id" gorm:"type:uuid;index"`
	UserName      string                 `json:"user_name"`
	UserRole      string                 `json:"user_role"`
	SessionID     string                 `json:"session_id"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Action        string                 `json:"action" gorm:"not null"`
	Description   string                 `json:"description"`
	OldValues     map[string]interface{} `json:"old_values" gorm:"type:jsonb"`
	NewValues     map[string]interface{} `json:"new_values" gorm:"type:jsonb"`
	Changes       map[string]interface{} `json:"changes" gorm:"type:jsonb"`
	Metadata      map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	CorrelationID string                 `json:"correlation_id" gorm:"index"`
	TraceID       string                 `json:"trace_id" gorm:"index"`
	SpanID        string                 `json:"span_id"`
	Source        string                 `json:"source" gorm:"default:'crm-core-service'"`
	Version       string                 `json:"version" gorm:"default:'1.0'"`
	Severity      EventSeverity          `json:"severity" gorm:"type:varchar(10);default:'info'"`
	Status        EventStatus            `json:"status" gorm:"type:varchar(20);default:'success'"`
	ErrorMessage  string                 `json:"error_message"`
	Duration      int64                  `json:"duration"` // milliseconds
	CreatedAt     time.Time              `json:"created_at" gorm:"not null;index"`
}

// EventSeverity represents the severity level of an event
type EventSeverity string

const (
	EventSeverityDebug    EventSeverity = "debug"
	EventSeverityInfo     EventSeverity = "info"
	EventSeverityWarning  EventSeverity = "warning"
	EventSeverityError    EventSeverity = "error"
	EventSeverityCritical EventSeverity = "critical"
)

// EventStatus represents the status of an event
type EventStatus string

const (
	EventStatusSuccess EventStatus = "success"
	EventStatusFailure EventStatus = "failure"
	EventStatusPending EventStatus = "pending"
	EventStatusRetry   EventStatus = "retry"
)

// Event types for different CRM entities
const (
	// Lead events
	EventTypeLeadCreated    = "lead.created"
	EventTypeLeadUpdated    = "lead.updated"
	EventTypeLeadDeleted    = "lead.deleted"
	EventTypeLeadQualified  = "lead.qualified"
	EventTypeLeadConverted  = "lead.converted"
	EventTypeLeadAssigned   = "lead.assigned"
	EventTypeLeadScored     = "lead.scored"

	// Account events
	EventTypeAccountCreated = "account.created"
	EventTypeAccountUpdated = "account.updated"
	EventTypeAccountDeleted = "account.deleted"
	EventTypeAccountMerged  = "account.merged"

	// Contact events
	EventTypeContactCreated = "contact.created"
	EventTypeContactUpdated = "contact.updated"
	EventTypeContactDeleted = "contact.deleted"
	EventTypeContactMerged  = "contact.merged"

	// Opportunity events
	EventTypeOpportunityCreated      = "opportunity.created"
	EventTypeOpportunityUpdated      = "opportunity.updated"
	EventTypeOpportunityDeleted      = "opportunity.deleted"
	EventTypeOpportunityStageChanged = "opportunity.stage_changed"
	EventTypeOpportunityWon          = "opportunity.won"
	EventTypeOpportunityLost         = "opportunity.lost"
	EventTypeOpportunityReopened     = "opportunity.reopened"

	// Activity events
	EventTypeActivityCreated   = "activity.created"
	EventTypeActivityUpdated   = "activity.updated"
	EventTypeActivityDeleted   = "activity.deleted"
	EventTypeActivityCompleted = "activity.completed"
	EventTypeActivityScheduled = "activity.scheduled"

	// Interaction events
	EventTypeInteractionCreated = "interaction.created"
	EventTypeInteractionUpdated = "interaction.updated"
	EventTypeInteractionDeleted = "interaction.deleted"

	// System events
	EventTypeSystemLogin    = "system.login"
	EventTypeSystemLogout   = "system.logout"
	EventTypeSystemAccess   = "system.access"
	EventTypeSystemError    = "system.error"
	EventTypeSystemBackup   = "system.backup"
	EventTypeSystemRestore  = "system.restore"
)

// Entity types
const (
	EntityTypeLead         = "lead"
	EntityTypeAccount      = "account"
	EntityTypeContact      = "contact"
	EntityTypeOpportunity  = "opportunity"
	EntityTypeActivity     = "activity"
	EntityTypeInteraction  = "interaction"
	EntityTypeUser         = "user"
	EntityTypeSystem       = "system"
)

// Actions
const (
	ActionCreate   = "create"
	ActionRead     = "read"
	ActionUpdate   = "update"
	ActionDelete   = "delete"
	ActionConvert  = "convert"
	ActionAssign   = "assign"
	ActionMerge    = "merge"
	ActionComplete = "complete"
	ActionSchedule = "schedule"
	ActionLogin    = "login"
	ActionLogout   = "logout"
	ActionAccess   = "access"
	ActionExport   = "export"
	ActionImport   = "import"
	ActionBackup   = "backup"
	ActionRestore  = "restore"
)

// Table name
func (CRMEvent) TableName() string {
	return "crm_events"
}

// BeforeCreate hook
func (e *CRMEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	if e.Version == "" {
		e.Version = "1.0"
	}
	if e.Source == "" {
		e.Source = "crm-core-service"
	}
	if e.Severity == "" {
		e.Severity = EventSeverityInfo
	}
	if e.Status == "" {
		e.Status = EventStatusSuccess
	}
	return nil
}

// EventBuilder helps build CRM events
type EventBuilder struct {
	event *CRMEvent
}

// NewEventBuilder creates a new event builder
func NewEventBuilder() *EventBuilder {
	return &EventBuilder{
		event: &CRMEvent{
			ID:        uuid.New(),
			CreatedAt: time.Now().UTC(),
			Version:   "1.0",
			Source:    "crm-core-service",
			Severity:  EventSeverityInfo,
			Status:    EventStatusSuccess,
		},
	}
}

// WithEventType sets the event type
func (eb *EventBuilder) WithEventType(eventType string) *EventBuilder {
	eb.event.EventType = eventType
	return eb
}

// WithEntityType sets the entity type
func (eb *EventBuilder) WithEntityType(entityType string) *EventBuilder {
	eb.event.EntityType = entityType
	return eb
}

// WithEntityID sets the entity ID
func (eb *EventBuilder) WithEntityID(entityID uuid.UUID) *EventBuilder {
	eb.event.EntityID = entityID
	return eb
}

// WithUserID sets the user ID
func (eb *EventBuilder) WithUserID(userID uuid.UUID) *EventBuilder {
	eb.event.UserID = &userID
	return eb
}

// WithUserName sets the user name
func (eb *EventBuilder) WithUserName(userName string) *EventBuilder {
	eb.event.UserName = userName
	return eb
}

// WithUserRole sets the user role
func (eb *EventBuilder) WithUserRole(userRole string) *EventBuilder {
	eb.event.UserRole = userRole
	return eb
}

// WithSessionID sets the session ID
func (eb *EventBuilder) WithSessionID(sessionID string) *EventBuilder {
	eb.event.SessionID = sessionID
	return eb
}

// WithIPAddress sets the IP address
func (eb *EventBuilder) WithIPAddress(ipAddress string) *EventBuilder {
	eb.event.IPAddress = ipAddress
	return eb
}

// WithUserAgent sets the user agent
func (eb *EventBuilder) WithUserAgent(userAgent string) *EventBuilder {
	eb.event.UserAgent = userAgent
	return eb
}

// WithAction sets the action
func (eb *EventBuilder) WithAction(action string) *EventBuilder {
	eb.event.Action = action
	return eb
}

// WithDescription sets the description
func (eb *EventBuilder) WithDescription(description string) *EventBuilder {
	eb.event.Description = description
	return eb
}

// WithOldValues sets the old values
func (eb *EventBuilder) WithOldValues(oldValues map[string]interface{}) *EventBuilder {
	eb.event.OldValues = oldValues
	return eb
}

// WithNewValues sets the new values
func (eb *EventBuilder) WithNewValues(newValues map[string]interface{}) *EventBuilder {
	eb.event.NewValues = newValues
	return eb
}

// WithChanges sets the changes
func (eb *EventBuilder) WithChanges(changes map[string]interface{}) *EventBuilder {
	eb.event.Changes = changes
	return eb
}

// WithMetadata sets the metadata
func (eb *EventBuilder) WithMetadata(metadata map[string]interface{}) *EventBuilder {
	eb.event.Metadata = metadata
	return eb
}

// WithCorrelationID sets the correlation ID
func (eb *EventBuilder) WithCorrelationID(correlationID string) *EventBuilder {
	eb.event.CorrelationID = correlationID
	return eb
}

// WithTraceID sets the trace ID
func (eb *EventBuilder) WithTraceID(traceID string) *EventBuilder {
	eb.event.TraceID = traceID
	return eb
}

// WithSpanID sets the span ID
func (eb *EventBuilder) WithSpanID(spanID string) *EventBuilder {
	eb.event.SpanID = spanID
	return eb
}

// WithSeverity sets the severity
func (eb *EventBuilder) WithSeverity(severity EventSeverity) *EventBuilder {
	eb.event.Severity = severity
	return eb
}

// WithStatus sets the status
func (eb *EventBuilder) WithStatus(status EventStatus) *EventBuilder {
	eb.event.Status = status
	return eb
}

// WithErrorMessage sets the error message
func (eb *EventBuilder) WithErrorMessage(errorMessage string) *EventBuilder {
	eb.event.ErrorMessage = errorMessage
	return eb
}

// WithDuration sets the duration
func (eb *EventBuilder) WithDuration(duration int64) *EventBuilder {
	eb.event.Duration = duration
	return eb
}

// Build returns the built event
func (eb *EventBuilder) Build() *CRMEvent {
	return eb.event
}

// Utility functions for creating common events

// CreateLeadCreatedEvent creates a lead created event
func CreateLeadCreatedEvent(leadID uuid.UUID, lead interface{}, userID *uuid.UUID, userName string) *CRMEvent {
	builder := NewEventBuilder().
		WithEventType(EventTypeLeadCreated).
		WithEntityType(EntityTypeLead).
		WithEntityID(leadID).
		WithAction(ActionCreate).
		WithDescription("Lead created").
		WithNewValues(map[string]interface{}{"lead": lead})

	if userID != nil {
		builder.WithUserID(*userID)
	}
	if userName != "" {
		builder.WithUserName(userName)
	}

	return builder.Build()
}

// CreateLeadUpdatedEvent creates a lead updated event
func CreateLeadUpdatedEvent(leadID uuid.UUID, oldValues, newValues map[string]interface{}, changes map[string]interface{}, userID *uuid.UUID, userName string) *CRMEvent {
	builder := NewEventBuilder().
		WithEventType(EventTypeLeadUpdated).
		WithEntityType(EntityTypeLead).
		WithEntityID(leadID).
		WithAction(ActionUpdate).
		WithDescription("Lead updated").
		WithOldValues(oldValues).
		WithNewValues(newValues).
		WithChanges(changes)

	if userID != nil {
		builder.WithUserID(*userID)
	}
	if userName != "" {
		builder.WithUserName(userName)
	}

	return builder.Build()
}

// CreateOpportunityStageChangedEvent creates an opportunity stage changed event
func CreateOpportunityStageChangedEvent(opportunityID uuid.UUID, fromStage, toStage string, userID *uuid.UUID, userName string) *CRMEvent {
	return NewEventBuilder().
		WithEventType(EventTypeOpportunityStageChanged).
		WithEntityType(EntityTypeOpportunity).
		WithEntityID(opportunityID).
		WithAction(ActionUpdate).
		WithDescription(fmt.Sprintf("Opportunity stage changed from %s to %s", fromStage, toStage)).
		WithChanges(map[string]interface{}{
			"stage": map[string]interface{}{
				"from": fromStage,
				"to":   toStage,
			},
		}).
		WithUserID(*userID).
		WithUserName(userName).
		Build()
}

// CreateSystemErrorEvent creates a system error event
func CreateSystemErrorEvent(entityType string, entityID uuid.UUID, errorMessage string, metadata map[string]interface{}) *CRMEvent {
	return NewEventBuilder().
		WithEventType(EventTypeSystemError).
		WithEntityType(entityType).
		WithEntityID(entityID).
		WithAction(ActionAccess).
		WithDescription("System error occurred").
		WithSeverity(EventSeverityError).
		WithStatus(EventStatusFailure).
		WithErrorMessage(errorMessage).
		WithMetadata(metadata).
		Build()
}

// Event filtering and querying structures

// EventFilter represents filters for querying events
type EventFilter struct {
	EventTypes   []string    `json:"event_types"`
	EntityTypes  []string    `json:"entity_types"`
	EntityIDs    []uuid.UUID `json:"entity_ids"`
	UserIDs      []uuid.UUID `json:"user_ids"`
	Actions      []string    `json:"actions"`
	Severities   []string    `json:"severities"`
	Statuses     []string    `json:"statuses"`
	DateFrom     *time.Time  `json:"date_from"`
	DateTo       *time.Time  `json:"date_to"`
	IPAddresses  []string    `json:"ip_addresses"`
	Sources      []string    `json:"sources"`
	TraceIDs     []string    `json:"trace_ids"`
	SessionIDs   []string    `json:"session_ids"`
}

// EventSummary represents a summary of events
type EventSummary struct {
	EventType   string `json:"event_type"`
	EntityType  string `json:"entity_type"`
	Action      string `json:"action"`
	Count       int64  `json:"count"`
	LastOccured time.Time `json:"last_occurred"`
}

// EventStatistics represents event statistics
type EventStatistics struct {
	TotalEvents      int64                        `json:"total_events"`
	EventsByType     map[string]int64             `json:"events_by_type"`
	EventsByEntity   map[string]int64             `json:"events_by_entity"`
	EventsByAction   map[string]int64             `json:"events_by_action"`
	EventsBySeverity map[string]int64             `json:"events_by_severity"`
	EventsByStatus   map[string]int64             `json:"events_by_status"`
	EventsByHour     map[string]int64             `json:"events_by_hour"`
	TopUsers         []map[string]interface{}     `json:"top_users"`
	TopIPAddresses   []map[string]interface{}     `json:"top_ip_addresses"`
}

