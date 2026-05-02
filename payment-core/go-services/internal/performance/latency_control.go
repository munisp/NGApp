// Package performance provides performance optimization features
// Priority 4: Latency Budgets, Incremental Drift, Backpressure Controls
package performance

import (
	"context"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

// =============================================================================
// Priority 4.1: Latency Budgets with Timeouts and Fallbacks
// =============================================================================

// LatencyBudgetManager manages latency budgets for different operations
type LatencyBudgetManager struct {
	budgets     map[string]*LatencyBudget
	metrics     map[string]*LatencyMetrics
	mu          sync.RWMutex
	alerter     LatencyAlerter
}

// LatencyBudget defines latency budget for an operation
type LatencyBudget struct {
	OperationID   string        `json:"operation_id"`
	Name          string        `json:"name"`
	MaxLatency    time.Duration `json:"max_latency"`
	WarningAt     time.Duration `json:"warning_at"`
	Timeout       time.Duration `json:"timeout"`
	FallbackMode  string        `json:"fallback_mode"` // CACHE, DEFAULT, SKIP, ERROR
	Priority      string        `json:"priority"`      // CRITICAL, HIGH, MEDIUM, LOW
	Enabled       bool          `json:"enabled"`
}

// LatencyMetrics tracks latency metrics for an operation
type LatencyMetrics struct {
	OperationID     string        `json:"operation_id"`
	TotalRequests   int64         `json:"total_requests"`
	SuccessCount    int64         `json:"success_count"`
	TimeoutCount    int64         `json:"timeout_count"`
	FallbackCount   int64         `json:"fallback_count"`
	TotalLatency    int64         `json:"total_latency_ns"`
	MinLatency      int64         `json:"min_latency_ns"`
	MaxLatency      int64         `json:"max_latency_ns"`
	P50Latency      int64         `json:"p50_latency_ns"`
	P95Latency      int64         `json:"p95_latency_ns"`
	P99Latency      int64         `json:"p99_latency_ns"`
	BudgetBreaches  int64         `json:"budget_breaches"`
	LastUpdated     time.Time     `json:"last_updated"`
	
	// Histogram for percentile calculation
	histogram       []int64
	histogramMu     sync.Mutex
}

// LatencyAlerter interface for latency alerts
type LatencyAlerter interface {
	AlertBudgetBreach(ctx context.Context, operationID string, latency, budget time.Duration) error
	AlertTimeoutRate(ctx context.Context, operationID string, rate float64) error
}

// ExecutionResult represents the result of a latency-controlled execution
type ExecutionResult struct {
	Success      bool          `json:"success"`
	Latency      time.Duration `json:"latency"`
	UsedFallback bool          `json:"used_fallback"`
	TimedOut     bool          `json:"timed_out"`
	Error        error         `json:"error,omitempty"`
}

// NewLatencyBudgetManager creates a new latency budget manager
func NewLatencyBudgetManager(alerter LatencyAlerter) *LatencyBudgetManager {
	mgr := &LatencyBudgetManager{
		budgets: make(map[string]*LatencyBudget),
		metrics: make(map[string]*LatencyMetrics),
		alerter: alerter,
	}
	mgr.initializeDefaultBudgets()
	return mgr
}

// initializeDefaultBudgets sets up default latency budgets
func (m *LatencyBudgetManager) initializeDefaultBudgets() {
	// Hot path fraud gate - must be very fast
	m.budgets["fraud_hot_path"] = &LatencyBudget{
		OperationID:  "fraud_hot_path",
		Name:         "Fraud Hot Path Gate",
		MaxLatency:   5 * time.Millisecond,
		WarningAt:    3 * time.Millisecond,
		Timeout:      10 * time.Millisecond,
		FallbackMode: "DEFAULT", // Default to allow if timeout
		Priority:     "CRITICAL",
		Enabled:      true,
	}
	
	// Full fraud scoring
	m.budgets["fraud_full_scoring"] = &LatencyBudget{
		OperationID:  "fraud_full_scoring",
		Name:         "Full Fraud Scoring",
		MaxLatency:   50 * time.Millisecond,
		WarningAt:    30 * time.Millisecond,
		Timeout:      100 * time.Millisecond,
		FallbackMode: "CACHE", // Use cached score if timeout
		Priority:     "HIGH",
		Enabled:      true,
	}
	
	// AML screening
	m.budgets["aml_screening"] = &LatencyBudget{
		OperationID:  "aml_screening",
		Name:         "AML Screening",
		MaxLatency:   500 * time.Millisecond,
		WarningAt:    300 * time.Millisecond,
		Timeout:      2 * time.Second,
		FallbackMode: "ERROR", // Cannot skip AML
		Priority:     "HIGH",
		Enabled:      true,
	}
	
	// KYC verification
	m.budgets["kyc_verification"] = &LatencyBudget{
		OperationID:  "kyc_verification",
		Name:         "KYC Verification",
		MaxLatency:   2 * time.Second,
		WarningAt:    1 * time.Second,
		Timeout:      5 * time.Second,
		FallbackMode: "ERROR",
		Priority:     "MEDIUM",
		Enabled:      true,
	}
	
	// Async enrichment - best effort
	m.budgets["async_enrichment"] = &LatencyBudget{
		OperationID:  "async_enrichment",
		Name:         "Async Enrichment",
		MaxLatency:   5 * time.Second,
		WarningAt:    3 * time.Second,
		Timeout:      10 * time.Second,
		FallbackMode: "SKIP", // Skip if timeout
		Priority:     "LOW",
		Enabled:      true,
	}
	
	// Initialize metrics for each budget
	for id := range m.budgets {
		m.metrics[id] = &LatencyMetrics{
			OperationID: id,
			MinLatency:  math.MaxInt64,
			histogram:   make([]int64, 100), // 100 buckets
		}
	}
}

// ExecuteWithBudget executes an operation with latency budget control
func (m *LatencyBudgetManager) ExecuteWithBudget(ctx context.Context, operationID string, operation func(ctx context.Context) (interface{}, error), fallback func() (interface{}, error)) (interface{}, *ExecutionResult) {
	m.mu.RLock()
	budget, ok := m.budgets[operationID]
	metrics := m.metrics[operationID]
	m.mu.RUnlock()
	
	if !ok || !budget.Enabled {
		// No budget defined, execute without control
		result, err := operation(ctx)
		return result, &ExecutionResult{Success: err == nil, Error: err}
	}
	
	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, budget.Timeout)
	defer cancel()
	
	// Execute with timing
	start := time.Now()
	resultChan := make(chan struct {
		result interface{}
		err    error
	}, 1)
	
	go func() {
		result, err := operation(timeoutCtx)
		resultChan <- struct {
			result interface{}
			err    error
		}{result, err}
	}()
	
	// Wait for result or timeout
	select {
	case res := <-resultChan:
		latency := time.Since(start)
		m.recordLatency(operationID, latency, false, false)
		
		execResult := &ExecutionResult{
			Success:      res.err == nil,
			Latency:      latency,
			UsedFallback: false,
			TimedOut:     false,
			Error:        res.err,
		}
		
		// Check budget breach
		if latency > budget.MaxLatency {
			atomic.AddInt64(&metrics.BudgetBreaches, 1)
			if m.alerter != nil {
				m.alerter.AlertBudgetBreach(ctx, operationID, latency, budget.MaxLatency)
			}
		}
		
		return res.result, execResult
		
	case <-timeoutCtx.Done():
		latency := time.Since(start)
		m.recordLatency(operationID, latency, true, false)
		
		// Execute fallback based on mode
		var fallbackResult interface{}
		var fallbackErr error
		usedFallback := false
		
		switch budget.FallbackMode {
		case "CACHE":
			if fallback != nil {
				fallbackResult, fallbackErr = fallback()
				usedFallback = true
			}
		case "DEFAULT":
			fallbackResult = nil
			usedFallback = true
		case "SKIP":
			fallbackResult = nil
			usedFallback = true
		case "ERROR":
			fallbackErr = fmt.Errorf("operation %s timed out after %v", operationID, budget.Timeout)
		}
		
		if usedFallback {
			m.recordLatency(operationID, latency, true, true)
		}
		
		return fallbackResult, &ExecutionResult{
			Success:      fallbackErr == nil,
			Latency:      latency,
			UsedFallback: usedFallback,
			TimedOut:     true,
			Error:        fallbackErr,
		}
	}
}

