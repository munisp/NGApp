package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type AccountType string

const (
	AccountChecking AccountType = "checking"
	AccountSavings  AccountType = "savings"
	AccountWallet   AccountType = "wallet"
	AccountFixed    AccountType = "fixed_deposit"
	AccountJoint    AccountType = "joint"
	AccountFamily   AccountType = "family"
)

type AccountStatus string

const (
	StatusActive    AccountStatus = "active"
	StatusSuspended AccountStatus = "suspended"
	StatusClosed    AccountStatus = "closed"
	StatusFrozen    AccountStatus = "frozen"
)

type Account struct {
	ID            string        `json:"id"`
	UserID        string        `json:"user_id"`
	AccountNumber string        `json:"account_number"`
	AccountType   AccountType   `json:"account_type"`
	Balance       float64       `json:"balance"`
	Currency      string        `json:"currency"`
	Status        AccountStatus `json:"status"`
	InterestRate  float64       `json:"interest_rate"`
	DailyLimit    float64       `json:"daily_limit"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
	JointOwners   []string      `json:"joint_owners,omitempty"`
	FamilyGroupID string        `json:"family_group_id,omitempty"`
}

type LedgerEntry struct {
	ID            string    `json:"id"`
	AccountID     string    `json:"account_id"`
	DebitAmount   float64   `json:"debit_amount"`
	CreditAmount  float64   `json:"credit_amount"`
	Balance       float64   `json:"balance"`
	Description   string    `json:"description"`
	Reference     string    `json:"reference"`
	EntryType     string    `json:"entry_type"`
	CounterpartID string    `json:"counterpart_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type Transaction struct {
	ID              string    `json:"id"`
	FromAccountID   string    `json:"from_account_id"`
	ToAccountID     string    `json:"to_account_id"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Type            string    `json:"type"`
	Status          string    `json:"status"`
	Description     string    `json:"description"`
	Reference       string    `json:"reference"`
	Fee             float64   `json:"fee"`
	ExchangeRate    float64   `json:"exchange_rate,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
}

type InterestAccrual struct {
	ID        string    `json:"id"`
	AccountID string    `json:"account_id"`
	Principal float64   `json:"principal"`
	Rate      float64   `json:"rate"`
	Interest  float64   `json:"interest"`
	Period    string    `json:"period"`
	AccruedAt time.Time `json:"accrued_at"`
}

type Statement struct {
	AccountID      string         `json:"account_id"`
	AccountNumber  string         `json:"account_number"`
	Currency       string         `json:"currency"`
	PeriodStart    time.Time      `json:"period_start"`
	PeriodEnd      time.Time      `json:"period_end"`
	OpeningBalance float64        `json:"opening_balance"`
	ClosingBalance float64        `json:"closing_balance"`
	TotalCredits   float64        `json:"total_credits"`
	TotalDebits    float64        `json:"total_debits"`
	TotalFees      float64        `json:"total_fees"`
	InterestEarned float64        `json:"interest_earned"`
	Entries        []LedgerEntry  `json:"entries"`
	GeneratedAt    time.Time      `json:"generated_at"`
}

type VirtualCard struct {
	ID          string    `json:"id"`
	AccountID   string    `json:"account_id"`
	CardNumber  string    `json:"card_number"`
	ExpiryMonth int       `json:"expiry_month"`
	ExpiryYear  int       `json:"expiry_year"`
	CVV         string    `json:"cvv"`
	Status      string    `json:"status"`
	SpendLimit  float64   `json:"spend_limit"`
	TotalSpent  float64   `json:"total_spent"`
	CreatedAt   time.Time `json:"created_at"`
}

type FamilyGroup struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	OwnerID   string   `json:"owner_id"`
	Members   []string `json:"members"`
	CreatedAt time.Time `json:"created_at"`
}

type ExchangeRate struct {
	From      string  `json:"from"`
	To        string  `json:"to"`
	Rate      float64 `json:"rate"`
	Timestamp time.Time `json:"timestamp"`
}

