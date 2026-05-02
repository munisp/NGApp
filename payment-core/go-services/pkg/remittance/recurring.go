// Package remittance provides recurring remittance functionality
// Recommendation #19: Recurring Remittances
package remittance

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RecurrenceFrequency represents how often a remittance recurs
type RecurrenceFrequency string

const (
	FrequencyDaily    RecurrenceFrequency = "daily"
	FrequencyWeekly   RecurrenceFrequency = "weekly"
	FrequencyBiWeekly RecurrenceFrequency = "biweekly"
	FrequencyMonthly  RecurrenceFrequency = "monthly"
	FrequencyQuarterly RecurrenceFrequency = "quarterly"
	FrequencyAnnually RecurrenceFrequency = "annually"
)

// RecurringStatus represents the status of a recurring remittance
type RecurringStatus string

const (
	RecurringStatusActive    RecurringStatus = "active"
	RecurringStatusPaused    RecurringStatus = "paused"
	RecurringStatusCancelled RecurringStatus = "cancelled"
	RecurringStatusCompleted RecurringStatus = "completed"
	RecurringStatusFailed    RecurringStatus = "failed"
)

// ExecutionStatus represents the status of a single execution
type ExecutionStatus string

const (
	ExecutionStatusPending   ExecutionStatus = "pending"
	ExecutionStatusProcessing ExecutionStatus = "processing"
	ExecutionStatusCompleted ExecutionStatus = "completed"
	ExecutionStatusFailed    ExecutionStatus = "failed"
	ExecutionStatusSkipped   ExecutionStatus = "skipped"
)

