package pricing

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

type PricingTier string

const (
	TierStarter    PricingTier = "starter"
	TierGrowth     PricingTier = "growth"
	TierEnterprise PricingTier = "enterprise"
	TierCustom     PricingTier = "custom"
)

type FeeType string

const (
	FeeTypePercentage FeeType = "percentage"
	FeeTypeFixed      FeeType = "fixed"
	FeeTypeHybrid     FeeType = "hybrid"
)

type PaymentMethod string

const (
	PaymentMethodCard         PaymentMethod = "card"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodUSSD         PaymentMethod = "ussd"
	PaymentMethodQR           PaymentMethod = "qr"
	PaymentMethodMobileMoney  PaymentMethod = "mobile_money"
	PaymentMethodCrypto       PaymentMethod = "crypto"
)

type FeeRule struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	MerchantID     string            `json:"merchant_id,omitempty"`
	Tier           PricingTier       `json:"tier"`
	PaymentMethod  PaymentMethod     `json:"payment_method"`
	Currency       string            `json:"currency"`
	Corridor       string            `json:"corridor,omitempty"`
	FeeType        FeeType           `json:"fee_type"`
	PercentageRate float64           `json:"percentage_rate"`
	FixedAmount    float64           `json:"fixed_amount"`
	MinFee         float64           `json:"min_fee"`
	MaxFee         float64           `json:"max_fee"`
	MinAmount      float64           `json:"min_amount"`
	MaxAmount      float64           `json:"max_amount"`
	TimeOfDayStart int               `json:"time_of_day_start"`
	TimeOfDayEnd   int               `json:"time_of_day_end"`
	DaysOfWeek     []int             `json:"days_of_week"`
	Priority       int               `json:"priority"`
	Enabled        bool              `json:"enabled"`
	EffectiveFrom  time.Time         `json:"effective_from"`
	EffectiveTo    *time.Time        `json:"effective_to,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

type FeeCalculation struct {
	RuleID            string    `json:"rule_id"`
	RuleName          string    `json:"rule_name"`
	TransactionAmount float64   `json:"transaction_amount"`
	Currency          string    `json:"currency"`
	FeeAmount         float64   `json:"fee_amount"`
	FeePercentage     float64   `json:"fee_percentage"`
	FixedComponent    float64   `json:"fixed_component"`
	NetAmount         float64   `json:"net_amount"`
	CalculatedAt      time.Time `json:"calculated_at"`
}

type MerchantPricing struct {
	MerchantID      string            `json:"merchant_id"`
	MerchantName    string            `json:"merchant_name"`
	Tier            PricingTier       `json:"tier"`
	CustomRules     []string          `json:"custom_rules"`
	VolumeDiscounts []VolumeDiscount  `json:"volume_discounts"`
	EffectiveFrom   time.Time         `json:"effective_from"`
	EffectiveTo     *time.Time        `json:"effective_to,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

type VolumeDiscount struct {
	MinVolume       float64 `json:"min_volume"`
	MaxVolume       float64 `json:"max_volume"`
	DiscountPercent float64 `json:"discount_percent"`
}

type PricingEngine struct {
	mu              sync.RWMutex
	feeRules        map[string]*FeeRule
	merchantPricing map[string]*MerchantPricing
	calculations    []FeeCalculation
	eventHandlers   map[string][]func(interface{})
}

func NewPricingEngine() *PricingEngine {
	pe := &PricingEngine{
		feeRules:        make(map[string]*FeeRule),
		merchantPricing: make(map[string]*MerchantPricing),
		calculations:    make([]FeeCalculation, 0),
		eventHandlers:   make(map[string][]func(interface{})),
	}
	pe.initializeDefaultRules()
	return pe
}

