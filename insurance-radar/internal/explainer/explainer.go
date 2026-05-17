package explainer

import (
	"context"
	"fmt"
	"sort"

	"github.com/insurance-platform/insurance-radar/internal/ml"
	"github.com/insurance-platform/insurance-radar/internal/models"
	"github.com/insurance-platform/insurance-radar/internal/rules"
	"go.uber.org/zap"
)

// FraudExplainer provides human-readable explanations for fraud decisions
// Inspired by Stripe Radar's approach to explainable AI
type FraudExplainer struct {
	logger *zap.Logger
}

// NewFraudExplainer creates a new fraud explainer
func NewFraudExplainer(logger *zap.Logger) *FraudExplainer {
	return &FraudExplainer{
		logger: logger,
	}
}

// ExplainDecision generates a human-readable explanation for a fraud decision
func (fe *FraudExplainer) ExplainDecision(
	ctx context.Context,
	prediction *ml.Prediction,
	ruleResults []rules.RuleEvaluationResult,
	features map[string]float64,
) *models.FraudExplanation {
	explanation := &models.FraudExplanation{
		TopFactors:        make([]string, 0),
		MitigatingFactors: make([]string, 0),
		SuggestedActions:  make([]string, 0),
		ComplianceNotes:   make([]string, 0),
	}

	// Generate summary based on risk level
	explanation.Summary = fe.generateSummary(prediction)

	// Extract top contributing factors
	explanation.TopFactors = fe.extractTopFactors(prediction.FeatureImportance, features)

	// Extract mitigating factors
	explanation.MitigatingFactors = fe.extractMitigatingFactors(features)

	// Generate suggested actions based on decision
	explanation.SuggestedActions = fe.generateSuggestedActions(prediction, ruleResults)

	// Add compliance notes
	explanation.ComplianceNotes = fe.generateComplianceNotes(prediction, ruleResults)

	return explanation
}

// generateSummary creates a summary of the fraud decision
func (fe *FraudExplainer) generateSummary(prediction *ml.Prediction) string {
	switch prediction.RiskLevel {
	case models.RiskLevelCritical:
		return fmt.Sprintf("This transaction has been flagged as CRITICAL RISK with a fraud score of %.2f%%. Multiple high-severity indicators suggest potential fraudulent activity. Immediate review and blocking is recommended.", prediction.Score*100)
	case models.RiskLevelHigh:
		return fmt.Sprintf("This transaction has been flagged as HIGH RISK with a fraud score of %.2f%%. Several risk indicators warrant manual review before proceeding.", prediction.Score*100)
	case models.RiskLevelMedium:
		return fmt.Sprintf("This transaction has been flagged as MEDIUM RISK with a fraud score of %.2f%%. Some risk indicators are present but may be legitimate. Additional verification is suggested.", prediction.Score*100)
	default:
		return fmt.Sprintf("This transaction has been assessed as LOW RISK with a fraud score of %.2f%%. No significant fraud indicators detected.", prediction.Score*100)
	}
}

// extractTopFactors extracts the top contributing factors to the fraud score
func (fe *FraudExplainer) extractTopFactors(importance map[string]float64, features map[string]float64) []string {
	// Sort features by importance
	type featureScore struct {
		name       string
		importance float64
		value      float64
	}

	scores := make([]featureScore, 0, len(importance))
	for name, imp := range importance {
		value := features[name]
		scores = append(scores, featureScore{name: name, importance: imp, value: value})
	}

	sort.Slice(scores, func(i, j int) bool {
		return scores[i].importance > scores[j].importance
	})

	// Take top 5 factors
	topFactors := make([]string, 0, 5)
	for i := 0; i < len(scores) && i < 5; i++ {
		factor := fe.featureToExplanation(scores[i].name, scores[i].value)
		if factor != "" {
			topFactors = append(topFactors, factor)
		}
	}

	return topFactors
}