// RecurringRemittance represents a recurring remittance schedule
type RecurringRemittance struct {
	ID              string              `json:"id"`
	UserID          string              `json:"user_id"`
	ParticipantID   string              `json:"participant_id"`
	Name            string              `json:"name"`
	Description     string              `json:"description,omitempty"`
	SenderID        string              `json:"sender_id"`
	SenderName      string              `json:"sender_name"`
	RecipientID     string              `json:"recipient_id"`
	RecipientName   string              `json:"recipient_name"`
	RecipientCountry string             `json:"recipient_country"`
	Amount          int64               `json:"amount"`
	Currency        string              `json:"currency"`
	TargetCurrency  string              `json:"target_currency,omitempty"`
	Frequency       RecurrenceFrequency `json:"frequency"`
	DayOfWeek       int                 `json:"day_of_week,omitempty"`   // 0-6 for weekly
	DayOfMonth      int                 `json:"day_of_month,omitempty"` // 1-31 for monthly
	StartDate       time.Time           `json:"start_date"`
	EndDate         *time.Time          `json:"end_date,omitempty"`
	NextExecution   time.Time           `json:"next_execution"`
	LastExecution   *time.Time          `json:"last_execution,omitempty"`
	ExecutionCount  int                 `json:"execution_count"`
	MaxExecutions   int                 `json:"max_executions,omitempty"` // 0 = unlimited
	Status          RecurringStatus     `json:"status"`
	FailureCount    int                 `json:"failure_count"`
	MaxFailures     int                 `json:"max_failures"`
	NotifyOnSuccess bool                `json:"notify_on_success"`
	NotifyOnFailure bool                `json:"notify_on_failure"`
	PaymentMethod   string              `json:"payment_method"`
	Metadata        map[string]string   `json:"metadata,omitempty"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
}

// RecurringExecution represents a single execution of a recurring remittance
type RecurringExecution struct {
	ID                  string          `json:"id"`
	RecurringID         string          `json:"recurring_id"`
	TransactionID       string          `json:"transaction_id,omitempty"`
	ScheduledAt         time.Time       `json:"scheduled_at"`
	ExecutedAt          *time.Time      `json:"executed_at,omitempty"`
	Amount              int64           `json:"amount"`
	Currency            string          `json:"currency"`
	ExchangeRate        float64         `json:"exchange_rate,omitempty"`
	TargetAmount        int64           `json:"target_amount,omitempty"`
	TargetCurrency      string          `json:"target_currency,omitempty"`
	Status              ExecutionStatus `json:"status"`
	ErrorMessage        string          `json:"error_message,omitempty"`
	RetryCount          int             `json:"retry_count"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// RecurringStore defines the interface for recurring remittance storage
type RecurringStore interface {
	Create(ctx context.Context, recurring *RecurringRemittance) error
	Get(ctx context.Context, id string) (*RecurringRemittance, error)
	Update(ctx context.Context, recurring *RecurringRemittance) error
	Delete(ctx context.Context, id string) error
	ListByUser(ctx context.Context, userID string, status *RecurringStatus) ([]*RecurringRemittance, error)
	GetDueExecutions(ctx context.Context, before time.Time) ([]*RecurringRemittance, error)
	
	CreateExecution(ctx context.Context, execution *RecurringExecution) error
	GetExecution(ctx context.Context, id string) (*RecurringExecution, error)
	UpdateExecution(ctx context.Context, execution *RecurringExecution) error
	ListExecutions(ctx context.Context, recurringID string, limit int) ([]*RecurringExecution, error)
}

// TransferService defines the interface for executing transfers
type TransferService interface {
	Execute(ctx context.Context, req *TransferRequest) (*TransferResult, error)
}

// TransferRequest represents a transfer request
type TransferRequest struct {
	SenderID        string
	RecipientID     string
	Amount          int64
	Currency        string
	TargetCurrency  string
	PaymentMethod   string
	Reference       string
	Metadata        map[string]string
}

// TransferResult represents the result of a transfer
type TransferResult struct {
	TransactionID  string
	Status         string
	ExchangeRate   float64
	TargetAmount   int64
	Fee            int64
	ErrorMessage   string
}

// NotificationService defines the interface for sending notifications
type NotificationService interface {
	SendRecurringSuccess(ctx context.Context, recurring *RecurringRemittance, execution *RecurringExecution) error
	SendRecurringFailure(ctx context.Context, recurring *RecurringRemittance, execution *RecurringExecution, err error) error
	SendRecurringPaused(ctx context.Context, recurring *RecurringRemittance, reason string) error
}

// RecurringService handles recurring remittance operations
type RecurringService struct {
	store        RecurringStore
	transfer     TransferService
	notification NotificationService
	maxRetries   int
}

// NewRecurringService creates a new recurring remittance service
func NewRecurringService(
	store RecurringStore,
	transfer TransferService,
	notification NotificationService,
) *RecurringService {
	return &RecurringService{
		store:        store,
		transfer:     transfer,
		notification: notification,
		maxRetries:   3,
	}
}

// CreateRecurringRequest represents a request to create a recurring remittance
type CreateRecurringRequest struct {
	UserID           string              `json:"user_id"`
	ParticipantID    string              `json:"participant_id"`
	Name             string              `json:"name"`
	Description      string              `json:"description,omitempty"`
	SenderID         string              `json:"sender_id"`
	SenderName       string              `json:"sender_name"`
	RecipientID      string              `json:"recipient_id"`
	RecipientName    string              `json:"recipient_name"`
	RecipientCountry string              `json:"recipient_country"`
	Amount           int64               `json:"amount"`
	Currency         string              `json:"currency"`
	TargetCurrency   string              `json:"target_currency,omitempty"`
	Frequency        RecurrenceFrequency `json:"frequency"`
	DayOfWeek        int                 `json:"day_of_week,omitempty"`
	DayOfMonth       int                 `json:"day_of_month,omitempty"`
	StartDate        time.Time           `json:"start_date"`
	EndDate          *time.Time          `json:"end_date,omitempty"`
	MaxExecutions    int                 `json:"max_executions,omitempty"`
	NotifyOnSuccess  bool                `json:"notify_on_success"`
	NotifyOnFailure  bool                `json:"notify_on_failure"`
	PaymentMethod    string              `json:"payment_method"`
	Metadata         map[string]string   `json:"metadata,omitempty"`
}

// Create creates a new recurring remittance
func (s *RecurringService) Create(ctx context.Context, req *CreateRecurringRequest) (*RecurringRemittance, error) {
	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if req.SenderID == "" || req.RecipientID == "" {
		return nil, errors.New("sender_id and recipient_id are required")
	}
	if req.StartDate.Before(time.Now()) {
		return nil, errors.New("start_date must be in the future")
	}

	now := time.Now()
	nextExecution := calculateNextExecution(req.StartDate, req.Frequency, req.DayOfWeek, req.DayOfMonth)

	recurring := &RecurringRemittance{
		ID:               uuid.New().String(),
		UserID:           req.UserID,
		ParticipantID:    req.ParticipantID,
		Name:             req.Name,
		Description:      req.Description,
		SenderID:         req.SenderID,
		SenderName:       req.SenderName,
		RecipientID:      req.RecipientID,
		RecipientName:    req.RecipientName,
		RecipientCountry: req.RecipientCountry,
		Amount:           req.Amount,
		Currency:         req.Currency,
		TargetCurrency:   req.TargetCurrency,
		Frequency:        req.Frequency,
		DayOfWeek:        req.DayOfWeek,
		DayOfMonth:       req.DayOfMonth,
		StartDate:        req.StartDate,
		EndDate:          req.EndDate,
		NextExecution:    nextExecution,
		ExecutionCount:   0,
		MaxExecutions:    req.MaxExecutions,
		Status:           RecurringStatusActive,
		FailureCount:     0,
		MaxFailures:      3,
		NotifyOnSuccess:  req.NotifyOnSuccess,
		NotifyOnFailure:  req.NotifyOnFailure,
		PaymentMethod:    req.PaymentMethod,
		Metadata:         req.Metadata,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := s.store.Create(ctx, recurring); err != nil {
		return nil, fmt.Errorf("failed to create recurring remittance: %w", err)
	}

	return recurring, nil
}

// Get retrieves a recurring remittance by ID
func (s *RecurringService) Get(ctx context.Context, id string) (*RecurringRemittance, error) {
	return s.store.Get(ctx, id)
}

// Pause pauses a recurring remittance
func (s *RecurringService) Pause(ctx context.Context, id string) (*RecurringRemittance, error) {
	recurring, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if recurring.Status != RecurringStatusActive {
		return nil, fmt.Errorf("cannot pause recurring remittance with status %s", recurring.Status)
	}

	recurring.Status = RecurringStatusPaused
	recurring.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, recurring); err != nil {
		return nil, fmt.Errorf("failed to pause recurring remittance: %w", err)
	}

	return recurring, nil
}

// Resume resumes a paused recurring remittance
func (s *RecurringService) Resume(ctx context.Context, id string) (*RecurringRemittance, error) {
	recurring, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if recurring.Status != RecurringStatusPaused {
		return nil, fmt.Errorf("cannot resume recurring remittance with status %s", recurring.Status)
	}

	recurring.Status = RecurringStatusActive
	recurring.FailureCount = 0 // Reset failure count on resume
	recurring.UpdatedAt = time.Now()

	// Recalculate next execution if it's in the past
	if recurring.NextExecution.Before(time.Now()) {
		recurring.NextExecution = calculateNextExecution(
			time.Now(),
			recurring.Frequency,
			recurring.DayOfWeek,
			recurring.DayOfMonth,
		)
	}

	if err := s.store.Update(ctx, recurring); err != nil {
		return nil, fmt.Errorf("failed to resume recurring remittance: %w", err)
	}

	return recurring, nil
}

// Cancel cancels a recurring remittance
func (s *RecurringService) Cancel(ctx context.Context, id string) (*RecurringRemittance, error) {
	recurring, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if recurring.Status == RecurringStatusCancelled || recurring.Status == RecurringStatusCompleted {
		return nil, fmt.Errorf("recurring remittance is already %s", recurring.Status)
	}

	recurring.Status = RecurringStatusCancelled
	recurring.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, recurring); err != nil {
		return nil, fmt.Errorf("failed to cancel recurring remittance: %w", err)
	}

	return recurring, nil
}

