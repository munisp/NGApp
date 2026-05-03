// Package inbound implements the Inbound Remittance module for the National Payment Switch.
// Handles receiving international transfers into Nigerian bank accounts/wallets via
// SWIFT, PAPSS, CIPS, UPI, and other payment rails. Integrates with NIP for last-mile
// delivery and CBN for compliance screening of incoming flows.
package inbound

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// TransferStatus represents the lifecycle stage of an inbound transfer.
type TransferStatus string

const (
	StatusReceived          TransferStatus = "RECEIVED"
	StatusScreening         TransferStatus = "SCREENING"
	StatusScreeningCleared  TransferStatus = "SCREENING_CLEARED"
	StatusScreeningHeld     TransferStatus = "SCREENING_HELD"
	StatusBeneficiaryLookup TransferStatus = "BENEFICIARY_LOOKUP"
	StatusFXConversion      TransferStatus = "FX_CONVERSION"
	StatusCrediting         TransferStatus = "CREDITING"
	StatusCredited          TransferStatus = "CREDITED"
	StatusFailed            TransferStatus = "FAILED"
	StatusReturned          TransferStatus = "RETURNED"
)

// InboundTransfer represents an incoming international remittance.
type InboundTransfer struct {
	ID                string         `json:"id"`
	ExternalRef       string         `json:"externalRef"`
	SourceRail        string         `json:"sourceRail"`
	SourceCountry     string         `json:"sourceCountry"`
	SourceCurrency    string         `json:"sourceCurrency"`
	DestCurrency      string         `json:"destCurrency"`
	SourceAmount      float64        `json:"sourceAmount"`
	DestAmount        float64        `json:"destAmount"`
	FXRate            float64        `json:"fxRate"`
	CBNFee            float64        `json:"cbnFee"`
	SenderName        string         `json:"senderName"`
	SenderBank        string         `json:"senderBank"`
	SenderCountry     string         `json:"senderCountry"`
	BeneficiaryName   string         `json:"beneficiaryName"`
	BeneficiaryBank   string         `json:"beneficiaryBank"`
	BeneficiaryAcct   string         `json:"beneficiaryAcct"`
	BeneficiaryBVN    string         `json:"beneficiaryBVN"`
	NIPRef            string         `json:"nipRef"`
	Status            TransferStatus `json:"status"`
	ComplianceScore   float64        `json:"complianceScore"`
	ScreeningResult   string         `json:"screeningResult"`
	ReceivedAt        time.Time      `json:"receivedAt"`
	CreditedAt        *time.Time     `json:"creditedAt,omitempty"`
	FailureReason     string         `json:"failureReason,omitempty"`
	CorridorID        string         `json:"corridorId"`
	SettlementBatchID string         `json:"settlementBatchId,omitempty"`
}

// BeneficiaryVerification holds the result of NIP account lookup.
type BeneficiaryVerification struct {
	AccountNumber string `json:"accountNumber"`
	BankCode      string `json:"bankCode"`
	AccountName   string `json:"accountName"`
	BVN           string `json:"bvn"`
	KYCStatus     string `json:"kycStatus"`
	Verified      bool   `json:"verified"`
	VerifiedAt    time.Time `json:"verifiedAt"`
}

// InboundCorridor defines configuration for a receiving corridor.
type InboundCorridor struct {
	ID                string   `json:"id"`
	SourceCountry     string   `json:"sourceCountry"`
	SourceCountryName string   `json:"sourceCountryName"`
	SourceCurrency    string   `json:"sourceCurrency"`
	Rails             []string `json:"rails"`
	ReceivingBanks    []string `json:"receivingBanks"`
	DailyVolumeUSD    float64  `json:"dailyVolumeUSD"`
	AvgSettlementMs   int64    `json:"avgSettlementMs"`
	ComplianceLevel   string   `json:"complianceLevel"`
	IsActive          bool     `json:"isActive"`
}

// ReceivingBank represents a Nigerian bank participating in inbound settlements.
type ReceivingBank struct {
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	NIPCode        string  `json:"nipCode"`
	SWIFTCode      string  `json:"swiftCode"`
	DailyCapacity  float64 `json:"dailyCapacity"`
	SettlementAcct string  `json:"settlementAcct"`
	Status         string  `json:"status"`
}

// InboundProcessor handles the end-to-end processing of inbound transfers.
type InboundProcessor struct {
	mu                sync.RWMutex
	transfers         map[string]*InboundTransfer
	corridors         []InboundCorridor
	receivingBanks    []ReceivingBank
	complianceEngine  ComplianceScreener
	nipClient         NIPClient
	fxService         FXService
	metrics           *InboundMetrics
}

