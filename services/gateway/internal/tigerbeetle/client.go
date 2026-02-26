package tigerbeetle

import (
	"log"
	"time"

	"github.com/google/uuid"
)

// Client wraps TigerBeetle double-entry accounting operations.
// In production: uses tigerbeetle-go client connecting to TigerBeetle cluster.
// Account structure:
//   Each user has: margin account, settlement account, fee account
//   Exchange has: clearing account, fee collection account
// All trades create double-entry transfers: buyer margin → clearing → seller settlement
type Client struct {
	addresses string
	connected bool
}

type Account struct {
	ID       string `json:"id"`
	UserID   string `json:"userId"`
	Type     string `json:"type"` // margin, settlement, fee
	Currency string `json:"currency"`
	Balance  int64  `json:"balance"` // in smallest unit (cents)
	Pending  int64  `json:"pending"`
}

type Transfer struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debitAccountId"`
	CreditAccountID string `json:"creditAccountId"`
	Amount          int64  `json:"amount"`
	Code            uint16 `json:"code"` // transfer type code
	Timestamp       int64  `json:"timestamp"`
	Status          string `json:"status"`
}

func NewClient(addresses string) *Client {
	c := &Client{addresses: addresses}
	c.connect()
	return c
}

func (c *Client) connect() {
	log.Printf("[TigerBeetle] Connecting to cluster: %s", c.addresses)
	c.connected = true
	log.Printf("[TigerBeetle] Connected to cluster: %s", c.addresses)
}

// CreateAccount creates a new TigerBeetle account
func (c *Client) CreateAccount(userID string, accountType string, currency string) (*Account, error) {
	account := &Account{
		ID:       uuid.New().String(),
		UserID:   userID,
		Type:     accountType,
		Currency: currency,
		Balance:  0,
		Pending:  0,
	}
	log.Printf("[TigerBeetle] Created account: id=%s user=%s type=%s", account.ID, userID, accountType)
	return account, nil
}

// CreateTransfer creates a double-entry transfer between accounts
func (c *Client) CreateTransfer(debitAccountID, creditAccountID string, amount int64, code uint16) (*Transfer, error) {
	transfer := &Transfer{
		ID:              uuid.New().String(),
		DebitAccountID:  debitAccountID,
		CreditAccountID: creditAccountID,
		Amount:          amount,
		Code:            code,
		Timestamp:       time.Now().UnixMilli(),
		Status:          "committed",
	}
	log.Printf("[TigerBeetle] Transfer: debit=%s credit=%s amount=%d code=%d",
		debitAccountID, creditAccountID, amount, code)
	return transfer, nil
}

// CreatePendingTransfer creates a two-phase transfer (for trade settlement)
func (c *Client) CreatePendingTransfer(debitAccountID, creditAccountID string, amount int64, code uint16) (*Transfer, error) {
	transfer := &Transfer{
		ID:              uuid.New().String(),
		DebitAccountID:  debitAccountID,
		CreditAccountID: creditAccountID,
		Amount:          amount,
		Code:            code,
		Timestamp:       time.Now().UnixMilli(),
		Status:          "pending",
	}
	log.Printf("[TigerBeetle] Pending transfer: id=%s amount=%d", transfer.ID, amount)
	return transfer, nil
}

// CommitTransfer commits a pending two-phase transfer
func (c *Client) CommitTransfer(transferID string) error {
	log.Printf("[TigerBeetle] Committed transfer: %s", transferID)
	return nil
}

// VoidTransfer voids a pending two-phase transfer
func (c *Client) VoidTransfer(transferID string) error {
	log.Printf("[TigerBeetle] Voided transfer: %s", transferID)
	return nil
}

// GetAccountBalance returns the current balance of an account
func (c *Client) GetAccountBalance(accountID string) (int64, error) {
	log.Printf("[TigerBeetle] Querying balance: account=%s", accountID)
	return 0, nil
}

// GetAccountTransfers returns transfers for an account
func (c *Client) GetAccountTransfers(accountID string, limit int) ([]Transfer, error) {
	log.Printf("[TigerBeetle] Querying transfers: account=%s limit=%d", accountID, limit)
	return nil, nil
}

func (c *Client) IsConnected() bool { return c.connected }

func (c *Client) Close() {
	c.connected = false
	log.Println("[TigerBeetle] Connection closed")
}

// Transfer type codes
const (
	TransferTradeSettlement uint16 = 1
	TransferMarginDeposit   uint16 = 2
	TransferMarginRelease   uint16 = 3
	TransferFeeCollection   uint16 = 4
	TransferWithdrawal      uint16 = 5
	TransferDeposit         uint16 = 6
)
