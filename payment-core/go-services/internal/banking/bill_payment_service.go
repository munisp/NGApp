package banking

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type BillFieldType string

const (
	BillFieldText   BillFieldType = "text"
	BillFieldNumber BillFieldType = "number"
	BillFieldSelect BillFieldType = "select"
)

type BillFieldOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type BillField struct {
	Name       string            `json:"name"`
	Label      string            `json:"label"`
	Type       BillFieldType     `json:"type"`
	Required   bool              `json:"required"`
	Validation string            `json:"validation,omitempty"`
	Options    []BillFieldOption `json:"options,omitempty"`
}

type BillProvider struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	CategoryID string      `json:"categoryId"`
	Logo       string      `json:"logo"`
	Fields     []BillField `json:"fields"`
}

type BillCategory struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Providers   []BillProvider `json:"providers"`
}

type BillPaymentStatus string

const (
	BillPaymentSuccessful BillPaymentStatus = "successful"
	BillPaymentPending    BillPaymentStatus = "pending"
	BillPaymentFailed     BillPaymentStatus = "failed"
)

type BillPaymentResult struct {
	Reference string            `json:"reference"`
	Status    BillPaymentStatus `json:"status"`
	Amount    float64           `json:"amount"`
	Fee       float64           `json:"fee"`
	Token     string            `json:"token,omitempty"`
	Message   string            `json:"message"`
	CreatedAt time.Time         `json:"createdAt"`
}

type ValidateBillResult struct {
	Valid        bool    `json:"valid"`
	CustomerName string  `json:"customerName,omitempty"`
	DueAmount    float64 `json:"dueAmount,omitempty"`
	Error        string  `json:"error,omitempty"`
}

type BillPaymentService struct {
	mu         sync.RWMutex
	payments   map[string]*BillPaymentResult
	categories []BillCategory
}

func NewBillPaymentService() *BillPaymentService {
	return &BillPaymentService{
		payments:   make(map[string]*BillPaymentResult),
		categories: getDefaultBillCategories(),
	}
}

func getDefaultBillCategories() []BillCategory {
	return []BillCategory{
		{
			ID:          "electricity",
			Name:        "Electricity",
			Description: "Pay electricity bills for all DISCOs",
			Providers:   getElectricityProviders(),
		},
		{
			ID:          "cable_tv",
			Name:        "Cable TV",
			Description: "Subscribe to DStv, GOtv, Startimes",
			Providers:   getCableTVProviders(),
		},
		{
			ID:          "airtime",
			Name:        "Airtime",
			Description: "Buy airtime for MTN, Airtel, Glo, 9mobile",
			Providers:   getAirtimeProviders(),
		},
		{
			ID:          "data",
			Name:        "Data Bundles",
			Description: "Purchase data bundles",
			Providers:   getDataProviders(),
		},
		{
			ID:          "internet",
			Name:        "Internet",
			Description: "Pay for internet services",
			Providers:   getInternetProviders(),
		},
	}
}

func getElectricityProviders() []BillProvider {
	meterTypeOptions := []BillFieldOption{
		{Value: "prepaid", Label: "Prepaid"},
		{Value: "postpaid", Label: "Postpaid"},
	}

	return []BillProvider{
		{
			ID:         "ekedc",
			Name:       "Eko Electricity (EKEDC)",
			CategoryID: "electricity",
			Logo:       "https://example.com/ekedc.png",
			Fields: []BillField{
				{Name: "meterNumber", Label: "Meter Number", Type: BillFieldText, Required: true},
				{Name: "meterType", Label: "Meter Type", Type: BillFieldSelect, Required: true, Options: meterTypeOptions},
				{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true},
			},
		},
		{
			ID:         "ikedc",
			Name:       "Ikeja Electric (IKEDC)",
			CategoryID: "electricity",
			Logo:       "https://example.com/ikedc.png",
			Fields: []BillField{
				{Name: "meterNumber", Label: "Meter Number", Type: BillFieldText, Required: true},
				{Name: "meterType", Label: "Meter Type", Type: BillFieldSelect, Required: true, Options: meterTypeOptions},
				{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true},
			},
		},
		{
			ID:         "aedc",
			Name:       "Abuja Electricity (AEDC)",
			CategoryID: "electricity",
			Logo:       "https://example.com/aedc.png",
			Fields: []BillField{
				{Name: "meterNumber", Label: "Meter Number", Type: BillFieldText, Required: true},
				{Name: "meterType", Label: "Meter Type", Type: BillFieldSelect, Required: true, Options: meterTypeOptions},
				{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true},
			},
		},
	}
}