// recordLatency records latency metrics
func (m *LatencyBudgetManager) recordLatency(operationID string, latency time.Duration, timedOut, usedFallback bool) {
	m.mu.Lock()
	metrics, ok := m.metrics[operationID]
	m.mu.Unlock()
	
	if !ok {
		return
	}
	
	latencyNs := latency.Nanoseconds()
	
	atomic.AddInt64(&metrics.TotalRequests, 1)
	atomic.AddInt64(&metrics.TotalLatency, latencyNs)
	
	if timedOut {
		atomic.AddInt64(&metrics.TimeoutCount, 1)
	} else {
		atomic.AddInt64(&metrics.SuccessCount, 1)
	}
	
	if usedFallback {
		atomic.AddInt64(&metrics.FallbackCount, 1)
	}
	
	// Update min/max
	for {
		old := atomic.LoadInt64(&metrics.MinLatency)
		if latencyNs >= old || atomic.CompareAndSwapInt64(&metrics.MinLatency, old, latencyNs) {
			break
		}
	}
	for {
		old := atomic.LoadInt64(&metrics.MaxLatency)
		if latencyNs <= old || atomic.CompareAndSwapInt64(&metrics.MaxLatency, old, latencyNs) {
			break
		}
	}
	
	// Update histogram for percentiles
	metrics.histogramMu.Lock()
	bucket := int(latencyNs / 1000000) // 1ms buckets
	if bucket >= len(metrics.histogram) {
		bucket = len(metrics.histogram) - 1
	}
	metrics.histogram[bucket]++
	metrics.histogramMu.Unlock()
	
	metrics.LastUpdated = time.Now()
}

