package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"erpnext-integration-service/internal/erpnext"
	"erpnext-integration-service/internal/models"
)

// FinancialSyncService handles synchronization of financial transactions to ERPNext
type FinancialSyncService struct {
	erpnextClient *erpnext.Client
	company       string
}

// NewFinancialSyncService creates a new financial sync service
func NewFinancialSyncService(erpnextClient *erpnext.Client, company string) *FinancialSyncService {
	return &FinancialSyncService{
		erpnextClient: erpnextClient,
		company:       company,
	}
}

// SyncPremiumPayment syncs a premium payment to ERPNext as a Journal Entry
func (s *FinancialSyncService) SyncPremiumPayment(ctx context.Context, event *models.PremiumPaidEvent) (string, error) {
	log.Printf("Syncing premium payment: PolicyID=%s, Amount=%.2f", event.PolicyID, event.PremiumAmount)

	// Create Journal Entry for premium payment
	// Debit: Bank Account (Asset)
	// Credit: Unearned Premium Revenue (Liability)
	journalEntry := &erpnext.JournalEntry{
		Title:           fmt.Sprintf("Premium Payment - %s", event.PolicyID),
		VoucherType:     "Journal Entry",
		PostingDate:     event.PaymentDate,
		Company:         s.company,
		UserRemark:      fmt.Sprintf("Premium payment for policy %s by customer %s", event.PolicyID, event.CustomerName),
		ReferenceNumber: event.PaymentReference,
		Accounts: []erpnext.JournalEntryAccount{
			{
				Account:                 "Bank Account - Main", // Debit: Asset increases
				DebitInAccountCurrency:  event.PremiumAmount,
				ReferenceType:           "Policy",
				ReferenceName:           event.PolicyID,
			},
			{
				Account:                 "Unearned Premium Revenue - Main", // Credit: Liability increases
				CreditInAccountCurrency: event.PremiumAmount,
				ReferenceType:           "Policy",
				ReferenceName:           event.PolicyID,
			},
		},
	}

	// Create the journal entry
	jeID, err := s.erpnextClient.CreateJournalEntry(ctx, journalEntry)
	if err != nil {
		return "", fmt.Errorf("failed to create journal entry: %w", err)
	}

	log.Printf("Created Journal Entry: %s", jeID)

	// Submit the journal entry to post it to the ledger
	if err := s.erpnextClient.SubmitJournalEntry(ctx, jeID); err != nil {
		return "", fmt.Errorf("failed to submit journal entry: %w", err)
	}

	log.Printf("Submitted Journal Entry: %s", jeID)

	return jeID, nil
}

// SyncClaimPayment syncs a claim payment to ERPNext as a Journal Entry
func (s *FinancialSyncService) SyncClaimPayment(ctx context.Context, event *models.ClaimPaidEvent) (string, error) {
	log.Printf("Syncing claim payment: ClaimID=%s, Amount=%.2f", event.ClaimID, event.ClaimAmount)

	// Create Journal Entry for claim payment
	// Debit: Claim Expense (Expense)
	// Credit: Bank Account (Asset)
	journalEntry := &erpnext.JournalEntry{
		Title:           fmt.Sprintf("Claim Payment - %s", event.ClaimID),
		VoucherType:     "Journal Entry",
		PostingDate:     event.PaymentDate,
		Company:         s.company,
		UserRemark:      fmt.Sprintf("Claim payment for claim %s to customer %s", event.ClaimID, event.CustomerName),
		ReferenceNumber: event.PaymentReference,
		Accounts: []erpnext.JournalEntryAccount{
			{
				Account:                "Claim Expense - Main", // Debit: Expense increases
				DebitInAccountCurrency: event.ClaimAmount,
				ReferenceType:          "Claim",
				ReferenceName:          event.ClaimID,
			},
			{
				Account:                 "Bank Account - Main", // Credit: Asset decreases
				CreditInAccountCurrency: event.ClaimAmount,
				ReferenceType:           "Claim",
				ReferenceName:           event.ClaimID,
			},
		},
	}

	// Create the journal entry
	jeID, err := s.erpnextClient.CreateJournalEntry(ctx, journalEntry)
	if err != nil {
		return "", fmt.Errorf("failed to create journal entry: %w", err)
	}

	log.Printf("Created Journal Entry: %s", jeID)

	// Submit the journal entry
	if err := s.erpnextClient.SubmitJournalEntry(ctx, jeID); err != nil {
		return "", fmt.Errorf("failed to submit journal entry: %w", err)
	}

	log.Printf("Submitted Journal Entry: %s", jeID)

	return jeID, nil
}