func getCableTVProviders() []BillProvider {
	return []BillProvider{
		{
			ID:         "dstv",
			Name:       "DStv",
			CategoryID: "cable_tv",
			Logo:       "https://example.com/dstv.png",
			Fields: []BillField{
				{Name: "smartCardNumber", Label: "Smart Card Number", Type: BillFieldText, Required: true},
				{Name: "package", Label: "Package", Type: BillFieldSelect, Required: true, Options: []BillFieldOption{
					{Value: "compact", Label: "DStv Compact - ₦10,500"},
					{Value: "compact_plus", Label: "DStv Compact Plus - ₦16,200"},
					{Value: "premium", Label: "DStv Premium - ₦24,500"},
				}},
			},
		},
		{
			ID:         "gotv",
			Name:       "GOtv",
			CategoryID: "cable_tv",
			Logo:       "https://example.com/gotv.png",
			Fields: []BillField{
				{Name: "iucNumber", Label: "IUC Number", Type: BillFieldText, Required: true},
				{Name: "package", Label: "Package", Type: BillFieldSelect, Required: true, Options: []BillFieldOption{
					{Value: "jinja", Label: "GOtv Jinja - ₦3,300"},
					{Value: "jolli", Label: "GOtv Jolli - ₦4,850"},
					{Value: "max", Label: "GOtv Max - ₦7,200"},
				}},
			},
		},
		{
			ID:         "startimes",
			Name:       "Startimes",
			CategoryID: "cable_tv",
			Logo:       "https://example.com/startimes.png",
			Fields: []BillField{
				{Name: "smartCardNumber", Label: "Smart Card Number", Type: BillFieldText, Required: true},
				{Name: "package", Label: "Package", Type: BillFieldSelect, Required: true, Options: []BillFieldOption{
					{Value: "basic", Label: "Basic - ₦2,600"},
					{Value: "smart", Label: "Smart - ₦3,200"},
					{Value: "classic", Label: "Classic - ₦4,200"},
				}},
			},
		},
	}
}

func getAirtimeProviders() []BillProvider {
	phoneField := BillField{Name: "phoneNumber", Label: "Phone Number", Type: BillFieldText, Required: true, Validation: `^0[789][01]\d{8}$`}
	amountField := BillField{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true}

	return []BillProvider{
		{ID: "mtn", Name: "MTN", CategoryID: "airtime", Logo: "https://example.com/mtn.png", Fields: []BillField{phoneField, amountField}},
		{ID: "airtel", Name: "Airtel", CategoryID: "airtime", Logo: "https://example.com/airtel.png", Fields: []BillField{phoneField, amountField}},
		{ID: "glo", Name: "Glo", CategoryID: "airtime", Logo: "https://example.com/glo.png", Fields: []BillField{phoneField, amountField}},
		{ID: "9mobile", Name: "9mobile", CategoryID: "airtime", Logo: "https://example.com/9mobile.png", Fields: []BillField{phoneField, amountField}},
	}
}

func getDataProviders() []BillProvider {
	phoneField := BillField{Name: "phoneNumber", Label: "Phone Number", Type: BillFieldText, Required: true}
	bundleField := BillField{Name: "bundle", Label: "Data Bundle", Type: BillFieldSelect, Required: true, Options: []BillFieldOption{
		{Value: "1gb", Label: "1GB - ₦500"},
		{Value: "2gb", Label: "2GB - ₦1,000"},
		{Value: "5gb", Label: "5GB - ₦2,000"},
		{Value: "10gb", Label: "10GB - ₦3,500"},
	}}

	return []BillProvider{
		{ID: "mtn", Name: "MTN", CategoryID: "data", Logo: "https://example.com/mtn.png", Fields: []BillField{phoneField, bundleField}},
		{ID: "airtel", Name: "Airtel", CategoryID: "data", Logo: "https://example.com/airtel.png", Fields: []BillField{phoneField, bundleField}},
		{ID: "glo", Name: "Glo", CategoryID: "data", Logo: "https://example.com/glo.png", Fields: []BillField{phoneField, bundleField}},
		{ID: "9mobile", Name: "9mobile", CategoryID: "data", Logo: "https://example.com/9mobile.png", Fields: []BillField{phoneField, bundleField}},
	}
}

