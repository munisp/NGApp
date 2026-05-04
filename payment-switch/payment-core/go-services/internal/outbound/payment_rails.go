package outbound

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// =============================================================================
// PAYMENT RAIL TYPES & INTERFACES
// =============================================================================

// RailType classifies the settlement network used for cross-border payout
type RailType string

const (
	RailSWIFT       RailType = "SWIFT"        // SWIFT gpi / correspondent banking
	RailPAPSS       RailType = "PAPSS"        // Pan-African Payment and Settlement System
	RailCIPS        RailType = "CIPS"         // China Cross-Border Interbank Payment System
	RailUPI         RailType = "UPI"          // India Unified Payments Interface
	RailSEPA        RailType = "SEPA"         // Single Euro Payments Area
	RailMobileMoney RailType = "MOBILE_MONEY" // MTN MoMo, M-Pesa, Airtel Money
	RailMojaloop    RailType = "MOJALOOP"     // Mojaloop interoperability hub
	RailACH         RailType = "ACH"          // US Automated Clearing House
	RailFasterPay   RailType = "FASTER_PAY"   // UK Faster Payments
)

// PaymentRailAdapter extends ProviderAdapter with rail-specific capabilities
type PaymentRailAdapter interface {
	ProviderAdapter
	RailType() RailType
	SettlementCurrency() string
	MessageFormat() string                                               // ISO 20022, MT103, proprietary
	MaxSettlementTime() time.Duration                                    // worst-case settlement window
	SupportsTracking() bool                                              // real-time tracking (SWIFT gpi, UPI)
	ValidateDestination(ctx context.Context, req *PayoutRequest) error   // pre-flight validation
	EstimateRailFee(amount float64, currency string) float64             // rail-specific cost
}

// RailRoutingConfig maps corridors to their preferred and fallback rails
type RailRoutingConfig struct {
	CorridorID    string     `json:"corridor_id"`
	PrimaryRail   RailType   `json:"primary_rail"`
	FallbackRails []RailType `json:"fallback_rails"`
	RailFeeRate   float64    `json:"rail_fee_rate"`   // corridor fee rate per document: PrincipalAmount × CorridorRate(dest, rail)
	RailFixedFee  float64    `json:"rail_fixed_fee"`  // fixed component in USD
}

// RailStatus tracks the operational state of each payment rail
type RailStatus struct {
	Rail            RailType  `json:"rail"`
	Status          string    `json:"status"` // "operational", "degraded", "down", "maintenance"
	AvgLatencyMs    int       `json:"avg_latency_ms"`
	SuccessRate24h  float64   `json:"success_rate_24h"`
	LastTransaction time.Time `json:"last_transaction"`
	ActiveTxnCount  int       `json:"active_txn_count"`
	DailyVolume     float64   `json:"daily_volume_usd"`
	Message         string    `json:"message,omitempty"`
}

// =============================================================================
// PAYMENT RAIL REGISTRY — integrates with Mojaloop hub
// =============================================================================

// PaymentRailRegistry manages all payment rail adapters and their routing
type PaymentRailRegistry struct {
	rails          map[RailType]PaymentRailAdapter
	corridorRoutes map[string]*RailRoutingConfig
	railStatus     map[RailType]*RailStatus
	mu             sync.RWMutex
}

// NewPaymentRailRegistry creates the registry with all rails and Mojaloop integration
func NewPaymentRailRegistry() *PaymentRailRegistry {
	r := &PaymentRailRegistry{
		rails:          make(map[RailType]PaymentRailAdapter),
		corridorRoutes: make(map[string]*RailRoutingConfig),
		railStatus:     make(map[RailType]*RailStatus),
	}

	// Register all payment rails
	r.RegisterRail(&SWIFTAdapter{})
	r.RegisterRail(&PAPSSAdapter{})
	r.RegisterRail(&CIPSAdapter{})
	r.RegisterRail(&UPIAdapter{})
	r.RegisterRail(&SEPAAdapter{})
	r.RegisterRail(&MobileMoneyRailAdapter{})
	r.RegisterRail(&MojaloopRailAdapter{})
	r.RegisterRail(&ACHAdapter{})
	r.RegisterRail(&FasterPaymentsAdapter{})

	// Configure corridor-to-rail routing per architecture document
	// Document §12.4: "Corridor-Based Variable Fee... tailored to the cost-to-serve
	// of the destination rail (e.g., SWIFT vs. regional mobile money)"
	r.configureCorridorRoutes()

	// Initialize rail status
	for railType := range r.rails {
		r.railStatus[railType] = &RailStatus{
			Rail:           railType,
			Status:         "operational",
			AvgLatencyMs:   0,
			SuccessRate24h: 100.0,
		}
	}

	return r
}