// GetMetrics returns latency metrics for an operation
func (m *LatencyBudgetManager) GetMetrics(operationID string) *LatencyMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	metrics, ok := m.metrics[operationID]
	if !ok {
		return nil
	}
	
	// Calculate percentiles
	metrics.histogramMu.Lock()
	defer metrics.histogramMu.Unlock()
	
	total := atomic.LoadInt64(&metrics.TotalRequests)
	if total == 0 {
		return metrics
	}
	
	p50Target := total / 2
	p95Target := total * 95 / 100
	p99Target := total * 99 / 100
	
	var cumulative int64
	for i, count := range metrics.histogram {
		cumulative += count
		if metrics.P50Latency == 0 && cumulative >= p50Target {
			metrics.P50Latency = int64(i) * 1000000
		}
		if metrics.P95Latency == 0 && cumulative >= p95Target {
			metrics.P95Latency = int64(i) * 1000000
		}
		if metrics.P99Latency == 0 && cumulative >= p99Target {
			metrics.P99Latency = int64(i) * 1000000
		}
	}
	
	return metrics
}

// =============================================================================
// Priority 4.2: Incremental Drift Computation
// =============================================================================

// IncrementalDriftMonitor provides incremental drift computation
type IncrementalDriftMonitor struct {
	features       map[string]*RollingHistogram
	predictions    *RollingHistogram
	labels         *RollingHistogram
	windowSize     int
	psiThreshold   float64
	mu             sync.RWMutex
}

// RollingHistogram maintains a rolling histogram for incremental computation
type RollingHistogram struct {
	Name        string    `json:"name"`
	Buckets     []float64 `json:"buckets"`
	Counts      []int64   `json:"counts"`
	Total       int64     `json:"total"`
	Sum         float64   `json:"sum"`
	SumSquares  float64   `json:"sum_squares"`
	Min         float64   `json:"min"`
	Max         float64   `json:"max"`
	WindowSize  int       `json:"window_size"`
	WindowStart time.Time `json:"window_start"`
	
	// Rolling window data
	recentValues []float64
	recentIdx    int
	mu           sync.Mutex
}

// DriftResult represents drift computation result
type DriftResult struct {
	FeatureDrift    map[string]float64 `json:"feature_drift"`
	PredictionDrift float64            `json:"prediction_drift"`
	LabelDrift      float64            `json:"label_drift"`
	OverallPSI      float64            `json:"overall_psi"`
	DriftDetected   bool               `json:"drift_detected"`
	Severity        string             `json:"severity"`
	ComputedAt      time.Time          `json:"computed_at"`
}

