// Package domestic — NIBSS Gap Implementation
// Implements missing NIBSS features: NEFT batch transfers, NACS cheque clearing,
// NDD direct debit mandates, GSI loan recovery, transaction reversals, disputes,
// PayDirect corporate collections.
package domestic

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// ======================== NEFT (Nigeria Electronic Fund Transfer) ========================

// NEFTBatchStatus tracks the state of an NEFT batch.
type NEFTBatchStatus string

const (
	NEFTStatusPendingSettlement NEFTBatchStatus = "PENDING_SETTLEMENT"
	NEFTStatusSettled           NEFTBatchStatus = "SETTLED"
	NEFTStatusFailed            NEFTBatchStatus = "FAILED"
	NEFTStatusProcessing        NEFTBatchStatus = "PROCESSING"
)

// NEFTBatch represents a batch of electronic fund transfers settled via NEFT clearing.
type NEFTBatch struct {
	ID              string          `json:"id"`
	BatchRef        string          `json:"batchRef"`
	SenderBank      string          `json:"senderBank"`
	SenderBankCode  string          `json:"senderBankCode"`
	TotalItems      int             `json:"totalItems"`
	TotalAmount     float64         `json:"totalAmount"`
	SettledAmount   float64         `json:"settledAmount"`
	Status          NEFTBatchStatus `json:"status"`
	ClearingSession string          `json:"clearingSession"` // e.g. "MORNING", "AFTERNOON", "EVENING"
	SubmittedAt     time.Time       `json:"submittedAt"`
	SettledAt       *time.Time      `json:"settledAt,omitempty"`
	Items           []NEFTItem      `json:"items"`
}

// NEFTItem represents a single transfer within a NEFT batch.
type NEFTItem struct {
	ID             string  `json:"id"`
	SenderAcct     string  `json:"senderAcct"`
	SenderName     string  `json:"senderName"`
	ReceiverAcct   string  `json:"receiverAcct"`
	ReceiverBank   string  `json:"receiverBank"`
	ReceiverName   string  `json:"receiverName"`
	Amount         float64 `json:"amount"`
	Status         string  `json:"status"`
	ResponseCode   string  `json:"responseCode"`
	Narration      string  `json:"narration"`
}

// NEFTService handles NEFT batch processing.
type NEFTService struct {
	mu      sync.RWMutex
	batches []NEFTBatch
}

// NewNEFTService creates a new NEFT service with seed data.
func NewNEFTService() *NEFTService {
	settledAt := time.Date(2026, 5, 1, 15, 0, 0, 0, time.UTC)
	return &NEFTService{
		batches: []NEFTBatch{
			{
				ID: "NEFT-001", BatchRef: "NEFT/2026/05/001", SenderBank: "Access Bank", SenderBankCode: "044",
				TotalItems: 150, TotalAmount: 25_000_000, SettledAmount: 25_000_000,
				Status: NEFTStatusSettled, ClearingSession: "MORNING",
				SubmittedAt: time.Date(2026, 5, 1, 8, 0, 0, 0, time.UTC), SettledAt: &settledAt,
			},
			{
				ID: "NEFT-002", BatchRef: "NEFT/2026/05/002", SenderBank: "GTBank", SenderBankCode: "058",
				TotalItems: 85, TotalAmount: 12_500_000, SettledAmount: 0,
				Status: NEFTStatusPendingSettlement, ClearingSession: "AFTERNOON",
				SubmittedAt: time.Date(2026, 5, 2, 12, 0, 0, 0, time.UTC),
			},
			{
				ID: "NEFT-003", BatchRef: "NEFT/2026/05/003", SenderBank: "Zenith Bank", SenderBankCode: "057",
				TotalItems: 320, TotalAmount: 48_000_000, SettledAmount: 48_000_000,
				Status: NEFTStatusSettled, ClearingSession: "EVENING",
				SubmittedAt: time.Date(2026, 4, 30, 16, 0, 0, 0, time.UTC), SettledAt: &settledAt,
			},
			{
				ID: "NEFT-004", BatchRef: "NEFT/2026/05/004", SenderBank: "UBA", SenderBankCode: "033",
				TotalItems: 45, TotalAmount: 8_750_000, SettledAmount: 0,
				Status: NEFTStatusProcessing, ClearingSession: "MORNING",
				SubmittedAt: time.Date(2026, 5, 2, 9, 0, 0, 0, time.UTC),
			},
		},
	}
}

