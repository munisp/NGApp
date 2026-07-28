package frauddetection

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// FraudDetectionRequest represents the input for fraud detection
type FraudDetectionRequest struct {
	ClaimID      string                 `json:"claim_id"`
	PolicyID     string                 `json:"policy_id"`
	ClaimDetails map[string]interface{} `json:"claim_details"`
}

// FraudDetectionResult represents the output of fraud detection
type FraudDetectionResult struct {
	FraudScore     int      `json:"fraud_score"`
	RiskLevel      string   `json:"risk_level"`
	Flags          []string `json:"flags"`
	Recommendation string   `json:"recommendation"`
	Details        map[string]interface{} `json:"details"`
}

// FraudDetectionService handles fraud detection logic
type FraudDetectionService struct {
	db *sql.DB
}

// NewFraudDetectionService creates a new fraud detection service
func NewFraudDetectionService(db *sql.DB) *FraudDetectionService {
	return &FraudDetectionService{
		db: db,
	}
}

// DetectFraud performs comprehensive fraud detection on a claim
func (s *FraudDetectionService) DetectFraud(ctx context.Context, req FraudDetectionRequest) (*FraudDetectionResult, error) {
	result := &FraudDetectionResult{
		FraudScore: 0,
		Flags:      []string{},
		Details:    make(map[string]interface{}),
	}

	// Rule 1: Check claim amount vs sum assured (30 points)
	if err := s.checkClaimAmountVsSumAssured(ctx, req, result); err != nil {
		return nil, fmt.Errorf("failed to check claim amount: %w", err)
	}

	// Rule 2: Check claim frequency (25 points)
	if err := s.checkClaimFrequency(ctx, req, result); err != nil {
		return nil, fmt.Errorf("failed to check claim frequency: %w", err)
	}

	// Rule 3: Check claim timing (20 points)
	if err := s.checkClaimTiming(ctx, req, result); err != nil {
		return nil, fmt.Errorf("failed to check claim timing: %w", err)
	}

	// Rule 4: Check for missing documents (15 points)
	if err := s.checkMissingDocuments(ctx, req, result); err != nil {
		return nil, fmt.Errorf("failed to check documents: %w", err)
	}

	// Rule 5: Check beneficiary history (10 points)
	if err := s.checkBeneficiaryHistory(ctx, req, result); err != nil {
		return nil, fmt.Errorf("failed to check beneficiary history: %w", err)
	}

	// Determine risk level and recommendation based on fraud score
	s.determineRiskLevel(result)

	return result, nil
}

// Rule 1: Check if claim amount is close to or exceeds sum assured
// High claim amounts relative to sum assured can indicate fraud
// Weight: 30 points
func (s *FraudDetectionService) checkClaimAmountVsSumAssured(
	ctx context.Context,
	req FraudDetectionRequest,
	result *FraudDetectionResult,
) error {
	claimAmount, ok1 := req.ClaimDetails["claim_amount"].(float64)
	sumAssured, ok2 := req.ClaimDetails["sum_assured"].(float64)

	if !ok1 || !ok2 {
		// If data is missing, skip this rule
		return nil
	}

	// Calculate ratio
	ratio := claimAmount / sumAssured

	result.Details["claim_to_sum_assured_ratio"] = ratio

	// If claim amount is >= 90% of sum assured, add 30 points
	if ratio >= 0.9 {
		result.FraudScore += 30
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Claim amount (₦%.2f) is %.1f%% of sum assured (₦%.2f)",
			claimAmount, ratio*100, sumAssured,
		))
	}

	// Additional scoring for extremely high ratios
	if ratio > 1.0 {
		result.FraudScore += 10 // Extra 10 points for exceeding sum assured
		result.Flags = append(result.Flags, "Claim amount exceeds sum assured")
	}

	return nil
}

// Rule 2: Check claim frequency
// Multiple claims in a short period can indicate fraud
// Weight: 25 points
func (s *FraudDetectionService) checkClaimFrequency(
	ctx context.Context,
	req FraudDetectionRequest,
	result *FraudDetectionResult,
) error {
	query := `
		SELECT COUNT(*) as claim_count
		FROM claims
		WHERE policy_id = $1
		AND created_at > NOW() - INTERVAL '6 months'
		AND status != 'REJECTED'
	`

	var claimCount int
	err := s.db.QueryRowContext(ctx, query, req.PolicyID).Scan(&claimCount)
	if err != nil {
		return fmt.Errorf("failed to query claim frequency: %w", err)
	}

	result.Details["claims_last_6_months"] = claimCount

	// Scoring based on claim frequency
	if claimCount > 4 {
		// More than 4 claims in 6 months: 25 points
		result.FraudScore += 25
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Excessive claim frequency: %d claims in last 6 months",
			claimCount,
		))
	} else if claimCount > 2 {
		// 3-4 claims in 6 months: 15 points
		result.FraudScore += 15
		result.Flags = append(result.Flags, fmt.Sprintf(
			"High claim frequency: %d claims in last 6 months",
			claimCount,
		))
	}

	return nil
}