func (pe *PricingEngine) initializeDefaultRules() {
	defaultRules := []struct {
		Name           string
		Tier           PricingTier
		PaymentMethod  PaymentMethod
		Currency       string
		FeeType        FeeType
		PercentageRate float64
		FixedAmount    float64
		MinFee         float64
		MaxFee         float64
	}{
		{"Card Payment - Starter", TierStarter, PaymentMethodCard, "NGN", FeeTypeHybrid, 1.5, 100, 100, 2000},
		{"Card Payment - Growth", TierGrowth, PaymentMethodCard, "NGN", FeeTypeHybrid, 1.4, 100, 100, 2000},
		{"Card Payment - Enterprise", TierEnterprise, PaymentMethodCard, "NGN", FeeTypeHybrid, 1.2, 50, 50, 2000},
		{"Bank Transfer - Starter", TierStarter, PaymentMethodBankTransfer, "NGN", FeeTypeFixed, 0, 50, 50, 50},
		{"Bank Transfer - Growth", TierGrowth, PaymentMethodBankTransfer, "NGN", FeeTypeFixed, 0, 35, 35, 35},
		{"Bank Transfer - Enterprise", TierEnterprise, PaymentMethodBankTransfer, "NGN", FeeTypeFixed, 0, 25, 25, 25},
		{"USSD - Starter", TierStarter, PaymentMethodUSSD, "NGN", FeeTypeHybrid, 1.5, 50, 50, 1500},
		{"USSD - Growth", TierGrowth, PaymentMethodUSSD, "NGN", FeeTypeHybrid, 1.4, 50, 50, 1500},
		{"QR Payment - Starter", TierStarter, PaymentMethodQR, "NGN", FeeTypePercentage, 0.5, 0, 25, 500},
		{"QR Payment - Growth", TierGrowth, PaymentMethodQR, "NGN", FeeTypePercentage, 0.4, 0, 25, 500},
		{"Mobile Money - Starter", TierStarter, PaymentMethodMobileMoney, "NGN", FeeTypeHybrid, 1.0, 25, 25, 1000},
		{"Crypto - Starter", TierStarter, PaymentMethodCrypto, "USD", FeeTypePercentage, 1.0, 0, 1, 100},
		{"Crypto - Enterprise", TierEnterprise, PaymentMethodCrypto, "USD", FeeTypePercentage, 0.5, 0, 0.5, 50},
	}

	for i, rule := range defaultRules {
		pe.AddFeeRule(&FeeRule{
			Name:           rule.Name,
			Tier:           rule.Tier,
			PaymentMethod:  rule.PaymentMethod,
			Currency:       rule.Currency,
			FeeType:        rule.FeeType,
			PercentageRate: rule.PercentageRate,
			FixedAmount:    rule.FixedAmount,
			MinFee:         rule.MinFee,
			MaxFee:         rule.MaxFee,
			Priority:       i + 1,
			Enabled:        true,
			EffectiveFrom:  time.Now(),
		})
	}
}

func (pe *PricingEngine) On(event string, handler func(interface{})) {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	pe.eventHandlers[event] = append(pe.eventHandlers[event], handler)
}

func (pe *PricingEngine) emit(event string, data interface{}) {
	pe.mu.RLock()
	handlers := pe.eventHandlers[event]
	pe.mu.RUnlock()

	for _, handler := range handlers {
		go handler(data)
	}
}

func (pe *PricingEngine) AddFeeRule(rule *FeeRule) (*FeeRule, error) {
	pe.mu.Lock()
	defer pe.mu.Unlock()

	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()

	pe.feeRules[rule.ID] = rule
	pe.emit("ruleAdded", rule)
	return rule, nil
}

func (pe *PricingEngine) UpdateFeeRule(ruleID string, updates map[string]interface{}) (*FeeRule, error) {
	pe.mu.Lock()
	defer pe.mu.Unlock()

	rule, ok := pe.feeRules[ruleID]
	if !ok {
		return nil, errors.New("rule not found")
	}

	if name, ok := updates["name"].(string); ok {
		rule.Name = name
	}
	if percentageRate, ok := updates["percentage_rate"].(float64); ok {
		rule.PercentageRate = percentageRate
	}
	if fixedAmount, ok := updates["fixed_amount"].(float64); ok {
		rule.FixedAmount = fixedAmount
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		rule.Enabled = enabled
	}

	rule.UpdatedAt = time.Now()
	pe.emit("ruleUpdated", rule)
	return rule, nil
}

func (pe *PricingEngine) DeleteFeeRule(ruleID string) error {
	pe.mu.Lock()
	defer pe.mu.Unlock()

	if _, ok := pe.feeRules[ruleID]; !ok {
		return errors.New("rule not found")
	}

	delete(pe.feeRules, ruleID)
	pe.emit("ruleDeleted", ruleID)
	return nil
}

