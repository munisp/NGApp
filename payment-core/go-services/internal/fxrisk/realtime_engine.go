// Package fxrisk provides real-time FX exposure tracking and hedging.
// Replaces TypeScript fxRiskManagement.ts with channel-based tick processing.
package fxrisk

import (
	"context"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

// Position represents a currency exposure position
type Position struct {
	Currency     string
	Long         int64 // Total long exposure (smallest unit)
	Short        int64 // Total short exposure (smallest unit)
	Net          int64 // Net position (long - short)
	UnrealizedPL int64 // Unrealized P&L
	LastRate     int64 // Last known rate (fixed-point * 1M)
	UpdatedAt    time.Time
}

// RateTick represents a market data tick
type RateTick struct {
	Pair      string  // e.g., "USD/NGN"
	Bid       float64
	Ask       float64
	Mid       float64
	Timestamp time.Time
	Source    string
}

// RealtimeRateLock represents a locked FX rate for a customer in real-time engine
type RealtimeRateLock struct {
	ID         string
	CustomerID string
	Pair       string
	Rate       float64
	Amount     int64
	ExpiresAt  time.Time
	Status     string // active, used, expired, cancelled
	CreatedAt  time.Time
}

// HedgeOrder represents a hedging instruction
type HedgeOrder struct {
	ID           string
	Type         string // forward, spot, option
	Pair         string
	Amount       int64
	Rate         float64
	Direction    string // buy, sell
	Counterparty string
	ExpiresAt    time.Time
	Status       string
}

// ExposureLimit defines risk limits per currency
type ExposureLimit struct {
	Currency     string
	MaxNet       int64   // Maximum net exposure
	MaxGross     int64   // Maximum gross exposure
	AlertPercent float64 // Alert at this % of limit (e.g., 0.8 = 80%)
}

// Alert represents a risk alert
type Alert struct {
	ID        string
	Type      string // exposure_breach, volatility_spike, rate_lock_expiry
	Severity  string // low, medium, high, critical
	Message   string
	Data      map[string]interface{}
	Timestamp time.Time
}

// RealTimeEngine processes market data and manages FX risk in real-time
type RealTimeEngine struct {
	// Positions by currency
	positions sync.Map // map[string]*Position

	// Rate locks
	rateLocks sync.Map // map[string]*RealtimeRateLock

	// Current rates
	currentRates sync.Map // map[string]*RateTick

	// Limits
	limits sync.Map // map[string]*ExposureLimit

	// Channels
	tickChan    chan *RateTick
	orderChan   chan *HedgeOrder
	alertChan   chan *Alert

	// Stats
	totalTicks     uint64
	totalAlerts    uint64
	totalHedges    uint64
	totalLocks     uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewRealTimeEngine creates a new FX risk engine
func NewRealTimeEngine(bufferSize int) *RealTimeEngine {
	ctx, cancel := context.WithCancel(context.Background())
	engine := &RealTimeEngine{
		tickChan:  make(chan *RateTick, bufferSize),
		orderChan: make(chan *HedgeOrder, 1000),
		alertChan: make(chan *Alert, 1000),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start tick processor
	engine.wg.Add(1)
	go engine.processTicksLoop()

	// Start lock expiry checker
	engine.wg.Add(1)
	go engine.lockExpiryChecker()

	return engine
}

// SubmitTick submits a market data tick for processing
func (e *RealTimeEngine) SubmitTick(tick *RateTick) {
	select {
	case e.tickChan <- tick:
		atomic.AddUint64(&e.totalTicks, 1)
	default:
		// Drop tick if buffer full (prefer latest data)
	}
}

// CreateRateLock locks a rate for a customer
func (e *RealTimeEngine) CreateRateLock(customerID, pair string, rate float64, amount int64, duration time.Duration) (*RealtimeRateLock, error) {
	lock := &RealtimeRateLock{
		ID:         fmt.Sprintf("rl-%d", time.Now().UnixNano()),
		CustomerID: customerID,
		Pair:       pair,
		Rate:       rate,
		Amount:     amount,
		ExpiresAt:  time.Now().Add(duration),
		Status:     "active",
		CreatedAt:  time.Now(),
	}

	e.rateLocks.Store(lock.ID, lock)
	atomic.AddUint64(&e.totalLocks, 1)

	// Update exposure
	e.updateExposure(pair, amount)

	return lock, nil
}

// UseRateLock uses a locked rate for a transaction
func (e *RealTimeEngine) UseRateLock(lockID string) (*RealtimeRateLock, error) {
	v, ok := e.rateLocks.Load(lockID)
	if !ok {
		return nil, fmt.Errorf("rate lock not found: %s", lockID)
	}

	lock := v.(*RealtimeRateLock)
	if lock.Status != "active" {
		return nil, fmt.Errorf("rate lock is %s", lock.Status)
	}
	if time.Now().After(lock.ExpiresAt) {
		lock.Status = "expired"
		return nil, fmt.Errorf("rate lock has expired")
	}

	lock.Status = "used"
	return lock, nil
}

// GetPosition returns the current position for a currency
func (e *RealTimeEngine) GetPosition(currency string) *Position {
	v, ok := e.positions.Load(currency)
	if !ok {
		return &Position{Currency: currency}
	}
	return v.(*Position)
}

// GetAllPositions returns all currency positions
func (e *RealTimeEngine) GetAllPositions() []*Position {
	var positions []*Position
	e.positions.Range(func(key, value interface{}) bool {
		positions = append(positions, value.(*Position))
		return true
	})
	return positions
}

// SetLimit sets exposure limit for a currency
func (e *RealTimeEngine) SetLimit(limit *ExposureLimit) {
	e.limits.Store(limit.Currency, limit)
}

// Alerts returns the alert channel for consuming alerts
func (e *RealTimeEngine) Alerts() <-chan *Alert {
	return e.alertChan
}

// processTicksLoop processes incoming rate ticks
func (e *RealTimeEngine) processTicksLoop() {
	defer e.wg.Done()

	for {
		select {
		case <-e.ctx.Done():
			return
		case tick := <-e.tickChan:
			e.processTick(tick)
		}
	}
}

// processTick handles a single rate tick
func (e *RealTimeEngine) processTick(tick *RateTick) {
	// Store current rate
	e.currentRates.Store(tick.Pair, tick)

	// Check volatility
	e.checkVolatility(tick)

	// Update unrealized P&L for all affected positions
	e.updatePnL(tick)

	// Check exposure limits
	e.checkLimits(tick)
}

// checkVolatility detects sudden rate movements
func (e *RealTimeEngine) checkVolatility(tick *RateTick) {
	// Load previous rate
	v, ok := e.currentRates.Load(tick.Pair)
	if !ok {
		return
	}
	prev := v.(*RateTick)

	// Calculate percentage change
	if prev.Mid == 0 {
		return
	}
	pctChange := math.Abs((tick.Mid - prev.Mid) / prev.Mid * 100)

	// Alert on >2% movement
	if pctChange > 2.0 {
		e.emitAlert(&Alert{
			ID:        fmt.Sprintf("alert-%d", time.Now().UnixNano()),
			Type:      "volatility_spike",
			Severity:  "high",
			Message:   fmt.Sprintf("%s moved %.2f%% in single tick", tick.Pair, pctChange),
			Data:      map[string]interface{}{"pair": tick.Pair, "change_pct": pctChange, "new_rate": tick.Mid},
			Timestamp: time.Now(),
		})
	}
}

// updatePnL recalculates unrealized P&L
func (e *RealTimeEngine) updatePnL(tick *RateTick) {
	// Extract base currency from pair (e.g., "USD" from "USD/NGN")
	if len(tick.Pair) < 7 {
		return
	}
	baseCurrency := tick.Pair[:3]

	v, ok := e.positions.Load(baseCurrency)
	if !ok {
		return
	}
	pos := v.(*Position)

	// Recalculate P&L based on new rate
	rateFP := int64(tick.Mid * 1_000_000) // Fixed-point
	pos.UnrealizedPL = pos.Net * (rateFP - pos.LastRate) / 1_000_000
	pos.LastRate = rateFP
	pos.UpdatedAt = time.Now()
}

// checkLimits verifies exposure is within limits
func (e *RealTimeEngine) checkLimits(tick *RateTick) {
	if len(tick.Pair) < 7 {
		return
	}
	baseCurrency := tick.Pair[:3]

	limV, ok := e.limits.Load(baseCurrency)
	if !ok {
		return
	}
	limit := limV.(*ExposureLimit)

	posV, ok := e.positions.Load(baseCurrency)
	if !ok {
		return
	}
	pos := posV.(*Position)

	// Check net exposure
	absNet := pos.Net
	if absNet < 0 {
		absNet = -absNet
	}
	if absNet > limit.MaxNet {
		e.emitAlert(&Alert{
			ID:       fmt.Sprintf("alert-%d", time.Now().UnixNano()),
			Type:     "exposure_breach",
			Severity: "critical",
			Message:  fmt.Sprintf("%s net exposure %d exceeds limit %d", baseCurrency, pos.Net, limit.MaxNet),
			Data: map[string]interface{}{
				"currency": baseCurrency,
				"net":      pos.Net,
				"limit":    limit.MaxNet,
			},
			Timestamp: time.Now(),
		})
	} else if float64(absNet) > float64(limit.MaxNet)*limit.AlertPercent {
		e.emitAlert(&Alert{
			ID:       fmt.Sprintf("alert-%d", time.Now().UnixNano()),
			Type:     "exposure_breach",
			Severity: "medium",
			Message:  fmt.Sprintf("%s approaching exposure limit (%.0f%%)", baseCurrency, float64(absNet)/float64(limit.MaxNet)*100),
			Data: map[string]interface{}{
				"currency":  baseCurrency,
				"net":       pos.Net,
				"limit":     limit.MaxNet,
				"pct_used": float64(absNet) / float64(limit.MaxNet) * 100,
			},
			Timestamp: time.Now(),
		})
	}
}

// updateExposure adjusts position when a trade occurs
func (e *RealTimeEngine) updateExposure(pair string, amount int64) {
	if len(pair) < 7 {
		return
	}
	baseCurrency := pair[:3]

	v, _ := e.positions.LoadOrStore(baseCurrency, &Position{Currency: baseCurrency})
	pos := v.(*Position)

	if amount > 0 {
		pos.Long += amount
	} else {
		pos.Short += (-amount)
	}
	pos.Net = pos.Long - pos.Short
	pos.UpdatedAt = time.Now()
}

// lockExpiryChecker periodically checks for expired rate locks
func (e *RealTimeEngine) lockExpiryChecker() {
	defer e.wg.Done()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			e.rateLocks.Range(func(key, value interface{}) bool {
				lock := value.(*RealtimeRateLock)
				if lock.Status == "active" && now.After(lock.ExpiresAt) {
					lock.Status = "expired"
					e.emitAlert(&Alert{
						ID:       fmt.Sprintf("alert-%d", now.UnixNano()),
						Type:     "rate_lock_expiry",
						Severity: "low",
						Message:  fmt.Sprintf("Rate lock %s expired for customer %s", lock.ID, lock.CustomerID),
						Data:     map[string]interface{}{"lock_id": lock.ID, "pair": lock.Pair},
						Timestamp: now,
					})
				}
				return true
			})
		}
	}
}

func (e *RealTimeEngine) emitAlert(alert *Alert) {
	atomic.AddUint64(&e.totalAlerts, 1)
	select {
	case e.alertChan <- alert:
	default:
		// Drop if alert buffer full
	}
}

// Stats returns engine statistics
func (e *RealTimeEngine) Stats() map[string]uint64 {
	return map[string]uint64{
		"total_ticks":  atomic.LoadUint64(&e.totalTicks),
		"total_alerts": atomic.LoadUint64(&e.totalAlerts),
		"total_hedges": atomic.LoadUint64(&e.totalHedges),
		"total_locks":  atomic.LoadUint64(&e.totalLocks),
	}
}

// Shutdown stops the engine
func (e *RealTimeEngine) Shutdown() {
	e.cancel()
	e.wg.Wait()
}
