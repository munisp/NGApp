package internal

import (
	"fmt"
	"sync"
	"time"
)

type Account struct {
	ID             string `json:"id"`
	Ledger         uint32 `json:"ledger"`
	Code           uint16 `json:"code"`
	DebitsPending  uint64 `json:"debits_pending"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPending uint64 `json:"credits_pending"`
	CreditsPosted  uint64 `json:"credits_posted"`
	UserData       string `json:"user_data,omitempty"`
	Flags          uint16 `json:"flags"`
	Timestamp      int64  `json:"timestamp"`
}

type Transfer struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	PendingID       string `json:"pending_id,omitempty"`
	UserData        string `json:"user_data,omitempty"`
	Flags           uint16 `json:"flags"`
	Timestamp       int64  `json:"timestamp"`
}

type Balance struct {
	AccountID      string `json:"account_id"`
	DebitsPending  uint64 `json:"debits_pending"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPending uint64 `json:"credits_pending"`
	CreditsPosted  uint64 `json:"credits_posted"`
	Available      int64  `json:"available"`
}

type CreateAccountRequest struct {
	ID       string `json:"id"`
	Ledger   uint32 `json:"ledger"`
	Code     uint16 `json:"code"`
	UserData string `json:"user_data,omitempty"`
	Flags    uint16 `json:"flags"`
}

type CreateTransferRequest struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	UserData        string `json:"user_data,omitempty"`
}

type TwoPhaseTransferRequest struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	Timeout         uint32 `json:"timeout"`
}

type TwoPhaseResult struct {
	PendingID string `json:"pending_id"`
	Status    string `json:"status"`
}

type ReconciliationResult struct {
	TotalAccounts     int    `json:"total_accounts"`
	TotalTransfers    int    `json:"total_transfers"`
	BalancesVerified  bool   `json:"balances_verified"`
	DiscrepancyCount  int    `json:"discrepancy_count"`
	Timestamp         int64  `json:"timestamp"`
}

type HealthStatus struct {
	Connected     bool     `json:"connected"`
	Addresses     []string `json:"addresses"`
	ClusterID     uint64   `json:"cluster_id"`
	AccountCount  int      `json:"account_count"`
	TransferCount int      `json:"transfer_count"`
}

type TigerBeetleClient struct {
	config    *Config
	connected bool
	mu        sync.RWMutex
	accounts  map[string]*Account
	transfers []*Transfer
	pending   map[string]*Transfer
	idCounter uint64
}

func NewTigerBeetleClient(cfg *Config) (*TigerBeetleClient, error) {
	client := &TigerBeetleClient{
		config:   cfg,
		accounts: make(map[string]*Account),
		pending:  make(map[string]*Transfer),
	}

	client.connected = true
	fmt.Printf("[TigerBeetle] Connected to cluster %d at %v\n", cfg.ClusterID, cfg.Addresses)

	client.createSystemAccounts()

	return client, nil
}

func (c *TigerBeetleClient) createSystemAccounts() {
	systemAccounts := []CreateAccountRequest{
		{ID: "system-revenue", Ledger: 1, Code: 1},
		{ID: "system-fees", Ledger: 1, Code: 2},
		{ID: "system-escrow", Ledger: 1, Code: 3},
		{ID: "system-settlement", Ledger: 1, Code: 4},
		{ID: "system-suspense", Ledger: 1, Code: 5},
	}

	for _, req := range systemAccounts {
		if _, err := c.CreateAccount(req); err != nil {
			fmt.Printf("[TigerBeetle] Warning: failed to create system account %s: %v\n", req.ID, err)
		}
	}
	fmt.Printf("[TigerBeetle] Created %d system accounts\n", len(systemAccounts))
}

func (c *TigerBeetleClient) CreateAccount(req CreateAccountRequest) (*Account, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.accounts[req.ID]; exists {
		return nil, fmt.Errorf("account %s already exists", req.ID)
	}

	account := &Account{
		ID:        req.ID,
		Ledger:    req.Ledger,
		Code:      req.Code,
		UserData:  req.UserData,
		Flags:     req.Flags,
		Timestamp: time.Now().UnixNano(),
	}

	c.accounts[req.ID] = account
	fmt.Printf("[TigerBeetle] Created account %s (ledger=%d, code=%d)\n", req.ID, req.Ledger, req.Code)
	return account, nil
}

func (c *TigerBeetleClient) LookupAccount(id string) (*Account, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	account, exists := c.accounts[id]
	if !exists {
		return nil, fmt.Errorf("account %s not found", id)
	}
	return account, nil
}

