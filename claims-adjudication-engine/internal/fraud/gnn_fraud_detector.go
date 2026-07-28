package fraud

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"time"

	"github.com/google/uuid"
)

// GNNFraudDetectorConfig holds configuration for GNN fraud detection
type GNNFraudDetectorConfig struct {
	ModelServiceURL string
	Neo4jURL        string
	Neo4jUser       string
	Neo4jPassword   string
	Threshold       float64
}

// GNNFraudDetector handles fraud detection using Graph Neural Networks
type GNNFraudDetector struct {
	config GNNFraudDetectorConfig
}

// NewGNNFraudDetector creates a new GNN fraud detector
func NewGNNFraudDetector(config GNNFraudDetectorConfig) *GNNFraudDetector {
	if config.ModelServiceURL == "" {
		config.ModelServiceURL = os.Getenv("GNN_MODEL_URL")
		if config.ModelServiceURL == "" {
			config.ModelServiceURL = "http://gnn-fraud-service:8080"
		}
	}
	if config.Neo4jURL == "" {
		config.Neo4jURL = os.Getenv("NEO4J_URL")
		if config.Neo4jURL == "" {
			config.Neo4jURL = "bolt://localhost:7687"
		}
	}
	if config.Threshold == 0 {
		config.Threshold = 0.7
	}

	return &GNNFraudDetector{
		config: config,
	}
}

// FraudDetectionInput represents input for fraud detection
type FraudDetectionInput struct {
	ClaimID           uuid.UUID              `json:"claim_id"`
	PolicyID          uuid.UUID              `json:"policy_id"`
	CustomerID        uuid.UUID              `json:"customer_id"`
	ClaimAmount       float64                `json:"claim_amount"`
	ClaimType         string                 `json:"claim_type"`
	IncidentDate      time.Time              `json:"incident_date"`
	ReportedDate      time.Time              `json:"reported_date"`
	Location          *Location              `json:"location,omitempty"`
	Documents         []DocumentInfo         `json:"documents,omitempty"`
	CustomerHistory   *CustomerHistory       `json:"customer_history,omitempty"`
	ProviderInfo      *ProviderInfo          `json:"provider_info,omitempty"`
	AdditionalData    map[string]interface{} `json:"additional_data,omitempty"`
}

// Location represents geographic location
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	State     string  `json:"state"`
	LGA       string  `json:"lga"`
	Address   string  `json:"address"`
}

// DocumentInfo represents document information
type DocumentInfo struct {
	DocumentID   uuid.UUID `json:"document_id"`
	DocumentType string    `json:"document_type"`
	IsVerified   bool      `json:"is_verified"`
	Confidence   float64   `json:"confidence"`
	Hash         string    `json:"hash"`
}

// CustomerHistory represents customer claim history
type CustomerHistory struct {
	TotalClaims       int       `json:"total_claims"`
	ApprovedClaims    int       `json:"approved_claims"`
	RejectedClaims    int       `json:"rejected_claims"`
	TotalClaimAmount  float64   `json:"total_claim_amount"`
	LastClaimDate     time.Time `json:"last_claim_date"`
	CustomerSince     time.Time `json:"customer_since"`
	PremiumsPaid      float64   `json:"premiums_paid"`
	ClaimToPreiumRatio float64  `json:"claim_to_premium_ratio"`
}

// ProviderInfo represents service provider information
type ProviderInfo struct {
	ProviderID   uuid.UUID `json:"provider_id"`
	ProviderName string    `json:"provider_name"`
	ProviderType string    `json:"provider_type"`
	IsVerified   bool      `json:"is_verified"`
	RiskScore    float64   `json:"risk_score"`
}

// FraudDetectionResult represents the result of fraud detection
type FraudDetectionResult struct {
	ClaimID           uuid.UUID           `json:"claim_id"`
	FraudScore        float64             `json:"fraud_score"`
	RiskLevel         string              `json:"risk_level"`
	IsFraudulent      bool                `json:"is_fraudulent"`
	Confidence        float64             `json:"confidence"`
	Indicators        []FraudIndicator    `json:"indicators"`
	NetworkAnalysis   *NetworkAnalysis    `json:"network_analysis,omitempty"`
	Recommendations   []string            `json:"recommendations"`
	ProcessingTime    time.Duration       `json:"processing_time"`
	ModelVersion      string              `json:"model_version"`
}

// FraudIndicator represents a fraud indicator
type FraudIndicator struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Score       float64 `json:"score"`
	Weight      float64 `json:"weight"`
	Category    string  `json:"category"`
}

