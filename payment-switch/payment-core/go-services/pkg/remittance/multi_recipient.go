// Package remittance provides multi-recipient transfer functionality
// Recommendation #20: Multi-Recipient Transfers
package remittance

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// BatchStatus represents the status of a batch transfer
type BatchStatus string

const (
	BatchStatusPending    BatchStatus = "pending"
	BatchStatusProcessing BatchStatus = "processing"
	BatchStatusCompleted  BatchStatus = "completed"
	BatchStatusPartial    BatchStatus = "partial"
	BatchStatusFailed     BatchStatus = "failed"
	BatchStatusCancelled  BatchStatus = "cancelled"
)

// RecipientStatus represents the status of a single recipient transfer
type RecipientStatus string

const (
	RecipientStatusPending    RecipientStatus = "pending"
	RecipientStatusProcessing RecipientStatus = "processing"
	RecipientStatusCompleted  RecipientStatus = "completed"
	RecipientStatusFailed     RecipientStatus = "failed"
	RecipientStatusSkipped    RecipientStatus = "skipped"
)

// Recipient represents a single recipient in a multi-recipient transfer
type Recipient struct {
	ID             string            `json:"id"`
	RecipientID    string            `json:"recipient_id"`
	RecipientName  string            `json:"recipient_name"`
	RecipientEmail string            `json:"recipient_email,omitempty"`
	RecipientPhone string            `json:"recipient_phone,omitempty"`
	Country        string            `json:"country"`
	Amount         int64             `json:"amount"`
	Currency       string            `json:"currency"`
	TargetCurrency string            `json:"target_currency,omitempty"`
	Reference      string            `json:"reference,omitempty"`
	Note           string            `json:"note,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// RecipientResult represents the result of a single recipient transfer
type RecipientResult struct {
	RecipientID    string          `json:"recipient_id"`
	TransactionID  string          `json:"transaction_id,omitempty"`
	Status         RecipientStatus `json:"status"`
	Amount         int64           `json:"amount"`
	Currency       string          `json:"currency"`
	TargetAmount   int64           `json:"target_amount,omitempty"`
	TargetCurrency string          `json:"target_currency,omitempty"`
	ExchangeRate   float64         `json:"exchange_rate,omitempty"`
	Fee            int64           `json:"fee,omitempty"`
	ErrorMessage   string          `json:"error_message,omitempty"`
	ProcessedAt    *time.Time      `json:"processed_at,omitempty"`
}

// BatchTransfer represents a multi-recipient batch transfer
type BatchTransfer struct {
	ID             string            `json:"id"`
	UserID         string            `json:"user_id"`
	ParticipantID  string            `json:"participant_id"`
	Name           string            `json:"name"`
	Description    string            `json:"description,omitempty"`
	SenderID       string            `json:"sender_id"`
	SenderName     string            `json:"sender_name"`
	TotalAmount    int64             `json:"total_amount"`
	TotalFees      int64             `json:"total_fees"`
	Currency       string            `json:"currency"`
	RecipientCount int               `json:"recipient_count"`
	SuccessCount   int               `json:"success_count"`
	FailedCount    int               `json:"failed_count"`
	Recipients     []Recipient       `json:"recipients"`
	Results        []RecipientResult `json:"results,omitempty"`
	Status         BatchStatus       `json:"status"`
	PaymentMethod  string            `json:"payment_method"`
	ScheduledAt    *time.Time        `json:"scheduled_at,omitempty"`
	StartedAt      *time.Time        `json:"started_at,omitempty"`
	CompletedAt    *time.Time        `json:"completed_at,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// BatchStore defines the interface for batch transfer storage
type BatchStore interface {
	Create(ctx context.Context, batch *BatchTransfer) error
	Get(ctx context.Context, id string) (*BatchTransfer, error)
	Update(ctx context.Context, batch *BatchTransfer) error
	ListByUser(ctx context.Context, userID string, status *BatchStatus, limit, offset int) ([]*BatchTransfer, int64, error)
	GetPendingScheduled(ctx context.Context, before time.Time) ([]*BatchTransfer, error)
}

// MultiRecipientService handles multi-recipient transfer operations
type MultiRecipientService struct {
	store         BatchStore
	transfer      TransferService
	notification  NotificationService
	maxRecipients int
	maxAmount     int64
	concurrency   int
}

// MultiRecipientConfig holds configuration for the service
type MultiRecipientConfig struct {
	MaxRecipients int
	MaxAmount     int64
	Concurrency   int
}

// DefaultMultiRecipientConfig returns default configuration
func DefaultMultiRecipientConfig() *MultiRecipientConfig {
	return &MultiRecipientConfig{
		MaxRecipients: 1000,
		MaxAmount:     10000000, // 100,000.00 in cents
		Concurrency:   10,
	}
}

// NewMultiRecipientService creates a new multi-recipient transfer service
func NewMultiRecipientService(
	store BatchStore,
	transfer TransferService,
	notification NotificationService,
	config *MultiRecipientConfig,
) *MultiRecipientService {
	if config == nil {
		config = DefaultMultiRecipientConfig()
	}
	return &MultiRecipientService{
		store:         store,
		transfer:      transfer,
		notification:  notification,
		maxRecipients: config.MaxRecipients,
		maxAmount:     config.MaxAmount,
		concurrency:   config.Concurrency,
	}
}

// CreateBatchRequest represents a request to create a batch transfer
type CreateBatchRequest struct {
	UserID        string            `json:"user_id"`
	ParticipantID string            `json:"participant_id"`
	Name          string            `json:"name"`
	Description   string            `json:"description,omitempty"`
	SenderID      string            `json:"sender_id"`
	SenderName    string            `json:"sender_name"`
	Currency      string            `json:"currency"`
	Recipients    []Recipient       `json:"recipients"`
	PaymentMethod string            `json:"payment_method"`
	ScheduledAt   *time.Time        `json:"scheduled_at,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// Create creates a new batch transfer
func (s *MultiRecipientService) Create(ctx context.Context, req *CreateBatchRequest) (*BatchTransfer, error) {
	// Validate request
	if len(req.Recipients) == 0 {
		return nil, errors.New("at least one recipient is required")
	}
	if len(req.Recipients) > s.maxRecipients {
		return nil, fmt.Errorf("maximum %d recipients allowed", s.maxRecipients)
	}
	if req.SenderID == "" {
		return nil, errors.New("sender_id is required")
	}

	// Calculate totals and validate recipients
	var totalAmount int64
	for i, r := range req.Recipients {
		if r.RecipientID == "" {
			return nil, fmt.Errorf("recipient %d: recipient_id is required", i)
		}
		if r.Amount <= 0 {
			return nil, fmt.Errorf("recipient %d: amount must be positive", i)
		}
		totalAmount += r.Amount

		// Assign ID if not set
		if r.ID == "" {
			req.Recipients[i].ID = uuid.New().String()
		}
	}

	if totalAmount > s.maxAmount {
		return nil, fmt.Errorf("total amount %d exceeds maximum %d", totalAmount, s.maxAmount)
	}

	now := time.Now()
	status := BatchStatusPending
	if req.ScheduledAt != nil && req.ScheduledAt.After(now) {
		status = BatchStatusPending
	}

	batch := &BatchTransfer{
		ID:             uuid.New().String(),
		UserID:         req.UserID,
		ParticipantID:  req.ParticipantID,
		Name:           req.Name,
		Description:    req.Description,
		SenderID:       req.SenderID,
		SenderName:     req.SenderName,
		TotalAmount:    totalAmount,
		TotalFees:      0,
		Currency:       req.Currency,
		RecipientCount: len(req.Recipients),
		SuccessCount:   0,
		FailedCount:    0,
		Recipients:     req.Recipients,
		Results:        make([]RecipientResult, 0),
		Status:         status,
		PaymentMethod:  req.PaymentMethod,
		ScheduledAt:    req.ScheduledAt,
		Metadata:       req.Metadata,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.store.Create(ctx, batch); err != nil {
		return nil, fmt.Errorf("failed to create batch transfer: %w", err)
	}

	// If not scheduled, start processing immediately
	if req.ScheduledAt == nil || !req.ScheduledAt.After(now) {
		go s.processBatch(context.Background(), batch.ID)
	}

	return batch, nil
}

// Get retrieves a batch transfer by ID
func (s *MultiRecipientService) Get(ctx context.Context, id string) (*BatchTransfer, error) {
	return s.store.Get(ctx, id)
}

// Cancel cancels a pending batch transfer
func (s *MultiRecipientService) Cancel(ctx context.Context, id string) (*BatchTransfer, error) {
	batch, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if batch.Status != BatchStatusPending {
		return nil, fmt.Errorf("cannot cancel batch with status %s", batch.Status)
	}

	batch.Status = BatchStatusCancelled
	batch.UpdatedAt = time.Now()

	if err := s.store.Update(ctx, batch); err != nil {
		return nil, fmt.Errorf("failed to cancel batch: %w", err)
	}

	return batch, nil
}

// ListByUser lists batch transfers for a user
func (s *MultiRecipientService) ListByUser(ctx context.Context, userID string, status *BatchStatus, limit, offset int) ([]*BatchTransfer, int64, error) {
	return s.store.ListByUser(ctx, userID, status, limit, offset)
}

// ProcessScheduledBatches processes all scheduled batches that are due
func (s *MultiRecipientService) ProcessScheduledBatches(ctx context.Context) error {
	batches, err := s.store.GetPendingScheduled(ctx, time.Now())
	if err != nil {
		return fmt.Errorf("failed to get scheduled batches: %w", err)
	}

	for _, batch := range batches {
		go s.processBatch(ctx, batch.ID)
	}

	return nil
}

// processBatch processes a batch transfer
func (s *MultiRecipientService) processBatch(ctx context.Context, batchID string) error {
	batch, err := s.store.Get(ctx, batchID)
	if err != nil {
		return err
	}

	if batch.Status != BatchStatusPending {
		return fmt.Errorf("batch is not pending (status: %s)", batch.Status)
	}

	// Update status to processing
	now := time.Now()
	batch.Status = BatchStatusProcessing
	batch.StartedAt = &now
	batch.UpdatedAt = now
	if err := s.store.Update(ctx, batch); err != nil {
		return fmt.Errorf("failed to update batch status: %w", err)
	}

	// Process recipients concurrently with limited concurrency
	results := make([]RecipientResult, len(batch.Recipients))
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, s.concurrency)
	var mu sync.Mutex
	var successCount, failedCount int
	var totalFees int64

	for i, recipient := range batch.Recipients {
		wg.Add(1)
		go func(idx int, r Recipient) {
			defer wg.Done()
			semaphore <- struct{}{}        // Acquire
			defer func() { <-semaphore }() // Release

			result := s.processRecipient(ctx, batch, r)

			mu.Lock()
			results[idx] = result
			if result.Status == RecipientStatusCompleted {
				successCount++
				totalFees += result.Fee
			} else if result.Status == RecipientStatusFailed {
				failedCount++
			}
			mu.Unlock()
		}(i, recipient)
	}

	wg.Wait()

	// Update batch with results
	completedAt := time.Now()
	batch.Results = results
	batch.SuccessCount = successCount
	batch.FailedCount = failedCount
	batch.TotalFees = totalFees
	batch.CompletedAt = &completedAt
	batch.UpdatedAt = completedAt

	// Determine final status
	if successCount == len(batch.Recipients) {
		batch.Status = BatchStatusCompleted
	} else if successCount > 0 {
		batch.Status = BatchStatusPartial
	} else {
		batch.Status = BatchStatusFailed
	}

	if err := s.store.Update(ctx, batch); err != nil {
		return fmt.Errorf("failed to update batch results: %w", err)
	}

	return nil
}

// processRecipient processes a single recipient transfer
func (s *MultiRecipientService) processRecipient(ctx context.Context, batch *BatchTransfer, recipient Recipient) RecipientResult {
	result := RecipientResult{
		RecipientID: recipient.RecipientID,
		Status:      RecipientStatusProcessing,
		Amount:      recipient.Amount,
		Currency:    recipient.Currency,
	}

	// Execute the transfer
	transferResult, err := s.transfer.Execute(ctx, &TransferRequest{
		SenderID:       batch.SenderID,
		RecipientID:    recipient.RecipientID,
		Amount:         recipient.Amount,
		Currency:       recipient.Currency,
		TargetCurrency: recipient.TargetCurrency,
		PaymentMethod:  batch.PaymentMethod,
		Reference:      fmt.Sprintf("BATCH-%s-%s", batch.ID[:8], recipient.ID[:8]),
		Metadata:       recipient.Metadata,
	})

	processedAt := time.Now()
	result.ProcessedAt = &processedAt

	if err != nil {
		result.Status = RecipientStatusFailed
		result.ErrorMessage = err.Error()
	} else {
		result.Status = RecipientStatusCompleted
		result.TransactionID = transferResult.TransactionID
		result.ExchangeRate = transferResult.ExchangeRate
		result.TargetAmount = transferResult.TargetAmount
		result.TargetCurrency = recipient.TargetCurrency
		result.Fee = transferResult.Fee
	}

	return result
}

// GetBatchSummary returns a summary of a batch transfer
func (s *MultiRecipientService) GetBatchSummary(ctx context.Context, id string) (*BatchSummary, error) {
	batch, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	summary := &BatchSummary{
		ID:             batch.ID,
		Name:           batch.Name,
		Status:         batch.Status,
		TotalAmount:    batch.TotalAmount,
		TotalFees:      batch.TotalFees,
		Currency:       batch.Currency,
		RecipientCount: batch.RecipientCount,
		SuccessCount:   batch.SuccessCount,
		FailedCount:    batch.FailedCount,
		PendingCount:   batch.RecipientCount - batch.SuccessCount - batch.FailedCount,
		CreatedAt:      batch.CreatedAt,
		CompletedAt:    batch.CompletedAt,
	}

	// Calculate success rate
	if batch.RecipientCount > 0 {
		summary.SuccessRate = float64(batch.SuccessCount) / float64(batch.RecipientCount) * 100
	}

	// Group results by status
	summary.StatusBreakdown = make(map[string]int)
	for _, r := range batch.Results {
		summary.StatusBreakdown[string(r.Status)]++
	}

	// Calculate total transferred
	for _, r := range batch.Results {
		if r.Status == RecipientStatusCompleted {
			summary.TotalTransferred += r.Amount
		}
	}

	return summary, nil
}

// BatchSummary represents a summary of a batch transfer
type BatchSummary struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	Status           BatchStatus    `json:"status"`
	TotalAmount      int64          `json:"total_amount"`
	TotalTransferred int64          `json:"total_transferred"`
	TotalFees        int64          `json:"total_fees"`
	Currency         string         `json:"currency"`
	RecipientCount   int            `json:"recipient_count"`
	SuccessCount     int            `json:"success_count"`
	FailedCount      int            `json:"failed_count"`
	PendingCount     int            `json:"pending_count"`
	SuccessRate      float64        `json:"success_rate"`
	StatusBreakdown  map[string]int `json:"status_breakdown"`
	CreatedAt        time.Time      `json:"created_at"`
	CompletedAt      *time.Time     `json:"completed_at,omitempty"`
}

// ValidateRecipients validates a list of recipients before creating a batch
func (s *MultiRecipientService) ValidateRecipients(ctx context.Context, recipients []Recipient) ([]RecipientValidation, error) {
	validations := make([]RecipientValidation, len(recipients))

	for i, r := range recipients {
		validation := RecipientValidation{
			Index:       i,
			RecipientID: r.RecipientID,
			Valid:       true,
			Errors:      make([]string, 0),
		}

		// Validate required fields
		if r.RecipientID == "" {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "recipient_id is required")
		}
		if r.Amount <= 0 {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "amount must be positive")
		}
		if r.Currency == "" {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "currency is required")
		}

		// Validate country code (ISO 3166-1 alpha-2)
		if r.Country != "" && !isValidCountryCode(r.Country) {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "invalid country code (must be ISO 3166-1 alpha-2)")
		}

		// Validate currency code (ISO 4217)
		if r.Currency != "" && !isValidCurrencyCode(r.Currency) {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "invalid currency code (must be ISO 4217)")
		}

		// Validate email format if provided
		if r.RecipientEmail != "" && !isValidEmail(r.RecipientEmail) {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "invalid email format")
		}

		// Validate phone format if provided
		if r.RecipientPhone != "" && !isValidPhone(r.RecipientPhone) {
			validation.Valid = false
			validation.Errors = append(validation.Errors, "invalid phone format")
		}

		validations[i] = validation
	}

	return validations, nil
}

// RecipientValidation represents the validation result for a recipient
type RecipientValidation struct {
	Index       int      `json:"index"`
	RecipientID string   `json:"recipient_id"`
	Valid       bool     `json:"valid"`
	Errors      []string `json:"errors,omitempty"`
}

// ImportRecipientsFromCSV imports recipients from CSV data
func (s *MultiRecipientService) ImportRecipientsFromCSV(ctx context.Context, csvData [][]string, mapping map[string]int) ([]Recipient, []ImportError, error) {
	if len(csvData) == 0 {
		return nil, nil, errors.New("empty CSV data")
	}

	recipients := make([]Recipient, 0)
	importErrors := make([]ImportError, 0)

	// Skip header row if present
	startRow := 0
	if len(csvData) > 0 && isHeaderRow(csvData[0]) {
		startRow = 1
	}

	for i := startRow; i < len(csvData); i++ {
		row := csvData[i]
		recipient, err := parseRecipientRow(row, mapping)
		if err != nil {
			importErrors = append(importErrors, ImportError{
				Row:     i + 1,
				Message: err.Error(),
			})
			continue
		}
		recipients = append(recipients, *recipient)
	}

	return recipients, importErrors, nil
}

// ImportError represents an error during CSV import
type ImportError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

func isHeaderRow(row []string) bool {
	// Simple heuristic: check if first cell looks like a header
	if len(row) == 0 {
		return false
	}
	headers := []string{"recipient", "name", "amount", "email", "phone", "country"}
	for _, h := range headers {
		if containsIgnoreCase(row[0], h) {
			return true
		}
	}
	return false
}

func containsIgnoreCase(s, substr string) bool {
	// Simple case-insensitive contains
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			c1 := s[i+j]
			c2 := substr[j]
			if c1 >= 'A' && c1 <= 'Z' {
				c1 += 32
			}
			if c2 >= 'A' && c2 <= 'Z' {
				c2 += 32
			}
			if c1 != c2 {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func parseRecipientRow(row []string, mapping map[string]int) (*Recipient, error) {
	if len(row) == 0 {
		return nil, errors.New("empty row")
	}

	recipient := &Recipient{
		ID: uuid.New().String(),
	}

	// Get values based on mapping
	if idx, ok := mapping["recipient_id"]; ok && idx < len(row) {
		recipient.RecipientID = row[idx]
	}
	if idx, ok := mapping["recipient_name"]; ok && idx < len(row) {
		recipient.RecipientName = row[idx]
	}
	if idx, ok := mapping["email"]; ok && idx < len(row) {
		recipient.RecipientEmail = row[idx]
	}
	if idx, ok := mapping["phone"]; ok && idx < len(row) {
		recipient.RecipientPhone = row[idx]
	}
	if idx, ok := mapping["country"]; ok && idx < len(row) {
		recipient.Country = row[idx]
	}
	if idx, ok := mapping["amount"]; ok && idx < len(row) {
		// Parse amount (assuming it's in string format)
		// This is simplified - in production, use proper parsing
		var amount int64
		fmt.Sscanf(row[idx], "%d", &amount)
		recipient.Amount = amount
	}
	if idx, ok := mapping["currency"]; ok && idx < len(row) {
		recipient.Currency = row[idx]
	}
	if idx, ok := mapping["reference"]; ok && idx < len(row) {
		recipient.Reference = row[idx]
	}
	if idx, ok := mapping["note"]; ok && idx < len(row) {
		recipient.Note = row[idx]
	}

	// Validate required fields
	if recipient.RecipientID == "" {
		return nil, errors.New("recipient_id is required")
	}
	if recipient.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	return recipient, nil
}

// Validation helper functions

// isValidCountryCode validates ISO 3166-1 alpha-2 country codes
func isValidCountryCode(code string) bool {
	if len(code) != 2 {
		return false
	}
	// Common country codes - in production, use a complete list
	validCodes := map[string]bool{
		"US": true, "GB": true, "CA": true, "AU": true, "DE": true, "FR": true,
		"JP": true, "CN": true, "IN": true, "BR": true, "MX": true, "KE": true,
		"NG": true, "ZA": true, "GH": true, "TZ": true, "UG": true, "RW": true,
		"ET": true, "EG": true, "MA": true, "SN": true, "CI": true, "CM": true,
		"AE": true, "SA": true, "PK": true, "BD": true, "PH": true, "ID": true,
		"MY": true, "SG": true, "TH": true, "VN": true, "KR": true, "NZ": true,
	}
	return validCodes[code]
}

// isValidCurrencyCode validates ISO 4217 currency codes
func isValidCurrencyCode(code string) bool {
	if len(code) != 3 {
		return false
	}
	// Common currency codes - in production, use a complete list
	validCodes := map[string]bool{
		"USD": true, "EUR": true, "GBP": true, "JPY": true, "CNY": true,
		"INR": true, "BRL": true, "MXN": true, "CAD": true, "AUD": true,
		"KES": true, "NGN": true, "ZAR": true, "GHS": true, "TZS": true,
		"UGX": true, "RWF": true, "ETB": true, "EGP": true, "MAD": true,
		"XOF": true, "XAF": true, "AED": true, "SAR": true, "PKR": true,
		"BDT": true, "PHP": true, "IDR": true, "MYR": true, "SGD": true,
		"THB": true, "VND": true, "KRW": true, "NZD": true, "CHF": true,
	}
	return validCodes[code]
}

// isValidEmail validates email format using basic pattern matching
func isValidEmail(email string) bool {
	if len(email) < 5 || len(email) > 254 {
		return false
	}
	atIndex := -1
	for i, c := range email {
		if c == '@' {
			if atIndex != -1 {
				return false // Multiple @ signs
			}
			atIndex = i
		}
	}
	if atIndex < 1 || atIndex > len(email)-3 {
		return false
	}
	// Check for dot after @
	dotAfterAt := false
	for i := atIndex + 1; i < len(email); i++ {
		if email[i] == '.' {
			dotAfterAt = true
			break
		}
	}
	return dotAfterAt
}

// isValidPhone validates phone number format
func isValidPhone(phone string) bool {
	if len(phone) < 7 || len(phone) > 20 {
		return false
	}
	// Allow digits, spaces, dashes, parentheses, and leading +
	for i, c := range phone {
		if c >= '0' && c <= '9' {
			continue
		}
		if c == '+' && i == 0 {
			continue
		}
		if c == ' ' || c == '-' || c == '(' || c == ')' {
			continue
		}
		return false
	}
	return true
}
