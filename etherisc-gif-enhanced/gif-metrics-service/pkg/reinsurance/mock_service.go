package reinsurance

import (
	"math/rand"
	"time"

	"gif-metrics-service/internal/metrics"
)

// MockService simulates reinsurance operations and updates metrics.
type MockService struct {
	metrics *metrics.Metrics
	// Mock state data
	treatyCount int
}

// NewMockService creates a new mock reinsurance service.
func NewMockService(m *metrics.Metrics) *MockService {
	rand.Seed(time.Now().UnixNano())
	return &MockService{
		metrics: m,
		treatyCount: 3,
	}
}

// SimulateActivity simulates various reinsurance events and updates the corresponding metrics.
func (s *MockService) SimulateActivity() {
	// Simulate Ceded Premiums
	treatyID := []string{"TREATY_A", "TREATY_B", "TREATY_C"}[rand.Intn(3)]
	cededAmount := rand.Float64() * 1000
	s.metrics.ReinsuranceCededPremiumsTotal.WithLabelValues(treatyID).Add(cededAmount)
	s.metrics.ReinsuranceCededPremiumsLast.Set(cededAmount)

	// Simulate Reinsurer Payouts and Collections
	reinsurerID := []string{"RE_1", "RE_2"}[rand.Intn(2)]
	if rand.Float64() < 0.5 {
		s.metrics.ReinsurerPayoutsTotal.WithLabelValues(reinsurerID).Inc()
	} else {
		s.metrics.ReinsurerCollectionsTotal.WithLabelValues(reinsurerID).Inc()
	}

	// Simulate Claim Ceded
	if rand.Float64() < 0.1 {
		s.metrics.ReinsuranceClaimCededTotal.Inc()
		s.metrics.ReinsuranceClaimCededAmount.Add(rand.Float64() * 5000)
	}
}

// UpdateStateGauges updates gauges that reflect the current state of the system.
func (s *MockService) UpdateStateGauges() {
	// Update Treaty Count
	s.metrics.ReinsuranceTreatyCount.Set(float64(s.treatyCount))

	// Update Treaty Utilization and Capacity
	treaties := []string{"TREATY_A", "TREATY_B", "TREATY_C"}
	for _, treaty := range treaties {
		utilization := rand.Float64()
		capacity := rand.Float64() * 1000000
		s.metrics.ReinsuranceTreatyUtilization.WithLabelValues(treaty).Set(utilization)
		s.metrics.ReinsuranceTreatyCapacityRem.WithLabelValues(treaty).Set(capacity)
	}

	// Update Reinsurer Balances
	reinsurers := []string{"RE_1", "RE_2"}
	for _, reinsurer := range reinsurers {
		balance := rand.Float64() * 50000
		s.metrics.ReinsurerBalanceEth.WithLabelValues(reinsurer).Set(balance)
	}

	// Update Service Health
	s.metrics.ReinsuranceServiceUp.Set(1) // Always up for mock
}
