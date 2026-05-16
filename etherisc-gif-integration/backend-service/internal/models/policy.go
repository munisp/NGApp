package models

import (
	"time"
)

// BlockchainPolicy represents a parametric insurance policy on blockchain
type BlockchainPolicy struct {
	ID              int64     `json:"id" db:"id"`
	PolicyID        []byte    `json:"policy_id" db:"policy_id"`
	CustomerID      string    `json:"customer_id" db:"customer_id"`
	CustomerAddress string    `json:"customer_address" db:"customer_address"`
	ProductType     string    `json:"product_type" db:"product_type"`
	CoverageAmount  int64     `json:"coverage_amount" db:"coverage_amount"`
	Premium         int64     `json:"premium" db:"premium"`
	StartTime       time.Time `json:"start_time" db:"start_time"`
	EndTime         time.Time `json:"end_time" db:"end_time"`
	Active          bool      `json:"active" db:"active"`
	Claimed         bool      `json:"claimed" db:"claimed"`

	// Flight-specific fields
	FlightNumber      *string    `json:"flight_number,omitempty" db:"flight_number"`
	DepartureTime     *time.Time `json:"departure_time,omitempty" db:"departure_time"`
	DelayThreshold    *int       `json:"delay_threshold,omitempty" db:"delay_threshold"`
	DepartureAirport  *string    `json:"departure_airport,omitempty" db:"departure_airport"`
	ArrivalAirport    *string    `json:"arrival_airport,omitempty" db:"arrival_airport"`
	PayoutPercentage  *int       `json:"payout_percentage,omitempty" db:"payout_percentage"`

	// Blockchain fields
	BlockchainTxHash *string `json:"blockchain_tx_hash,omitempty" db:"blockchain_tx_hash"`
	BlockNumber      *int64  `json:"block_number,omitempty" db:"block_number"`
	ContractAddress  *string `json:"contract_address,omitempty" db:"contract_address"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// BlockchainClaim represents a claim on a blockchain policy
type BlockchainClaim struct {
	ID              int64     `json:"id" db:"id"`
	ClaimID         []byte    `json:"claim_id" db:"claim_id"`
	PolicyID        []byte    `json:"policy_id" db:"policy_id"`
	CustomerAddress string    `json:"customer_address" db:"customer_address"`
	PayoutAmount    int64     `json:"payout_amount" db:"payout_amount"`
	ClaimReason     *string   `json:"claim_reason,omitempty" db:"claim_reason"`

	// Flight-specific fields
	ActualDepartureTime *time.Time `json:"actual_departure_time,omitempty" db:"actual_departure_time"`
	DelayMinutes        *int       `json:"delay_minutes,omitempty" db:"delay_minutes"`

	// Blockchain fields
	BlockchainTxHash *string `json:"blockchain_tx_hash,omitempty" db:"blockchain_tx_hash"`
	BlockNumber      *int64  `json:"block_number,omitempty" db:"block_number"`

	// Status
	Status string `json:"status" db:"status"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// BlockchainTransaction represents a blockchain transaction
type BlockchainTransaction struct {
	ID             int64     `json:"id" db:"id"`
	TxHash         string    `json:"tx_hash" db:"tx_hash"`
	FromAddress    string    `json:"from_address" db:"from_address"`
	ToAddress      string    `json:"to_address" db:"to_address"`
	Value          int64     `json:"value" db:"value"`
	GasUsed        *int64    `json:"gas_used,omitempty" db:"gas_used"`
	GasPrice       *int64    `json:"gas_price,omitempty" db:"gas_price"`
	BlockNumber    *int64    `json:"block_number,omitempty" db:"block_number"`
	BlockTimestamp *time.Time `json:"block_timestamp,omitempty" db:"block_timestamp"`

	// Transaction type
	TxType string `json:"tx_type" db:"tx_type"`

	// Related entities
	PolicyID *[]byte `json:"policy_id,omitempty" db:"policy_id"`
	ClaimID  *[]byte `json:"claim_id,omitempty" db:"claim_id"`

	// Status
	Status string `json:"status" db:"status"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// BlockchainWallet represents a customer's blockchain wallet
type BlockchainWallet struct {
	ID                  int64      `json:"id" db:"id"`
	CustomerID          string     `json:"customer_id" db:"customer_id"`
	WalletAddress       string     `json:"wallet_address" db:"wallet_address"`
	EncryptedPrivateKey string     `json:"-" db:"encrypted_private_key"` // Never expose in JSON
	PublicKey           string     `json:"public_key" db:"public_key"`

	// Balance tracking
	Balance           int64      `json:"balance" db:"balance"`
	LastBalanceUpdate *time.Time `json:"last_balance_update,omitempty" db:"last_balance_update"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// RiskPool represents a blockchain risk pool
type RiskPool struct {
	ID               int64     `json:"id" db:"id"`
	PoolAddress      string    `json:"pool_address" db:"pool_address"`
	ProductType      string    `json:"product_type" db:"product_type"`
	TotalCapital     int64     `json:"total_capital" db:"total_capital"`
	AvailableCapital int64     `json:"available_capital" db:"available_capital"`
	LockedCapital    int64     `json:"locked_capital" db:"locked_capital"`
	TotalPremiums    int64     `json:"total_premiums" db:"total_premiums"`
	TotalPayouts     int64     `json:"total_payouts" db:"total_payouts"`
	MinCapital       int64     `json:"min_capital" db:"min_capital"`
	Active           bool      `json:"active" db:"active"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// OracleData represents data submitted to oracle
type OracleData struct {
	ID       int64  `json:"id" db:"id"`
	DataID   []byte `json:"data_id" db:"data_id"`
	DataType string `json:"data_type" db:"data_type"`
	DataPayload map[string]interface{} `json:"data_payload" db:"data_payload"`

	// Flight-specific fields
	FlightNumber            *string    `json:"flight_number,omitempty" db:"flight_number"`
	ScheduledDepartureTime  *time.Time `json:"scheduled_departure_time,omitempty" db:"scheduled_departure_time"`
	ActualDepartureTime     *time.Time `json:"actual_departure_time,omitempty" db:"actual_departure_time"`
	DelayMinutes            *int       `json:"delay_minutes,omitempty" db:"delay_minutes"`

	// Weather-specific fields
	Location    *string  `json:"location,omitempty" db:"location"`
	Temperature *float64 `json:"temperature,omitempty" db:"temperature"`
	Rainfall    *float64 `json:"rainfall,omitempty" db:"rainfall"`
	Humidity    *float64 `json:"humidity,omitempty" db:"humidity"`

	// Blockchain fields
	BlockchainTxHash *string `json:"blockchain_tx_hash,omitempty" db:"blockchain_tx_hash"`
	BlockNumber      *int64  `json:"block_number,omitempty" db:"block_number"`
	Verified         bool    `json:"verified" db:"verified"`
	SubmitterAddress *string `json:"submitter_address,omitempty" db:"submitter_address"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// PaymentGatewayTransaction represents a fiat-to-crypto payment
type PaymentGatewayTransaction struct {
	ID            int64   `json:"id" db:"id"`
	TransactionID string  `json:"transaction_id" db:"transaction_id"`
	CustomerID    string  `json:"customer_id" db:"customer_id"`
	PolicyID      *[]byte `json:"policy_id,omitempty" db:"policy_id"`

	// Fiat payment
	FiatAmount       int64   `json:"fiat_amount" db:"fiat_amount"`
	FiatCurrency     string  `json:"fiat_currency" db:"fiat_currency"`
	PaymentMethod    *string `json:"payment_method,omitempty" db:"payment_method"`
	PaymentReference *string `json:"payment_reference,omitempty" db:"payment_reference"`
	PaymentStatus    string  `json:"payment_status" db:"payment_status"`

	// Crypto conversion
	CryptoAmount   *int64   `json:"crypto_amount,omitempty" db:"crypto_amount"`
	CryptoCurrency *string  `json:"crypto_currency,omitempty" db:"crypto_currency"`
	ExchangeRate   *float64 `json:"exchange_rate,omitempty" db:"exchange_rate"`

	// Blockchain transaction
	BlockchainTxHash *string `json:"blockchain_tx_hash,omitempty" db:"blockchain_tx_hash"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreatePolicyRequest represents a request to create a blockchain policy
type CreatePolicyRequest struct {
	CustomerID     string  `json:"customer_id" binding:"required"`
	ProductType    string  `json:"product_type" binding:"required"`
	CoverageAmount int64   `json:"coverage_amount" binding:"required"`
	Duration       int64   `json:"duration" binding:"required"` // in seconds

	// Flight-specific fields
	FlightNumber     *string `json:"flight_number,omitempty"`
	DepartureTime    *string `json:"departure_time,omitempty"` // RFC3339 format
	DelayThreshold   *int    `json:"delay_threshold,omitempty"`
	DepartureAirport *string `json:"departure_airport,omitempty"`
	ArrivalAirport   *string `json:"arrival_airport,omitempty"`
}

// CreatePolicyResponse represents the response after creating a policy
type CreatePolicyResponse struct {
	PolicyID         string `json:"policy_id"`
	Premium          int64  `json:"premium"`
	BlockchainTxHash string `json:"blockchain_tx_hash"`
	PaymentURL       string `json:"payment_url"`
}
