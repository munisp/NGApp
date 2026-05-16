package service

import (
	"context"
	"customer-feedback-loop/internal/middleware"
	"customer-feedback-loop/internal/models"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedFeedbackService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedFeedbackService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedFeedbackService {
	return &EnhancedFeedbackService{db: db, middleware: mw}
}

func (s *EnhancedFeedbackService) SubmitNPSSurvey(ctx context.Context, survey *models.NPSSurvey) error {
	survey.ID = uuid.New()
	survey.SurveyDate = time.Now()

	if s.middleware != nil && s.middleware.Sentiment != nil {
		result, _ := s.middleware.Sentiment.AnalyzeSentiment(ctx, survey.Comment)
		if result != nil {
			survey.SentimentScore = result.Score
			survey.SentimentLabel = result.Label
		}
	}

	if err := s.db.WithContext(ctx).Create(survey).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.FeedbackEvent{
			ID:           uuid.New(),
			EventType:    "NPS_SURVEY_SUBMITTED",
			CustomerID:   survey.CustomerID,
			FeedbackType: "NPS",
			Rating:       survey.Score,
			Sentiment:    survey.SentimentLabel,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishFeedbackEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.IncrementFeedbackCounter(context.Background(), "nps")
		go s.middleware.Redis.IncrementSentimentCounter(context.Background(), survey.SentimentLabel)
	}

	if s.middleware != nil && s.middleware.Lakehouse != nil {
		go s.middleware.Lakehouse.StoreFeedbackAnalytics(context.Background(), map[string]interface{}{
			"type":      "nps",
			"score":     survey.Score,
			"sentiment": survey.SentimentLabel,
			"timestamp": time.Now(),
		})
	}

	return nil
}

func (s *EnhancedFeedbackService) SubmitSatisfactionSurvey(ctx context.Context, survey *models.SatisfactionSurvey) error {
	survey.ID = uuid.New()
	survey.SurveyDate = time.Now()

	if s.middleware != nil && s.middleware.Sentiment != nil && survey.Comment != "" {
		result, _ := s.middleware.Sentiment.AnalyzeSentiment(ctx, survey.Comment)
		if result != nil {
			survey.SentimentScore = result.Score
			survey.SentimentLabel = result.Label
		}
	}

	if err := s.db.WithContext(ctx).Create(survey).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.FeedbackEvent{
			ID:           uuid.New(),
			EventType:    "SATISFACTION_SURVEY_SUBMITTED",
			CustomerID:   survey.CustomerID,
			FeedbackType: "SATISFACTION",
			Rating:       survey.Rating,
			Sentiment:    survey.SentimentLabel,
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishFeedbackEvent(context.Background(), event)
	}

	return nil
}

func (s *EnhancedFeedbackService) CreateComplaint(ctx context.Context, complaint *models.Complaint) error {
	complaint.ID = uuid.New()
	complaint.ComplaintNumber = fmt.Sprintf("CMP-%d", time.Now().UnixNano())
	complaint.Status = "OPEN"
	complaint.CreatedAt = time.Now()

	slaHours := 24
	switch complaint.Priority {
	case "CRITICAL":
		slaHours = 4
	case "HIGH":
		slaHours = 8
	case "MEDIUM":
		slaHours = 24
	case "LOW":
		slaHours = 72
	}
	deadline := time.Now().Add(time.Duration(slaHours) * time.Hour)
	complaint.SLADeadline = deadline

	if s.middleware != nil && s.middleware.Sentiment != nil {
		result, _ := s.middleware.Sentiment.AnalyzeSentiment(ctx, complaint.Description)
		if result != nil {
			complaint.SentimentScore = result.Score
			complaint.SentimentLabel = result.Label
		}
	}

	if err := s.db.WithContext(ctx).Create(complaint).Error; err != nil {
		return err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.FeedbackEvent{
			ID:           uuid.New(),
			EventType:    "COMPLAINT_CREATED",
			CustomerID:   complaint.CustomerID,
			FeedbackType: "COMPLAINT",
			Sentiment:    complaint.SentimentLabel,
			Timestamp:    time.Now(),
			Metadata: map[string]interface{}{
				"priority":     complaint.Priority,
				"sla_deadline": deadline,
			},
		}
		go s.middleware.Kafka.PublishFeedbackEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.CacheComplaintSLA(context.Background(), complaint.ID, deadline)
		go s.middleware.Redis.IncrementFeedbackCounter(context.Background(), "complaint")
	}

	return nil
}

func (s *EnhancedFeedbackService) GetComplaint(ctx context.Context, complaintID uuid.UUID) (*models.Complaint, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedFeedback(ctx, complaintID); err == nil {
			var complaint models.Complaint
			if json.Unmarshal(cached, &complaint) == nil {
				return &complaint, nil
			}
		}
	}

	var complaint models.Complaint
	if err := s.db.WithContext(ctx).First(&complaint, "id = ?", complaintID).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		data, _ := json.Marshal(complaint)
		go s.middleware.Redis.CacheFeedback(context.Background(), complaintID, data, 1*time.Hour)
	}

	return &complaint, nil
}

