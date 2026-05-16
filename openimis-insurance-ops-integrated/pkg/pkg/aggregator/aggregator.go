package aggregator

import (
	"fmt"
	"sync"
	"time"

	"github.com/openimis/actuarial-data-transformer/config"
	"github.com/openimis/actuarial-data-transformer/pkg/models"
)

// Aggregator simulates the stateful aggregation logic of a Flink job.
type Aggregator struct {
	cfg *config.Config
	// State store for aggregations: Key is the aggregation period/group, Value is the aggregation data.
	// In a real Flink job, this would be a distributed state store.
	state map[string]*models.LossRatioAggregation
	mu    sync.RWMutex
}

// NewAggregator creates a new Aggregator instance.
func NewAggregator(cfg *config.Config) *Aggregator {
	return &Aggregator{
		cfg:   cfg,
		state: make(map[string]*models.LossRatioAggregation),
	}
}

// ProcessClaim updates the aggregation state with a new enriched claim.
func (a *Aggregator) ProcessClaim(claim *models.EnrichedClaim) []*models.LossRatioAggregation {
	a.mu.Lock()
	defer a.mu.Unlock()

	// We will aggregate on two dimensions: Daily and Monthly, grouped by Region and ProductCode.
	// This simulates the windowing and grouping of a Flink job.
	aggregations := make([]*models.LossRatioAggregation, 0, 4)

	// Daily Aggregation
	dailyAgg := a.updateAggregation(
		claim,
		a.cfg.Aggregation.DailyWindow,
		"daily",
		claim.ClaimEvent.ClaimDate,
		fmt.Sprintf("daily_%s_%s", claim.Region, claim.ProductCode),
	)
	if dailyAgg != nil {
		aggregations = append(aggregations, dailyAgg)
	}

	// Monthly Aggregation
	monthlyAgg := a.updateAggregation(
		claim,
		a.cfg.Aggregation.MonthlyWindow,
		"monthly",
		claim.ClaimEvent.ClaimDate,
		fmt.Sprintf("monthly_%s_%s", claim.Region, claim.ProductCode),
	)
	if monthlyAgg != nil {
		aggregations = append(aggregations, monthlyAgg)
	}

	// In a real system, we would also have a mechanism to "emit" the results
	// when the window closes (e.g., Flink's trigger system).
	// Here, we return the updated aggregations, which will be treated as the output.
	return aggregations
}

// updateAggregation handles the core logic for a single aggregation window.
func (a *Aggregator) updateAggregation(
	claim *models.EnrichedClaim,
	windowDuration time.Duration,
	prefix string,
	eventTime time.Time,
	keySuffix string,
) *models.LossRatioAggregation {
	// Determine the window start time (simplistic approach for simulation)
	// In a real Flink job, this would be more complex with watermarks.
	windowStart := eventTime.Truncate(windowDuration)
	windowEnd := windowStart.Add(windowDuration)

	// Create the unique key for the state store
	key := fmt.Sprintf("%s_%s_%s", prefix, windowStart.Format("20060102"), keySuffix)

	agg, exists := a.state[key]
	if !exists {
		agg = &models.LossRatioAggregation{
			PeriodStart: windowStart,
			PeriodEnd:   windowEnd,
			AggregationKey: key,
			RiskScoreDistribution: make(map[string]int),
		}
		a.state[key] = agg
	}

	// Update the aggregation metrics
	agg.TotalClaims += claim.ClaimAmount
	agg.TotalPremium += claim.PolicyPremium // Assuming policy premium is the denominator for loss ratio
	agg.LossRatio = agg.TotalClaims / agg.TotalPremium

	// Update Risk Score Distribution
	riskBucket := getRiskBucket(claim.InsureeRiskScore)
	agg.RiskScoreDistribution[riskBucket]++

	return agg
}

// getRiskBucket categorizes the risk score.
func getRiskBucket(score float64) string {
	if score < 0.33 {
		return "low"
	} else if score < 0.66 {
		return "medium"
	}
	return "high"
}

// GetState returns a copy of the current aggregation state.
func (a *Aggregator) GetState() map[string]*models.LossRatioAggregation {
	a.mu.RLock()
	defer a.mu.RUnlock()
	// Deep copy for safety in a real system, shallow copy for simulation
	stateCopy := make(map[string]*models.LossRatioAggregation, len(a.state))
	for k, v := range a.state {
		stateCopy[k] = v
	}
	return stateCopy
}