// Rule 3: Check claim timing
// Claims filed shortly after policy start can indicate fraud
// Weight: 20 points
func (s *FraudDetectionService) checkClaimTiming(
	ctx context.Context,
	req FraudDetectionRequest,
	result *FraudDetectionResult,
) error {
	policyStartDateStr, ok1 := req.ClaimDetails["policy_start_date"].(string)
	claimDateStr, ok2 := req.ClaimDetails["claim_date"].(string)

	if !ok1 || !ok2 {
		// If data is missing, skip this rule
		return nil
	}

	policyStartDate, err := time.Parse(time.RFC3339, policyStartDateStr)
	if err != nil {
		return fmt.Errorf("failed to parse policy start date: %w", err)
	}

	claimDate, err := time.Parse(time.RFC3339, claimDateStr)
	if err != nil {
		return fmt.Errorf("failed to parse claim date: %w", err)
	}

	daysDiff := int(claimDate.Sub(policyStartDate).Hours() / 24)

	result.Details["days_since_policy_start"] = daysDiff

	// Scoring based on timing
	if daysDiff < 7 {
		// Claim within first week: 20 points
		result.FraudScore += 20
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Claim filed within %d days of policy start (very early)",
			daysDiff,
		))
	} else if daysDiff < 30 {
		// Claim within first month: 15 points
		result.FraudScore += 15
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Claim filed within %d days of policy start (early)",
			daysDiff,
		))
	} else if daysDiff < 90 {
		// Claim within first 3 months: 10 points
		result.FraudScore += 10
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Claim filed within %d days of policy start",
			daysDiff,
		))
	}

	return nil
}

// Rule 4: Check for missing documents
// Missing required documents can indicate incomplete or fraudulent claims
// Weight: 15 points
func (s *FraudDetectionService) checkMissingDocuments(
	ctx context.Context,
	req FraudDetectionRequest,
	result *FraudDetectionResult,
) error {
	documentsSubmittedRaw, ok := req.ClaimDetails["documents_submitted"]
	if !ok {
		// If no document info provided, skip this rule
		return nil
	}

	// Convert to string slice
	var documentsSubmitted []string
	switch v := documentsSubmittedRaw.(type) {
	case []interface{}:
		for _, doc := range v {
			if docStr, ok := doc.(string); ok {
				documentsSubmitted = append(documentsSubmitted, docStr)
			}
		}
	case []string:
		documentsSubmitted = v
	default:
		return nil
	}

	// Define required documents based on claim type
	claimType, _ := req.ClaimDetails["claim_type"].(string)
	requiredDocs := getRequiredDocuments(claimType)

	// Convert to sets for comparison
	submittedSet := make(map[string]bool)
	for _, doc := range documentsSubmitted {
		submittedSet[doc] = true
	}

	// Find missing documents
	var missingDocs []string
	for _, reqDoc := range requiredDocs {
		if !submittedSet[reqDoc] {
			missingDocs = append(missingDocs, reqDoc)
		}
	}

	result.Details["documents_submitted"] = len(documentsSubmitted)
	result.Details["documents_required"] = len(requiredDocs)
	result.Details["missing_documents"] = missingDocs

	// Scoring based on missing documents
	if len(missingDocs) > 0 {
		// 5 points per missing document, up to 15 points
		points := len(missingDocs) * 5
		if points > 15 {
			points = 15
		}
		result.FraudScore += points
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Missing %d required documents: %v",
			len(missingDocs), missingDocs,
		))
	}

	return nil
}

// Rule 5: Check beneficiary history
// Beneficiaries with multiple claims across different policies can indicate fraud rings
// Weight: 10 points
func (s *FraudDetectionService) checkBeneficiaryHistory(
	ctx context.Context,
	req FraudDetectionRequest,
	result *FraudDetectionResult,
) error {
	beneficiaryID, ok := req.ClaimDetails["beneficiary_id"].(string)
	if !ok {
		// If no beneficiary ID provided, skip this rule
		return nil
	}

	query := `
		SELECT COUNT(DISTINCT c.policy_id) as policy_count,
		       COUNT(*) as total_claims
		FROM claims c
		WHERE c.beneficiary_id = $1
		AND c.created_at > NOW() - INTERVAL '1 year'
	`

	var policyCount, totalClaims int
	err := s.db.QueryRowContext(ctx, query, beneficiaryID).Scan(&policyCount, &totalClaims)
	if err != nil {
		return fmt.Errorf("failed to query beneficiary history: %w", err)
	}

	result.Details["beneficiary_policy_count"] = policyCount
	result.Details["beneficiary_total_claims"] = totalClaims

	// Scoring based on beneficiary history
	if policyCount > 3 {
		// Claims across multiple policies: 10 points
		result.FraudScore += 10
		result.Flags = append(result.Flags, fmt.Sprintf(
			"Beneficiary has claims across %d different policies",
			policyCount,
		))
	}

	return nil
}

// determineRiskLevel sets the risk level and recommendation based on fraud score
func (s *FraudDetectionService) determineRiskLevel(result *FraudDetectionResult) {
	score := result.FraudScore

	if score >= 70 {
		result.RiskLevel = "HIGH"
		result.Recommendation = "REJECT"
	} else if score >= 40 {
		result.RiskLevel = "MEDIUM"
		result.Recommendation = "MANUAL_REVIEW"
	} else if score >= 20 {
		result.RiskLevel = "LOW"
		result.Recommendation = "APPROVE_WITH_CAUTION"
	} else {
		result.RiskLevel = "MINIMAL"
		result.Recommendation = "APPROVE"
	}
}

// getRequiredDocuments returns the list of required documents based on claim type
func getRequiredDocuments(claimType string) []string {
	switch claimType {
	case "motor_accident":
		return []string{"police_report", "repair_estimate", "photos", "driver_statement"}
	case "medical":
		return []string{"medical_report", "receipts", "prescriptions", "doctor_statement"}
	case "fire":
		return []string{"fire_service_report", "police_report", "photos", "inventory_list"}
	case "theft":
		return []string{"police_report", "stolen_items_list", "photos", "witness_statements"}
	case "death":
		return []string{"death_certificate", "medical_report", "police_report", "beneficiary_id"}
	default:
		return []string{"police_report", "supporting_documents", "photos"}
	}
}

// ToJSON converts the fraud detection result to JSON
func (r *FraudDetectionResult) ToJSON() (string, error) {
	bytes, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