func getInternetProviders() []BillProvider {
	return []BillProvider{
		{
			ID:         "smile",
			Name:       "Smile",
			CategoryID: "internet",
			Logo:       "https://example.com/smile.png",
			Fields: []BillField{
				{Name: "accountNumber", Label: "Account Number", Type: BillFieldText, Required: true},
				{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true},
			},
		},
		{
			ID:         "spectranet",
			Name:       "Spectranet",
			CategoryID: "internet",
			Logo:       "https://example.com/spectranet.png",
			Fields: []BillField{
				{Name: "accountNumber", Label: "Account Number", Type: BillFieldText, Required: true},
				{Name: "amount", Label: "Amount", Type: BillFieldNumber, Required: true},
			},
		},
	}
}

func (s *BillPaymentService) GetCategories() []BillCategory {
	return s.categories
}

func (s *BillPaymentService) GetCategory(categoryID string) *BillCategory {
	for _, cat := range s.categories {
		if cat.ID == categoryID {
			return &cat
		}
	}
	return nil
}

func (s *BillPaymentService) GetProvider(providerID string) *BillProvider {
	for _, cat := range s.categories {
		for _, provider := range cat.Providers {
			if provider.ID == providerID {
				return &provider
			}
		}
	}
	return nil
}

func (s *BillPaymentService) ValidateBillDetails(providerID string, fields map[string]string) *ValidateBillResult {
	return &ValidateBillResult{
		Valid:        true,
		CustomerName: "Customer Name",
		DueAmount:    5000,
	}
}

func (s *BillPaymentService) ProcessPayment(remittanceID, providerID, categoryID string, fields map[string]string, amount float64) (*BillPaymentResult, error) {
	reference := s.generateReference()
	fee := s.calculateFee(amount, categoryID)

	result := &BillPaymentResult{
		Reference: reference,
		Status:    BillPaymentSuccessful,
		Amount:    amount,
		Fee:       fee,
		Message:   "Payment successful",
		CreatedAt: time.Now(),
	}

	if categoryID == "electricity" && fields["meterType"] == "prepaid" {
		result.Token = s.generateElectricityToken()
	} else if categoryID == "airtime" {
		result.Token = "Airtime credited successfully"
	}

	s.mu.Lock()
	s.payments[reference] = result
	s.mu.Unlock()

	return result, nil
}

func (s *BillPaymentService) GetPaymentStatus(reference string) (*BillPaymentResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	payment, exists := s.payments[reference]
	if !exists {
		return &BillPaymentResult{
			Reference: reference,
			Status:    BillPaymentSuccessful,
			Message:   "Payment completed",
		}, nil
	}
	return payment, nil
}

func (s *BillPaymentService) GetPaymentHistory(remittanceID, providerID string, limit int) []*BillPaymentResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*BillPaymentResult
	for _, payment := range s.payments {
		results = append(results, payment)
		if limit > 0 && len(results) >= limit {
			break
		}
	}
	return results
}

func (s *BillPaymentService) calculateFee(amount float64, categoryID string) float64 {
	feeStructures := map[string]*FeeStructure{
		"electricity": {Percentage: 1.0, Min: 50, Max: 500},
		"cable_tv":    {Percentage: 0.5, Min: 30, Max: 200},
		"airtime":     {Percentage: 0, Min: 0, Max: 0},
		"data":        {Percentage: 0, Min: 0, Max: 0},
		"internet":    {Percentage: 1.0, Min: 50, Max: 300},
	}

	config, exists := feeStructures[categoryID]
	if !exists {
		config = &FeeStructure{Percentage: 1.0, Min: 50, Max: 500}
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

func (s *BillPaymentService) generateReference() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("BILL_%d_%s", time.Now().UnixNano(), hex.EncodeToString(bytes)[:9])
}

func (s *BillPaymentService) generateElectricityToken() string {
	var parts []string
	for i := 0; i < 4; i++ {
		b := make([]byte, 2)
		rand.Read(b)
		num := 10000 + int(b[0])*256 + int(b[1])
		if num > 99999 {
			num = num % 90000 + 10000
		}
		parts = append(parts, fmt.Sprintf("%05d", num))
	}
	return fmt.Sprintf("%s-%s-%s-%s", parts[0], parts[1], parts[2], parts[3])
}