// SyncCommissionPayment syncs a commission payment to ERPNext as a Payment Entry
func (s *FinancialSyncService) SyncCommissionPayment(ctx context.Context, event *models.CommissionPaidEvent) (string, error) {
	log.Printf("Syncing commission payment: AgentID=%s, Amount=%.2f", event.AgentID, event.CommissionAmount)

	// First, create a Journal Entry to record the commission expense
	journalEntry := &erpnext.JournalEntry{
		Title:           fmt.Sprintf("Commission Expense - %s", event.PolicyID),
		VoucherType:     "Journal Entry",
		PostingDate:     event.PaymentDate,
		Company:         s.company,
		UserRemark:      fmt.Sprintf("Commission expense for policy %s to agent %s", event.PolicyID, event.AgentName),
		ReferenceNumber: event.PaymentReference,
		Accounts: []erpnext.JournalEntryAccount{
			{
				Account:                "Commission Expense - Main", // Debit: Expense increases
				DebitInAccountCurrency: event.CommissionAmount,
				ReferenceType:          "Policy",
				ReferenceName:          event.PolicyID,
			},
			{
				Account:                 "Commission Payable - Main", // Credit: Liability increases
				CreditInAccountCurrency: event.CommissionAmount,
				ReferenceType:           "Policy",
				ReferenceName:           event.PolicyID,
			},
		},
	}

	// Create and submit the journal entry
	jeID, err := s.erpnextClient.CreateJournalEntry(ctx, journalEntry)
	if err != nil {
		return "", fmt.Errorf("failed to create journal entry: %w", err)
	}

	log.Printf("Created Journal Entry: %s", jeID)

	if err := s.erpnextClient.SubmitJournalEntry(ctx, jeID); err != nil {
		return "", fmt.Errorf("failed to submit journal entry: %w", err)
	}

	log.Printf("Submitted Journal Entry: %s", jeID)

	// Now create a Payment Entry to record the actual payment to the agent
	paymentEntry := &erpnext.PaymentEntry{
		PaymentType:    "Pay",
		PostingDate:    event.PaymentDate,
		Company:        s.company,
		Mode:           "Bank Transfer",
		Party:          event.AgentID,
		PartyType:      "Employee",
		PaidFrom:       "Bank Account - Main",
		PaidTo:         "Commission Payable - Main",
		PaidAmount:     event.CommissionAmount,
		ReceivedAmount: event.CommissionAmount,
		ReferenceNo:    event.PaymentReference,
		ReferenceDate:  event.PaymentDate,
		References: []erpnext.PaymentEntryReference{
			{
				ReferenceDoctype: "Journal Entry",
				ReferenceName:    jeID,
				AllocatedAmount:  event.CommissionAmount,
			},
		},
	}

	// Create the payment entry
	peID, err := s.erpnextClient.CreatePaymentEntry(ctx, paymentEntry)
	if err != nil {
		return "", fmt.Errorf("failed to create payment entry: %w", err)
	}

	log.Printf("Created Payment Entry: %s", peID)

	// Submit the payment entry
	if err := s.erpnextClient.SubmitPaymentEntry(ctx, peID); err != nil {
		return "", fmt.Errorf("failed to submit payment entry: %w", err)
	}

	log.Printf("Submitted Payment Entry: %s", peID)

	// Return both IDs as a JSON string
	result := map[string]string{
		"journal_entry":  jeID,
		"payment_entry": peID,
	}
	resultJSON, _ := json.Marshal(result)
	return string(resultJSON), nil
}

// ReconciliationReport represents the result of a financial reconciliation
type ReconciliationReport struct {
	StartDate           string                  `json:"start_date"`
	EndDate             string                  `json:"end_date"`
	TotalTigerBeetle    float64                 `json:"total_tigerbeetle"`
	TotalERPNext        float64                 `json:"total_erpnext"`
	Difference          float64                 `json:"difference"`
	IsReconciled        bool                    `json:"is_reconciled"`
	MissingInERPNext    []ReconciliationItem    `json:"missing_in_erpnext"`
	MissingInTigerBeetle []ReconciliationItem   `json:"missing_in_tigerbeetle"`
	Discrepancies       []ReconciliationDiscrepancy `json:"discrepancies"`
	GeneratedAt         time.Time               `json:"generated_at"`
}

