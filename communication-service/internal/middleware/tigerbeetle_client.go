package middleware

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// TigerBeetleConfig holds TigerBeetle configuration
type TigerBeetleConfig struct {
	Address   string
	ClusterID uint64
}

// TigerBeetleClient handles financial transactions with TigerBeetle
type TigerBeetleClient struct {
	config TigerBeetleConfig
	logger *zap.Logger
}

// NewTigerBeetleClient creates a new TigerBeetle client
func NewTigerBeetleClient(config TigerBeetleConfig, logger *zap.Logger) *TigerBeetleClient {
	if config.Address == "" {
		config.Address = os.Getenv("TIGERBEETLE_ADDRESS")
		if config.Address == "" {
			config.Address = "tigerbeetle:3000"
		}
	}

	return &TigerBeetleClient{
		config: config,
		logger: logger,
	}
}

// MessageBillingRecord represents a billing record for a message
type MessageBillingRecord struct {
	ID            uuid.UUID `json:"id"`
	MessageID     string    `json:"message_id"`
	CustomerID    uuid.UUID `json:"customer_id"`
	Channel       string    `json:"channel"`
	MessageType   string    `json:"message_type"`
	Amount        uint64    `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	Timestamp     time.Time `json:"timestamp"`
	DebitAccount  uint64    `json:"debit_account"`
	CreditAccount uint64    `json:"credit_account"`
}

// ChannelPricing represents pricing for a communication channel
type ChannelPricing struct {
	Channel     string `json:"channel"`
	MessageType string `json:"message_type"`
	Amount      uint64 `json:"amount"`
	Currency    string `json:"currency"`
}

// Default pricing (in smallest currency unit, e.g., kobo for NGN)
var defaultPricing = map[string]map[string]uint64{
	"whatsapp": {
		"text":     500,   // 5 NGN
		"template": 800,   // 8 NGN
		"media":    1500,  // 15 NGN
	},
	"sms": {
		"text":     400,   // 4 NGN
		"flash":    500,   // 5 NGN
	},
	"telegram": {
		"text":     200,   // 2 NGN
		"media":    500,   // 5 NGN
	},
	"ussd": {
		"session":  100,   // 1 NGN per session
	},
}

// GetMessagePrice gets the price for a message
func (t *TigerBeetleClient) GetMessagePrice(channel, messageType string) uint64 {
	if channelPricing, ok := defaultPricing[channel]; ok {
		if price, ok := channelPricing[messageType]; ok {
			return price
		}
	}
	return 0
}

// CreateBillingRecord creates a billing record for a message
func (t *TigerBeetleClient) CreateBillingRecord(ctx context.Context, record MessageBillingRecord) error {
	t.logger.Info("Creating billing record",
		zap.String("message_id", record.MessageID),
		zap.String("channel", record.Channel),
		zap.Uint64("amount", record.Amount))

	// In production, this would create a TigerBeetle transfer:
	// transfer := tigerbeetle.Transfer{
	//     ID:              record.ID,
	//     DebitAccountID:  record.DebitAccount,
	//     CreditAccountID: record.CreditAccount,
	//     Amount:          record.Amount,
	//     Ledger:          1,
	//     Code:            1,
	//     Flags:           0,
	// }
	// _, err := t.client.CreateTransfers([]tigerbeetle.Transfer{transfer})

	return nil
}

// GetCustomerBalance gets the communication credit balance for a customer
func (t *TigerBeetleClient) GetCustomerBalance(ctx context.Context, customerID uuid.UUID) (uint64, error) {
	t.logger.Info("Getting customer balance", zap.String("customer_id", customerID.String()))

	// In production, this would query TigerBeetle:
	// accounts, err := t.client.LookupAccounts([]uint128.Uint128{customerAccountID})
	// return accounts[0].CreditsPosted - accounts[0].DebitsPosted, nil

	return 100000, nil // Mock balance: 1000 NGN
}

// DeductMessageCost deducts the cost of a message from customer balance
func (t *TigerBeetleClient) DeductMessageCost(ctx context.Context, customerID uuid.UUID, messageID string, channel, messageType string) error {
	amount := t.GetMessagePrice(channel, messageType)
	if amount == 0 {
		return fmt.Errorf("unknown pricing for channel %s, type %s", channel, messageType)
	}

	record := MessageBillingRecord{
		ID:            uuid.New(),
		MessageID:     messageID,
		CustomerID:    customerID,
		Channel:       channel,
		MessageType:   messageType,
		Amount:        amount,
		Currency:      "NGN",
		Status:        "completed",
		Timestamp:     time.Now(),
		DebitAccount:  uint64(customerID.ID()),
		CreditAccount: 1, // Platform revenue account
	}

	return t.CreateBillingRecord(ctx, record)
}

// RefundMessage refunds the cost of a failed message
func (t *TigerBeetleClient) RefundMessage(ctx context.Context, customerID uuid.UUID, messageID string, channel, messageType string) error {
	amount := t.GetMessagePrice(channel, messageType)
	if amount == 0 {
		return fmt.Errorf("unknown pricing for channel %s, type %s", channel, messageType)
	}

	record := MessageBillingRecord{
		ID:            uuid.New(),
		MessageID:     messageID,
		CustomerID:    customerID,
		Channel:       channel,
		MessageType:   messageType,
		Amount:        amount,
		Currency:      "NGN",
		Status:        "refunded",
		Timestamp:     time.Now(),
		DebitAccount:  1, // Platform revenue account
		CreditAccount: uint64(customerID.ID()),
	}

	t.logger.Info("Refunding message cost",
		zap.String("message_id", messageID),
		zap.Uint64("amount", amount))

	return t.CreateBillingRecord(ctx, record)
}

// GetBillingHistory gets billing history for a customer
func (t *TigerBeetleClient) GetBillingHistory(ctx context.Context, customerID uuid.UUID, startDate, endDate time.Time) ([]MessageBillingRecord, error) {
	t.logger.Info("Getting billing history",
		zap.String("customer_id", customerID.String()),
		zap.Time("start_date", startDate),
		zap.Time("end_date", endDate))

	// In production, this would query TigerBeetle for transfers
	// and join with message metadata

	return []MessageBillingRecord{}, nil
}

// GetChannelUsageStats gets usage statistics by channel
func (t *TigerBeetleClient) GetChannelUsageStats(ctx context.Context, customerID uuid.UUID, period string) (map[string]interface{}, error) {
	t.logger.Info("Getting channel usage stats",
		zap.String("customer_id", customerID.String()),
		zap.String("period", period))

	return map[string]interface{}{
		"whatsapp": map[string]interface{}{
			"count":  0,
			"amount": 0,
		},
		"sms": map[string]interface{}{
			"count":  0,
			"amount": 0,
		},
		"telegram": map[string]interface{}{
			"count":  0,
			"amount": 0,
		},
		"ussd": map[string]interface{}{
			"sessions": 0,
			"amount":   0,
		},
	}, nil
}

// CreateCommunicationAccount creates a communication credit account for a customer
func (t *TigerBeetleClient) CreateCommunicationAccount(ctx context.Context, customerID uuid.UUID) error {
	t.logger.Info("Creating communication account", zap.String("customer_id", customerID.String()))

	// In production:
	// account := tigerbeetle.Account{
	//     ID:     customerAccountID,
	//     Ledger: 1, // Communication ledger
	//     Code:   1,
	//     Flags:  0,
	// }
	// _, err := t.client.CreateAccounts([]tigerbeetle.Account{account})

	return nil
}

// TopUpAccount adds credits to a customer's communication account
func (t *TigerBeetleClient) TopUpAccount(ctx context.Context, customerID uuid.UUID, amount uint64, reference string) error {
	t.logger.Info("Topping up account",
		zap.String("customer_id", customerID.String()),
		zap.Uint64("amount", amount),
		zap.String("reference", reference))

	// In production, this would create a transfer from the funding account
	// to the customer's communication account

	return nil
}
