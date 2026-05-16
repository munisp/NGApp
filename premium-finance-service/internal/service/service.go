package service

import (
	"fmt"
	"math"
	"premium-finance-service/internal/models"
	"premium-finance-service/internal/repository"
	"time"
)

type FinanceService struct {
	repo *repository.FinanceRepository
}

func NewFinanceService(repo *repository.FinanceRepository) *FinanceService {
	return &FinanceService{repo: repo}
}

func (s *FinanceService) ApplyForLoan(app models.LoanApplication) (*models.PremiumLoan, error) {
	if app.PremiumAmount <= 0 {
		return nil, fmt.Errorf("premium amount must be positive")
	}
	if app.Tenure < 1 || app.Tenure > 12 {
		return nil, fmt.Errorf("tenure must be between 1 and 12 months")
	}
	if app.DownPaymentPct < 0 || app.DownPaymentPct > 100 {
		return nil, fmt.Errorf("down payment percentage must be 0-100")
	}
	if app.CreditScore < 300 || app.CreditScore > 850 {
		return nil, fmt.Errorf("credit score must be 300-850")
	}

	riskCategory, interestRate := s.assessCreditRisk(app.CreditScore, app.MonthlyIncome, app.PremiumAmount)

	if riskCategory == "very_high" {
		return nil, fmt.Errorf("loan application rejected: credit risk too high (score: %d)", app.CreditScore)
	}

	downPayment := app.PremiumAmount * app.DownPaymentPct / 100
	loanAmount := app.PremiumAmount - downPayment
	monthlyRate := interestRate / 12 / 100
	var monthlyPayment float64
	if monthlyRate == 0 {
		monthlyPayment = loanAmount / float64(app.Tenure)
	} else {
		monthlyPayment = loanAmount * monthlyRate * math.Pow(1+monthlyRate, float64(app.Tenure)) / (math.Pow(1+monthlyRate, float64(app.Tenure)) - 1)
	}
	monthlyPayment = math.Round(monthlyPayment*100) / 100
	totalRepayment := monthlyPayment * float64(app.Tenure)
	totalInterest := totalRepayment - loanAmount

	if app.MonthlyIncome > 0 && monthlyPayment > app.MonthlyIncome*0.4 {
		return nil, fmt.Errorf("monthly payment ₦%.2f exceeds 40%% of monthly income ₦%.2f", monthlyPayment, app.MonthlyIncome)
	}

	now := time.Now()
	nextPayment := now.AddDate(0, 1, 0)
	loan := &models.PremiumLoan{
		ID:                 fmt.Sprintf("PFL-%d", time.Now().UnixNano()%10000000),
		PolicyID:           app.PolicyID,
		CustomerID:         app.CustomerID,
		PremiumAmount:      app.PremiumAmount,
		LoanAmount:         loanAmount,
		DownPayment:        downPayment,
		InterestRate:       interestRate,
		Tenure:             app.Tenure,
		MonthlyPayment:     monthlyPayment,
		TotalInterest:      math.Round(totalInterest*100) / 100,
		TotalRepayment:     math.Round(totalRepayment*100) / 100,
		OutstandingBalance: loanAmount,
		Status:             models.LoanApproved,
		CreditScore:        app.CreditScore,
		RiskCategory:       riskCategory,
		DisbursedAt:        &now,
		NextPaymentDate:    &nextPayment,
		CreatedAt:          now,
	}

	if err := s.repo.CreateLoan(loan); err != nil {
		return nil, err
	}

	installments := s.generateSchedule(loan)
	s.repo.SaveInstallments(loan.ID, installments)

	return loan, nil
}

func (s *FinanceService) assessCreditRisk(score int, income, premium float64) (string, float64) {
	switch {
	case score >= 750:
		return "low", 8.0
	case score >= 650:
		return "moderate", 14.0
	case score >= 550:
		return "high", 22.0
	case score >= 450:
		return "high", 28.0
	default:
		return "very_high", 35.0
	}
}

func (s *FinanceService) generateSchedule(loan *models.PremiumLoan) []models.Installment {
	var schedule []models.Installment
	balance := loan.LoanAmount
	monthlyRate := loan.InterestRate / 12 / 100

	for i := 1; i <= loan.Tenure; i++ {
		interest := math.Round(balance*monthlyRate*100) / 100
		principal := math.Round((loan.MonthlyPayment-interest)*100) / 100
		if i == loan.Tenure {
			principal = balance
		}
		balance = math.Round((balance-principal)*100) / 100
		if balance < 0 {
			balance = 0
		}
		dueDate := loan.CreatedAt.AddDate(0, i, 0)
		schedule = append(schedule, models.Installment{
			ID:       fmt.Sprintf("INS-%s-%d", loan.ID, i),
			LoanID:   loan.ID,
			Number:   i,
			Amount:   loan.MonthlyPayment,
			Principal: principal,
			Interest:  interest,
			Balance:   balance,
			DueDate:   dueDate,
			Status:    "pending",
		})
	}
	return schedule
}

func (s *FinanceService) GetLoan(id string) (*models.PremiumLoan, error) {
	return s.repo.GetLoan(id)
}

func (s *FinanceService) ListLoans(status string) []models.PremiumLoan {
	return s.repo.ListLoans(status)
}

func (s *FinanceService) GetSchedule(loanID string) []models.Installment {
	return s.repo.GetInstallments(loanID)
}

func (s *FinanceService) MakePayment(loanID string, number int) (*models.Installment, error) {
	if err := s.repo.PayInstallment(loanID, number); err != nil {
		return nil, err
	}
	loan, _ := s.repo.GetLoan(loanID)
	installments := s.repo.GetInstallments(loanID)
	allPaid := true
	for _, inst := range installments {
		if inst.Number == number {
			loan.OutstandingBalance -= inst.Principal
		}
		if inst.Status != "paid" {
			allPaid = false
		}
	}
	if allPaid {
		loan.Status = models.LoanPaidOff
	} else {
		loan.Status = models.LoanActive
	}
	s.repo.UpdateLoan(loan)

	for _, inst := range installments {
		if inst.Number == number {
			return &inst, nil
		}
	}
	return nil, fmt.Errorf("installment not found after payment")
}

func (s *FinanceService) GetStats() map[string]interface{} {
	return s.repo.GetStats()
}
