package reinsurance

import (
	"errors"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
)

var (
	ErrInvalidTreatyType = errors.New("invalid treaty type for proportional calculation")
	ErrInvalidAmount     = errors.New("amount must be positive")
)

// CessionResult holds the calculated cession amounts
type CessionResult struct {
	CededAmount    float64
	RetainedAmount float64
	CededPercentage float64
}

// CalculateProportionalCession calculates the ceded and retained amounts for proportional treaties.
// This function is used for both Quota Share and Surplus treaties.
func CalculateProportionalCession(treaty *models.Treaty, originalAmount float64) (*CessionResult, error) {
	if originalAmount <= 0 {
		return nil, ErrInvalidAmount
	}

	switch treaty.TreatyType {
	case models.TreatyTypeQuotaShare:
		return calculateQuotaShareCession(treaty, originalAmount)
	case models.TreatyTypeSurplus:
		return calculateSurplusCession(treaty, originalAmount)
	default:
		return nil, ErrInvalidTreatyType
	}
}

// calculateQuotaShareCession implements the logic for Quota Share treaties.
// The ceded percentage is fixed as the treaty's SharePercentage.
func calculateQuotaShareCession(treaty *models.Treaty, originalAmount float64) (*CessionResult, error) {
	if treaty.SharePercentage < 0 || treaty.SharePercentage > 100 {
		return nil, errors.New("quota share percentage must be between 0 and 100")
	}

	cededPercentage := treaty.SharePercentage / 100.0
	cededAmount := originalAmount * cededPercentage
	retainedAmount := originalAmount - cededAmount

	return &CessionResult{
		CededAmount:    cededAmount,
		RetainedAmount: retainedAmount,
		CededPercentage: cededPercentage * 100.0,
	}, nil
}

// calculateSurplusCession implements the logic for Surplus treaties.
// The insurer retains up to the RetentionLimit, and the surplus is ceded up to the SharePercentage (which represents the number of lines).
func calculateSurplusCession(treaty *models.Treaty, originalAmount float64) (*CessionResult, error) {
	if treaty.RetentionLimit <= 0 {
		return nil, errors.New("retention limit must be positive for surplus treaty")
	}
	if treaty.SharePercentage <= 0 {
		return nil, errors.New("surplus lines (SharePercentage) must be positive")
	}

	retentionLimit := treaty.RetentionLimit
	maxCededLimit := retentionLimit * treaty.SharePercentage // SharePercentage is used as "lines"

	if originalAmount <= retentionLimit {
		// Risk is fully retained
		return &CessionResult{
			CededAmount:    0,
			RetainedAmount: originalAmount,
			CededPercentage: 0.0,
		}, nil
	}

	// Amount exceeding retention
	surplus := originalAmount - retentionLimit

	// Ceded amount is the minimum of the surplus and the max ceded limit
	cededAmount := surplus
	if cededAmount > maxCededLimit {
		cededAmount = maxCededLimit
	}

	retainedAmount := originalAmount - cededAmount
	cededPercentage := (cededAmount / originalAmount) * 100.0

	return &CessionResult{
		CededAmount:    cededAmount,
		RetainedAmount: retainedAmount,
		CededPercentage: cededPercentage,
	}, nil
}