func (pe *PricingEngine) GetFeeRule(ruleID string) (*FeeRule, error) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	rule, ok := pe.feeRules[ruleID]
	if !ok {
		return nil, errors.New("rule not found")
	}
	return rule, nil
}

func (pe *PricingEngine) ListFeeRules(filters map[string]interface{}) []*FeeRule {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	rules := make([]*FeeRule, 0)
	for _, rule := range pe.feeRules {
		if !rule.Enabled {
			continue
		}

		if tier, ok := filters["tier"].(PricingTier); ok && rule.Tier != tier {
			continue
		}
		if method, ok := filters["payment_method"].(PaymentMethod); ok && rule.PaymentMethod != method {
			continue
		}
		if currency, ok := filters["currency"].(string); ok && rule.Currency != currency {
			continue
		}
		if merchantID, ok := filters["merchant_id"].(string); ok && rule.MerchantID != "" && rule.MerchantID != merchantID {
			continue
		}

		rules = append(rules, rule)
	}

	return rules
}

type CalculateFeeParams struct {
	MerchantID    string
	Amount        float64
	Currency      string
	PaymentMethod PaymentMethod
	Corridor      string
	Timestamp     time.Time
}

func (pe *PricingEngine) CalculateFee(ctx context.Context, params CalculateFeeParams) (*FeeCalculation, error) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	tier := pe.getMerchantTier(params.MerchantID)

	var bestRule *FeeRule
	bestPriority := 999999

	for _, rule := range pe.feeRules {
		if !pe.ruleMatches(rule, params, tier) {
			continue
		}

		if rule.Priority < bestPriority {
			bestRule = rule
			bestPriority = rule.Priority
		}
	}

	if bestRule == nil {
		return nil, errors.New("no matching fee rule found")
	}

	feeAmount := pe.calculateFeeAmount(bestRule, params.Amount)

	volumeDiscount := pe.getVolumeDiscount(params.MerchantID, params.Amount)
	if volumeDiscount > 0 {
		feeAmount = feeAmount * (1 - volumeDiscount/100)
	}

	calculation := &FeeCalculation{
		RuleID:            bestRule.ID,
		RuleName:          bestRule.Name,
		TransactionAmount: params.Amount,
		Currency:          params.Currency,
		FeeAmount:         feeAmount,
		FeePercentage:     (feeAmount / params.Amount) * 100,
		FixedComponent:    bestRule.FixedAmount,
		NetAmount:         params.Amount - feeAmount,
		CalculatedAt:      time.Now(),
	}

	pe.calculations = append(pe.calculations, *calculation)
	pe.emit("feeCalculated", calculation)

	return calculation, nil
}

func (pe *PricingEngine) getMerchantTier(merchantID string) PricingTier {
	if pricing, ok := pe.merchantPricing[merchantID]; ok {
		return pricing.Tier
	}
	return TierStarter
}