// ListBatches returns all NEFT batches.
func (s *NEFTService) ListBatches(ctx context.Context) []NEFTBatch {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.batches
}

// SubmitBatch creates a new NEFT batch.
func (s *NEFTService) SubmitBatch(ctx context.Context, senderBank, senderBankCode string, items []NEFTItem) (*NEFTBatch, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	total := 0.0
	for _, item := range items {
		total += item.Amount
	}

	batch := NEFTBatch{
		ID:              fmt.Sprintf("NEFT-%s", generateID()),
		BatchRef:        fmt.Sprintf("NEFT/2026/05/%03d", len(s.batches)+1),
		SenderBank:      senderBank,
		SenderBankCode:  senderBankCode,
		TotalItems:      len(items),
		TotalAmount:     total,
		Status:          NEFTStatusPendingSettlement,
		ClearingSession: determineClearingSession(time.Now()),
		SubmittedAt:     time.Now(),
		Items:           items,
	}
	s.batches = append(s.batches, batch)
	return &batch, nil
}

func determineClearingSession(t time.Time) string {
	hour := t.Hour()
	switch {
	case hour < 12:
		return "MORNING"
	case hour < 16:
		return "AFTERNOON"
	default:
		return "EVENING"
	}
}

// ======================== NACS (Cheque Clearing) ========================

// ChequeStatus tracks the state of a cheque in the clearing system.
type ChequeStatus string

const (
	ChequeStatusPendingClearing ChequeStatus = "PENDING_CLEARING"
	ChequeStatusCleared         ChequeStatus = "CLEARED"
	ChequeStatusReturned        ChequeStatus = "RETURNED"
	ChequeStatusStopped         ChequeStatus = "STOPPED"
)

// Cheque represents a cheque instrument in the NACS system.
type Cheque struct {
	ID              string       `json:"id"`
	ChequeNumber    string       `json:"chequeNumber"`
	SortCode        string       `json:"sortCode"`
	DrawerAcct      string       `json:"drawerAcct"`
	DrawerBank      string       `json:"drawerBank"`
	DrawerName      string       `json:"drawerName"`
	PayeeName       string       `json:"payeeName"`
	PayeeAcct       string       `json:"payeeAcct"`
	PayeeBank       string       `json:"payeeBank"`
	Amount          float64      `json:"amount"`
	Status          ChequeStatus `json:"status"`
	PresentedAt     time.Time    `json:"presentedAt"`
	ClearedAt       *time.Time   `json:"clearedAt,omitempty"`
	ReturnReason    string       `json:"returnReason,omitempty"`
	ImageFront      string       `json:"imageFront"`
	ImageBack       string       `json:"imageBack"`
	MICRLine        string       `json:"micrLine"`
}

// NACSService handles cheque clearing via the NACS system.
type NACSService struct {
	mu      sync.RWMutex
	cheques []Cheque
}

// NewNACSService creates a new NACS service with seed data.
func NewNACSService() *NACSService {
	clearedAt := time.Date(2026, 5, 1, 16, 0, 0, 0, time.UTC)
	return &NACSService{
		cheques: []Cheque{
			{
				ID: "CHQ-001", ChequeNumber: "000045678", SortCode: "044150023",
				DrawerAcct: "0044100001", DrawerBank: "Access Bank", DrawerName: "Dangote Industries Ltd",
				PayeeName: "Julius Berger Nigeria", PayeeAcct: "0058200010", PayeeBank: "GTBank",
				Amount: 85_000_000, Status: ChequeStatusCleared,
				PresentedAt: time.Date(2026, 4, 30, 9, 0, 0, 0, time.UTC), ClearedAt: &clearedAt,
				MICRLine: "000045678 044150023 0044100001",
			},
			{
				ID: "CHQ-002", ChequeNumber: "000089012", SortCode: "057140018",
				DrawerAcct: "0057300003", DrawerBank: "Zenith Bank", DrawerName: "MTN Nigeria Communications",
				PayeeName: "Federal Inland Revenue Service", PayeeAcct: "TSA-FIRS-001", PayeeBank: "CBN",
				Amount: 250_000_000, Status: ChequeStatusPendingClearing,
				PresentedAt: time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC),
				MICRLine: "000089012 057140018 0057300003",
			},
			{
				ID: "CHQ-003", ChequeNumber: "000034567", SortCode: "033120015",
				DrawerAcct: "0033400004", DrawerBank: "UBA", DrawerName: "Flour Mills Nigeria",
				PayeeName: "Nigerian Ports Authority", PayeeAcct: "NPA-REV-001", PayeeBank: "First Bank",
				Amount: 45_000_000, Status: ChequeStatusReturned,
				PresentedAt: time.Date(2026, 4, 29, 11, 0, 0, 0, time.UTC),
				ReturnReason: "INSUFFICIENT_FUNDS",
				MICRLine: "000034567 033120015 0033400004",
			},
			{
				ID: "CHQ-004", ChequeNumber: "000078901", SortCode: "011100012",
				DrawerAcct: "0011500005", DrawerBank: "First Bank", DrawerName: "Shell Petroleum Dev Co",
				PayeeName: "Lagos State Government", PayeeAcct: "LASG-IGR-001", PayeeBank: "Zenith Bank",
				Amount: 1_200_000_000, Status: ChequeStatusCleared,
				PresentedAt: time.Date(2026, 4, 28, 9, 30, 0, 0, time.UTC), ClearedAt: &clearedAt,
				MICRLine: "000078901 011100012 0011500005",
			},
		},
	}
}

