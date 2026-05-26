package banking

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"sync"
	"time"
)

type MobileMoneyProvider struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	ShortName string   `json:"shortName"`
	Logo      string   `json:"logo"`
	MinAmount float64  `json:"minAmount"`
	MaxAmount float64  `json:"maxAmount"`
	Fee       float64  `json:"fee"`
	Countries []string `json:"countries"`
}

type MobileMoneyTransferStatus string

const (
	MobileMoneyStatusSuccessful MobileMoneyTransferStatus = "successful"
	MobileMoneyStatusPending    MobileMoneyTransferStatus = "pending"
	MobileMoneyStatusFailed     MobileMoneyTransferStatus = "failed"
)

type MobileMoneyTransfer struct {
	Reference      string                    `json:"reference"`
	Provider       string                    `json:"provider"`
	RecipientPhone string                    `json:"recipientPhone"`
	Amount         float64                   `json:"amount"`
	Fee            float64                   `json:"fee"`
	Status         MobileMoneyTransferStatus `json:"status"`
	Message        string                    `json:"message"`
	TransactionID  string                    `json:"transactionId,omitempty"`
	CreatedAt      time.Time                 `json:"createdAt"`
}

type ValidateAccountResult struct {
	Valid         bool   `json:"valid"`
	AccountName   string `json:"accountName,omitempty"`
	AccountStatus string `json:"accountStatus,omitempty"`
	Error         string `json:"error,omitempty"`
}

type ProviderLimits struct {
	MinAmount    float64 `json:"minAmount"`
	MaxAmount    float64 `json:"maxAmount"`
	DailyLimit   float64 `json:"dailyLimit"`
	MonthlyLimit float64 `json:"monthlyLimit"`
}

type FeeStructure struct {
	Percentage float64
	Min        float64
	Max        float64
}

type MobileMoneyService struct {
	mu        sync.RWMutex
	transfers map[string]*MobileMoneyTransfer
	providers []MobileMoneyProvider
}

func NewMobileMoneyService() *MobileMoneyService {
	return &MobileMoneyService{
		transfers: make(map[string]*MobileMoneyTransfer),
		providers: getDefaultProviders(),
	}
}

func getDefaultProviders() []MobileMoneyProvider {
	return []MobileMoneyProvider{
		{
			ID:        "mtn_momo",
			Name:      "MTN Mobile Money",
			ShortName: "MTN MoMo",
			Logo:      "https://example.com/mtn-momo.png",
			MinAmount: 100,
			MaxAmount: 1000000,
			Fee:       0,
			Countries: []string{"NG", "GH", "UG", "CM"},
		},
		{
			ID:        "airtel_money",
			Name:      "Airtel Money",
			ShortName: "Airtel Money",
			Logo:      "https://example.com/airtel-money.png",
			MinAmount: 100,
			MaxAmount: 500000,
			Fee:       0,
			Countries: []string{"NG", "KE", "TZ", "UG"},
		},
		{
			ID:        "glo_cash",
			Name:      "Glo Cash",
			ShortName: "Glo Cash",
			Logo:      "https://example.com/glo-cash.png",
			MinAmount: 100,
			MaxAmount: 300000,
			Fee:       0,
			Countries: []string{"NG"},
		},
	}
}

func (s *MobileMoneyService) GetProviders() []MobileMoneyProvider {
	return s.providers
}