// featureToExplanation converts a feature name and value to human-readable explanation
func (fe *FraudExplainer) featureToExplanation(name string, value float64) string {
	explanations := map[string]func(float64) string{
		"location_is_vpn": func(v float64) string {
			if v == 1.0 {
				return "Transaction originated from a VPN connection, which may indicate an attempt to hide true location"
			}
			return ""
		},
		"location_is_proxy": func(v float64) string {
			if v == 1.0 {
				return "Transaction originated from a proxy server, which may indicate location masking"
			}
			return ""
		},
		"location_is_tor": func(v float64) string {
			if v == 1.0 {
				return "Transaction originated from the Tor network, commonly used for anonymization"
			}
			return ""
		},
		"behavior_is_night_time": func(v float64) string {
			if v == 1.0 {
				return "Transaction occurred during unusual hours (late night/early morning)"
			}
			return ""
		},
		"velocity_requests_last_hour": func(v float64) string {
			if v > 5 {
				return fmt.Sprintf("Unusually high activity: %.0f requests in the last hour", v)
			}
			return ""
		},
		"velocity_claims_last_month": func(v float64) string {
			if v > 2 {
				return fmt.Sprintf("Multiple claims (%.0f) filed in the past month", v)
			}
			return ""
		},
		"claim_amount": func(v float64) string {
			if v > 1000000 {
				return fmt.Sprintf("High claim amount: ₦%.2f", v)
			}
			return ""
		},
		"policy_age_days": func(v float64) string {
			if v < 30 {
				return fmt.Sprintf("Policy is relatively new (%.0f days old)", v)
			}
			return ""
		},
		"agent_fraud_rate": func(v float64) string {
			if v > 0.05 {
				return fmt.Sprintf("Agent has elevated fraud rate: %.1f%%", v*100)
			}
			return ""
		},
		"document_modification_detected": func(v float64) string {
			if v == 1.0 {
				return "Document tampering or modification detected"
			}
			return ""
		},
		"network_blacklist_match": func(v float64) string {
			if v == 1.0 {
				return "Entity matches entry in cross-company fraud database"
			}
			return ""
		},
		"device_fingerprint_mismatch": func(v float64) string {
			if v == 1.0 {
				return "Device fingerprint doesn't match historical patterns for this customer"
			}
			return ""
		},
		"location_country_non_africa": func(v float64) string {
			if v == 1.0 {
				return "Transaction originated from outside expected geographic region"
			}
			return ""
		},
	}

	if explainFunc, ok := explanations[name]; ok {
		return explainFunc(value)
	}

	// Generic explanation for unknown features
	if value > 0.8 {
		return fmt.Sprintf("High value detected for %s: %.2f", name, value)
	}

	return ""
}

// extractMitigatingFactors extracts factors that reduce fraud risk
func (fe *FraudExplainer) extractMitigatingFactors(features map[string]float64) []string {
	mitigating := make([]string, 0)

	// Check for positive signals
	if features["customer_kyc_score"] > 0.8 {
		mitigating = append(mitigating, "Customer has completed full KYC verification")
	}

	if features["customer_age_days"] > 365 {
		mitigating = append(mitigating, "Customer has been with the platform for over a year")
	}

	if features["customer_fraud_history"] == 0 {
		mitigating = append(mitigating, "No previous fraud incidents associated with this customer")
	}

	if features["network_whitelist_match"] == 1.0 {
		mitigating = append(mitigating, "Entity is on trusted whitelist")
	}

	if features["agent_tenure_days"] > 365 {
		mitigating = append(mitigating, "Agent has been with the platform for over a year")
	}

	if features["customer_payment_history"] > 0.9 {
		mitigating = append(mitigating, "Customer has excellent payment history")
	}

	return mitigating
}

// generateSuggestedActions generates recommended actions based on the decision
func (fe *FraudExplainer) generateSuggestedActions(prediction *ml.Prediction, ruleResults []rules.RuleEvaluationResult) []string {
	actions := make([]string, 0)

	switch prediction.Decision {
	case "block":
		actions = append(actions, "Block this transaction immediately")
		actions = append(actions, "Notify the fraud investigation team")
		actions = append(actions, "Flag the customer account for review")
		actions = append(actions, "Document all evidence for potential legal action")

	case "review":
		actions = append(actions, "Place transaction on hold pending manual review")
		actions = append(actions, "Request additional documentation from the customer")
		actions = append(actions, "Verify customer identity through secondary channel")
		actions = append(actions, "Check for similar patterns in recent transactions")

	case "flag":
		actions = append(actions, "Allow transaction but flag for monitoring")
		actions = append(actions, "Add customer to enhanced monitoring list")
		actions = append(actions, "Schedule follow-up review in 24 hours")

	case "allow":
		actions = append(actions, "Proceed with transaction")
		actions = append(actions, "Continue standard monitoring")
	}

	// Add rule-specific actions
	for _, result := range ruleResults {
		if result.Matched {
			switch result.RuleID {
			case "rule_document_tampering":
				actions = append(actions, "Request original documents for verification")
			case "rule_network_fraud":
				actions = append(actions, "Cross-reference with industry fraud database")
			case "rule_agent_fraud_pattern":
				actions = append(actions, "Review agent's recent transactions")
			}
		}
	}

	return actions
}

