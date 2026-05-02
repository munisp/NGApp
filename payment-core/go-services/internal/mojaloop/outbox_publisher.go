// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/IBM/sarama"
)

// OutboxPublisher implements the transactional outbox pattern
// It polls the outbox table and publishes events to Kafka
type OutboxPublisher struct {
	store         *TransferStore
	producer      sarama.SyncProducer
	topicPrefix   string
	pollInterval  time.Duration
	batchSize     int
	running       bool
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// OutboxPublisherConfig holds configuration for the outbox publisher
type OutboxPublisherConfig struct {
	KafkaBrokers []string
	TopicPrefix  string
	PollInterval time.Duration
	BatchSize    int
}

// DefaultOutboxPublisherConfig returns default configuration
func DefaultOutboxPublisherConfig() *OutboxPublisherConfig {
	brokers := getEnvOrDefault("KAFKA_BROKERS", "kafka.payment-switch.svc.cluster.local:9092")
	return &OutboxPublisherConfig{
		KafkaBrokers: []string{brokers},
		TopicPrefix:  "mojaloop.events.",
		PollInterval: 100 * time.Millisecond,
		BatchSize:    100,
	}
}

// NewOutboxPublisher creates a new outbox publisher
func NewOutboxPublisher(store *TransferStore, config *OutboxPublisherConfig) (*OutboxPublisher, error) {
	// Configure Kafka producer
	saramaConfig := sarama.NewConfig()
	saramaConfig.Producer.RequiredAcks = sarama.WaitForAll
	saramaConfig.Producer.Retry.Max = 5
	saramaConfig.Producer.Return.Successes = true
	saramaConfig.Net.DialTimeout = 10 * time.Second

	producer, err := sarama.NewSyncProducer(config.KafkaBrokers, saramaConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	return &OutboxPublisher{
		store:        store,
		producer:     producer,
		topicPrefix:  config.TopicPrefix,
		pollInterval: config.PollInterval,
		batchSize:    config.BatchSize,
		stopCh:       make(chan struct{}),
	}, nil
}

// Start begins polling the outbox and publishing events
func (p *OutboxPublisher) Start(ctx context.Context) {
	if p.running {
		return
	}

	p.running = true
	p.wg.Add(1)

	go func() {
		defer p.wg.Done()
		ticker := time.NewTicker(p.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-p.stopCh:
				return
			case <-ticker.C:
				p.publishBatch(ctx)
			}
		}
	}()

	log.Printf("Outbox publisher started with poll interval %v", p.pollInterval)
}

// Stop stops the outbox publisher
func (p *OutboxPublisher) Stop() {
	if !p.running {
		return
	}

	close(p.stopCh)
	p.wg.Wait()
	p.producer.Close()
	p.running = false

	log.Println("Outbox publisher stopped")
}

// publishBatch retrieves and publishes a batch of events
func (p *OutboxPublisher) publishBatch(ctx context.Context) {
	events, err := p.store.GetUnpublishedEvents(ctx, p.batchSize)
	if err != nil {
		log.Printf("Failed to get unpublished events: %v", err)
		return
	}

	for _, event := range events {
		topic := p.topicPrefix + event.EventType

		msg := &sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(event.AggregateID),
			Value: sarama.ByteEncoder(event.Payload),
			Headers: []sarama.RecordHeader{
				{Key: []byte("aggregate_type"), Value: []byte(event.AggregateType)},
				{Key: []byte("event_id"), Value: []byte(fmt.Sprintf("%d", event.EventID))},
				{Key: []byte("created_at"), Value: []byte(event.CreatedAt.Format(time.RFC3339))},
			},
		}

		_, _, err := p.producer.SendMessage(msg)
		if err != nil {
			log.Printf("Failed to publish event %d: %v", event.ID, err)
			p.store.MarkEventFailed(ctx, event.ID, err.Error())
			continue
		}

		err = p.store.MarkEventPublished(ctx, event.ID)
		if err != nil {
			log.Printf("Failed to mark event %d as published: %v", event.EventID, err)
		}
	}
}

// PublishTransferEvent publishes a transfer event through the outbox
func PublishTransferEvent(ctx context.Context, store *TransferStore, eventType string, transfer *MojaloopTransfer) error {
	payload := map[string]interface{}{
		"transfer_id":       transfer.TransferID,
		"tigerbeetle_id":    transfer.TigerBeetleID,
		"payer_fsp":         transfer.PayerFSP,
		"payee_fsp":         transfer.PayeeFSP,
		"amount":            transfer.Amount,
		"currency":          transfer.Currency,
		"state":             transfer.State,
		"timestamp":         time.Now().UTC().Format(time.RFC3339),
	}

	return store.SaveOutboxEvent(ctx, nil, "transfer", transfer.TransferID, eventType, payload)
}

