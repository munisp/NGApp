package service

import (
	"context"
	"fmt"
	"ndpr-compliance/internal/models"
	"ndpr-compliance/internal/repository"
	"time"
)

type NDPRService struct{ repo *repository.NDPRRepository }
func NewNDPRService(repo *repository.NDPRRepository) *NDPRService { return &NDPRService{repo: repo} }

func (s *NDPRService) RegisterController(ctx context.Context, req RegisterControllerRequest) (*models.NDPRDataController, error) {
	c := &models.NDPRDataController{
		ControllerRef: req.ControllerRef, OrganizationName: req.OrganizationName,
		RegistrationNo: req.RegistrationNo, DPOName: req.DPOName, DPOEmail: req.DPOEmail,
		DPOPhone: req.DPOPhone, Address: req.Address, State: req.State,
		NITDARegNo: req.NITDARegNo, Status: "active",
	}
	if err := s.repo.CreateController(ctx, c); err != nil { return nil, fmt.Errorf("failed to register controller: %w", err) }
	return c, nil
}

func (s *NDPRService) RecordConsent(ctx context.Context, req NDPRConsentInput) (*models.NDPRConsentRecord, error) {
	now := time.Now()
	cr := &models.NDPRConsentRecord{
		SubjectID: req.SubjectID, SubjectName: req.SubjectName, Purpose: req.Purpose,
		LawfulBasis: req.LawfulBasis, DataClasses: req.DataClasses, Granted: req.Granted, Channel: req.Channel,
	}
	if req.Granted { cr.GrantedAt = &now } else { cr.RevokedAt = &now }
	if req.ExpiryDays > 0 { exp := now.AddDate(0, 0, req.ExpiryDays); cr.ExpiresAt = &exp }
	if err := s.repo.CreateConsent(ctx, cr); err != nil { return nil, fmt.Errorf("failed to record consent: %w", err) }
	action := "consent_revoked"
	if req.Granted { action = "consent_granted" }
	s.repo.CreateAuditLog(ctx, &models.NDPRAuditLog{Action: action, DataClass: req.DataClasses, SubjectID: req.SubjectID, PerformedBy: "system", Purpose: req.Purpose, LawfulBasis: req.LawfulBasis})
	return cr, nil
}

func (s *NDPRService) SubmitRequest(ctx context.Context, req NDPRRequestInput) (*models.NDPRDataRequest, error) {
	dr := &models.NDPRDataRequest{
		RequestRef: fmt.Sprintf("NDPR-%d", time.Now().UnixNano()%1000000),
		SubjectID: req.SubjectID, SubjectName: req.SubjectName, RequestType: req.RequestType,
		Description: req.Description, Status: "pending", DueDate: time.Now().AddDate(0, 0, 30),
	}
	if err := s.repo.CreateRequest(ctx, dr); err != nil { return nil, fmt.Errorf("failed to submit request: %w", err) }
	return dr, nil
}

func (s *NDPRService) ProcessRequest(ctx context.Context, ref string, response map[string]interface{}) error {
	dr, err := s.repo.GetRequest(ctx, ref)
	if err != nil { return fmt.Errorf("request not found") }
	now := time.Now(); dr.Status = "completed"; dr.CompletedAt = &now; dr.Response = response
	return s.repo.UpdateRequest(ctx, dr)
}

func (s *NDPRService) LogDataProcessing(ctx context.Context, req NDPRAuditInput) error {
	al := &models.NDPRAuditLog{
		Action: req.Action, DataClass: req.DataClass, SubjectID: req.SubjectID,
		PerformedBy: req.PerformedBy, Purpose: req.Purpose, LawfulBasis: req.LawfulBasis, Details: req.Details,
	}
	return s.repo.CreateAuditLog(ctx, al)
}

func (s *NDPRService) ReportBreach(ctx context.Context, req NDPRBreachInput) (*models.NDPRBreachNotification, error) {
	b := &models.NDPRBreachNotification{
		BreachRef: fmt.Sprintf("NBRH-%d", time.Now().UnixNano()%1000000),
		Description: req.Description, DataAffected: req.DataAffected, SubjectsCount: req.SubjectsCount,
		Severity: req.Severity, DetectedAt: req.DetectedAt, RemediationSteps: req.RemediationSteps, Status: "detected",
	}
	if err := s.repo.CreateBreach(ctx, b); err != nil { return nil, fmt.Errorf("failed to report breach: %w", err) }
	return b, nil
}

func (s *NDPRService) NotifyNITDA(ctx context.Context, breachRef string) error {
	breaches, _ := s.repo.ListBreaches(ctx)
	for _, b := range breaches {
		if b.BreachRef == breachRef { now := time.Now(); b.NITDANotifiedAt = &now; b.Status = "nitda_notified"; return s.repo.UpdateBreach(ctx, &b) }
	}
	return fmt.Errorf("breach not found")
}

func (s *NDPRService) CreateAssessment(ctx context.Context, req NDPRAssessmentInput) (*models.NDPRComplianceAssessment, error) {
	a := &models.NDPRComplianceAssessment{AssessmentType: req.AssessmentType, Scope: req.Scope, Assessor: req.Assessor, Status: "in_progress"}
	if err := s.repo.CreateAssessment(ctx, a); err != nil { return nil, fmt.Errorf("failed to create assessment: %w", err) }
	return a, nil
}

func (s *NDPRService) GetConsents(ctx context.Context, subjectID string) ([]models.NDPRConsentRecord, error) { return s.repo.GetConsents(ctx, subjectID) }
func (s *NDPRService) GetRequests(ctx context.Context, status string) ([]models.NDPRDataRequest, error) { return s.repo.ListRequests(ctx, status) }
func (s *NDPRService) GetAuditLogs(ctx context.Context, subjectID string) ([]models.NDPRAuditLog, error) { return s.repo.GetAuditLogs(ctx, subjectID, 100) }
func (s *NDPRService) GetBreaches(ctx context.Context) ([]models.NDPRBreachNotification, error) { return s.repo.ListBreaches(ctx) }
func (s *NDPRService) GetAssessments(ctx context.Context) ([]models.NDPRComplianceAssessment, error) { return s.repo.ListAssessments(ctx) }
