package outbound

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// =============================================================================
// MOJALOOP HUB INTEGRATION — Central interoperability switch
// =============================================================================

// MojaloopHubRouter sits between the platform and all payment rails.
// Per the architecture document §10 (Layered Architecture):
// "Mojaloop provides the standardized interoperability and routing hub model
// for cross-border payouts."
//
// All rails (SWIFT, PAPSS, CIPS, UPI, SEPA, Mobile Money, ACH, Faster Payments)
// are registered as DFSPs (Digital Financial Service Providers) in the hub,
// and the hub manages party lookup, quoting, and transfer execution.
type MojaloopHubRouter struct {
	railRegistry    *PaymentRailRegistry
	providerFramework *ProviderAdapterFramework
	dfsps           map[string]*DFSPRegistration
	transferLog     []TransferRecord
	mu              sync.RWMutex
}

// DFSPRegistration represents a rail or provider registered as a DFSP in Mojaloop
type DFSPRegistration struct {
	DFSPID          string       `json:"dfsp_id"`
	Name            string       `json:"name"`
	RailType        RailType     `json:"rail_type"`
	Corridors       []string     `json:"corridors"`
	Status          string       `json:"status"`   // "active", "inactive", "suspended"
	SettlementModel string       `json:"settlement_model"` // "deferred_net", "immediate_gross"
	PartyIDTypes    []string     `json:"party_id_types"`   // "MSISDN", "IBAN", "ACCOUNT_ID", "VPA"
	EndpointURL     string       `json:"endpoint_url"`
	SettlementAcct  string       `json:"settlement_account"`
	RegisteredAt    time.Time    `json:"registered_at"`
}