// ListCheques returns all cheques.
func (s *NACSService) ListCheques(ctx context.Context) []Cheque {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cheques
}

// ======================== NDD (Direct Debit Mandates) ========================

// MandateType categorizes direct debit mandates.
type MandateType string

const (
	MandateTypeFixed    MandateType = "FIXED"
	MandateTypeVariable MandateType = "VARIABLE"
	MandateTypeGSI      MandateType = "GSI" // Global Standing Instruction
)

// MandateStatus tracks the state of a mandate.
type MandateStatus string

const (
	MandateStatusActive    MandateStatus = "ACTIVE"
	MandateStatusSuspended MandateStatus = "SUSPENDED"
	MandateStatusExpired   MandateStatus = "EXPIRED"
	MandateStatusRevoked   MandateStatus = "REVOKED"
)

// DirectDebitMandate represents an NDD mandate.
type DirectDebitMandate struct {
	ID              string        `json:"id"`
	MandateRef      string        `json:"mandateRef"`
	MandateType     MandateType   `json:"mandateType"`
	SubscriberName  string        `json:"subscriberName"`
	SubscriberAcct  string        `json:"subscriberAcct"`
	SubscriberBank  string        `json:"subscriberBank"`
	SubscriberBVN   string        `json:"subscriberBvn"`
	BillerName      string        `json:"billerName"`
	BillerCode      string        `json:"billerCode"`
	Amount          float64       `json:"amount"`
	Frequency       string        `json:"frequency"`
	StartDate       time.Time     `json:"startDate"`
	EndDate         time.Time     `json:"endDate"`
	Status          MandateStatus `json:"status"`
	NextDebitDate   time.Time     `json:"nextDebitDate"`
	ExecutionCount  int           `json:"executionCount"`
	TotalDebited    float64       `json:"totalDebited"`
	CreatedAt       time.Time     `json:"createdAt"`
	AggregatorName  string        `json:"aggregatorName,omitempty"`
}

// NDDService handles direct debit mandates.
type NDDService struct {
	mu       sync.RWMutex
	mandates []DirectDebitMandate
}