var (
	accounts      = make(map[string]*Account)
	ledgerEntries = make(map[string][]LedgerEntry)
	transactions  = make(map[string]*Transaction)
	virtualCards  = make(map[string]*VirtualCard)
	familyGroups  = make(map[string]*FamilyGroup)
	interestLog   = make(map[string][]InterestAccrual)
	mu            sync.RWMutex
	idCounter     int64

	exchangeRates = map[string]float64{
		"NGN_USD": 0.00065, "USD_NGN": 1538.0,
		"NGN_GBP": 0.00052, "GBP_NGN": 1923.0,
		"NGN_EUR": 0.00060, "EUR_NGN": 1667.0,
		"KES_USD": 0.0065, "USD_KES": 153.8,
		"KES_NGN": 10.0, "NGN_KES": 0.1,
		"GHS_USD": 0.063, "USD_GHS": 15.87,
		"GHS_NGN": 96.9, "NGN_GHS": 0.0103,
		"ZAR_USD": 0.053, "USD_ZAR": 18.87,
		"ZAR_NGN": 81.5, "NGN_ZAR": 0.0123,
	}

	interestRates = map[AccountType]float64{
		AccountSavings: 0.045,
		AccountFixed:   0.095,
		AccountChecking: 0.005,
		AccountWallet:  0.0,
	}
)

func generateID(prefix string) string {
	mu.Lock()
	idCounter++
	id := idCounter
	mu.Unlock()
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), id)
}

func generateAccountNumber() string {
	return fmt.Sprintf("%010d", time.Now().UnixNano()%10000000000)
}

func generateCardNumber() string {
	return fmt.Sprintf("4%015d", time.Now().UnixNano()%1000000000000000)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func readJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func addLedgerEntry(accountID string, debit, credit float64, desc, ref, entryType, counterpart string) LedgerEntry {
	mu.Lock()
	defer mu.Unlock()

	acc := accounts[accountID]
	if acc == nil {
		return LedgerEntry{}
	}

	acc.Balance += credit - debit
	acc.UpdatedAt = time.Now()

	entry := LedgerEntry{
		ID:            generateID("ledger"),
		AccountID:     accountID,
		DebitAmount:   debit,
		CreditAmount:  credit,
		Balance:       acc.Balance,
		Description:   desc,
		Reference:     ref,
		EntryType:     entryType,
		CounterpartID: counterpart,
		CreatedAt:     time.Now(),
	}

	ledgerEntries[accountID] = append(ledgerEntries[accountID], entry)
	return entry
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"status":  "healthy",
		"service": "core-banking",
		"version": "1.0.0",
		"time":    time.Now().UTC(),
		"accounts_count": len(accounts),
	})
}

func handleCreateAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string      `json:"user_id"`
		AccountType AccountType `json:"account_type"`
		Currency    string      `json:"currency"`
		InitDeposit float64     `json:"initial_deposit"`
		JointOwners []string    `json:"joint_owners,omitempty"`
		FamilyGroup string      `json:"family_group_id,omitempty"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	if req.Currency == "" {
		req.Currency = "NGN"
	}

	rate := interestRates[req.AccountType]
	dailyLimit := 5000000.0
	if req.AccountType == AccountWallet {
		dailyLimit = 1000000.0
	}

	acc := &Account{
		ID:            generateID("acc"),
		UserID:        req.UserID,
		AccountNumber: generateAccountNumber(),
		AccountType:   req.AccountType,
		Balance:       0,
		Currency:      req.Currency,
		Status:        StatusActive,
		InterestRate:  rate,
		DailyLimit:    dailyLimit,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		JointOwners:   req.JointOwners,
		FamilyGroupID: req.FamilyGroup,
	}

	mu.Lock()
	accounts[acc.ID] = acc
	mu.Unlock()

	if req.InitDeposit > 0 {
		addLedgerEntry(acc.ID, 0, req.InitDeposit, "Initial deposit", generateID("ref"), "deposit", "")
	}

	writeJSON(w, 201, acc)
}

func handleGetAccount(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/accounts/")
	mu.RLock()
	acc, ok := accounts[id]
	mu.RUnlock()
	if !ok {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}
	writeJSON(w, 200, acc)
}

func handleGetUserAccounts(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		writeJSON(w, 400, map[string]string{"error": "user_id required"})
		return
	}

	mu.RLock()
	var userAccounts []*Account
	for _, acc := range accounts {
		if acc.UserID == userID || contains(acc.JointOwners, userID) {
			userAccounts = append(userAccounts, acc)
		}
	}
	mu.RUnlock()

	writeJSON(w, 200, map[string]interface{}{
		"accounts": userAccounts,
		"total":    len(userAccounts),
	})
}

func handleTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FromAccountID string  `json:"from_account_id"`
		ToAccountID   string  `json:"to_account_id"`
		Amount        float64 `json:"amount"`
		Currency      string  `json:"currency"`
		Description   string  `json:"description"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	fromAcc := accounts[req.FromAccountID]
	toAcc := accounts[req.ToAccountID]
	mu.RUnlock()

	if fromAcc == nil {
		writeJSON(w, 404, map[string]string{"error": "source account not found"})
		return
	}
	if toAcc == nil {
		writeJSON(w, 404, map[string]string{"error": "destination account not found"})
		return
	}
	if fromAcc.Status != StatusActive {
		writeJSON(w, 400, map[string]string{"error": "source account is not active"})
		return
	}
	if fromAcc.Balance < req.Amount {
		writeJSON(w, 400, map[string]string{"error": "insufficient funds"})
		return
	}

	fee := 0.0
	exchangeRate := 1.0
	finalAmount := req.Amount

	if fromAcc.Currency != toAcc.Currency {
		key := fromAcc.Currency + "_" + toAcc.Currency
		rate, ok := exchangeRates[key]
		if !ok {
			writeJSON(w, 400, map[string]string{"error": "exchange rate not available"})
			return
		}
		exchangeRate = rate
		finalAmount = req.Amount * rate
		fee = req.Amount * 0.005
	}

	ref := generateID("txn")
	txn := &Transaction{
		ID:            ref,
		FromAccountID: req.FromAccountID,
		ToAccountID:   req.ToAccountID,
		Amount:        req.Amount,
		Currency:      fromAcc.Currency,
		Type:          "transfer",
		Status:        "completed",
		Description:   req.Description,
		Reference:     ref,
		Fee:           fee,
		ExchangeRate:  exchangeRate,
		CreatedAt:     time.Now(),
	}
	now := time.Now()
	txn.CompletedAt = &now

	mu.Lock()
	transactions[ref] = txn
	mu.Unlock()

	addLedgerEntry(req.FromAccountID, req.Amount+fee, 0, "Transfer out: "+req.Description, ref, "transfer_out", req.ToAccountID)
	addLedgerEntry(req.ToAccountID, 0, finalAmount, "Transfer in: "+req.Description, ref, "transfer_in", req.FromAccountID)

	if fee > 0 {
		addLedgerEntry(req.FromAccountID, fee, 0, "Transfer fee", ref, "fee", "")
	}

	writeJSON(w, 200, txn)
}

func handleDeposit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID   string  `json:"account_id"`
		Amount      float64 `json:"amount"`
		Description string  `json:"description"`
		Channel     string  `json:"channel"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	acc := accounts[req.AccountID]
	mu.RUnlock()
	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	ref := generateID("dep")
	entry := addLedgerEntry(req.AccountID, 0, req.Amount, req.Description, ref, "deposit", "")

	txn := &Transaction{
		ID:          ref,
		ToAccountID: req.AccountID,
		Amount:      req.Amount,
		Currency:    acc.Currency,
		Type:        "deposit",
		Status:      "completed",
		Description: req.Description,
		Reference:   ref,
		CreatedAt:   time.Now(),
	}
	now := time.Now()
	txn.CompletedAt = &now

	mu.Lock()
	transactions[ref] = txn
	mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{
		"transaction": txn,
		"ledger_entry": entry,
		"new_balance": acc.Balance,
	})
}

func handleWithdraw(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID   string  `json:"account_id"`
		Amount      float64 `json:"amount"`
		Description string  `json:"description"`
		Channel     string  `json:"channel"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	acc := accounts[req.AccountID]
	mu.RUnlock()
	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}
	if acc.Balance < req.Amount {
		writeJSON(w, 400, map[string]string{"error": "insufficient funds"})
		return
	}

	ref := generateID("wdl")
	entry := addLedgerEntry(req.AccountID, req.Amount, 0, req.Description, ref, "withdrawal", "")

	txn := &Transaction{
		ID:            ref,
		FromAccountID: req.AccountID,
		Amount:        req.Amount,
		Currency:      acc.Currency,
		Type:          "withdrawal",
		Status:        "completed",
		Description:   req.Description,
		Reference:     ref,
		CreatedAt:     time.Now(),
	}
	now := time.Now()
	txn.CompletedAt = &now

	mu.Lock()
	transactions[ref] = txn
	mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{
		"transaction": txn,
		"ledger_entry": entry,
		"new_balance": acc.Balance,
	})
}

