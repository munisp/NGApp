import os
package main

import (
	"os"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// =====================================================
// MODELS AND STRUCTURES
// =====================================================

// Enums
type OnboardingStatus string
type KYCStatus string
type TrainingStatus string
type CertificationStatus string
type DocumentType string
type VerificationMethod string
type TrainingType string
type AssessmentType string
type PerformanceCategory string

const (
	// Onboarding Status
	OnboardingNotStarted        OnboardingStatus = "not_started"
	OnboardingInProgress        OnboardingStatus = "in_progress"
	OnboardingDocumentsPending  OnboardingStatus = "documents_pending"
	OnboardingKYCPending        OnboardingStatus = "kyc_pending"
	OnboardingTrainingPending   OnboardingStatus = "training_pending"
	OnboardingBackgroundPending OnboardingStatus = "background_check_pending"
	OnboardingCompleted         OnboardingStatus = "completed"
	OnboardingRejected          OnboardingStatus = "rejected"

	// KYC Status
	KYCNotStarted             KYCStatus = "not_started"
	KYCDocumentsUploaded      KYCStatus = "documents_uploaded"
	KYCUnderReview            KYCStatus = "under_review"
	KYCAdditionalInfoRequired KYCStatus = "additional_info_required"
	KYCVerified               KYCStatus = "verified"
	KYCRejected               KYCStatus = "rejected"
	KYCExpired                KYCStatus = "expired"

	// Training Status
	TrainingNotStarted TrainingStatus = "not_started"
	TrainingEnrolled   TrainingStatus = "enrolled"
	TrainingInProgress TrainingStatus = "in_progress"
	TrainingCompleted  TrainingStatus = "completed"
	TrainingFailed     TrainingStatus = "failed"
	TrainingExpired    TrainingStatus = "expired"

	// Document Types
	DocumentNationalID        DocumentType = "national_id"
	DocumentPassport          DocumentType = "passport"
	DocumentDriversLicense    DocumentType = "drivers_license"
	DocumentBusinessLicense   DocumentType = "business_license"
	DocumentTaxCertificate    DocumentType = "tax_certificate"
	DocumentBankStatement     DocumentType = "bank_statement"
	DocumentUtilityBill       DocumentType = "utility_bill"
	DocumentPhoto             DocumentType = "photo"
	DocumentEducationalCert   DocumentType = "educational_certificate"
	DocumentEmploymentLetter  DocumentType = "employment_letter"
	DocumentReferenceLetter   DocumentType = "reference_letter"

	// Verification Methods
	VerificationManual     VerificationMethod = "manual"
	VerificationAutomated  VerificationMethod = "automated"
	VerificationHybrid     VerificationMethod = "hybrid"
	VerificationThirdParty VerificationMethod = "third_party"

	// Training Types
	TrainingOnboarding   TrainingType = "onboarding"
	TrainingCompliance   TrainingType = "compliance"
	TrainingProduct      TrainingType = "product"
	TrainingTechnical    TrainingType = "technical"
	TrainingSoftSkills   TrainingType = "soft_skills"
	TrainingCertification TrainingType = "certification"
)

// Agent Onboarding Model
type AgentOnboarding struct {
	ID                           uuid.UUID        `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentID                      uuid.UUID        `json:"agent_id" gorm:"type:uuid;not null"`
	AgentTier                    string           `json:"agent_tier" gorm:"size:20;not null"`
	ApplicationNumber            string           `json:"application_number" gorm:"size:50;unique;not null"`
	Status                       OnboardingStatus `json:"status" gorm:"type:onboarding_status;default:not_started"`
	CurrentStep                  string           `json:"current_step" gorm:"size:100;not null;default:application_submission"`
	TotalSteps                   int              `json:"total_steps" gorm:"not null;default:8"`
	CompletedSteps               int              `json:"completed_steps" gorm:"default:0"`
	ProgressPercentage           float64          `json:"progress_percentage" gorm:"type:decimal(5,2);default:0.0"`
	ApplicationDate              time.Time        `json:"application_date" gorm:"default:CURRENT_TIMESTAMP"`
	DocumentsSubmittedAt         *time.Time       `json:"documents_submitted_at"`
	KYCInitiatedAt               *time.Time       `json:"kyc_initiated_at"`
	KYCCompletedAt               *time.Time       `json:"kyc_completed_at"`
	TrainingStartedAt            *time.Time       `json:"training_started_at"`
	TrainingCompletedAt          *time.Time       `json:"training_completed_at"`
	BackgroundCheckInitiatedAt   *time.Time       `json:"background_check_initiated_at"`
	BackgroundCheckCompletedAt   *time.Time       `json:"background_check_completed_at"`
	OnboardingCompletedAt        *time.Time       `json:"onboarding_completed_at"`
	AssignedReviewer             *uuid.UUID       `json:"assigned_reviewer"`
	AssignedTrainer              *uuid.UUID       `json:"assigned_trainer"`
	AssignedSupervisor           *uuid.UUID       `json:"assigned_supervisor"`
	DocumentsComplete            bool             `json:"documents_complete" gorm:"default:false"`
	KYCVerified                  bool             `json:"kyc_verified" gorm:"default:false"`
	TrainingCompleted            bool             `json:"training_completed" gorm:"default:false"`
	BackgroundCheckPassed        bool             `json:"background_check_passed" gorm:"default:false"`
	ReferencesVerified           bool             `json:"references_verified" gorm:"default:false"`
	BankAccountVerified          bool             `json:"bank_account_verified" gorm:"default:false"`
	EquipmentAssigned            bool             `json:"equipment_assigned" gorm:"default:false"`
	TerritoryAssigned            bool             `json:"territory_assigned" gorm:"default:false"`
	ReviewerNotes                string           `json:"reviewer_notes" gorm:"type:text"`
	RejectionReason              string           `json:"rejection_reason" gorm:"type:text"`
	SpecialInstructions          string           `json:"special_instructions" gorm:"type:text"`
	CreatedAt                    time.Time        `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                    time.Time        `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                    *uuid.UUID       `json:"created_by"`
	UpdatedBy                    *uuid.UUID       `json:"updated_by"`
}

// KYC Verification Model
type KYCVerification struct {
	ID                                uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentID                           uuid.UUID          `json:"agent_id" gorm:"type:uuid;not null"`
	AgentTier                         string             `json:"agent_tier" gorm:"size:20;not null"`
	KYCReferenceNumber                string             `json:"kyc_reference_number" gorm:"size:50;unique;not null"`
	Status                            KYCStatus          `json:"status" gorm:"type:kyc_status;default:not_started"`
	VerificationLevel                 string             `json:"verification_level" gorm:"size:20;default:basic"`
	RiskLevel                         string             `json:"risk_level" gorm:"size:20;default:medium"`
	IdentityVerified                  bool               `json:"identity_verified" gorm:"default:false"`
	AddressVerified                   bool               `json:"address_verified" gorm:"default:false"`
	PhoneVerified                     bool               `json:"phone_verified" gorm:"default:false"`
	EmailVerified                     bool               `json:"email_verified" gorm:"default:false"`
	BusinessRegistrationVerified      bool               `json:"business_registration_verified" gorm:"default:false"`
	TaxRegistrationVerified           bool               `json:"tax_registration_verified" gorm:"default:false"`
	BusinessAddressVerified           bool               `json:"business_address_verified" gorm:"default:false"`
	BankAccountVerified               bool               `json:"bank_account_verified" gorm:"default:false"`
	FinancialStatementsVerified       bool               `json:"financial_statements_verified" gorm:"default:false"`
	CreditCheckCompleted              bool               `json:"credit_check_completed" gorm:"default:false"`
	DocumentVerificationMethod        VerificationMethod `json:"document_verification_method" gorm:"type:verification_method"`
	BiometricVerificationCompleted    bool               `json:"biometric_verification_completed" gorm:"default:false"`
	ThirdPartyVerificationCompleted   bool               `json:"third_party_verification_completed" gorm:"default:false"`
	OverallScore                      float64            `json:"overall_score" gorm:"type:decimal(5,2);default:0.0"`
	IdentityScore                     float64            `json:"identity_score" gorm:"type:decimal(5,2);default:0.0"`
	AddressScore                      float64            `json:"address_score" gorm:"type:decimal(5,2);default:0.0"`
	FinancialScore                    float64            `json:"financial_score" gorm:"type:decimal(5,2);default:0.0"`
	RiskScore                         float64            `json:"risk_score" gorm:"type:decimal(5,2);default:50.0"`
	InitiatedAt                       time.Time          `json:"initiated_at" gorm:"default:CURRENT_TIMESTAMP"`
	DocumentsSubmittedAt              *time.Time         `json:"documents_submitted_at"`
	ReviewStartedAt                   *time.Time         `json:"review_started_at"`
	ReviewCompletedAt                 *time.Time         `json:"review_completed_at"`
	VerificationCompletedAt           *time.Time         `json:"verification_completed_at"`
	ExpiryDate                        *time.Time         `json:"expiry_date"`
	AssignedReviewer                  *uuid.UUID         `json:"assigned_reviewer"`
	VerifiedBy                        *uuid.UUID         `json:"verified_by"`
	ReviewerNotes                     string             `json:"reviewer_notes" gorm:"type:text"`
	RejectionReason                   string             `json:"rejection_reason" gorm:"type:text"`
	AdditionalRequirements            string             `json:"additional_requirements" gorm:"type:text"`
	CreatedAt                         time.Time          `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                         time.Time          `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                         *uuid.UUID         `json:"created_by"`
	UpdatedBy                         *uuid.UUID         `json:"updated_by"`
}

// Agent Document Model
type AgentDocument struct {
	ID                        uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentID                   uuid.UUID          `json:"agent_id" gorm:"type:uuid;not null"`
	KYCVerificationID         *uuid.UUID         `json:"kyc_verification_id" gorm:"type:uuid"`
	DocumentType              DocumentType       `json:"document_type" gorm:"type:document_type;not null"`
	DocumentName              string             `json:"document_name" gorm:"size:255;not null"`
	DocumentNumber            string             `json:"document_number" gorm:"size:100"`
	IssuingAuthority          string             `json:"issuing_authority" gorm:"size:255"`
	IssueDate                 *time.Time         `json:"issue_date"`
	ExpiryDate                *time.Time         `json:"expiry_date"`
	FilePath                  string             `json:"file_path" gorm:"type:text;not null"`
	FileName                  string             `json:"file_name" gorm:"size:255;not null"`
	FileSizeBytes             int64              `json:"file_size_bytes"`
	FileType                  string             `json:"file_type" gorm:"size:50"`
	FileHash                  string             `json:"file_hash" gorm:"size:128;unique"`
	VerificationStatus        KYCStatus          `json:"verification_status" gorm:"type:kyc_status;default:not_started"`
	VerificationMethod        VerificationMethod `json:"verification_method" gorm:"type:verification_method"`
	VerifiedAt                *time.Time         `json:"verified_at"`
	VerifiedBy                *uuid.UUID         `json:"verified_by"`
	VerificationNotes         string             `json:"verification_notes" gorm:"type:text"`
	OCRProcessed              bool               `json:"ocr_processed" gorm:"default:false"`
	OCRConfidence             *float64           `json:"ocr_confidence" gorm:"type:decimal(5,2)"`
	ExtractedText             string             `json:"extracted_text" gorm:"type:text"`
	ExtractedData             string             `json:"extracted_data" gorm:"type:jsonb"`
	AIVerificationScore       *float64           `json:"ai_verification_score" gorm:"type:decimal(5,2)"`
	AIVerificationFlags       []string           `json:"ai_verification_flags" gorm:"type:text[]"`
	ImageQualityScore         *float64           `json:"image_quality_score" gorm:"type:decimal(5,2)"`
	DocumentAuthenticityScore *float64           `json:"document_authenticity_score" gorm:"type:decimal(5,2)"`
	TamperingDetected         bool               `json:"tampering_detected" gorm:"default:false"`
	UploadedAt                time.Time          `json:"uploaded_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedAt                 time.Time          `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                 time.Time          `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	UploadedBy                *uuid.UUID         `json:"uploaded_by"`
}

// Training Program Model
type TrainingProgram struct {
	ID                           uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	ProgramCode                  string       `json:"program_code" gorm:"size:20;unique;not null"`
	ProgramName                  string       `json:"program_name" gorm:"size:255;not null"`
	ProgramDescription           string       `json:"program_description" gorm:"type:text"`
	TargetTier                   string       `json:"target_tier" gorm:"size:20;not null"`
	TrainingType                 TrainingType `json:"training_type" gorm:"type:training_type;not null"`
	IsMandatory                  bool         `json:"is_mandatory" gorm:"default:true"`
	PrerequisitePrograms         []uuid.UUID  `json:"prerequisite_programs" gorm:"type:uuid[]"`
	EstimatedDurationHours       int          `json:"estimated_duration_hours" gorm:"not null"`
	TotalModules                 int          `json:"total_modules" gorm:"default:1"`
	PassingScore                 float64      `json:"passing_score" gorm:"type:decimal(5,2);default:70.0"`
	MaxAttempts                  int          `json:"max_attempts" gorm:"default:3"`
	CertificationProvided        bool         `json:"certification_provided" gorm:"default:false"`
	CertificationValidityMonths  *int         `json:"certification_validity_months"`
	ContinuingEducationRequired  bool         `json:"continuing_education_required" gorm:"default:false"`
	IsActive                     bool         `json:"is_active" gorm:"default:true"`
	Version                      string       `json:"version" gorm:"size:10;default:1.0"`
	CreatedAt                    time.Time    `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                    time.Time    `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                    *uuid.UUID   `json:"created_by"`
	UpdatedBy                    *uuid.UUID   `json:"updated_by"`
}

// Training Module Model
type TrainingModule struct {
	ID                    uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	ProgramID             uuid.UUID       `json:"program_id" gorm:"type:uuid;not null"`
	ModuleCode            string          `json:"module_code" gorm:"size:20;not null"`
	ModuleName            string          `json:"module_name" gorm:"size:255;not null"`
	ModuleDescription     string          `json:"module_description" gorm:"type:text"`
	ModuleOrder           int             `json:"module_order" gorm:"not null"`
	EstimatedDurationHours int            `json:"estimated_duration_hours" gorm:"not null"`
	IsMandatory           bool            `json:"is_mandatory" gorm:"default:true"`
	PrerequisiteModules   []uuid.UUID     `json:"prerequisite_modules" gorm:"type:uuid[]"`
	ContentType           string          `json:"content_type" gorm:"size:50"`
	ContentURL            string          `json:"content_url" gorm:"type:text"`
	ContentMetadata       string          `json:"content_metadata" gorm:"type:jsonb"`
	HasAssessment         bool            `json:"has_assessment" gorm:"default:false"`
	AssessmentType        AssessmentType  `json:"assessment_type" gorm:"type:assessment_type"`
	PassingScore          float64         `json:"passing_score" gorm:"type:decimal(5,2);default:70.0"`
	MaxAttempts           int             `json:"max_attempts" gorm:"default:3"`
	IsActive              bool            `json:"is_active" gorm:"default:true"`
	CreatedAt             time.Time       `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt             time.Time       `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy             *uuid.UUID      `json:"created_by"`
	UpdatedBy             *uuid.UUID      `json:"updated_by"`
	Program               TrainingProgram `json:"program" gorm:"foreignKey:ProgramID"`
}

// Agent Training Enrollment Model
type AgentTrainingEnrollment struct {
	ID                     uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentID                uuid.UUID       `json:"agent_id" gorm:"type:uuid;not null"`
	ProgramID              uuid.UUID       `json:"program_id" gorm:"type:uuid;not null"`
	EnrollmentDate         time.Time       `json:"enrollment_date" gorm:"default:CURRENT_TIMESTAMP"`
	EnrollmentType         string          `json:"enrollment_type" gorm:"size:20;default:mandatory"`
	AssignedBy             *uuid.UUID      `json:"assigned_by"`
	Status                 TrainingStatus  `json:"status" gorm:"type:training_status;default:enrolled"`
	ProgressPercentage     float64         `json:"progress_percentage" gorm:"type:decimal(5,2);default:0.0"`
	CurrentModuleID        *uuid.UUID      `json:"current_module_id"`
	StartedAt              *time.Time      `json:"started_at"`
	TargetCompletionDate   *time.Time      `json:"target_completion_date"`
	CompletedAt            *time.Time      `json:"completed_at"`
	AttemptsCount          int             `json:"attempts_count" gorm:"default:0"`
	BestScore              float64         `json:"best_score" gorm:"type:decimal(5,2);default:0.0"`
	LatestScore            float64         `json:"latest_score" gorm:"type:decimal(5,2);default:0.0"`
	TotalStudyHours        float64         `json:"total_study_hours" gorm:"type:decimal(8,2);default:0.0"`
	CertificationEarned    bool            `json:"certification_earned" gorm:"default:false"`
	CertificateNumber      string          `json:"certificate_number" gorm:"size:100"`
	CertificateIssuedAt    *time.Time      `json:"certificate_issued_at"`
	CertificateExpiresAt   *time.Time      `json:"certificate_expires_at"`
	CreatedAt              time.Time       `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt              time.Time       `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	Program                TrainingProgram `json:"program" gorm:"foreignKey:ProgramID"`
}

// Performance Evaluation Model
type PerformanceEvaluation struct {
	ID                        uuid.UUID           `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentID                   uuid.UUID           `json:"agent_id" gorm:"type:uuid;not null"`
	EvaluationPeriodStart     time.Time           `json:"evaluation_period_start" gorm:"type:date;not null"`
	EvaluationPeriodEnd       time.Time           `json:"evaluation_period_end" gorm:"type:date;not null"`
	EvaluationType            string              `json:"evaluation_type" gorm:"size:20;default:regular"`
	OverallScore              *float64            `json:"overall_score" gorm:"type:decimal(5,2)"`
	OverallRating             string              `json:"overall_rating" gorm:"size:20"`
	TransactionVolumeScore    *float64            `json:"transaction_volume_score" gorm:"type:decimal(5,2)"`
	CustomerSatisfactionScore *float64            `json:"customer_satisfaction_score" gorm:"type:decimal(5,2)"`
	ComplianceScore           *float64            `json:"compliance_score" gorm:"type:decimal(5,2)"`
	TrainingScore             *float64            `json:"training_score" gorm:"type:decimal(5,2)"`
	NetworkGrowthScore        *float64            `json:"network_growth_score" gorm:"type:decimal(5,2)"`
	Status                    string              `json:"status" gorm:"size:20;default:draft"`
	EvaluatorID               *uuid.UUID          `json:"evaluator_id"`
	ReviewerID                *uuid.UUID          `json:"reviewer_id"`
	ApprovedBy                *uuid.UUID          `json:"approved_by"`
	EvaluationDate            time.Time           `json:"evaluation_date" gorm:"default:CURRENT_TIMESTAMP"`
	SubmittedAt               *time.Time          `json:"submitted_at"`
	ReviewedAt                *time.Time          `json:"reviewed_at"`
	ApprovedAt                *time.Time          `json:"approved_at"`
	PublishedAt               *time.Time          `json:"published_at"`
	EvaluatorComments         string              `json:"evaluator_comments" gorm:"type:text"`
	Strengths                 string              `json:"strengths" gorm:"type:text"`
	AreasForImprovement       string              `json:"areas_for_improvement" gorm:"type:text"`
	DevelopmentRecommendations string             `json:"development_recommendations" gorm:"type:text"`
	ActionPlan                string              `json:"action_plan" gorm:"type:text"`
	CreatedAt                 time.Time           `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                 time.Time           `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                 *uuid.UUID          `json:"created_by"`
	UpdatedBy                 *uuid.UUID          `json:"updated_by"`
}

// =====================================================
// REQUEST/RESPONSE STRUCTURES
// =====================================================

type CreateOnboardingRequest struct {
	AgentID     uuid.UUID `json:"agent_id" binding:"required"`
	AgentTier   string    `json:"agent_tier" binding:"required"`
	CreatedBy   uuid.UUID `json:"created_by" binding:"required"`
}

type UpdateOnboardingRequest struct {
	Status                       *OnboardingStatus `json:"status"`
	CurrentStep                  *string           `json:"current_step"`
	CompletedSteps               *int              `json:"completed_steps"`
	AssignedReviewer             *uuid.UUID        `json:"assigned_reviewer"`
	AssignedTrainer              *uuid.UUID        `json:"assigned_trainer"`
	AssignedSupervisor           *uuid.UUID        `json:"assigned_supervisor"`
	DocumentsComplete            *bool             `json:"documents_complete"`
	KYCVerified                  *bool             `json:"kyc_verified"`
	TrainingCompleted            *bool             `json:"training_completed"`
	BackgroundCheckPassed        *bool             `json:"background_check_passed"`
	ReferencesVerified           *bool             `json:"references_verified"`
	BankAccountVerified          *bool             `json:"bank_account_verified"`
	EquipmentAssigned            *bool             `json:"equipment_assigned"`
	TerritoryAssigned            *bool             `json:"territory_assigned"`
	ReviewerNotes                *string           `json:"reviewer_notes"`
	RejectionReason              *string           `json:"rejection_reason"`
	SpecialInstructions          *string           `json:"special_instructions"`
	UpdatedBy                    uuid.UUID         `json:"updated_by" binding:"required"`
}

type CreateKYCRequest struct {
	AgentID           uuid.UUID `json:"agent_id" binding:"required"`
	AgentTier         string    `json:"agent_tier" binding:"required"`
	VerificationLevel string    `json:"verification_level"`
	CreatedBy         uuid.UUID `json:"created_by" binding:"required"`
}

type UpdateKYCRequest struct {
	Status                            *KYCStatus          `json:"status"`
	VerificationLevel                 *string             `json:"verification_level"`
	RiskLevel                         *string             `json:"risk_level"`
	IdentityVerified                  *bool               `json:"identity_verified"`
	AddressVerified                   *bool               `json:"address_verified"`
	PhoneVerified                     *bool               `json:"phone_verified"`
	EmailVerified                     *bool               `json:"email_verified"`
	BusinessRegistrationVerified      *bool               `json:"business_registration_verified"`
	TaxRegistrationVerified           *bool               `json:"tax_registration_verified"`
	BusinessAddressVerified           *bool               `json:"business_address_verified"`
	BankAccountVerified               *bool               `json:"bank_account_verified"`
	FinancialStatementsVerified       *bool               `json:"financial_statements_verified"`
	CreditCheckCompleted              *bool               `json:"credit_check_completed"`
	DocumentVerificationMethod        *VerificationMethod `json:"document_verification_method"`
	BiometricVerificationCompleted    *bool               `json:"biometric_verification_completed"`
	ThirdPartyVerificationCompleted   *bool               `json:"third_party_verification_completed"`
	OverallScore                      *float64            `json:"overall_score"`
	IdentityScore                     *float64            `json:"identity_score"`
	AddressScore                      *float64            `json:"address_score"`
	FinancialScore                    *float64            `json:"financial_score"`
	RiskScore                         *float64            `json:"risk_score"`
	AssignedReviewer                  *uuid.UUID          `json:"assigned_reviewer"`
	VerifiedBy                        *uuid.UUID          `json:"verified_by"`
	ReviewerNotes                     *string             `json:"reviewer_notes"`
	RejectionReason                   *string             `json:"rejection_reason"`
	AdditionalRequirements            *string             `json:"additional_requirements"`
	UpdatedBy                         uuid.UUID           `json:"updated_by" binding:"required"`
}

type CreateTrainingProgramRequest struct {
	ProgramCode                 string       `json:"program_code" binding:"required"`
	ProgramName                 string       `json:"program_name" binding:"required"`
	ProgramDescription          string       `json:"program_description"`
	TargetTier                  string       `json:"target_tier" binding:"required"`
	TrainingType                TrainingType `json:"training_type" binding:"required"`
	IsMandatory                 bool         `json:"is_mandatory"`
	PrerequisitePrograms        []uuid.UUID  `json:"prerequisite_programs"`
	EstimatedDurationHours      int          `json:"estimated_duration_hours" binding:"required"`
	TotalModules                int          `json:"total_modules"`
	PassingScore                float64      `json:"passing_score"`
	MaxAttempts                 int          `json:"max_attempts"`
	CertificationProvided       bool         `json:"certification_provided"`
	CertificationValidityMonths *int         `json:"certification_validity_months"`
	ContinuingEducationRequired bool         `json:"continuing_education_required"`
	CreatedBy                   uuid.UUID    `json:"created_by" binding:"required"`
}

type EnrollAgentRequest struct {
	AgentID                uuid.UUID  `json:"agent_id" binding:"required"`
	ProgramID              uuid.UUID  `json:"program_id" binding:"required"`
	EnrollmentType         string     `json:"enrollment_type"`
	TargetCompletionDate   *time.Time `json:"target_completion_date"`
	AssignedBy             uuid.UUID  `json:"assigned_by" binding:"required"`
}

type CreatePerformanceEvaluationRequest struct {
	AgentID                   uuid.UUID `json:"agent_id" binding:"required"`
	EvaluationPeriodStart     time.Time `json:"evaluation_period_start" binding:"required"`
	EvaluationPeriodEnd       time.Time `json:"evaluation_period_end" binding:"required"`
	EvaluationType            string    `json:"evaluation_type"`
	EvaluatorID               uuid.UUID `json:"evaluator_id" binding:"required"`
	CreatedBy                 uuid.UUID `json:"created_by" binding:"required"`
}

type UpdatePerformanceEvaluationRequest struct {
	OverallScore                   *float64   `json:"overall_score"`
	OverallRating                  *string    `json:"overall_rating"`
	TransactionVolumeScore         *float64   `json:"transaction_volume_score"`
	CustomerSatisfactionScore      *float64   `json:"customer_satisfaction_score"`
	ComplianceScore                *float64   `json:"compliance_score"`
	TrainingScore                  *float64   `json:"training_score"`
	NetworkGrowthScore             *float64   `json:"network_growth_score"`
	Status                         *string    `json:"status"`
	EvaluatorComments              *string    `json:"evaluator_comments"`
	Strengths                      *string    `json:"strengths"`
	AreasForImprovement            *string    `json:"areas_for_improvement"`
	DevelopmentRecommendations     *string    `json:"development_recommendations"`
	ActionPlan                     *string    `json:"action_plan"`
	UpdatedBy                      uuid.UUID  `json:"updated_by" binding:"required"`
}

// =====================================================
// DATABASE CONNECTION
// =====================================================

var db *gorm.DB

func initDatabase() {
	var err error
	
	// Database configuration - FAIL CLOSED on missing credentials
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := requireEnv("DB_USER")      // Required - no default
	password := requireEnv("DB_PASSWORD") // Required - no default (security)
	dbname := requireEnv("DB_NAME")    // Required - no default
	sslmode := getEnv("DB_SSLMODE", "require") // Default to secure
	
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	
	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get database instance:", err)
	}
	
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	
	log.Println("Database connected successfully")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

func generateApplicationNumber() string {
	return fmt.Sprintf("APP-%d-%s", time.Now().Unix(), uuid.New().String()[:8])
}

func generateKYCReferenceNumber() string {
	return fmt.Sprintf("KYC-%d-%s", time.Now().Unix(), uuid.New().String()[:8])
}

func generateCertificateNumber() string {
	return fmt.Sprintf("CERT-%d-%s", time.Now().Unix(), uuid.New().String()[:8])
}

func calculateFileHash(file multipart.File) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func saveUploadedFile(file *multipart.FileHeader, agentID uuid.UUID, documentType DocumentType) (string, string, error) {
	// Create upload directory
	uploadDir := fmt.Sprintf("uploads/agents/%s/documents", agentID.String())
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", "", err
	}
	
	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", documentType, time.Now().Unix(), ext)
	filepath := filepath.Join(uploadDir, filename)
	
	// Save file
	src, err := file.Open()
	if err != nil {
		return "", "", err
	}
	defer src.Close()
	
	dst, err := os.Create(filepath)
	if err != nil {
		return "", "", err
	}
	defer dst.Close()
	
	if _, err = io.Copy(dst, src); err != nil {
		return "", "", err
	}
	
	return filepath, filename, nil
}

func updateOnboardingProgress(onboardingID uuid.UUID) error {
	var onboarding AgentOnboarding
	if err := db.First(&onboarding, onboardingID).Error; err != nil {
		return err
	}
	
	// Count completed requirements
	completedCount := 0
	totalCount := 8
	
	if onboarding.DocumentsComplete {
		completedCount++
	}
	if onboarding.KYCVerified {
		completedCount++
	}
	if onboarding.TrainingCompleted {
		completedCount++
	}
	if onboarding.BackgroundCheckPassed {
		completedCount++
	}
	if onboarding.ReferencesVerified {
		completedCount++
	}
	if onboarding.BankAccountVerified {
		completedCount++
	}
	if onboarding.EquipmentAssigned {
		completedCount++
	}
	if onboarding.TerritoryAssigned {
		completedCount++
	}
	
	// Update progress
	progressPercentage := float64(completedCount) / float64(totalCount) * 100
	
	updates := map[string]interface{}{
		"completed_steps":      completedCount,
		"progress_percentage":  progressPercentage,
		"updated_at":          time.Now(),
	}
	
	// Update status based on progress
	if completedCount == totalCount {
		updates["status"] = OnboardingCompleted
		updates["onboarding_completed_at"] = time.Now()
	} else if completedCount > 0 {
		updates["status"] = OnboardingInProgress
	}
	
	return db.Model(&onboarding).Updates(updates).Error
}

func calculateKYCOverallScore(kyc *KYCVerification) float64 {
	score := 0.0
	maxScore := 100.0
	
	// Identity verification (30%)
	if kyc.IdentityVerified {
		score += 30.0
	}
	
	// Address verification (20%)
	if kyc.AddressVerified {
		score += 20.0
	}
	
	// Contact verification (15%)
	if kyc.PhoneVerified && kyc.EmailVerified {
		score += 15.0
	} else if kyc.PhoneVerified || kyc.EmailVerified {
		score += 7.5
	}
	
	// Financial verification (25%)
	if kyc.BankAccountVerified {
		score += 15.0
	}
	if kyc.FinancialStatementsVerified {
		score += 10.0
	}
	
	// Business verification (10%) - for business agents
	if kyc.BusinessRegistrationVerified && kyc.TaxRegistrationVerified {
		score += 10.0
	} else if kyc.BusinessRegistrationVerified || kyc.TaxRegistrationVerified {
		score += 5.0
	}
	
	return score
}

// =====================================================
// ONBOARDING HANDLERS
// =====================================================

func createOnboarding(c *gin.Context) {
	var req CreateOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Check if onboarding already exists for this agent
	var existingOnboarding AgentOnboarding
	if err := db.Where("agent_id = ?", req.AgentID).First(&existingOnboarding).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Onboarding already exists for this agent"})
		return
	}
	
	// Create new onboarding record
	onboarding := AgentOnboarding{
		AgentID:           req.AgentID,
		AgentTier:         req.AgentTier,
		ApplicationNumber: generateApplicationNumber(),
		Status:            OnboardingNotStarted,
		CurrentStep:       "application_submission",
		TotalSteps:        8,
		CompletedSteps:    0,
		ProgressPercentage: 0.0,
		ApplicationDate:   time.Now(),
		CreatedBy:         &req.CreatedBy,
	}
	
	if err := db.Create(&onboarding).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create onboarding record"})
		return
	}
	
	c.JSON(http.StatusCreated, onboarding)
}

func getOnboarding(c *gin.Context) {
	id := c.Param("id")
	onboardingID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid onboarding ID"})
		return
	}
	
	var onboarding AgentOnboarding
	if err := db.First(&onboarding, onboardingID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Onboarding record not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve onboarding record"})
		return
	}
	
	c.JSON(http.StatusOK, onboarding)
}

func updateOnboarding(c *gin.Context) {
	id := c.Param("id")
	onboardingID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid onboarding ID"})
		return
	}
	
	var req UpdateOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Get existing onboarding record
	var onboarding AgentOnboarding
	if err := db.First(&onboarding, onboardingID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Onboarding record not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve onboarding record"})
		return
	}
	
	// Prepare updates
	updates := map[string]interface{}{
		"updated_by": req.UpdatedBy,
		"updated_at": time.Now(),
	}
	
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.CurrentStep != nil {
		updates["current_step"] = *req.CurrentStep
	}
	if req.CompletedSteps != nil {
		updates["completed_steps"] = *req.CompletedSteps
		updates["progress_percentage"] = float64(*req.CompletedSteps) / float64(onboarding.TotalSteps) * 100
	}
	if req.AssignedReviewer != nil {
		updates["assigned_reviewer"] = *req.AssignedReviewer
	}
	if req.AssignedTrainer != nil {
		updates["assigned_trainer"] = *req.AssignedTrainer
	}
	if req.AssignedSupervisor != nil {
		updates["assigned_supervisor"] = *req.AssignedSupervisor
	}
	if req.DocumentsComplete != nil {
		updates["documents_complete"] = *req.DocumentsComplete
		if *req.DocumentsComplete {
			updates["documents_submitted_at"] = time.Now()
		}
	}
	if req.KYCVerified != nil {
		updates["kyc_verified"] = *req.KYCVerified
		if *req.KYCVerified {
			updates["kyc_completed_at"] = time.Now()
		}
	}
	if req.TrainingCompleted != nil {
		updates["training_completed"] = *req.TrainingCompleted
		if *req.TrainingCompleted {
			updates["training_completed_at"] = time.Now()
		}
	}
	if req.BackgroundCheckPassed != nil {
		updates["background_check_passed"] = *req.BackgroundCheckPassed
		if *req.BackgroundCheckPassed {
			updates["background_check_completed_at"] = time.Now()
		}
	}
	if req.ReferencesVerified != nil {
		updates["references_verified"] = *req.ReferencesVerified
	}
	if req.BankAccountVerified != nil {
		updates["bank_account_verified"] = *req.BankAccountVerified
	}
	if req.EquipmentAssigned != nil {
		updates["equipment_assigned"] = *req.EquipmentAssigned
	}
	if req.TerritoryAssigned != nil {
		updates["territory_assigned"] = *req.TerritoryAssigned
	}
	if req.ReviewerNotes != nil {
		updates["reviewer_notes"] = *req.ReviewerNotes
	}
	if req.RejectionReason != nil {
		updates["rejection_reason"] = *req.RejectionReason
	}
	if req.SpecialInstructions != nil {
		updates["special_instructions"] = *req.SpecialInstructions
	}
	
	// Update the record
	if err := db.Model(&onboarding).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update onboarding record"})
		return
	}
	
	// Update progress after changes
	if err := updateOnboardingProgress(onboardingID); err != nil {
		log.Printf("Failed to update onboarding progress: %v", err)
	}
	
	// Retrieve updated record
	if err := db.First(&onboarding, onboardingID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated onboarding record"})
		return
	}
	
	c.JSON(http.StatusOK, onboarding)
}

func listOnboardings(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	agentTier := c.Query("agent_tier")
	agentID := c.Query("agent_id")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&AgentOnboarding{})
	
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if agentTier != "" {
		query = query.Where("agent_tier = ?", agentTier)
	}
	if agentID != "" {
		if agentUUID, err := uuid.Parse(agentID); err == nil {
			query = query.Where("agent_id = ?", agentUUID)
		}
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count onboarding records"})
		return
	}
	
	// Get records
	var onboardings []AgentOnboarding
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&onboardings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve onboarding records"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  onboardings,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// =====================================================
// KYC VERIFICATION HANDLERS
// =====================================================

func createKYCVerification(c *gin.Context) {
	var req CreateKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Check if KYC verification already exists for this agent
	var existingKYC KYCVerification
	if err := db.Where("agent_id = ?", req.AgentID).First(&existingKYC).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "KYC verification already exists for this agent"})
		return
	}
	
	// Set default verification level if not provided
	verificationLevel := req.VerificationLevel
	if verificationLevel == "" {
		verificationLevel = "basic"
	}
	
	// Create new KYC verification record
	kyc := KYCVerification{
		AgentID:            req.AgentID,
		AgentTier:          req.AgentTier,
		KYCReferenceNumber: generateKYCReferenceNumber(),
		Status:             KYCNotStarted,
		VerificationLevel:  verificationLevel,
		RiskLevel:          "medium",
		OverallScore:       0.0,
		IdentityScore:      0.0,
		AddressScore:       0.0,
		FinancialScore:     0.0,
		RiskScore:          50.0,
		InitiatedAt:        time.Now(),
		CreatedBy:          &req.CreatedBy,
	}
	
	if err := db.Create(&kyc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create KYC verification record"})
		return
	}
	
	c.JSON(http.StatusCreated, kyc)
}

func getKYCVerification(c *gin.Context) {
	id := c.Param("id")
	kycID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid KYC verification ID"})
		return
	}
	
	var kyc KYCVerification
	if err := db.First(&kyc, kycID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "KYC verification record not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve KYC verification record"})
		return
	}
	
	c.JSON(http.StatusOK, kyc)
}

func updateKYCVerification(c *gin.Context) {
	id := c.Param("id")
	kycID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid KYC verification ID"})
		return
	}
	
	var req UpdateKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Get existing KYC verification record
	var kyc KYCVerification
	if err := db.First(&kyc, kycID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "KYC verification record not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve KYC verification record"})
		return
	}
	
	// Prepare updates
	updates := map[string]interface{}{
		"updated_by": req.UpdatedBy,
		"updated_at": time.Now(),
	}
	
	if req.Status != nil {
		updates["status"] = *req.Status
		if *req.Status == KYCUnderReview && kyc.ReviewStartedAt == nil {
			updates["review_started_at"] = time.Now()
		}
		if *req.Status == KYCVerified {
			updates["verification_completed_at"] = time.Now()
			updates["review_completed_at"] = time.Now()
		}
	}
	if req.VerificationLevel != nil {
		updates["verification_level"] = *req.VerificationLevel
	}
	if req.RiskLevel != nil {
		updates["risk_level"] = *req.RiskLevel
	}
	if req.IdentityVerified != nil {
		updates["identity_verified"] = *req.IdentityVerified
	}
	if req.AddressVerified != nil {
		updates["address_verified"] = *req.AddressVerified
	}
	if req.PhoneVerified != nil {
		updates["phone_verified"] = *req.PhoneVerified
	}
	if req.EmailVerified != nil {
		updates["email_verified"] = *req.EmailVerified
	}
	if req.BusinessRegistrationVerified != nil {
		updates["business_registration_verified"] = *req.BusinessRegistrationVerified
	}
	if req.TaxRegistrationVerified != nil {
		updates["tax_registration_verified"] = *req.TaxRegistrationVerified
	}
	if req.BusinessAddressVerified != nil {
		updates["business_address_verified"] = *req.BusinessAddressVerified
	}
	if req.BankAccountVerified != nil {
		updates["bank_account_verified"] = *req.BankAccountVerified
	}
	if req.FinancialStatementsVerified != nil {
		updates["financial_statements_verified"] = *req.FinancialStatementsVerified
	}
	if req.CreditCheckCompleted != nil {
		updates["credit_check_completed"] = *req.CreditCheckCompleted
	}
	if req.DocumentVerificationMethod != nil {
		updates["document_verification_method"] = *req.DocumentVerificationMethod
	}
	if req.BiometricVerificationCompleted != nil {
		updates["biometric_verification_completed"] = *req.BiometricVerificationCompleted
	}
	if req.ThirdPartyVerificationCompleted != nil {
		updates["third_party_verification_completed"] = *req.ThirdPartyVerificationCompleted
	}
	if req.OverallScore != nil {
		updates["overall_score"] = *req.OverallScore
	}
	if req.IdentityScore != nil {
		updates["identity_score"] = *req.IdentityScore
	}
	if req.AddressScore != nil {
		updates["address_score"] = *req.AddressScore
	}
	if req.FinancialScore != nil {
		updates["financial_score"] = *req.FinancialScore
	}
	if req.RiskScore != nil {
		updates["risk_score"] = *req.RiskScore
	}
	if req.AssignedReviewer != nil {
		updates["assigned_reviewer"] = *req.AssignedReviewer
	}
	if req.VerifiedBy != nil {
		updates["verified_by"] = *req.VerifiedBy
	}
	if req.ReviewerNotes != nil {
		updates["reviewer_notes"] = *req.ReviewerNotes
	}
	if req.RejectionReason != nil {
		updates["rejection_reason"] = *req.RejectionReason
	}
	if req.AdditionalRequirements != nil {
		updates["additional_requirements"] = *req.AdditionalRequirements
	}
	
	// Update the record
	if err := db.Model(&kyc).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update KYC verification record"})
		return
	}
	
	// Recalculate overall score if verification fields were updated
	if req.IdentityVerified != nil || req.AddressVerified != nil || req.PhoneVerified != nil ||
		req.EmailVerified != nil || req.BankAccountVerified != nil || req.FinancialStatementsVerified != nil ||
		req.BusinessRegistrationVerified != nil || req.TaxRegistrationVerified != nil {
		
		// Retrieve updated record to calculate score
		if err := db.First(&kyc, kycID).Error; err == nil {
			overallScore := calculateKYCOverallScore(&kyc)
			db.Model(&kyc).Update("overall_score", overallScore)
		}
	}
	
	// Retrieve updated record
	if err := db.First(&kyc, kycID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated KYC verification record"})
		return
	}
	
	c.JSON(http.StatusOK, kyc)
}

func listKYCVerifications(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	verificationLevel := c.Query("verification_level")
	riskLevel := c.Query("risk_level")
	agentID := c.Query("agent_id")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&KYCVerification{})
	
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if verificationLevel != "" {
		query = query.Where("verification_level = ?", verificationLevel)
	}
	if riskLevel != "" {
		query = query.Where("risk_level = ?", riskLevel)
	}
	if agentID != "" {
		if agentUUID, err := uuid.Parse(agentID); err == nil {
			query = query.Where("agent_id = ?", agentUUID)
		}
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count KYC verification records"})
		return
	}
	
	// Get records
	var kycVerifications []KYCVerification
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&kycVerifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve KYC verification records"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  kycVerifications,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// =====================================================
// DOCUMENT MANAGEMENT HANDLERS
// =====================================================

func uploadDocument(c *gin.Context) {
	// Parse form data
	agentIDStr := c.PostForm("agent_id")
	documentTypeStr := c.PostForm("document_type")
	documentName := c.PostForm("document_name")
	documentNumber := c.PostForm("document_number")
	issuingAuthority := c.PostForm("issuing_authority")
	uploadedByStr := c.PostForm("uploaded_by")
	
	// Validate required fields
	if agentIDStr == "" || documentTypeStr == "" || documentName == "" || uploadedByStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields"})
		return
	}
	
	// Parse UUIDs
	agentID, err := uuid.Parse(agentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}
	
	uploadedBy, err := uuid.Parse(uploadedByStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid uploaded_by ID"})
		return
	}
	
	// Validate document type
	documentType := DocumentType(documentTypeStr)
	validDocumentTypes := []DocumentType{
		DocumentNationalID, DocumentPassport, DocumentDriversLicense,
		DocumentBusinessLicense, DocumentTaxCertificate, DocumentBankStatement,
		DocumentUtilityBill, DocumentPhoto, DocumentEducationalCert,
		DocumentEmploymentLetter, DocumentReferenceLetter,
	}
	
	isValidType := false
	for _, validType := range validDocumentTypes {
		if documentType == validType {
			isValidType = true
			break
		}
	}
	
	if !isValidType {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document type"})
		return
	}
	
	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	
	// Validate file size (max 10MB)
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 10MB limit"})
		return
	}
	
	// Save file
	filePath, fileName, err := saveUploadedFile(file, agentID, documentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	
	// Calculate file hash
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file for hashing"})
		return
	}
	defer src.Close()
	
	fileHash, err := calculateFileHash(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate file hash"})
		return
	}
	
	// Parse optional dates
	var issueDate, expiryDate *time.Time
	if issueDateStr := c.PostForm("issue_date"); issueDateStr != "" {
		if parsed, err := time.Parse("2006-01-02", issueDateStr); err == nil {
			issueDate = &parsed
		}
	}
	if expiryDateStr := c.PostForm("expiry_date"); expiryDateStr != "" {
		if parsed, err := time.Parse("2006-01-02", expiryDateStr); err == nil {
			expiryDate = &parsed
		}
	}
	
	// Create document record
	document := AgentDocument{
		AgentID:           agentID,
		DocumentType:      documentType,
		DocumentName:      documentName,
		DocumentNumber:    documentNumber,
		IssuingAuthority:  issuingAuthority,
		IssueDate:         issueDate,
		ExpiryDate:        expiryDate,
		FilePath:          filePath,
		FileName:          fileName,
		FileSizeBytes:     file.Size,
		FileType:          file.Header.Get("Content-Type"),
		FileHash:          fileHash,
		VerificationStatus: KYCNotStarted,
		UploadedAt:        time.Now(),
		UploadedBy:        &uploadedBy,
	}
	
	if err := db.Create(&document).Error; err != nil {
		// Clean up uploaded file if database insert fails
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create document record"})
		return
	}
	
	c.JSON(http.StatusCreated, document)
}

func getDocument(c *gin.Context) {
	id := c.Param("id")
	documentID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}
	
	var document AgentDocument
	if err := db.First(&document, documentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve document"})
		return
	}
	
	c.JSON(http.StatusOK, document)
}

func listDocuments(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	agentID := c.Query("agent_id")
	documentType := c.Query("document_type")
	verificationStatus := c.Query("verification_status")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&AgentDocument{})
	
	if agentID != "" {
		if agentUUID, err := uuid.Parse(agentID); err == nil {
			query = query.Where("agent_id = ?", agentUUID)
		}
	}
	if documentType != "" {
		query = query.Where("document_type = ?", documentType)
	}
	if verificationStatus != "" {
		query = query.Where("verification_status = ?", verificationStatus)
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count documents"})
		return
	}
	
	// Get records
	var documents []AgentDocument
	if err := query.Order("uploaded_at DESC").Offset(offset).Limit(limit).Find(&documents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve documents"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  documents,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// =====================================================
// TRAINING PROGRAM HANDLERS
// =====================================================

func createTrainingProgram(c *gin.Context) {
	var req CreateTrainingProgramRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Check if program code already exists
	var existingProgram TrainingProgram
	if err := db.Where("program_code = ?", req.ProgramCode).First(&existingProgram).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Program code already exists"})
		return
	}
	
	// Create new training program
	program := TrainingProgram{
		ProgramCode:                 req.ProgramCode,
		ProgramName:                 req.ProgramName,
		ProgramDescription:          req.ProgramDescription,
		TargetTier:                  req.TargetTier,
		TrainingType:                req.TrainingType,
		IsMandatory:                 req.IsMandatory,
		PrerequisitePrograms:        req.PrerequisitePrograms,
		EstimatedDurationHours:      req.EstimatedDurationHours,
		TotalModules:                req.TotalModules,
		PassingScore:                req.PassingScore,
		MaxAttempts:                 req.MaxAttempts,
		CertificationProvided:       req.CertificationProvided,
		CertificationValidityMonths: req.CertificationValidityMonths,
		ContinuingEducationRequired: req.ContinuingEducationRequired,
		IsActive:                    true,
		Version:                     "1.0",
		CreatedBy:                   &req.CreatedBy,
	}
	
	if err := db.Create(&program).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create training program"})
		return
	}
	
	c.JSON(http.StatusCreated, program)
}

func getTrainingProgram(c *gin.Context) {
	id := c.Param("id")
	programID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid program ID"})
		return
	}
	
	var program TrainingProgram
	if err := db.First(&program, programID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Training program not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve training program"})
		return
	}
	
	c.JSON(http.StatusOK, program)
}

func listTrainingPrograms(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	targetTier := c.Query("target_tier")
	trainingType := c.Query("training_type")
	isMandatory := c.Query("is_mandatory")
	isActive := c.Query("is_active")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&TrainingProgram{})
	
	if targetTier != "" {
		query = query.Where("target_tier = ?", targetTier)
	}
	if trainingType != "" {
		query = query.Where("training_type = ?", trainingType)
	}
	if isMandatory != "" {
		if mandatory, err := strconv.ParseBool(isMandatory); err == nil {
			query = query.Where("is_mandatory = ?", mandatory)
		}
	}
	if isActive != "" {
		if active, err := strconv.ParseBool(isActive); err == nil {
			query = query.Where("is_active = ?", active)
		}
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count training programs"})
		return
	}
	
	// Get records
	var programs []TrainingProgram
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&programs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve training programs"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  programs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func enrollAgent(c *gin.Context) {
	var req EnrollAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Check if agent is already enrolled in this program
	var existingEnrollment AgentTrainingEnrollment
	if err := db.Where("agent_id = ? AND program_id = ?", req.AgentID, req.ProgramID).First(&existingEnrollment).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Agent is already enrolled in this program"})
		return
	}
	
	// Verify that the training program exists
	var program TrainingProgram
	if err := db.First(&program, req.ProgramID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Training program not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify training program"})
		return
	}
	
	// Set default enrollment type if not provided
	enrollmentType := req.EnrollmentType
	if enrollmentType == "" {
		if program.IsMandatory {
			enrollmentType = "mandatory"
		} else {
			enrollmentType = "voluntary"
		}
	}
	
	// Create enrollment record
	enrollment := AgentTrainingEnrollment{
		AgentID:              req.AgentID,
		ProgramID:            req.ProgramID,
		EnrollmentDate:       time.Now(),
		EnrollmentType:       enrollmentType,
		AssignedBy:           &req.AssignedBy,
		Status:               TrainingEnrolled,
		ProgressPercentage:   0.0,
		TargetCompletionDate: req.TargetCompletionDate,
		AttemptsCount:        0,
		BestScore:            0.0,
		LatestScore:          0.0,
		TotalStudyHours:      0.0,
		CertificationEarned:  false,
	}
	
	if err := db.Create(&enrollment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create enrollment record"})
		return
	}
	
	// Load the program information for response
	if err := db.Preload("Program").First(&enrollment, enrollment.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load enrollment with program details"})
		return
	}
	
	c.JSON(http.StatusCreated, enrollment)
}

func getAgentTrainingEnrollments(c *gin.Context) {
	agentIDStr := c.Param("agentId")
	agentID, err := uuid.Parse(agentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}
	
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&AgentTrainingEnrollment{}).Where("agent_id = ?", agentID)
	
	if status != "" {
		query = query.Where("status = ?", status)
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count enrollments"})
		return
	}
	
	// Get records with program details
	var enrollments []AgentTrainingEnrollment
	if err := query.Preload("Program").Order("enrollment_date DESC").Offset(offset).Limit(limit).Find(&enrollments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve enrollments"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  enrollments,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// =====================================================
// PERFORMANCE EVALUATION HANDLERS
// =====================================================

func createPerformanceEvaluation(c *gin.Context) {
	var req CreatePerformanceEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Validate evaluation period
	if req.EvaluationPeriodEnd.Before(req.EvaluationPeriodStart) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Evaluation period end date must be after start date"})
		return
	}
	
	// Check for overlapping evaluations
	var existingEvaluation PerformanceEvaluation
	if err := db.Where("agent_id = ? AND evaluation_period_start <= ? AND evaluation_period_end >= ?",
		req.AgentID, req.EvaluationPeriodEnd, req.EvaluationPeriodStart).First(&existingEvaluation).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Overlapping evaluation period exists for this agent"})
		return
	}
	
	// Set default evaluation type if not provided
	evaluationType := req.EvaluationType
	if evaluationType == "" {
		evaluationType = "regular"
	}
	
	// Create performance evaluation record
	evaluation := PerformanceEvaluation{
		AgentID:               req.AgentID,
		EvaluationPeriodStart: req.EvaluationPeriodStart,
		EvaluationPeriodEnd:   req.EvaluationPeriodEnd,
		EvaluationType:        evaluationType,
		Status:                "draft",
		EvaluatorID:           &req.EvaluatorID,
		EvaluationDate:        time.Now(),
		CreatedBy:             &req.CreatedBy,
	}
	
	if err := db.Create(&evaluation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create performance evaluation"})
		return
	}
	
	c.JSON(http.StatusCreated, evaluation)
}

func getPerformanceEvaluation(c *gin.Context) {
	id := c.Param("id")
	evaluationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid evaluation ID"})
		return
	}
	
	var evaluation PerformanceEvaluation
	if err := db.First(&evaluation, evaluationID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Performance evaluation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve performance evaluation"})
		return
	}
	
	c.JSON(http.StatusOK, evaluation)
}

func updatePerformanceEvaluation(c *gin.Context) {
	id := c.Param("id")
	evaluationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid evaluation ID"})
		return
	}
	
	var req UpdatePerformanceEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Get existing evaluation record
	var evaluation PerformanceEvaluation
	if err := db.First(&evaluation, evaluationID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Performance evaluation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve performance evaluation"})
		return
	}
	
	// Prepare updates
	updates := map[string]interface{}{
		"updated_by": req.UpdatedBy,
		"updated_at": time.Now(),
	}
	
	if req.OverallScore != nil {
		updates["overall_score"] = *req.OverallScore
	}
	if req.OverallRating != nil {
		updates["overall_rating"] = *req.OverallRating
	}
	if req.TransactionVolumeScore != nil {
		updates["transaction_volume_score"] = *req.TransactionVolumeScore
	}
	if req.CustomerSatisfactionScore != nil {
		updates["customer_satisfaction_score"] = *req.CustomerSatisfactionScore
	}
	if req.ComplianceScore != nil {
		updates["compliance_score"] = *req.ComplianceScore
	}
	if req.TrainingScore != nil {
		updates["training_score"] = *req.TrainingScore
	}
	if req.NetworkGrowthScore != nil {
		updates["network_growth_score"] = *req.NetworkGrowthScore
	}
	if req.Status != nil {
		updates["status"] = *req.Status
		if *req.Status == "submitted" && evaluation.SubmittedAt == nil {
			updates["submitted_at"] = time.Now()
		}
		if *req.Status == "approved" {
			updates["approved_at"] = time.Now()
		}
		if *req.Status == "published" {
			updates["published_at"] = time.Now()
		}
	}
	if req.EvaluatorComments != nil {
		updates["evaluator_comments"] = *req.EvaluatorComments
	}
	if req.Strengths != nil {
		updates["strengths"] = *req.Strengths
	}
	if req.AreasForImprovement != nil {
		updates["areas_for_improvement"] = *req.AreasForImprovement
	}
	if req.DevelopmentRecommendations != nil {
		updates["development_recommendations"] = *req.DevelopmentRecommendations
	}
	if req.ActionPlan != nil {
		updates["action_plan"] = *req.ActionPlan
	}
	
	// Update the record
	if err := db.Model(&evaluation).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update performance evaluation"})
		return
	}
	
	// Retrieve updated record
	if err := db.First(&evaluation, evaluationID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated performance evaluation"})
		return
	}
	
	c.JSON(http.StatusOK, evaluation)
}

func listPerformanceEvaluations(c *gin.Context) {
	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	agentID := c.Query("agent_id")
	status := c.Query("status")
	evaluationType := c.Query("evaluation_type")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	
	offset := (page - 1) * limit
	
	// Build query
	query := db.Model(&PerformanceEvaluation{})
	
	if agentID != "" {
		if agentUUID, err := uuid.Parse(agentID); err == nil {
			query = query.Where("agent_id = ?", agentUUID)
		}
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if evaluationType != "" {
		query = query.Where("evaluation_type = ?", evaluationType)
	}
	
	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count performance evaluations"})
		return
	}
	
	// Get records
	var evaluations []PerformanceEvaluation
	if err := query.Order("evaluation_date DESC").Offset(offset).Limit(limit).Find(&evaluations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve performance evaluations"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  evaluations,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// =====================================================
// HEALTH CHECK HANDLER
// =====================================================

func healthCheck(c *gin.Context) {
	// Check database connection
	sqlDB, err := db.DB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   "Database connection failed",
			"service": "agent-management",
		})
		return
	}
	
	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   "Database ping failed",
			"service": "agent-management",
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "agent-management",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

// =====================================================
// MAIN FUNCTION AND ROUTES
// =====================================================

func main() {
	// Initialize database
	initDatabase()
	
	// Initialize Gin router
	router := gin.Default()
	
	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	router.Use(cors.New(config))
	
	// Health check endpoint
	router.GET("/health", healthCheck)
	
	// API routes
	api := router.Group("/api/v1")
	{
		// Onboarding routes
		onboarding := api.Group("/onboarding")
		{
			onboarding.POST("", createOnboarding)
			onboarding.GET("/:id", getOnboarding)
			onboarding.PUT("/:id", updateOnboarding)
			onboarding.GET("", listOnboardings)
		}
		
		// KYC verification routes
		kyc := api.Group("/kyc")
		{
			kyc.POST("", createKYCVerification)
			kyc.GET("/:id", getKYCVerification)
			kyc.PUT("/:id", updateKYCVerification)
			kyc.GET("", listKYCVerifications)
		}
		
		// Document management routes
		documents := api.Group("/documents")
		{
			documents.POST("/upload", uploadDocument)
			documents.GET("/:id", getDocument)
			documents.GET("", listDocuments)
		}
		
		// Training program routes
		training := api.Group("/training")
		{
			training.POST("/programs", createTrainingProgram)
			training.GET("/programs/:id", getTrainingProgram)
			training.GET("/programs", listTrainingPrograms)
			training.POST("/enrollments", enrollAgent)
			training.GET("/agents/:agentId/enrollments", getAgentTrainingEnrollments)
		}
		
		// Performance evaluation routes
		performance := api.Group("/performance")
		{
			performance.POST("/evaluations", createPerformanceEvaluation)
			performance.GET("/evaluations/:id", getPerformanceEvaluation)
			performance.PUT("/evaluations/:id", updatePerformanceEvaluation)
			performance.GET("/evaluations", listPerformanceEvaluations)
		}
	}
	
	// Start server
	port := getEnv("PORT", "8080")
	log.Printf("Agent Management and Training Service starting on port %s", port)
	
	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

