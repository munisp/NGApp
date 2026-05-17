package models

import "time"

type Claim struct {
	ID            string    `json:"id" db:"id"`
	PolicyID      string    `json:"policy_id" db:"policy_id"`
	CustomerID    string    `json:"customer_id" db:"customer_id"`
	Amount        float64   `json:"amount" db:"amount"`
	Status        string    `json:"status" db:"status"`
	Description   string    `json:"description" db:"description"`
	ClaimType     string    `json:"claim_type" db:"claim_type"`
	IncidentDate  time.Time `json:"incident_date" db:"incident_date"`
	FiledDate     time.Time `json:"filed_date" db:"filed_date"`
	ResolvedDate  *time.Time `json:"resolved_date,omitempty" db:"resolved_date"`
	ApprovedAmount float64  `json:"approved_amount" db:"approved_amount"`
	RejectionReason string  `json:"rejection_reason,omitempty" db:"rejection_reason"`
	AssignedTo    string    `json:"assigned_to,omitempty" db:"assigned_to"`
	Priority      string    `json:"priority" db:"priority"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type ClaimDocument struct {
	ID           string    `json:"id" db:"id"`
	ClaimID      string    `json:"claim_id" db:"claim_id"`
	DocumentType string    `json:"document_type" db:"document_type"`
	DocumentURL  string    `json:"document_url" db:"document_url"`
	Verified     bool      `json:"verified" db:"verified"`
	UploadedAt   time.Time `json:"uploaded_at" db:"uploaded_at"`
}

type ClaimNote struct {
	ID        string    `json:"id" db:"id"`
	ClaimID   string    `json:"claim_id" db:"claim_id"`
	Author    string    `json:"author" db:"author"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type ClaimFilter struct {
	Status     string `json:"status"`
	CustomerID string `json:"customer_id"`
	PolicyID   string `json:"policy_id"`
	Priority   string `json:"priority"`
	ClaimType  string `json:"claim_type"`
}

const (
	StatusPending   = "pending"
	StatusUnderReview = "under_review"
	StatusApproved  = "approved"
	StatusRejected  = "rejected"
	StatusPaid      = "paid"
	StatusClosed    = "closed"

	PriorityLow    = "low"
	PriorityMedium = "medium"
	PriorityHigh   = "high"
	PriorityCritical = "critical"
)

var ValidTransitions = map[string][]string{
	StatusPending:     {StatusUnderReview, StatusRejected},
	StatusUnderReview: {StatusApproved, StatusRejected},
	StatusApproved:    {StatusPaid, StatusClosed},
	StatusRejected:    {StatusClosed},
	StatusPaid:        {StatusClosed},
}