// ReconciliationItem represents a transaction that exists in one system but not the other
type ReconciliationItem struct {
	TransactionID string    `json:"transaction_id"`
	Amount        float64   `json:"amount"`
	Date          string    `json:"date"`
	Type          string    `json:"type"`
	Description   string    `json:"description"`
}

// ReconciliationDiscrepancy represents a transaction with different amounts in both systems
type ReconciliationDiscrepancy struct {
	TransactionID     string  `json:"transaction_id"`
	TigerBeetleAmount float64 `json:"tigerbeetle_amount"`
	ERPNextAmount     float64 `json:"erpnext_amount"`
	Difference        float64 `json:"difference"`
	Date              string  `json:"date"`
}

// TigerBeetleClient interface for querying TigerBeetle transfers
type TigerBeetleClient interface {
	GetTransfers(ctx context.Context, startDate, endDate time.Time) ([]TigerBeetleTransfer, error)
}

// TigerBeetleTransfer represents a transfer from TigerBeetle
type TigerBeetleTransfer struct {
	ID              string    `json:"id"`
	DebitAccountID  string    `json:"debit_account_id"`
	CreditAccountID string    `json:"credit_account_id"`
	Amount          float64   `json:"amount"`
	Timestamp       time.Time `json:"timestamp"`
	UserData        string    `json:"user_data"`
	Code            uint16    `json:"code"`
}

// ERPNextJournalEntry represents a journal entry from ERPNext for reconciliation
type ERPNextJournalEntry struct {
	Name        string  `json:"name"`
	PostingDate string  `json:"posting_date"`
	TotalDebit  float64 `json:"total_debit"`
	TotalCredit float64 `json:"total_credit"`
	UserRemark  string  `json:"user_remark"`
	ReferenceNo string  `json:"reference_number"`
}

// ReconcileFinancials performs a reconciliation between TigerBeetle and ERPNext
func (s *FinancialSyncService) ReconcileFinancials(ctx context.Context, startDate, endDate time.Time) (*ReconciliationReport, error) {
	log.Printf("Starting financial reconciliation from %s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

	report := &ReconciliationReport{
		StartDate:            startDate.Format("2006-01-02"),
		EndDate:              endDate.Format("2006-01-02"),
		MissingInERPNext:     []ReconciliationItem{},
		MissingInTigerBeetle: []ReconciliationItem{},
		Discrepancies:        []ReconciliationDiscrepancy{},
		GeneratedAt:          time.Now(),
	}

	// 1. Query TigerBeetle transfers in the date range
	tigerBeetleTransfers, err := s.getTigerBeetleTransfers(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get TigerBeetle transfers: %w", err)
	}
	log.Printf("Found %d TigerBeetle transfers", len(tigerBeetleTransfers))

	// 2. Query ERPNext Journal Entries in the date range
	erpnextEntries, err := s.getERPNextJournalEntries(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get ERPNext journal entries: %w", err)
	}
	log.Printf("Found %d ERPNext journal entries", len(erpnextEntries))

	// 3. Build lookup maps for comparison
	tbMap := make(map[string]TigerBeetleTransfer)
	for _, t := range tigerBeetleTransfers {
		tbMap[t.UserData] = t
		report.TotalTigerBeetle += t.Amount
	}

	erpMap := make(map[string]ERPNextJournalEntry)
	for _, e := range erpnextEntries {
		erpMap[e.ReferenceNo] = e
		report.TotalERPNext += e.TotalDebit
	}

	// 4. Find transactions missing in ERPNext
	for refNo, tb := range tbMap {
		if _, exists := erpMap[refNo]; !exists {
			report.MissingInERPNext = append(report.MissingInERPNext, ReconciliationItem{
				TransactionID: tb.ID,
				Amount:        tb.Amount,
				Date:          tb.Timestamp.Format("2006-01-02"),
				Type:          "transfer",
				Description:   fmt.Sprintf("TigerBeetle transfer %s not found in ERPNext", tb.ID),
			})
		}
	}

	// 5. Find transactions missing in TigerBeetle
	for refNo, erp := range erpMap {
		if _, exists := tbMap[refNo]; !exists {
			report.MissingInTigerBeetle = append(report.MissingInTigerBeetle, ReconciliationItem{
				TransactionID: erp.Name,
				Amount:        erp.TotalDebit,
				Date:          erp.PostingDate,
				Type:          "journal_entry",
				Description:   fmt.Sprintf("ERPNext journal entry %s not found in TigerBeetle", erp.Name),
			})
		}
	}

	// 6. Find discrepancies (same reference but different amounts)
	for refNo, tb := range tbMap {
		if erp, exists := erpMap[refNo]; exists {
			if tb.Amount != erp.TotalDebit {
				report.Discrepancies = append(report.Discrepancies, ReconciliationDiscrepancy{
					TransactionID:     refNo,
					TigerBeetleAmount: tb.Amount,
					ERPNextAmount:     erp.TotalDebit,
					Difference:        tb.Amount - erp.TotalDebit,
					Date:              tb.Timestamp.Format("2006-01-02"),
				})
			}
		}
	}

	// 7. Calculate overall difference and reconciliation status
	report.Difference = report.TotalTigerBeetle - report.TotalERPNext
	report.IsReconciled = len(report.MissingInERPNext) == 0 && 
		len(report.MissingInTigerBeetle) == 0 && 
		len(report.Discrepancies) == 0

	log.Printf("Reconciliation completed: TigerBeetle=%.2f, ERPNext=%.2f, Difference=%.2f, Reconciled=%v",
		report.TotalTigerBeetle, report.TotalERPNext, report.Difference, report.IsReconciled)

	return report, nil
}

// getTigerBeetleTransfers queries TigerBeetle for transfers in the date range
func (s *FinancialSyncService) getTigerBeetleTransfers(ctx context.Context, startDate, endDate time.Time) ([]TigerBeetleTransfer, error) {
	// TigerBeetle HTTP API endpoint
	tigerBeetleURL := getEnvOrDefault("TIGERBEETLE_URL", "http://tigerbeetle:3000")
	
	url := fmt.Sprintf("%s/transfers?start_timestamp=%d&end_timestamp=%d",
		tigerBeetleURL,
		startDate.UnixNano(),
		endDate.UnixNano())

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TigerBeetle API error: %s (status %d)", string(body), resp.StatusCode)
	}

	var transfers []TigerBeetleTransfer
	if err := json.NewDecoder(resp.Body).Decode(&transfers); err != nil {
		return nil, err
	}

	return transfers, nil
}

