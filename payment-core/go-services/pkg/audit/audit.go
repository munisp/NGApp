// Package audit provides structured audit logging for compliance and security
// Recommendation #8: Structured Audit Logging with correlation IDs
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// LogLevel represents the severity of an audit log entry
type LogLevel string

const (
	LogLevelInfo     LogLevel = "INFO"
	LogLevelWarning  LogLevel = "WARNING"
	LogLevelError    LogLevel = "ERROR"
	LogLevelCritical LogLevel = "CRITICAL"
)

// Action represents the type of action being audited
type Action string

const (
	// Authentication actions
	ActionLogin           Action = "LOGIN"
	ActionLogout          Action = "LOGOUT"
	ActionLoginFailed     Action = "LOGIN_FAILED"
	Action2FAVerified     Action = "2FA_VERIFIED"
	Action2FAFailed       Action = "2FA_FAILED"

	// KYC/KYB actions
	ActionKYCInitiated    Action = "KYC_INITIATED"
	ActionKYCApproved     Action = "KYC_APPROVED"
	ActionKYCRejected     Action = "KYC_REJECTED"
	ActionKYBInitiated    Action = "KYB_INITIATED"
	ActionKYBApproved     Action = "KYB_APPROVED"
	ActionKYBRejected     Action = "KYB_REJECTED"

	// Provisioning actions
	ActionProvisioningStarted   Action = "PROVISIONING_STARTED"
	ActionProvisioningCompleted Action = "PROVISIONING_COMPLETED"
	ActionProvisioningFailed    Action = "PROVISIONING_FAILED"
	ActionProvisioningStep      Action = "PROVISIONING_STEP"

	// Transaction actions
	ActionTransactionCreated   Action = "TRANSACTION_CREATED"
	ActionTransactionCompleted Action = "TRANSACTION_COMPLETED"
	ActionTransactionFailed    Action = "TRANSACTION_FAILED"
	ActionTransactionReversed  Action = "TRANSACTION_REVERSED"

	// Admin actions
	ActionAdminUserCreated     Action = "ADMIN_USER_CREATED"
	ActionAdminUserUpdated     Action = "ADMIN_USER_UPDATED"
	ActionAdminUserDeleted     Action = "ADMIN_USER_DELETED"
	ActionAdminRoleChanged     Action = "ADMIN_ROLE_CHANGED"
	ActionAdminSettingsChanged Action = "ADMIN_SETTINGS_CHANGED"

	// Compliance actions
	ActionComplianceReportGenerated Action = "COMPLIANCE_REPORT_GENERATED"
	ActionSARFiled                  Action = "SAR_FILED"
	ActionCTRFiled                  Action = "CTR_FILED"

	// Dispute/Refund actions
	ActionDisputeCreated  Action = "DISPUTE_CREATED"
	ActionDisputeResolved Action = "DISPUTE_RESOLVED"
	ActionRefundInitiated Action = "REFUND_INITIATED"
	ActionRefundCompleted Action = "REFUND_COMPLETED"

	// Security actions
	ActionRateLimitExceeded  Action = "RATE_LIMIT_EXCEEDED"
	ActionFraudDetected      Action = "FRAUD_DETECTED"
	ActionSuspiciousActivity Action = "SUSPICIOUS_ACTIVITY"
	ActionAccessDenied       Action = "ACCESS_DENIED"

	// Data actions
	ActionDataExported Action = "DATA_EXPORTED"
	ActionDataAccessed Action = "DATA_ACCESSED"
	ActionDataModified Action = "DATA_MODIFIED"
	ActionDataDeleted  Action = "DATA_DELETED"
)

// Resource represents the type of resource being acted upon
type Resource string