// NewIncrementalDriftMonitor creates a new incremental drift monitor
func NewIncrementalDriftMonitor(features []string, windowSize int) *IncrementalDriftMonitor {
	monitor := &IncrementalDriftMonitor{
		features:     make(map[string]*RollingHistogram),
		windowSize:   windowSize,
		psiThreshold: 0.1,
	}
	
	// Initialize feature histograms
	for _, feature := range features {
		monitor.features[feature] = NewRollingHistogram(feature, 10, windowSize)
	}
	
	// Initialize prediction and label histograms
	monitor.predictions = NewRollingHistogram("predictions", 10, windowSize)
	monitor.labels = NewRollingHistogram("labels", 2, windowSize)
	
	return monitor
}

// NewRollingHistogram creates a new rolling histogram
func NewRollingHistogram(name string, numBuckets, windowSize int) *RollingHistogram {
	return &RollingHistogram{
		Name:         name,
		Buckets:      make([]float64, numBuckets+1),
		Counts:       make([]int64, numBuckets),
		Min:          math.MaxFloat64,
		Max:          -math.MaxFloat64,
		WindowSize:   windowSize,
		WindowStart:  time.Now(),
		recentValues: make([]float64, windowSize),
	}
}

// RecordPrediction records a prediction for drift monitoring
func (m *IncrementalDriftMonitor) RecordPrediction(features map[string]float64, prediction float64, label *float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Record feature values
	for name, value := range features {
		if hist, ok := m.features[name]; ok {
			hist.Add(value)
		}
	}
	
	// Record prediction
	m.predictions.Add(prediction)
	
	// Record label if available
	if label != nil {
		m.labels.Add(*label)
	}
}

// Add adds a value to the rolling histogram
func (h *RollingHistogram) Add(value float64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	// Update statistics
	h.Total++
	h.Sum += value
	h.SumSquares += value * value
	
	if value < h.Min {
		h.Min = value
	}
	if value > h.Max {
		h.Max = value
	}
	
	// Add to rolling window
	h.recentValues[h.recentIdx] = value
	h.recentIdx = (h.recentIdx + 1) % h.WindowSize
	
	// Update histogram bucket
	bucket := h.getBucket(value)
	if bucket >= 0 && bucket < len(h.Counts) {
		h.Counts[bucket]++
	}
}

// getBucket returns the bucket index for a value
func (h *RollingHistogram) getBucket(value float64) int {
	if h.Max == h.Min {
		return 0
	}
	
	normalized := (value - h.Min) / (h.Max - h.Min)
	bucket := int(normalized * float64(len(h.Counts)-1))
	
	if bucket < 0 {
		bucket = 0
	}
	if bucket >= len(h.Counts) {
		bucket = len(h.Counts) - 1
	}
	
	return bucket
}

// ComputeDrift computes drift incrementally
func (m *IncrementalDriftMonitor) ComputeDrift(baseline *IncrementalDriftMonitor) *DriftResult {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := &DriftResult{
		FeatureDrift: make(map[string]float64),
		ComputedAt:   time.Now(),
	}
	
	// Compute feature drift
	var totalPSI float64
	for name, hist := range m.features {
		if baselineHist, ok := baseline.features[name]; ok {
			psi := computePSI(hist, baselineHist)
			result.FeatureDrift[name] = psi
			totalPSI += psi
		}
	}
	
	if len(m.features) > 0 {
		result.OverallPSI = totalPSI / float64(len(m.features))
	}
	
	// Compute prediction drift
	result.PredictionDrift = computePSI(m.predictions, baseline.predictions)
	
	// Compute label drift
	result.LabelDrift = computePSI(m.labels, baseline.labels)
	
	// Determine severity
	result.DriftDetected = result.OverallPSI > m.psiThreshold
	
	if result.OverallPSI > 0.25 {
		result.Severity = "CRITICAL"
	} else if result.OverallPSI > 0.1 {
		result.Severity = "HIGH"
	} else if result.OverallPSI > 0.05 {
		result.Severity = "MEDIUM"
	} else {
		result.Severity = "LOW"
	}
	
	return result
}

