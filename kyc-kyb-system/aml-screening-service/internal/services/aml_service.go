package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"aml-screening-service/internal/models"

	"github.com/dapr/go-sdk/client"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AMLService struct {
	db               *gorm.DB
	sanctionsChecker *SanctionsChecker
	pepChecker       *PEPChecker
	daprClient       client.Client
}

func NewAMLService(db *gorm.DB) *AMLService {
	daprClient, err := client.NewClient()
	if err != nil {
		log.Printf("Failed to create Dapr client: %v", err)
	}

	return &AMLService{
		db:               db,
		sanctionsChecker: NewSanctionsChecker(),
		pepChecker:       NewPEPChecker(),
		daprClient:       daprClient,
	}
}

func (s *AMLService) ScreenCustomer(ctx context.Context, req models.ScreeningRequest) (*models.AMLScreening, error) {
	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	screening := &models.AMLScreening{
		ID:            uuid.New(),
		CustomerID:    customerID,
		ScreeningType: req.ScreeningType,
		FullName:      req.FullName,
		DateOfBirth:   req.DateOfBirth,
		Nationality:   req.Nationality,
		Status:        models.ScreeningStatusProcessing,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.db.Create(screening).Error; err != nil {
		return nil, fmt.Errorf("failed to create screening: %w", err)
	}

	var hits []models.Hit

	switch req.ScreeningType {
	case models.ScreeningTypeSanctions:
		hits, err = s.sanctionsChecker.CheckSanctions(ctx, req.FullName, req.DateOfBirth, req.Nationality)
	case models.ScreeningTypePEP:
		hits, err = s.pepChecker.CheckPEP(ctx, req.FullName, req.DateOfBirth, req.Nationality)
	case models.ScreeningTypeAdverseMedia:
		hits, err = s.checkAdverseMedia(ctx, req.FullName)
	case models.ScreeningTypeComprehensive:
		sanctionsHits, _ := s.sanctionsChecker.CheckSanctions(ctx, req.FullName, req.DateOfBirth, req.Nationality)
		pepHits, _ := s.pepChecker.CheckPEP(ctx, req.FullName, req.DateOfBirth, req.Nationality)
		mediaHits, _ := s.checkAdverseMedia(ctx, req.FullName)
		hits = append(hits, sanctionsHits...)
		hits = append(hits, pepHits...)
		hits = append(hits, mediaHits...)
	default:
		return nil, fmt.Errorf("invalid screening type: %s", req.ScreeningType)
	}

	if err != nil {
		screening.Status = models.ScreeningStatusFailed
		s.db.Save(screening)
		return nil, fmt.Errorf("screening failed: %w", err)
	}

	for i := range hits {
		hits[i].ScreeningID = screening.ID
		hits[i].CreatedAt = time.Now()
	}

	if len(hits) > 0 {
		if err := s.db.Create(&hits).Error; err != nil {
			log.Printf("Failed to save hits: %v", err)
		}
		screening.Hits = hits
		screening.Status = models.ScreeningStatusHit
		screening.RiskLevel = s.calculateRiskLevel(hits)
		screening.MatchScore = s.calculateMaxMatchScore(hits)
	} else {
		screening.Status = models.ScreeningStatusClear
		screening.RiskLevel = models.RiskLevelLow
		screening.MatchScore = 0.0
	}

	screening.UpdatedAt = time.Now()
	if err := s.db.Save(screening).Error; err != nil {
		return nil, fmt.Errorf("failed to update screening: %w", err)
	}

	go s.publishEvent(screening)

	return screening, nil
}

func (s *AMLService) checkAdverseMedia(ctx context.Context, fullName string) ([]models.Hit, error) {
	var hits []models.Hit

	keywords := []string{
		"fraud", "corruption", "money laundering", "terrorism",
		"bribery", "embezzlement", "sanctions violation",
	}

	for _, keyword := range keywords {
		score := s.fuzzyMatch(fullName, keyword)
		if score > 0.6 {
			hit := models.Hit{
				ID:          uuid.New(),
				ListName:    "Adverse Media",
				MatchedName: fullName,
				MatchScore:  score,
				Category:    "Adverse Media",
				Description: fmt.Sprintf("Potential adverse media match for keyword: %s", keyword),
				Source:      "Media Monitoring",
				RiskLevel:   models.RiskLevelMedium,
				Details: map[string]interface{}{
					"keyword": keyword,
					"type":    "adverse_media",
				},
			}
			hits = append(hits, hit)
		}
	}

	return hits, nil
}

func (s *AMLService) calculateRiskLevel(hits []models.Hit) models.RiskLevel {
	if len(hits) == 0 {
		return models.RiskLevelLow
	}

	criticalCount := 0
	highCount := 0
	mediumCount := 0

	for _, hit := range hits {
		switch hit.RiskLevel {
		case models.RiskLevelCritical:
			criticalCount++
		case models.RiskLevelHigh:
			highCount++
		case models.RiskLevelMedium:
			mediumCount++
		}
	}

	if criticalCount > 0 {
		return models.RiskLevelCritical
	}
	if highCount > 0 {
		return models.RiskLevelHigh
	}
	if mediumCount > 0 {
		return models.RiskLevelMedium
	}

	return models.RiskLevelLow
}

func (s *AMLService) calculateMaxMatchScore(hits []models.Hit) float64 {
	maxScore := 0.0
	for _, hit := range hits {
		if hit.MatchScore > maxScore {
			maxScore = hit.MatchScore
		}
	}
	return maxScore
}

func (s *AMLService) fuzzyMatch(str1, str2 string) float64 {
	if str1 == str2 {
		return 1.0
	}

	len1 := len(str1)
	len2 := len(str2)

	if len1 == 0 || len2 == 0 {
		return 0.0
	}

	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
		matrix[i][0] = i
	}
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
			cost := 0
			if str1[i-1] != str2[j-1] {
				cost = 1
			}

			matrix[i][j] = min(
				matrix[i-1][j]+1,
				min(matrix[i][j-1]+1, matrix[i-1][j-1]+cost),
			)
		}
	}

	distance := matrix[len1][len2]
	maxLen := max(len1, len2)
	similarity := 1.0 - float64(distance)/float64(maxLen)

	return similarity
}

func (s *AMLService) publishEvent(screening *models.AMLScreening) {
	if s.daprClient == nil {
		return
	}

	eventData := map[string]interface{}{
		"screening_id":   screening.ID.String(),
		"customer_id":    screening.CustomerID.String(),
		"screening_type": screening.ScreeningType,
		"status":         screening.Status,
		"risk_level":     screening.RiskLevel,
		"hit_count":      len(screening.Hits),
		"timestamp":      time.Now().Format(time.RFC3339),
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		log.Printf("Failed to marshal event data: %v", err)
		return
	}

	if err := s.daprClient.PublishEvent(context.Background(), "kafka-pubsub", "kyc.aml.screened", data); err != nil {
		log.Printf("Failed to publish event: %v", err)
	}
}

func (s *AMLService) GetScreening(id string) (*models.AMLScreening, error) {
	screeningID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid screening ID: %w", err)
	}

	var screening models.AMLScreening
	if err := s.db.Preload("Hits").First(&screening, "id = ?", screeningID).Error; err != nil {
		return nil, err
	}

	return &screening, nil
}

func (s *AMLService) GetCustomerScreenings(customerID string) ([]models.AMLScreening, error) {
	custID, err := uuid.Parse(customerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	var screenings []models.AMLScreening
	if err := s.db.Preload("Hits").Where("customer_id = ?", custID).Find(&screenings).Error; err != nil {
		return nil, err
	}

	return screenings, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
