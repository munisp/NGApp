package service

import (
	"context"
	"enhanced-kyc-kyb/internal/models"
	"enhanced-kyc-kyb/internal/repository"
	"fmt"
	"math"
	"strings"
	"time"
)

type KYCService struct{ repo *repository.KYCRepository }
func NewKYCService(repo *repository.KYCRepository) *KYCService { return &KYCService{repo: repo} }

func (s *KYCService) SubmitKYC(ctx context.Context, req KYCSubmitRequest) (*models.KYCApplication, error) {
	app := &models.KYCApplication{
		ApplicationRef: fmt.Sprintf("KYC-%d", time.Now().UnixNano()%1000000),
		ApplicantType: "individual", FirstName: req.FirstName, LastName: req.LastName,
		Email: req.Email, Phone: req.Phone, BVN: req.BVN, NIN: req.NIN,
		DateOfBirth: req.DateOfBirth, Address: req.Address, State: req.State, LGA: req.LGA,
		Status: "pending", RiskLevel: "low",
	}
	if err := s.repo.CreateKYC(ctx, app); err != nil {
		return nil, fmt.Errorf("failed to submit KYC: %w", err)
	}
	go s.runKYCChecks(ctx, app)
	return app, nil
}

func (s *KYCService) runKYCChecks(ctx context.Context, app *models.KYCApplication) {
	score := 100.0
	checks := []string{"bvn", "nin", "watchlist", "pep", "sanctions"}
	for _, checkType := range checks {
		result := s.performCheck(ctx, app.ApplicationRef, checkType, app.FirstName+" "+app.LastName)
		if result.Status == "failed" { score -= 25 }
		if result.Status == "error" { score -= 10 }
	}
	app.OverallScore = math.Max(score, 0)
	app.RiskLevel = s.calculateRiskLevel(app.OverallScore)
	if app.OverallScore >= 70 { app.Status = "in_review" } else { app.Status = "escalated" }
	s.repo.UpdateKYC(ctx, app)
}

func (s *KYCService) performCheck(ctx context.Context, appRef, checkType, name string) *models.VerificationCheck {
	check := &models.VerificationCheck{
		ApplicationRef: appRef, CheckType: checkType, Provider: "internal",
		Status: "passed", Score: 100,
	}
	if checkType == "watchlist" || checkType == "pep" || checkType == "sanctions" {
		matches, _ := s.repo.SearchWatchlist(ctx, name)
		if len(matches) > 0 {
			check.Status = "failed"; check.Score = 0
			check.RawResponse = map[string]interface{}{"matches": len(matches)}
		}
	}
	now := time.Now(); check.VerifiedAt = &now
	s.repo.CreateVerification(ctx, check)
	return check
}

func (s *KYCService) calculateRiskLevel(score float64) string {
	if score >= 80 { return "low" }
	if score >= 60 { return "medium" }
	if score >= 40 { return "high" }
	return "critical"
}

func (s *KYCService) SubmitKYB(ctx context.Context, req KYBSubmitRequest) (*models.KYBApplication, error) {
	app := &models.KYBApplication{
		ApplicationRef: fmt.Sprintf("KYB-%d", time.Now().UnixNano()%1000000),
		BusinessName: req.BusinessName, RCNumber: req.RCNumber, TIN: req.TIN,
		BusinessType: req.BusinessType, IndustryCode: req.IndustryCode,
		IncorporationDate: req.IncorporationDate, RegisteredAddress: req.RegisteredAddress,
		State: req.State, DirectorCount: req.DirectorCount,
		AnnualTurnover: req.AnnualTurnover, EmployeeCount: req.EmployeeCount,
		Status: "pending", RiskLevel: "low",
	}
	if err := s.repo.CreateKYB(ctx, app); err != nil {
		return nil, fmt.Errorf("failed to submit KYB: %w", err)
	}
	go s.runKYBChecks(ctx, app)
	return app, nil
}

