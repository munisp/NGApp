package models

import "time"

// PremiumPaidEvent represents a premium payment event from Kafka
type PremiumPaidEvent struct {
	EventID          string    `json:"event_id"`
	EventType        string    `json:"event_type"` // "premium.paid"
	Timestamp        time.Time `json:"timestamp"`
	PolicyID         string    `json:"policy_id"`
	CustomerID       string    `json:"customer_id"`
	CustomerName     string    `json:"customer_name"`
	PremiumAmount    float64   `json:"premium_amount"`
	TransferID       string    `json:"transfer_id"`
	DebitAccount     string    `json:"debit_account"`
	CreditAccount    string    `json:"credit_account"`
	PaymentReference string    `json:"payment_reference"`
	PaymentDate      string    `json:"payment_date"`
}

// ClaimPaidEvent represents a claim payment event from Kafka
type ClaimPaidEvent struct {
	EventID          string    `json:"event_id"`
	EventType        string    `json:"event_type"` // "claim.paid"
	Timestamp        time.Time `json:"timestamp"`
	ClaimID          string    `json:"claim_id"`
	PolicyID         string    `json:"policy_id"`
	CustomerID       string    `json:"customer_id"`
	CustomerName     string    `json:"customer_name"`
	ClaimAmount      float64   `json:"claim_amount"`
	TransferID       string    `json:"transfer_id"`
	DebitAccount     string    `json:"debit_account"`
	CreditAccount    string    `json:"credit_account"`
	PaymentReference string    `json:"payment_reference"`
	PaymentDate      string    `json:"payment_date"`
}

// CommissionPaidEvent represents a commission payment event from Kafka
type CommissionPaidEvent struct {
	EventID           string    `json:"event_id"`
	EventType         string    `json:"event_type"` // "commission.paid"
	Timestamp         time.Time `json:"timestamp"`
	AgentID           string    `json:"agent_id"`
	AgentName         string    `json:"agent_name"`
	PolicyID          string    `json:"policy_id"`
	CommissionAmount  float64   `json:"commission_amount"`
	TransferID        string    `json:"transfer_id"`
	DebitAccount      string    `json:"debit_account"`
	CreditAccount     string    `json:"credit_account"`
	PaymentReference  string    `json:"payment_reference"`
	PaymentDate       string    `json:"payment_date"`
}

// CustomerCreatedEvent represents a customer creation event from Kafka
type CustomerCreatedEvent struct {
	EventID      string    `json:"event_id"`
	EventType    string    `json:"event_type"` // "customer.created"
	Timestamp    time.Time `json:"timestamp"`
	CustomerID   string    `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	NIN          string    `json:"nin"`
	DateOfBirth  string    `json:"date_of_birth"`
	Address      string    `json:"address"`
}

// CustomerUpdatedEvent represents a customer update event from Kafka
type CustomerUpdatedEvent struct {
	EventID      string    `json:"event_id"`
	EventType    string    `json:"event_type"` // "customer.updated"
	Timestamp    time.Time `json:"timestamp"`
	CustomerID   string    `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	NIN          string    `json:"nin"`
	DateOfBirth  string    `json:"date_of_birth"`
	Address      string    `json:"address"`
}

// AgentCreatedEvent represents an agent creation event from Kafka
type AgentCreatedEvent struct {
	EventID       string    `json:"event_id"`
	EventType     string    `json:"event_type"` // "agent.created"
	Timestamp     time.Time `json:"timestamp"`
	AgentID       string    `json:"agent_id"`
	FirstName     string    `json:"first_name"`
	LastName      string    `json:"last_name"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	DateOfJoining string    `json:"date_of_joining"`
	Gender        string    `json:"gender"`
}

// DocumentCreatedEvent represents a document creation event from Kafka
type DocumentCreatedEvent struct {
	EventID          string    `json:"event_id"`
	EventType        string    `json:"event_type"` // "document.created"
	Timestamp        time.Time `json:"timestamp"`
	DocumentID       string    `json:"document_id"`
	DocumentType     string    `json:"document_type"` // "policy", "claim_evidence"
	FileName         string    `json:"file_name"`
	FileURL          string    `json:"file_url"` // S3 URL
	RelatedEntityType string   `json:"related_entity_type"` // "Customer", "Claim"
	RelatedEntityID   string   `json:"related_entity_id"`
	IsPrivate        bool      `json:"is_private"`
}

// SyncStatus represents the sync status of an event
type SyncStatus struct {
	EventID       string    `json:"event_id"`
	EventType     string    `json:"event_type"`
	Status        string    `json:"status"` // "pending", "synced", "failed"
	ERPNextDocID  string    `json:"erpnext_doc_id,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	SyncedAt      time.Time `json:"synced_at,omitempty"`
	RetryCount    int       `json:"retry_count"`
	LastRetryAt   time.Time `json:"last_retry_at,omitempty"`
}
