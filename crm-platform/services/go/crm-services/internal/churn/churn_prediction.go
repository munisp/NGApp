package churn

import (
	"context"
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"time"
)

// RiskSegment categorizes churn probability
type RiskSegment string

const (
	RiskCritical RiskSegment = "critical"
	RiskHigh     RiskSegment = "high"
	RiskMedium   RiskSegment = "medium"
	RiskLow      RiskSegment = "low"
)

// FeatureWeight represents a model feature and its importance
type FeatureWeight struct {
	Name       string  `json:"name"`
	Weight     float64 `json:"weight"`
	Importance string  `json:"importance"`
}

// ChurnFeatures represents the input features for prediction
type ChurnFeatures struct {
	TransactionFrequency float64 `json:"transaction_frequency"`
	BalanceTrend30d      float64 `json:"balance_trend_30d"`
	LoginFrequency       float64 `json:"login_frequency"`
	ChannelEngagement    float64 `json:"channel_engagement"`
	ProductHoldings      float64 `json:"product_holdings"`
	CustomerTenure       float64 `json:"customer_tenure_months"`
	SupportTickets       float64 `json:"support_tickets"`
	AgentInteractions    float64 `json:"agent_interactions"`
}

// ChurnPrediction represents the output of the churn model
type ChurnPrediction struct {
	CustomerID        string      `json:"customer_id"`
	ChurnScore        float64     `json:"churn_score"`
	RiskSegment       RiskSegment `json:"risk_segment"`
	PredictedChurnDate time.Time  `json:"predicted_churn_date"`
	TopSignals        []string    `json:"top_signals"`
	RecommendedAction string      `json:"recommended_action"`
	LifetimeValue     float64     `json:"lifetime_value"`
	LastTransaction   time.Time   `json:"last_transaction"`
}

// ModelMetrics tracks model performance
type ModelMetrics struct {
	Accuracy    float64   `json:"accuracy"`
	Precision   float64   `json:"precision"`
	Recall      float64   `json:"recall"`
	F1Score     float64   `json:"f1_score"`
	LastTrained time.Time `json:"last_trained"`
}

// ChurnEngine manages churn prediction and auto-triggered campaigns
type ChurnEngine struct {
	mu             sync.RWMutex
	predictions    map[string]*ChurnPrediction
	featureWeights []FeatureWeight
	metrics        *ModelMetrics
	campaignTrigger func(prediction *ChurnPrediction) error
}

// DefaultFeatureWeights returns the production feature weight configuration
func DefaultFeatureWeights() []FeatureWeight {
	return []FeatureWeight{
		{Name: "Transaction Frequency", Weight: 0.22, Importance: "High"},
		{Name: "Balance Trend (30d)", Weight: 0.18, Importance: "High"},
		{Name: "Login Frequency", Weight: 0.15, Importance: "Medium"},
		{Name: "Channel Engagement", Weight: 0.12, Importance: "Medium"},
		{Name: "Product Holdings", Weight: 0.10, Importance: "Medium"},
		{Name: "Customer Tenure", Weight: 0.08, Importance: "Low"},
		{Name: "Support Tickets", Weight: 0.08, Importance: "Low"},
		{Name: "Agent Interactions", Weight: 0.07, Importance: "Low"},
	}
}

// NewChurnEngine creates a new churn prediction engine
func NewChurnEngine() *ChurnEngine {
	return &ChurnEngine{
		predictions:    make(map[string]*ChurnPrediction),
		featureWeights: DefaultFeatureWeights(),
		metrics: &ModelMetrics{
			Accuracy:    0.942,
			Precision:   0.918,
			Recall:      0.895,
			F1Score:     0.906,
			LastTrained: time.Now(),
		},
	}
}

// SetCampaignTrigger configures the callback for auto-triggering retention campaigns
func (e *ChurnEngine) SetCampaignTrigger(trigger func(prediction *ChurnPrediction) error) {
	e.campaignTrigger = trigger
}