func (s *MobileMoneyService) GetProvider(providerID string) (*MobileMoneyProvider, error) {
	for _, p := range s.providers {
		if p.ID == providerID {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("provider not found: %s", providerID)
}

func (s *MobileMoneyService) ValidateAccount(provider, phoneNumber string) *ValidateAccountResult {
	if !s.validatePhoneNumber(phoneNumber, provider) {
		return &ValidateAccountResult{
			Valid: false,
			Error: "Invalid phone number format",
		}
	}

	return &ValidateAccountResult{
		Valid:         true,
		AccountName:   "Account Holder",
		AccountStatus: "active",
	}
}

func (s *MobileMoneyService) SendTransfer(remittanceID, provider, recipientPhone string, amount float64, narration string) (*MobileMoneyTransfer, error) {
	providerInfo, err := s.GetProvider(provider)
	if err != nil {
		return nil, fmt.Errorf("unsupported mobile money provider: %s", provider)
	}

	if amount < providerInfo.MinAmount || amount > providerInfo.MaxAmount {
		return nil, fmt.Errorf("amount must be between ₦%.0f and ₦%.0f", providerInfo.MinAmount, providerInfo.MaxAmount)
	}

	reference := s.generateReference()
	fee := s.calculateFee(amount, provider)

	transfer := &MobileMoneyTransfer{
		Reference:      reference,
		Provider:       provider,
		RecipientPhone: recipientPhone,
		Amount:         amount,
		Fee:            fee,
		Status:         MobileMoneyStatusSuccessful,
		Message:        "Transfer successful",
		TransactionID:  fmt.Sprintf("TXN%d", time.Now().UnixNano()),
		CreatedAt:      time.Now(),
	}

	s.mu.Lock()
	s.transfers[reference] = transfer
	s.mu.Unlock()

	return transfer, nil
}

func (s *MobileMoneyService) GetTransferStatus(reference string) (*MobileMoneyTransfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	transfer, exists := s.transfers[reference]
	if !exists {
		return &MobileMoneyTransfer{
			Reference: reference,
			Status:    MobileMoneyStatusSuccessful,
			Message:   "Transfer completed",
		}, nil
	}
	return transfer, nil
}

func (s *MobileMoneyService) ReverseTransfer(reference string) (bool, string, string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	transfer, exists := s.transfers[reference]
	if !exists {
		return false, "", "Transfer not found"
	}

	reversalRef := fmt.Sprintf("REV_%s", reference)
	transfer.Status = MobileMoneyStatusFailed
	transfer.Message = "Transfer reversed"

	return true, reversalRef, "Transfer reversed successfully"
}

func (s *MobileMoneyService) DetectProviderFromPhone(phoneNumber string) string {
	cleaned := regexp.MustCompile(`[\s-]`).ReplaceAllString(phoneNumber, "")

	for _, provider := range s.providers {
		if s.validatePhoneNumber(cleaned, provider.ID) {
			return provider.ID
		}
	}
	return ""
}

func (s *MobileMoneyService) GetProviderLimits(provider string) *ProviderLimits {
	limits := map[string]*ProviderLimits{
		"mtn_momo": {
			MinAmount:    100,
			MaxAmount:    1000000,
			DailyLimit:   5000000,
			MonthlyLimit: 20000000,
		},
		"airtel_money": {
			MinAmount:    100,
			MaxAmount:    500000,
			DailyLimit:   2000000,
			MonthlyLimit: 10000000,
		},
		"glo_cash": {
			MinAmount:    100,
			MaxAmount:    300000,
			DailyLimit:   1000000,
			MonthlyLimit: 5000000,
		},
	}

	if l, exists := limits[provider]; exists {
		return l
	}

	return &ProviderLimits{
		MinAmount:    100,
		MaxAmount:    100000,
		DailyLimit:   500000,
		MonthlyLimit: 2000000,
	}
}

func (s *MobileMoneyService) GetTransferHistory(remittanceID, provider string, limit int) []*MobileMoneyTransfer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*MobileMoneyTransfer
	for _, transfer := range s.transfers {
		if provider != "" && transfer.Provider != provider {
			continue
		}
		results = append(results, transfer)
		if limit > 0 && len(results) >= limit {
			break
		}
	}
	return results
}

func (s *MobileMoneyService) calculateFee(amount float64, provider string) float64 {
	feeStructures := map[string]*FeeStructure{
		"mtn_momo":     {Percentage: 0, Min: 0, Max: 0},
		"airtel_money": {Percentage: 0, Min: 0, Max: 0},
		"glo_cash":     {Percentage: 0, Min: 0, Max: 0},
	}

	config, exists := feeStructures[provider]
	if !exists {
		config = &FeeStructure{Percentage: 0, Min: 0, Max: 0}
	}

	calculatedFee := amount * (config.Percentage / 100)
	if calculatedFee < config.Min {
		return config.Min
	}
	if calculatedFee > config.Max {
		return config.Max
	}
	return calculatedFee
}

func (s *MobileMoneyService) validatePhoneNumber(phoneNumber, provider string) bool {
	cleaned := regexp.MustCompile(`[\s-]`).ReplaceAllString(phoneNumber, "")

	providerPrefixes := map[string][]string{
		"mtn_momo":     {"0803", "0806", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"},
		"airtel_money": {"0802", "0808", "0812", "0901", "0902", "0904", "0907", "0912"},
		"glo_cash":     {"0805", "0807", "0811", "0815", "0905", "0915"},
	}

	prefixes, exists := providerPrefixes[provider]
	if !exists {
		return false
	}

	if len(cleaned) != 11 {
		return false
	}

	for _, prefix := range prefixes {
		if len(cleaned) >= len(prefix) && cleaned[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}

func (s *MobileMoneyService) generateReference() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("MOMO_%d_%s", time.Now().UnixNano(), hex.EncodeToString(bytes)[:9])
}
