package fxrisk

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"sync"
	"time"
)

type RateLockStatus string

const (
	RateLockActive    RateLockStatus = "active"
	RateLockUsed      RateLockStatus = "used"
	RateLockExpired   RateLockStatus = "expired"
	RateLockCancelled RateLockStatus = "cancelled"
)

type RateLock struct {
	ID             string                 `json:"id"`
	CustomerID     string                 `json:"customerId"`
	SourceCurrency string                 `json:"sourceCurrency"`
	TargetCurrency string                 `json:"targetCurrency"`
	LockedRate     float64                `json:"lockedRate"`
	Amount         float64                `json:"amount"`
	ExpiresAt      time.Time              `json:"expiresAt"`
	Status         RateLockStatus         `json:"status"`
	UsedAt         *time.Time             `json:"usedAt,omitempty"`
	TransactionID  string                 `json:"transactionId,omitempty"`
	CreatedAt      time.Time              `json:"createdAt"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type FXExposure struct {
	Currency       string    `json:"currency"`
	LongPosition   float64   `json:"longPosition"`
	ShortPosition  float64   `json:"shortPosition"`
	NetPosition    float64   `json:"netPosition"`
	UnrealizedPnL  float64   `json:"unrealizedPnL"`
	LastUpdated    time.Time `json:"lastUpdated"`
}

type HedgeType string

const (
	HedgeTypeForward HedgeType = "forward"
	HedgeTypeOption  HedgeType = "option"
	HedgeTypeSwap    HedgeType = "swap"
)

type HedgeStatus string

const (
	HedgeStatusOpen      HedgeStatus = "open"
	HedgeStatusSettled   HedgeStatus = "settled"
	HedgeStatusCancelled HedgeStatus = "cancelled"
)

type HedgePosition struct {
	ID               string      `json:"id"`
	Currency         string      `json:"currency"`
	Type             HedgeType   `json:"type"`
	NotionalAmount   float64     `json:"notionalAmount"`
	StrikeRate       float64     `json:"strikeRate,omitempty"`
	MaturityDate     time.Time   `json:"maturityDate"`
	Counterparty     string      `json:"counterparty"`
	Status           HedgeStatus `json:"status"`
	CreatedAt        time.Time   `json:"createdAt"`
	SettledAt        *time.Time  `json:"settledAt,omitempty"`
	SettlementAmount float64     `json:"settlementAmount,omitempty"`
}

type VolatilityDirection string

const (
	VolatilityUp   VolatilityDirection = "up"
	VolatilityDown VolatilityDirection = "down"
	VolatilityBoth VolatilityDirection = "both"
)

type VolatilityAlert struct {
	ID                string              `json:"id"`
	CurrencyPair      string              `json:"currencyPair"`
	Threshold         float64             `json:"threshold"`
	Direction         VolatilityDirection `json:"direction"`
	CurrentVolatility float64             `json:"currentVolatility"`
	Triggered         bool                `json:"triggered"`
	TriggeredAt       *time.Time          `json:"triggeredAt,omitempty"`
	NotificationSent  bool                `json:"notificationSent"`
	CreatedAt         time.Time           `json:"createdAt"`
}

type RateHistory struct {
	CurrencyPair string    `json:"currencyPair"`
	Rate         float64   `json:"rate"`
	Timestamp    time.Time `json:"timestamp"`
	Source       string    `json:"source"`
}

type FXRiskMetrics struct {
	TotalExposure     float64 `json:"totalExposure"`
	HedgedExposure    float64 `json:"hedgedExposure"`
	UnhedgedExposure  float64 `json:"unhedgedExposure"`
	HedgeRatio        float64 `json:"hedgeRatio"`
	ValueAtRisk       float64 `json:"valueAtRisk"`
	ExpectedShortfall float64 `json:"expectedShortfall"`
	Volatility        float64 `json:"volatility"`
}

type FXRiskConfig struct {
	DefaultLockDurationMinutes int     `json:"defaultLockDurationMinutes"`
	MaxLockDurationMinutes     int     `json:"maxLockDurationMinutes"`
	HedgeThresholdAmount       float64 `json:"hedgeThresholdAmount"`
	VolatilityAlertThreshold   float64 `json:"volatilityAlertThreshold"`
	MaxUnhedgedExposure        float64 `json:"maxUnhedgedExposure"`
	RateMarkup                 float64 `json:"rateMarkup"`
}

type FXRiskManagementService struct {
	mu               sync.RWMutex
	rateLocks        map[string]*RateLock
	exposures        map[string]*FXExposure
	hedgePositions   map[string]*HedgePosition
	volatilityAlerts map[string]*VolatilityAlert
	rateHistory      []*RateHistory
	currentRates     map[string]float64
	config           FXRiskConfig
}

func NewFXRiskManagementService(config *FXRiskConfig) *FXRiskManagementService {
	if config == nil {
		config = &FXRiskConfig{
			DefaultLockDurationMinutes: 15,
			MaxLockDurationMinutes:     60,
			HedgeThresholdAmount:       10000000,
			VolatilityAlertThreshold:   0.02,
			MaxUnhedgedExposure:        50000000,
			RateMarkup:                 0.005,
		}
	}

	s := &FXRiskManagementService{
		rateLocks:        make(map[string]*RateLock),
		exposures:        make(map[string]*FXExposure),
		hedgePositions:   make(map[string]*HedgePosition),
		volatilityAlerts: make(map[string]*VolatilityAlert),
		rateHistory:      make([]*RateHistory, 0),
		currentRates:     make(map[string]float64),
		config:           *config,
	}

	s.initializeRates()
	go s.startExpirationChecker()

	return s
}

func (s *FXRiskManagementService) initializeRates() {
	s.currentRates["BTC/NGN"] = 150000000
	s.currentRates["ETH/NGN"] = 8000000
	s.currentRates["USDC/NGN"] = 1650
	s.currentRates["USDT/NGN"] = 1650
	s.currentRates["USD/NGN"] = 1650
	s.currentRates["EUR/NGN"] = 1800
	s.currentRates["GBP/NGN"] = 2100
}

func (s *FXRiskManagementService) GetCurrentRate(sourceCurrency, targetCurrency string) (float64, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pair := fmt.Sprintf("%s/%s", sourceCurrency, targetCurrency)
	if rate, exists := s.currentRates[pair]; exists {
		return rate, true
	}

	inversePair := fmt.Sprintf("%s/%s", targetCurrency, sourceCurrency)
	if inverseRate, exists := s.currentRates[inversePair]; exists {
		return 1 / inverseRate, true
	}

	return 0, false
}

func (s *FXRiskManagementService) UpdateRate(sourceCurrency, targetCurrency string, rate float64, source string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pair := fmt.Sprintf("%s/%s", sourceCurrency, targetCurrency)
	oldRate := s.currentRates[pair]

	s.currentRates[pair] = rate

	s.rateHistory = append(s.rateHistory, &RateHistory{
		CurrencyPair: pair,
		Rate:         rate,
		Timestamp:    time.Now(),
		Source:       source,
	})

	pairHistoryCount := 0
	for _, h := range s.rateHistory {
		if h.CurrencyPair == pair {
			pairHistoryCount++
		}
	}
	if pairHistoryCount > 1000 {
		var newHistory []*RateHistory
		count := 0
		for i := len(s.rateHistory) - 1; i >= 0; i-- {
			if s.rateHistory[i].CurrencyPair == pair {
				count++
				if count <= 1000 {
					newHistory = append([]*RateHistory{s.rateHistory[i]}, newHistory...)
				}
			} else {
				newHistory = append([]*RateHistory{s.rateHistory[i]}, newHistory...)
			}
		}
		s.rateHistory = newHistory
	}

	if oldRate > 0 {
		change := math.Abs((rate - oldRate) / oldRate)
		s.checkVolatilityAlerts(pair, change)
	}
}

func (s *FXRiskManagementService) CreateRateLock(customerID, sourceCurrency, targetCurrency string, amount float64, durationMinutes int, metadata map[string]interface{}) (*RateLock, error) {
	if durationMinutes <= 0 {
		durationMinutes = s.config.DefaultLockDurationMinutes
	}
	if durationMinutes > s.config.MaxLockDurationMinutes {
		durationMinutes = s.config.MaxLockDurationMinutes
	}

	currentRate, exists := s.GetCurrentRate(sourceCurrency, targetCurrency)
	if !exists {
		return nil, fmt.Errorf("no rate available for %s/%s", sourceCurrency, targetCurrency)
	}

	lockedRate := currentRate * (1 + s.config.RateMarkup)

	rateLock := &RateLock{
		ID:             s.generateID("RL"),
		CustomerID:     customerID,
		SourceCurrency: sourceCurrency,
		TargetCurrency: targetCurrency,
		LockedRate:     lockedRate,
		Amount:         amount,
		ExpiresAt:      time.Now().Add(time.Duration(durationMinutes) * time.Minute),
		Status:         RateLockActive,
		CreatedAt:      time.Now(),
		Metadata:       metadata,
	}

	s.mu.Lock()
	s.rateLocks[rateLock.ID] = rateLock
	s.mu.Unlock()

	return rateLock, nil
}

func (s *FXRiskManagementService) UseRateLock(rateLockID, transactionID string) (*RateLock, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rateLock, exists := s.rateLocks[rateLockID]
	if !exists {
		return nil, fmt.Errorf("rate lock not found: %s", rateLockID)
	}

	if rateLock.Status != RateLockActive {
		return nil, fmt.Errorf("rate lock %s is not active (status: %s)", rateLockID, rateLock.Status)
	}

	if time.Now().After(rateLock.ExpiresAt) {
		rateLock.Status = RateLockExpired
		return nil, fmt.Errorf("rate lock %s has expired", rateLockID)
	}

	rateLock.Status = RateLockUsed
	now := time.Now()
	rateLock.UsedAt = &now
	rateLock.TransactionID = transactionID

	return rateLock, nil
}

func (s *FXRiskManagementService) CancelRateLock(rateLockID string) (*RateLock, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rateLock, exists := s.rateLocks[rateLockID]
	if !exists {
		return nil, fmt.Errorf("rate lock not found: %s", rateLockID)
	}

	if rateLock.Status != RateLockActive {
		return nil, fmt.Errorf("rate lock %s cannot be cancelled (status: %s)", rateLockID, rateLock.Status)
	}

	rateLock.Status = RateLockCancelled
	return rateLock, nil
}

func (s *FXRiskManagementService) GetRateLock(rateLockID string) *RateLock {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rateLocks[rateLockID]
}

func (s *FXRiskManagementService) GetCustomerRateLocks(customerID string) []*RateLock {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RateLock
	for _, rl := range s.rateLocks {
		if rl.CustomerID == customerID && rl.Status == RateLockActive {
			result = append(result, rl)
		}
	}
	return result
}

func (s *FXRiskManagementService) UpdateExposure(currency string, amount float64, positionType string) *FXExposure {
	s.mu.Lock()
	defer s.mu.Unlock()

	exposure, exists := s.exposures[currency]
	if !exists {
		exposure = &FXExposure{
			Currency:      currency,
			LongPosition:  0,
			ShortPosition: 0,
			NetPosition:   0,
			UnrealizedPnL: 0,
			LastUpdated:   time.Now(),
		}
	}

	if positionType == "long" {
		exposure.LongPosition += amount
	} else {
		exposure.ShortPosition += amount
	}

	exposure.NetPosition = exposure.LongPosition - exposure.ShortPosition
	exposure.LastUpdated = time.Now()

	rate := s.currentRates[fmt.Sprintf("%s/NGN", currency)]
	if rate == 0 {
		rate = 1
	}
	exposure.UnrealizedPnL = exposure.NetPosition * rate

	s.exposures[currency] = exposure

	return exposure
}

func (s *FXRiskManagementService) GetExposures() []*FXExposure {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*FXExposure, 0, len(s.exposures))
	for _, e := range s.exposures {
		result = append(result, e)
	}
	return result
}

func (s *FXRiskManagementService) CreateHedgePosition(currency string, hedgeType HedgeType, notionalAmount, strikeRate float64, maturityDate time.Time, counterparty string) *HedgePosition {
	hedge := &HedgePosition{
		ID:             s.generateID("HDG"),
		Currency:       currency,
		Type:           hedgeType,
		NotionalAmount: notionalAmount,
		StrikeRate:     strikeRate,
		MaturityDate:   maturityDate,
		Counterparty:   counterparty,
		Status:         HedgeStatusOpen,
		CreatedAt:      time.Now(),
	}

	s.mu.Lock()
	s.hedgePositions[hedge.ID] = hedge
	s.mu.Unlock()

	return hedge
}

func (s *FXRiskManagementService) SettleHedgePosition(hedgeID string, settlementAmount float64) (*HedgePosition, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	hedge, exists := s.hedgePositions[hedgeID]
	if !exists {
		return nil, fmt.Errorf("hedge position not found: %s", hedgeID)
	}

	hedge.Status = HedgeStatusSettled
	now := time.Now()
	hedge.SettledAt = &now
	hedge.SettlementAmount = settlementAmount

	return hedge, nil
}

func (s *FXRiskManagementService) GetOpenHedges() []*HedgePosition {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*HedgePosition
	for _, h := range s.hedgePositions {
		if h.Status == HedgeStatusOpen {
			result = append(result, h)
		}
	}
	return result
}

func (s *FXRiskManagementService) CreateVolatilityAlert(currencyPair string, threshold float64, direction VolatilityDirection) *VolatilityAlert {
	alert := &VolatilityAlert{
		ID:                s.generateID("VA"),
		CurrencyPair:      currencyPair,
		Threshold:         threshold,
		Direction:         direction,
		CurrentVolatility: 0,
		Triggered:         false,
		NotificationSent:  false,
		CreatedAt:         time.Now(),
	}

	s.mu.Lock()
	s.volatilityAlerts[alert.ID] = alert
	s.mu.Unlock()

	return alert
}

func (s *FXRiskManagementService) checkVolatilityAlerts(currencyPair string, change float64) {
	for _, alert := range s.volatilityAlerts {
		if alert.CurrencyPair != currencyPair || alert.Triggered {
			continue
		}

		alert.CurrentVolatility = change

		shouldTrigger := (alert.Direction == VolatilityBoth && change >= alert.Threshold) ||
			(alert.Direction == VolatilityUp && change >= alert.Threshold) ||
			(alert.Direction == VolatilityDown && change >= alert.Threshold)

		if shouldTrigger {
			alert.Triggered = true
			now := time.Now()
			alert.TriggeredAt = &now
		}
	}
}

func (s *FXRiskManagementService) CalculateRiskMetrics() *FXRiskMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalExposure, hedgedExposure float64

	for _, exposure := range s.exposures {
		rate := s.currentRates[fmt.Sprintf("%s/NGN", exposure.Currency)]
		if rate == 0 {
			rate = 1
		}
		totalExposure += math.Abs(exposure.NetPosition * rate)
	}

	for _, hedge := range s.hedgePositions {
		if hedge.Status == HedgeStatusOpen {
			rate := s.currentRates[fmt.Sprintf("%s/NGN", hedge.Currency)]
			if rate == 0 {
				rate = 1
			}
			hedgedExposure += hedge.NotionalAmount * rate
		}
	}

	unhedgedExposure := math.Max(0, totalExposure-hedgedExposure)
	var hedgeRatio float64
	if totalExposure > 0 {
		hedgeRatio = hedgedExposure / totalExposure
	}

	volatility := s.calculateHistoricalVolatility()
	valueAtRisk := unhedgedExposure * volatility * 1.65
	expectedShortfall := valueAtRisk * 1.25

	return &FXRiskMetrics{
		TotalExposure:     totalExposure,
		HedgedExposure:    hedgedExposure,
		UnhedgedExposure:  unhedgedExposure,
		HedgeRatio:        hedgeRatio,
		ValueAtRisk:       valueAtRisk,
		ExpectedShortfall: expectedShortfall,
		Volatility:        volatility,
	}
}

func (s *FXRiskManagementService) calculateHistoricalVolatility() float64 {
	if len(s.rateHistory) < 2 {
		return 0
	}

	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour)
	var recentHistory []*RateHistory
	for _, h := range s.rateHistory {
		if h.Timestamp.After(thirtyDaysAgo) {
			recentHistory = append(recentHistory, h)
		}
	}

	if len(recentHistory) < 2 {
		return 0
	}

	var returns []float64
	for i := 1; i < len(recentHistory); i++ {
		prevRate := recentHistory[i-1].Rate
		currRate := recentHistory[i].Rate
		if prevRate > 0 {
			returns = append(returns, (currRate-prevRate)/prevRate)
		}
	}

	if len(returns) == 0 {
		return 0
	}

	var sum float64
	for _, r := range returns {
		sum += r
	}
	mean := sum / float64(len(returns))

	var squaredDiffSum float64
	for _, r := range returns {
		squaredDiffSum += math.Pow(r-mean, 2)
	}
	variance := squaredDiffSum / float64(len(returns))

	return math.Sqrt(variance)
}

func (s *FXRiskManagementService) GetRateHistory(currencyPair string, limit int) []*RateHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RateHistory
	for _, h := range s.rateHistory {
		if h.CurrencyPair == currencyPair {
			result = append(result, h)
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[len(result)-limit:]
	}

	return result
}

func (s *FXRiskManagementService) startExpirationChecker() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for _, rateLock := range s.rateLocks {
			if rateLock.Status == RateLockActive && rateLock.ExpiresAt.Before(now) {
				rateLock.Status = RateLockExpired
			}
		}
		s.mu.Unlock()
	}
}

func (s *FXRiskManagementService) GenerateRiskReport() string {
	metrics := s.CalculateRiskMetrics()
	exposures := s.GetExposures()
	openHedges := s.GetOpenHedges()

	s.mu.RLock()
	var activeRateLocks []*RateLock
	for _, rl := range s.rateLocks {
		if rl.Status == RateLockActive {
			activeRateLocks = append(activeRateLocks, rl)
		}
	}
	s.mu.RUnlock()

	report := fmt.Sprintf(`============================================================
FX RISK MANAGEMENT REPORT
============================================================

Generated: %s

------------------------------------------------------------
RISK METRICS
------------------------------------------------------------
Total Exposure: %.2f NGN
Hedged Exposure: %.2f NGN
Unhedged Exposure: %.2f NGN
Hedge Ratio: %.1f%%
Value at Risk (95%%): %.2f NGN
Expected Shortfall: %.2f NGN
Historical Volatility: %.2f%%

`,
		time.Now().Format(time.RFC3339),
		metrics.TotalExposure,
		metrics.HedgedExposure,
		metrics.UnhedgedExposure,
		metrics.HedgeRatio*100,
		metrics.ValueAtRisk,
		metrics.ExpectedShortfall,
		metrics.Volatility*100,
	)

	if len(exposures) > 0 {
		report += "------------------------------------------------------------\nCURRENCY EXPOSURES\n------------------------------------------------------------\n"
		for _, e := range exposures {
			report += fmt.Sprintf("  %s: Long=%.2f, Short=%.2f, Net=%.2f, PnL=%.2f\n",
				e.Currency, e.LongPosition, e.ShortPosition, e.NetPosition, e.UnrealizedPnL)
		}
		report += "\n"
	}

	if len(openHedges) > 0 {
		report += "------------------------------------------------------------\nOPEN HEDGE POSITIONS\n------------------------------------------------------------\n"
		for _, h := range openHedges {
			report += fmt.Sprintf("  %s: %s %s, Notional=%.2f, Maturity=%s\n",
				h.ID, h.Type, h.Currency, h.NotionalAmount, h.MaturityDate.Format("2006-01-02"))
		}
		report += "\n"
	}

	if len(activeRateLocks) > 0 {
		report += "------------------------------------------------------------\nACTIVE RATE LOCKS\n------------------------------------------------------------\n"
		for _, rl := range activeRateLocks {
			report += fmt.Sprintf("  %s: %s/%s @ %.4f, Amount=%.2f, Expires=%s\n",
				rl.ID, rl.SourceCurrency, rl.TargetCurrency, rl.LockedRate, rl.Amount, rl.ExpiresAt.Format(time.RFC3339))
		}
	}

	report += `
============================================================
END OF REPORT
============================================================`

	return report
}

func (s *FXRiskManagementService) generateID(prefix string) string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().UnixNano()/1000000, hex.EncodeToString(bytes))
}