// ReconciliationService handles reconciliation between TigerBeetle and Mojaloop
type ReconciliationService struct {
	store          *TransferStore
	tbClient       *TBProtocolClient
	reconcileInterval time.Duration
	driftThreshold uint64
	running        bool
	stopCh         chan struct{}
	wg             sync.WaitGroup
}

// ReconciliationConfig holds configuration for reconciliation


// NewReconciliationService creates a new reconciliation service
func NewReconciliationService(store *TransferStore, tbClient *TBProtocolClient, config *ReconciliationConfig) *ReconciliationService {
	return &ReconciliationService{
		store:             store,
		tbClient:          tbClient,
		reconcileInterval: config.ReconcileInterval,
		driftThreshold:    config.DriftThreshold,
		stopCh:            make(chan struct{}),
	}
}

// Start begins the reconciliation loop
func (r *ReconciliationService) Start(ctx context.Context) {
	if r.running {
		return
	}

	r.running = true
	r.wg.Add(1)

	go func() {
		defer r.wg.Done()
		ticker := time.NewTicker(r.reconcileInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-r.stopCh:
				return
			case <-ticker.C:
				r.runReconciliation(ctx)
			}
		}
	}()

	log.Printf("Reconciliation service started with interval %v", r.reconcileInterval)
}

// Stop stops the reconciliation service
func (r *ReconciliationService) Stop() {
	if !r.running {
		return
	}

	close(r.stopCh)
	r.wg.Wait()
	r.running = false

	log.Println("Reconciliation service stopped")
}

// runReconciliation performs a reconciliation check
func (r *ReconciliationService) runReconciliation(ctx context.Context) {
	result := &ReconciliationResult{
		Timestamp: time.Now().UTC(),
	}

	// Check for stuck transfers (RESERVED for too long)
	stuckTransfers, err := r.checkStuckTransfers(ctx)
	if err != nil {
		log.Printf("Failed to check stuck transfers: %v", err)
	} else {
		result.StuckTransfers = len(stuckTransfers)
		result.StuckDetails = stuckTransfers
	}

	// Check participant balances
	drifts, participantsChecked, err := r.checkParticipantBalances(ctx)
	if err != nil {
		log.Printf("Failed to check participant balances: %v", err)
	} else {
		result.ParticipantsChecked = participantsChecked
		result.DriftsDetected = len(drifts)
		result.DriftDetails = drifts
	}

	// Log results
	if result.DriftsDetected > 0 || result.StuckTransfers > 0 {
		resultJSON, _ := json.Marshal(result)
		log.Printf("RECONCILIATION ALERT: %s", string(resultJSON))
	} else {
		log.Printf("Reconciliation completed: %d participants checked, %d transfers checked, no issues",
			result.ParticipantsChecked, result.TransfersChecked)
	}
}

// checkStuckTransfers finds transfers stuck in RESERVED state
func (r *ReconciliationService) checkStuckTransfers(ctx context.Context) ([]StuckTransferDetail, error) {
	// Get transfers that have been in RESERVED state for more than 30 seconds
	query := `
		SELECT transfer_id, tigerbeetle_id, state, created_at
		FROM mojaloop_transfers
		WHERE state = 'RESERVED' 
		AND created_at < NOW() - INTERVAL '30 seconds'
		AND (expiration IS NULL OR expiration > NOW())
		ORDER BY created_at ASC
		LIMIT 100
	`

	rows, err := r.store.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stuck []StuckTransferDetail
	for rows.Next() {
		var detail StuckTransferDetail
		err := rows.Scan(&detail.TransferID, &detail.TBTransferID, &detail.State, &detail.CreatedAt)
		if err != nil {
			continue
		}
		detail.StuckDuration = time.Since(detail.CreatedAt).String()
		stuck = append(stuck, detail)
	}

	return stuck, rows.Err()
}

