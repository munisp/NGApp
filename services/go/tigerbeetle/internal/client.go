package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	tbOpsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "tigerbeetle_operations_total",
		Help: "Total TigerBeetle operations",
	}, []string{"operation"})
	tbLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "tigerbeetle_operation_latency_seconds",
		Help:    "TigerBeetle operation latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation"})
	tbTransferTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "tigerbeetle_transfers_total",
		Help: "Total transfers processed",
	})
	tbLedgerBalance = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "tigerbeetle_ledger_balance",
		Help: "Current ledger balance",
	}, []string{"ledger", "type"})
)

type Account struct {
	ID             string `json:"id"`
	UserID         string `json:"user_id"`
	Ledger         uint32 `json:"ledger"`
	Code           uint16 `json:"code"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPosted  uint64 `json:"credits_posted"`
	DebitsPending  uint64 `json:"debits_pending"`
	CreditsPending uint64 `json:"credits_pending"`
	Flags          uint16 `json:"flags"`
	CreatedAt      int64  `json:"created_at"`
}

type Transfer struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	PendingID       string `json:"pending_id,omitempty"`
	Flags           uint16 `json:"flags"`
	Timestamp       int64  `json:"timestamp"`
	Status          string `json:"status"`
}

type CreateAccountRequest struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
	Ledger uint32 `json:"ledger"`
	Code   uint16 `json:"code"`
}

type CreateTransferRequest struct {
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
}

type TwoPhaseRequest struct {
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
}

type ReconciliationResult struct {
	TotalAccounts    int                `json:"total_accounts"`
	TotalTransfers   int                `json:"total_transfers"`
	Balanced         bool               `json:"balanced"`
	TotalDebits      uint64             `json:"total_debits"`
	TotalCredits     uint64             `json:"total_credits"`
	Discrepancies    []string           `json:"discrepancies"`
	LedgerBalances   map[string]int64   `json:"ledger_balances"`
	ReconcileTime    string             `json:"reconcile_time"`
}

type LedgerMetrics struct {
	TotalAccounts  int            `json:"total_accounts"`
	TotalTransfers int            `json:"total_transfers"`
	PendingCount   int            `json:"pending_transfers"`
	TotalDebits    uint64         `json:"total_debits"`
	TotalCredits   uint64         `json:"total_credits"`
	LedgerTotals   map[string]uint64 `json:"ledger_totals"`
}

type HealthStatus struct {
	Connected    bool     `json:"connected"`
	Addresses    []string `json:"addresses"`
	ClusterID    uint64   `json:"cluster_id"`
	AccountCount int      `json:"account_count"`
	TransferCount int     `json:"transfer_count"`
}

type TigerBeetleClient struct {
	config     *Config
	httpClient *http.Client
	connected  bool
	mu         sync.RWMutex
	accounts   map[string]*Account
	transfers  []*Transfer
	pending    map[string]*Transfer
}

func NewTigerBeetleClient(cfg *Config) (*TigerBeetleClient, error) {
	client := &TigerBeetleClient{
		config:     cfg,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		accounts:   make(map[string]*Account),
		pending:    make(map[string]*Transfer),
	}

	if err := client.checkConnection(); err != nil {
		fmt.Printf("[TigerBeetle] Connection failed (will retry): %v\n", err)
		client.connected = false
	} else {
		client.connected = true
	}

	fmt.Printf("[TigerBeetle] Initialized with addresses: %v (cluster: %d)\n",
		cfg.Addresses, cfg.ClusterID)
	go client.healthCheckLoop()
	return client, nil
}

func (c *TigerBeetleClient) checkConnection() error {
	addr := c.config.Addresses[0]
	url := fmt.Sprintf("http://%s/health", addr)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *TigerBeetleClient) healthCheckLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		err := c.checkConnection()
		c.mu.Lock()
		c.connected = (err == nil)
		c.mu.Unlock()
	}
}

func (c *TigerBeetleClient) tbRequest(method, path string, body interface{}) ([]byte, error) {
	start := time.Now()
	defer func() { tbLatency.WithLabelValues(method).Observe(time.Since(start).Seconds()) }()

	addr := c.config.Addresses[0]
	var bodyReader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(data)
	}
	url := fmt.Sprintf("http://%s%s", addr, path)
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (c *TigerBeetleClient) CreateAccount(req CreateAccountRequest) (*Account, error) {
	start := time.Now()
	defer func() { tbLatency.WithLabelValues("create_account").Observe(time.Since(start).Seconds()) }()
	tbOpsTotal.WithLabelValues("create_account").Inc()

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.accounts[req.ID]; exists {
		return nil, fmt.Errorf("account %s already exists", req.ID)
	}

	account := &Account{
		ID:        req.ID,
		UserID:    req.UserID,
		Ledger:    req.Ledger,
		Code:      req.Code,
		CreatedAt: time.Now().UnixMilli(),
	}

	if c.connected {
		_, err := c.tbRequest("POST", "/accounts", account)
		if err != nil {
			fmt.Printf("[TigerBeetle] Remote create_account failed, storing locally: %v\n", err)
		}
	}

	c.accounts[req.ID] = account
	tbLedgerBalance.WithLabelValues(fmt.Sprintf("%d", req.Ledger), "accounts").Inc()
	return account, nil
}

func (c *TigerBeetleClient) GetAccount(id string) (*Account, error) {
	tbOpsTotal.WithLabelValues("get_account").Inc()
	c.mu.RLock()
	defer c.mu.RUnlock()
	if acc, ok := c.accounts[id]; ok {
		return acc, nil
	}
	return nil, fmt.Errorf("account %s not found", id)
}

func (c *TigerBeetleClient) CreateTransfer(req CreateTransferRequest) (*Transfer, error) {
	start := time.Now()
	defer func() { tbLatency.WithLabelValues("create_transfer").Observe(time.Since(start).Seconds()) }()
	tbOpsTotal.WithLabelValues("create_transfer").Inc()
	tbTransferTotal.Inc()

	c.mu.Lock()
	defer c.mu.Unlock()

	debitAcc, ok := c.accounts[req.DebitAccountID]
	if !ok {
		return nil, fmt.Errorf("debit account %s not found", req.DebitAccountID)
	}
	creditAcc, ok := c.accounts[req.CreditAccountID]
	if !ok {
		return nil, fmt.Errorf("credit account %s not found", req.CreditAccountID)
	}

	transfer := &Transfer{
		ID:              fmt.Sprintf("tx-%d", time.Now().UnixNano()),
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Amount:          req.Amount,
		Ledger:          req.Ledger,
		Code:            req.Code,
		Timestamp:       time.Now().UnixMilli(),
		Status:          "posted",
	}

	debitAcc.DebitsPosted += req.Amount
	creditAcc.CreditsPosted += req.Amount

	if c.connected {
		c.tbRequest("POST", "/transfers", transfer)
	}

	c.transfers = append(c.transfers, transfer)
	tbLedgerBalance.WithLabelValues(fmt.Sprintf("%d", req.Ledger), "debits").Add(float64(req.Amount))
	tbLedgerBalance.WithLabelValues(fmt.Sprintf("%d", req.Ledger), "credits").Add(float64(req.Amount))
	return transfer, nil
}

func (c *TigerBeetleClient) CreateTwoPhaseTransfer(req TwoPhaseRequest) (*Transfer, error) {
	tbOpsTotal.WithLabelValues("two_phase_transfer").Inc()
	c.mu.Lock()
	defer c.mu.Unlock()

	debitAcc, ok := c.accounts[req.DebitAccountID]
	if !ok {
		return nil, fmt.Errorf("debit account %s not found", req.DebitAccountID)
	}

	transfer := &Transfer{
		ID:              fmt.Sprintf("tx-%d", time.Now().UnixNano()),
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Amount:          req.Amount,
		Ledger:          req.Ledger,
		Code:            req.Code,
		Flags:           1,
		Timestamp:       time.Now().UnixMilli(),
		Status:          "pending",
	}

	debitAcc.DebitsPending += req.Amount
	c.pending[transfer.ID] = transfer
	c.transfers = append(c.transfers, transfer)
	return transfer, nil
}

func (c *TigerBeetleClient) ConfirmTransfer(transferID string) error {
	tbOpsTotal.WithLabelValues("confirm_transfer").Inc()
	c.mu.Lock()
	defer c.mu.Unlock()

	transfer, ok := c.pending[transferID]
	if !ok {
		return fmt.Errorf("pending transfer %s not found", transferID)
	}

	debitAcc := c.accounts[transfer.DebitAccountID]
	creditAcc := c.accounts[transfer.CreditAccountID]
	debitAcc.DebitsPending -= transfer.Amount
	debitAcc.DebitsPosted += transfer.Amount
	creditAcc.CreditsPosted += transfer.Amount
	transfer.Status = "posted"
	delete(c.pending, transferID)
	return nil
}

func (c *TigerBeetleClient) VoidTransfer(transferID string) error {
	tbOpsTotal.WithLabelValues("void_transfer").Inc()
	c.mu.Lock()
	defer c.mu.Unlock()

	transfer, ok := c.pending[transferID]
	if !ok {
		return fmt.Errorf("pending transfer %s not found", transferID)
	}

	debitAcc := c.accounts[transfer.DebitAccountID]
	debitAcc.DebitsPending -= transfer.Amount
	transfer.Status = "voided"
	delete(c.pending, transferID)
	return nil
}

func (c *TigerBeetleClient) Reconcile() *ReconciliationResult {
	tbOpsTotal.WithLabelValues("reconcile").Inc()
	c.mu.RLock()
	defer c.mu.RUnlock()

	var totalDebits, totalCredits uint64
	ledgerBalances := make(map[string]int64)

	for _, acc := range c.accounts {
		totalDebits += acc.DebitsPosted
		totalCredits += acc.CreditsPosted
		ledgerKey := fmt.Sprintf("ledger_%d", acc.Ledger)
		ledgerBalances[ledgerKey] += int64(acc.CreditsPosted) - int64(acc.DebitsPosted)
	}

	var discrepancies []string
	balanced := totalDebits == totalCredits
	if !balanced {
		discrepancies = append(discrepancies,
			fmt.Sprintf("imbalance: debits=%d credits=%d diff=%d",
				totalDebits, totalCredits, int64(totalDebits)-int64(totalCredits)))
	}

	return &ReconciliationResult{
		TotalAccounts:  len(c.accounts),
		TotalTransfers: len(c.transfers),
		Balanced:       balanced,
		TotalDebits:    totalDebits,
		TotalCredits:   totalCredits,
		Discrepancies:  discrepancies,
		LedgerBalances: ledgerBalances,
		ReconcileTime:  time.Now().Format(time.RFC3339),
	}
}

func (c *TigerBeetleClient) GetAccountsByUser(userID string) []*Account {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var result []*Account
	for _, acc := range c.accounts {
		if acc.UserID == userID {
			result = append(result, acc)
		}
	}
	return result
}

func (c *TigerBeetleClient) GetTransfersByAccount(accountID string) []*Transfer {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var result []*Transfer
	for _, tx := range c.transfers {
		if tx.DebitAccountID == accountID || tx.CreditAccountID == accountID {
			result = append(result, tx)
		}
	}
	return result
}

func (c *TigerBeetleClient) GetMetrics() *LedgerMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var totalDebits, totalCredits uint64
	ledgerTotals := make(map[string]uint64)
	for _, acc := range c.accounts {
		totalDebits += acc.DebitsPosted
		totalCredits += acc.CreditsPosted
		key := fmt.Sprintf("ledger_%d", acc.Ledger)
		ledgerTotals[key] += acc.CreditsPosted
	}
	return &LedgerMetrics{
		TotalAccounts:  len(c.accounts),
		TotalTransfers: len(c.transfers),
		PendingCount:   len(c.pending),
		TotalDebits:    totalDebits,
		TotalCredits:   totalCredits,
		LedgerTotals:   ledgerTotals,
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

func (c *TigerBeetleClient) LookupAccount(id string) (*Account, error) {
	return c.GetAccount(id)
}

func (c *TigerBeetleClient) GetBalance(accountID string) (*Account, error) {
	return c.GetAccount(accountID)
}

func (c *TigerBeetleClient) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	fmt.Println("[TigerBeetle] Client closed")
}