// generateComplianceNotes generates compliance-related notes
func (fe *FraudExplainer) generateComplianceNotes(prediction *ml.Prediction, ruleResults []rules.RuleEvaluationResult) []string {
	notes := make([]string, 0)

	// NAICOM compliance notes
	if prediction.RiskLevel == models.RiskLevelCritical || prediction.RiskLevel == models.RiskLevelHigh {
		notes = append(notes, "NAICOM Guideline: High-risk transactions must be reported within 24 hours")
		notes = append(notes, "Maintain detailed audit trail for regulatory review")
	}

	// NDPR compliance notes
	notes = append(notes, "NDPR: Customer data used for fraud detection must be handled in compliance with data protection regulations")

	// AML compliance notes
	if prediction.Score > 0.7 {
		notes = append(notes, "AML: Consider filing Suspicious Activity Report (SAR) if fraud is confirmed")
	}

	// Document retention
	notes = append(notes, "Retain all fraud assessment records for minimum 7 years per regulatory requirements")

	return notes
}

// GenerateSignals converts features to fraud signals for the response
func (fe *FraudExplainer) GenerateSignals(features map[string]float64, importance map[string]float64) []models.FraudSignal {
	signals := make([]models.FraudSignal, 0)

	signalCategories := map[string]string{
		"device_":     "Device",
		"location_":   "Location",
		"behavior_":   "Behavior",
		"velocity_":   "Velocity",
		"network_":    "Network",
		"document_":   "Document",
		"claim_":      "Claim",
		"policy_":     "Policy",
		"agent_":      "Agent",
		"historical_": "Historical",
	}

	for name, value := range features {
		if value == 0 {
			continue
		}

		category := "Other"
		for prefix, cat := range signalCategories {
			if len(name) > len(prefix) && name[:len(prefix)] == prefix {
				category = cat
				break
			}
		}

		imp := importance[name]
		isAnomaly := imp > 0.5 || value > 0.9

		signals = append(signals, models.FraudSignal{
			SignalID:     name,
			Category:     category,
			Name:         name,
			Description:  fe.featureToExplanation(name, value),
			Value:        value,
			Weight:       imp,
			Contribution: imp * value,
			IsAnomaly:    isAnomaly,
		})
	}

	// Sort by contribution
	sort.Slice(signals, func(i, j int) bool {
		return signals[i].Contribution > signals[j].Contribution
	})

	// Return top 20 signals
	if len(signals) > 20 {
		signals = signals[:20]
	}

	return signals
}

// GenerateRiskFactors generates risk factors from the analysis
func (fe *FraudExplainer) GenerateRiskFactors(prediction *ml.Prediction, ruleResults []rules.RuleEvaluationResult) []models.RiskFactor {
	factors := make([]models.RiskFactor, 0)

	// Add factors from matched rules
	for _, result := range ruleResults {
		if result.Matched {
			impact := "medium"
			if result.Severity == "critical" || result.Severity == "high" {
				impact = "high"
			}

			factors = append(factors, models.RiskFactor{
				FactorID:    result.RuleID,
				Name:        result.RuleName,
				Category:    "Rule",
				Description: result.Description,
				Impact:      impact,
				Score:       0.8,
				Evidence:    fmt.Sprintf("Rule %s triggered", result.RuleID),
			})
		}
	}

	// Add factors from ML model
	if prediction.Score > 0.7 {
		factors = append(factors, models.RiskFactor{
			FactorID:    "ml_high_score",
			Name:        "High ML Fraud Score",
			Category:    "ML Model",
			Description: "Machine learning model detected high fraud probability",
			Impact:      "high",
			Score:       prediction.Score,
			Evidence:    fmt.Sprintf("ML score: %.2f%%", prediction.Score*100),
		})
	}

	return factors
}