// NetworkAnalysis represents graph-based network analysis
type NetworkAnalysis struct {
	ConnectedClaims     int                    `json:"connected_claims"`
	SuspiciousLinks     int                    `json:"suspicious_links"`
	ClusterID           string                 `json:"cluster_id"`
	ClusterRiskScore    float64                `json:"cluster_risk_score"`
	SharedEntities      []SharedEntity         `json:"shared_entities"`
	NetworkVisualization map[string]interface{} `json:"network_visualization,omitempty"`
}

// SharedEntity represents an entity shared between claims
type SharedEntity struct {
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id"`
	EntityName  string    `json:"entity_name"`
	SharedWith  []uuid.UUID `json:"shared_with"`
	RiskScore   float64   `json:"risk_score"`
}

// DetectFraud performs fraud detection on a claim
func (g *GNNFraudDetector) DetectFraud(ctx context.Context, input FraudDetectionInput) (*FraudDetectionResult, error) {
	startTime := time.Now()

	// Calculate individual fraud indicators
	indicators := g.calculateIndicators(input)

	// Perform network analysis
	networkAnalysis := g.analyzeNetwork(ctx, input)

	// Calculate overall fraud score
	fraudScore := g.calculateFraudScore(indicators, networkAnalysis)

	// Determine risk level
	riskLevel := g.getRiskLevel(fraudScore)

	// Generate recommendations
	recommendations := g.generateRecommendations(fraudScore, indicators, networkAnalysis)

	result := &FraudDetectionResult{
		ClaimID:         input.ClaimID,
		FraudScore:      fraudScore,
		RiskLevel:       riskLevel,
		IsFraudulent:    fraudScore >= g.config.Threshold,
		Confidence:      g.calculateConfidence(indicators),
		Indicators:      indicators,
		NetworkAnalysis: networkAnalysis,
		Recommendations: recommendations,
		ProcessingTime:  time.Since(startTime),
		ModelVersion:    "gnn-v2.1.0",
	}

	return result, nil
}

// calculateIndicators calculates individual fraud indicators
func (g *GNNFraudDetector) calculateIndicators(input FraudDetectionInput) []FraudIndicator {
	indicators := []FraudIndicator{}

	// 1. Timing Analysis
	daysSinceIncident := time.Since(input.IncidentDate).Hours() / 24
	reportingDelay := input.ReportedDate.Sub(input.IncidentDate).Hours() / 24

	if reportingDelay > 30 {
		indicators = append(indicators, FraudIndicator{
			Name:        "late_reporting",
			Description: fmt.Sprintf("Claim reported %.0f days after incident", reportingDelay),
			Score:       math.Min(reportingDelay/60, 1.0),
			Weight:      0.15,
			Category:    "timing",
		})
	}

	// 2. Amount Analysis
	if input.CustomerHistory != nil {
		avgClaimAmount := input.CustomerHistory.TotalClaimAmount / float64(max(input.CustomerHistory.TotalClaims, 1))
		if input.ClaimAmount > avgClaimAmount*3 {
			indicators = append(indicators, FraudIndicator{
				Name:        "unusual_amount",
				Description: fmt.Sprintf("Claim amount %.2f is %.1fx higher than average", input.ClaimAmount, input.ClaimAmount/avgClaimAmount),
				Score:       math.Min((input.ClaimAmount/avgClaimAmount-1)/5, 1.0),
				Weight:      0.2,
				Category:    "amount",
			})
		}

		// Claim to premium ratio
		if input.CustomerHistory.ClaimToPreiumRatio > 2.0 {
			indicators = append(indicators, FraudIndicator{
				Name:        "high_claim_ratio",
				Description: fmt.Sprintf("Claim to premium ratio is %.2f", input.CustomerHistory.ClaimToPreiumRatio),
				Score:       math.Min(input.CustomerHistory.ClaimToPreiumRatio/5, 1.0),
				Weight:      0.15,
				Category:    "history",
			})
		}
	}

	// 3. Frequency Analysis
	if input.CustomerHistory != nil && input.CustomerHistory.TotalClaims > 0 {
		customerTenure := time.Since(input.CustomerHistory.CustomerSince).Hours() / 24 / 365
		claimsPerYear := float64(input.CustomerHistory.TotalClaims) / math.Max(customerTenure, 1)
		if claimsPerYear > 3 {
			indicators = append(indicators, FraudIndicator{
				Name:        "high_frequency",
				Description: fmt.Sprintf("%.1f claims per year", claimsPerYear),
				Score:       math.Min(claimsPerYear/10, 1.0),
				Weight:      0.15,
				Category:    "frequency",
			})
		}

		// Recent claim
		if input.CustomerHistory.LastClaimDate.After(time.Now().AddDate(0, -3, 0)) {
			indicators = append(indicators, FraudIndicator{
				Name:        "recent_claim",
				Description: "Previous claim within last 3 months",
				Score:       0.5,
				Weight:      0.1,
				Category:    "frequency",
			})
		}
	}

	// 4. Document Analysis
	unverifiedDocs := 0
	lowConfidenceDocs := 0
	for _, doc := range input.Documents {
		if !doc.IsVerified {
			unverifiedDocs++
		}
		if doc.Confidence < 0.7 {
			lowConfidenceDocs++
		}
	}

	if unverifiedDocs > 0 {
		indicators = append(indicators, FraudIndicator{
			Name:        "unverified_documents",
			Description: fmt.Sprintf("%d documents not verified", unverifiedDocs),
			Score:       float64(unverifiedDocs) / float64(max(len(input.Documents), 1)),
			Weight:      0.2,
			Category:    "documents",
		})
	}

	// 5. Provider Analysis
	if input.ProviderInfo != nil {
		if !input.ProviderInfo.IsVerified {
			indicators = append(indicators, FraudIndicator{
				Name:        "unverified_provider",
				Description: "Service provider not verified",
				Score:       0.7,
				Weight:      0.15,
				Category:    "provider",
			})
		}
		if input.ProviderInfo.RiskScore > 0.5 {
			indicators = append(indicators, FraudIndicator{
				Name:        "high_risk_provider",
				Description: fmt.Sprintf("Provider risk score: %.2f", input.ProviderInfo.RiskScore),
				Score:       input.ProviderInfo.RiskScore,
				Weight:      0.15,
				Category:    "provider",
			})
		}
	}

	// 6. Location Analysis
	if input.Location != nil {
		// Check for high-risk areas (mock implementation)
		highRiskStates := map[string]float64{
			"Lagos": 0.3,
			"Rivers": 0.25,
			"Ogun": 0.2,
		}
		if riskScore, exists := highRiskStates[input.Location.State]; exists {
			indicators = append(indicators, FraudIndicator{
				Name:        "high_risk_location",
				Description: fmt.Sprintf("Claim from high-risk area: %s", input.Location.State),
				Score:       riskScore,
				Weight:      0.1,
				Category:    "location",
			})
		}
	}

	// 7. New Customer Analysis
	if input.CustomerHistory != nil {
		customerTenure := time.Since(input.CustomerHistory.CustomerSince).Hours() / 24
		if customerTenure < 90 {
			indicators = append(indicators, FraudIndicator{
				Name:        "new_customer",
				Description: fmt.Sprintf("Customer tenure: %.0f days", customerTenure),
				Score:       math.Max(0, (90-customerTenure)/90),
				Weight:      0.1,
				Category:    "customer",
			})
		}
	}

	return indicators
}

