// Package trade implements Cross-Border Trade Payments (B2B) for the National Payment Switch.
// Handles letter of credit processing, trade finance documents, escrow & milestone payments,
// multi-currency invoicing, customs duty payments, and AfCFTA trade corridor support.
package trade

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// LCStatus represents the lifecycle stage of a letter of credit.
type LCStatus string

const (
	LCDraft       LCStatus = "DRAFT"
	LCIssued      LCStatus = "ISSUED"
	LCAdvised     LCStatus = "ADVISED"
	LCConfirmed   LCStatus = "CONFIRMED"
	LCAmended     LCStatus = "AMENDED"
	LCDrawnDown   LCStatus = "DRAWN_DOWN"
	LCSettled     LCStatus = "SETTLED"
	LCExpired     LCStatus = "EXPIRED"
	LCCancelled   LCStatus = "CANCELLED"
)

// LetterOfCredit represents an import/export LC.
type LetterOfCredit struct {
	ID                 string    `json:"id"`
	LCNumber           string    `json:"lcNumber"`
	Type               string    `json:"type"` // import, export, standby
	Applicant          string    `json:"applicant"`
	ApplicantBank      string    `json:"applicantBank"`
	Beneficiary        string    `json:"beneficiary"`
	BeneficiaryBank    string    `json:"beneficiaryBank"`
	BeneficiaryCountry string    `json:"beneficiaryCountry"`
	Amount             float64   `json:"amount"`
	Currency           string    `json:"currency"`
	GoodsDescription   string    `json:"goodsDescription"`
	ShipmentPort       string    `json:"shipmentPort"`
	DestinationPort    string    `json:"destinationPort"`
	ShipmentDeadline   time.Time `json:"shipmentDeadline"`
	ExpiryDate         time.Time `json:"expiryDate"`
	Status             LCStatus  `json:"status"`
	Documents          []TradeDocument `json:"documents"`
	IssuedAt           time.Time `json:"issuedAt"`
	SettledAt          *time.Time `json:"settledAt,omitempty"`
	FormMRef           string    `json:"formMRef"`
}

// TradeDocument represents a trade finance document (BOL, invoice, CoO, etc.).
type TradeDocument struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"` // bill_of_lading, commercial_invoice, certificate_of_origin, packing_list, insurance_cert
	DocumentRef  string    `json:"documentRef"`
	UploadedBy   string    `json:"uploadedBy"`
	UploadedAt   time.Time `json:"uploadedAt"`
	VerifiedBy   string    `json:"verifiedBy,omitempty"`
	VerifiedAt   *time.Time `json:"verifiedAt,omitempty"`
	Status       string    `json:"status"` // pending, verified, rejected
	Hash         string    `json:"hash"`
}

// EscrowPayment represents a milestone-based escrow payment.
type EscrowPayment struct {
	ID             string          `json:"id"`
	BuyerID        string          `json:"buyerId"`
	BuyerName      string          `json:"buyerName"`
	SellerID       string          `json:"sellerId"`
	SellerName     string          `json:"sellerName"`
	TotalAmount    float64         `json:"totalAmount"`
	Currency       string          `json:"currency"`
	Milestones     []EscrowMilestone `json:"milestones"`
	Status         string          `json:"status"` // active, completed, disputed, cancelled
	CreatedAt      time.Time       `json:"createdAt"`
	CompletedAt    *time.Time      `json:"completedAt,omitempty"`
}

// EscrowMilestone represents a payment milestone within an escrow.
type EscrowMilestone struct {
	ID          string     `json:"id"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	DueDate     time.Time  `json:"dueDate"`
	Status      string     `json:"status"` // pending, buyer_approved, released, disputed
	ReleasedAt  *time.Time `json:"releasedAt,omitempty"`
}

// TradeInvoice represents a multi-currency trade invoice.
type TradeInvoice struct {
	ID              string    `json:"id"`
	InvoiceNumber   string    `json:"invoiceNumber"`
	ExporterID      string    `json:"exporterId"`
	ExporterName    string    `json:"exporterName"`
	ImporterID      string    `json:"importerId"`
	ImporterName    string    `json:"importerName"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	AmountNGN       float64   `json:"amountNGN"`
	FXRate          float64   `json:"fxRate"`
	DueDate         time.Time `json:"dueDate"`
	Status          string    `json:"status"` // draft, sent, paid, overdue
	GoodsDesc       string    `json:"goodsDesc"`
	HSCode          string    `json:"hsCode"`
	IsAfCFTA        bool      `json:"isAfCFTA"`
	AfCFTADiscount  float64   `json:"afcftaDiscount"`
}

// CustomsDutyPayment represents a payment to Nigeria Customs (NICIS).
type CustomsDutyPayment struct {
	ID              string    `json:"id"`
	AssessmentRef   string    `json:"assessmentRef"`
	ImporterID      string    `json:"importerId"`
	ImporterName    string    `json:"importerName"`
	DutyAmount      float64   `json:"dutyAmount"`
	VATAmount       float64   `json:"vatAmount"`
	SurchargeAmount float64   `json:"surchargeAmount"`
	TotalAmount     float64   `json:"totalAmount"`
	Currency        string    `json:"currency"`
	HSCode          string    `json:"hsCode"`
	GoodsDesc       string    `json:"goodsDesc"`
	PortOfEntry     string    `json:"portOfEntry"`
	Status          string    `json:"status"` // pending, paid, cleared
	PaidAt          *time.Time `json:"paidAt,omitempty"`
}

