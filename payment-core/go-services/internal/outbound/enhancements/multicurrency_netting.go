package enhancements

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// NettingFlow represents a directional flow between two currencies
type NettingFlow struct {
	FromCurrency string  `json:"fromCurrency"`
	ToCurrency   string  `json:"toCurrency"`
	GrossAmount  float64 `json:"grossAmount"`
	TxnCount     int     `json:"txnCount"`
}

// NettingResult represents the outcome of a netting cycle
type NettingResult struct {
	CycleID        string             `json:"cycleId"`
	CycleStart     time.Time          `json:"cycleStart"`
	CycleEnd       time.Time          `json:"cycleEnd"`
	GrossFlows     []NettingFlow      `json:"grossFlows"`
	NetPositions   map[string]float64 `json:"netPositions"`
	GrossTotalUSD  float64            `json:"grossTotalUSD"`
	NetTotalUSD    float64            `json:"netTotalUSD"`
	SavingsUSD     float64            `json:"savingsUSD"`
	SavingsPercent float64            `json:"savingsPercent"`
	PairsNetted    int                `json:"pairsNetted"`
}

// NettingEngine performs multi-currency bilateral netting
type NettingEngine struct {
	mu      sync.RWMutex
	flows   []NettingFlow
	cycles  []NettingResult
	fxRates map[string]float64 // currency -> USD rate
}

// NewNettingEngine creates a new netting engine with FX rates
func NewNettingEngine() *NettingEngine {
	return &NettingEngine{
		flows:  make([]NettingFlow, 0),
		cycles: make([]NettingResult, 0),
		fxRates: map[string]float64{
			"NGN": 1.0 / 1600.0,
			"USD": 1.0,
			"GBP": 1.27,
			"EUR": 1.09,
			"GHS": 1.0 / 15.5,
			"KES": 1.0 / 153.0,
			"ZAR": 1.0 / 18.5,
			"CNY": 1.0 / 7.24,
			"INR": 1.0 / 83.5,
			"XOF": 1.0 / 610.0,
			"XAF": 1.0 / 610.0,
			"CAD": 0.74,
			"AED": 0.272,
			"TRY": 1.0 / 32.0,
		},
	}
}

// AddFlow records a transfer flow for the current netting window
func (ne *NettingEngine) AddFlow(fromCurrency, toCurrency string, amount float64) {
	ne.mu.Lock()
	defer ne.mu.Unlock()

	for i := range ne.flows {
		if ne.flows[i].FromCurrency == fromCurrency && ne.flows[i].ToCurrency == toCurrency {
			ne.flows[i].GrossAmount += amount
			ne.flows[i].TxnCount++
			return
		}
	}
	ne.flows = append(ne.flows, NettingFlow{
		FromCurrency: fromCurrency,
		ToCurrency:   toCurrency,
		GrossAmount:  amount,
		TxnCount:     1,
	})
}

// toUSD converts an amount to USD using stored rates
func (ne *NettingEngine) toUSD(currency string, amount float64) float64 {
	rate, ok := ne.fxRates[currency]
	if !ok {
		return amount // assume 1:1 if unknown
	}
	return amount * rate
}

// ExecuteNetting performs bilateral netting on accumulated flows
func (ne *NettingEngine) ExecuteNetting() *NettingResult {
	ne.mu.Lock()
	defer ne.mu.Unlock()

	cycleEnd := time.Now()
	result := NettingResult{
		CycleID:      fmt.Sprintf("NET-%d", cycleEnd.UnixMilli()),
		CycleStart:   cycleEnd.Add(-24 * time.Hour), // assume daily cycle
		CycleEnd:     cycleEnd,
		GrossFlows:   make([]NettingFlow, len(ne.flows)),
		NetPositions: make(map[string]float64),
	}
	copy(result.GrossFlows, ne.flows)

	// Calculate gross total in USD
	for _, f := range ne.flows {
		result.GrossTotalUSD += ne.toUSD(f.FromCurrency, f.GrossAmount)
	}

	// Calculate net positions per currency pair
	pairNet := make(map[string]float64) // "NGN-GHS" -> net amount in from_currency
	for _, f := range ne.flows {
		key := f.FromCurrency + "-" + f.ToCurrency
		reverseKey := f.ToCurrency + "-" + f.FromCurrency
		if _, exists := pairNet[reverseKey]; exists {
			pairNet[reverseKey] -= ne.toUSD(f.FromCurrency, f.GrossAmount)
		} else {
			pairNet[key] += ne.toUSD(f.FromCurrency, f.GrossAmount)
		}
	}

	for pair, netAmount := range pairNet {
		result.NetPositions[pair] = netAmount
		result.NetTotalUSD += math.Abs(netAmount)
		if netAmount != 0 {
			result.PairsNetted++
		}
	}

	result.SavingsUSD = result.GrossTotalUSD - result.NetTotalUSD
	if result.GrossTotalUSD > 0 {
		result.SavingsPercent = (result.SavingsUSD / result.GrossTotalUSD) * 100
	}

	ne.cycles = append(ne.cycles, result)
	ne.flows = ne.flows[:0] // reset flows for next cycle

	return &result
}

// GetHistory returns past netting cycle results
func (ne *NettingEngine) GetHistory(limit int) []NettingResult {
	ne.mu.RLock()
	defer ne.mu.RUnlock()
	if limit <= 0 || limit > len(ne.cycles) {
		limit = len(ne.cycles)
	}
	result := make([]NettingResult, limit)
	copy(result, ne.cycles[len(ne.cycles)-limit:])
	return result
}