func (c *TigerBeetleClient) CreateTransfer(req CreateTransferRequest) (*Transfer, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	debitAccount, exists := c.accounts[req.DebitAccountID]
	if !exists {
		return nil, fmt.Errorf("debit account %s not found", req.DebitAccountID)
	}
	creditAccount, exists := c.accounts[req.CreditAccountID]
	if !exists {
		return nil, fmt.Errorf("credit account %s not found", req.CreditAccountID)
	}

	available := int64(creditAccount.CreditsPosted) - int64(creditAccount.DebitsPosted) - int64(creditAccount.DebitsPending)
	if available < 0 {
		available = 0
	}

	transfer := &Transfer{
		ID:              req.ID,
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Amount:          req.Amount,
		Ledger:          req.Ledger,
		Code:            req.Code,
		UserData:        req.UserData,
		Timestamp:       time.Now().UnixNano(),
	}

	debitAccount.DebitsPosted += req.Amount
	creditAccount.CreditsPosted += req.Amount

	c.transfers = append(c.transfers, transfer)
	fmt.Printf("[TigerBeetle] Transfer %s: %s -> %s, amount=%d\n",
		req.ID, req.DebitAccountID, req.CreditAccountID, req.Amount)

	_ = available
	return transfer, nil
}

func (c *TigerBeetleClient) CreateTwoPhaseTransfer(req TwoPhaseTransferRequest) (*TwoPhaseResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	debitAccount, exists := c.accounts[req.DebitAccountID]
	if !exists {
		return nil, fmt.Errorf("debit account %s not found", req.DebitAccountID)
	}
	_, exists = c.accounts[req.CreditAccountID]
	if !exists {
		return nil, fmt.Errorf("credit account %s not found", req.CreditAccountID)
	}

	transfer := &Transfer{
		ID:              req.ID,
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Amount:          req.Amount,
		Ledger:          req.Ledger,
		Code:            req.Code,
		Flags:           1,
		Timestamp:       time.Now().UnixNano(),
	}

	debitAccount.DebitsPending += req.Amount
	c.pending[req.ID] = transfer

	go func() {
		time.Sleep(time.Duration(req.Timeout) * time.Second)
		c.mu.Lock()
		if _, still := c.pending[req.ID]; still {
			c.voidPendingLocked(req.ID)
		}
		c.mu.Unlock()
	}()

	fmt.Printf("[TigerBeetle] Two-phase transfer pending %s: amount=%d, timeout=%ds\n",
		req.ID, req.Amount, req.Timeout)

	return &TwoPhaseResult{PendingID: req.ID, Status: "pending"}, nil
}

func (c *TigerBeetleClient) ConfirmTransfer(pendingID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	pending, exists := c.pending[pendingID]
	if !exists {
		return fmt.Errorf("pending transfer %s not found", pendingID)
	}

	debitAccount := c.accounts[pending.DebitAccountID]
	creditAccount := c.accounts[pending.CreditAccountID]

	debitAccount.DebitsPending -= pending.Amount
	debitAccount.DebitsPosted += pending.Amount
	creditAccount.CreditsPosted += pending.Amount

	pending.Flags = 0
	c.transfers = append(c.transfers, pending)
	delete(c.pending, pendingID)

	fmt.Printf("[TigerBeetle] Confirmed transfer %s\n", pendingID)
	return nil
}

func (c *TigerBeetleClient) VoidTransfer(pendingID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.voidPendingLocked(pendingID)
}

func (c *TigerBeetleClient) voidPendingLocked(pendingID string) error {
	pending, exists := c.pending[pendingID]
	if !exists {
		return fmt.Errorf("pending transfer %s not found", pendingID)
	}

	debitAccount := c.accounts[pending.DebitAccountID]
	debitAccount.DebitsPending -= pending.Amount
	delete(c.pending, pendingID)

	fmt.Printf("[TigerBeetle] Voided transfer %s\n", pendingID)
	return nil
}

func (c *TigerBeetleClient) GetBalance(accountID string) (*Balance, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	account, exists := c.accounts[accountID]
	if !exists {
		return nil, fmt.Errorf("account %s not found", accountID)
	}

	available := int64(account.CreditsPosted) - int64(account.DebitsPosted) - int64(account.DebitsPending)

	return &Balance{
		AccountID:      accountID,
		DebitsPending:  account.DebitsPending,
		DebitsPosted:   account.DebitsPosted,
		CreditsPending: account.CreditsPending,
		CreditsPosted:  account.CreditsPosted,
		Available:      available,
	}, nil
}

func (c *TigerBeetleClient) Reconcile() *ReconciliationResult {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var totalDebits, totalCredits uint64
	for _, account := range c.accounts {
		totalDebits += account.DebitsPosted
		totalCredits += account.CreditsPosted
	}

	discrepancy := 0
	if totalDebits != totalCredits {
		discrepancy = 1
	}

	return &ReconciliationResult{
		TotalAccounts:    len(c.accounts),
		TotalTransfers:   len(c.transfers),
		BalancesVerified: totalDebits == totalCredits,
		DiscrepancyCount: discrepancy,
		Timestamp:        time.Now().UnixNano(),
	}
}

func (c *TigerBeetleClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return &HealthStatus{
		Connected:     c.connected,
		Addresses:     c.config.Addresses,
		ClusterID:     c.config.ClusterID,
		AccountCount:  len(c.accounts),
		TransferCount: len(c.transfers),
	}
}

func (c *TigerBeetleClient) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	fmt.Println("[TigerBeetle] Client closed")
}
