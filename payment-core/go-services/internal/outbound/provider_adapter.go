package outbound

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ProviderAdapterFramework manages external payout rail integrations.
// Each provider has its own adapter that translates the internal transfer model
// to the provider's specific API format.
type ProviderAdapterFramework struct {
	adapters map[string]ProviderAdapter
	mu       sync.RWMutex
}

// ProviderAdapter is the interface all payout providers must implement
type ProviderAdapter interface {
	ID() string
	Name() string
	SupportedCorridors() []string
	Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error)
	QueryStatus(ctx context.Context, providerRef string) (*PayoutStatus, error)
	Cancel(ctx context.Context, providerRef string) error
	HealthCheck(ctx context.Context) error
}

// PayoutRequest is the normalized internal request sent to providers
type PayoutRequest struct {
	TransferID       string            `json:"transfer_id"`
	CorridorID       string            `json:"corridor_id"`
	Amount           float64           `json:"amount"`
	SourceCurrency   string            `json:"source_currency"`
	DestCurrency     string            `json:"dest_currency"`
	ExchangeRate     float64           `json:"exchange_rate"`
	SenderName       string            `json:"sender_name"`
	SenderKYCHash    string            `json:"sender_kyc_hash"`
	BeneficiaryName  string            `json:"beneficiary_name"`
	BeneficiaryBank  string            `json:"beneficiary_bank"`
	BeneficiaryAcct  string            `json:"beneficiary_account"`
	BeneficiaryPhone string            `json:"beneficiary_phone,omitempty"`
	PayoutType       string            `json:"payout_type"` // bank_account, mobile_wallet, cash_pickup
	Purpose          string            `json:"purpose"`
	Reference        string            `json:"reference"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	IdempotencyKey   string            `json:"idempotency_key"`
}

// PayoutResponse is the normalized response from providers
type PayoutResponse struct {
	ProviderRef     string    `json:"provider_ref"`
	Status          string    `json:"status"` // "accepted", "processing", "completed", "failed"
	ProviderFee     float64   `json:"provider_fee"`
	EstimatedArrival time.Time `json:"estimated_arrival"`
	RawResponse     string    `json:"raw_response,omitempty"`
}

// PayoutStatus represents the current state of a payout at the provider
type PayoutStatus struct {
	ProviderRef  string    `json:"provider_ref"`
	Status       string    `json:"status"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
	FailureCode  string    `json:"failure_code,omitempty"`
	FailureMsg   string    `json:"failure_msg,omitempty"`
}

// NewProviderAdapterFramework creates the framework with all registered adapters
func NewProviderAdapterFramework() *ProviderAdapterFramework {
	f := &ProviderAdapterFramework{
		adapters: make(map[string]ProviderAdapter),
	}
	// Register all adapters
	f.Register(&FlutterwaveAdapter{})
	f.Register(&WorldRemitAdapter{})
	f.Register(&ChipperCashAdapter{})
	f.Register(&WiseAdapter{})
	f.Register(&MTNMoMoAdapter{})
	f.Register(&MojaloopAdapter{})
	f.Register(&LemFiAdapter{})
	return f
}

// Register adds a new provider adapter
func (f *ProviderAdapterFramework) Register(adapter ProviderAdapter) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.adapters[adapter.ID()] = adapter
}

// Execute sends a payout request to the specified provider
func (f *ProviderAdapterFramework) Execute(ctx context.Context, providerID string, req *PayoutRequest) (*PayoutResponse, error) {
	f.mu.RLock()
	adapter, ok := f.adapters[providerID]
	f.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("provider adapter not found: %s", providerID)
	}
	return adapter.Execute(ctx, req)
}

// QueryStatus checks the status of a payout at the provider
func (f *ProviderAdapterFramework) QueryStatus(ctx context.Context, providerID string, providerRef string) (*PayoutStatus, error) {
	f.mu.RLock()
	adapter, ok := f.adapters[providerID]
	f.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("provider adapter not found: %s", providerID)
	}
	return adapter.QueryStatus(ctx, providerRef)
}

// GetAdapters returns all registered adapters
func (f *ProviderAdapterFramework) GetAdapters() []ProviderAdapter {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]ProviderAdapter, 0, len(f.adapters))
	for _, a := range f.adapters {
		result = append(result, a)
	}
	return result
}

// --- Concrete Provider Adapters ---

// FlutterwaveAdapter integrates with Flutterwave's payout API
type FlutterwaveAdapter struct{}

func (a *FlutterwaveAdapter) ID() string                    { return "flutterwave" }
func (a *FlutterwaveAdapter) Name() string                  { return "Flutterwave" }
func (a *FlutterwaveAdapter) SupportedCorridors() []string  { return []string{"NG-GH", "NG-KE", "NG-ZA", "NG-GB", "NG-US"} }
func (a *FlutterwaveAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *FlutterwaveAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *FlutterwaveAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	// In production: POST https://api.flutterwave.com/v3/transfers
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("FLW-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      1.80,
		EstimatedArrival: time.Now().Add(30 * time.Minute),
	}, nil
}