func (pe *PricingEngine) ruleMatches(rule *FeeRule, params CalculateFeeParams, tier PricingTier) bool {
	if !rule.Enabled {
		return false
	}

	now := time.Now()
	if rule.EffectiveFrom.After(now) {
		return false
	}
	if rule.EffectiveTo != nil && rule.EffectiveTo.Before(now) {
		return false
	}

	if rule.Tier != tier {
		return false
	}

	if rule.PaymentMethod != params.PaymentMethod {
		return false
	}

	if rule.Currency != params.Currency {
		return false
	}

	if rule.MerchantID != "" && rule.MerchantID != params.MerchantID {
		return false
	}

	if rule.Corridor != "" && rule.Corridor != params.Corridor {
		return false
	}

	if rule.MinAmount > 0 && params.Amount < rule.MinAmount {
		return false
	}
	if rule.MaxAmount > 0 && params.Amount > rule.MaxAmount {
		return false
	}

	hour := params.Timestamp.Hour()
	if rule.TimeOfDayStart > 0 || rule.TimeOfDayEnd > 0 {
		if hour < rule.TimeOfDayStart || hour > rule.TimeOfDayEnd {
			return false
		}
	}

	if len(rule.DaysOfWeek) > 0 {
		dayOfWeek := int(params.Timestamp.Weekday())
		found := false
		for _, d := range rule.DaysOfWeek {
			if d == dayOfWeek {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

func (pe *PricingEngine) calculateFeeAmount(rule *FeeRule, amount float64) float64 {
	var fee float64

	switch rule.FeeType {
	case FeeTypePercentage:
		fee = amount * (rule.PercentageRate / 100)
	case FeeTypeFixed:
		fee = rule.FixedAmount
	case FeeTypeHybrid:
		fee = amount*(rule.PercentageRate/100) + rule.FixedAmount
	}

	if rule.MinFee > 0 && fee < rule.MinFee {
		fee = rule.MinFee
	}
	if rule.MaxFee > 0 && fee > rule.MaxFee {
		fee = rule.MaxFee
	}

	return fee
}

func (pe *PricingEngine) getVolumeDiscount(merchantID string, amount float64) float64 {
	pricing, ok := pe.merchantPricing[merchantID]
	if !ok {
		return 0
	}

	for _, discount := range pricing.VolumeDiscounts {
		if amount >= discount.MinVolume && (discount.MaxVolume == 0 || amount <= discount.MaxVolume) {
			return discount.DiscountPercent
		}
	}

	return 0
}

func (pe *PricingEngine) SetMerchantPricing(pricing *MerchantPricing) error {
	pe.mu.Lock()
	defer pe.mu.Unlock()

	pe.merchantPricing[pricing.MerchantID] = pricing
	pe.emit("merchantPricingUpdated", pricing)
	return nil
}

func (pe *PricingEngine) GetMerchantPricing(merchantID string) (*MerchantPricing, error) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	pricing, ok := pe.merchantPricing[merchantID]
	if !ok {
		return nil, errors.New("merchant pricing not found")
	}
	return pricing, nil
}

type PricingStats struct {
	TotalCalculations int                `json:"total_calculations"`
	TotalFeeCollected float64            `json:"total_fee_collected"`
	AvgFeePercentage  float64            `json:"avg_fee_percentage"`
	ByPaymentMethod   map[string]float64 `json:"by_payment_method"`
	ByTier            map[string]float64 `json:"by_tier"`
	TopRules          []RuleUsage        `json:"top_rules"`
}

type RuleUsage struct {
	RuleID   string  `json:"rule_id"`
	RuleName string  `json:"rule_name"`
	Count    int     `json:"count"`
	TotalFee float64 `json:"total_fee"`
}

func (pe *PricingEngine) GetStats() *PricingStats {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	stats := &PricingStats{
		TotalCalculations: len(pe.calculations),
		ByPaymentMethod:   make(map[string]float64),
		ByTier:            make(map[string]float64),
	}

	ruleUsage := make(map[string]*RuleUsage)
	var totalFeePercentage float64

	for _, calc := range pe.calculations {
		stats.TotalFeeCollected += calc.FeeAmount
		totalFeePercentage += calc.FeePercentage

		if _, ok := ruleUsage[calc.RuleID]; !ok {
			ruleUsage[calc.RuleID] = &RuleUsage{
				RuleID:   calc.RuleID,
				RuleName: calc.RuleName,
			}
		}
		ruleUsage[calc.RuleID].Count++
		ruleUsage[calc.RuleID].TotalFee += calc.FeeAmount
	}

	if len(pe.calculations) > 0 {
		stats.AvgFeePercentage = totalFeePercentage / float64(len(pe.calculations))
	}

	for _, usage := range ruleUsage {
		stats.TopRules = append(stats.TopRules, *usage)
	}

	return stats
}

func (pe *PricingEngine) SimulateFee(params CalculateFeeParams) (*FeeCalculation, error) {
	return pe.CalculateFee(context.Background(), params)
}

func (pe *PricingEngine) GetPricingSchedule(merchantID string) ([]map[string]interface{}, error) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	tier := pe.getMerchantTier(merchantID)
	schedule := make([]map[string]interface{}, 0)

	for _, rule := range pe.feeRules {
		if rule.Tier != tier || !rule.Enabled {
			continue
		}

		schedule = append(schedule, map[string]interface{}{
			"payment_method":  rule.PaymentMethod,
			"currency":        rule.Currency,
			"fee_type":        rule.FeeType,
			"percentage_rate": rule.PercentageRate,
			"fixed_amount":    rule.FixedAmount,
			"min_fee":         rule.MinFee,
			"max_fee":         rule.MaxFee,
		})
	}

	return schedule, nil
}
