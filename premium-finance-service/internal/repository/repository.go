package repository

import (
	"fmt"
	"premium-finance-service/internal/models"
	"sync"
	"time"
)

type FinanceRepository struct {
	mu           sync.RWMutex
	loans        map[string]*models.PremiumLoan
	installments map[string][]models.Installment
}

func NewFinanceRepository() *FinanceRepository {
	return &FinanceRepository{
		loans:        make(map[string]*models.PremiumLoan),
		installments: make(map[string][]models.Installment),
	}
}

func (r *FinanceRepository) CreateLoan(loan *models.PremiumLoan) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.loans[loan.ID] = loan
	return nil
}

func (r *FinanceRepository) GetLoan(id string) (*models.PremiumLoan, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	loan, ok := r.loans[id]
	if !ok {
		return nil, fmt.Errorf("loan %s not found", id)
	}
	return loan, nil
}

func (r *FinanceRepository) UpdateLoan(loan *models.PremiumLoan) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.loans[loan.ID] = loan
	return nil
}

func (r *FinanceRepository) ListLoans(status string) []models.PremiumLoan {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.PremiumLoan
	for _, l := range r.loans {
		if status == "" || string(l.Status) == status {
			result = append(result, *l)
		}
	}
	return result
}

func (r *FinanceRepository) SaveInstallments(loanID string, installments []models.Installment) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.installments[loanID] = installments
}

func (r *FinanceRepository) GetInstallments(loanID string) []models.Installment {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.installments[loanID]
}

func (r *FinanceRepository) PayInstallment(loanID string, number int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	installments, ok := r.installments[loanID]
	if !ok {
		return fmt.Errorf("no installments for loan %s", loanID)
	}
	for i := range installments {
		if installments[i].Number == number {
			now := time.Now()
			installments[i].PaidDate = &now
			installments[i].Status = "paid"
			if now.After(installments[i].DueDate) {
				dayslate := int(now.Sub(installments[i].DueDate).Hours() / 24)
				installments[i].LateFee = float64(dayslate) * 500
			}
			return nil
		}
	}
	return fmt.Errorf("installment %d not found", number)
}

func (r *FinanceRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var total, active, defaulted int
	var totalDisbursed, totalOutstanding float64
	for _, l := range r.loans {
		total++
		switch l.Status {
		case models.LoanActive:
			active++
			totalOutstanding += l.OutstandingBalance
		case models.LoanDefaulted:
			defaulted++
		}
		totalDisbursed += l.LoanAmount
	}
	return map[string]interface{}{
		"total_loans": total, "active_loans": active, "defaulted_loans": defaulted,
		"total_disbursed": totalDisbursed, "total_outstanding": totalOutstanding,
	}
}