// NewNDDService creates a new NDD service with seed data.
func NewNDDService() *NDDService {
	return &NDDService{
		mandates: []DirectDebitMandate{
			{
				ID: "MND-001", MandateRef: "NDD/2026/ACC/001", MandateType: MandateTypeFixed,
				SubscriberName: "Adebayo Ogunlade", SubscriberAcct: "0044100001", SubscriberBank: "Access Bank",
				SubscriberBVN: "22345678901", BillerName: "Leadway Pensure PFA", BillerCode: "PENSION-LW",
				Amount: 50000, Frequency: "MONTHLY", Status: MandateStatusActive,
				StartDate: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				EndDate: time.Date(2030, 12, 31, 0, 0, 0, 0, time.UTC),
				NextDebitDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
				ExecutionCount: 17, TotalDebited: 850_000,
				CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), AggregatorName: "Paystack",
			},
			{
				ID: "MND-002", MandateRef: "NDD/2026/GTB/002", MandateType: MandateTypeVariable,
				SubscriberName: "Chioma Okafor", SubscriberAcct: "0058200002", SubscriberBank: "GTBank",
				SubscriberBVN: "22345678902", BillerName: "AXA Mansard Insurance", BillerCode: "INS-AXA",
				Amount: 125000, Frequency: "QUARTERLY", Status: MandateStatusActive,
				StartDate: time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
				EndDate: time.Date(2028, 5, 31, 0, 0, 0, 0, time.UTC),
				NextDebitDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
				ExecutionCount: 4, TotalDebited: 500_000,
				CreatedAt: time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC), AggregatorName: "Mono",
			},
			{
				ID: "MND-003", MandateRef: "NDD/2026/UBA/003", MandateType: MandateTypeGSI,
				SubscriberName: "Emeka Nwosu", SubscriberAcct: "0033400004", SubscriberBank: "UBA",
				SubscriberBVN: "12345678901", BillerName: "Access Bank Loan Recovery", BillerCode: "LOAN-ACC",
				Amount: 250000, Frequency: "MONTHLY", Status: MandateStatusActive,
				StartDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
				EndDate: time.Date(2027, 12, 31, 0, 0, 0, 0, time.UTC),
				NextDebitDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
				ExecutionCount: 5, TotalDebited: 1_250_000,
				CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "MND-004", MandateRef: "NDD/2025/ZEN/004", MandateType: MandateTypeFixed,
				SubscriberName: "Fatima Bello", SubscriberAcct: "0057300006", SubscriberBank: "Zenith Bank",
				SubscriberBVN: "33456789012", BillerName: "DSTV (MultiChoice)", BillerCode: "DSTV-MC",
				Amount: 29500, Frequency: "MONTHLY", Status: MandateStatusSuspended,
				StartDate: time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC),
				EndDate: time.Date(2027, 2, 28, 0, 0, 0, 0, time.UTC),
				NextDebitDate: time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC),
				ExecutionCount: 14, TotalDebited: 413_000,
				CreatedAt: time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC), AggregatorName: "Paystack",
			},
			{
				ID: "MND-005", MandateRef: "NDD/2024/FBN/005", MandateType: MandateTypeVariable,
				SubscriberName: "Grace Adeyemi", SubscriberAcct: "0011500005", SubscriberBank: "First Bank",
				SubscriberBVN: "44567890123", BillerName: "Lagos State IRS", BillerCode: "TAX-LIRS",
				Amount: 0, Frequency: "ANNUALLY", Status: MandateStatusExpired,
				StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				EndDate: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
				NextDebitDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
				ExecutionCount: 2, TotalDebited: 450_000,
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			},
		},
	}
}

// ListMandates returns all mandates.
func (s *NDDService) ListMandates(ctx context.Context) []DirectDebitMandate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.mandates
}

// CreateMandate creates a new direct debit mandate.
func (s *NDDService) CreateMandate(ctx context.Context, mandate DirectDebitMandate) (*DirectDebitMandate, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	mandate.ID = fmt.Sprintf("MND-%s", generateID())
	mandate.MandateRef = fmt.Sprintf("NDD/2026/%s/%03d", mandate.SubscriberBank[:3], len(s.mandates)+1)
	mandate.CreatedAt = time.Now()
	s.mandates = append(s.mandates, mandate)
	return &mandate, nil
}

// ======================== Transaction Reversals ========================

// ReversalStatus tracks the state of a reversal request.
type ReversalStatus string

const (
	ReversalStatusPending  ReversalStatus = "PENDING"
	ReversalStatusReversed ReversalStatus = "REVERSED"
	ReversalStatusDeclined ReversalStatus = "DECLINED"
)

// TransactionReversal represents a NIP reversal request.
type TransactionReversal struct {
	ID               string         `json:"id"`
	OriginalNIPRef   string         `json:"originalNipRef"`
	OriginalAmount   float64        `json:"originalAmount"`
	ReversalAmount   float64        `json:"reversalAmount"`
	SenderBank       string         `json:"senderBank"`
	ReceiverBank     string         `json:"receiverBank"`
	Reason           string         `json:"reason"`
	Status           ReversalStatus `json:"status"`
	RequestedAt      time.Time      `json:"requestedAt"`
	ResolvedAt       *time.Time     `json:"resolvedAt,omitempty"`
	RequestedBy      string         `json:"requestedBy"`
	ResponseCode     string         `json:"responseCode,omitempty"`
}