// ListByUser lists recurring remittances for a user
func (s *RecurringService) ListByUser(ctx context.Context, userID string, status *RecurringStatus) ([]*RecurringRemittance, error) {
	return s.store.ListByUser(ctx, userID, status)
}

// ProcessDueExecutions processes all due recurring remittances
func (s *RecurringService) ProcessDueExecutions(ctx context.Context) error {
	dueRemittances, err := s.store.GetDueExecutions(ctx, time.Now())
	if err != nil {
		return fmt.Errorf("failed to get due executions: %w", err)
	}

	for _, recurring := range dueRemittances {
		if err := s.executeRecurring(ctx, recurring); err != nil {
			// Log error but continue processing other remittances
			fmt.Printf("Failed to execute recurring %s: %v\n", recurring.ID, err)
		}
	}

	return nil
}

// executeRecurring executes a single recurring remittance
func (s *RecurringService) executeRecurring(ctx context.Context, recurring *RecurringRemittance) error {
	// Check if we've reached max executions
	if recurring.MaxExecutions > 0 && recurring.ExecutionCount >= recurring.MaxExecutions {
		recurring.Status = RecurringStatusCompleted
		recurring.UpdatedAt = time.Now()
		return s.store.Update(ctx, recurring)
	}

	// Check if we've passed the end date
	if recurring.EndDate != nil && time.Now().After(*recurring.EndDate) {
		recurring.Status = RecurringStatusCompleted
		recurring.UpdatedAt = time.Now()
		return s.store.Update(ctx, recurring)
	}

	// Create execution record
	now := time.Now()
	execution := &RecurringExecution{
		ID:             uuid.New().String(),
		RecurringID:    recurring.ID,
		ScheduledAt:    recurring.NextExecution,
		Amount:         recurring.Amount,
		Currency:       recurring.Currency,
		TargetCurrency: recurring.TargetCurrency,
		Status:         ExecutionStatusProcessing,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.store.CreateExecution(ctx, execution); err != nil {
		return fmt.Errorf("failed to create execution record: %w", err)
	}

	// Execute the transfer
	result, err := s.transfer.Execute(ctx, &TransferRequest{
		SenderID:       recurring.SenderID,
		RecipientID:    recurring.RecipientID,
		Amount:         recurring.Amount,
		Currency:       recurring.Currency,
		TargetCurrency: recurring.TargetCurrency,
		PaymentMethod:  recurring.PaymentMethod,
		Reference:      fmt.Sprintf("RECURRING-%s-%d", recurring.ID[:8], recurring.ExecutionCount+1),
		Metadata:       recurring.Metadata,
	})

	executedAt := time.Now()
	execution.ExecutedAt = &executedAt
	execution.UpdatedAt = executedAt

	if err != nil {
		// Handle failure
		execution.Status = ExecutionStatusFailed
		execution.ErrorMessage = err.Error()
		execution.RetryCount++

		recurring.FailureCount++
		recurring.UpdatedAt = executedAt

		// Check if we've exceeded max failures
		if recurring.FailureCount >= recurring.MaxFailures {
			recurring.Status = RecurringStatusPaused
			if s.notification != nil {
				s.notification.SendRecurringPaused(ctx, recurring, "Maximum failures exceeded")
			}
		}

		// Send failure notification
		if recurring.NotifyOnFailure && s.notification != nil {
			s.notification.SendRecurringFailure(ctx, recurring, execution, err)
		}
	} else {
		// Handle success
		execution.Status = ExecutionStatusCompleted
		execution.TransactionID = result.TransactionID
		execution.ExchangeRate = result.ExchangeRate
		execution.TargetAmount = result.TargetAmount

		recurring.ExecutionCount++
		recurring.LastExecution = &executedAt
		recurring.FailureCount = 0 // Reset failure count on success
		recurring.NextExecution = calculateNextExecution(
			executedAt,
			recurring.Frequency,
			recurring.DayOfWeek,
			recurring.DayOfMonth,
		)
		recurring.UpdatedAt = executedAt

		// Send success notification
		if recurring.NotifyOnSuccess && s.notification != nil {
			s.notification.SendRecurringSuccess(ctx, recurring, execution)
		}
	}

	// Update execution record
	if err := s.store.UpdateExecution(ctx, execution); err != nil {
		return fmt.Errorf("failed to update execution record: %w", err)
	}

	// Update recurring record
	if err := s.store.Update(ctx, recurring); err != nil {
		return fmt.Errorf("failed to update recurring record: %w", err)
	}

	return nil
}

// GetExecutionHistory retrieves execution history for a recurring remittance
func (s *RecurringService) GetExecutionHistory(ctx context.Context, recurringID string, limit int) ([]*RecurringExecution, error) {
	return s.store.ListExecutions(ctx, recurringID, limit)
}

// Helper functions

func calculateNextExecution(from time.Time, frequency RecurrenceFrequency, dayOfWeek, dayOfMonth int) time.Time {
	switch frequency {
	case FrequencyDaily:
		return from.AddDate(0, 0, 1)
	case FrequencyWeekly:
		next := from.AddDate(0, 0, 7)
		if dayOfWeek >= 0 && dayOfWeek <= 6 {
			// Adjust to specific day of week
			currentDay := int(next.Weekday())
			diff := dayOfWeek - currentDay
			if diff < 0 {
				diff += 7
			}
			next = next.AddDate(0, 0, diff)
		}
		return next
	case FrequencyBiWeekly:
		return from.AddDate(0, 0, 14)
	case FrequencyMonthly:
		next := from.AddDate(0, 1, 0)
		if dayOfMonth >= 1 && dayOfMonth <= 31 {
			// Adjust to specific day of month
			year, month, _ := next.Date()
			next = time.Date(year, month, dayOfMonth, next.Hour(), next.Minute(), next.Second(), 0, next.Location())
			// Handle months with fewer days
			if next.Day() != dayOfMonth {
				next = next.AddDate(0, 0, -next.Day()) // Go to last day of previous month
			}
		}
		return next
	case FrequencyQuarterly:
		return from.AddDate(0, 3, 0)
	case FrequencyAnnually:
		return from.AddDate(1, 0, 0)
	default:
		return from.AddDate(0, 1, 0) // Default to monthly
	}
}
