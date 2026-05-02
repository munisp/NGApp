package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type EventType string

const (
	// KYC Events
	EventKYCInitiated           EventType = "kyc.initiated"
	EventKYCVerificationCompleted EventType = "kyc.verification.completed"
	EventKYCVerificationFailed    EventType = "kyc.verification.failed"
	EventOCRProcessed             EventType = "kyc.ocr.processed"

	// AML Events
	EventAMLScreeningInitiated  EventType = "aml.screening.initiated"
	EventAMLScreeningCompleted  EventType = "aml.screening.completed"
	EventAMLAlertRaised         EventType = "aml.alert.raised"
	EventSanctionsMatchFound    EventType = "aml.sanctions.match"

	// Transaction Events
	EventTransactionInitiated   EventType = "transaction.initiated"
	EventTransactionCompleted   EventType = "transaction.completed"
	EventTransactionFailed      EventType = "transaction.failed"
	EventTransactionBlocked     EventType = "transaction.blocked"

	// Remittance Events
	EventRemittanceInitiated    EventType = "remittance.initiated"
	EventRemittanceCompleted    EventType = "remittance.completed"
	EventRemittanceFailed       EventType = "remittance.failed"

	// Settlement Events
	EventSettlementInitiated    EventType = "settlement.initiated"
	EventSettlementCompleted    EventType = "settlement.completed"
	EventSettlementFailed       EventType = "settlement.failed"

	// Reconciliation Events
	EventReconciliationStarted  EventType = "reconciliation.started"
	EventReconciliationCompleted EventType = "reconciliation.completed"
	EventReconciliationMismatch EventType = "reconciliation.mismatch.found"

	// FX Events
	EventFXLockCreated          EventType = "fx.lock.created"
	EventFXLockExpired          EventType = "fx.lock.expired"
	EventFXHedgeExecuted        EventType = "fx.hedge.executed"

	// Rate Alert Events
	EventRateAlertCreated       EventType = "rate.alert.created"
	EventRateAlertTriggered     EventType = "rate.alert.triggered"

	// Fraud Events
	EventFraudScoreCalculated   EventType = "fraud.score.calculated"
	EventFraudAlertRaised       EventType = "fraud.alert.raised"

	// Dispute Events
	EventDisputeOpened          EventType = "dispute.opened"
	EventDisputeResolved        EventType = "dispute.resolved"
	EventDisputeEscalated       EventType = "dispute.escalated"

	// Auth Events
	EventAuthLoginSuccess       EventType = "auth.login.success"
	EventAuthLoginFailed        EventType = "auth.login.failed"
	EventAuth2FAVerified        EventType = "auth.2fa.verified"
	EventAuthDeviceTrusted      EventType = "auth.device.trusted"

	// Notification Events
	EventNotificationSent       EventType = "notification.sent"
	EventNotificationFailed     EventType = "notification.failed"

	// Banking Events
	EventBankTransferInitiated  EventType = "bank.transfer.initiated"
	EventBankTransferCompleted  EventType = "bank.transfer.completed"
	EventMobileMoneyInitiated   EventType = "mobile.money.initiated"
	EventMobileMoneyCompleted   EventType = "mobile.money.completed"

	// Crypto Events
	EventCryptoDepositReceived  EventType = "crypto.deposit.received"
	EventCryptoWithdrawalSent   EventType = "crypto.withdrawal.sent"

	// Monetization Events
	EventAPIKeyCreated          EventType = "api.key.created"
	EventAPIKeyRevoked          EventType = "api.key.revoked"
	EventUsageMetered           EventType = "usage.metered"
	EventInvoiceGenerated       EventType = "invoice.generated"

	// Sandbox Events
	EventSandboxCreated         EventType = "sandbox.created"
	EventSandboxTransactionSimulated EventType = "sandbox.transaction.simulated"
)

type DomainEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     EventType              `json:"event_type"`
	Timestamp     string                 `json:"timestamp"`
	Version       string                 `json:"version"`
	SourceService string                 `json:"source_service"`
	CorrelationID string                 `json:"correlation_id"`
	CausationID   string                 `json:"causation_id,omitempty"`
	AggregateType string                 `json:"aggregate_type"`
	AggregateID   string                 `json:"aggregate_id"`
	Data          map[string]interface{} `json:"data"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type EventEmitter struct {
	serviceName string
	writer      *kafka.Writer
	mu          sync.Mutex
	metrics     EventMetrics
}

type EventMetrics struct {
	EventsEmitted int64
	EventsFailed  int64
}

var (
	globalEmitter *EventEmitter
	once          sync.Once
)

func InitializeEmitter(serviceName string) *EventEmitter {
	once.Do(func() {
		kafkaBootstrap := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
		if kafkaBootstrap == "" {
			kafkaBootstrap = "kafka:9092"
		}

		globalEmitter = &EventEmitter{
			serviceName: serviceName,
			writer: &kafka.Writer{
				Addr:         kafka.TCP(kafkaBootstrap),
				Topic:        "domain.events",
				Balancer:     &kafka.LeastBytes{},
				BatchSize:    100,
				BatchTimeout: 10 * time.Millisecond,
				RequiredAcks: kafka.RequireAll,
				Async:        false,
			},
			metrics: EventMetrics{},
		}
	})
	return globalEmitter
}

func GetEmitter() *EventEmitter {
	if globalEmitter == nil {
		log.Println("Warning: EventEmitter not initialized, initializing with default service name")
		return InitializeEmitter("unknown-service")
	}
	return globalEmitter
}

func (e *EventEmitter) Emit(ctx context.Context, eventType EventType, aggregateType, aggregateID string, data map[string]interface{}) error {
	return e.EmitWithCorrelation(ctx, eventType, aggregateType, aggregateID, data, "", "")
}

func (e *EventEmitter) EmitWithCorrelation(ctx context.Context, eventType EventType, aggregateType, aggregateID string, data map[string]interface{}, correlationID, causationID string) error {
	if correlationID == "" {
		correlationID = uuid.New().String()
	}

	event := DomainEvent{
		EventID:       uuid.New().String(),
		EventType:     eventType,
		Timestamp:     time.Now().UTC().Format(time.RFC3339Nano),
		Version:       "1.0",
		SourceService: e.serviceName,
		CorrelationID: correlationID,
		CausationID:   causationID,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		Data:          data,
		Metadata: map[string]interface{}{
			"emitted_at": time.Now().UTC().Format(time.RFC3339Nano),
		},
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		e.mu.Lock()
		e.metrics.EventsFailed++
		e.mu.Unlock()
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(aggregateID),
		Value: eventBytes,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(string(eventType))},
			{Key: "correlation_id", Value: []byte(correlationID)},
			{Key: "source_service", Value: []byte(e.serviceName)},
		},
	}

	if err := e.writer.WriteMessages(ctx, msg); err != nil {
		e.mu.Lock()
		e.metrics.EventsFailed++
		e.mu.Unlock()
		log.Printf("Failed to emit event %s: %v", eventType, err)
		return fmt.Errorf("failed to write event to Kafka: %w", err)
	}

	e.mu.Lock()
	e.metrics.EventsEmitted++
	e.mu.Unlock()

	log.Printf("Emitted event: %s for %s/%s", eventType, aggregateType, aggregateID)
	return nil
}

func (e *EventEmitter) GetMetrics() EventMetrics {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.metrics
}

func (e *EventEmitter) Close() error {
	if e.writer != nil {
		return e.writer.Close()
	}
	return nil
}

// Convenience functions for common event types

func EmitKYCVerificationCompleted(ctx context.Context, customerID string, status string, confidenceScore float64, verifiedFields []string) error {
	return GetEmitter().Emit(ctx, EventKYCVerificationCompleted, "customer", customerID, map[string]interface{}{
		"status":           status,
		"confidence_score": confidenceScore,
		"verified_fields":  verifiedFields,
		"completed_at":     time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAMLScreeningCompleted(ctx context.Context, customerID string, riskScore float64, watchlistsChecked []string, matchesFound int) error {
	return GetEmitter().Emit(ctx, EventAMLScreeningCompleted, "customer", customerID, map[string]interface{}{
		"risk_score":         riskScore,
		"watchlists_checked": watchlistsChecked,
		"matches_found":      matchesFound,
		"screened_at":        time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitTransactionCompleted(ctx context.Context, transactionID string, amount float64, currency string, status string) error {
	return GetEmitter().Emit(ctx, EventTransactionCompleted, "transaction", transactionID, map[string]interface{}{
		"amount":       amount,
		"currency":     currency,
		"status":       status,
		"completed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitRemittanceCompleted(ctx context.Context, remittanceID string, senderID, recipientID string, amount float64, currency, corridor string) error {
	return GetEmitter().Emit(ctx, EventRemittanceCompleted, "remittance", remittanceID, map[string]interface{}{
		"sender_id":    senderID,
		"recipient_id": recipientID,
		"amount":       amount,
		"currency":     currency,
		"corridor":     corridor,
		"completed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitSettlementCompleted(ctx context.Context, settlementID string, totalAmount float64, transactionCount int, status string) error {
	return GetEmitter().Emit(ctx, EventSettlementCompleted, "settlement", settlementID, map[string]interface{}{
		"total_amount":      totalAmount,
		"transaction_count": transactionCount,
		"status":            status,
		"completed_at":      time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitReconciliationCompleted(ctx context.Context, reconciliationID string, matchedCount, mismatchCount int, status string) error {
	return GetEmitter().Emit(ctx, EventReconciliationCompleted, "reconciliation", reconciliationID, map[string]interface{}{
		"matched_count":  matchedCount,
		"mismatch_count": mismatchCount,
		"status":         status,
		"completed_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitFraudScoreCalculated(ctx context.Context, transactionID string, score float64, riskLevel string, factors []string) error {
	return GetEmitter().Emit(ctx, EventFraudScoreCalculated, "transaction", transactionID, map[string]interface{}{
		"score":       score,
		"risk_level":  riskLevel,
		"factors":     factors,
		"scored_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitRateAlertTriggered(ctx context.Context, alertID string, userID string, fromCurrency, toCurrency string, targetRate, currentRate float64) error {
	return GetEmitter().Emit(ctx, EventRateAlertTriggered, "rate_alert", alertID, map[string]interface{}{
		"user_id":       userID,
		"from_currency": fromCurrency,
		"to_currency":   toCurrency,
		"target_rate":   targetRate,
		"current_rate":  currentRate,
		"triggered_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitFXLockCreated(ctx context.Context, lockID string, userID string, fromCurrency, toCurrency string, rate float64, expiresAt time.Time) error {
	return GetEmitter().Emit(ctx, EventFXLockCreated, "fx_lock", lockID, map[string]interface{}{
		"user_id":       userID,
		"from_currency": fromCurrency,
		"to_currency":   toCurrency,
		"rate":          rate,
		"expires_at":    expiresAt.Format(time.RFC3339),
		"created_at":    time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitDisputeOpened(ctx context.Context, disputeID string, transactionID, customerID string, reason string, amount float64) error {
	return GetEmitter().Emit(ctx, EventDisputeOpened, "dispute", disputeID, map[string]interface{}{
		"transaction_id": transactionID,
		"customer_id":    customerID,
		"reason":         reason,
		"amount":         amount,
		"opened_at":      time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAuthLoginSuccess(ctx context.Context, userID string, deviceID, ipAddress string) error {
	return GetEmitter().Emit(ctx, EventAuthLoginSuccess, "user", userID, map[string]interface{}{
		"device_id":  deviceID,
		"ip_address": ipAddress,
		"logged_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitBankTransferCompleted(ctx context.Context, transferID string, amount float64, currency, bankCode, accountNumber string) error {
	return GetEmitter().Emit(ctx, EventBankTransferCompleted, "transfer", transferID, map[string]interface{}{
		"amount":         amount,
		"currency":       currency,
		"bank_code":      bankCode,
		"account_number": accountNumber,
		"completed_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitCryptoDepositReceived(ctx context.Context, depositID string, amount float64, currency, walletAddress, txHash string) error {
	return GetEmitter().Emit(ctx, EventCryptoDepositReceived, "deposit", depositID, map[string]interface{}{
		"amount":         amount,
		"currency":       currency,
		"wallet_address": walletAddress,
		"tx_hash":        txHash,
		"received_at":    time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAPIKeyCreated(ctx context.Context, keyID string, merchantID string, scopes []string) error {
	return GetEmitter().Emit(ctx, EventAPIKeyCreated, "api_key", keyID, map[string]interface{}{
		"merchant_id": merchantID,
		"scopes":      scopes,
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitUsageMetered(ctx context.Context, merchantID string, eventType string, quantity int, billableAmount float64) error {
	return GetEmitter().Emit(ctx, EventUsageMetered, "merchant", merchantID, map[string]interface{}{
		"event_type":      eventType,
		"quantity":        quantity,
		"billable_amount": billableAmount,
		"metered_at":      time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitNotificationSent(ctx context.Context, notificationID string, userID, channel, templateID string) error {
	return GetEmitter().Emit(ctx, EventNotificationSent, "notification", notificationID, map[string]interface{}{
		"user_id":     userID,
		"channel":     channel,
		"template_id": templateID,
		"sent_at":     time.Now().UTC().Format(time.RFC3339),
	})
}