// configureCorridorRoutes maps each corridor to primary + fallback rails
// with rail-specific pricing per document Appendix A.1 formula:
// CorridorFee = PrincipalAmount × CorridorRate(dest, rail)
func (r *PaymentRailRegistry) configureCorridorRoutes() {
	routes := []*RailRoutingConfig{
		// West African labor corridors — primarily PAPSS + Mobile Money, SWIFT fallback
		{CorridorID: "NG-GH", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailMobileMoney, RailMojaloop}, RailFeeRate: 0.0005, RailFixedFee: 0.10},
		{CorridorID: "NG-SN", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailMobileMoney, RailMojaloop}, RailFeeRate: 0.0008, RailFixedFee: 0.10},
		{CorridorID: "NG-CI", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailMobileMoney, RailMojaloop}, RailFeeRate: 0.0008, RailFixedFee: 0.10},
		{CorridorID: "NG-CM", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailMobileMoney, RailMojaloop}, RailFeeRate: 0.0008, RailFixedFee: 0.10},
		{CorridorID: "NG-KE", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailMobileMoney, RailSWIFT}, RailFeeRate: 0.0006, RailFixedFee: 0.10},
		{CorridorID: "NG-ZA", PrimaryRail: RailPAPSS, FallbackRails: []RailType{RailSWIFT}, RailFeeRate: 0.0007, RailFixedFee: 0.15},

		// OECD/premium corridors — primarily SWIFT, with local rail fallback
		{CorridorID: "NG-GB", PrimaryRail: RailSWIFT, FallbackRails: []RailType{RailFasterPay, RailSEPA}, RailFeeRate: 0.0010, RailFixedFee: 0.25},
		{CorridorID: "NG-US", PrimaryRail: RailSWIFT, FallbackRails: []RailType{RailACH}, RailFeeRate: 0.0010, RailFixedFee: 0.25},
		{CorridorID: "NG-CA", PrimaryRail: RailSWIFT, FallbackRails: []RailType{RailACH}, RailFeeRate: 0.0012, RailFixedFee: 0.25},
		{CorridorID: "NG-AE", PrimaryRail: RailSWIFT, FallbackRails: []RailType{}, RailFeeRate: 0.0015, RailFixedFee: 0.30},
		{CorridorID: "NG-TR", PrimaryRail: RailSWIFT, FallbackRails: []RailType{RailSEPA}, RailFeeRate: 0.0012, RailFixedFee: 0.25},

		// Destination-specific rails
		{CorridorID: "NG-CN", PrimaryRail: RailCIPS, FallbackRails: []RailType{RailSWIFT}, RailFeeRate: 0.0008, RailFixedFee: 0.20},
		{CorridorID: "NG-IN", PrimaryRail: RailUPI, FallbackRails: []RailType{RailSWIFT}, RailFeeRate: 0.0004, RailFixedFee: 0.05},
	}
	for _, route := range routes {
		r.corridorRoutes[route.CorridorID] = route
	}
}

// RegisterRail adds a payment rail adapter
func (r *PaymentRailRegistry) RegisterRail(adapter PaymentRailAdapter) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rails[adapter.RailType()] = adapter
}

// GetRailForCorridor returns the primary rail for a corridor
func (r *PaymentRailRegistry) GetRailForCorridor(corridorID string) (PaymentRailAdapter, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	route, ok := r.corridorRoutes[corridorID]
	if !ok {
		return nil, fmt.Errorf("no rail routing configured for corridor: %s", corridorID)
	}
	rail, ok := r.rails[route.PrimaryRail]
	if !ok {
		return nil, fmt.Errorf("primary rail %s not registered", route.PrimaryRail)
	}
	return rail, nil
}

