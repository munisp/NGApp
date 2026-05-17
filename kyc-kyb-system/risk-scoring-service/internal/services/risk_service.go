package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"risk-scoring-service/internal/models"

	"github.com/dapr/go-sdk/client"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const MODEL_VERSION = "v1.0.0"
const SCORE_VALIDITY_DAYS = 90

type RiskScoringService struct {
	db         *gorm.DB
	daprClient client.Client
}

func NewRiskScoringService(db *gorm.DB) *RiskScoringService {
	daprClient, err := client.NewClient()
	if err != nil {
		log.Printf("Failed to create Dapr client: %v", err)
	}

	return &RiskScoringService{
		db:         db,
		daprClient: daprClient,
	}
}

func (s *RiskScoringService) CalculateRiskScore(ctx context.Context, req models.RiskScoreRequest) (*models.RiskScore, error) {
	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	riskScore := &models.RiskScore{
		ID:           uuid.New(),
		CustomerID:   customerID,
		ModelVersion: MODEL_VERSION,
		CalculatedAt: time.Now(),
		ExpiresAt:    time.Now().AddDate(0, 0, SCORE_VALIDITY_DAYS),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	identityScore, identityFactors := s.calculateIdentityScore(req)
	riskScore.IdentityScore = identityScore

	documentScore, documentFactors := s.calculateDocumentScore(req)
	riskScore.DocumentScore = documentScore

	amlScore, amlFactors := s.calculateAMLScore(req)
	riskScore.AMLScore = amlScore

	behaviorScore, behaviorFactors := s.calculateBehaviorScore(req)
	riskScore.BehaviorScore = behaviorScore

	geographicScore, geoFactors := s.calculateGeographicScore(req)
	riskScore.GeographicScore = geographicScore

	transactionScore, txFactors := s.calculateTransactionScore(req)
	riskScore.TransactionScore = transactionScore

	riskScore.OverallScore = s.calculateOverallScore(
		identityScore,
		documentScore,
		amlScore,
		behaviorScore,
		geographicScore,
		transactionScore,
	)

	riskScore.RiskLevel = s.determineRiskLevel(riskScore.OverallScore)
	riskScore.DDLevel = s.determineDDLevel(riskScore.RiskLevel, amlScore)

	var allFactors []models.RiskFactor
	allFactors = append(allFactors, identityFactors...)
	allFactors = append(allFactors, documentFactors...)
	allFactors = append(allFactors, amlFactors...)
	allFactors = append(allFactors, behaviorFactors...)
	allFactors = append(allFactors, geoFactors...)
	allFactors = append(allFactors, txFactors...)

	for i := range allFactors {
		allFactors[i].RiskScoreID = riskScore.ID
		allFactors[i].CreatedAt = time.Now()
	}

	riskScore.Recommendations = s.generateRecommendations(riskScore)

	if err := s.db.Create(riskScore).Error; err != nil {
		return nil, fmt.Errorf("failed to create risk score: %w", err)
	}

	if len(allFactors) > 0 {
		if err := s.db.Create(&allFactors).Error; err != nil {
			log.Printf("Failed to save risk factors: %v", err)
		}
		riskScore.RiskFactors = allFactors
	}

	go s.publishEvent(riskScore)

	return riskScore, nil
}

func (s *RiskScoringService) calculateIdentityScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	if !req.LivenessVerified {
		score -= 30.0
		factors = append(factors, models.RiskFactor{
			ID:          uuid.New(),
			Category:    "Identity",
			Factor:      "Liveness Not Verified",
			Impact:      -30.0,
			Severity:    models.RiskLevelHigh,
			Description: "Customer liveness check has not been completed",
		})
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateDocumentScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	if !req.DocumentVerified {
		score -= 40.0
		factors = append(factors, models.RiskFactor{
			ID:          uuid.New(),
			Category:    "Document",
			Factor:      "Document Not Verified",
			Impact:      -40.0,
			Severity:    models.RiskLevelCritical,
			Description: "Identity document has not been verified",
		})
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateAMLScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	if !req.AMLClear {
		if req.AMLHitCount > 0 {
			impact := math.Min(float64(req.AMLHitCount)*20.0, 80.0)
			score -= impact

			severity := models.RiskLevelMedium
			if req.AMLHitCount >= 3 {
				severity = models.RiskLevelCritical
			} else if req.AMLHitCount >= 2 {
				severity = models.RiskLevelHigh
			}

			factors = append(factors, models.RiskFactor{
				ID:          uuid.New(),
				Category:    "AML",
				Factor:      "AML Hits Detected",
				Impact:      -impact,
				Severity:    severity,
				Description: fmt.Sprintf("Customer has %d AML screening hits", req.AMLHitCount),
				Details: map[string]interface{}{
					"hit_count": req.AMLHitCount,
				},
			})
		}
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateBehaviorScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	highRiskOccupations := []string{
		"money service business",
		"casino",
		"cryptocurrency",
		"precious metals dealer",
		"arms dealer",
	}

	for _, occupation := range highRiskOccupations {
		if req.Occupation == occupation {
			score -= 25.0
			factors = append(factors, models.RiskFactor{
				ID:          uuid.New(),
				Category:    "Behavior",
				Factor:      "High Risk Occupation",
				Impact:      -25.0,
				Severity:    models.RiskLevelHigh,
				Description: fmt.Sprintf("Customer occupation is high risk: %s", occupation),
				Details: map[string]interface{}{
					"occupation": occupation,
				},
			})
			break
		}
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateGeographicScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	highRiskCountries := map[string]float64{
		"Iran":        -50.0,
		"North Korea": -50.0,
		"Syria":       -50.0,
		"Afghanistan": -40.0,
		"Yemen":       -40.0,
		"Somalia":     -35.0,
		"Libya":       -35.0,
	}

	if impact, exists := highRiskCountries[req.Country]; exists {
		score += impact
		factors = append(factors, models.RiskFactor{
			ID:          uuid.New(),
			Category:    "Geographic",
			Factor:      "High Risk Country",
			Impact:      impact,
			Severity:    models.RiskLevelCritical,
			Description: fmt.Sprintf("Customer is from high risk country: %s", req.Country),
			Details: map[string]interface{}{
				"country": req.Country,
			},
		})
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateTransactionScore(req models.RiskScoreRequest) (float64, []models.RiskFactor) {
	score := 100.0
	var factors []models.RiskFactor

	if req.TransactionData != nil {
		if avgAmount, ok := req.TransactionData["avg_transaction_amount"].(float64); ok {
			if avgAmount > 1000000 {
				score -= 20.0
				factors = append(factors, models.RiskFactor{
					ID:          uuid.New(),
					Category:    "Transaction",
					Factor:      "High Transaction Amount",
					Impact:      -20.0,
					Severity:    models.RiskLevelMedium,
					Description: "Customer has high average transaction amounts",
					Details: map[string]interface{}{
						"avg_amount": avgAmount,
					},
				})
			}
		}

		if txCount, ok := req.TransactionData["transaction_count"].(float64); ok {
			if txCount > 100 {
				score -= 15.0
				factors = append(factors, models.RiskFactor{
					ID:          uuid.New(),
					Category:    "Transaction",
					Factor:      "High Transaction Frequency",
					Impact:      -15.0,
					Severity:    models.RiskLevelMedium,
					Description: "Customer has high transaction frequency",
					Details: map[string]interface{}{
						"tx_count": txCount,
					},
				})
			}
		}
	}

	return math.Max(0, score), factors
}

func (s *RiskScoringService) calculateOverallScore(
	identityScore, documentScore, amlScore, behaviorScore, geographicScore, transactionScore float64,
) float64 {
	weights := map[string]float64{
		"identity":     0.20,
		"document":     0.25,
		"aml":          0.30,
		"behavior":     0.10,
		"geographic":   0.10,
		"transaction":  0.05,
	}

	overallScore := (identityScore * weights["identity"]) +
		(documentScore * weights["document"]) +
		(amlScore * weights["aml"]) +
		(behaviorScore * weights["behavior"]) +
		(geographicScore * weights["geographic"]) +
		(transactionScore * weights["transaction"])

	return math.Round(overallScore*100) / 100
}

func (s *RiskScoringService) determineRiskLevel(score float64) models.RiskLevel {
	if score >= 80 {
		return models.RiskLevelLow
	} else if score >= 60 {
		return models.RiskLevelMedium
	} else if score >= 40 {
		return models.RiskLevelHigh
	}
	return models.RiskLevelCritical
}

func (s *RiskScoringService) determineDDLevel(riskLevel models.RiskLevel, amlScore float64) models.DDLevel {
	if riskLevel == models.RiskLevelCritical || amlScore < 50 {
		return models.DDLevelEDD
	} else if riskLevel == models.RiskLevelHigh || amlScore < 70 {
		return models.DDLevelCDD
	}
	return models.DDLevelSDD
}

func (s *RiskScoringService) generateRecommendations(riskScore *models.RiskScore) map[string]interface{} {
	recommendations := make(map[string]interface{})

	recommendations["dd_level"] = riskScore.DDLevel
	recommendations["review_required"] = riskScore.RiskLevel == models.RiskLevelHigh || riskScore.RiskLevel == models.RiskLevelCritical
	recommendations["approval_required"] = riskScore.RiskLevel == models.RiskLevelCritical
	recommendations["monitoring_frequency"] = s.getMonitoringFrequency(riskScore.RiskLevel)

	var actions []string
	if riskScore.DocumentScore < 80 {
		actions = append(actions, "Request additional identity documents")
	}
	if riskScore.AMLScore < 70 {
		actions = append(actions, "Conduct enhanced AML screening")
	}
	if riskScore.IdentityScore < 80 {
		actions = append(actions, "Perform additional liveness checks")
	}
	if riskScore.GeographicScore < 70 {
		actions = append(actions, "Review geographic risk factors")
	}

	recommendations["recommended_actions"] = actions

	return recommendations
}

func (s *RiskScoringService) getMonitoringFrequency(riskLevel models.RiskLevel) string {
	switch riskLevel {
	case models.RiskLevelCritical:
		return "daily"
	case models.RiskLevelHigh:
		return "weekly"
	case models.RiskLevelMedium:
		return "monthly"
	default:
		return "quarterly"
	}
}

func (s *RiskScoringService) publishEvent(riskScore *models.RiskScore) {
	if s.daprClient == nil {
		return
	}

	eventData := map[string]interface{}{
		"risk_score_id":  riskScore.ID.String(),
		"customer_id":    riskScore.CustomerID.String(),
		"overall_score":  riskScore.OverallScore,
		"risk_level":     riskScore.RiskLevel,
		"dd_level":       riskScore.DDLevel,
		"timestamp":      time.Now().Format(time.RFC3339),
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		log.Printf("Failed to marshal event data: %v", err)
		return
	}

	if err := s.daprClient.PublishEvent(context.Background(), "kafka-pubsub", "kyc.risk.scored", data); err != nil {
		log.Printf("Failed to publish event: %v", err)
	}
}

func (s *RiskScoringService) GetRiskScore(id string) (*models.RiskScore, error) {
	riskScoreID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid risk score ID: %w", err)
	}

	var riskScore models.RiskScore
	if err := s.db.Preload("RiskFactors").First(&riskScore, "id = ?", riskScoreID).Error; err != nil {
		return nil, err
	}

	return &riskScore, nil
}

func (s *RiskScoringService) GetCustomerRiskScores(customerID string) ([]models.RiskScore, error) {
	custID, err := uuid.Parse(customerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	var riskScores []models.RiskScore
	if err := s.db.Preload("RiskFactors").Where("customer_id = ?", custID).Order("calculated_at DESC").Find(&riskScores).Error; err != nil {
		return nil, err
	}

	return riskScores, nil
}

func (s *RiskScoringService) GetLatestRiskScore(customerID string) (*models.RiskScore, error) {
	custID, err := uuid.Parse(customerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	var riskScore models.RiskScore
	if err := s.db.Preload("RiskFactors").Where("customer_id = ? AND expires_at > ?", custID, time.Now()).Order("calculated_at DESC").First(&riskScore).Error; err != nil {
		return nil, err
	}

	return &riskScore, nil
}
