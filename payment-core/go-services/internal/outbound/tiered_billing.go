package outbound

import (
	"context"
	"fmt"
	"time"
)

// TieredBillingService implements the platform's monetization model
// with subscription tiers, per-transaction fees, and corridor variable fees.
type TieredBillingService struct {
	tiers       map[string]*SubscriptionTier
	feeSchedule *FeeSchedule
}

// SubscriptionTier defines participant billing tiers per the architecture document
type SubscriptionTier struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	MonthlyFeeUSD    float64 `json:"monthly_fee_usd"`
	BaseSwitchFeeUSD float64 `json:"base_switch_fee_usd"`
	CorridorDiscount float64 `json:"corridor_discount_pct"` // % discount on corridor fees
	MaxMonthlyTxns   int     `json:"max_monthly_txns"`
	MaxTxnAmountUSD  float64 `json:"max_txn_amount_usd"`
	SLAGuarantee     string  `json:"sla_guarantee"`
	DedicatedSupport bool    `json:"dedicated_support"`
	CustomRouting    bool    `json:"custom_routing"`
	WhiteLabel       bool    `json:"white_label"`
	FXRevenueShare   float64 `json:"fx_revenue_share_pct"` // % of FX spread shared back
}

// FeeSchedule defines the complete fee structure
type FeeSchedule struct {
	BaseSwitchFees    map[string]float64 `json:"base_switch_fees"`     // tier -> fee USD
	CorridorFees      map[string]float64 `json:"corridor_fees"`        // corridor_id -> fee USD
	FXSpreadBPS       map[string]int     `json:"fx_spread_bps"`        // corridor -> spread in basis points
	VelocityFees      []VelocityFee      `json:"velocity_fees"`
	PremiumServiceFees map[string]float64 `json:"premium_service_fees"`
}

// VelocityFee applies volume-based fee adjustments
type VelocityFee struct {
	ThresholdTxns int     `json:"threshold_txns"` // monthly txn count threshold
	DiscountPct   float64 `json:"discount_pct"`   // discount applied above threshold
}

// BillingRequest contains the data needed to calculate fees
type BillingRequest struct {
	TransferID     string  `json:"transfer_id"`
	ParticipantID  string  `json:"participant_id"`
	TierID         string  `json:"tier_id"`
	CorridorID     string  `json:"corridor_id"`
	AmountUSD      float64 `json:"amount_usd"`
	MonthlyTxnCount int    `json:"monthly_txn_count"`
}

// BillingResult contains the calculated fees
type BillingResult struct {
	TransferID       string  `json:"transfer_id"`
	BaseSwitchFee    float64 `json:"base_switch_fee_usd"`
	CorridorFee      float64 `json:"corridor_fee_usd"`
	FXSpreadFee      float64 `json:"fx_spread_fee_usd"`
	VelocityDiscount float64 `json:"velocity_discount_usd"`
	TotalFee         float64 `json:"total_fee_usd"`
	TierDiscount     float64 `json:"tier_discount_usd"`
	NetFee           float64 `json:"net_fee_usd"`
	FXRevenueShare   float64 `json:"fx_revenue_share_usd"`
	TigerBeetlePostings []LedgerPosting `json:"ledger_postings"`
}

// LedgerPosting represents a TigerBeetle double-entry posting
type LedgerPosting struct {
	DebitAccount  string  `json:"debit_account"`
	CreditAccount string  `json:"credit_account"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	State         string  `json:"state"` // "pending", "committed", "voided"
	Reference     string  `json:"reference"`
}

// Invoice represents a monthly invoice for a participant
type Invoice struct {
	ID              string        `json:"id"`
	ParticipantID   string        `json:"participant_id"`
	TierID          string        `json:"tier_id"`
	PeriodStart     time.Time     `json:"period_start"`
	PeriodEnd       time.Time     `json:"period_end"`
	SubscriptionFee float64       `json:"subscription_fee_usd"`
	SwitchFees      float64       `json:"switch_fees_usd"`
	CorridorFees    float64       `json:"corridor_fees_usd"`
	FXRevenue       float64       `json:"fx_revenue_usd"`
	VolumeDiscounts float64       `json:"volume_discounts_usd"`
	PrefundDeducted float64       `json:"prefund_deducted_usd"`
	TotalDue        float64       `json:"total_due_usd"`
	Status          string        `json:"status"` // "draft", "issued", "paid", "overdue"
	LineItems       []InvoiceItem `json:"line_items"`
	GeneratedAt     time.Time     `json:"generated_at"`
}

// InvoiceItem is a line item on an invoice
type InvoiceItem struct {
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price_usd"`
	Total       float64 `json:"total_usd"`
}

// NewTieredBillingService creates the billing service with production tiers
func NewTieredBillingService() *TieredBillingService {
	svc := &TieredBillingService{
		tiers: make(map[string]*SubscriptionTier),
	}
	svc.initTiers()
	svc.initFeeSchedule()
	return svc
}