// GetCorridorRouting returns the full routing config for a corridor
func (r *PaymentRailRegistry) GetCorridorRouting(corridorID string) (*RailRoutingConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	route, ok := r.corridorRoutes[corridorID]
	if !ok {
		return nil, fmt.Errorf("no rail routing configured for corridor: %s", corridorID)
	}
	return route, nil
}

// CalculateCorridorFee implements the document formula:
// CorridorFee = PrincipalAmount × CorridorRate(dest, rail) + RailFixedFee
func (r *PaymentRailRegistry) CalculateCorridorFee(corridorID string, principalUSD float64) (float64, RailType, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	route, ok := r.corridorRoutes[corridorID]
	if !ok {
		return 0, "", fmt.Errorf("no rail routing for corridor: %s", corridorID)
	}
	fee := principalUSD*route.RailFeeRate + route.RailFixedFee
	return fee, route.PrimaryRail, nil
}

// SelectRailWithFallback selects the best available rail for a corridor,
// falling back if primary rail is degraded or down
func (r *PaymentRailRegistry) SelectRailWithFallback(corridorID string) (PaymentRailAdapter, RailType, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	route, ok := r.corridorRoutes[corridorID]
	if !ok {
		return nil, "", fmt.Errorf("no rail routing for corridor: %s", corridorID)
	}

	// Try primary rail first
	if status, ok := r.railStatus[route.PrimaryRail]; ok && status.Status == "operational" {
		if rail, ok := r.rails[route.PrimaryRail]; ok {
			return rail, route.PrimaryRail, nil
		}
	}

	// Try fallback rails in order
	for _, fallbackType := range route.FallbackRails {
		if status, ok := r.railStatus[fallbackType]; ok && status.Status == "operational" {
			if rail, ok := r.rails[fallbackType]; ok {
				return rail, fallbackType, nil
			}
		}
	}

	return nil, "", fmt.Errorf("all rails unavailable for corridor %s (primary: %s, fallbacks: %v)", corridorID, route.PrimaryRail, route.FallbackRails)
}

// UpdateRailStatus updates the operational status of a rail
func (r *PaymentRailRegistry) UpdateRailStatus(rail RailType, status string, latencyMs int, successRate float64, message string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.railStatus[rail] = &RailStatus{
		Rail:            rail,
		Status:          status,
		AvgLatencyMs:    latencyMs,
		SuccessRate24h:  successRate,
		LastTransaction: time.Now(),
		Message:         message,
	}
}

// GetAllRailStatuses returns the operational status of all rails
func (r *PaymentRailRegistry) GetAllRailStatuses() []RailStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]RailStatus, 0, len(r.railStatus))
	for _, s := range r.railStatus {
		result = append(result, *s)
	}
	return result
}

// GetAllCorridorRoutes returns all corridor routing configs
func (r *PaymentRailRegistry) GetAllCorridorRoutes() []RailRoutingConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]RailRoutingConfig, 0, len(r.corridorRoutes))
	for _, route := range r.corridorRoutes {
		result = append(result, *route)
	}
	return result
}

// =============================================================================
// SWIFT ADAPTER — Correspondent banking via SWIFT gpi
// =============================================================================

// SWIFTAdapter integrates with the SWIFT network for cross-border bank transfers.
// Uses SWIFT gpi (Global Payments Innovation) for tracking and SLA enforcement.
// Message format: MT103 (single customer credit transfer) / ISO 20022 pacs.008.
type SWIFTAdapter struct{}

func (a *SWIFTAdapter) ID() string                    { return "swift_gpi" }
func (a *SWIFTAdapter) Name() string                  { return "SWIFT gpi" }
func (a *SWIFTAdapter) RailType() RailType             { return RailSWIFT }
func (a *SWIFTAdapter) SettlementCurrency() string     { return "USD" }
func (a *SWIFTAdapter) MessageFormat() string          { return "MT103/ISO20022" }
func (a *SWIFTAdapter) MaxSettlementTime() time.Duration { return 48 * time.Hour }
func (a *SWIFTAdapter) SupportsTracking() bool         { return true }
func (a *SWIFTAdapter) SupportedCorridors() []string {
	return []string{"NG-GB", "NG-US", "NG-CA", "NG-AE", "NG-TR", "NG-CN", "NG-ZA"}
}
func (a *SWIFTAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *SWIFTAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *SWIFTAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryBank == "" {
		return fmt.Errorf("SWIFT requires beneficiary BIC/SWIFT code")
	}
	if len(req.BeneficiaryAcct) < 8 {
		return fmt.Errorf("SWIFT requires valid IBAN or account number (min 8 chars)")
	}
	return nil
}

