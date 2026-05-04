package enhancements

import (
	"fmt"
	"sync"
	"time"
)

// RevenueCategory categorizes revenue streams
type RevenueCategory string

const (
	RevenueSubscription RevenueCategory = "subscription"
	RevenueTransaction  RevenueCategory = "transaction_fee"
	RevenueCorridor     RevenueCategory = "corridor_fee"
	RevenueFXSpread     RevenueCategory = "fx_spread"
	RevenueCBNLevy      RevenueCategory = "cbn_levy"
	RevenueRTGS         RevenueCategory = "rtgs_surcharge"
)

// ReconciliationStatus tracks reconciliation state
type ReconciliationStatus string

const (
	ReconPending    ReconciliationStatus = "pending"
	ReconMatched    ReconciliationStatus = "matched"
	ReconMismatched ReconciliationStatus = "mismatched"
	ReconResolved   ReconciliationStatus = "resolved"
)

// RevenueEntry represents a single revenue line item
type RevenueEntry struct {
	ID            string          `json:"id"`
	ParticipantID int             `json:"participantId"`
	Category      RevenueCategory `json:"category"`
	AmountNGN     float64         `json:"amountNgn"`
	TransferRef   string          `json:"transferRef,omitempty"`
	Corridor      string          `json:"corridor,omitempty"`
	Period        string          `json:"period"` // YYYY-MM
	Timestamp     time.Time       `json:"timestamp"`
	Source        string          `json:"source"` // tigerbeetle, billing_engine, manual
}

// ReconciliationRecord compares expected vs actual revenue
type ReconciliationRecord struct {
	ID              string               `json:"id"`
	ParticipantID   int                  `json:"participantId"`
	Period          string               `json:"period"`
	Category        RevenueCategory      `json:"category"`
	ExpectedNGN     float64              `json:"expectedNgn"`
	ActualNGN       float64              `json:"actualNgn"`
	DifferenceNGN   float64              `json:"differenceNgn"`
	DifferencePct   float64              `json:"differencePct"`
	Status          ReconciliationStatus `json:"status"`
	Notes           string               `json:"notes,omitempty"`
	ReconciledAt    *time.Time           `json:"reconciledAt,omitempty"`
	ReconciledBy    string               `json:"reconciledBy,omitempty"`
}

// ParticipantRevenueShare defines revenue sharing terms per participant
type ParticipantRevenueShare struct {
	ParticipantID     int     `json:"participantId"`
	Tier              string  `json:"tier"`
	FXSpreadSharePct  float64 `json:"fxSpreadSharePct"`  // % of FX spread earned by platform
	CorridorFeeShare  float64 `json:"corridorFeeSharePct"`
	TransactionFee    float64 `json:"transactionFeeNgn"` // flat fee per txn
	MonthlyMinimum    float64 `json:"monthlyMinimumNgn"`
}

// MonthlyReconciliationSummary aggregates reconciliation for a period
type MonthlyReconciliationSummary struct {
	Period            string  `json:"period"`
	ParticipantID     int     `json:"participantId"`
	TotalExpectedNGN  float64 `json:"totalExpectedNgn"`
	TotalActualNGN    float64 `json:"totalActualNgn"`
	TotalDifferenceNGN float64 `json:"totalDifferenceNgn"`
	MatchedCount      int     `json:"matchedCount"`
	MismatchedCount   int     `json:"mismatchedCount"`
	PendingCount      int     `json:"pendingCount"`
	OverallStatus     string  `json:"overallStatus"` // clean, exceptions_found, pending
}

// RevenueReconciliationService manages automated revenue reconciliation
type RevenueReconciliationService struct {
	mu            sync.RWMutex
	entries       []RevenueEntry
	records       []ReconciliationRecord
	shareTerms    map[int]ParticipantRevenueShare // key: participantID
	tolerancePct  float64 // allowed variance before flagging mismatch
}

// NewRevenueReconciliationService creates a reconciliation service
func NewRevenueReconciliationService() *RevenueReconciliationService {
	return &RevenueReconciliationService{
		entries:      make([]RevenueEntry, 0),
		records:      make([]ReconciliationRecord, 0),
		shareTerms:   make(map[int]ParticipantRevenueShare),
		tolerancePct: 0.01, // 1% tolerance
	}
}

// SetRevenueShareTerms configures revenue sharing for a participant
func (rs *RevenueReconciliationService) SetRevenueShareTerms(terms ParticipantRevenueShare) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.shareTerms[terms.ParticipantID] = terms
}