// ReversalService handles NIP transaction reversals.
type ReversalService struct {
	mu        sync.RWMutex
	reversals []TransactionReversal
}

// NewReversalService creates a new reversal service with seed data.
func NewReversalService() *ReversalService {
	resolvedAt := time.Date(2026, 5, 1, 17, 0, 0, 0, time.UTC)
	return &ReversalService{
		reversals: []TransactionReversal{
			{
				ID: "REV-001", OriginalNIPRef: "NIP-D-006", OriginalAmount: 500_000, ReversalAmount: 500_000,
				SenderBank: "First Bank", ReceiverBank: "Access Bank",
				Reason: "BENEFICIARY_ACCOUNT_NOT_FOUND", Status: ReversalStatusReversed,
				RequestedAt: time.Date(2026, 5, 1, 16, 5, 0, 0, time.UTC), ResolvedAt: &resolvedAt,
				RequestedBy: "system", ResponseCode: "00",
			},
			{
				ID: "REV-002", OriginalNIPRef: "NIP-EXT-001", OriginalAmount: 1_500_000, ReversalAmount: 1_500_000,
				SenderBank: "GTBank", ReceiverBank: "UBA",
				Reason: "DUPLICATE_TRANSACTION", Status: ReversalStatusPending,
				RequestedAt: time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC),
				RequestedBy: "admin",
			},
			{
				ID: "REV-003", OriginalNIPRef: "NIP-EXT-002", OriginalAmount: 75_000, ReversalAmount: 75_000,
				SenderBank: "Zenith Bank", ReceiverBank: "Sterling Bank",
				Reason: "WRONG_BENEFICIARY", Status: ReversalStatusDeclined,
				RequestedAt: time.Date(2026, 4, 30, 14, 0, 0, 0, time.UTC), ResolvedAt: &resolvedAt,
				RequestedBy: "ops_team", ResponseCode: "57",
			},
		},
	}
}

// ListReversals returns all reversals.
func (s *ReversalService) ListReversals(ctx context.Context) []TransactionReversal {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.reversals
}

// ======================== Disputes ========================

// DisputeStatus tracks the state of an inter-bank dispute.
type DisputeStatus string

const (
	DisputeStatusOpen         DisputeStatus = "OPEN"
	DisputeStatusUnderReview  DisputeStatus = "UNDER_REVIEW"
	DisputeStatusResolved     DisputeStatus = "RESOLVED"
	DisputeStatusEscalatedCBN DisputeStatus = "ESCALATED_TO_CBN"
)

// InterBankDispute represents a dispute between banks.
type InterBankDispute struct {
	ID               string        `json:"id"`
	NIPRef           string        `json:"nipRef"`
	Amount           float64       `json:"amount"`
	DisputeType      string        `json:"disputeType"` // DEBIT_WITHOUT_CREDIT, WRONG_AMOUNT, UNAUTHORIZED
	InitiatingBank   string        `json:"initiatingBank"`
	RespondingBank   string        `json:"respondingBank"`
	Status           DisputeStatus `json:"status"`
	Description      string        `json:"description"`
	Resolution       string        `json:"resolution,omitempty"`
	SLADeadline      time.Time     `json:"slaDeadline"`
	CreatedAt        time.Time     `json:"createdAt"`
	ResolvedAt       *time.Time    `json:"resolvedAt,omitempty"`
	EscalatedAt      *time.Time    `json:"escalatedAt,omitempty"`
}

// DisputeService handles inter-bank disputes.
type DisputeService struct {
	mu       sync.RWMutex
	disputes []InterBankDispute
}

