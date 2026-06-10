// Package plugins provides a plugin/extension framework for customization
// Allows banks/governments to customize fees, FX, limits, and policies without forking core services
package plugins

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// PluginManager manages plugins and extensions
type PluginManager struct {
	// Registered plugins by type
	feePlugins       map[string]FeePlugin
	fxPlugins        map[string]FXPlugin
	limitPlugins     map[string]LimitPlugin
	policyPlugins    map[string]PolicyPlugin
	validatorPlugins map[string]ValidatorPlugin

	// Plugin registry
	registry map[string]*PluginInfo

	// Plugin execution order
	executionOrder map[string][]string

	// Stats
	totalExecutions  uint64
	failedExecutions uint64

	mu sync.RWMutex
}

// PluginInfo contains plugin metadata
type PluginInfo struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Type        string                 `json:"type"` // FEE, FX, LIMIT, POLICY, VALIDATOR
	Description string                 `json:"description"`
	Author      string                 `json:"author"`
	Enabled     bool                   `json:"enabled"`
	Priority    int                    `json:"priority"`
	Config      map[string]interface{} `json:"config"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// PluginContext provides context for plugin execution
type PluginContext struct {
	TransferID   string
	PayerFSPID   string
	PayeeFSPID   string
	Amount       Amount
	Currency     string
	TransferType string
	Metadata     map[string]interface{}
	Timestamp    time.Time
}

// Amount represents a monetary amount
type Amount struct {
	Value    int64  `json:"value"`
	Currency string `json:"currency"`
	Scale    int    `json:"scale"`
}

// PluginResult contains the result of plugin execution
type PluginResult struct {
	PluginID string                 `json:"plugin_id"`
	Success  bool                   `json:"success"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Error    string                 `json:"error,omitempty"`
	Duration time.Duration          `json:"duration"`
}

// FeePlugin interface for fee calculation plugins
type FeePlugin interface {
	ID() string
	CalculateFee(ctx context.Context, pctx *PluginContext) (*FeeResult, error)
}

// FeeResult contains fee calculation result
type FeeResult struct {
	FeeAmount    Amount    `json:"fee_amount"`
	FeeType      string    `json:"fee_type"` // FLAT, PERCENTAGE, TIERED
	FeeBreakdown []FeeItem `json:"fee_breakdown"`
	WaivedAmount Amount    `json:"waived_amount,omitempty"`
	WaiverReason string    `json:"waiver_reason,omitempty"`
}

// FeeItem represents a fee breakdown item
type FeeItem struct {
	Name        string `json:"name"`
	Amount      Amount `json:"amount"`
	Description string `json:"description"`
}

// FXPlugin interface for foreign exchange plugins
type FXPlugin interface {
	ID() string
	GetExchangeRate(ctx context.Context, sourceCurrency, targetCurrency string, amount Amount) (*FXResult, error)
	ConvertAmount(ctx context.Context, amount Amount, targetCurrency string) (*FXResult, error)
}

// FXResult contains FX conversion result
type FXResult struct {
	SourceAmount  Amount    `json:"source_amount"`
	TargetAmount  Amount    `json:"target_amount"`
	ExchangeRate  float64   `json:"exchange_rate"`
	RateTimestamp time.Time `json:"rate_timestamp"`
	RateSource    string    `json:"rate_source"`
	Spread        float64   `json:"spread"`
	ValidUntil    time.Time `json:"valid_until"`
}

// LimitPlugin interface for limit checking plugins
type LimitPlugin interface {
	ID() string
	CheckLimit(ctx context.Context, pctx *PluginContext) (*LimitResult, error)
	GetLimits(ctx context.Context, accountID string) ([]Limit, error)
}

// LimitResult contains limit check result
type LimitResult struct {
	Allowed        bool      `json:"allowed"`
	LimitType      string    `json:"limit_type"` // DAILY, WEEKLY, MONTHLY, TRANSACTION
	CurrentUsage   Amount    `json:"current_usage"`
	MaxLimit       Amount    `json:"max_limit"`
	RemainingLimit Amount    `json:"remaining_limit"`
	ResetAt        time.Time `json:"reset_at"`
	ViolatedLimits []string  `json:"violated_limits,omitempty"`
}

// Limit represents a limit configuration
type Limit struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	MaxAmount    Amount    `json:"max_amount"`
	Period       string    `json:"period"`
	CurrentUsage Amount    `json:"current_usage"`
	ResetAt      time.Time `json:"reset_at"`
}

// PolicyPlugin interface for policy enforcement plugins
type PolicyPlugin interface {
	ID() string
	EvaluatePolicy(ctx context.Context, pctx *PluginContext) (*PolicyResult, error)
}