func (s *EnhancedFeedbackService) UpdateComplaintStatus(ctx context.Context, complaintID uuid.UUID, status, resolution string) error {
	updates := map[string]interface{}{"status": status}
	if status == "RESOLVED" {
		now := time.Now()
		updates["resolution"] = resolution
		updates["resolved_at"] = now
	}

	result := s.db.WithContext(ctx).Model(&models.Complaint{}).Where("id = ?", complaintID).Updates(updates)

	if s.middleware != nil && s.middleware.Kafka != nil {
		var complaint models.Complaint
		s.db.First(&complaint, "id = ?", complaintID)
		event := &middleware.FeedbackEvent{
			ID:           uuid.New(),
			EventType:    fmt.Sprintf("COMPLAINT_%s", status),
			CustomerID:   complaint.CustomerID,
			FeedbackType: "COMPLAINT",
			Timestamp:    time.Now(),
		}
		go s.middleware.Kafka.PublishFeedbackEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedFeedbackService) EscalateComplaint(ctx context.Context, complaintID uuid.UUID) error {
	result := s.db.WithContext(ctx).Model(&models.Complaint{}).
		Where("id = ?", complaintID).
		UpdateColumn("escalation_level", gorm.Expr("escalation_level + 1"))

	if s.middleware != nil && s.middleware.Kafka != nil {
		var complaint models.Complaint
		s.db.First(&complaint, "id = ?", complaintID)
		event := &middleware.FeedbackEvent{
			ID:           uuid.New(),
			EventType:    "COMPLAINT_ESCALATED",
			CustomerID:   complaint.CustomerID,
			FeedbackType: "COMPLAINT",
			Timestamp:    time.Now(),
			Metadata: map[string]interface{}{
				"escalation_level": complaint.EscalationLevel + 1,
			},
		}
		go s.middleware.Kafka.PublishFeedbackEvent(context.Background(), event)
	}

	return result.Error
}

func (s *EnhancedFeedbackService) CalculateNPS(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if cached, err := s.middleware.Redis.GetCachedNPSScore(ctx); err == nil {
			return cached, nil
		}
	}

	var promoters, detractors, total int64
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ?", startDate, endDate).Count(&total)
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ? AND score >= 9", startDate, endDate).Count(&promoters)
	s.db.Model(&models.NPSSurvey{}).Where("survey_date BETWEEN ? AND ? AND score <= 6", startDate, endDate).Count(&detractors)

	if total == 0 {
		return 0, nil
	}

	nps := (float64(promoters) - float64(detractors)) / float64(total) * 100

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.CacheNPSScore(context.Background(), nps, 15*time.Minute)
	}

	return nps, nil
}

func (s *EnhancedFeedbackService) GetSentimentDistribution(ctx context.Context) (map[string]int64, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		return s.middleware.Redis.GetSentimentDistribution(ctx)
	}

	distribution := make(map[string]int64)
	for _, sentiment := range []string{"positive", "neutral", "negative"} {
		var count int64
		s.db.Model(&models.NPSSurvey{}).Where("sentiment_label = ?", sentiment).Count(&count)
		distribution[sentiment] = count
	}
	return distribution, nil
}

func (s *EnhancedFeedbackService) GetFeedbackStats(ctx context.Context) (map[string]interface{}, error) {
	var totalSurveys, totalComplaints, openComplaints, resolvedComplaints int64
	var avgNPS float64

	s.db.Model(&models.NPSSurvey{}).Count(&totalSurveys)
	s.db.Model(&models.Complaint{}).Count(&totalComplaints)
	s.db.Model(&models.Complaint{}).Where("status = ?", "OPEN").Count(&openComplaints)
	s.db.Model(&models.Complaint{}).Where("status = ?", "RESOLVED").Count(&resolvedComplaints)
	s.db.Model(&models.NPSSurvey{}).Select("COALESCE(AVG(score), 0)").Scan(&avgNPS)

	sentimentDist, _ := s.GetSentimentDistribution(ctx)

	return map[string]interface{}{
		"total_surveys":          totalSurveys,
		"total_complaints":       totalComplaints,
		"open_complaints":        openComplaints,
		"resolved_complaints":    resolvedComplaints,
		"avg_nps_score":          avgNPS,
		"resolution_rate":        float64(resolvedComplaints) / float64(totalComplaints) * 100,
		"sentiment_distribution": sentimentDist,
	}, nil
}

func (s *EnhancedFeedbackService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}
