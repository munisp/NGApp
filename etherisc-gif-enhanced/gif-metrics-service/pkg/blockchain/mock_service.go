package blockchain

import (
	"math/rand"
	"time"

	"gif-metrics-service/internal/metrics"
)

// MockService simulates blockchain operations and updates metrics.
type MockService struct {
	metrics *metrics.Metrics
	// Mock state data
	policyCount int
	pendingClaims int
}

// NewMockService creates a new mock blockchain service.
func NewMockService(m *metrics.Metrics) *MockService {
	rand.Seed(time.Now().UnixNano())
	return &MockService{
		metrics: m,
		policyCount: 1000,
		pendingClaims: 5,
	}
}

// SimulateActivity simulates various blockchain events and updates the corresponding metrics.
func (s *MockService) SimulateActivity() {
	// Simulate Policy Creation
	policyType := []string{"life", "health", "property"}[rand.Intn(3)]
	s.metrics.PolicyCreationTotal.WithLabelValues(policyType).Inc()
	if rand.Float64() < 0.95 {
		s.metrics.PolicyCreationSuccessTotal.Inc()
	} else {
		errorType := []string{"gas_limit", "invalid_param", "timeout"}[rand.Intn(3)]
		s.metrics.PolicyCreationFailureTotal.WithLabelValues(errorType).Inc()
	}

	// Simulate Claim Trigger
	claimType := []string{"payout", "rejection"}[rand.Intn(2)]
	s.metrics.ClaimTriggerTotal.WithLabelValues(claimType).Inc()
	if rand.Float64() < 0.98 {
		s.metrics.ClaimTriggerSuccessTotal.Inc()
		if claimType == "payout" && rand.Float64() < 0.7 {
			s.metrics.ClaimCountPaid.Inc()
			s.metrics.ClaimPayoutTotalEth.Add(rand.Float64() * 10) // Mock payout in ETH
		}
	} else {
		errorType := []string{"policy_not_found", "invalid_claim"}[rand.Intn(2)]
		s.metrics.ClaimTriggerFailureTotal.WithLabelValues(errorType).Inc()
	}

	// Simulate Oracle Submission
	oracleID := []string{"chainlink", "custom_api"}[rand.Intn(2)]
	s.metrics.OracleSubmissionTotal.WithLabelValues(oracleID).Inc()
	if rand.Float64() < 0.99 {
		s.metrics.OracleSubmissionSuccessTotal.Inc()
	} else {
		errorType := []string{"data_mismatch", "network_error"}[rand.Intn(2)]
		s.metrics.OracleSubmissionFailureTotal.WithLabelValues(errorType).Inc()
	}

	// Simulate Transaction
	txType := []string{"policy_create", "claim_settle", "oracle_submit"}[rand.Intn(3)]
	status := []string{"success", "reverted"}[rand.Intn(2)]
	s.metrics.TransactionTotal.WithLabelValues(txType, status).Inc()
	if status == "reverted" {
		reason := []string{"out_of_gas", "execution_revert"}[rand.Intn(2)]
		s.metrics.TransactionFailureTotal.WithLabelValues(txType, reason).Inc()
	}

	// Simulate Gas Cost
	gasCost := rand.Float64() * 1000000000000000 // 0.001 ETH in Wei
	s.metrics.GasCostTotalWei.Add(gasCost)
	s.metrics.GasCostLastTxWei.Set(gasCost)

	// Simulate Transaction Latency
	latency := rand.Float64() * 5 // up to 5 seconds
	s.metrics.TransactionLatencySeconds.WithLabelValues(txType).Observe(latency)

	// Simulate Contract Calls
	functionName := []string{"buyPolicy", "submitClaim", "updateOracle"}[rand.Intn(3)]
	s.metrics.ContractCallsTotal.WithLabelValues(functionName).Inc()
}

// UpdateStateGauges updates gauges that reflect the current state of the system.
func (s *MockService) UpdateStateGauges() {
	// Mock updates to state
	s.policyCount += rand.Intn(5) - 2 // +/- 2 policies
	if s.policyCount < 0 {
		s.policyCount = 0
	}
	s.pendingClaims += rand.Intn(3) - 1 // +/- 1 claim
	if s.pendingClaims < 0 {
		s.pendingClaims = 0
	}

	s.metrics.PendingTransactions.Set(float64(rand.Intn(10)))
	s.metrics.PolicyCount.Set(float64(s.policyCount))
	s.metrics.ClaimCountPending.Set(float64(s.pendingClaims))
}
