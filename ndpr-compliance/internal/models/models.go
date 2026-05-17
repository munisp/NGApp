package models

import (
	"time"
	"github.com/google/uuid"
)

type NDPRDataController struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ControllerRef    string    `json:"controller_ref" gorm:"uniqueIndex;not null"`
	OrganizationName string    `json:"organization_name"`
	RegistrationNo   string    `json:"registration_no"`
	DPOName          string    `json:"dpo_name"`
	DPOEmail         string    `json:"dpo_email"`
	DPOPhone         string    `json:"dpo_phone"`
	Address          string    `json:"address"`
	State            string    `json:"state"`
	NITDARegNo       string    `json:"nitda_reg_no"`
	Status           string    `json:"status" gorm:"default:'active'"` 
	CreatedAt        time.Time `json:"created_at"`
}

type NDPRConsentRecord struct {
	ID            uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	SubjectID     string     `json:"subject_id" gorm:"index;not null"`
	SubjectName   string     `json:"subject_name"`
	Purpose       string     `json:"purpose"`
	LawfulBasis   string     `json:"lawful_basis"`
	DataClasses   string     `json:"data_classes"`
	Granted       bool       `json:"granted"`
	GrantedAt     *time.Time `json:"granted_at"`
	RevokedAt     *time.Time `json:"revoked_at"`
	ExpiresAt     *time.Time `json:"expires_at"`
	Channel       string     `json:"channel"`
	CreatedAt     time.Time  `json:"created_at"`
}

type NDPRDataRequest struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	RequestRef   string                 `json:"request_ref" gorm:"uniqueIndex;not null"`
	SubjectID    string                 `json:"subject_id" gorm:"index"`
	SubjectName  string                 `json:"subject_name"`
	RequestType  string                 `json:"request_type"`
	Description  string                 `json:"description"`
	Status       string                 `json:"status" gorm:"default:'pending'"` 
	DueDate      time.Time              `json:"due_date"`
	CompletedAt  *time.Time             `json:"completed_at"`
	Response     map[string]interface{} `json:"response" gorm:"serializer:json"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type NDPRAuditLog struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	Action       string                 `json:"action"`
	DataClass    string                 `json:"data_class"`
	SubjectID    string                 `json:"subject_id"`
	PerformedBy  string                 `json:"performed_by"`
	Purpose      string                 `json:"purpose"`
	LawfulBasis  string                 `json:"lawful_basis"`
	Details      map[string]interface{} `json:"details" gorm:"serializer:json"`
	CreatedAt    time.Time              `json:"created_at"`
}

type NDPRBreachNotification struct {
	ID              uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	BreachRef       string     `json:"breach_ref" gorm:"uniqueIndex;not null"`
	Description     string     `json:"description"`
	DataAffected    string     `json:"data_affected"`
	SubjectsCount   int        `json:"subjects_count"`
	Severity        string     `json:"severity"`
	DetectedAt      time.Time  `json:"detected_at"`
	NITDANotifiedAt *time.Time `json:"nitda_notified_at"`
	SubjectsNotifiedAt *time.Time `json:"subjects_notified_at"`
	RemediationSteps string    `json:"remediation_steps"`
	Status          string     `json:"status" gorm:"default:'detected'"` 
	CreatedAt       time.Time  `json:"created_at"`
}

type NDPRComplianceAssessment struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	AssessmentType  string                 `json:"assessment_type"`
	Scope           string                 `json:"scope"`
	Assessor        string                 `json:"assessor"`
	OverallScore    float64                `json:"overall_score"`
	Findings        map[string]interface{} `json:"findings" gorm:"serializer:json"`
	Recommendations string                 `json:"recommendations"`
	Status          string                 `json:"status" gorm:"default:'in_progress'"` 
	CompletedAt     *time.Time             `json:"completed_at"`
	CreatedAt       time.Time              `json:"created_at"`
}