const (
	ResourceUser              Resource = "USER"
	ResourceParticipant       Resource = "PARTICIPANT"
	ResourceTransaction       Resource = "TRANSACTION"
	ResourceKYCCase           Resource = "KYC_CASE"
	ResourceKYBCase           Resource = "KYB_CASE"
	ResourceProvisioningSaga  Resource = "PROVISIONING_SAGA"
	ResourceComplianceReport  Resource = "COMPLIANCE_REPORT"
	ResourceDispute           Resource = "DISPUTE"
	ResourceRefund            Resource = "REFUND"
	ResourceAPIKey            Resource = "API_KEY"
	ResourceWebhook           Resource = "WEBHOOK"
	ResourceSettings          Resource = "SETTINGS"
)

// AuditEntry represents a single audit log entry
type AuditEntry struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	CorrelationID string                 `json:"correlation_id"`
	TraceID       string                 `json:"trace_id,omitempty"`
	SpanID        string                 `json:"span_id,omitempty"`
	Level         LogLevel               `json:"level"`
	Action        Action                 `json:"action"`
	Resource      Resource               `json:"resource"`
	ResourceID    string                 `json:"resource_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	UserEmail     string                 `json:"user_email,omitempty"`
	UserRole      string                 `json:"user_role,omitempty"`
	IPAddress     string                 `json:"ip_address,omitempty"`
	UserAgent     string                 `json:"user_agent,omitempty"`
	Status        string                 `json:"status"` // "success" or "failure"
	ErrorMessage  string                 `json:"error_message,omitempty"`
	Details       map[string]interface{} `json:"details,omitempty"`
	Duration      time.Duration          `json:"duration_ms,omitempty"`
	Environment   string                 `json:"environment"`
}

// Logger is the interface for audit logging backends
type Logger interface {
	Log(ctx context.Context, entry *AuditEntry) error
	Query(ctx context.Context, filter *QueryFilter) ([]*AuditEntry, error)
}

// QueryFilter defines filters for querying audit logs
type QueryFilter struct {
	StartTime     *time.Time
	EndTime       *time.Time
	UserID        string
	Action        Action
	Resource      Resource
	ResourceID    string
	CorrelationID string
	Status        string
	Limit         int
	Offset        int
}

// contextKey is used for storing values in context
type contextKey string

const (
	correlationIDKey contextKey = "correlation_id"
	traceIDKey       contextKey = "trace_id"
	spanIDKey        contextKey = "span_id"
	userIDKey        contextKey = "user_id"
	userEmailKey     contextKey = "user_email"
	userRoleKey      contextKey = "user_role"
)

// WithCorrelationID adds a correlation ID to the context
func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	return context.WithValue(ctx, correlationIDKey, correlationID)
}

// GetCorrelationID retrieves the correlation ID from context
func GetCorrelationID(ctx context.Context) string {
	if id, ok := ctx.Value(correlationIDKey).(string); ok {
		return id
	}
	return ""
}

// WithTraceID adds a trace ID to the context
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, traceIDKey, traceID)
}

// GetTraceID retrieves the trace ID from context
func GetTraceID(ctx context.Context) string {
	if id, ok := ctx.Value(traceIDKey).(string); ok {
		return id
	}
	return ""
}

// WithUserInfo adds user information to the context
func WithUserInfo(ctx context.Context, userID, email, role string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	ctx = context.WithValue(ctx, userEmailKey, email)
	ctx = context.WithValue(ctx, userRoleKey, role)
	return ctx
}

// AuditLogger is the main audit logging service
type AuditLogger struct {
	backend     Logger
	environment string
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(backend Logger, environment string) *AuditLogger {
	return &AuditLogger{
		backend:     backend,
		environment: environment,
	}
}

// LogOptions contains options for creating an audit log entry
type LogOptions struct {
	Action       Action
	Resource     Resource
	ResourceID   string
	Status       string
	ErrorMessage string
	Details      map[string]interface{}
	IPAddress    string
	UserAgent    string
	Duration     time.Duration
}

// Log creates and stores an audit log entry
func (a *AuditLogger) Log(ctx context.Context, opts LogOptions) error {
	entry := &AuditEntry{
		ID:            uuid.New().String(),
		Timestamp:     time.Now().UTC(),
		CorrelationID: GetCorrelationID(ctx),
		TraceID:       GetTraceID(ctx),
		Level:         determineLogLevel(opts.Status, opts.Action),
		Action:        opts.Action,
		Resource:      opts.Resource,
		ResourceID:    opts.ResourceID,
		Status:        opts.Status,
		ErrorMessage:  opts.ErrorMessage,
		Details:       sanitizeDetails(opts.Details),
		IPAddress:     opts.IPAddress,
		UserAgent:     opts.UserAgent,
		Duration:      opts.Duration,
		Environment:   a.environment,
	}

	// Extract user info from context
	if userID, ok := ctx.Value(userIDKey).(string); ok {
		entry.UserID = userID
	}
	if email, ok := ctx.Value(userEmailKey).(string); ok {
		entry.UserEmail = email
	}
	if role, ok := ctx.Value(userRoleKey).(string); ok {
		entry.UserRole = role
	}

	// Generate correlation ID if not present
	if entry.CorrelationID == "" {
		entry.CorrelationID = uuid.New().String()
	}

	return a.backend.Log(ctx, entry)
}

// LogSuccess is a convenience method for logging successful actions
func (a *AuditLogger) LogSuccess(ctx context.Context, action Action, resource Resource, resourceID string, details map[string]interface{}) error {
	return a.Log(ctx, LogOptions{
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Status:     "success",
		Details:    details,
	})
}

// LogFailure is a convenience method for logging failed actions
func (a *AuditLogger) LogFailure(ctx context.Context, action Action, resource Resource, resourceID string, err error, details map[string]interface{}) error {
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	return a.Log(ctx, LogOptions{
		Action:       action,
		Resource:     resource,
		ResourceID:   resourceID,
		Status:       "failure",
		ErrorMessage: errMsg,
		Details:      details,
	})
}

// Query retrieves audit logs based on filter criteria
func (a *AuditLogger) Query(ctx context.Context, filter *QueryFilter) ([]*AuditEntry, error) {
	return a.backend.Query(ctx, filter)
}

// determineLogLevel determines the appropriate log level based on action and status
func determineLogLevel(status string, action Action) LogLevel {
	if status == "failure" {
		switch action {
		case ActionFraudDetected, ActionSuspiciousActivity:
			return LogLevelCritical
		case ActionAccessDenied, ActionRateLimitExceeded:
			return LogLevelWarning
		default:
			return LogLevelError
		}
	}

	switch action {
	case ActionFraudDetected, ActionSuspiciousActivity:
		return LogLevelCritical
	case ActionSARFiled, ActionCTRFiled:
		return LogLevelWarning
	default:
		return LogLevelInfo
	}
}

// sanitizeDetails removes sensitive information from audit details
func sanitizeDetails(details map[string]interface{}) map[string]interface{} {
	if details == nil {
		return nil
	}

	sanitized := make(map[string]interface{})
	sensitiveKeys := map[string]bool{
		"password":      true,
		"secret":        true,
		"token":         true,
		"api_key":       true,
		"apiKey":        true,
		"api_secret":    true,
		"apiSecret":     true,
		"private_key":   true,
		"privateKey":    true,
		"credit_card":   true,
		"creditCard":    true,
		"card_number":   true,
		"cardNumber":    true,
		"cvv":           true,
		"ssn":           true,
		"social_security": true,
	}

	for key, value := range details {
		if sensitiveKeys[key] {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

// ToJSON converts an audit entry to JSON
func (e *AuditEntry) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// String returns a string representation of the audit entry
func (e *AuditEntry) String() string {
	return fmt.Sprintf("[%s] %s %s %s/%s by user %s - %s",
		e.Timestamp.Format(time.RFC3339),
		e.Level,
		e.Action,
		e.Resource,
		e.ResourceID,
		e.UserID,
		e.Status,
	)
}
