package reinsurance

import (
	"errors"
	"math"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
)

var (
	ErrInvalidNonProportionalTreatyType = errors.New("invalid treaty type for non-proportional calculation")
)

// CalculateNonProportionalCession calculates the ceded amount for a single loss event
// for non-proportional treaties (Excess of Loss and Stop Loss).
// For Stop Loss, it requires the current utilization to check against the aggregate limit.
func CalculateNonProportionalCession(treaty *models.Treaty, lossAmount float64, utilization *models.Utilization) (*CessionResult, error) {
	if lossAmount <= 0 {
		return nil, ErrInvalidAmount
	}

	switch treaty.TreatyType {
	case models.TreatyTypeExcessOfLoss:
		return calculateExcessOfLossCession(treaty, lossAmount)
	case models.TreatyTypeStopLoss:
		return calculateStopLossCession(treaty, lossAmount, utilization)
	default:
		return nil, ErrInvalidNonProportionalTreatyType
	}
}

// calculateExcessOfLossCession implements the logic for Excess of Loss treaties.
// The cession is triggered by a single loss event exceeding the PriorityLimit.
func calculateExcessOfLossCession(treaty *models.Treaty, lossAmount float64) (*CessionResult, error) {
	if treaty.PriorityLimit <= 0 || treaty.TreatyLimit <= 0 {
		return nil, errors.New("priority limit and treaty limit must be positive for XL treaty")
	}

	cededAmount := 0.0
	retainedAmount := lossAmount

	if lossAmount > treaty.PriorityLimit {
		// Amount in excess of the priority limit
		excess := lossAmount - treaty.PriorityLimit

		// Ceded amount is the minimum of the excess and the treaty limit
		cededAmount = math.Min(excess, treaty.TreatyLimit)

		// The retained amount is the priority limit plus any amount over the treaty limit
		retainedAmount = lossAmount - cededAmount
	}

	cededPercentage := 0.0
	if lossAmount > 0 {
		cededPercentage = (cededAmount / lossAmount) * 100.0
	}

	return &CessionResult{
		CededAmount:    cededAmount,
		RetainedAmount: retainedAmount,
		CededPercentage: cededPercentage,
	}, nil
}

// calculateStopLossCession implements the logic for Stop Loss treaties (Aggregate XL).
// The cession is triggered when the aggregate retained losses (CurrentLosses) exceed the PriorityLimit (Aggregate Retention).
func calculateStopLossCession(treaty *models.Treaty, lossAmount float64, utilization *models.Utilization) (*CessionResult, error) {
	if treaty.PriorityLimit <= 0 || treaty.AggregateLimit <= 0 {
		return nil, errors.New("priority limit and aggregate limit must be positive for Stop Loss treaty")
	}

	// The Stop Loss treaty covers the insurer's retained losses.
	// For this calculation, we assume the 'lossAmount' is the *retained* portion of a loss event
	// that has already been subjected to any underlying proportional or per-risk XL treaties.
	// We will treat the input 'lossAmount' as the amount to be added to the aggregate.

	currentAggregate := utilization.CurrentLosses
	aggregateRetention := treaty.PriorityLimit
	aggregateLimit := treaty.AggregateLimit

	// Check if the aggregate limit has been exhausted
	if currentAggregate >= aggregateRetention+aggregateLimit {
		// Treaty is fully exhausted, no further cession
		return &CessionResult{
			CededAmount:    0,
			RetainedAmount: lossAmount,
			CededPercentage: 0.0,
		}, nil
	}

	// Calculate the new aggregate if the full loss is retained
	newAggregate := currentAggregate + lossAmount

	cededAmount := 0.0
	retainedAmount := lossAmount

	// Case 1: Loss is fully within the aggregate retention
	if newAggregate <= aggregateRetention {
		// Fully retained, no cession
		// Utilization will be updated in the service layer
	} else if currentAggregate < aggregateRetention {
		// Case 2: Loss crosses the aggregate retention
		// Ceded amount is the part of the loss that exceeds the retention, up to the aggregate limit
		cededFromLoss := newAggregate - aggregateRetention
		remainingLimit := aggregateLimit - (currentAggregate - aggregateRetention) // This is the limit remaining *after* retention is met

		cededAmount = math.Min(cededFromLoss, remainingLimit)
		retainedAmount = lossAmount - cededAmount
	} else if currentAggregate >= aggregateRetention {
		// Case 3: Aggregate retention is already met, loss is ceded up to the aggregate limit
		remainingLimit := (aggregateRetention + aggregateLimit) - currentAggregate
		cededAmount = math.Min(lossAmount, remainingLimit)
		retainedAmount = lossAmount - cededAmount
	}

	cededPercentage := 0.0
	if lossAmount > 0 {
		cededPercentage = (cededAmount / lossAmount) * 100.0
	}

	return &CessionResult{
		CededAmount:    cededAmount,
		RetainedAmount: retainedAmount,
		CededPercentage: cededPercentage,
	}, nil
}