func (a *FlutterwaveAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// WorldRemitAdapter integrates with WorldRemit's partner API
type WorldRemitAdapter struct{}

func (a *WorldRemitAdapter) ID() string                    { return "worldremit" }
func (a *WorldRemitAdapter) Name() string                  { return "WorldRemit" }
func (a *WorldRemitAdapter) SupportedCorridors() []string  { return []string{"NG-GH", "NG-GB", "NG-US", "NG-CA", "NG-IN"} }
func (a *WorldRemitAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *WorldRemitAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *WorldRemitAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("WR-%s", req.TransferID[:8]),
		Status:           "accepted",
		ProviderFee:      2.50,
		EstimatedArrival: time.Now().Add(2 * time.Hour),
	}, nil
}

func (a *WorldRemitAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// ChipperCashAdapter integrates with Chipper Cash for mobile money
type ChipperCashAdapter struct{}

func (a *ChipperCashAdapter) ID() string                    { return "chipper" }
func (a *ChipperCashAdapter) Name() string                  { return "Chipper Cash" }
func (a *ChipperCashAdapter) SupportedCorridors() []string  { return []string{"NG-GH", "NG-KE", "NG-ZA", "NG-SN"} }
func (a *ChipperCashAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *ChipperCashAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *ChipperCashAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("CHP-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      1.20,
		EstimatedArrival: time.Now().Add(15 * time.Minute),
	}, nil
}

func (a *ChipperCashAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// WiseAdapter integrates with Wise (TransferWise) API
type WiseAdapter struct{}

func (a *WiseAdapter) ID() string                    { return "wise" }
func (a *WiseAdapter) Name() string                  { return "Wise" }
func (a *WiseAdapter) SupportedCorridors() []string  { return []string{"NG-GB", "NG-US", "NG-CA", "NG-AE", "NG-CN"} }
func (a *WiseAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *WiseAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *WiseAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("WISE-%s", req.TransferID[:8]),
		Status:           "accepted",
		ProviderFee:      4.00,
		EstimatedArrival: time.Now().Add(4 * time.Hour),
	}, nil
}

func (a *WiseAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// MTNMoMoAdapter integrates with MTN Mobile Money
type MTNMoMoAdapter struct{}

func (a *MTNMoMoAdapter) ID() string                    { return "mtn_momo" }
func (a *MTNMoMoAdapter) Name() string                  { return "MTN MoMo" }
func (a *MTNMoMoAdapter) SupportedCorridors() []string  { return []string{"NG-GH", "NG-CM", "NG-CI", "NG-SN"} }
func (a *MTNMoMoAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *MTNMoMoAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *MTNMoMoAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("MOMO-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      0.80,
		EstimatedArrival: time.Now().Add(5 * time.Minute),
	}, nil
}

func (a *MTNMoMoAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// MojaloopAdapter integrates via Mojaloop interoperability hub
type MojaloopAdapter struct{}

func (a *MojaloopAdapter) ID() string                    { return "mojaloop_hub" }
func (a *MojaloopAdapter) Name() string                  { return "Mojaloop Hub" }
func (a *MojaloopAdapter) SupportedCorridors() []string  { return []string{"NG-GH", "NG-KE", "NG-SN", "NG-CI", "NG-CM", "NG-ZA"} }
func (a *MojaloopAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *MojaloopAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *MojaloopAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("MOJA-%s", req.TransferID[:8]),
		Status:           "processing",
		ProviderFee:      0.50,
		EstimatedArrival: time.Now().Add(10 * time.Minute),
	}, nil
}

func (a *MojaloopAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}

// LemFiAdapter integrates with LemFi for diaspora transfers
type LemFiAdapter struct{}

func (a *LemFiAdapter) ID() string                    { return "lemfi" }
func (a *LemFiAdapter) Name() string                  { return "LemFi" }
func (a *LemFiAdapter) SupportedCorridors() []string  { return []string{"NG-GB", "NG-CA", "NG-US"} }
func (a *LemFiAdapter) HealthCheck(ctx context.Context) error { return nil }
func (a *LemFiAdapter) Cancel(ctx context.Context, ref string) error { return nil }

func (a *LemFiAdapter) Execute(ctx context.Context, req *PayoutRequest) (*PayoutResponse, error) {
	return &PayoutResponse{
		ProviderRef:      fmt.Sprintf("LEM-%s", req.TransferID[:8]),
		Status:           "accepted",
		ProviderFee:      3.00,
		EstimatedArrival: time.Now().Add(3 * time.Hour),
	}, nil
}

func (a *LemFiAdapter) QueryStatus(ctx context.Context, ref string) (*PayoutStatus, error) {
	return &PayoutStatus{ProviderRef: ref, Status: "completed", CompletedAt: time.Now()}, nil
}