func (s *KYCService) runKYBChecks(ctx context.Context, app *models.KYBApplication) {
	score := 100.0
	if app.RCNumber != "" {
		check := &models.VerificationCheck{ApplicationRef: app.ApplicationRef, CheckType: "cac", Provider: "cac_api", Status: "passed", Score: 100}
		now := time.Now(); check.VerifiedAt = &now
		s.repo.CreateVerification(ctx, check)
		app.CACVerified = true
	} else { score -= 30 }
	if app.TIN != "" {
		check := &models.VerificationCheck{ApplicationRef: app.ApplicationRef, CheckType: "tin", Provider: "firs_api", Status: "passed", Score: 100}
		now := time.Now(); check.VerifiedAt = &now
		s.repo.CreateVerification(ctx, check)
		app.TINVerified = true
	} else { score -= 20 }
	matches, _ := s.repo.SearchWatchlist(ctx, app.BusinessName)
	if len(matches) > 0 { score -= 40 }
	highRiskIndustries := []string{"gambling", "crypto", "weapons", "tobacco"}
	for _, ind := range highRiskIndustries {
		if strings.Contains(strings.ToLower(app.IndustryCode), ind) { score -= 20; break }
	}
	app.OverallScore = math.Max(score, 0)
	app.RiskLevel = s.calculateRiskLevel(app.OverallScore)
	if app.OverallScore >= 70 { app.Status = "in_review" } else { app.Status = "escalated" }
	s.repo.UpdateKYB(ctx, app)
}

func (s *KYCService) ReviewKYC(ctx context.Context, ref string, req ReviewRequest) error {
	app, err := s.repo.GetKYC(ctx, ref)
	if err != nil { return fmt.Errorf("KYC application not found") }
	app.ReviewerID = req.ReviewerID; app.ReviewNotes = req.ReviewNotes; app.Status = req.Decision
	if req.Decision == "approved" || req.Decision == "rejected" {
		now := time.Now(); app.CompletedAt = &now
	}
	return s.repo.UpdateKYC(ctx, app)
}

func (s *KYCService) ReviewKYB(ctx context.Context, ref string, req ReviewRequest) error {
	app, err := s.repo.GetKYB(ctx, ref)
	if err != nil { return fmt.Errorf("KYB application not found") }
	app.Status = req.Decision
	if req.Decision == "approved" || req.Decision == "rejected" {
		now := time.Now(); app.CompletedAt = &now
	}
	return s.repo.UpdateKYB(ctx, app)
}

func (s *KYCService) UploadDocument(ctx context.Context, req DocumentUploadRequest) (*models.DocumentVerification, error) {
	doc := &models.DocumentVerification{
		ApplicationRef: req.ApplicationRef, DocumentType: req.DocumentType,
		DocumentNumber: req.DocumentNumber, IssuingAuthority: req.IssuingAuthority,
		ExpiryDate: req.ExpiryDate, Status: "uploaded", VerificationScore: 0,
	}
	if err := s.repo.CreateDocument(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}
	return doc, nil
}

func (s *KYCService) GetKYC(ctx context.Context, ref string) (*models.KYCApplication, error) { return s.repo.GetKYC(ctx, ref) }
func (s *KYCService) GetKYB(ctx context.Context, ref string) (*models.KYBApplication, error) { return s.repo.GetKYB(ctx, ref) }
func (s *KYCService) ListKYC(ctx context.Context, status string) ([]models.KYCApplication, error) { return s.repo.ListKYC(ctx, status) }
func (s *KYCService) ListKYB(ctx context.Context, status string) ([]models.KYBApplication, error) { return s.repo.ListKYB(ctx, status) }
func (s *KYCService) GetVerifications(ctx context.Context, ref string) ([]models.VerificationCheck, error) { return s.repo.GetVerifications(ctx, ref) }
func (s *KYCService) GetDocuments(ctx context.Context, ref string) ([]models.DocumentVerification, error) { return s.repo.GetDocuments(ctx, ref) }
