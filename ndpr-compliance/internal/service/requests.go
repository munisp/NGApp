package service

import "time"

type RegisterControllerRequest struct {
	ControllerRef    string `json:"controller_ref"`
	OrganizationName string `json:"organization_name"`
	RegistrationNo   string `json:"registration_no"`
	DPOName          string `json:"dpo_name"`
	DPOEmail         string `json:"dpo_email"`
	DPOPhone         string `json:"dpo_phone"`
	Address          string `json:"address"`
	State            string `json:"state"`
	NITDARegNo       string `json:"nitda_reg_no"`
}

type NDPRConsentInput struct {
	SubjectID   string `json:"subject_id"`
	SubjectName string `json:"subject_name"`
	Purpose     string `json:"purpose"`
	LawfulBasis string `json:"lawful_basis"`
	DataClasses string `json:"data_classes"`
	Granted     bool   `json:"granted"`
	Channel     string `json:"channel"`
	ExpiryDays  int    `json:"expiry_days"`
}

type NDPRRequestInput struct {
	SubjectID   string `json:"subject_id"`
	SubjectName string `json:"subject_name"`
	RequestType string `json:"request_type"`
	Description string `json:"description"`
}

type NDPRAuditInput struct {
	Action      string                 `json:"action"`
	DataClass   string                 `json:"data_class"`
	SubjectID   string                 `json:"subject_id"`
	PerformedBy string                 `json:"performed_by"`
	Purpose     string                 `json:"purpose"`
	LawfulBasis string                 `json:"lawful_basis"`
	Details     map[string]interface{} `json:"details"`
}

type NDPRBreachInput struct {
	Description      string    `json:"description"`
	DataAffected     string    `json:"data_affected"`
	SubjectsCount    int       `json:"subjects_count"`
	Severity         string    `json:"severity"`
	DetectedAt       time.Time `json:"detected_at"`
	RemediationSteps string    `json:"remediation_steps"`
}

type NDPRAssessmentInput struct {
	AssessmentType  string `json:"assessment_type"`
	Scope           string `json:"scope"`
	Assessor        string `json:"assessor"`
}
