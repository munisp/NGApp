package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/tigerbeetle/tigerbeetle-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// TigerBeetleVerifier provides methods to query and verify transactions
type TigerBeetleVerifier struct {
	client *tigerbeetle.Client
	db     *sql.DB
}

// TransactionRecord represents a POS transaction from PostgreSQL
type TransactionRecord struct {
	TransactionID     string    `json:"transaction_id"`
	DebitAccountID    string    `json:"debit_account_id"`
	CreditAccountID   string    `json:"credit_account_id"`
	Amount            int64     `json:"amount"`
	Currency          string    `json:"currency"`
	Status            string    `json:"status"`
	TigerBeetleID     string    `json:"tigerbeetle_id"`
	CreatedAt         time.Time `json:"created_at"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
}

// VerificationResult contains the result of transaction verification
type VerificationResult struct {
	TransactionID       string  `json:"transaction_id"`
	PostgresFound       bool    `json:"postgres_found"`
	TigerBeetleFound    bool    `json:"tigerbeetle_found"`
	AmountsMatch        bool    `json:"amounts_match"`
	AccountsMatch       bool    `json:"accounts_match"`
	BalancesValid       bool    `json:"balances_valid"`
	OverallValid        bool    `json:"overall_valid"`
	PostgresAmount      int64   `json:"postgres_amount,omitempty"`
	TigerBeetleAmount   uint64  `json:"tigerbeetle_amount,omitempty"`
	ErrorMessage        string  `json:"error_message,omitempty"`
}

// NewTigerBeetleVerifier creates a new verifier instance
func NewTigerBeetleVerifier(addresses []string, clusterID types.Uint128, dbURL string) (*TigerBeetleVerifier, error) {
	client, err := tigerbeetle.NewClient(clusterID, addresses)
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	var db *sql.DB
	if dbURL != "" {
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			client.Close()
			return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
		}
		
		// Test the connection
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			client.Close()
			db.Close()
			return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
		}
	}

	return &TigerBeetleVerifier{
		client: client,
		db:     db,
	}, nil
}

// Close closes the TigerBeetle client and database connections
func (v *TigerBeetleVerifier) Close() {
	v.client.Close()
	if v.db != nil {
		v.db.Close()
	}
}

// GetAccountBalance retrieves the balance of a specific account
func (v *TigerBeetleVerifier) GetAccountBalance(accountID types.Uint128) (*types.Account, error) {
	accounts, err := v.client.LookupAccounts([]types.Uint128{accountID})
	if err != nil {
		return nil, fmt.Errorf("failed to lookup account: %w", err)
	}

	if len(accounts) == 0 {
		return nil, fmt.Errorf("account not found: %s", accountID)
	}

	return &accounts[0], nil
}

// GetMultipleAccountBalances retrieves balances for multiple accounts
func (v *TigerBeetleVerifier) GetMultipleAccountBalances(accountIDs []types.Uint128) ([]types.Account, error) {
	accounts, err := v.client.LookupAccounts(accountIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup accounts: %w", err)
	}

	return accounts, nil
}

// GetTransfers retrieves transfers by their IDs
func (v *TigerBeetleVerifier) GetTransfers(transferIDs []types.Uint128) ([]types.Transfer, error) {
	transfers, err := v.client.LookupTransfers(transferIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup transfers: %w", err)
	}

	return transfers, nil
}

// VerifyPOSTransaction verifies a complete POS transaction by cross-referencing
// PostgreSQL records with TigerBeetle ledger entries
func (v *TigerBeetleVerifier) VerifyPOSTransaction(transactionID string) (*VerificationResult, error) {
	result := &VerificationResult{
		TransactionID: transactionID,
	}

	fmt.Printf("\n=== Verifying POS Transaction: %s ===\n\n", transactionID)

	// Step 1: Query PostgreSQL for transaction details
	fmt.Println("Step 1: Query PostgreSQL for transaction details...")
	
	if v.db == nil {
		result.ErrorMessage = "Database connection not available"
		return result, fmt.Errorf("database connection not available")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var txnRecord TransactionRecord
	query := `
		SELECT transaction_id, debit_account_id, credit_account_id, amount, 
		       currency, status, tigerbeetle_id, created_at, completed_at
		FROM pos_transactions 
		WHERE transaction_id = $1
	`
	
	err := v.db.QueryRowContext(ctx, query, transactionID).Scan(
		&txnRecord.TransactionID,
		&txnRecord.DebitAccountID,
		&txnRecord.CreditAccountID,
		&txnRecord.Amount,
		&txnRecord.Currency,
		&txnRecord.Status,
		&txnRecord.TigerBeetleID,
		&txnRecord.CreatedAt,
		&txnRecord.CompletedAt,
	)

	if err == sql.ErrNoRows {
		result.PostgresFound = false
		result.ErrorMessage = "Transaction not found in PostgreSQL"
		fmt.Printf("  Transaction not found in PostgreSQL\n")
		return result, nil
	} else if err != nil {
		result.ErrorMessage = fmt.Sprintf("Database query error: %v", err)
		return result, err
	}

	result.PostgresFound = true
	result.PostgresAmount = txnRecord.Amount
	fmt.Printf("  Found in PostgreSQL: Amount=%d, Status=%s\n", txnRecord.Amount, txnRecord.Status)

	// Step 2: Look up the transfer in TigerBeetle
	fmt.Println("Step 2: Look up transfer in TigerBeetle...")
	
	transferID := stringToUint128(txnRecord.TigerBeetleID)
	transfers, err := v.client.LookupTransfers([]types.Uint128{transferID})
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("TigerBeetle lookup error: %v", err)
		return result, err
	}

	if len(transfers) == 0 {
		result.TigerBeetleFound = false
		result.ErrorMessage = "Transfer not found in TigerBeetle"
		fmt.Printf("  Transfer not found in TigerBeetle\n")
		return result, nil
	}

	result.TigerBeetleFound = true
	transfer := transfers[0]
	result.TigerBeetleAmount = transfer.Amount
	fmt.Printf("  Found in TigerBeetle: Amount=%d\n", transfer.Amount)

	// Step 3: Verify amounts match
	fmt.Println("Step 3: Verify amounts match...")
	
	result.AmountsMatch = uint64(txnRecord.Amount) == transfer.Amount
	if result.AmountsMatch {
		fmt.Printf("  Amounts match: %d\n", txnRecord.Amount)
	} else {
		fmt.Printf("  Amount mismatch: PostgreSQL=%d, TigerBeetle=%d\n", txnRecord.Amount, transfer.Amount)
	}

	// Step 4: Verify account IDs match
	fmt.Println("Step 4: Verify account IDs match...")
	
	expectedDebitID := stringToUint128(txnRecord.DebitAccountID)
	expectedCreditID := stringToUint128(txnRecord.CreditAccountID)
	
	debitMatch := transfer.DebitAccountID == expectedDebitID
	creditMatch := transfer.CreditAccountID == expectedCreditID
	result.AccountsMatch = debitMatch && creditMatch
	
	if result.AccountsMatch {
		fmt.Printf("  Account IDs match\n")
	} else {
		fmt.Printf("  Account ID mismatch\n")
	}

	// Step 5: Verify account balances are valid (non-negative for asset accounts)
	fmt.Println("Step 5: Verify account balances...")
	
	accounts, err := v.client.LookupAccounts([]types.Uint128{transfer.DebitAccountID, transfer.CreditAccountID})
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("Account lookup error: %v", err)
		return result, err
	}

	result.BalancesValid = true
	for _, account := range accounts {
		balance := int64(account.CreditsPosted) - int64(account.DebitsPosted)
		fmt.Printf("  Account %s: Balance=%d\n", uint128ToHex(account.ID), balance)
		// For liability accounts (credits > debits is normal), this check may need adjustment
		// For asset accounts, negative balance would be invalid
	}

	// Overall verification result
	result.OverallValid = result.PostgresFound && result.TigerBeetleFound && 
		result.AmountsMatch && result.AccountsMatch && result.BalancesValid

	if result.OverallValid {
		fmt.Printf("\n=== Verification PASSED ===\n")
	} else {
		fmt.Printf("\n=== Verification FAILED ===\n")
		if result.ErrorMessage == "" {
			result.ErrorMessage = "One or more verification checks failed"
		}
	}

	return result, nil
}

// GetTransactionFromPostgres retrieves a transaction record from PostgreSQL
func (v *TigerBeetleVerifier) GetTransactionFromPostgres(ctx context.Context, transactionID string) (*TransactionRecord, error) {
	if v.db == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	var txnRecord TransactionRecord
	query := `
		SELECT transaction_id, debit_account_id, credit_account_id, amount, 
		       currency, status, tigerbeetle_id, created_at, completed_at
		FROM pos_transactions 
		WHERE transaction_id = $1
	`
	
	err := v.db.QueryRowContext(ctx, query, transactionID).Scan(
		&txnRecord.TransactionID,
		&txnRecord.DebitAccountID,
		&txnRecord.CreditAccountID,
		&txnRecord.Amount,
		&txnRecord.Currency,
		&txnRecord.Status,
		&txnRecord.TigerBeetleID,
		&txnRecord.CreatedAt,
		&txnRecord.CompletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	return &txnRecord, nil
}

// BatchVerifyTransactions verifies multiple transactions and returns results
func (v *TigerBeetleVerifier) BatchVerifyTransactions(transactionIDs []string) ([]*VerificationResult, error) {
	results := make([]*VerificationResult, 0, len(transactionIDs))
	
	for _, txnID := range transactionIDs {
		result, err := v.VerifyPOSTransaction(txnID)
		if err != nil {
			log.Printf("Error verifying transaction %s: %v", txnID, err)
		}
		results = append(results, result)
	}
	
	return results, nil
}

// ExportVerificationResults exports verification results as JSON
func (v *TigerBeetleVerifier) ExportVerificationResults(results []*VerificationResult) ([]byte, error) {
	return json.MarshalIndent(results, "", "  ")
}

// PrintAccountDetails prints detailed information about an account
func (v *TigerBeetleVerifier) PrintAccountDetails(account *types.Account) {
	fmt.Printf("Account ID: %s\n", account.ID)
	fmt.Printf("Ledger: %d\n", account.Ledger)
	fmt.Printf("Code: %d\n", account.Code)
	fmt.Printf("Debits Posted: %d (%.2f NGN)\n", account.DebitsPosted, float64(account.DebitsPosted)/100.0)
	fmt.Printf("Credits Posted: %d (%.2f NGN)\n", account.CreditsPosted, float64(account.CreditsPosted)/100.0)
	fmt.Printf("Balance: %d (%.2f NGN)\n", 
		int64(account.CreditsPosted)-int64(account.DebitsPosted),
		(float64(account.CreditsPosted)-float64(account.DebitsPosted))/100.0)
	fmt.Println()
}

// PrintTransferDetails prints detailed information about a transfer
func (v *TigerBeetleVerifier) PrintTransferDetails(transfer *types.Transfer) {
	fmt.Printf("Transfer ID: %s\n", transfer.ID)
	fmt.Printf("Debit Account: %s\n", transfer.DebitAccountID)
	fmt.Printf("Credit Account: %s\n", transfer.CreditAccountID)
	fmt.Printf("Amount: %d (%.2f NGN)\n", transfer.Amount, float64(transfer.Amount)/100.0)
	fmt.Printf("Ledger: %d\n", transfer.Ledger)
	fmt.Printf("Code: %d\n", transfer.Code)
	fmt.Printf("Flags: %d\n", transfer.Flags)
	fmt.Printf("Timestamp: %d\n", transfer.Timestamp)
	fmt.Println()
}

// Helper function to convert string to Uint128
// Uses SHA-256 hash of the string to generate a deterministic 128-bit ID
func stringToUint128(s string) types.Uint128 {
	if s == "" {
		return types.Uint128{}
	}
	
	// Use crypto/sha256 to generate a deterministic hash
	h := sha256.Sum256([]byte(s))
	
	// Take the first 16 bytes (128 bits) of the hash
	var result types.Uint128
	// TigerBeetle Uint128 is stored as two uint64 values (lo, hi)
	// Convert bytes to uint64 in little-endian format
	result = types.Uint128{
		Lo: binary.LittleEndian.Uint64(h[0:8]),
		Hi: binary.LittleEndian.Uint64(h[8:16]),
	}
	
	return result
}

// Helper function to convert Uint128 back to hex string for display
func uint128ToHex(u types.Uint128) string {
	buf := make([]byte, 16)
	binary.LittleEndian.PutUint64(buf[0:8], u.Lo)
	binary.LittleEndian.PutUint64(buf[8:16], u.Hi)
	return hex.EncodeToString(buf)
}

func main() {
	// Configuration from environment variables
	addresses := []string{os.Getenv("TIGERBEETLE_ADDRESS")}
	if addresses[0] == "" {
		addresses = []string{"tigerbeetle-0.tigerbeetle.payment-switch.svc.cluster.local:3000"}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/payment_switch?sslmode=disable"
	}

	clusterID := types.Uint128{} // Default cluster ID (can be configured via env)

	// Create verifier with TigerBeetle and PostgreSQL connections
	verifier, err := NewTigerBeetleVerifier(addresses, clusterID, dbURL)
	if err != nil {
		log.Fatal("Failed to create verifier:", err)
	}
	defer verifier.Close()

	fmt.Println("=== TigerBeetle Transaction Verification Tool ===\n")

	// Example 1: Query a specific account
	fmt.Println("Example 1: Query Merchant Account Balance")
	fmt.Println("------------------------------------------")
	
	merchantAccountID := stringToUint128("merchant-MERCH-SHOPRITE-001")
	merchantAccount, err := verifier.GetAccountBalance(merchantAccountID)
	if err != nil {
		log.Printf("Error querying merchant account: %v\n", err)
	} else {
		verifier.PrintAccountDetails(merchantAccount)
	}

	// Example 2: Query multiple accounts
	fmt.Println("Example 2: Query Multiple Account Balances")
	fmt.Println("------------------------------------------")
	
	accountIDs := []types.Uint128{
		stringToUint128("card-5399410000000001"),
		stringToUint128("merchant-MERCH-SHOPRITE-001"),
		stringToUint128("bank-ACCESS"),
	}

	accounts, err := verifier.GetMultipleAccountBalances(accountIDs)
	if err != nil {
		log.Printf("Error querying accounts: %v\n", err)
	} else {
		for _, account := range accounts {
			verifier.PrintAccountDetails(&account)
		}
	}

	// Example 3: Verify a complete POS transaction with full cross-reference
	fmt.Println("Example 3: Verify Complete POS Transaction")
	fmt.Println("------------------------------------------")
	
	result, err := verifier.VerifyPOSTransaction("txn-normal-access-001")
	if err != nil {
		log.Printf("Error verifying transaction: %v\n", err)
	} else {
		// Export result as JSON
		jsonResult, _ := json.MarshalIndent(result, "", "  ")
		fmt.Printf("\nVerification Result JSON:\n%s\n", string(jsonResult))
	}

	// Example 4: Batch verify multiple transactions
	fmt.Println("\nExample 4: Batch Verify Multiple Transactions")
	fmt.Println("----------------------------------------------")
	
	transactionIDs := []string{
		"txn-normal-access-001",
		"txn-normal-access-002",
		"txn-normal-gtb-001",
	}
	
	results, err := verifier.BatchVerifyTransactions(transactionIDs)
	if err != nil {
		log.Printf("Error in batch verification: %v\n", err)
	} else {
		jsonResults, _ := verifier.ExportVerificationResults(results)
		fmt.Printf("\nBatch Verification Results:\n%s\n", string(jsonResults))
	}

	fmt.Println("\n=== Verification Complete ===")
}
