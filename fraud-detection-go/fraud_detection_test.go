package frauddetection

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
)

func TestDetectFraud_HighRisk(t *testing.T) {
	// Create mock database
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	// Setup expectations for claim frequency query
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) as claim_count").
		WithArgs("POL-123").
		WillReturnRows(sqlmock.NewRows([]string{"claim_count"}).AddRow(5))

	// Setup expectations for beneficiary history query
	mock.ExpectQuery("SELECT COUNT\\(DISTINCT c.policy_id\\)").
		WithArgs("BEN-001").
		WillReturnRows(sqlmock.NewRows([]string{"policy_count", "total_claims"}).AddRow(4, 6))

	service := NewFraudDetectionService(db)

	req := FraudDetectionRequest{
		ClaimID:  "CLM-001",
		PolicyID: "POL-123",
		ClaimDetails: map[string]interface{}{
			"claim_amount":      9500.00,  // 95% of sum assured
			"sum_assured":       10000.00,
			"policy_start_date": "2026-01-20T00:00:00Z",
			"claim_date":        "2026-01-25T00:00:00Z", // 5 days after policy start
			"claim_type":        "motor_accident",
			"documents_submitted": []string{"photos"}, // Missing required docs
			"beneficiary_id":    "BEN-001",
		},
	}

	result, err := service.DetectFraud(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Verify fraud score calculation
	// Expected: 30 (claim amount) + 25 (frequency) + 20 (timing) + 15 (docs) + 10 (beneficiary) = 100
	assert.GreaterOrEqual(t, result.FraudScore, 70, "Should be high risk")
	assert.Equal(t, "HIGH", result.RiskLevel)
	assert.Equal(t, "REJECT", result.Recommendation)
	assert.Greater(t, len(result.Flags), 0, "Should have fraud flags")

	// Verify all expectations were met
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestDetectFraud_MediumRisk(t *testing.T) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	// Setup expectations
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) as claim_count").
		WithArgs("POL-456").
		WillReturnRows(sqlmock.NewRows([]string{"claim_count"}).AddRow(3))

	mock.ExpectQuery("SELECT COUNT\\(DISTINCT c.policy_id\\)").
		WithArgs("BEN-002").
		WillReturnRows(sqlmock.NewRows([]string{"policy_count", "total_claims"}).AddRow(2, 3))

	service := NewFraudDetectionService(db)

	req := FraudDetectionRequest{
		ClaimID:  "CLM-002",
		PolicyID: "POL-456",
		ClaimDetails: map[string]interface{}{
			"claim_amount":      4500.00, // 45% of sum assured
			"sum_assured":       10000.00,
			"policy_start_date": "2025-12-01T00:00:00Z",
			"claim_date":        "2026-01-15T00:00:00Z", // 45 days after policy start
			"claim_type":        "medical",
			"documents_submitted": []string{"medical_report", "receipts"},
			"beneficiary_id":    "BEN-002",
		},
	}

	result, err := service.DetectFraud(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Expected: 15 (frequency) + 10 (timing) + 10 (docs) = 35-45 range
	assert.GreaterOrEqual(t, result.FraudScore, 20)
	assert.Less(t, result.FraudScore, 70)
	assert.Equal(t, "MEDIUM", result.RiskLevel)
	assert.Equal(t, "MANUAL_REVIEW", result.Recommendation)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestDetectFraud_LowRisk(t *testing.T) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)
	defer db.Close()

	// Setup expectations
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) as claim_count").
		WithArgs("POL-789").
		WillReturnRows(sqlmock.NewRows([]string{"claim_count"}).AddRow(1))

	mock.ExpectQuery("SELECT COUNT\\(DISTINCT c.policy_id\\)").
		WithArgs("BEN-003").
		WillReturnRows(sqlmock.NewRows([]string{"policy_count", "total_claims"}).AddRow(1, 1))

	service := NewFraudDetectionService(db)

	req := FraudDetectionRequest{
		ClaimID:  "CLM-003",
		PolicyID: "POL-789",
		ClaimDetails: map[string]interface{}{
			"claim_amount":      2000.00, // 20% of sum assured
			"sum_assured":       10000.00,
			"policy_start_date": "2025-06-01T00:00:00Z",
			"claim_date":        "2026-01-15T00:00:00Z", // 7+ months after policy start
			"claim_type":        "motor_accident",
			"documents_submitted": []string{"police_report", "repair_estimate", "photos", "driver_statement"},
			"beneficiary_id":    "BEN-003",
		},
	}

	result, err := service.DetectFraud(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Expected: 0 points (all checks pass)
	assert.Less(t, result.FraudScore, 40)
	assert.Contains(t, []string{"MINIMAL", "LOW"}, result.RiskLevel)
	assert.Contains(t, []string{"APPROVE", "APPROVE_WITH_CAUTION"}, result.Recommendation)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCheckClaimAmountVsSumAssured(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	service := NewFraudDetectionService(db)

	tests := []struct {
		name           string
		claimAmount    float64
		sumAssured     float64
		expectedPoints int
		expectFlag     bool
	}{
		{
			name:           "Claim at 95% of sum assured",
			claimAmount:    9500.00,
			sumAssured:     10000.00,
			expectedPoints: 30,
			expectFlag:     true,
		},
		{
			name:           "Claim exceeds sum assured",
			claimAmount:    11000.00,
			sumAssured:     10000.00,
			expectedPoints: 40, // 30 + 10 extra
			expectFlag:     true,
		},
		{
			name:           "Claim at 50% of sum assured",
			claimAmount:    5000.00,
			sumAssured:     10000.00,
			expectedPoints: 0,
			expectFlag:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := FraudDetectionRequest{
				ClaimDetails: map[string]interface{}{
					"claim_amount": tt.claimAmount,
					"sum_assured":  tt.sumAssured,
				},
			}

			result := &FraudDetectionResult{
				Flags:   []string{},
				Details: make(map[string]interface{}),
			}

			err := service.checkClaimAmountVsSumAssured(context.Background(), req, result)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedPoints, result.FraudScore)

			if tt.expectFlag {
				assert.Greater(t, len(result.Flags), 0)
			} else {
				assert.Equal(t, 0, len(result.Flags))
			}
		})
	}
}