func (a *SWIFTAdapter) EstimateRailFee(amount float64, currency string) float64 {
	// SWIFT transfers typically $15-45 in correspondent fees
	if amount > 50000 {
		return 25.00
	}
	return 15.00
}

func (a *SWIFTAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Construct MT103 message → submit via SWIFT Alliance Lite2
	// SWIFT gpi UETR (Unique End-to-end Transaction Reference) for tracking
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("SWIFT validation failed: %w", err)
	}
	uetr := fmt.Sprintf("SWIFT-%s-UETR", req.TransferID[:8])
	return &PayoutResponse{
		ProviderRef:      uetr,
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(24 * time.Hour), // T+1 typical for SWIFT gpi
	}, nil
}

func (a *SWIFTAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	// Production: Query SWIFT gpi Tracker API for UETR status
	return &PayoutStatus{ProviderRef: ref, Status: "processing"}, nil
}

// =============================================================================
// PAPSS ADAPTER — Pan-African Payment and Settlement System
// =============================================================================

// PAPSSAdapter integrates with PAPSS for instant intra-African cross-border payments.
// PAPSS enables settlement in local African currencies without USD intermediation.
// Developed by Afreximbank, operational across WAMZ, ECOWAS, and expanding.
type PAPSSAdapter struct{}

func (a *PAPSSAdapter) ID() string                    { return "papss" }
func (a *PAPSSAdapter) Name() string                  { return "PAPSS (Pan-African)" }
func (a *PAPSSAdapter) RailType() RailType             { return RailPAPSS }
func (a *PAPSSAdapter) SettlementCurrency() string     { return "LOCAL" } // settles in destination currency
func (a *PAPSSAdapter) MessageFormat() string          { return "ISO20022" }
func (a *PAPSSAdapter) MaxSettlementTime() time.Duration { return 2 * time.Minute } // near-instant
func (a *PAPSSAdapter) SupportsTracking() bool         { return true }
func (a *PAPSSAdapter) SupportedCorridors() []string {
	// All intra-African corridors
	return []string{"NG-GH", "NG-KE", "NG-ZA", "NG-SN", "NG-CI", "NG-CM"}
}
func (a *PAPSSAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *PAPSSAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *PAPSSAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryAcct == "" && req.BeneficiaryPhone == "" {
		return fmt.Errorf("PAPSS requires beneficiary account or mobile number")
	}
	// PAPSS supports bank account, mobile money, and wallet destinations
	return nil
}

func (a *PAPSSAdapter) EstimateRailFee(amount float64, currency string) float64 {
	// PAPSS designed for low-cost African transfers — significantly cheaper than SWIFT
	return 0.50 // flat $0.50 per transaction
}

func (a *PAPSSAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Submit via PAPSS API Gateway (Afreximbank)
	// Uses ISO 20022 pacs.008 for credit transfers
	// Settlement in local currency (no USD nostro needed)
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("PAPSS validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("PAPSS-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(2 * time.Minute), // near-instant settlement
	}, nil
}