// TransferRecord tracks all transfers through the hub for audit
type TransferRecord struct {
	TransferID      string    `json:"transfer_id"`
	CorridorID      string    `json:"corridor_id"`
	SourceDFSP      string    `json:"source_dfsp"`
	DestDFSP        string    `json:"dest_dfsp"`
	RailUsed        RailType  `json:"rail_used"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Status          string    `json:"status"`
	RailFee         float64   `json:"rail_fee"`
	SwitchFee       float64   `json:"switch_fee"`
	InitiatedAt     time.Time `json:"initiated_at"`
	CompletedAt     time.Time `json:"completed_at,omitempty"`
	SettlementTime  string    `json:"settlement_time"`
	ProviderRef     string    `json:"provider_ref"`
}

// PartyLookupResult from Mojaloop party resolution
type PartyLookupResult struct {
	PartyIDType    string `json:"party_id_type"`
	PartyID        string `json:"party_id"`
	DFSPID         string `json:"dfsp_id"`
	Name           string `json:"name"`
	AccountType    string `json:"account_type"`
	Currency       string `json:"currency"`
}

// QuoteResult from Mojaloop quoting service
type QuoteResult struct {
	QuoteID         string    `json:"quote_id"`
	TransferAmount  float64   `json:"transfer_amount"`
	PayeeFee        float64   `json:"payee_fee"`
	PayerFee        float64   `json:"payer_fee"`
	RailFee         float64   `json:"rail_fee"`
	ExchangeRate    float64   `json:"exchange_rate"`
	ExpiresAt       time.Time `json:"expires_at"`
	DestDFSP        string    `json:"dest_dfsp"`
	RailType        RailType  `json:"rail_type"`
	Condition       string    `json:"condition"`      // ILP condition
	ILPPacket       string    `json:"ilp_packet"`
}

// NewMojaloopHubRouter creates the hub with all registered DFSPs
func NewMojaloopHubRouter(railRegistry *PaymentRailRegistry) *MojaloopHubRouter {
	hub := &MojaloopHubRouter{
		railRegistry:    railRegistry,
		providerFramework: NewProviderAdapterFramework(),
		dfsps:           make(map[string]*DFSPRegistration),
		transferLog:     make([]TransferRecord, 0),
	}

	// Register all payment rails as DFSPs in the Mojaloop hub
	hub.registerRailDFSPs()

	return hub
}

// registerRailDFSPs registers each payment rail as a DFSP
func (h *MojaloopHubRouter) registerRailDFSPs() {
	railDFSPs := []DFSPRegistration{
		{
			DFSPID: "dfsp-swift", Name: "SWIFT gpi Network", RailType: RailSWIFT,
			Corridors: []string{"NG-GB", "NG-US", "NG-CA", "NG-AE", "NG-TR", "NG-CN", "NG-ZA"},
			Status: "active", SettlementModel: "deferred_net",
			PartyIDTypes: []string{"IBAN", "ACCOUNT_ID"},
			EndpointURL: "https://swift-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "SWIFT_NOSTRO_USD",
		},
		{
			DFSPID: "dfsp-papss", Name: "PAPSS (Pan-African)", RailType: RailPAPSS,
			Corridors: []string{"NG-GH", "NG-KE", "NG-ZA", "NG-SN", "NG-CI", "NG-CM"},
			Status: "active", SettlementModel: "immediate_gross",
			PartyIDTypes: []string{"MSISDN", "ACCOUNT_ID", "IBAN"},
			EndpointURL: "https://papss-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "PAPSS_CLEARING",
		},
		{
			DFSPID: "dfsp-cips", Name: "CIPS (China)", RailType: RailCIPS,
			Corridors: []string{"NG-CN"},
			Status: "active", SettlementModel: "deferred_net",
			PartyIDTypes: []string{"ACCOUNT_ID"},
			EndpointURL: "https://cips-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "CIPS_NOSTRO_CNY",
		},
		{
			DFSPID: "dfsp-upi", Name: "UPI International (India)", RailType: RailUPI,
			Corridors: []string{"NG-IN"},
			Status: "active", SettlementModel: "immediate_gross",
			PartyIDTypes: []string{"MSISDN", "ACCOUNT_ID", "VPA"},
			EndpointURL: "https://upi-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "UPI_CLEARING_INR",
		},
		{
			DFSPID: "dfsp-sepa", Name: "SEPA (Europe)", RailType: RailSEPA,
			Corridors: []string{"NG-GB", "NG-TR"},
			Status: "active", SettlementModel: "immediate_gross",
			PartyIDTypes: []string{"IBAN"},
			EndpointURL: "https://sepa-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "SEPA_CLEARING_EUR",
		},
		{
			DFSPID: "dfsp-mobile-money", Name: "Mobile Money (Africa)", RailType: RailMobileMoney,
			Corridors: []string{"NG-GH", "NG-KE", "NG-CM", "NG-CI", "NG-SN", "NG-ZA"},
			Status: "active", SettlementModel: "immediate_gross",
			PartyIDTypes: []string{"MSISDN"},
			EndpointURL: "https://momo-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "MOMO_CLEARING",
		},
		{
			DFSPID: "dfsp-ach", Name: "ACH (US)", RailType: RailACH,
			Corridors: []string{"NG-US", "NG-CA"},
			Status: "active", SettlementModel: "deferred_net",
			PartyIDTypes: []string{"ACCOUNT_ID"},
			EndpointURL: "https://ach-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "ACH_CLEARING_USD",
		},
		{
			DFSPID: "dfsp-faster-payments", Name: "Faster Payments (UK)", RailType: RailFasterPay,
			Corridors: []string{"NG-GB"},
			Status: "active", SettlementModel: "immediate_gross",
			PartyIDTypes: []string{"ACCOUNT_ID"},
			EndpointURL: "https://fps-adapter.remit-switch.internal/fspiop",
			SettlementAcct: "FPS_CLEARING_GBP",
		},
	}

	for i := range railDFSPs {
		railDFSPs[i].RegisteredAt = time.Now()
		h.dfsps[railDFSPs[i].DFSPID] = &railDFSPs[i]
	}
}

// PartyLookup resolves a beneficiary to a DFSP using Mojaloop's party lookup service.
// Per architecture §14 Step E: "Routing engine selects payout rail or partner based on
// corridor, currency, SLA, cost, sanctions posture, and partner health."
func (h *MojaloopHubRouter) PartyLookup(ctx context.Context, corridorID string, partyIDType string, partyID string) (*PartyLookupResult, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Find DFSPs that serve this corridor
	for _, dfsp := range h.dfsps {
		if dfsp.Status != "active" {
			continue
		}
		for _, c := range dfsp.Corridors {
			if c == corridorID {
				for _, idType := range dfsp.PartyIDTypes {
					if idType == partyIDType {
						return &PartyLookupResult{
							PartyIDType: partyIDType,
							PartyID:     partyID,
							DFSPID:      dfsp.DFSPID,
							Name:        dfsp.Name,
							AccountType: "CHECKING",
							Currency:    corridorToCurrency(corridorID),
						}, nil
					}
				}
			}
		}
	}

	return nil, fmt.Errorf("no DFSP found for corridor %s with party type %s", corridorID, partyIDType)
}

// GetQuote requests a quote from the destination DFSP via Mojaloop's quoting service.
// Includes rail-aware fee calculation per document Appendix A.1.
func (h *MojaloopHubRouter) GetQuote(ctx context.Context, corridorID string, amount float64, currency string) (*QuoteResult, error) {
	// Get the rail routing config
	routing, err := h.railRegistry.GetCorridorRouting(corridorID)
	if err != nil {
		return nil, fmt.Errorf("routing config not found: %w", err)
	}

	// Get the rail adapter for fee estimation
	rail, railType, err := h.railRegistry.SelectRailWithFallback(corridorID)
	if err != nil {
		return nil, fmt.Errorf("no available rail: %w", err)
	}

	railFee := rail.EstimateRailFee(amount, currency)
	corridorFee := amount*routing.RailFeeRate + routing.RailFixedFee

	// Find the DFSP for this rail
	dfspID := ""
	for _, dfsp := range h.dfsps {
		if dfsp.RailType == railType {
			dfspID = dfsp.DFSPID
			break
		}
	}

	return &QuoteResult{
		QuoteID:        fmt.Sprintf("QTE-%s-%d", corridorID, time.Now().UnixNano()),
		TransferAmount: amount,
		PayeeFee:       0,
		PayerFee:       corridorFee,
		RailFee:        railFee,
		ExchangeRate:   1.0, // FX applied separately by Pricing/FX service
		ExpiresAt:      time.Now().Add(30 * time.Second),
		DestDFSP:       dfspID,
		RailType:       railType,
		Condition:      fmt.Sprintf("ILP-%s", corridorID),
		ILPPacket:      "base64-encoded-ilp-packet",
	}, nil
}

// ExecuteTransfer executes a transfer through the selected rail via Mojaloop.
// Per architecture §14: A→G lifecycle step E (Routing and Execution).
func (h *MojaloopHubRouter) ExecuteTransfer(ctx context.Context, req *PayoutRequest, corridorID string) (*PayoutResponse, *TransferRecord, error) {
	// 1. Select the best available rail with fallback
	rail, railType, err := h.railRegistry.SelectRailWithFallback(corridorID)
	if err != nil {
		return nil, nil, fmt.Errorf("rail selection failed: %w", err)
	}

	// 2. Validate destination for the selected rail
	if err := rail.ValidateDestination(ctx, req); err != nil {
		return nil, nil, fmt.Errorf("destination validation failed for %s: %w", railType, err)
	}

	// 3. Calculate fees
	corridorFee, _, err := h.railRegistry.CalculateCorridorFee(corridorID, req.Amount)
	if err != nil {
		return nil, nil, fmt.Errorf("fee calculation failed: %w", err)
	}

	// 4. Execute through the rail
	resp, err := rail.Execute(ctx, req)
	if err != nil {
		return nil, nil, fmt.Errorf("rail execution failed on %s: %w", railType, err)
	}

	// 5. Create transfer record for audit
	record := &TransferRecord{
		TransferID:     req.TransferID,
		CorridorID:     corridorID,
		SourceDFSP:     "dfsp-ng-switch", // this platform
		DestDFSP:       fmt.Sprintf("dfsp-%s", railType),
		RailUsed:       railType,
		Amount:         req.Amount,
		Currency:       req.DestCurrency,
		Status:         resp.Status,
		RailFee:        resp.ProviderFee,
		SwitchFee:      corridorFee,
		InitiatedAt:    time.Now(),
		SettlementTime: rail.MaxSettlementTime().String(),
		ProviderRef:    resp.ProviderRef,
	}

	h.mu.Lock()
	h.transferLog = append(h.transferLog, *record)
	h.mu.Unlock()

	return resp, record, nil
}

// GetTransferLog returns all transfer records for audit
func (h *MojaloopHubRouter) GetTransferLog() []TransferRecord {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]TransferRecord, len(h.transferLog))
	copy(result, h.transferLog)
	return result
}

// GetRegisteredDFSPs returns all DFSPs registered in the hub
func (h *MojaloopHubRouter) GetRegisteredDFSPs() []DFSPRegistration {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]DFSPRegistration, 0, len(h.dfsps))
	for _, dfsp := range h.dfsps {
		result = append(result, *dfsp)
	}
	return result
}

// GetDFSPsByRailType returns DFSPs filtered by rail type
func (h *MojaloopHubRouter) GetDFSPsByRailType(railType RailType) []DFSPRegistration {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var result []DFSPRegistration
	for _, dfsp := range h.dfsps {
		if dfsp.RailType == railType {
			result = append(result, *dfsp)
		}
	}
	return result
}

// GetRailsForCorridor returns all available rails for a corridor
func (h *MojaloopHubRouter) GetRailsForCorridor(corridorID string) []DFSPRegistration {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var result []DFSPRegistration
	for _, dfsp := range h.dfsps {
		for _, c := range dfsp.Corridors {
			if c == corridorID {
				result = append(result, *dfsp)
				break
			}
		}
	}
	return result
}

// corridorToCurrency maps corridor to destination currency
func corridorToCurrency(corridorID string) string {
	currencies := map[string]string{
		"NG-GH": "GHS", "NG-GB": "GBP", "NG-US": "USD", "NG-CA": "CAD",
		"NG-IN": "INR", "NG-CN": "CNY", "NG-AE": "AED", "NG-KE": "KES",
		"NG-ZA": "ZAR", "NG-SN": "XOF", "NG-CI": "XOF", "NG-CM": "XAF",
		"NG-TR": "TRY",
	}
	if c, ok := currencies[corridorID]; ok {
		return c
	}
	return "USD"
}
