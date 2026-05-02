package tigerbeetle

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("tigerbeetle-service")
}

func EmitTransferCreated(ctx context.Context, transferID string, debitAccountID, creditAccountID string, amount uint64, ledger uint32) error {
	return events.GetEmitter().Emit(ctx, events.EventTransactionInitiated, "transfer", transferID, map[string]interface{}{
		"debit_account_id":  debitAccountID,
		"credit_account_id": creditAccountID,
		"amount":            amount,
		"ledger":            ledger,
		"created_at":        time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitTransferCompleted(ctx context.Context, transferID string, amount uint64, status string) error {
	return events.GetEmitter().Emit(ctx, events.EventTransactionCompleted, "transfer", transferID, map[string]interface{}{
		"amount":       amount,
		"status":       status,
		"completed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitTransferFailed(ctx context.Context, transferID string, reason string) error {
	return events.GetEmitter().Emit(ctx, events.EventTransactionFailed, "transfer", transferID, map[string]interface{}{
		"reason":    reason,
		"failed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAccountCreated(ctx context.Context, accountID string, ledger uint32, code uint16) error {
	return events.GetEmitter().Emit(ctx, "ledger.account.created", "account", accountID, map[string]interface{}{
		"ledger":     ledger,
		"code":       code,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitBalanceUpdated(ctx context.Context, accountID string, debitsPosted, creditsPosted uint64) error {
	return events.GetEmitter().Emit(ctx, "ledger.balance.updated", "account", accountID, map[string]interface{}{
		"debits_posted":  debitsPosted,
		"credits_posted": creditsPosted,
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	})
}

type TigerBeetleServiceWithEvents struct {
	service interface{}
}

func NewTigerBeetleServiceWithEvents(service interface{}) *TigerBeetleServiceWithEvents {
	return &TigerBeetleServiceWithEvents{service: service}
}

func (s *TigerBeetleServiceWithEvents) CreateTransfer(ctx context.Context, debitAccountID, creditAccountID string, amount uint64, ledger uint32) (string, error) {
	transferID := generateTransferID()
	
	if err := EmitTransferCreated(ctx, transferID, debitAccountID, creditAccountID, amount, ledger); err != nil {
		log.Printf("Failed to emit transfer created event: %v", err)
	}
	
	return transferID, nil
}

func (s *TigerBeetleServiceWithEvents) CompleteTransfer(ctx context.Context, transferID string, amount uint64, status string) error {
	if err := EmitTransferCompleted(ctx, transferID, amount, status); err != nil {
		log.Printf("Failed to emit transfer completed event: %v", err)
	}
	return nil
}

func (s *TigerBeetleServiceWithEvents) CreateAccount(ctx context.Context, ledger uint32, code uint16) (string, error) {
	accountID := generateAccountID()
	
	if err := EmitAccountCreated(ctx, accountID, ledger, code); err != nil {
		log.Printf("Failed to emit account created event: %v", err)
	}
	
	return accountID, nil
}

func generateTransferID() string {
	return "txn_" + time.Now().Format("20060102150405")
}

func generateAccountID() string {
	return "acc_" + time.Now().Format("20060102150405")
}
