package models

import "time"

type TransactionType string

const (
	TxPremiumPayment TransactionType = "premium_payment"
	TxClaimPayout    TransactionType = "claim_payout"
	TxPolicyCreation TransactionType = "policy_creation"
	TxPolicyRenewal  TransactionType = "policy_renewal"
	TxRefund         TransactionType = "refund"
	TxCommission     TransactionType = "commission"
)

type Block struct {
	Index        int64         `json:"index"`
	Timestamp    time.Time     `json:"timestamp"`
	Hash         string        `json:"hash"`
	PreviousHash string        `json:"previous_hash"`
	Nonce        int64         `json:"nonce"`
	Transactions []Transaction `json:"transactions"`
	MerkleRoot   string        `json:"merkle_root"`
}

type Transaction struct {
	ID          string          `json:"id"`
	Type        TransactionType `json:"type"`
	PolicyID    string          `json:"policy_id"`
	ClaimID     string          `json:"claim_id,omitempty"`
	FromAddress string          `json:"from_address"`
	ToAddress   string          `json:"to_address"`
	Amount      float64         `json:"amount"`
	Currency    string          `json:"currency"`
	Status      string          `json:"status"`
	BlockHash   string          `json:"block_hash,omitempty"`
	BlockIndex  int64           `json:"block_index,omitempty"`
	Data        string          `json:"data,omitempty"`
	Signature   string          `json:"signature"`
	CreatedAt   time.Time       `json:"created_at"`
	ConfirmedAt *time.Time      `json:"confirmed_at,omitempty"`
}

type AuditRecord struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	Action        string    `json:"action"`
	Actor         string    `json:"actor"`
	Details       string    `json:"details"`
	IPAddress     string    `json:"ip_address"`
	Timestamp     time.Time `json:"timestamp"`
	Hash          string    `json:"hash"`
}

type ChainStats struct {
	TotalBlocks       int64   `json:"total_blocks"`
	TotalTransactions int64   `json:"total_transactions"`
	TotalValue        float64 `json:"total_value"`
	PendingTx         int     `json:"pending_transactions"`
	ChainValid        bool    `json:"chain_valid"`
	LastBlockHash     string  `json:"last_block_hash"`
	LastBlockTime     string  `json:"last_block_time"`
}