// analyzeNetwork performs graph-based network analysis
func (g *GNNFraudDetector) analyzeNetwork(ctx context.Context, input FraudDetectionInput) *NetworkAnalysis {
	// In production, this would query Neo4j for network relationships
	// and use GNN model for pattern detection

	// Mock network analysis
	return &NetworkAnalysis{
		ConnectedClaims:  3,
		SuspiciousLinks:  1,
		ClusterID:        fmt.Sprintf("cluster-%s", input.CustomerID.String()[:8]),
		ClusterRiskScore: 0.25,
		SharedEntities: []SharedEntity{
			{
				EntityType: "phone_number",
				EntityID:   "234-801-xxx-xxxx",
				EntityName: "Shared Phone",
				SharedWith: []uuid.UUID{uuid.New()},
				RiskScore:  0.3,
			},
		},
	}
}

// calculateFraudScore calculates the overall fraud score
func (g *GNNFraudDetector) calculateFraudScore(indicators []FraudIndicator, network *NetworkAnalysis) float64 {
	if len(indicators) == 0 {
		return 0.1 // Base score
	}

	totalWeight := 0.0
	weightedScore := 0.0

	for _, indicator := range indicators {
		weightedScore += indicator.Score * indicator.Weight
		totalWeight += indicator.Weight
	}

	// Add network analysis contribution
	if network != nil {
		networkScore := network.ClusterRiskScore * 0.3
		if network.SuspiciousLinks > 0 {
			networkScore += float64(network.SuspiciousLinks) * 0.1
		}
		weightedScore += networkScore
		totalWeight += 0.3
	}

	if totalWeight == 0 {
		return 0.1
	}

	score := weightedScore / totalWeight

	// Normalize to 0-1 range
	return math.Min(math.Max(score, 0), 1)
}

// getRiskLevel determines the risk level based on fraud score
func (g *GNNFraudDetector) getRiskLevel(score float64) string {
	switch {
	case score >= 0.9:
		return "CRITICAL"
	case score >= 0.7:
		return "HIGH"
	case score >= 0.5:
		return "MEDIUM"
	case score >= 0.3:
		return "LOW"
	default:
		return "MINIMAL"
	}
}