// getERPNextJournalEntries queries ERPNext for journal entries in the date range
func (s *FinancialSyncService) getERPNextJournalEntries(ctx context.Context, startDate, endDate time.Time) ([]ERPNextJournalEntry, error) {
	// Use ERPNext Report API to get journal entries
	filters := fmt.Sprintf(`[["posting_date",">=","%s"],["posting_date","<=","%s"],["docstatus","=",1]]`,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"))

	endpoint := fmt.Sprintf("/api/resource/Journal Entry?filters=%s&fields=[\"name\",\"posting_date\",\"total_debit\",\"total_credit\",\"user_remark\",\"reference_number\"]",
		url.QueryEscape(filters))

	resp, err := s.erpnextClient.Get(ctx, endpoint)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextJournalEntry `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

// AutoReconcile attempts to automatically fix reconciliation discrepancies
func (s *FinancialSyncService) AutoReconcile(ctx context.Context, report *ReconciliationReport) error {
	log.Printf("Starting auto-reconciliation for %d missing entries", len(report.MissingInERPNext))

	// For each transaction missing in ERPNext, create a journal entry
	for _, item := range report.MissingInERPNext {
		log.Printf("Creating missing journal entry for transaction %s", item.TransactionID)
		
		journalEntry := &erpnext.JournalEntry{
			Title:           fmt.Sprintf("Auto-Reconciled - %s", item.TransactionID),
			VoucherType:     "Journal Entry",
			PostingDate:     item.Date,
			Company:         s.company,
			UserRemark:      fmt.Sprintf("Auto-reconciled from TigerBeetle: %s", item.Description),
			ReferenceNumber: item.TransactionID,
			Accounts: []erpnext.JournalEntryAccount{
				{
					Account:                "Reconciliation Suspense - Main",
					DebitInAccountCurrency: item.Amount,
				},
				{
					Account:                 "Reconciliation Suspense - Main",
					CreditInAccountCurrency: item.Amount,
				},
			},
		}

		jeID, err := s.erpnextClient.CreateJournalEntry(ctx, journalEntry)
		if err != nil {
			log.Printf("Failed to create journal entry for %s: %v", item.TransactionID, err)
			continue
		}

		log.Printf("Created reconciliation journal entry: %s", jeID)
	}

	return nil
}

// GenerateReconciliationReport generates a detailed reconciliation report
func (s *FinancialSyncService) GenerateReconciliationReport(ctx context.Context, startDate, endDate time.Time) ([]byte, error) {
	report, err := s.ReconcileFinancials(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	reportJSON, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, err
	}

	return reportJSON, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
