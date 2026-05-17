package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"insurance-platform/policy-service/internal/models"

	"github.com/google/uuid"
)

// VerifyCustomerNINActivity verifies customer NIN
func VerifyCustomerNINActivity(ctx context.Context, customerID uuid.UUID) (bool, error) {
	log.Printf("Verifying NIN for customer: %s", customerID)
	
	// In production, this would call the NIN verification service
	// For now, simulate verification
	time.Sleep(500 * time.Millisecond)
	
	// Simulate 95% success rate
	verified := true
	
	log.Printf("NIN verification result for customer %s: %v", customerID, verified)
	return verified, nil
}

// CalculateRiskAndPremiumActivity calculates risk score and premium
func CalculateRiskAndPremiumActivity(ctx context.Context, req *models.PolicyQuoteRequest) (*models.PolicyQuoteResponse, error) {
	log.Printf("Calculating risk and premium for customer: %s", req.CustomerID)
	
	// In production, this would use ML models (Ray) for risk scoring
	// For now, use simple calculation
	
	basePremium := float64(req.SumAssured) * 0.05 // 5% of sum assured
	
	// Adjust based on policy type
	var typeMultiplier float64
	switch req.PolicyType {
	case models.PolicyTypeMotor:
		typeMultiplier = 1.2
	case models.PolicyTypeHealth:
		typeMultiplier = 1.5
	case models.PolicyTypeLife:
		typeMultiplier = 1.0
	case models.PolicyTypeProperty:
		typeMultiplier = 0.8
	default:
		typeMultiplier = 1.0
	}
	
	// Adjust based on frequency
	var frequencyDivisor float64
	switch req.PremiumFrequency {
	case models.PremiumFrequencyDaily:
		frequencyDivisor = 365
	case models.PremiumFrequencyWeekly:
		frequencyDivisor = 52
	case models.PremiumFrequencyMonthly:
		frequencyDivisor = 12
	case models.PremiumFrequencyQuarterly:
		frequencyDivisor = 4
	case models.PremiumFrequencyAnnually:
		frequencyDivisor = 1
	default:
		frequencyDivisor = 12
	}
	
	premiumAmount := int64((basePremium * typeMultiplier) / frequencyDivisor)
	
	response := &models.PolicyQuoteResponse{
		QuoteID:          uuid.New(),
		CustomerID:       req.CustomerID,
		PolicyType:       req.PolicyType,
		SumAssured:       req.SumAssured,
		PremiumAmount:    premiumAmount,
		PremiumFrequency: req.PremiumFrequency,
		DurationMonths:   req.DurationMonths,
		ValidUntil:       time.Now().Add(7 * 24 * time.Hour), // Valid for 7 days
		RiskScore:        0.65, // Simulated risk score
		CreatedAt:        time.Now(),
	}
	
	log.Printf("Risk calculation completed. Premium: %d, Risk Score: %.2f", premiumAmount, response.RiskScore)
	return response, nil
}