// TradeMetricsSnapshot is a point-in-time copy of trade metrics (no mutex).
type TradeMetricsSnapshot struct {
	ActiveLCs          int     `json:"activeLCs"`
	TotalLCValue       float64 `json:"totalLCValue"`
	ActiveEscrows      int     `json:"activeEscrows"`
	TotalEscrowValue   float64 `json:"totalEscrowValue"`
	PendingInvoices    int     `json:"pendingInvoices"`
	CustomsDutyPaid    float64 `json:"customsDutyPaid"`
	AfCFTATransactions int     `json:"afcftaTransactions"`
	AfCFTASavings      float64 `json:"afcftaSavings"`
}

// TradeMetrics tracks operational metrics for trade payments.
type TradeMetrics struct {
	mu                 sync.RWMutex
	ActiveLCs          int     `json:"activeLCs"`
	TotalLCValue       float64 `json:"totalLCValue"`
	ActiveEscrows      int     `json:"activeEscrows"`
	TotalEscrowValue   float64 `json:"totalEscrowValue"`
	PendingInvoices    int     `json:"pendingInvoices"`
	CustomsDutyPaid    float64 `json:"customsDutyPaid"`
	AfCFTATransactions int     `json:"afcftaTransactions"`
	AfCFTASavings      float64 `json:"afcftaSavings"`
}

// TradePaymentEngine orchestrates cross-border trade payment processing.
type TradePaymentEngine struct {
	mu            sync.RWMutex
	lcs           map[string]*LetterOfCredit
	escrows       map[string]*EscrowPayment
	invoices      map[string]*TradeInvoice
	customsDuties map[string]*CustomsDutyPayment
	metrics       *TradeMetrics
}

func tradeID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

// NewTradePaymentEngine creates a new trade payment engine.
func NewTradePaymentEngine() *TradePaymentEngine {
	return &TradePaymentEngine{
		lcs:           make(map[string]*LetterOfCredit),
		escrows:       make(map[string]*EscrowPayment),
		invoices:      make(map[string]*TradeInvoice),
		customsDuties: make(map[string]*CustomsDutyPayment),
		metrics:       &TradeMetrics{},
	}
}

// IssueLC creates and issues a new letter of credit.
func (e *TradePaymentEngine) IssueLC(lc *LetterOfCredit) error {
	lc.ID = tradeID("LC")
	lc.LCNumber = fmt.Sprintf("LC-%d-%s", time.Now().Year(), lc.ID[3:11])
	lc.Status = LCIssued
	lc.IssuedAt = time.Now()
	lc.FormMRef = fmt.Sprintf("FORM-M-%d-%s", time.Now().Year(), tradeID("FM")[3:11])

	e.mu.Lock()
	e.lcs[lc.ID] = lc
	e.mu.Unlock()

	e.metrics.mu.Lock()
	e.metrics.ActiveLCs++
	e.metrics.TotalLCValue += lc.Amount
	e.metrics.mu.Unlock()

	return nil
}

// CreateEscrow sets up a milestone-based escrow payment.
func (e *TradePaymentEngine) CreateEscrow(escrow *EscrowPayment) error {
	escrow.ID = tradeID("ESC")
	escrow.Status = "active"
	escrow.CreatedAt = time.Now()

	for i := range escrow.Milestones {
		escrow.Milestones[i].ID = tradeID("MS")
		escrow.Milestones[i].Status = "pending"
	}

	e.mu.Lock()
	e.escrows[escrow.ID] = escrow
	e.mu.Unlock()

	e.metrics.mu.Lock()
	e.metrics.ActiveEscrows++
	e.metrics.TotalEscrowValue += escrow.TotalAmount
	e.metrics.mu.Unlock()

	return nil
}

// PayCustomsDuty processes a customs duty payment to NICIS.
func (e *TradePaymentEngine) PayCustomsDuty(duty *CustomsDutyPayment) error {
	duty.ID = tradeID("DUTY")
	duty.TotalAmount = duty.DutyAmount + duty.VATAmount + duty.SurchargeAmount
	duty.Currency = "NGN"
	duty.Status = "paid"
	now := time.Now()
	duty.PaidAt = &now

	e.mu.Lock()
	e.customsDuties[duty.ID] = duty
	e.mu.Unlock()

	e.metrics.mu.Lock()
	e.metrics.CustomsDutyPaid += duty.TotalAmount
	e.metrics.mu.Unlock()

	return nil
}

// GetMetrics returns a snapshot of current trade payment metrics.
func (e *TradePaymentEngine) GetMetrics() TradeMetricsSnapshot {
	e.metrics.mu.RLock()
	defer e.metrics.mu.RUnlock()
	return TradeMetricsSnapshot{
		ActiveLCs:          e.metrics.ActiveLCs,
		TotalLCValue:       e.metrics.TotalLCValue,
		ActiveEscrows:      e.metrics.ActiveEscrows,
		TotalEscrowValue:   e.metrics.TotalEscrowValue,
		PendingInvoices:    e.metrics.PendingInvoices,
		CustomsDutyPaid:    e.metrics.CustomsDutyPaid,
		AfCFTATransactions: e.metrics.AfCFTATransactions,
		AfCFTASavings:      e.metrics.AfCFTASavings,
	}
}