// CalculateFees computes the full fee breakdown for a transfer
func (s *TieredBillingService) CalculateFees(ctx context.Context, req *BillingRequest) (*BillingResult, error) {
	tier, ok := s.tiers[req.TierID]
	if !ok {
		return nil, fmt.Errorf("unknown tier: %s", req.TierID)
	}

	result := &BillingResult{
		TransferID: req.TransferID,
	}

	// 1. Base switch fee (per tier)
	result.BaseSwitchFee = tier.BaseSwitchFeeUSD

	// 2. Corridor variable fee
	if fee, ok := s.feeSchedule.CorridorFees[req.CorridorID]; ok {
		result.CorridorFee = fee
	} else {
		result.CorridorFee = 0.50 // default corridor fee
	}

	// 3. FX spread fee (basis points on amount)
	spreadBPS := 150 // default
	if bps, ok := s.feeSchedule.FXSpreadBPS[req.CorridorID]; ok {
		spreadBPS = bps
	}
	result.FXSpreadFee = req.AmountUSD * float64(spreadBPS) / 10000.0

	// 4. Volume discount
	for _, vf := range s.feeSchedule.VelocityFees {
		if req.MonthlyTxnCount > vf.ThresholdTxns {
			result.VelocityDiscount = (result.BaseSwitchFee + result.CorridorFee) * vf.DiscountPct / 100.0
		}
	}

	// 5. Tier discount
	result.TierDiscount = result.CorridorFee * tier.CorridorDiscount / 100.0

	// 6. Total
	result.TotalFee = result.BaseSwitchFee + result.CorridorFee + result.FXSpreadFee
	result.NetFee = result.TotalFee - result.VelocityDiscount - result.TierDiscount

	// 7. FX Revenue share back to participant
	result.FXRevenueShare = result.FXSpreadFee * tier.FXRevenueShare / 100.0

	// 8. Generate TigerBeetle postings per the architecture document
	result.TigerBeetlePostings = s.generatePostings(req, result)

	return result, nil
}

// GenerateMonthlyInvoice creates an invoice for a participant
func (s *TieredBillingService) GenerateMonthlyInvoice(ctx context.Context, participantID string, tierID string, txnCount int, totalSwitchFees float64, totalCorridorFees float64, totalFXRevenue float64, totalDiscounts float64, prefundDeducted float64) (*Invoice, error) {
	tier, ok := s.tiers[tierID]
	if !ok {
		return nil, fmt.Errorf("unknown tier: %s", tierID)
	}

	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, -1)

	invoice := &Invoice{
		ID:              fmt.Sprintf("INV-%s-%s", participantID, periodStart.Format("200601")),
		ParticipantID:   participantID,
		TierID:          tierID,
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		SubscriptionFee: tier.MonthlyFeeUSD,
		SwitchFees:      totalSwitchFees,
		CorridorFees:    totalCorridorFees,
		FXRevenue:       totalFXRevenue,
		VolumeDiscounts: totalDiscounts,
		PrefundDeducted: prefundDeducted,
		Status:          "draft",
		GeneratedAt:     now,
	}

	// Calculate total due (subscription + fees not already deducted from prefund)
	grossFees := invoice.SubscriptionFee + invoice.SwitchFees + invoice.CorridorFees
	invoice.TotalDue = grossFees - invoice.VolumeDiscounts - invoice.PrefundDeducted

	// Line items
	invoice.LineItems = []InvoiceItem{
		{Description: fmt.Sprintf("%s Monthly Subscription", tier.Name), Quantity: 1, UnitPrice: tier.MonthlyFeeUSD, Total: tier.MonthlyFeeUSD},
		{Description: fmt.Sprintf("Base Switch Fees (%d txns @ $%.2f)", txnCount, tier.BaseSwitchFeeUSD), Quantity: txnCount, UnitPrice: tier.BaseSwitchFeeUSD, Total: totalSwitchFees},
		{Description: "Corridor Variable Fees (Blended)", Quantity: txnCount, UnitPrice: totalCorridorFees / float64(txnCount), Total: totalCorridorFees},
		{Description: "Less: Real-Time Prefund Deductions", Quantity: 1, UnitPrice: -prefundDeducted, Total: -prefundDeducted},
	}

	if totalDiscounts > 0 {
		invoice.LineItems = append(invoice.LineItems, InvoiceItem{Description: "Volume Discount", Quantity: 1, UnitPrice: -totalDiscounts, Total: -totalDiscounts})
	}

	return invoice, nil
}