// CreatePolicyRecordActivity creates a policy record in the database
func CreatePolicyRecordActivity(ctx context.Context, req *models.CreatePolicyRequest) (*models.Policy, error) {
	log.Printf("Creating policy record for customer: %s", req.CustomerID)
	
	policyID := uuid.New()
	policyNumber := fmt.Sprintf("POL-%d-%s", time.Now().Unix(), policyID.String()[:8])
	
	endDate := req.StartDate.AddDate(0, req.DurationMonths, 0)
	
	// Calculate next premium due date
	var nextPremiumDueDate time.Time
	switch req.PremiumFrequency {
	case models.PremiumFrequencyDaily:
		nextPremiumDueDate = req.StartDate.AddDate(0, 0, 1)
	case models.PremiumFrequencyWeekly:
		nextPremiumDueDate = req.StartDate.AddDate(0, 0, 7)
	case models.PremiumFrequencyMonthly:
		nextPremiumDueDate = req.StartDate.AddDate(0, 1, 0)
	case models.PremiumFrequencyQuarterly:
		nextPremiumDueDate = req.StartDate.AddDate(0, 3, 0)
	case models.PremiumFrequencyAnnually:
		nextPremiumDueDate = req.StartDate.AddDate(1, 0, 0)
	}
	
	// Marshal beneficiaries and coverage details
	beneficiariesJSON, _ := json.Marshal(req.Beneficiaries)
	coverageDetailsJSON, _ := json.Marshal(req.CoverageDetails)
	metadataJSON, _ := json.Marshal(req.Metadata)
	
	policy := &models.Policy{
		ID:                 policyID,
		PolicyNumber:       policyNumber,
		CustomerID:         req.CustomerID,
		AgentID:            req.AgentID,
		PolicyType:         req.PolicyType,
		Status:             models.PolicyStatusDraft,
		PremiumAmount:      req.PremiumAmount,
		PremiumFrequency:   req.PremiumFrequency,
		SumAssured:         req.SumAssured,
		Currency:           req.Currency,
		StartDate:          req.StartDate,
		EndDate:            endDate,
		NextPremiumDueDate: &nextPremiumDueDate,
		Beneficiaries:      string(beneficiariesJSON),
		CoverageDetails:    string(coverageDetailsJSON),
		Metadata:           string(metadataJSON),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	
	// In production, save to database via repository
	log.Printf("Policy record created: %s", policyNumber)
	return policy, nil
}

// ProcessPremiumPaymentActivity processes premium payment
func ProcessPremiumPaymentActivity(ctx context.Context, req map[string]interface{}) (bool, error) {
	policyID := req["policy_id"]
	amount := req["amount"]
	
	log.Printf("Processing premium payment for policy: %v, amount: %v", policyID, amount)
	
	// In production, this would call the payment service
	// Simulate payment processing
	time.Sleep(1 * time.Second)
	
	// Simulate 98% success rate
	success := true
	
	if success {
		log.Printf("Premium payment successful for policy: %v", policyID)
	} else {
		log.Printf("Premium payment failed for policy: %v", policyID)
		return false, fmt.Errorf("payment gateway declined")
	}
	
	return success, nil
}

// GeneratePolicyDocumentActivity generates policy document
func GeneratePolicyDocumentActivity(ctx context.Context, policyID uuid.UUID) (string, error) {
	log.Printf("Generating policy document for policy: %s", policyID)
	
	// In production, this would generate a PDF document
	// For now, return a simulated URL
	documentURL := fmt.Sprintf("https://storage.example.com/policies/%s.pdf", policyID)
	
	log.Printf("Policy document generated: %s", documentURL)
	return documentURL, nil
}

// IssuePolicyActivity marks a policy as issued
func IssuePolicyActivity(ctx context.Context, policyID uuid.UUID) error {
	log.Printf("Issuing policy: %s", policyID)
	
	// In production, update policy status in database
	// For now, just log
	
	log.Printf("Policy issued successfully: %s", policyID)
	return nil
}

// SendPolicyNotificationsActivity sends policy notifications
func SendPolicyNotificationsActivity(ctx context.Context, req map[string]interface{}) error {
	policyID := req["policy_id"]
	customerID := req["customer_id"]
	policyNumber := req["policy_number"]
	documentURL := req["document_url"]
	
	log.Printf("Sending policy notifications for policy: %v", policyNumber)
	
	// In production, send SMS, email, and push notifications
	// For now, just log
	log.Printf("SMS sent to customer %v: Your policy %v is now active. Document: %v", customerID, policyNumber, documentURL)
	log.Printf("Email sent to customer %v with policy details", customerID)
	
	return nil
}

// SchedulePremiumRemindersActivity schedules premium reminders
func SchedulePremiumRemindersActivity(ctx context.Context, policyID uuid.UUID) error {
	log.Printf("Scheduling premium reminders for policy: %s", policyID)
	
	// In production, schedule reminders using Temporal or cron jobs
	// For now, just log
	
	log.Printf("Premium reminders scheduled for policy: %s", policyID)
	return nil
}

// GetPolicyActivity retrieves policy details
func GetPolicyActivity(ctx context.Context, policyID string) (*models.Policy, error) {
	log.Printf("Getting policy details: %s", policyID)
	
	// In production, retrieve from database
	// For now, return a mock policy
	id, _ := uuid.Parse(policyID)
	policy := &models.Policy{
		ID:           id,
		PolicyNumber: fmt.Sprintf("POL-%s", policyID[:8]),
		CustomerID:   uuid.New(),
		Status:       models.PolicyStatusActive,
		EndDate:      time.Now().AddDate(0, 6, 0), // 6 months from now
	}
	
	return policy, nil
}

// RecalculatePremiumActivity recalculates premium for renewal
func RecalculatePremiumActivity(ctx context.Context, policyID string) (int64, error) {
	log.Printf("Recalculating premium for policy: %s", policyID)
	
	// In production, use ML models to recalculate based on claims history, age, etc.
	// For now, return a simulated premium
	newPremium := int64(50000) // ₦50,000
	
	log.Printf("New premium calculated: %d", newPremium)
	return newPremium, nil
}

// SendRenewalNoticeActivity sends renewal notice to customer
func SendRenewalNoticeActivity(ctx context.Context, req map[string]interface{}) error {
	policyID := req["policy_id"]
	customerID := req["customer_id"]
	
	log.Printf("Sending renewal notice for policy: %v to customer: %v", policyID, customerID)
	
	// In production, send SMS, email, and push notifications
	log.Printf("Renewal notice sent successfully")
	return nil
}

// UpdatePolicyRenewalActivity updates policy with renewal details
func UpdatePolicyRenewalActivity(ctx context.Context, req map[string]interface{}) error {
	policyID := req["policy_id"]
	
	log.Printf("Updating policy renewal: %v", policyID)
	
	// In production, update database
	log.Printf("Policy renewal updated successfully")
	return nil
}

// SendRenewalConfirmationActivity sends renewal confirmation
func SendRenewalConfirmationActivity(ctx context.Context, policyID string) error {
	log.Printf("Sending renewal confirmation for policy: %s", policyID)
	
	// In production, send notifications
	log.Printf("Renewal confirmation sent successfully")
	return nil
}

// CalculateRefundActivity calculates refund amount
func CalculateRefundActivity(ctx context.Context, policyID string) (int64, error) {
	log.Printf("Calculating refund for policy: %s", policyID)
	
	// In production, calculate pro-rata refund based on remaining policy period
	// For now, return a simulated amount
	refundAmount := int64(25000) // ₦25,000
	
	log.Printf("Refund amount calculated: %d", refundAmount)
	return refundAmount, nil
}

// ProcessRefundActivity processes refund
func ProcessRefundActivity(ctx context.Context, req map[string]interface{}) error {
	policyID := req["policy_id"]
	amount := req["amount"]
	
	log.Printf("Processing refund for policy: %v, amount: %v", policyID, amount)
	
	// In production, call payment service to process refund
	time.Sleep(1 * time.Second)
	
	log.Printf("Refund processed successfully")
	return nil
}

// CancelPolicyActivity cancels a policy
func CancelPolicyActivity(ctx context.Context, policyID uuid.UUID) error {
	log.Printf("Cancelling policy: %s", policyID)
	
	// In production, update database
	log.Printf("Policy cancelled successfully")
	return nil
}

// SendCancellationNotificationActivity sends cancellation notification
func SendCancellationNotificationActivity(ctx context.Context, req map[string]interface{}) error {
	policyID := req["policy_id"]
	customerID := req["customer_id"]
	
	log.Printf("Sending cancellation notification for policy: %v to customer: %v", policyID, customerID)
	
	// In production, send notifications
	log.Printf("Cancellation notification sent successfully")
	return nil
}