// ComplianceScreener defines the interface for inbound compliance screening.
type ComplianceScreener interface {
	ScreenInbound(ctx context.Context, transfer *InboundTransfer) (score float64, result string, err error)
}

// NIPClient defines the interface for NIP (NIBSS Instant Payment) integration.
type NIPClient interface {
	VerifyAccount(ctx context.Context, bankCode, accountNumber string) (*BeneficiaryVerification, error)
	CreditAccount(ctx context.Context, bankCode, accountNumber string, amount float64, ref string) error
}

// FXService defines the interface for FX conversion.
type FXService interface {
	Convert(ctx context.Context, from, to string, amount float64) (converted float64, rate float64, err error)
}

// InboundMetricsSnapshot is a point-in-time copy of inbound metrics (no mutex).
type InboundMetricsSnapshot struct {
	TotalReceived         int64   `json:"totalReceived"`
	TotalCredited         int64   `json:"totalCredited"`
	TotalFailed           int64   `json:"totalFailed"`
	TotalReturned         int64   `json:"totalReturned"`
	TotalVolumeUSD        float64 `json:"totalVolumeUSD"`
	TotalVolumeNGN        float64 `json:"totalVolumeNGN"`
	AvgProcessingMs       int64   `json:"avgProcessingMs"`
	ComplianceHoldRate    float64 `json:"complianceHoldRate"`
	SuccessRate           float64 `json:"successRate"`
}