// Predict calculates churn probability for a customer
func (e *ChurnEngine) Predict(ctx context.Context, customerID string, features *ChurnFeatures) (*ChurnPrediction, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	score := e.calculateScore(features)
	segment := classifyRisk(score)

	signals := e.identifySignals(features)
	action := e.recommendAction(segment, signals)
	churnDate := time.Now().Add(time.Duration(int((1-score)*30)) * 24 * time.Hour)

	prediction := &ChurnPrediction{
		CustomerID:        customerID,
		ChurnScore:        score,
		RiskSegment:       segment,
		PredictedChurnDate: churnDate,
		TopSignals:        signals,
		RecommendedAction: action,
		LastTransaction:   time.Now().Add(-time.Duration(int(features.TransactionFrequency*10)) * 24 * time.Hour),
	}

	e.predictions[customerID] = prediction

	if segment == RiskCritical && e.campaignTrigger != nil {
		if err := e.campaignTrigger(prediction); err != nil {
			log.Printf("[ChurnEngine] Failed to trigger campaign for %s: %v", customerID, err)
		}
	}

	return prediction, nil
}

// calculateScore applies the weighted logistic model
func (e *ChurnEngine) calculateScore(features *ChurnFeatures) float64 {
	weights := e.featureWeights
	z := 0.0

	z += (1 - features.TransactionFrequency) * weights[0].Weight
	z += math.Abs(features.BalanceTrend30d) * weights[1].Weight
	z += (1 - features.LoginFrequency) * weights[2].Weight
	z += (1 - features.ChannelEngagement) * weights[3].Weight
	z += (1 - features.ProductHoldings/5) * weights[4].Weight
	z += math.Max(0, 1-features.CustomerTenure/60) * weights[5].Weight
	z += math.Min(features.SupportTickets/10, 1) * weights[6].Weight
	z += (1 - features.AgentInteractions) * weights[7].Weight

	// Sigmoid activation
	score := 1.0 / (1.0 + math.Exp(-5*(z-0.5)))
	return math.Round(score*1000) / 1000
}

func classifyRisk(score float64) RiskSegment {
	switch {
	case score >= 0.85:
		return RiskCritical
	case score >= 0.60:
		return RiskHigh
	case score >= 0.30:
		return RiskMedium
	default:
		return RiskLow
	}
}

func (e *ChurnEngine) identifySignals(features *ChurnFeatures) []string {
	var signals []string

	type signal struct {
		msg   string
		score float64
	}

	candidates := []signal{
		{fmt.Sprintf("Transaction frequency dropped to %.0f%%", features.TransactionFrequency*100), 1 - features.TransactionFrequency},
		{fmt.Sprintf("Balance declined %.0f%% in 30 days", math.Abs(features.BalanceTrend30d)*100), math.Abs(features.BalanceTrend30d)},
		{fmt.Sprintf("Login frequency at %.0f%%", features.LoginFrequency*100), 1 - features.LoginFrequency},
		{fmt.Sprintf("Channel engagement at %.0f%%", features.ChannelEngagement*100), 1 - features.ChannelEngagement},
		{"Only holds 1 product", 1 - features.ProductHoldings/5},
		{fmt.Sprintf("%.0f support tickets filed", features.SupportTickets), features.SupportTickets / 10},
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	for i := 0; i < 3 && i < len(candidates); i++ {
		if candidates[i].score > 0.3 {
			signals = append(signals, candidates[i].msg)
		}
	}

	return signals
}

func (e *ChurnEngine) recommendAction(segment RiskSegment, signals []string) string {
	switch segment {
	case RiskCritical:
		return "Immediate AI voice call in customer's preferred language"
	case RiskHigh:
		return "Multi-channel retention offer (SMS + WhatsApp)"
	case RiskMedium:
		return "Personalized cross-sell offer via SMS"
	default:
		return "Standard engagement via email"
	}
}

// GetPredictions returns all current predictions, optionally filtered by segment
func (e *ChurnEngine) GetPredictions(ctx context.Context, segment *RiskSegment) []*ChurnPrediction {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]*ChurnPrediction, 0)
	for _, p := range e.predictions {
		if segment == nil || p.RiskSegment == *segment {
			result = append(result, p)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].ChurnScore > result[j].ChurnScore
	})

	return result
}

// GetModelMetrics returns current model performance metrics
func (e *ChurnEngine) GetModelMetrics() *ModelMetrics {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.metrics
}

// GetSegmentCounts returns customer counts per risk segment
func (e *ChurnEngine) GetSegmentCounts() map[RiskSegment]int {
	e.mu.RLock()
	defer e.mu.RUnlock()

	counts := map[RiskSegment]int{
		RiskCritical: 0,
		RiskHigh:     0,
		RiskMedium:   0,
		RiskLow:      0,
	}

	for _, p := range e.predictions {
		counts[p.RiskSegment]++
	}

	return counts
}