// computePSI computes Population Stability Index between two histograms
func computePSI(actual, expected *RollingHistogram) float64 {
	actual.mu.Lock()
	expected.mu.Lock()
	defer actual.mu.Unlock()
	defer expected.mu.Unlock()
	
	if actual.Total == 0 || expected.Total == 0 {
		return 0
	}
	
	var psi float64
	for i := 0; i < len(actual.Counts) && i < len(expected.Counts); i++ {
		// Add smoothing to avoid division by zero
		actualPct := (float64(actual.Counts[i]) + 0.5) / (float64(actual.Total) + 0.5*float64(len(actual.Counts)))
		expectedPct := (float64(expected.Counts[i]) + 0.5) / (float64(expected.Total) + 0.5*float64(len(expected.Counts)))
		
		if expectedPct > 0 {
			psi += (actualPct - expectedPct) * math.Log(actualPct/expectedPct)
		}
	}
	
	return math.Abs(psi)
}

// =============================================================================
// Priority 4.3: Backpressure Controls
// =============================================================================

// BackpressureController provides backpressure control
type BackpressureController struct {
	limiters    map[string]*AdaptiveLimiter
	queues      map[string]*BoundedQueue
	mu          sync.RWMutex
}

// AdaptiveLimiter provides adaptive rate limiting
type AdaptiveLimiter struct {
	Name            string  `json:"name"`
	CurrentLimit    int64   `json:"current_limit"`
	MinLimit        int64   `json:"min_limit"`
	MaxLimit        int64   `json:"max_limit"`
	CurrentRate     int64   `json:"current_rate"`
	TargetLatency   int64   `json:"target_latency_ms"`
	CurrentLatency  int64   `json:"current_latency_ms"`
	ErrorRate       float64 `json:"error_rate"`
	MaxErrorRate    float64 `json:"max_error_rate"`
	
	// AIMD parameters
	AdditiveIncrease int64   `json:"additive_increase"`
	MultiplicativeDecrease float64 `json:"multiplicative_decrease"`
	
	// State
	tokens          int64
	lastRefill      time.Time
	mu              sync.Mutex
}

// BoundedQueue provides a bounded queue with backpressure
type BoundedQueue struct {
	Name        string `json:"name"`
	MaxSize     int    `json:"max_size"`
	CurrentSize int64  `json:"current_size"`
	Dropped     int64  `json:"dropped"`
	Processed   int64  `json:"processed"`
	
	items       chan interface{}
	mu          sync.RWMutex
}

// NewBackpressureController creates a new backpressure controller
func NewBackpressureController() *BackpressureController {
	ctrl := &BackpressureController{
		limiters: make(map[string]*AdaptiveLimiter),
		queues:   make(map[string]*BoundedQueue),
	}
	ctrl.initializeDefaults()
	return ctrl
}

// initializeDefaults sets up default limiters and queues
func (c *BackpressureController) initializeDefaults() {
	// Fraud scoring limiter
	c.limiters["fraud_scoring"] = &AdaptiveLimiter{
		Name:                   "fraud_scoring",
		CurrentLimit:           10000,
		MinLimit:               1000,
		MaxLimit:               100000,
		TargetLatency:          50,
		MaxErrorRate:           0.01,
		AdditiveIncrease:       100,
		MultiplicativeDecrease: 0.5,
		lastRefill:             time.Now(),
	}
	
	// AML screening limiter
	c.limiters["aml_screening"] = &AdaptiveLimiter{
		Name:                   "aml_screening",
		CurrentLimit:           1000,
		MinLimit:               100,
		MaxLimit:               10000,
		TargetLatency:          500,
		MaxErrorRate:           0.001,
		AdditiveIncrease:       10,
		MultiplicativeDecrease: 0.5,
		lastRefill:             time.Now(),
	}
	
	// Feedback queue
	c.queues["feedback"] = &BoundedQueue{
		Name:    "feedback",
		MaxSize: 10000,
		items:   make(chan interface{}, 10000),
	}
	
	// Enrichment queue
	c.queues["enrichment"] = &BoundedQueue{
		Name:    "enrichment",
		MaxSize: 50000,
		items:   make(chan interface{}, 50000),
	}
}