// PolicyResult contains policy evaluation result
type PolicyResult struct {
	Allowed         bool                   `json:"allowed"`
	PolicyID        string                 `json:"policy_id"`
	PolicyName      string                 `json:"policy_name"`
	Reason          string                 `json:"reason,omitempty"`
	RequiredActions []string               `json:"required_actions,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// ValidatorPlugin interface for validation plugins
type ValidatorPlugin interface {
	ID() string
	Validate(ctx context.Context, pctx *PluginContext) (*ValidationResult, error)
}

// ValidationResult contains validation result
type ValidationResult struct {
	Valid    bool              `json:"valid"`
	Errors   []ValidationError `json:"errors,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewPluginManager creates a new plugin manager
func NewPluginManager() *PluginManager {
	pm := &PluginManager{
		feePlugins:       make(map[string]FeePlugin),
		fxPlugins:        make(map[string]FXPlugin),
		limitPlugins:     make(map[string]LimitPlugin),
		policyPlugins:    make(map[string]PolicyPlugin),
		validatorPlugins: make(map[string]ValidatorPlugin),
		registry:         make(map[string]*PluginInfo),
		executionOrder:   make(map[string][]string),
	}

	// Register default plugins
	pm.registerDefaultPlugins()

	return pm
}

// registerDefaultPlugins registers the default plugins
func (pm *PluginManager) registerDefaultPlugins() {
	// Register default fee plugin
	pm.RegisterFeePlugin(&DefaultFeePlugin{})

	// Register default FX plugin
	pm.RegisterFXPlugin(&DefaultFXPlugin{})

	// Register default limit plugin
	pm.RegisterLimitPlugin(&DefaultLimitPlugin{})

	// Register default policy plugin
	pm.RegisterPolicyPlugin(&DefaultPolicyPlugin{})
}

// RegisterFeePlugin registers a fee plugin
func (pm *PluginManager) RegisterFeePlugin(plugin FeePlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.feePlugins[plugin.ID()] = plugin
	pm.registry[plugin.ID()] = &PluginInfo{
		ID:        plugin.ID(),
		Type:      "FEE",
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// RegisterFXPlugin registers an FX plugin
func (pm *PluginManager) RegisterFXPlugin(plugin FXPlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.fxPlugins[plugin.ID()] = plugin
	pm.registry[plugin.ID()] = &PluginInfo{
		ID:        plugin.ID(),
		Type:      "FX",
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// RegisterLimitPlugin registers a limit plugin
func (pm *PluginManager) RegisterLimitPlugin(plugin LimitPlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.limitPlugins[plugin.ID()] = plugin
	pm.registry[plugin.ID()] = &PluginInfo{
		ID:        plugin.ID(),
		Type:      "LIMIT",
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// RegisterPolicyPlugin registers a policy plugin
func (pm *PluginManager) RegisterPolicyPlugin(plugin PolicyPlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.policyPlugins[plugin.ID()] = plugin
	pm.registry[plugin.ID()] = &PluginInfo{
		ID:        plugin.ID(),
		Type:      "POLICY",
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// RegisterValidatorPlugin registers a validator plugin
func (pm *PluginManager) RegisterValidatorPlugin(plugin ValidatorPlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.validatorPlugins[plugin.ID()] = plugin
	pm.registry[plugin.ID()] = &PluginInfo{
		ID:        plugin.ID(),
		Type:      "VALIDATOR",
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// CalculateFees calculates fees using all registered fee plugins
func (pm *PluginManager) CalculateFees(ctx context.Context, pctx *PluginContext) (*FeeResult, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	totalFee := &FeeResult{
		FeeAmount:    Amount{Value: 0, Currency: pctx.Currency, Scale: 2},
		FeeBreakdown: make([]FeeItem, 0),
	}

	for _, plugin := range pm.feePlugins {
		info := pm.registry[plugin.ID()]
		if info == nil || !info.Enabled {
			continue
		}

		result, err := plugin.CalculateFee(ctx, pctx)
		if err != nil {
			return nil, fmt.Errorf("fee plugin %s failed: %w", plugin.ID(), err)
		}

		totalFee.FeeAmount.Value += result.FeeAmount.Value
		totalFee.FeeBreakdown = append(totalFee.FeeBreakdown, result.FeeBreakdown...)
	}

	return totalFee, nil
}

// ConvertCurrency converts currency using FX plugins
func (pm *PluginManager) ConvertCurrency(ctx context.Context, amount Amount, targetCurrency string) (*FXResult, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, plugin := range pm.fxPlugins {
		info := pm.registry[plugin.ID()]
		if info == nil || !info.Enabled {
			continue
		}

		result, err := plugin.ConvertAmount(ctx, amount, targetCurrency)
		if err != nil {
			continue // Try next plugin
		}

		return result, nil
	}

	return nil, fmt.Errorf("no FX plugin available for conversion")
}

// CheckLimits checks limits using all registered limit plugins
func (pm *PluginManager) CheckLimits(ctx context.Context, pctx *PluginContext) (*LimitResult, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, plugin := range pm.limitPlugins {
		info := pm.registry[plugin.ID()]
		if info == nil || !info.Enabled {
			continue
		}

		result, err := plugin.CheckLimit(ctx, pctx)
		if err != nil {
			return nil, fmt.Errorf("limit plugin %s failed: %w", plugin.ID(), err)
		}

		if !result.Allowed {
			return result, nil
		}
	}

	return &LimitResult{Allowed: true}, nil
}

// EvaluatePolicies evaluates policies using all registered policy plugins
func (pm *PluginManager) EvaluatePolicies(ctx context.Context, pctx *PluginContext) (*PolicyResult, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, plugin := range pm.policyPlugins {
		info := pm.registry[plugin.ID()]
		if info == nil || !info.Enabled {
			continue
		}

		result, err := plugin.EvaluatePolicy(ctx, pctx)
		if err != nil {
			return nil, fmt.Errorf("policy plugin %s failed: %w", plugin.ID(), err)
		}

		if !result.Allowed {
			return result, nil
		}
	}

	return &PolicyResult{Allowed: true}, nil
}

// Validate validates using all registered validator plugins
func (pm *PluginManager) Validate(ctx context.Context, pctx *PluginContext) (*ValidationResult, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	allErrors := make([]ValidationError, 0)
	allWarnings := make([]string, 0)

	for _, plugin := range pm.validatorPlugins {
		info := pm.registry[plugin.ID()]
		if info == nil || !info.Enabled {
			continue
		}

		result, err := plugin.Validate(ctx, pctx)
		if err != nil {
			return nil, fmt.Errorf("validator plugin %s failed: %w", plugin.ID(), err)
		}

		allErrors = append(allErrors, result.Errors...)
		allWarnings = append(allWarnings, result.Warnings...)
	}

	return &ValidationResult{
		Valid:    len(allErrors) == 0,
		Errors:   allErrors,
		Warnings: allWarnings,
	}, nil
}

// GetPlugins returns all registered plugins
func (pm *PluginManager) GetPlugins() []*PluginInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	plugins := make([]*PluginInfo, 0, len(pm.registry))
	for _, info := range pm.registry {
		plugins = append(plugins, info)
	}
	return plugins
}

// EnablePlugin enables a plugin
func (pm *PluginManager) EnablePlugin(pluginID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	info, ok := pm.registry[pluginID]
	if !ok {
		return fmt.Errorf("plugin not found: %s", pluginID)
	}

	info.Enabled = true
	info.UpdatedAt = time.Now()
	return nil
}

// DisablePlugin disables a plugin
func (pm *PluginManager) DisablePlugin(pluginID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	info, ok := pm.registry[pluginID]
	if !ok {
		return fmt.Errorf("plugin not found: %s", pluginID)
	}

	info.Enabled = false
	info.UpdatedAt = time.Now()
	return nil
}

// ConfigurePlugin configures a plugin
func (pm *PluginManager) ConfigurePlugin(pluginID string, config map[string]interface{}) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	info, ok := pm.registry[pluginID]
	if !ok {
		return fmt.Errorf("plugin not found: %s", pluginID)
	}

	info.Config = config
	info.UpdatedAt = time.Now()
	return nil
}

// Default plugin implementations

// DefaultFeePlugin is the default fee calculation plugin
type DefaultFeePlugin struct{}

func (p *DefaultFeePlugin) ID() string { return "default-fee" }

func (p *DefaultFeePlugin) CalculateFee(ctx context.Context, pctx *PluginContext) (*FeeResult, error) {
	// Default: 0.5% fee with minimum of 100 (in minor units)
	feeValue := pctx.Amount.Value * 5 / 1000 // 0.5%
	if feeValue < 100 {
		feeValue = 100
	}

	return &FeeResult{
		FeeAmount: Amount{Value: feeValue, Currency: pctx.Currency, Scale: 2},
		FeeType:   "PERCENTAGE",
		FeeBreakdown: []FeeItem{
			{Name: "Transaction Fee", Amount: Amount{Value: feeValue, Currency: pctx.Currency, Scale: 2}},
		},
	}, nil
}

// DefaultFXPlugin is the default FX plugin
type DefaultFXPlugin struct{}

func (p *DefaultFXPlugin) ID() string { return "default-fx" }

func (p *DefaultFXPlugin) GetExchangeRate(ctx context.Context, sourceCurrency, targetCurrency string, amount Amount) (*FXResult, error) {
	// CBN-aligned indicative rates for Nigerian cross-border payments
	// In production, these are fetched from CBN EFEM auction results or licensed rate providers
	rates := map[string]map[string]float64{
		"NGN": {"USD": 0.000625, "GBP": 0.000500, "EUR": 0.000580, "GHS": 0.0075, "KES": 0.085, "ZAR": 0.0115, "CNY": 0.00455, "AED": 0.00230, "INR": 0.0525, "XOF": 0.375},
		"USD": {"NGN": 1600.00, "GBP": 0.79, "EUR": 0.93, "GHS": 12.00, "KES": 136.00},
		"GBP": {"NGN": 2025.00, "USD": 1.27, "EUR": 1.17, "GHS": 15.24},
		"EUR": {"NGN": 1720.00, "USD": 1.08, "GBP": 0.86},
	}

	rate := 1.0
	if srcRates, ok := rates[sourceCurrency]; ok {
		if r, ok := srcRates[targetCurrency]; ok {
			rate = r
		}
	}

	spread := 0.015 // 1.5% default spread for cross-border
	if sourceCurrency == "NGN" || targetCurrency == "NGN" {
		spread = 0.02 // 2% for NGN corridors (CBN margin)
	}

	targetValue := int64(float64(amount.Value) * rate * (1 - spread))

	return &FXResult{
		SourceAmount:  amount,
		TargetAmount:  Amount{Value: targetValue, Currency: targetCurrency, Scale: amount.Scale},
		ExchangeRate:  rate,
		RateTimestamp: time.Now(),
		RateSource:    "cbn-indicative",
		Spread:        spread,
		ValidUntil:    time.Now().Add(5 * time.Minute),
	}, nil
}

func (p *DefaultFXPlugin) ConvertAmount(ctx context.Context, amount Amount, targetCurrency string) (*FXResult, error) {
	return p.GetExchangeRate(ctx, amount.Currency, targetCurrency, amount)
}

// DefaultLimitPlugin is the default limit checking plugin
type DefaultLimitPlugin struct{}

func (p *DefaultLimitPlugin) ID() string { return "default-limit" }

func (p *DefaultLimitPlugin) CheckLimit(ctx context.Context, pctx *PluginContext) (*LimitResult, error) {
	// Default: Allow all transactions up to 1,000,000 (in minor units)
	maxLimit := int64(100000000) // 1,000,000.00

	if pctx.Amount.Value > maxLimit {
		return &LimitResult{
			Allowed:        false,
			LimitType:      "TRANSACTION",
			CurrentUsage:   pctx.Amount,
			MaxLimit:       Amount{Value: maxLimit, Currency: pctx.Currency, Scale: 2},
			ViolatedLimits: []string{"MAX_TRANSACTION_AMOUNT"},
		}, nil
	}

	return &LimitResult{
		Allowed:        true,
		LimitType:      "TRANSACTION",
		MaxLimit:       Amount{Value: maxLimit, Currency: pctx.Currency, Scale: 2},
		RemainingLimit: Amount{Value: maxLimit - pctx.Amount.Value, Currency: pctx.Currency, Scale: 2},
	}, nil
}

func (p *DefaultLimitPlugin) GetLimits(ctx context.Context, accountID string) ([]Limit, error) {
	return []Limit{
		{
			ID:        "daily-limit",
			Type:      "DAILY",
			MaxAmount: Amount{Value: 1000000000, Currency: "USD", Scale: 2}, // 10,000,000.00
			Period:    "24h",
		},
		{
			ID:        "transaction-limit",
			Type:      "TRANSACTION",
			MaxAmount: Amount{Value: 100000000, Currency: "USD", Scale: 2}, // 1,000,000.00
			Period:    "single",
		},
	}, nil
}

// DefaultPolicyPlugin is the default policy enforcement plugin
type DefaultPolicyPlugin struct{}

func (p *DefaultPolicyPlugin) ID() string { return "default-policy" }

func (p *DefaultPolicyPlugin) EvaluatePolicy(ctx context.Context, pctx *PluginContext) (*PolicyResult, error) {
	// Default: Allow all transactions
	return &PolicyResult{
		Allowed:    true,
		PolicyID:   "default",
		PolicyName: "Default Allow Policy",
	}, nil
}