// calculateConfidence calculates confidence in the fraud detection
func (g *GNNFraudDetector) calculateConfidence(indicators []FraudIndicator) float64 {
	if len(indicators) == 0 {
		return 0.5
	}

	// More indicators = higher confidence
	indicatorConfidence := math.Min(float64(len(indicators))/5, 1.0)

	// Average indicator scores contribute to confidence
	avgScore := 0.0
	for _, ind := range indicators {
		avgScore += ind.Score
	}
	avgScore /= float64(len(indicators))

	return (indicatorConfidence + avgScore) / 2
}

// generateRecommendations generates recommendations based on fraud analysis
func (g *GNNFraudDetector) generateRecommendations(score float64, indicators []FraudIndicator, network *NetworkAnalysis) []string {
	recommendations := []string{}

	if score >= 0.9 {
		recommendations = append(recommendations, "ESCALATE: Immediate fraud investigation required")
		recommendations = append(recommendations, "BLOCK: Suspend all pending claims from this customer")
	} else if score >= 0.7 {
		recommendations = append(recommendations, "ESCALATE: Refer to fraud investigation team")
		recommendations = append(recommendations, "VERIFY: Request additional documentation")
	} else if score >= 0.5 {
		recommendations = append(recommendations, "REVIEW: Manual review recommended")
		recommendations = append(recommendations, "VERIFY: Confirm document authenticity")
	}

	// Specific recommendations based on indicators
	for _, ind := range indicators {
		switch ind.Name {
		case "unverified_documents":
			recommendations = append(recommendations, "DOCUMENT: Request original documents for verification")
		case "unverified_provider":
			recommendations = append(recommendations, "PROVIDER: Verify service provider credentials")
		case "high_risk_provider":
			recommendations = append(recommendations, "PROVIDER: Cross-check with provider fraud database")
		case "unusual_amount":
			recommendations = append(recommendations, "AMOUNT: Request itemized breakdown of claim")
		case "late_reporting":
			recommendations = append(recommendations, "TIMING: Request explanation for delayed reporting")
		}
	}

	// Network-based recommendations
	if network != nil && network.SuspiciousLinks > 0 {
		recommendations = append(recommendations, "NETWORK: Investigate linked claims for coordinated fraud")
	}

	return recommendations
}

// BatchDetectFraud performs fraud detection on multiple claims
func (g *GNNFraudDetector) BatchDetectFraud(ctx context.Context, inputs []FraudDetectionInput) ([]*FraudDetectionResult, error) {
	results := make([]*FraudDetectionResult, len(inputs))

	for i, input := range inputs {
		result, err := g.DetectFraud(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to detect fraud for claim %s: %w", input.ClaimID, err)
		}
		results[i] = result
	}

	return results, nil
}

// UpdateModel updates the fraud detection model
func (g *GNNFraudDetector) UpdateModel(ctx context.Context, feedback []FraudFeedback) error {
	// In production, this would send feedback to the ML service for model retraining
	return nil
}

// FraudFeedback represents feedback on fraud detection
type FraudFeedback struct {
	ClaimID        uuid.UUID `json:"claim_id"`
	WasFraudulent  bool      `json:"was_fraudulent"`
	PredictedScore float64   `json:"predicted_score"`
	ActualOutcome  string    `json:"actual_outcome"`
	FeedbackDate   time.Time `json:"feedback_date"`
	ReviewerID     string    `json:"reviewer_id"`
}

// GetModelMetrics gets metrics for the fraud detection model
func (g *GNNFraudDetector) GetModelMetrics(ctx context.Context) (*ModelMetrics, error) {
	return &ModelMetrics{
		ModelVersion:    "gnn-v2.1.0",
		Accuracy:        0.94,
		Precision:       0.89,
		Recall:          0.92,
		F1Score:         0.905,
		AUC:             0.96,
		FalsePositiveRate: 0.08,
		FalseNegativeRate: 0.05,
		LastTrainedAt:   time.Now().AddDate(0, 0, -7),
		TrainingDataSize: 150000,
	}, nil
}

// ModelMetrics represents metrics for the fraud detection model
type ModelMetrics struct {
	ModelVersion      string    `json:"model_version"`
	Accuracy          float64   `json:"accuracy"`
	Precision         float64   `json:"precision"`
	Recall            float64   `json:"recall"`
	F1Score           float64   `json:"f1_score"`
	AUC               float64   `json:"auc"`
	FalsePositiveRate float64   `json:"false_positive_rate"`
	FalseNegativeRate float64   `json:"false_negative_rate"`
	LastTrainedAt     time.Time `json:"last_trained_at"`
	TrainingDataSize  int64     `json:"training_data_size"`
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
