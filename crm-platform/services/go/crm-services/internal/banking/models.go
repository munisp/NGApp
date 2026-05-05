package models

import (
	"time"

	"github.com/google/uuid"
)

// BankingPlatform represents a banking platform type
type BankingPlatform string

const (
	// AgentBanking represents agent banking platform
	AgentBanking BankingPlatform = "AGENT_BANKING"
	
	// NeoBank represents digital banking platform
	NeoBank BankingPlatform = "NEO_BANK"
	
	// CoreBanking represents core banking platform
	CoreBanking BankingPlatform = "CORE_BANKING"
	
	// PaymentProcessing represents payment processing platform
	PaymentProcessing BankingPlatform = "PAYMENT_PROCESSING"
)

// EventType represents the type of banking event
type EventType string

const (
	// Customer event types
	CustomerCreated      EventType = "CUSTOMER_CREATED"
	CustomerUpdated      EventType = "CUSTOMER_UPDATED"
	CustomerStatusChange EventType = "CUSTOMER_STATUS_CHANGE"
	CustomerLogin        EventType = "CUSTOMER_LOGIN"
	CustomerLogout       EventType = "CUSTOMER_LOGOUT"
	CustomerKYCUpdated   EventType = "CUSTOMER_KYC_UPDATED"
	
	// Transaction event types
	TransactionCreated   EventType = "TRANSACTION_CREATED"
	TransactionUpdated   EventType = "TRANSACTION_UPDATED"
	TransactionCompleted EventType = "TRANSACTION_COMPLETED"
	TransactionFailed    EventType = "TRANSACTION_FAILED"
	TransactionDisputed  EventType = "TRANSACTION_DISPUTED"
	TransactionRefunded  EventType = "TRANSACTION_REFUNDED"
	
	// Account event types
	AccountCreated       EventType = "ACCOUNT_CREATED"
	AccountUpdated       EventType = "ACCOUNT_UPDATED"
	AccountStatusChange  EventType = "ACCOUNT_STATUS_CHANGE"
	AccountBalanceChange EventType = "ACCOUNT_BALANCE_CHANGE"
	AccountClosed        EventType = "ACCOUNT_CLOSED"
)

// CustomerEvent represents a customer-related event from banking platforms
type CustomerEvent struct {
	ID            string                 `json:"id"`
	CustomerID    string                 `json:"customer_id"`
	Type          EventType              `json:"type"`
	Timestamp     time.Time              `json:"timestamp"`
	Data          map[string]interface{} `json:"data"`
	PlatformID    string                 `json:"platform_id"`
	Version       string                 `json:"version"`
	CorrelationID string                 `json:"correlation_id"`
}

// NewCustomerEvent creates a new customer event
func NewCustomerEvent(customerID string, eventType EventType, platformID string, data map[string]interface{}) *CustomerEvent {
	return &CustomerEvent{
		ID:            uuid.New().String(),
		CustomerID:    customerID,
		Type:          eventType,
		Timestamp:     time.Now().UTC(),
		Data:          data,
		PlatformID:    platformID,
		Version:       "1.0",
		CorrelationID: uuid.New().String(),
	}
}

// TransactionEvent represents a transaction-related event from banking platforms
type TransactionEvent struct {
	ID             string                 `json:"id"`
	TransactionID  string                 `json:"transaction_id"`
	CustomerID     string                 `json:"customer_id"`
	Type           EventType              `json:"type"`
	Timestamp      time.Time              `json:"timestamp"`
	Amount         float64                `json:"amount"`
	Currency       string                 `json:"currency"`
	Status         string                 `json:"status"`
	TransactionType string                `json:"transaction_type"`
	Merchant       *MerchantInfo          `json:"merchant,omitempty"`
	Data           map[string]interface{} `json:"data"`
	PlatformID     string                 `json:"platform_id"`
	Version        string                 `json:"version"`
	CorrelationID  string                 `json:"correlation_id"`
}