// TryAcquire tries to acquire a token from the limiter
func (c *BackpressureController) TryAcquire(limiterName string) bool {
	c.mu.RLock()
	limiter, ok := c.limiters[limiterName]
	c.mu.RUnlock()
	
	if !ok {
		return true // No limiter, allow
	}
	
	return limiter.TryAcquire()
}

// TryAcquire tries to acquire a token
func (l *AdaptiveLimiter) TryAcquire() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	
	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(l.lastRefill)
	tokensToAdd := int64(elapsed.Seconds() * float64(l.CurrentLimit))
	
	l.tokens += tokensToAdd
	if l.tokens > l.CurrentLimit {
		l.tokens = l.CurrentLimit
	}
	l.lastRefill = now
	
	// Try to acquire
	if l.tokens > 0 {
		l.tokens--
		atomic.AddInt64(&l.CurrentRate, 1)
		return true
	}
	
	return false
}

// UpdateMetrics updates limiter metrics and adjusts limit
func (l *AdaptiveLimiter) UpdateMetrics(latencyMs int64, isError bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	
	l.CurrentLatency = latencyMs
	
	if isError {
		l.ErrorRate = l.ErrorRate*0.9 + 0.1 // Exponential moving average
	} else {
		l.ErrorRate = l.ErrorRate * 0.9
	}
	
	// AIMD adjustment
	if l.CurrentLatency > l.TargetLatency || l.ErrorRate > l.MaxErrorRate {
		// Multiplicative decrease
		l.CurrentLimit = int64(float64(l.CurrentLimit) * l.MultiplicativeDecrease)
		if l.CurrentLimit < l.MinLimit {
			l.CurrentLimit = l.MinLimit
		}
	} else {
		// Additive increase
		l.CurrentLimit += l.AdditiveIncrease
		if l.CurrentLimit > l.MaxLimit {
			l.CurrentLimit = l.MaxLimit
		}
	}
}

// Enqueue tries to enqueue an item
func (c *BackpressureController) Enqueue(queueName string, item interface{}) bool {
	c.mu.RLock()
	queue, ok := c.queues[queueName]
	c.mu.RUnlock()
	
	if !ok {
		return false
	}
	
	return queue.Enqueue(item)
}

// Enqueue tries to enqueue an item
func (q *BoundedQueue) Enqueue(item interface{}) bool {
	select {
	case q.items <- item:
		atomic.AddInt64(&q.CurrentSize, 1)
		return true
	default:
		atomic.AddInt64(&q.Dropped, 1)
		return false
	}
}

// Dequeue dequeues an item
func (q *BoundedQueue) Dequeue() (interface{}, bool) {
	select {
	case item := <-q.items:
		atomic.AddInt64(&q.CurrentSize, -1)
		atomic.AddInt64(&q.Processed, 1)
		return item, true
	default:
		return nil, false
	}
}

// GetQueueStats returns queue statistics
func (c *BackpressureController) GetQueueStats(queueName string) map[string]int64 {
	c.mu.RLock()
	queue, ok := c.queues[queueName]
	c.mu.RUnlock()
	
	if !ok {
		return nil
	}
	
	return map[string]int64{
		"current_size": atomic.LoadInt64(&queue.CurrentSize),
		"max_size":     int64(queue.MaxSize),
		"dropped":      atomic.LoadInt64(&queue.Dropped),
		"processed":    atomic.LoadInt64(&queue.Processed),
	}
}

// GetLimiterStats returns limiter statistics
func (c *BackpressureController) GetLimiterStats(limiterName string) map[string]interface{} {
	c.mu.RLock()
	limiter, ok := c.limiters[limiterName]
	c.mu.RUnlock()
	
	if !ok {
		return nil
	}
	
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	
	return map[string]interface{}{
		"current_limit":   limiter.CurrentLimit,
		"current_rate":    atomic.LoadInt64(&limiter.CurrentRate),
		"current_latency": limiter.CurrentLatency,
		"error_rate":      limiter.ErrorRate,
		"tokens":          limiter.tokens,
	}
}