// NewDisputeService creates a new dispute service with seed data.
func NewDisputeService() *DisputeService {
	resolvedAt := time.Date(2026, 5, 1, 18, 0, 0, 0, time.UTC)
	return &DisputeService{
		disputes: []InterBankDispute{
			{
				ID: "DSP-001", NIPRef: "NIP-D-006", Amount: 500_000,
				DisputeType: "DEBIT_WITHOUT_CREDIT",
				InitiatingBank: "First Bank", RespondingBank: "Access Bank",
				Status: DisputeStatusResolved,
				Description: "Customer debited but beneficiary not credited. NIP timeout at receiver end.",
				Resolution: "Funds reversed to sender account. Root cause: receiver downtime.",
				SLADeadline: time.Date(2026, 5, 3, 0, 0, 0, 0, time.UTC),
				CreatedAt: time.Date(2026, 5, 1, 16, 30, 0, 0, time.UTC), ResolvedAt: &resolvedAt,
			},
			{
				ID: "DSP-002", NIPRef: "NIP-EXT-003", Amount: 2_500_000,
				DisputeType: "WRONG_AMOUNT",
				InitiatingBank: "GTBank", RespondingBank: "Zenith Bank",
				Status: DisputeStatusUnderReview,
				Description: "Sender initiated ₦2.5M but beneficiary credited ₦250K. Possible decimal error.",
				SLADeadline: time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC),
				CreatedAt: time.Date(2026, 5, 2, 9, 0, 0, 0, time.UTC),
			},
			{
				ID: "DSP-003", NIPRef: "NIP-EXT-004", Amount: 15_000_000,
				DisputeType: "UNAUTHORIZED",
				InitiatingBank: "UBA", RespondingBank: "Wema Bank",
				Status: DisputeStatusEscalatedCBN,
				Description: "Customer claims unauthorized debit of ₦15M. Possible account compromise.",
				SLADeadline: time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC),
				CreatedAt: time.Date(2026, 4, 29, 8, 0, 0, 0, time.UTC),
				EscalatedAt: &resolvedAt,
			},
			{
				ID: "DSP-004", NIPRef: "NIP-EXT-005", Amount: 350_000,
				DisputeType: "DEBIT_WITHOUT_CREDIT",
				InitiatingBank: "Sterling Bank", RespondingBank: "Access Bank",
				Status: DisputeStatusOpen,
				Description: "USSD transfer debited but NIP response timed out. Beneficiary not credited.",
				SLADeadline: time.Date(2026, 5, 6, 0, 0, 0, 0, time.UTC),
				CreatedAt: time.Date(2026, 5, 2, 14, 0, 0, 0, time.UTC),
			},
		},
	}
}

// ListDisputes returns all disputes.
func (s *DisputeService) ListDisputes(ctx context.Context) []InterBankDispute {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.disputes
}

// ======================== PayDirect Collections ========================

// PayDirectCollection represents a corporate collection mandate via PayDirect.
type PayDirectCollection struct {
	ID               string    `json:"id"`
	CollectorName    string    `json:"collectorName"`
	CollectorCode    string    `json:"collectorCode"`
	Category         string    `json:"category"` // GOVERNMENT, EDUCATION, INSURANCE, UTILITY
	ProductName      string    `json:"productName"`
	Status           string    `json:"status"`
	TotalCollected   float64   `json:"totalCollected"`
	TransactionCount int       `json:"transactionCount"`
	BankCoverage     int       `json:"bankCoverage"`
	Channels         []string  `json:"channels"`
	CreatedAt        time.Time `json:"createdAt"`
}

// PayDirectService handles corporate collections.
type PayDirectService struct {
	mu          sync.RWMutex
	collections []PayDirectCollection
}