// NewTransactionEvent creates a new transaction event
func NewTransactionEvent(transactionID, customerID string, eventType EventType, platformID string, amount float64, currency, status, transactionType string, merchant *MerchantInfo, data map[string]interface{}) *TransactionEvent {
	return &TransactionEvent{
		ID:             uuid.New().String(),
		TransactionID:  transactionID,
		CustomerID:     customerID,
		Type:           eventType,
		Timestamp:      time.Now().UTC(),
		Amount:         amount,
		Currency:       currency,
		Status:         status,
		TransactionType: transactionType,
		Merchant:       merchant,
		Data:           data,
		PlatformID:     platformID,
		Version:        "1.0",
		CorrelationID:  uuid.New().String(),
	}
}

// MerchantInfo represents merchant information for transactions
type MerchantInfo struct {
	MerchantID   string `json:"merchant_id"`
	Name         string `json:"name"`
	CategoryCode string `json:"category_code"`
	Location     string `json:"location"`
}

// AccountEvent represents an account-related event from banking platforms
type AccountEvent struct {
	ID            string                 `json:"id"`
	AccountID     string                 `json:"account_id"`
	CustomerID    string                 `json:"customer_id"`
	Type          EventType              `json:"type"`
	Timestamp     time.Time              `json:"timestamp"`
	AccountType   string                 `json:"account_type"`
	Status        string                 `json:"status"`
	Balance       float64                `json:"balance"`
	Currency      string                 `json:"currency"`
	Data          map[string]interface{} `json:"data"`
	PlatformID    string                 `json:"platform_id"`
	Version       string                 `json:"version"`
	CorrelationID string                 `json:"correlation_id"`
}

// NewAccountEvent creates a new account event
func NewAccountEvent(accountID, customerID string, eventType EventType, platformID string, accountType, status string, balance float64, currency string, data map[string]interface{}) *AccountEvent {
	return &AccountEvent{
		ID:            uuid.New().String(),
		AccountID:     accountID,
		CustomerID:    customerID,
		Type:          eventType,
		Timestamp:     time.Now().UTC(),
		AccountType:   accountType,
		Status:        status,
		Balance:       balance,
		Currency:      currency,
		Data:          data,
		PlatformID:    platformID,
		Version:       "1.0",
		CorrelationID: uuid.New().String(),
	}
}

// EventAcknowledgement represents an acknowledgement of event receipt
type EventAcknowledgement struct {
	EventID      string    `json:"event_id"`
	Success      bool      `json:"success"`
	ErrorMessage string    `json:"error_message,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
	ConsumerID   string    `json:"consumer_id"`
}

// NewEventAcknowledgement creates a new event acknowledgement
func NewEventAcknowledgement(eventID string, success bool, errorMessage, consumerID string) *EventAcknowledgement {
	return &EventAcknowledgement{
		EventID:      eventID,
		Success:      success,
		ErrorMessage: errorMessage,
		Timestamp:    time.Now().UTC(),
		ConsumerID:   consumerID,
	}
}

// BatchEventRequest represents a batch of events
type BatchEventRequest struct {
	PlatformID string        `json:"platform_id"`
	Events     []interface{} `json:"events"`
	AuthToken  string        `json:"auth_token"`
	RequestID  string        `json:"request_id"`
}

// BatchEventResponse represents a response to a batch event request
type BatchEventResponse struct {
	Success       bool              `json:"success"`
	ErrorMessage  string            `json:"error_message,omitempty"`
	ProcessedCount int              `json:"processed_count"`
	FailedCount   int              `json:"failed_count"`
	FailedEvents  map[string]string `json:"failed_events,omitempty"`
	RequestID     string            `json:"request_id"`
}

// NewBatchEventResponse creates a new batch event response
func NewBatchEventResponse(success bool, errorMessage string, processedCount, failedCount int, failedEvents map[string]string, requestID string) *BatchEventResponse {
	return &BatchEventResponse{
		Success:       success,
		ErrorMessage:  errorMessage,
		ProcessedCount: processedCount,
		FailedCount:   failedCount,
		FailedEvents:  failedEvents,
		RequestID:     requestID,
	}
}

