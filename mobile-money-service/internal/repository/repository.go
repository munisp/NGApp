package repository

import (
	"fmt"
	"mobile-money-service/internal/models"
	"sync"
	"time"
)

type MoMoRepository struct {
	mu           sync.RWMutex
	providers    map[string]models.Provider
	transactions map[string]*models.MoMoTransaction
	wallets      map[string]*models.WalletBalance
}

func NewMoMoRepository() *MoMoRepository {
	repo := &MoMoRepository{
		providers:    make(map[string]models.Provider),
		transactions: make(map[string]*models.MoMoTransaction),
		wallets:      make(map[string]*models.WalletBalance),
	}
	repo.seedProviders()
	return repo
}

func (r *MoMoRepository) seedProviders() {
	providers := []models.Provider{
		{ID: "PRV-001", Name: "OPay", Code: "opay", Country: "NG", Currency: "NGN", FeePercent: 0.5, FeeFlat: 10, MinAmount: 100, MaxAmount: 5000000, IsActive: true, SettleTime: "instant"},
		{ID: "PRV-002", Name: "Paystack", Code: "paystack", Country: "NG", Currency: "NGN", FeePercent: 1.5, FeeFlat: 100, MinAmount: 100, MaxAmount: 10000000, IsActive: true, SettleTime: "T+1"},
		{ID: "PRV-003", Name: "M-Pesa", Code: "mpesa", Country: "KE", Currency: "KES", FeePercent: 0.3, FeeFlat: 0, MinAmount: 10, MaxAmount: 300000, IsActive: true, SettleTime: "instant"},
		{ID: "PRV-004", Name: "MTN MoMo", Code: "mtn_momo", Country: "GH", Currency: "GHS", FeePercent: 1.0, FeeFlat: 0, MinAmount: 1, MaxAmount: 50000, IsActive: true, SettleTime: "instant"},
		{ID: "PRV-005", Name: "Flutterwave", Code: "flutterwave", Country: "NG", Currency: "NGN", FeePercent: 1.4, FeeFlat: 0, MinAmount: 100, MaxAmount: 10000000, IsActive: true, SettleTime: "T+1"},
		{ID: "PRV-006", Name: "NIBSS", Code: "nibss", Country: "NG", Currency: "NGN", FeePercent: 0.1, FeeFlat: 25, MinAmount: 1000, MaxAmount: 50000000, IsActive: true, SettleTime: "T+0"},
	}
	for _, p := range providers {
		r.providers[p.Code] = p
	}
}

func (r *MoMoRepository) GetProviders(country string) []models.Provider {
	var result []models.Provider
	for _, p := range r.providers {
		if (country == "" || p.Country == country) && p.IsActive { result = append(result, p) }
	}
	return result
}

func (r *MoMoRepository) GetProvider(code string) (*models.Provider, error) {
	p, ok := r.providers[code]
	if !ok { return nil, fmt.Errorf("provider %s not found", code) }
	return &p, nil
}

func (r *MoMoRepository) CreateTransaction(t *models.MoMoTransaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transactions[t.ID] = t
}

func (r *MoMoRepository) GetTransaction(id string) (*models.MoMoTransaction, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.transactions[id]
	if !ok { return nil, fmt.Errorf("transaction %s not found", id) }
	return t, nil
}

func (r *MoMoRepository) UpdateTransaction(t *models.MoMoTransaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transactions[t.ID] = t
}

func (r *MoMoRepository) ListTransactions(phone string) []models.MoMoTransaction {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.MoMoTransaction
	for _, t := range r.transactions {
		if phone == "" || t.Phone == phone { result = append(result, *t) }
	}
	return result
}

func (r *MoMoRepository) GetOrCreateWallet(customerID, phone, currency string) *models.WalletBalance {
	r.mu.Lock()
	defer r.mu.Unlock()
	if w, ok := r.wallets[phone]; ok { return w }
	w := &models.WalletBalance{CustomerID: customerID, Phone: phone, Balance: 0, Currency: currency}
	r.wallets[phone] = w
	return w
}

func (r *MoMoRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	totalVol := 0.0; totalFees := 0.0
	success, failed := 0, 0
	for _, t := range r.transactions {
		totalVol += t.Amount; totalFees += t.Fee
		if t.Status == "completed" { success++ } else if t.Status == "failed" { failed++ }
	}
	return map[string]interface{}{
		"total_transactions": len(r.transactions), "total_volume": totalVol,
		"total_fees": totalFees, "success": success, "failed": failed,
		"providers": len(r.providers),
	}
}

func init() { _ = time.Now }