// checkParticipantBalances compares TigerBeetle balances with expected values
func (r *ReconciliationService) checkParticipantBalances(ctx context.Context) ([]ParticipantDrift, int, error) {
	// Get all active participants
	query := `SELECT fsp_id, tigerbeetle_account_id FROM mojaloop_participants WHERE is_active = TRUE`

	rows, err := r.store.db.QueryContext(ctx, query)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var drifts []ParticipantDrift
	participantsChecked := 0

	for rows.Next() {
		var fspID string
		var tbAccountID uint64

		if err := rows.Scan(&fspID, &tbAccountID); err != nil {
			continue
		}

		participantsChecked++

		// Get TigerBeetle balance
		accounts, err := r.tbClient.LookupAccounts(ctx, []uint64{tbAccountID})
		if err != nil || len(accounts) == 0 {
			log.Printf("Failed to lookup TigerBeetle account %d for %s: %v", tbAccountID, fspID, err)
			continue
		}

		tbBalance := int64(accounts[0].CreditsPosted) - int64(accounts[0].DebitsPosted)

		// Calculate expected balance from completed transfers
		expectedBalance, err := r.calculateExpectedBalance(ctx, fspID)
		if err != nil {
			log.Printf("Failed to calculate expected balance for %s: %v", fspID, err)
			continue
		}

		drift := tbBalance - expectedBalance
		if drift < 0 {
			drift = -drift
		}

		if uint64(drift) > r.driftThreshold {
			drifts = append(drifts, ParticipantDrift{
				FSPID:           fspID,
				TBAccountID:     tbAccountID,
				TBBalance:       tbBalance,
				ExpectedBalance: expectedBalance,
				Drift:           tbBalance - expectedBalance,
			})
		}
	}

	return drifts, participantsChecked, nil
}

// calculateExpectedBalance calculates expected balance from transfer history
func (r *ReconciliationService) calculateExpectedBalance(ctx context.Context, fspID string) (int64, error) {
	query := `
		SELECT 
			COALESCE(SUM(CASE WHEN payee_fsp = $1 AND state = 'COMMITTED' THEN amount ELSE 0 END), 0) -
			COALESCE(SUM(CASE WHEN payer_fsp = $1 AND state = 'COMMITTED' THEN amount ELSE 0 END), 0)
		FROM mojaloop_transfers
		WHERE (payer_fsp = $1 OR payee_fsp = $1) AND state = 'COMMITTED'
	`

	var balance int64
	err := r.store.db.QueryRowContext(ctx, query, fspID).Scan(&balance)
	return balance, err
}

// TimeoutHandler handles expired transfers
type TimeoutHandler struct {
	store       *TransferStore
	tbClient    *TBProtocolClient
	adapter     *MojaloopTigerBeetleAdapter
	checkInterval time.Duration
	running     bool
	stopCh      chan struct{}
	wg          sync.WaitGroup
}

// NewTimeoutHandler creates a new timeout handler
func NewTimeoutHandler(store *TransferStore, tbClient *TBProtocolClient, adapter *MojaloopTigerBeetleAdapter) *TimeoutHandler {
	return &TimeoutHandler{
		store:         store,
		tbClient:      tbClient,
		adapter:       adapter,
		checkInterval: 1 * time.Second,
		stopCh:        make(chan struct{}),
	}
}

// Start begins checking for expired transfers
func (h *TimeoutHandler) Start(ctx context.Context) {
	if h.running {
		return
	}

	h.running = true
	h.wg.Add(1)

	go func() {
		defer h.wg.Done()
		ticker := time.NewTicker(h.checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-h.stopCh:
				return
			case <-ticker.C:
				h.processExpiredTransfers(ctx)
			}
		}
	}()

	log.Println("Timeout handler started")
}

// Stop stops the timeout handler
func (h *TimeoutHandler) Stop() {
	if !h.running {
		return
	}

	close(h.stopCh)
	h.wg.Wait()
	h.running = false

	log.Println("Timeout handler stopped")
}

// processExpiredTransfers voids expired pending transfers
func (h *TimeoutHandler) processExpiredTransfers(ctx context.Context) {
	expired, err := h.store.GetExpiredTransfers(ctx, 100)
	if err != nil {
		log.Printf("Failed to get expired transfers: %v", err)
		return
	}

	for _, transfer := range expired {
		log.Printf("Processing expired transfer: %s", transfer.TransferID)

		// Void the pending transfer in TigerBeetle
		_, err := h.adapter.TimeoutTransfer(ctx, transfer.TransferID)
		if err != nil {
			log.Printf("Failed to timeout transfer %s: %v", transfer.TransferID, err)
			continue
		}

		// Update transfer state in database
		transfer.State = TransferStateExpired
		transfer.ErrorCode = "5100"
		transfer.ErrorDescription = "Transfer expired"

		err = h.store.SaveTransfer(ctx, transfer)
		if err != nil {
			log.Printf("Failed to update expired transfer %s: %v", transfer.TransferID, err)
		}

		// Publish timeout event
		PublishTransferEvent(ctx, h.store, "transfer.expired", transfer)
	}
}
