package service

import (
	"context"
	"customer-feedback-loop/internal/models"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FeedbackService struct {
	db *gorm.DB
}

func NewFeedbackService(db *gorm.DB) *FeedbackService {
	return &FeedbackService{db: db}
}

func (s *FeedbackService) SubmitNPSSurvey(ctx context.Context, survey *models.NPSSurvey) error {
	survey.ID = uuid.New()
	return s.db.WithContext(ctx).Create(survey).Error
}

func (s *FeedbackService) SubmitSatisfactionSurvey(ctx context.Context, survey *models.SatisfactionSurvey) error {
	survey.ID = uuid.New()
	return s.db.WithContext(ctx).Create(survey).Error
}

func (s *FeedbackService) CreateComplaint(ctx context.Context, complaint *models.Complaint) error {
	complaint.ID = uuid.New()
	complaint.ComplaintNumber = fmt.Sprintf("CMP-%d", time.Now().UnixNano())
	complaint.Status = models.FeedbackStatusOpen

	slaHours := 24
	switch complaint.Priority {
	case models.ComplaintPriorityCritical:
		slaHours = 4
	case models.ComplaintPriorityHigh:
		slaHours = 8
	case models.ComplaintPriorityMedium:
		slaHours = 24
	case models.ComplaintPriorityLow:
		slaHours = 72
	}
	deadline := time.Now().Add(time.Duration(slaHours) * time.Hour)
	complaint.SLADeadline = &deadline

	return s.db.WithContext(ctx).Create(complaint).Error
}

func (s *FeedbackService) GetComplaint(ctx context.Context, complaintID uuid.UUID) (*models.Complaint, error) {
	var complaint models.Complaint
	err := s.db.WithContext(ctx).First(&complaint, "id = ?", complaintID).Error
	return &complaint, err
}

func (s *FeedbackService) UpdateComplaintStatus(ctx context.Context, complaintID uuid.UUID, status models.FeedbackStatus, resolution string) error {
	updates := map[string]interface{}{"status": status}
	if status == models.FeedbackStatusResolved {
		now := time.Now()
		updates["resolution"] = resolution
		updates["resolution_date"] = now
	}
	return s.db.WithContext(ctx).Model(&models.Complaint{}).Where("id = ?", complaintID).Updates(updates).Error
}

func (s *FeedbackService) AddComplaintNote(ctx context.Context, note *models.ComplaintNote) error {
	note.ID = uuid.New()
	return s.db.WithContext(ctx).Create(note).Error
}

func (s *FeedbackService) GetComplaintNotes(ctx context.Context, complaintID uuid.UUID) ([]models.ComplaintNote, error) {
	var notes []models.ComplaintNote
	err := s.db.WithContext(ctx).Where("complaint_id = ?", complaintID).Order("created_at DESC").Find(&notes).Error
	return notes, err
}

func (s *FeedbackService) EscalateComplaint(ctx context.Context, complaintID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&models.Complaint{}).Where("id = ?", complaintID).UpdateColumn("escalation_level", gorm.Expr("escalation_level + 1")).Error
}

func (s *FeedbackService) GetCustomerComplaints(ctx context.Context, customerID uuid.UUID) ([]models.Complaint, error) {
	var complaints []models.Complaint
	err := s.db.WithContext(ctx).Where("customer_id = ?", customerID).Order("created_at DESC").Find(&complaints).Error
	return complaints, err
}

func (s *FeedbackService) CalculateNPS(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	var promoters, detractors, total int64
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ?", startDate, endDate).Count(&total)
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ? AND score >= 9", startDate, endDate).Count(&promoters)
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ? AND score <= 6", startDate, endDate).Count(&detractors)

	if total == 0 {
		return 0, nil
	}
	return (float64(promoters) - float64(detractors)) / float64(total) * 100, nil
}

func (s *FeedbackService) GetFeedbackStats(ctx context.Context) (map[string]interface{}, error) {
	var totalSurveys, totalComplaints, openComplaints, resolvedComplaints int64
	var avgNPS float64

	s.db.Model(&models.NPSSurvey{}).Count(&totalSurveys)
	s.db.Model(&models.Complaint{}).Count(&totalComplaints)
	s.db.Model(&models.Complaint{}).Where("status = ?", models.FeedbackStatusOpen).Count(&openComplaints)
	s.db.Model(&models.Complaint{}).Where("status = ?", models.FeedbackStatusResolved).Count(&resolvedComplaints)
	s.db.Model(&models.NPSSurvey{}).Select("COALESCE(AVG(score), 0)").Scan(&avgNPS)

	return map[string]interface{}{
		"total_surveys":       totalSurveys,
		"total_complaints":    totalComplaints,
		"open_complaints":     openComplaints,
		"resolved_complaints": resolvedComplaints,
		"avg_nps_score":       avgNPS,
		"resolution_rate":     float64(resolvedComplaints) / float64(totalComplaints) * 100,
	}, nil
}