// InboundMetrics tracks operational metrics for inbound remittance.
type InboundMetrics struct {
	mu                    sync.RWMutex
	TotalReceived         int64   `json:"totalReceived"`
	TotalCredited         int64   `json:"totalCredited"`
	TotalFailed           int64   `json:"totalFailed"`
	TotalReturned         int64   `json:"totalReturned"`
	TotalVolumeUSD        float64 `json:"totalVolumeUSD"`
	TotalVolumeNGN        float64 `json:"totalVolumeNGN"`
	AvgProcessingMs       int64   `json:"avgProcessingMs"`
	ComplianceHoldRate    float64 `json:"complianceHoldRate"`
	SuccessRate           float64 `json:"successRate"`
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

// NewInboundProcessor creates a new processor with default configuration.
func NewInboundProcessor(screener ComplianceScreener, nip NIPClient, fx FXService) *InboundProcessor {
	return &InboundProcessor{
		transfers: make(map[string]*InboundTransfer),
		corridors: defaultCorridors(),
		receivingBanks: defaultReceivingBanks(),
		complianceEngine: screener,
		nipClient:        nip,
		fxService:        fx,
		metrics:          &InboundMetrics{},
	}
}

// ProcessInbound handles the full lifecycle of an incoming transfer:
// 1. Receive & validate  2. Compliance screening  3. Beneficiary verification (NIP)
// 4. FX conversion (CBN rate)  5. Credit to beneficiary account
func (p *InboundProcessor) ProcessInbound(ctx context.Context, transfer *InboundTransfer) error {
	transfer.ID = generateID("INB")
	transfer.Status = StatusReceived
	transfer.ReceivedAt = time.Now()

	p.mu.Lock()
	p.transfers[transfer.ID] = transfer
	p.mu.Unlock()

	p.metrics.mu.Lock()
	p.metrics.TotalReceived++
	p.metrics.TotalVolumeUSD += transfer.SourceAmount
	p.metrics.mu.Unlock()

	// Step 1: Compliance screening (sanctions, PEP, AML)
	transfer.Status = StatusScreening
	score, result, err := p.complianceEngine.ScreenInbound(ctx, transfer)
	if err != nil {
		transfer.Status = StatusFailed
		transfer.FailureReason = fmt.Sprintf("compliance screening error: %v", err)
		return err
	}
	transfer.ComplianceScore = score
	transfer.ScreeningResult = result

	if result == "HELD" || score > 80 {
		transfer.Status = StatusScreeningHeld
		p.metrics.mu.Lock()
		p.metrics.ComplianceHoldRate = float64(p.metrics.TotalFailed+1) / float64(p.metrics.TotalReceived)
		p.metrics.mu.Unlock()
		return nil // Held for manual review
	}
	transfer.Status = StatusScreeningCleared

	// Step 2: Beneficiary verification via NIP
	transfer.Status = StatusBeneficiaryLookup
	verification, err := p.nipClient.VerifyAccount(ctx, transfer.BeneficiaryBank, transfer.BeneficiaryAcct)
	if err != nil || !verification.Verified {
		transfer.Status = StatusFailed
		transfer.FailureReason = "beneficiary account verification failed"
		p.metrics.mu.Lock()
		p.metrics.TotalFailed++
		p.metrics.mu.Unlock()
		return fmt.Errorf("beneficiary verification failed: %v", err)
	}
	transfer.BeneficiaryBVN = verification.BVN

	// Step 3: FX conversion at CBN-regulated rate
	transfer.Status = StatusFXConversion
	destAmount, rate, err := p.fxService.Convert(ctx, transfer.SourceCurrency, "NGN", transfer.SourceAmount)
	if err != nil {
		transfer.Status = StatusFailed
		transfer.FailureReason = fmt.Sprintf("FX conversion error: %v", err)
		return err
	}
	transfer.DestAmount = destAmount
	transfer.FXRate = rate
	transfer.DestCurrency = "NGN"

	// Step 4: Credit beneficiary account via NIP
	transfer.Status = StatusCrediting
	transfer.NIPRef = generateID("NIP")
	err = p.nipClient.CreditAccount(ctx, transfer.BeneficiaryBank, transfer.BeneficiaryAcct, destAmount, transfer.NIPRef)
	if err != nil {
		transfer.Status = StatusFailed
		transfer.FailureReason = fmt.Sprintf("credit failed: %v", err)
		p.metrics.mu.Lock()
		p.metrics.TotalFailed++
		p.metrics.mu.Unlock()
		return err
	}

	now := time.Now()
	transfer.CreditedAt = &now
	transfer.Status = StatusCredited

	p.metrics.mu.Lock()
	p.metrics.TotalCredited++
	p.metrics.TotalVolumeNGN += destAmount
	p.metrics.SuccessRate = float64(p.metrics.TotalCredited) / float64(p.metrics.TotalReceived) * 100
	p.metrics.mu.Unlock()

	return nil
}

// ReturnTransfer processes a return/reversal of an inbound transfer.
func (p *InboundProcessor) ReturnTransfer(ctx context.Context, transferID, reason string) error {
	p.mu.Lock()
	transfer, exists := p.transfers[transferID]
	p.mu.Unlock()

	if !exists {
		return fmt.Errorf("transfer %s not found", transferID)
	}
	if transfer.Status == StatusReturned {
		return fmt.Errorf("transfer already returned")
	}

	transfer.Status = StatusReturned
	transfer.FailureReason = reason

	p.metrics.mu.Lock()
	p.metrics.TotalReturned++
	p.metrics.mu.Unlock()

	return nil
}

// GetMetrics returns a snapshot of current inbound remittance metrics.
func (p *InboundProcessor) GetMetrics() InboundMetricsSnapshot {
	p.metrics.mu.RLock()
	defer p.metrics.mu.RUnlock()
	return InboundMetricsSnapshot{
		TotalReceived:      p.metrics.TotalReceived,
		TotalCredited:      p.metrics.TotalCredited,
		TotalFailed:        p.metrics.TotalFailed,
		TotalReturned:      p.metrics.TotalReturned,
		TotalVolumeUSD:     p.metrics.TotalVolumeUSD,
		TotalVolumeNGN:     p.metrics.TotalVolumeNGN,
		AvgProcessingMs:    p.metrics.AvgProcessingMs,
		ComplianceHoldRate: p.metrics.ComplianceHoldRate,
		SuccessRate:        p.metrics.SuccessRate,
	}
}

func defaultCorridors() []InboundCorridor {
	return []InboundCorridor{
		{ID: "GB-NG", SourceCountry: "GB", SourceCountryName: "United Kingdom", SourceCurrency: "GBP", Rails: []string{"SWIFT", "FASTER_PAY"}, ReceivingBanks: []string{"ACCESS", "GTB", "ZENITH"}, DailyVolumeUSD: 2_400_000, AvgSettlementMs: 45000, ComplianceLevel: "standard", IsActive: true},
		{ID: "US-NG", SourceCountry: "US", SourceCountryName: "United States", SourceCurrency: "USD", Rails: []string{"SWIFT", "ACH"}, ReceivingBanks: []string{"ACCESS", "GTB", "ZENITH", "UBA", "FIRSTBANK"}, DailyVolumeUSD: 5_800_000, AvgSettlementMs: 120000, ComplianceLevel: "enhanced", IsActive: true},
		{ID: "CA-NG", SourceCountry: "CA", SourceCountryName: "Canada", SourceCurrency: "CAD", Rails: []string{"SWIFT"}, ReceivingBanks: []string{"GTB", "UBA"}, DailyVolumeUSD: 890_000, AvgSettlementMs: 180000, ComplianceLevel: "standard", IsActive: true},
		{ID: "GH-NG", SourceCountry: "GH", SourceCountryName: "Ghana", SourceCurrency: "GHS", Rails: []string{"PAPSS", "MOBILE_MONEY"}, ReceivingBanks: []string{"ACCESS", "ZENITH"}, DailyVolumeUSD: 450_000, AvgSettlementMs: 8000, ComplianceLevel: "standard", IsActive: true},
		{ID: "KE-NG", SourceCountry: "KE", SourceCountryName: "Kenya", SourceCurrency: "KES", Rails: []string{"PAPSS"}, ReceivingBanks: []string{"UBA", "FIRSTBANK"}, DailyVolumeUSD: 320_000, AvgSettlementMs: 12000, ComplianceLevel: "standard", IsActive: true},
		{ID: "ZA-NG", SourceCountry: "ZA", SourceCountryName: "South Africa", SourceCurrency: "ZAR", Rails: []string{"SWIFT", "PAPSS"}, ReceivingBanks: []string{"ACCESS", "GTB"}, DailyVolumeUSD: 670_000, AvgSettlementMs: 60000, ComplianceLevel: "standard", IsActive: true},
		{ID: "AE-NG", SourceCountry: "AE", SourceCountryName: "UAE", SourceCurrency: "AED", Rails: []string{"SWIFT"}, ReceivingBanks: []string{"GTB", "ZENITH", "UBA"}, DailyVolumeUSD: 1_200_000, AvgSettlementMs: 90000, ComplianceLevel: "enhanced", IsActive: true},
		{ID: "CN-NG", SourceCountry: "CN", SourceCountryName: "China", SourceCurrency: "CNY", Rails: []string{"CIPS"}, ReceivingBanks: []string{"ACCESS"}, DailyVolumeUSD: 340_000, AvgSettlementMs: 240000, ComplianceLevel: "enhanced", IsActive: true},
		{ID: "IN-NG", SourceCountry: "IN", SourceCountryName: "India", SourceCurrency: "INR", Rails: []string{"UPI"}, ReceivingBanks: []string{"FIRSTBANK"}, DailyVolumeUSD: 180_000, AvgSettlementMs: 5000, ComplianceLevel: "standard", IsActive: true},
		{ID: "DE-NG", SourceCountry: "DE", SourceCountryName: "Germany", SourceCurrency: "EUR", Rails: []string{"SEPA", "SWIFT"}, ReceivingBanks: []string{"GTB", "ZENITH"}, DailyVolumeUSD: 780_000, AvgSettlementMs: 35000, ComplianceLevel: "standard", IsActive: true},
		{ID: "FR-NG", SourceCountry: "FR", SourceCountryName: "France", SourceCurrency: "EUR", Rails: []string{"SEPA"}, ReceivingBanks: []string{"ACCESS", "UBA"}, DailyVolumeUSD: 560_000, AvgSettlementMs: 40000, ComplianceLevel: "standard", IsActive: true},
		{ID: "IT-NG", SourceCountry: "IT", SourceCountryName: "Italy", SourceCurrency: "EUR", Rails: []string{"SEPA"}, ReceivingBanks: []string{"GTB"}, DailyVolumeUSD: 420_000, AvgSettlementMs: 45000, ComplianceLevel: "standard", IsActive: true},
	}
}

func defaultReceivingBanks() []ReceivingBank {
	return []ReceivingBank{
		{Code: "ACCESS", Name: "Access Bank Plc", NIPCode: "044", SWIFTCode: "ABORNGLA", DailyCapacity: 50_000_000, SettlementAcct: "TB-RECV-ACCESS-001", Status: "active"},
		{Code: "GTB", Name: "Guaranty Trust Bank", NIPCode: "058", SWIFTCode: "GTBINGLA", DailyCapacity: 45_000_000, SettlementAcct: "TB-RECV-GTB-001", Status: "active"},
		{Code: "ZENITH", Name: "Zenith Bank Plc", NIPCode: "057", SWIFTCode: "ZELOIGLA", DailyCapacity: 48_000_000, SettlementAcct: "TB-RECV-ZENITH-001", Status: "active"},
		{Code: "UBA", Name: "United Bank for Africa", NIPCode: "033", SWIFTCode: "UNAFNGLA", DailyCapacity: 40_000_000, SettlementAcct: "TB-RECV-UBA-001", Status: "active"},
		{Code: "FIRSTBANK", Name: "First Bank of Nigeria", NIPCode: "011", SWIFTCode: "FBNINGLA", DailyCapacity: 42_000_000, SettlementAcct: "TB-RECV-FIRSTBANK-001", Status: "active"},
	}
}