func (a *PAPSSAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	// Production: Query PAPSS status API
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// =============================================================================
// CIPS ADAPTER — China Cross-Border Interbank Payment System
// =============================================================================

// CIPSAdapter integrates with CIPS for CNY cross-border transfers.
// CIPS is China's alternative to SWIFT for RMB-denominated payments.
// Operated by the People's Bank of China (PBOC).
type CIPSAdapter struct{}

func (a *CIPSAdapter) ID() string                    { return "cips" }
func (a *CIPSAdapter) Name() string                  { return "CIPS (China)" }
func (a *CIPSAdapter) RailType() RailType             { return RailCIPS }
func (a *CIPSAdapter) SettlementCurrency() string     { return "CNY" }
func (a *CIPSAdapter) MessageFormat() string          { return "ISO20022/CIPS" }
func (a *CIPSAdapter) MaxSettlementTime() time.Duration { return 4 * time.Hour }
func (a *CIPSAdapter) SupportsTracking() bool         { return true }
func (a *CIPSAdapter) SupportedCorridors() []string   { return []string{"NG-CN"} }
func (a *CIPSAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *CIPSAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *CIPSAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryBank == "" {
		return fmt.Errorf("CIPS requires beneficiary bank CNAPS code")
	}
	if req.BeneficiaryAcct == "" {
		return fmt.Errorf("CIPS requires beneficiary bank account number")
	}
	if req.BeneficiaryName == "" {
		return fmt.Errorf("CIPS requires beneficiary name in Chinese characters or Pinyin")
	}
	return nil
}

func (a *CIPSAdapter) EstimateRailFee(amount float64, currency string) float64 {
	// CIPS fees are lower than SWIFT for CNY transfers
	if amount > 100000 {
		return 12.00
	}
	return 8.00
}

func (a *CIPSAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Submit via CIPS direct participant or indirect via correspondent
	// Message format: CIPS-specific ISO 20022 variant
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("CIPS validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("CIPS-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(4 * time.Hour),
	}, nil
}

func (a *CIPSAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "processing"}, nil
}

// =============================================================================
// UPI ADAPTER — India Unified Payments Interface
// =============================================================================

// UPIAdapter integrates with India's UPI for INR real-time payments.
// UPI International enables cross-border remittances to Indian bank accounts.
// Operated by NPCI (National Payments Corporation of India).
type UPIAdapter struct{}

func (a *UPIAdapter) ID() string                    { return "upi" }
func (a *UPIAdapter) Name() string                  { return "UPI International (India)" }
func (a *UPIAdapter) RailType() RailType             { return RailUPI }
func (a *UPIAdapter) SettlementCurrency() string     { return "INR" }
func (a *UPIAdapter) MessageFormat() string          { return "UPI/ISO20022" }
func (a *UPIAdapter) MaxSettlementTime() time.Duration { return 30 * time.Second }
func (a *UPIAdapter) SupportsTracking() bool         { return true }
func (a *UPIAdapter) SupportedCorridors() []string   { return []string{"NG-IN"} }
func (a *UPIAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *UPIAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *UPIAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	// UPI accepts VPA (Virtual Payment Address) or bank account + IFSC
	if req.BeneficiaryAcct == "" && req.BeneficiaryPhone == "" {
		return fmt.Errorf("UPI requires VPA, bank account+IFSC, or Aadhaar-linked mobile")
	}
	return nil
}

func (a *UPIAdapter) EstimateRailFee(amount float64, currency string) float64 {
	// UPI is designed for near-zero cost
	return 0.10
}

func (a *UPIAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Submit via NPCI UPI International API
	// Real-time settlement in INR
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("UPI validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("UPI-%s", req.TransferID[:8]),
		Status:           "completed", // UPI settles in seconds
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(30 * time.Second),
	}, nil
}

