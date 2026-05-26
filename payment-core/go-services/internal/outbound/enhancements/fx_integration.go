package enhancements

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// FXRateSource identifies where a rate came from
type FXRateSource string

const (
	SourceBloomberg FXRateSource = "bloomberg"
	SourceReuters   FXRateSource = "reuters"
	SourceCBN       FXRateSource = "cbn_official"
	SourceFallback  FXRateSource = "fallback_static"
)

// FXRateQuote represents a real-time FX rate from a provider
type FXRateQuote struct {
	BaseCurrency  string       `json:"baseCurrency"`
	QuoteCurrency string       `json:"quoteCurrency"`
	Bid           float64      `json:"bid"`
	Ask           float64      `json:"ask"`
	Mid           float64      `json:"mid"`
	Source        FXRateSource `json:"source"`
	Timestamp     time.Time    `json:"timestamp"`
	IsStale       bool         `json:"isStale"`
	StalenessMs   int64        `json:"stalenessMs"`
}

// CBNOfficialRate represents the CBN's published rate
type CBNOfficialRate struct {
	Currency    string    `json:"currency"`
	BuyingRate  float64   `json:"buyingRate"`
	SellingRate float64   `json:"sellingRate"`
	PublishedAt time.Time `json:"publishedAt"`
}

// FXSpreadConfig defines the spread parameters for a corridor
type FXSpreadConfig struct {
	Corridor       string  `json:"corridor"`
	CBNSpreadCap   int     `json:"cbnSpreadCapBps"` // basis points
	PlatformSpread int     `json:"platformSpreadBps"`
	MinSpread      int     `json:"minSpreadBps"`
	MaxSpread      int     `json:"maxSpreadBps"`
}

// FXRateOverride represents an admin-applied rate adjustment
type FXRateOverride struct {
	ID            string    `json:"id"`
	Corridor      string    `json:"corridor"`
	OverrideType  string    `json:"overrideType"` // spread_adjustment, rate_freeze, promotional
	SpreadBps     *int      `json:"spreadBps,omitempty"`
	FixedRate     *float64  `json:"fixedRate,omitempty"`
	Reason        string    `json:"reason"`
	AppliedBy     string    `json:"appliedBy"`
	AppliedAt     time.Time `json:"appliedAt"`
	ExpiresAt     *time.Time `json:"expiresAt,omitempty"`
	Active        bool      `json:"active"`
}

