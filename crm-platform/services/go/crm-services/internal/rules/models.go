package rules

import (
	"time"

	"gorm.io/gorm"
)

// Transaction represents a financial transaction
type Transaction struct {
	ID           string                 `json:"id" gorm:"primaryKey"`
	CustomerID   string                 `json:"customer_id" gorm:"index"`
	Amount       float64                `json:"amount"`
	Currency     string                 `json:"currency"`
	Timestamp    time.Time              `json:"timestamp"`
	Channel      string                 `json:"channel"`
	Location     string                 `json:"location"`
	Merchant     string                 `json:"merchant"`
	DeviceID     string                 `json:"device_id"`
	IPAddress    string                 `json:"ip_address"`
	Status       string                 `json:"status"`
	SourceSystem string                 `json:"source_system"`
	RawData      map[string]interface{} `json:"raw_data" gorm:"type:jsonb"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	DeletedAt    gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// Customer represents a bank customer
type Customer struct {
	ID                string                 `json:"id" gorm:"primaryKey"`
	FirstName         string                 `json:"first_name"`
	LastName          string                 `json:"last_name"`
	PhoneNumber       string                 `json:"phone_number"`
	Email             string                 `json:"email"`
	PreferredLanguage string                 `json:"preferred_language"`
	UsualLocations    []string               `json:"usual_locations" gorm:"type:text[]"`
	RiskProfile       map[string]interface{} `json:"risk_profile" gorm:"type:jsonb"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// TransactionSource represents a source of transactions
type TransactionSource struct {
	ID          string         `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	Description string         `json:"description"`
	Config      string         `json:"config" gorm:"type:jsonb"`
	Active      bool           `json:"active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// FraudDetectionRule represents a rule for fraud detection
type FraudDetectionRule struct {
	ID          string         `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Condition   string         `json:"condition"`
	RiskScore   float64        `json:"risk_score"`
	Weight      int            `json:"weight"`
	Enabled     bool           `json:"enabled"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// FraudAlert represents a fraud alert
type FraudAlert struct {
	ID                string                 `json:"id" gorm:"primaryKey"`
	TransactionID     string                 `json:"transaction_id" gorm:"index"`
	CustomerID        string                 `json:"customer_id" gorm:"index"`
	RiskScore         float64                `json:"risk_score"`
	TriggeredRules    []string               `json:"triggered_rules" gorm:"type:text[]"`
	Status            string                 `json:"status"`
	Action            string                 `json:"action"`
	VerificationState string                 `json:"verification_state"`
	Data              map[string]interface{} `json:"data" gorm:"type:jsonb"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// FraudCase represents a fraud case
type FraudCase struct {
	ID                  string                 `json:"id" gorm:"primaryKey"`
	AlertID             string                 `json:"alert_id" gorm:"index"`
	CustomerID          string                 `json:"customer_id" gorm:"index"`
	TransactionID       string                 `json:"transaction_id" gorm:"index"`
	Status              string                 `json:"status"`
	RiskScore           float64                `json:"risk_score"`
	VerificationResult  string                 `json:"verification_result"`
	Resolution          string                 `json:"resolution"`
	CallID              string                 `json:"call_id"`
	CallSessionID       string                 `json:"call_session_id"`
	CallDuration        int                    `json:"call_duration"`
	CallRecordingURL    string                 `json:"call_recording_url"`
	CallTranscriptURL   string                 `json:"call_transcript_url"`
	InvestigationCaseID string                 `json:"investigation_case_id"`
	Data                map[string]interface{} `json:"data" gorm:"type:jsonb"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
	ResolutionTime      time.Time              `json:"resolution_time"`
	DeletedAt           gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// FraudInvestigation represents a fraud investigation
type FraudInvestigation struct {
	ID          string                 `json:"id" gorm:"primaryKey"`
	FraudCaseID string                 `json:"fraud_case_id" gorm:"index"`
	CustomerID  string                 `json:"customer_id" gorm:"index"`
	Status      string                 `json:"status"`
	Priority    string                 `json:"priority"`
	AssignedTo  string                 `json:"assigned_to"`
	Notes       string                 `json:"notes"`
	Data        map[string]interface{} `json:"data" gorm:"type:jsonb"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	ClosedAt    time.Time              `json:"closed_at"`
	DeletedAt   gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// VerificationCall represents a verification call
type VerificationCall struct {
	ID                string                 `json:"id" gorm:"primaryKey"`
	FraudCaseID       string                 `json:"fraud_case_id" gorm:"index"`
	CustomerID        string                 `json:"customer_id" gorm:"index"`
	PhoneNumber       string                 `json:"phone_number"`
	Status            string                 `json:"status"`
	Direction         string                 `json:"direction"`
	StartTime         time.Time              `json:"start_time"`
	EndTime           time.Time              `json:"end_time"`
	Duration          int                    `json:"duration"`
	RecordingURL      string                 `json:"recording_url"`
	TranscriptURL     string                 `json:"transcript_url"`
	Language          string                 `json:"language"`
	VerificationState string                 `json:"verification_state"`
	Result            string                 `json:"result"`
	Data              map[string]interface{} `json:"data" gorm:"type:jsonb"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// MLModel represents a machine learning model
type MLModel struct {
	ID          string                 `json:"id" gorm:"primaryKey"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	FilePath    string                 `json:"file_path"`
	Metrics     map[string]interface{} `json:"metrics" gorm:"type:jsonb"`
	Active      bool                   `json:"active"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	DeletedAt   gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// MLPrediction represents a prediction from a machine learning model
type MLPrediction struct {
	ID            string                 `json:"id" gorm:"primaryKey"`
	ModelID       string                 `json:"model_id" gorm:"index"`
	TransactionID string                 `json:"transaction_id" gorm:"index"`
	Prediction    bool                   `json:"prediction"`
	Probability   float64                `json:"probability"`
	Features      map[string]interface{} `json:"features" gorm:"type:jsonb"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	DeletedAt     gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

// SystemMetric represents a system metric
type SystemMetric struct {
	ID        string                 `json:"id" gorm:"primaryKey"`
	Name      string                 `json:"name"`
	Value     float64                `json:"value"`
	Labels    map[string]string      `json:"labels" gorm:"type:jsonb"`
	Metadata  map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	Timestamp time.Time              `json:"timestamp"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
	DeletedAt gorm.DeletedAt         `json:"deleted_at" gorm:"index"`
}