func handleAccrueInterest(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	var accruals []InterestAccrual
	for _, acc := range accounts {
		if acc.Status == StatusActive && acc.InterestRate > 0 && acc.Balance > 0 {
			dailyRate := acc.InterestRate / 365.0
			interest := math.Round(acc.Balance*dailyRate*100) / 100

			accrual := InterestAccrual{
				ID:        generateID("int"),
				AccountID: acc.ID,
				Principal: acc.Balance,
				Rate:      acc.InterestRate,
				Interest:  interest,
				Period:    "daily",
				AccruedAt: time.Now(),
			}
			accruals = append(accruals, accrual)
		}
	}
	mu.RUnlock()

	for _, accrual := range accruals {
		addLedgerEntry(accrual.AccountID, 0, accrual.Interest,
			fmt.Sprintf("Interest accrual @ %.2f%%", accrual.Rate*100),
			accrual.ID, "interest", "")

		mu.Lock()
		interestLog[accrual.AccountID] = append(interestLog[accrual.AccountID], accrual)
		mu.Unlock()
	}

	writeJSON(w, 200, map[string]interface{}{
		"accruals_processed": len(accruals),
		"accruals":           accruals,
	})
}

func handleGetStatement(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	daysStr := r.URL.Query().Get("days")
	days := 30
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil {
			days = d
		}
	}

	mu.RLock()
	acc := accounts[accountID]
	entries := ledgerEntries[accountID]
	mu.RUnlock()

	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	periodEnd := time.Now()
	periodStart := periodEnd.AddDate(0, 0, -days)

	var filtered []LedgerEntry
	var totalCredits, totalDebits, totalFees, interestEarned float64
	openingBalance := 0.0

	for _, entry := range entries {
		if entry.CreatedAt.Before(periodStart) {
			openingBalance = entry.Balance
			continue
		}
		if entry.CreatedAt.After(periodEnd) {
			continue
		}
		filtered = append(filtered, entry)
		totalCredits += entry.CreditAmount
		totalDebits += entry.DebitAmount
		if entry.EntryType == "fee" {
			totalFees += entry.DebitAmount
		}
		if entry.EntryType == "interest" {
			interestEarned += entry.CreditAmount
		}
	}

	stmt := Statement{
		AccountID:      acc.ID,
		AccountNumber:  acc.AccountNumber,
		Currency:       acc.Currency,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		OpeningBalance: openingBalance,
		ClosingBalance: acc.Balance,
		TotalCredits:   totalCredits,
		TotalDebits:    totalDebits,
		TotalFees:      totalFees,
		InterestEarned: interestEarned,
		Entries:        filtered,
		GeneratedAt:    time.Now(),
	}

	writeJSON(w, 200, stmt)
}

func handleGetLedger(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	mu.RLock()
	entries := ledgerEntries[accountID]
	mu.RUnlock()

	if len(entries) > limit {
		entries = entries[len(entries)-limit:]
	}

	writeJSON(w, 200, map[string]interface{}{
		"account_id": accountID,
		"entries":    entries,
		"total":      len(entries),
	})
}

func handleCreateVirtualCard(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string  `json:"account_id"`
		SpendLimit float64 `json:"spend_limit"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	acc := accounts[req.AccountID]
	mu.RUnlock()
	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	card := &VirtualCard{
		ID:          generateID("card"),
		AccountID:   req.AccountID,
		CardNumber:  generateCardNumber(),
		ExpiryMonth: int(time.Now().Month()),
		ExpiryYear:  time.Now().Year() + 3,
		CVV:         fmt.Sprintf("%03d", time.Now().UnixNano()%1000),
		Status:      "active",
		SpendLimit:  req.SpendLimit,
		TotalSpent:  0,
		CreatedAt:   time.Now(),
	}

	mu.Lock()
	virtualCards[card.ID] = card
	mu.Unlock()

	maskedCard := *card
	maskedCard.CardNumber = "****" + card.CardNumber[len(card.CardNumber)-4:]
	maskedCard.CVV = "***"

	writeJSON(w, 201, maskedCard)
}

func handleGetExchangeRates(w http.ResponseWriter, r *http.Request) {
	baseCurrency := r.URL.Query().Get("base")
	if baseCurrency == "" {
		baseCurrency = "NGN"
	}

	var rates []ExchangeRate
	for key, rate := range exchangeRates {
		parts := strings.Split(key, "_")
		if parts[0] == baseCurrency {
			rates = append(rates, ExchangeRate{
				From:      parts[0],
				To:        parts[1],
				Rate:      rate,
				Timestamp: time.Now(),
			})
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"base":  baseCurrency,
		"rates": rates,
	})
}

func handleCreateFamilyGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name    string   `json:"name"`
		OwnerID string   `json:"owner_id"`
		Members []string `json:"members"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	group := &FamilyGroup{
		ID:        generateID("fam"),
		Name:      req.Name,
		OwnerID:   req.OwnerID,
		Members:   append(req.Members, req.OwnerID),
		CreatedAt: time.Now(),
	}

	mu.Lock()
	familyGroups[group.ID] = group
	mu.Unlock()

	writeJSON(w, 201, group)
}

func handleFreezeAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID string `json:"account_id"`
		Reason    string `json:"reason"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.Lock()
	acc := accounts[req.AccountID]
	if acc != nil {
		acc.Status = StatusFrozen
		acc.UpdatedAt = time.Now()
	}
	mu.Unlock()

	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"account_id": acc.ID,
		"status":     acc.Status,
		"reason":     req.Reason,
	})
}

func handleUnfreezeAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID string `json:"account_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.Lock()
	acc := accounts[req.AccountID]
	if acc != nil {
		acc.Status = StatusActive
		acc.UpdatedAt = time.Now()
	}
	mu.Unlock()

	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	writeJSON(w, 200, acc)
}

func handleCloseAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID       string `json:"account_id"`
		TransferTo      string `json:"transfer_to"`
		Reason          string `json:"reason"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	acc := accounts[req.AccountID]
	mu.RUnlock()

	if acc == nil {
		writeJSON(w, 404, map[string]string{"error": "account not found"})
		return
	}

	if acc.Balance > 0 && req.TransferTo != "" {
		mu.RLock()
		toAcc := accounts[req.TransferTo]
		mu.RUnlock()
		if toAcc != nil {
			ref := generateID("close")
			addLedgerEntry(acc.ID, acc.Balance, 0, "Account closure transfer", ref, "closure", req.TransferTo)
			addLedgerEntry(req.TransferTo, 0, acc.Balance, "Transfer from closed account", ref, "closure_in", acc.ID)
		}
	}

	mu.Lock()
	acc.Status = StatusClosed
	acc.UpdatedAt = time.Now()
	mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{
		"account_id": acc.ID,
		"status":     "closed",
		"reason":     req.Reason,
	})
}

func handleGetTransactions(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	mu.RLock()
	var txns []*Transaction
	for _, txn := range transactions {
		if txn.FromAccountID == accountID || txn.ToAccountID == accountID {
			txns = append(txns, txn)
		}
	}
	mu.RUnlock()

	if len(txns) > limit {
		txns = txns[len(txns)-limit:]
	}

	writeJSON(w, 200, map[string]interface{}{
		"transactions": txns,
		"total":        len(txns),
	})
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/accounts/create", handleCreateAccount)
	mux.HandleFunc("/accounts/user", handleGetUserAccounts)
	mux.HandleFunc("/accounts/", handleGetAccount)
	mux.HandleFunc("/transfer", handleTransfer)
	mux.HandleFunc("/deposit", handleDeposit)
	mux.HandleFunc("/withdraw", handleWithdraw)
	mux.HandleFunc("/interest/accrue", handleAccrueInterest)
	mux.HandleFunc("/statement", handleGetStatement)
	mux.HandleFunc("/ledger", handleGetLedger)
	mux.HandleFunc("/transactions", handleGetTransactions)
	mux.HandleFunc("/cards/create", handleCreateVirtualCard)
	mux.HandleFunc("/exchange-rates", handleGetExchangeRates)
	mux.HandleFunc("/family/create", handleCreateFamilyGroup)
	mux.HandleFunc("/accounts/freeze", handleFreezeAccount)
	mux.HandleFunc("/accounts/unfreeze", handleUnfreezeAccount)
	mux.HandleFunc("/accounts/close", handleCloseAccount)

	handler := corsMiddleware(mux)

	port := "8113"
	log.Printf("Core Banking service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