// FXAuditEntry records every rate change for regulatory compliance
type FXAuditEntry struct {
	ID            string    `json:"id"`
	Corridor      string    `json:"corridor"`
	Action        string    `json:"action"` // rate_update, spread_change, override_applied, freeze_activated
	PreviousValue string    `json:"previousValue"`
	NewValue      string    `json:"newValue"`
	Source        string    `json:"source"`
	UserID        string    `json:"userId,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// BloombergConfig holds Bloomberg B-PIPE connection parameters
type BloombergConfig struct {
	Enabled         bool          `json:"enabled"`
	Host            string        `json:"host"`
	Port            int           `json:"port"`
	ApplicationName string        `json:"applicationName"`
	AuthType        string        `json:"authType"` // user, application, token
	StalenessLimit  time.Duration `json:"stalenessLimit"`
	Subscriptions   []string      `json:"subscriptions"` // e.g. "NGN Curncy", "USDNGN Curncy"
}

// FXIntegrationService manages real-time FX rates from Bloomberg/Reuters/CBN
type FXIntegrationService struct {
	mu             sync.RWMutex
	rates          map[string]*FXRateQuote       // key: "NGN/GHS"
	cbnRates       map[string]*CBNOfficialRate   // key: currency code
	spreadConfigs  map[string]*FXSpreadConfig    // key: corridor
	overrides      []FXRateOverride
	auditLog       []FXAuditEntry
	bloomberg      BloombergConfig
	stalenessLimit time.Duration
	rateFrozen     bool
	frozenAt       *time.Time
	frozenBy       string
	frozenReason   string
}

// NewFXIntegrationService creates an FX service with Bloomberg configuration
func NewFXIntegrationService(bloombergCfg BloombergConfig) *FXIntegrationService {
	stalenessLimit := 30 * time.Second
	if bloombergCfg.StalenessLimit > 0 {
		stalenessLimit = bloombergCfg.StalenessLimit
	}

	svc := &FXIntegrationService{
		rates:          make(map[string]*FXRateQuote),
		cbnRates:       make(map[string]*CBNOfficialRate),
		spreadConfigs:  make(map[string]*FXSpreadConfig),
		overrides:      make([]FXRateOverride, 0),
		auditLog:       make([]FXAuditEntry, 0),
		bloomberg:      bloombergCfg,
		stalenessLimit: stalenessLimit,
	}

	// Initialize spread configs for all corridors
	corridorSpreads := map[string]FXSpreadConfig{
		"NG-GH": {Corridor: "NG-GH", CBNSpreadCap: 80, PlatformSpread: 60, MinSpread: 20, MaxSpread: 80},
		"NG-SN": {Corridor: "NG-SN", CBNSpreadCap: 100, PlatformSpread: 80, MinSpread: 30, MaxSpread: 100},
		"NG-CI": {Corridor: "NG-CI", CBNSpreadCap: 100, PlatformSpread: 80, MinSpread: 30, MaxSpread: 100},
		"NG-CM": {Corridor: "NG-CM", CBNSpreadCap: 120, PlatformSpread: 90, MinSpread: 30, MaxSpread: 120},
		"NG-KE": {Corridor: "NG-KE", CBNSpreadCap: 100, PlatformSpread: 75, MinSpread: 25, MaxSpread: 100},
		"NG-ZA": {Corridor: "NG-ZA", CBNSpreadCap: 90, PlatformSpread: 70, MinSpread: 25, MaxSpread: 90},
		"NG-GB": {Corridor: "NG-GB", CBNSpreadCap: 80, PlatformSpread: 50, MinSpread: 15, MaxSpread: 80},
		"NG-US": {Corridor: "NG-US", CBNSpreadCap: 80, PlatformSpread: 50, MinSpread: 15, MaxSpread: 80},
		"NG-CA": {Corridor: "NG-CA", CBNSpreadCap: 90, PlatformSpread: 60, MinSpread: 20, MaxSpread: 90},
		"NG-IN": {Corridor: "NG-IN", CBNSpreadCap: 120, PlatformSpread: 90, MinSpread: 30, MaxSpread: 120},
		"NG-CN": {Corridor: "NG-CN", CBNSpreadCap: 150, PlatformSpread: 100, MinSpread: 40, MaxSpread: 150},
		"NG-AE": {Corridor: "NG-AE", CBNSpreadCap: 120, PlatformSpread: 80, MinSpread: 30, MaxSpread: 120},
		"NG-TR": {Corridor: "NG-TR", CBNSpreadCap: 200, PlatformSpread: 120, MinSpread: 40, MaxSpread: 200},
	}

	for code, config := range corridorSpreads {
		cfg := config
		svc.spreadConfigs[code] = &cfg
	}

	return svc
}

// UpdateRate ingests a rate from Bloomberg/Reuters
func (fx *FXIntegrationService) UpdateRate(pair string, bid, ask float64, source FXRateSource) {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	mid := (bid + ask) / 2.0
	now := time.Now()

	prevRate := fx.rates[pair]
	prevValue := "none"
	if prevRate != nil {
		prevValue = fmt.Sprintf("%.6f", prevRate.Mid)
	}

	fx.rates[pair] = &FXRateQuote{
		BaseCurrency:  pair[:3],
		QuoteCurrency: pair[4:],
		Bid:           bid,
		Ask:           ask,
		Mid:           mid,
		Source:        source,
		Timestamp:     now,
		IsStale:       false,
		StalenessMs:   0,
	}

	fx.auditLog = append(fx.auditLog, FXAuditEntry{
		ID:            fmt.Sprintf("fx-audit-%d", now.UnixNano()),
		Corridor:      pair,
		Action:        "rate_update",
		PreviousValue: prevValue,
		NewValue:      fmt.Sprintf("%.6f (bid=%.6f ask=%.6f)", mid, bid, ask),
		Source:        string(source),
		Timestamp:     now,
	})
}

// UpdateCBNRate ingests the CBN official rate
func (fx *FXIntegrationService) UpdateCBNRate(currency string, buying, selling float64) {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	fx.cbnRates[currency] = &CBNOfficialRate{
		Currency:    currency,
		BuyingRate:  buying,
		SellingRate: selling,
		PublishedAt: time.Now(),
	}
}

// GetRate returns the current rate for a currency pair with staleness check
func (fx *FXIntegrationService) GetRate(pair string) (*FXRateQuote, error) {
	fx.mu.RLock()
	defer fx.mu.RUnlock()

	if fx.rateFrozen {
		rate, ok := fx.rates[pair]
		if ok {
			frozen := *rate
			frozen.IsStale = false // frozen rates are not stale by definition
			return &frozen, nil
		}
		return nil, fmt.Errorf("no rate available for %s (market frozen)", pair)
	}

	rate, ok := fx.rates[pair]
	if !ok {
		return nil, fmt.Errorf("no rate available for %s", pair)
	}

	staleness := time.Since(rate.Timestamp)
	quote := *rate
	quote.StalenessMs = staleness.Milliseconds()
	if staleness > fx.stalenessLimit {
		quote.IsStale = true
	}

	return &quote, nil
}

// GetEffectiveSpread returns the spread for a corridor accounting for overrides
func (fx *FXIntegrationService) GetEffectiveSpread(corridor string) int {
	fx.mu.RLock()
	defer fx.mu.RUnlock()

	config, ok := fx.spreadConfigs[corridor]
	if !ok {
		return 100 // default 100bps
	}

	effectiveSpread := config.PlatformSpread

	// Apply active overrides
	for _, override := range fx.overrides {
		if override.Corridor == corridor && override.Active {
			if override.ExpiresAt != nil && time.Now().After(*override.ExpiresAt) {
				continue
			}
			if override.SpreadBps != nil {
				effectiveSpread = *override.SpreadBps
			}
		}
	}

	// Enforce CBN cap
	if effectiveSpread > config.CBNSpreadCap {
		effectiveSpread = config.CBNSpreadCap
	}

	// Enforce minimum
	if effectiveSpread < config.MinSpread {
		effectiveSpread = config.MinSpread
	}

	return effectiveSpread
}

// ApplySpreadOverride sets an admin spread adjustment on a corridor
func (fx *FXIntegrationService) ApplySpreadOverride(corridor string, spreadBps int, reason string, appliedBy string, expiresIn *time.Duration) (*FXRateOverride, error) {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	config, ok := fx.spreadConfigs[corridor]
	if !ok {
		return nil, fmt.Errorf("corridor %s not found", corridor)
	}

	if spreadBps > config.CBNSpreadCap {
		return nil, fmt.Errorf("spread %d bps exceeds CBN cap of %d bps for %s", spreadBps, config.CBNSpreadCap, corridor)
	}

	now := time.Now()
	override := FXRateOverride{
		ID:           fmt.Sprintf("fx-override-%d", now.UnixNano()),
		Corridor:     corridor,
		OverrideType: "spread_adjustment",
		SpreadBps:    &spreadBps,
		Reason:       reason,
		AppliedBy:    appliedBy,
		AppliedAt:    now,
		Active:       true,
	}

	if expiresIn != nil {
		expires := now.Add(*expiresIn)
		override.ExpiresAt = &expires
	}

	// Deactivate previous overrides for this corridor
	for i := range fx.overrides {
		if fx.overrides[i].Corridor == corridor && fx.overrides[i].Active {
			fx.overrides[i].Active = false
		}
	}

	fx.overrides = append(fx.overrides, override)

	fx.auditLog = append(fx.auditLog, FXAuditEntry{
		ID:            fmt.Sprintf("fx-audit-%d", now.UnixNano()),
		Corridor:      corridor,
		Action:        "spread_change",
		PreviousValue: fmt.Sprintf("%d bps", config.PlatformSpread),
		NewValue:      fmt.Sprintf("%d bps (override by %s)", spreadBps, appliedBy),
		Source:        "admin_override",
		UserID:        appliedBy,
		Timestamp:     now,
	})

	return &override, nil
}

// FreezeAllRates freezes all FX rates (emergency market disruption)
func (fx *FXIntegrationService) FreezeAllRates(reason string, frozenBy string) {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	now := time.Now()
	fx.rateFrozen = true
	fx.frozenAt = &now
	fx.frozenBy = frozenBy
	fx.frozenReason = reason

	fx.auditLog = append(fx.auditLog, FXAuditEntry{
		ID:        fmt.Sprintf("fx-audit-%d", now.UnixNano()),
		Action:    "freeze_activated",
		NewValue:  fmt.Sprintf("All rates frozen: %s", reason),
		Source:    "admin_action",
		UserID:    frozenBy,
		Timestamp: now,
	})
}

// UnfreezeRates resumes live rate updates
func (fx *FXIntegrationService) UnfreezeRates(unfrozenBy string) {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	fx.rateFrozen = false

	fx.auditLog = append(fx.auditLog, FXAuditEntry{
		ID:        fmt.Sprintf("fx-audit-%d", time.Now().UnixNano()),
		Action:    "freeze_deactivated",
		NewValue:  "Rates unfrozen",
		Source:    "admin_action",
		UserID:    unfrozenBy,
		Timestamp: time.Now(),
	})
}

// IsRateFrozen returns whether rates are currently frozen
func (fx *FXIntegrationService) IsRateFrozen() bool {
	fx.mu.RLock()
	defer fx.mu.RUnlock()
	return fx.rateFrozen
}

// GetAuditLog returns rate change audit entries within a time range
func (fx *FXIntegrationService) GetAuditLog(since time.Time, limit int) []FXAuditEntry {
	fx.mu.RLock()
	defer fx.mu.RUnlock()

	var result []FXAuditEntry
	for i := len(fx.auditLog) - 1; i >= 0 && len(result) < limit; i-- {
		if fx.auditLog[i].Timestamp.After(since) {
			result = append(result, fx.auditLog[i])
		}
	}
	return result
}

// GetActiveOverrides returns all active rate overrides
func (fx *FXIntegrationService) GetActiveOverrides() []FXRateOverride {
	fx.mu.RLock()
	defer fx.mu.RUnlock()

	var active []FXRateOverride
	for _, o := range fx.overrides {
		if o.Active {
			if o.ExpiresAt != nil && time.Now().After(*o.ExpiresAt) {
				continue
			}
			active = append(active, o)
		}
	}
	return active
}

// RemoveOverride deactivates a specific override
func (fx *FXIntegrationService) RemoveOverride(overrideID string, removedBy string) bool {
	fx.mu.Lock()
	defer fx.mu.Unlock()

	for i := range fx.overrides {
		if fx.overrides[i].ID == overrideID && fx.overrides[i].Active {
			fx.overrides[i].Active = false

			fx.auditLog = append(fx.auditLog, FXAuditEntry{
				ID:        fmt.Sprintf("fx-audit-%d", time.Now().UnixNano()),
				Corridor:  fx.overrides[i].Corridor,
				Action:    "override_removed",
				NewValue:  fmt.Sprintf("Override %s removed by %s", overrideID, removedBy),
				Source:    "admin_action",
				UserID:    removedBy,
				Timestamp: time.Now(),
			})
			return true
		}
	}
	return false
}

// CalculateAllInRate computes the full rate a participant gets including spread and tier discount
func (fx *FXIntegrationService) CalculateAllInRate(corridor string, pair string, tierDiscount float64) (float64, error) {
	fx.mu.RLock()
	defer fx.mu.RUnlock()

	rate, ok := fx.rates[pair]
	if !ok {
		return 0, fmt.Errorf("no rate for %s", pair)
	}

	spreadBps := fx.spreadConfigs[corridor].PlatformSpread

	// Apply tier discount
	discountedSpread := float64(spreadBps) * (1 - tierDiscount)

	// Convert bps to rate adjustment
	spreadRate := rate.Mid * (discountedSpread / 10000)
	allInRate := rate.Mid + spreadRate

	// Enforce CBN cap
	maxSpread := rate.Mid * (float64(fx.spreadConfigs[corridor].CBNSpreadCap) / 10000)
	if math.Abs(spreadRate) > math.Abs(maxSpread) {
		allInRate = rate.Mid + maxSpread
	}

	return allInRate, nil
}