func TestCheckClaimTiming(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	service := NewFraudDetectionService(db)

	policyStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name           string
		daysAfterStart int
		expectedPoints int
	}{
		{
			name:           "Claim after 5 days",
			daysAfterStart: 5,
			expectedPoints: 20,
		},
		{
			name:           "Claim after 20 days",
			daysAfterStart: 20,
			expectedPoints: 15,
		},
		{
			name:           "Claim after 60 days",
			daysAfterStart: 60,
			expectedPoints: 10,
		},
		{
			name:           "Claim after 120 days",
			daysAfterStart: 120,
			expectedPoints: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claimDate := policyStart.AddDate(0, 0, tt.daysAfterStart)

			req := FraudDetectionRequest{
				ClaimDetails: map[string]interface{}{
					"policy_start_date": policyStart.Format(time.RFC3339),
					"claim_date":        claimDate.Format(time.RFC3339),
				},
			}

			result := &FraudDetectionResult{
				Flags:   []string{},
				Details: make(map[string]interface{}),
			}

			err := service.checkClaimTiming(context.Background(), req, result)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedPoints, result.FraudScore)
		})
	}
}

func TestGetRequiredDocuments(t *testing.T) {
	tests := []struct {
		claimType string
		expected  []string
	}{
		{
			claimType: "motor_accident",
			expected:  []string{"police_report", "repair_estimate", "photos", "driver_statement"},
		},
		{
			claimType: "medical",
			expected:  []string{"medical_report", "receipts", "prescriptions", "doctor_statement"},
		},
		{
			claimType: "fire",
			expected:  []string{"fire_service_report", "police_report", "photos", "inventory_list"},
		},
		{
			claimType: "death",
			expected:  []string{"death_certificate", "medical_report", "police_report", "beneficiary_id"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.claimType, func(t *testing.T) {
			docs := getRequiredDocuments(tt.claimType)
			assert.Equal(t, tt.expected, docs)
		})
	}
}

func TestDetermineRiskLevel(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	service := NewFraudDetectionService(db)

	tests := []struct {
		score              int
		expectedRisk       string
		expectedRecommend  string
	}{
		{score: 90, expectedRisk: "HIGH", expectedRecommend: "REJECT"},
		{score: 70, expectedRisk: "HIGH", expectedRecommend: "REJECT"},
		{score: 50, expectedRisk: "MEDIUM", expectedRecommend: "MANUAL_REVIEW"},
		{score: 40, expectedRisk: "MEDIUM", expectedRecommend: "MANUAL_REVIEW"},
		{score: 30, expectedRisk: "LOW", expectedRecommend: "APPROVE_WITH_CAUTION"},
		{score: 20, expectedRisk: "LOW", expectedRecommend: "APPROVE_WITH_CAUTION"},
		{score: 10, expectedRisk: "MINIMAL", expectedRecommend: "APPROVE"},
		{score: 0, expectedRisk: "MINIMAL", expectedRecommend: "APPROVE"},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("Score_%d", tt.score), func(t *testing.T) {
			result := &FraudDetectionResult{
				FraudScore: tt.score,
			}

			service.determineRiskLevel(result)

			assert.Equal(t, tt.expectedRisk, result.RiskLevel)
			assert.Equal(t, tt.expectedRecommend, result.Recommendation)
		})
	}
}