func (a *UPIAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// =============================================================================
// SEPA ADAPTER — Single Euro Payments Area
// =============================================================================

// SEPAAdapter integrates with SEPA for EUR-denominated transfers.
// Supports SEPA Credit Transfer (SCT) and SEPA Instant (SCT Inst).
// Covers all EU/EEA countries plus Switzerland, Monaco, etc.
type SEPAAdapter struct{}

func (a *SEPAAdapter) ID() string                    { return "sepa" }
func (a *SEPAAdapter) Name() string                  { return "SEPA (Europe)" }
func (a *SEPAAdapter) RailType() RailType             { return RailSEPA }
func (a *SEPAAdapter) SettlementCurrency() string     { return "EUR" }
func (a *SEPAAdapter) MessageFormat() string          { return "ISO20022/pain.001" }
func (a *SEPAAdapter) MaxSettlementTime() time.Duration { return 10 * time.Second } // SEPA Instant
func (a *SEPAAdapter) SupportsTracking() bool         { return true }
func (a *SEPAAdapter) SupportedCorridors() []string   { return []string{"NG-GB", "NG-TR"} } // EUR-accepting destinations
func (a *SEPAAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *SEPAAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *SEPAAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryAcct == "" {
		return fmt.Errorf("SEPA requires IBAN")
	}
	if len(req.BeneficiaryAcct) < 15 {
		return fmt.Errorf("SEPA IBAN must be at least 15 characters")
	}
	return nil
}

func (a *SEPAAdapter) EstimateRailFee(amount float64, currency string) float64 {
	return 1.50 // SEPA is low-cost
}

func (a *SEPAAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Submit via SEPA Instant (SCT Inst) through banking partner
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("SEPA validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("SEPA-%s", req.TransferID[:8]),
		Status:           "completed",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(10 * time.Second),
	}, nil
}

func (a *SEPAAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// =============================================================================
// MOBILE MONEY RAIL ADAPTER — MTN MoMo, M-Pesa, Airtel Money
// =============================================================================

// MobileMoneyRailAdapter integrates with mobile money networks across Africa.
// Routes to MTN MoMo (West Africa), M-Pesa (East Africa), and Airtel Money.
type MobileMoneyRailAdapter struct{}

func (a *MobileMoneyRailAdapter) ID() string                    { return "mobile_money_rail" }
func (a *MobileMoneyRailAdapter) Name() string                  { return "Mobile Money (Africa)" }
func (a *MobileMoneyRailAdapter) RailType() RailType             { return RailMobileMoney }
func (a *MobileMoneyRailAdapter) SettlementCurrency() string     { return "LOCAL" }
func (a *MobileMoneyRailAdapter) MessageFormat() string          { return "GSMA_MMAPI" }
func (a *MobileMoneyRailAdapter) MaxSettlementTime() time.Duration { return 5 * time.Minute }
func (a *MobileMoneyRailAdapter) SupportsTracking() bool         { return true }
func (a *MobileMoneyRailAdapter) SupportedCorridors() []string {
	return []string{"NG-GH", "NG-KE", "NG-CM", "NG-CI", "NG-SN", "NG-ZA"}
}
func (a *MobileMoneyRailAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *MobileMoneyRailAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *MobileMoneyRailAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryPhone == "" {
		return fmt.Errorf("mobile money requires beneficiary mobile number")
	}
	return nil
}

func (a *MobileMoneyRailAdapter) EstimateRailFee(amount float64, currency string) float64 {
	return 0.30 // Mobile money is very low cost
}

func (a *MobileMoneyRailAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("mobile money validation failed: %w", err)
	}
	// Production: Route to appropriate MNO API based on destination
	// GH/CM/CI/SN → MTN MoMo API, KE → M-Pesa API
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("MOMO-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(3 * time.Minute),
	}, nil
}

func (a *MobileMoneyRailAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// =============================================================================
// MOJALOOP RAIL ADAPTER — Interoperability Hub
// =============================================================================

// MojaloopRailAdapter integrates with the Mojaloop interoperability hub.
// Acts as the universal fallback — routes transfers through Mojaloop's
// FSPIOP API to reach any participating DFSP (Digital Financial Service Provider).
type MojaloopRailAdapter struct{}

func (a *MojaloopRailAdapter) ID() string                    { return "mojaloop_rail" }
func (a *MojaloopRailAdapter) Name() string                  { return "Mojaloop Hub" }
func (a *MojaloopRailAdapter) RailType() RailType             { return RailMojaloop }
func (a *MojaloopRailAdapter) SettlementCurrency() string     { return "LOCAL" }
func (a *MojaloopRailAdapter) MessageFormat() string          { return "FSPIOP/ISO20022" }
func (a *MojaloopRailAdapter) MaxSettlementTime() time.Duration { return 10 * time.Minute }
func (a *MojaloopRailAdapter) SupportsTracking() bool         { return true }
func (a *MojaloopRailAdapter) SupportedCorridors() []string {
	// Mojaloop can route to any corridor with a participating DFSP
	return []string{"NG-GH", "NG-KE", "NG-SN", "NG-CI", "NG-CM", "NG-ZA"}
}
func (a *MojaloopRailAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *MojaloopRailAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *MojaloopRailAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryAcct == "" && req.BeneficiaryPhone == "" {
		return fmt.Errorf("Mojaloop requires account identifier (MSISDN, account, or alias)")
	}
	return nil
}

func (a *MojaloopRailAdapter) EstimateRailFee(amount float64, currency string) float64 {
	return 0.50
}

func (a *MojaloopRailAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// Production: Mojaloop FSPIOP flow:
	// 1. POST /parties/{Type}/{ID} — Party lookup (find destination DFSP)
	// 2. POST /quotes — Request quote from destination DFSP
	// 3. POST /transfers — Execute transfer with ILP packet
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("Mojaloop validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("MOJA-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(5 * time.Minute),
	}, nil
}

func (a *MojaloopRailAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// =============================================================================
// ACH ADAPTER — US Automated Clearing House
// =============================================================================

// ACHAdapter integrates with the US ACH network for USD transfers.
// Supports same-day ACH for faster settlement.
type ACHAdapter struct{}

func (a *ACHAdapter) ID() string                    { return "ach" }
func (a *ACHAdapter) Name() string                  { return "ACH (US)" }
func (a *ACHAdapter) RailType() RailType             { return RailACH }
func (a *ACHAdapter) SettlementCurrency() string     { return "USD" }
func (a *ACHAdapter) MessageFormat() string          { return "NACHA" }
func (a *ACHAdapter) MaxSettlementTime() time.Duration { return 24 * time.Hour } // same-day ACH
func (a *ACHAdapter) SupportsTracking() bool         { return false }
func (a *ACHAdapter) SupportedCorridors() []string   { return []string{"NG-US", "NG-CA"} }
func (a *ACHAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *ACHAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *ACHAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryBank == "" {
		return fmt.Errorf("ACH requires ABA routing number")
	}
	if req.BeneficiaryAcct == "" {
		return fmt.Errorf("ACH requires bank account number")
	}
	return nil
}

func (a *ACHAdapter) EstimateRailFee(amount float64, currency string) float64 {
	return 0.25 // ACH is very cheap
}

func (a *ACHAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("ACH validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("ACH-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(24 * time.Hour),
	}, nil
}

func (a *ACHAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "processing"}, nil
}

// =============================================================================
// FASTER PAYMENTS ADAPTER — UK
// =============================================================================

// FasterPaymentsAdapter integrates with UK Faster Payments for GBP transfers.
// Near-instant settlement (typically under 2 hours, often seconds).
type FasterPaymentsAdapter struct{}

func (a *FasterPaymentsAdapter) ID() string                    { return "faster_payments" }
func (a *FasterPaymentsAdapter) Name() string                  { return "Faster Payments (UK)" }
func (a *FasterPaymentsAdapter) RailType() RailType             { return RailFasterPay }
func (a *FasterPaymentsAdapter) SettlementCurrency() string     { return "GBP" }
func (a *FasterPaymentsAdapter) MessageFormat() string          { return "ISO20022" }
func (a *FasterPaymentsAdapter) MaxSettlementTime() time.Duration { return 2 * time.Hour }
func (a *FasterPaymentsAdapter) SupportsTracking() bool         { return true }
func (a *FasterPaymentsAdapter) SupportedCorridors() []string   { return []string{"NG-GB"} }
func (a *FasterPaymentsAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *FasterPaymentsAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *FasterPaymentsAdapter) ValidateDestination(ctx context.Context, req *PayoutRequest) error {
	if req.BeneficiaryBank == "" {
		return fmt.Errorf("Faster Payments requires UK sort code")
	}
	if req.BeneficiaryAcct == "" {
		return fmt.Errorf("Faster Payments requires UK account number")
	}
	return nil
}

func (a *FasterPaymentsAdapter) EstimateRailFee(amount float64, currency string) float64 {
	return 0.50
}

func (a *FasterPaymentsAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	if err := a.ValidateDestination(ctx, req); err != nil {
		return nil, fmt.Errorf("Faster Payments validation failed: %w", err)
	}
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("FPS-%s", req.TransferID[:8]),
		Status:           "completed",
		ProviderFee:      a.EstimateRailFee(req.Amount, req.SourceCurrency),
		EstimatedArrival: time.Now().Add(15 * time.Second),
	}, nil
}

func (a *FasterPaymentsAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}