// RecordRevenue records a revenue entry from TigerBeetle or billing engine
func (rs *RevenueReconciliationService) RecordRevenue(entry RevenueEntry) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.entries = append(rs.entries, entry)
}

// RunReconciliation performs monthly reconciliation for a participant
func (rs *RevenueReconciliationService) RunReconciliation(participantID int, period string) []ReconciliationRecord {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	terms, hasTerms := rs.shareTerms[participantID]
	if !hasTerms {
		return nil
	}

	// Group entries by category
	categoryTotals := make(map[RevenueCategory]float64)
	for _, entry := range rs.entries {
		if entry.ParticipantID == participantID && entry.Period == period {
			categoryTotals[entry.Category] += entry.AmountNGN
		}
	}

	var newRecords []ReconciliationRecord

	// Reconcile each category
	categories := []RevenueCategory{
		RevenueSubscription, RevenueTransaction, RevenueCorridor, RevenueFXSpread,
	}

	for _, cat := range categories {
		actual := categoryTotals[cat]
		expected := rs.calculateExpected(terms, cat, participantID, period)

		diff := actual - expected
		diffPct := 0.0
		if expected > 0 {
			diffPct = diff / expected
		}

		status := ReconMatched
		if abs(diffPct) > rs.tolerancePct {
			status = ReconMismatched
		}

		record := ReconciliationRecord{
			ID:            fmt.Sprintf("recon-%d-%s-%s", participantID, period, cat),
			ParticipantID: participantID,
			Period:        period,
			Category:      cat,
			ExpectedNGN:   expected,
			ActualNGN:     actual,
			DifferenceNGN: diff,
			DifferencePct: diffPct * 100,
			Status:        status,
		}

		newRecords = append(newRecords, record)
		rs.records = append(rs.records, record)
	}

	return newRecords
}

// GetReconciliationSummary returns monthly summary for a participant
func (rs *RevenueReconciliationService) GetReconciliationSummary(participantID int, period string) MonthlyReconciliationSummary {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	summary := MonthlyReconciliationSummary{
		Period:        period,
		ParticipantID: participantID,
	}

	for _, r := range rs.records {
		if r.ParticipantID == participantID && r.Period == period {
			summary.TotalExpectedNGN += r.ExpectedNGN
			summary.TotalActualNGN += r.ActualNGN
			summary.TotalDifferenceNGN += r.DifferenceNGN

			switch r.Status {
			case ReconMatched:
				summary.MatchedCount++
			case ReconMismatched:
				summary.MismatchedCount++
			case ReconPending:
				summary.PendingCount++
			}
		}
	}

	if summary.MismatchedCount > 0 {
		summary.OverallStatus = "exceptions_found"
	} else if summary.PendingCount > 0 {
		summary.OverallStatus = "pending"
	} else {
		summary.OverallStatus = "clean"
	}

	return summary
}

// GetMismatches returns all unresolved mismatches
func (rs *RevenueReconciliationService) GetMismatches(participantID int) []ReconciliationRecord {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	var mismatches []ReconciliationRecord
	for _, r := range rs.records {
		if r.ParticipantID == participantID && r.Status == ReconMismatched {
			mismatches = append(mismatches, r)
		}
	}
	return mismatches
}

// ResolveRecord marks a reconciliation record as resolved
func (rs *RevenueReconciliationService) ResolveRecord(recordID string, resolvedBy string, notes string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	now := time.Now()
	for i := range rs.records {
		if rs.records[i].ID == recordID {
			rs.records[i].Status = ReconResolved
			rs.records[i].ReconciledAt = &now
			rs.records[i].ReconciledBy = resolvedBy
			rs.records[i].Notes = notes
			break
		}
	}
}

func (rs *RevenueReconciliationService) calculateExpected(terms ParticipantRevenueShare, category RevenueCategory, participantID int, period string) float64 {
	// Count transactions for the period
	var txnCount int
	var totalVolume float64
	for _, e := range rs.entries {
		if e.ParticipantID == participantID && e.Period == period && e.Category == RevenueTransaction {
			txnCount++
			totalVolume += e.AmountNGN
		}
	}

	switch category {
	case RevenueSubscription:
		return terms.MonthlyMinimum
	case RevenueTransaction:
		return float64(txnCount) * terms.TransactionFee
	case RevenueCorridor:
		return totalVolume * terms.CorridorFeeShare / 100
	case RevenueFXSpread:
		return totalVolume * terms.FXSpreadSharePct / 100
	default:
		return 0
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
