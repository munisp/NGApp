package models

import (
	"time"
)

type PayoutStatus string

const (
	PayoutPending    PayoutStatus = "pending"
	PayoutProcessing PayoutStatus = "processing"
	PayoutCompleted  PayoutStatus = "completed"
	PayoutFailed     PayoutStatus = "failed"
	PayoutReversed   PayoutStatus = "reversed"
)

type PayoutChannel string

const (
	ChannelMobileMoney  PayoutChannel = "mobile_money"
	ChannelBankTransfer PayoutChannel = "bank_transfer"
	ChannelWallet       PayoutChannel = "wallet"
	ChannelUSSD         PayoutChannel = "ussd"
)

type Payout struct {
	ID            string        `json:"id"`
	ClaimID       string        `json:"claim_id"`
	PolicyID      string        `json:"policy_id"`
	Amount        float64       `json:"amount"`
	Currency      string        `json:"currency"`
	Channel       PayoutChannel `json:"channel"`
	Status        PayoutStatus  `json:"status"`
	RecipientName string        `json:"recipient_name"`
	AccountRef    string        `json:"account_ref"`
	Provider      string        `json:"provider"`
	Reason        string        `json:"reason"`
	Reference     string        `json:"reference"`
	ProviderRef   string        `json:"provider_ref,omitempty"`
	ErrorMessage  string        `json:"error_message,omitempty"`
	FeeAmount     float64       `json:"fee_amount"`
	NetAmount     float64       `json:"net_amount"`
	ExchangeRate  float64       `json:"exchange_rate,omitempty"`
	EstimatedTime string        `json:"estimated_time"`
	BatchID       string        `json:"batch_id,omitempty"`
	RetryCount    int           `json:"retry_count"`
	MaxRetries    int           `json:"max_retries"`
	CreatedAt     time.Time     `json:"created_at"`
	ProcessedAt   *time.Time    `json:"processed_at,omitempty"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty"`
}

type BatchPayout struct {
	ID          string       `json:"id"`
	Payouts     []Payout     `json:"payouts"`
	TotalAmount float64      `json:"total_amount"`
	Currency    string       `json:"currency"`
	Status      PayoutStatus `json:"status"`
	SuccessCount int         `json:"success_count"`
	FailCount    int         `json:"fail_count"`
	CreatedAt   time.Time    `json:"created_at"`
}

type ChannelConfig struct {
	Channel       PayoutChannel `json:"channel"`
	Provider      string        `json:"provider"`
	IsActive      bool          `json:"is_active"`
	MaxAmount     float64       `json:"max_amount"`
	MinAmount     float64       `json:"min_amount"`
	FeePercent    float64       `json:"fee_percent"`
	FeeFlat       float64       `json:"fee_flat"`
	EstimatedTime string        `json:"estimated_time"`
	Currencies    []string      `json:"currencies"`
}

type PayoutLedgerEntry struct {
	ID        string    `json:"id"`
	PayoutID  string    `json:"payout_id"`
	Action    string    `json:"action"`
	OldStatus string    `json:"old_status"`
	NewStatus string    `json:"new_status"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}