// generatePostings creates the TigerBeetle double-entry postings
func (s *TieredBillingService) generatePostings(req *BillingRequest, result *BillingResult) []LedgerPosting {
	prefix := fmt.Sprintf("fintech_%s", req.ParticipantID)
	return []LedgerPosting{
		// Reserve principal + fees from prefund
		{DebitAccount: fmt.Sprintf("%s_prefund_ngn", prefix), CreditAccount: "outbound_transit_payable", Amount: req.AmountUSD, Currency: "USD", State: "pending", Reference: fmt.Sprintf("RES-%s", req.TransferID)},
		// Switch fee accrual
		{DebitAccount: fmt.Sprintf("%s_prefund_ngn", prefix), CreditAccount: "switch_fee_income", Amount: result.BaseSwitchFee, Currency: "USD", State: "pending", Reference: fmt.Sprintf("FEE-BASE-%s", req.TransferID)},
		// Corridor fee accrual
		{DebitAccount: fmt.Sprintf("%s_prefund_ngn", prefix), CreditAccount: "corridor_fee_income", Amount: result.CorridorFee, Currency: "USD", State: "pending", Reference: fmt.Sprintf("FEE-CORR-%s", req.TransferID)},
		// FX revenue
		{DebitAccount: fmt.Sprintf("%s_prefund_ngn", prefix), CreditAccount: "fx_revenue_share", Amount: result.FXSpreadFee, Currency: "USD", State: "pending", Reference: fmt.Sprintf("FX-%s", req.TransferID)},
	}
}

// initTiers configures the 4 subscription tiers per the architecture document
func (s *TieredBillingService) initTiers() {
	s.tiers = map[string]*SubscriptionTier{
		"starter": {
			ID: "starter", Name: "Starter",
			MonthlyFeeUSD: 200, BaseSwitchFeeUSD: 0.25,
			CorridorDiscount: 0, MaxMonthlyTxns: 10000,
			MaxTxnAmountUSD: 5000, SLAGuarantee: "99.0%",
			DedicatedSupport: false, CustomRouting: false,
			WhiteLabel: false, FXRevenueShare: 0,
		},
		"growth": {
			ID: "growth", Name: "Growth",
			MonthlyFeeUSD: 500, BaseSwitchFeeUSD: 0.15,
			CorridorDiscount: 10, MaxMonthlyTxns: 50000,
			MaxTxnAmountUSD: 25000, SLAGuarantee: "99.5%",
			DedicatedSupport: false, CustomRouting: false,
			WhiteLabel: false, FXRevenueShare: 5,
		},
		"enterprise": {
			ID: "enterprise", Name: "Enterprise",
			MonthlyFeeUSD: 2000, BaseSwitchFeeUSD: 0.10,
			CorridorDiscount: 20, MaxMonthlyTxns: 500000,
			MaxTxnAmountUSD: 100000, SLAGuarantee: "99.9%",
			DedicatedSupport: true, CustomRouting: true,
			WhiteLabel: false, FXRevenueShare: 15,
		},
		"premium": {
			ID: "premium", Name: "Premium",
			MonthlyFeeUSD: 5000, BaseSwitchFeeUSD: 0.05,
			CorridorDiscount: 35, MaxMonthlyTxns: 0, // unlimited
			MaxTxnAmountUSD: 500000, SLAGuarantee: "99.99%",
			DedicatedSupport: true, CustomRouting: true,
			WhiteLabel: true, FXRevenueShare: 25,
		},
	}
}

// initFeeSchedule configures corridor-specific fees
func (s *TieredBillingService) initFeeSchedule() {
	s.feeSchedule = &FeeSchedule{
		BaseSwitchFees: map[string]float64{
			"starter": 0.25, "growth": 0.15, "enterprise": 0.10, "premium": 0.05,
		},
		CorridorFees: map[string]float64{
			"NG-GH": 0.30, "NG-SN": 0.40, "NG-CI": 0.40, "NG-CM": 0.45,
			"NG-GB": 0.80, "NG-US": 0.75, "NG-CA": 0.85,
			"NG-IN": 0.50, "NG-TR": 0.55,
			"NG-CN": 1.20, "NG-AE": 1.00,
			"NG-KE": 0.35, "NG-ZA": 0.40,
		},
		FXSpreadBPS: map[string]int{
			"NG-GH": 150, "NG-SN": 200, "NG-CI": 200, "NG-CM": 200,
			"NG-GB": 100, "NG-US": 100, "NG-CA": 120,
			"NG-IN": 150, "NG-TR": 175,
			"NG-CN": 80, "NG-AE": 90,
			"NG-KE": 150, "NG-ZA": 130,
		},
		VelocityFees: []VelocityFee{
			{ThresholdTxns: 10000, DiscountPct: 5},
			{ThresholdTxns: 50000, DiscountPct: 10},
			{ThresholdTxns: 200000, DiscountPct: 15},
		},
		PremiumServiceFees: map[string]float64{
			"express_processing": 2.00,
			"dedicated_routing":  1.50,
			"priority_support":   0.50,
		},
	}
}

// GetTiers returns all subscription tiers
func (s *TieredBillingService) GetTiers() []*SubscriptionTier {
	result := make([]*SubscriptionTier, 0, len(s.tiers))
	for _, t := range s.tiers {
		result = append(result, t)
	}
	return result
}
