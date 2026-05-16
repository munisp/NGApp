package repository

import (
	"fmt"
	"instant-payout-service/internal/models"
	"sync"
	"time"
)

type PayoutRepository struct {
	mu       sync.RWMutex
	payouts  map[string]*models.Payout
	batches  map[string]*models.BatchPayout
	ledger   []models.PayoutLedgerEntry
	channels []models.ChannelConfig
}

func NewPayoutRepository() *PayoutRepository {
	return &PayoutRepository{
		payouts: make(map[string]*models.Payout),
		batches: make(map[string]*models.BatchPayout),
		ledger:  []models.PayoutLedgerEntry{},
		channels: []models.ChannelConfig{
			{Channel: models.ChannelMobileMoney, Provider: "OPay", IsActive: true, MaxAmount: 5000000, MinAmount: 100, FeePercent: 0.5, FeeFlat: 50, EstimatedTime: "< 30 seconds", Currencies: []string{"NGN"}},
			{Channel: models.ChannelMobileMoney, Provider: "Paystack", IsActive: true, MaxAmount: 10000000, MinAmount: 100, FeePercent: 0.4, FeeFlat: 100, EstimatedTime: "< 1 minute", Currencies: []string{"NGN", "GHS", "KES"}},
			{Channel: models.ChannelBankTransfer, Provider: "NIBSS", IsActive: true, MaxAmount: 50000000, MinAmount: 1000, FeePercent: 0.1, FeeFlat: 25, EstimatedTime: "< 5 minutes", Currencies: []string{"NGN"}},
			{Channel: models.ChannelBankTransfer, Provider: "Flutterwave", IsActive: true, MaxAmount: 25000000, MinAmount: 500, FeePercent: 0.3, FeeFlat: 50, EstimatedTime: "< 10 minutes", Currencies: []string{"NGN", "GHS", "KES", "ZAR", "UGX", "TZS"}},
			{Channel: models.ChannelWallet, Provider: "Internal", IsActive: true, MaxAmount: 1000000, MinAmount: 50, FeePercent: 0, FeeFlat: 0, EstimatedTime: "instant", Currencies: []string{"NGN", "USD", "GBP", "EUR"}},
			{Channel: models.ChannelUSSD, Provider: "AfricasTalking", IsActive: true, MaxAmount: 500000, MinAmount: 100, FeePercent: 0.8, FeeFlat: 25, EstimatedTime: "< 2 minutes", Currencies: []string{"NGN", "KES", "UGX"}},
		},
	}
}

func (r *PayoutRepository) Create(p *models.Payout) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.payouts[p.ID] = p
	r.addLedgerEntry(p.ID, "created", "", string(p.Status), fmt.Sprintf("Payout created: %s %.2f to %s via %s", p.Currency, p.Amount, p.RecipientName, p.Channel))
	return nil
}

func (r *PayoutRepository) GetByID(id string) (*models.Payout, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.payouts[id]
	if !ok {
		return nil, fmt.Errorf("payout %s not found", id)
	}
	return p, nil
}

func (r *PayoutRepository) UpdateStatus(id string, status models.PayoutStatus, details string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.payouts[id]
	if !ok {
		return fmt.Errorf("payout %s not found", id)
	}
	old := string(p.Status)
	p.Status = status
	now := time.Now()
	if status == models.PayoutProcessing {
		p.ProcessedAt = &now
	}
	if status == models.PayoutCompleted || status == models.PayoutFailed {
		p.CompletedAt = &now
	}
	r.addLedgerEntry(id, "status_change", old, string(status), details)
	return nil
}

func (r *PayoutRepository) List(status string, limit int) []models.Payout {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Payout
	for _, p := range r.payouts {
		if status != "" && string(p.Status) != status {
			continue
		}
		result = append(result, *p)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

func (r *PayoutRepository) CreateBatch(b *models.BatchPayout) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.batches[b.ID] = b
	return nil
}

func (r *PayoutRepository) GetBatch(id string) (*models.BatchPayout, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	b, ok := r.batches[id]
	if !ok {
		return nil, fmt.Errorf("batch %s not found", id)
	}
	return b, nil
}

func (r *PayoutRepository) GetChannels() []models.ChannelConfig {
	return r.channels
}

func (r *PayoutRepository) GetChannelConfig(channel models.PayoutChannel, provider string) *models.ChannelConfig {
	for _, c := range r.channels {
		if c.Channel == channel && (provider == "" || c.Provider == provider) && c.IsActive {
			return &c
		}
	}
	return nil
}

func (r *PayoutRepository) GetLedger(payoutID string) []models.PayoutLedgerEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var entries []models.PayoutLedgerEntry
	for _, e := range r.ledger {
		if e.PayoutID == payoutID {
			entries = append(entries, e)
		}
	}
	return entries
}

func (r *PayoutRepository) addLedgerEntry(payoutID, action, oldStatus, newStatus, details string) {
	r.ledger = append(r.ledger, models.PayoutLedgerEntry{
		ID:        fmt.Sprintf("LED-%d", time.Now().UnixNano()%10000000),
		PayoutID:  payoutID,
		Action:    action,
		OldStatus: oldStatus,
		NewStatus: newStatus,
		Details:   details,
		CreatedAt: time.Now(),
	})
}

func (r *PayoutRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	total := len(r.payouts)
	var completed, failed, processing int
	var totalAmount, totalFees float64
	for _, p := range r.payouts {
		switch p.Status {
		case models.PayoutCompleted:
			completed++
			totalAmount += p.NetAmount
			totalFees += p.FeeAmount
		case models.PayoutFailed:
			failed++
		case models.PayoutProcessing:
			processing++
		}
	}
	successRate := 0.0
	if total > 0 {
		successRate = float64(completed) / float64(total) * 100
	}
	return map[string]interface{}{
		"total_payouts":    total,
		"completed":        completed,
		"failed":           failed,
		"processing":       processing,
		"total_disbursed":  totalAmount,
		"total_fees":       totalFees,
		"success_rate_pct": successRate,
	}
}