// NewPayDirectService creates a new PayDirect service with seed data.
func NewPayDirectService() *PayDirectService {
	return &PayDirectService{
		collections: []PayDirectCollection{
			{
				ID: "PD-001", CollectorName: "Federal Inland Revenue Service", CollectorCode: "FIRS",
				Category: "GOVERNMENT", ProductName: "Tax Payment (CIT/VAT/WHT)",
				Status: "ACTIVE", TotalCollected: 45_000_000_000, TransactionCount: 125_000,
				BankCoverage: 25, Channels: []string{"internet_banking", "mobile_app", "USSD", "bank_branch"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "PD-002", CollectorName: "Lagos State Internal Revenue Service", CollectorCode: "LIRS",
				Category: "GOVERNMENT", ProductName: "State Tax & Levies",
				Status: "ACTIVE", TotalCollected: 12_000_000_000, TransactionCount: 89_000,
				BankCoverage: 22, Channels: []string{"internet_banking", "mobile_app", "USSD"},
				CreatedAt: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "PD-003", CollectorName: "University of Lagos", CollectorCode: "UNILAG",
				Category: "EDUCATION", ProductName: "School Fees & Hostel",
				Status: "ACTIVE", TotalCollected: 8_500_000_000, TransactionCount: 45_000,
				BankCoverage: 20, Channels: []string{"internet_banking", "mobile_app"},
				CreatedAt: time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "PD-004", CollectorName: "AXA Mansard Insurance", CollectorCode: "AXA-MAN",
				Category: "INSURANCE", ProductName: "Insurance Premium Collection",
				Status: "ACTIVE", TotalCollected: 3_200_000_000, TransactionCount: 28_000,
				BankCoverage: 18, Channels: []string{"internet_banking", "mobile_app", "bank_branch"},
				CreatedAt: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "PD-005", CollectorName: "Eko Electricity Distribution", CollectorCode: "EKEDC",
				Category: "UTILITY", ProductName: "Prepaid & Postpaid Metering",
				Status: "ACTIVE", TotalCollected: 6_800_000_000, TransactionCount: 320_000,
				BankCoverage: 25, Channels: []string{"internet_banking", "mobile_app", "USSD", "bank_branch", "POS"},
				CreatedAt: time.Date(2023, 9, 1, 0, 0, 0, 0, time.UTC),
			},
		},
	}
}

// ListCollections returns all PayDirect collections.
func (s *PayDirectService) ListCollections(ctx context.Context) []PayDirectCollection {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.collections
}

// ======================== Merchant Registry (mCash+) ========================

// MerchantRecord represents a registered mCash+ merchant.
type MerchantRecord struct {
	ID               string    `json:"id"`
	MerchantName     string    `json:"merchantName"`
	MerchantCode     string    `json:"merchantCode"`
	USSDShortCode    string    `json:"ussdShortCode"`
	Category         string    `json:"category"`
	BankAcct         string    `json:"bankAcct"`
	BankName         string    `json:"bankName"`
	Status           string    `json:"status"`
	TransactionCount int       `json:"transactionCount"`
	TotalVolume      float64   `json:"totalVolume"`
	Location         string    `json:"location"`
	RegisteredAt     time.Time `json:"registeredAt"`
}

// MerchantService handles mCash+ merchant registry.
type MerchantService struct {
	mu        sync.RWMutex
	merchants []MerchantRecord
}

// NewMerchantService creates a new merchant service with seed data.
func NewMerchantService() *MerchantService {
	return &MerchantService{
		merchants: []MerchantRecord{
			{
				ID: "MERCH-001", MerchantName: "ShopRite Ikeja", MerchantCode: "SRI-001",
				USSDShortCode: "*737*2*001#", Category: "RETAIL",
				BankAcct: "0057300003", BankName: "Zenith Bank",
				Status: "ACTIVE", TransactionCount: 12500, TotalVolume: 185_000_000,
				Location: "Ikeja City Mall, Lagos", RegisteredAt: time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "MERCH-002", MerchantName: "Chicken Republic VI", MerchantCode: "CR-VI-001",
				USSDShortCode: "*737*2*002#", Category: "FOOD_BEVERAGE",
				BankAcct: "0011500005", BankName: "First Bank",
				Status: "ACTIVE", TransactionCount: 8200, TotalVolume: 28_000_000,
				Location: "Victoria Island, Lagos", RegisteredAt: time.Date(2024, 8, 15, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "MERCH-003", MerchantName: "Jumia Nigeria", MerchantCode: "JUM-001",
				USSDShortCode: "*737*2*003#", Category: "ECOMMERCE",
				BankAcct: "0058200020", BankName: "GTBank",
				Status: "ACTIVE", TransactionCount: 45000, TotalVolume: 2_500_000_000,
				Location: "Online", RegisteredAt: time.Date(2024, 1, 10, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "MERCH-004", MerchantName: "Balogun Market Traders", MerchantCode: "BMT-001",
				USSDShortCode: "*737*2*004#", Category: "MARKET",
				BankAcct: "0044100050", BankName: "Access Bank",
				Status: "ACTIVE", TransactionCount: 3200, TotalVolume: 15_000_000,
				Location: "Balogun Market, Lagos Island", RegisteredAt: time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				ID: "MERCH-005", MerchantName: "Ibadan Fuel Station", MerchantCode: "IFS-001",
				USSDShortCode: "*737*2*005#", Category: "FUEL",
				BankAcct: "0033400090", BankName: "UBA",
				Status: "SUSPENDED", TransactionCount: 1800, TotalVolume: 42_000_000,
				Location: "Ring Road, Ibadan", RegisteredAt: time.Date(2025, 5, 1, 0, 0, 0, 0, time.UTC),
			},
		},
	}
}

// ListMerchants returns all merchants.
func (s *MerchantService) ListMerchants(ctx context.Context) []MerchantRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.merchants
}

// ======================== Helper ========================

func generateID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
