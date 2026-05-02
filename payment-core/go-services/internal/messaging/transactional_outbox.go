package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type OutboxStatus string

const (
	OutboxStatusPending    OutboxStatus = "pending"
	OutboxStatusProcessing OutboxStatus = "processing"
	OutboxStatusSent       OutboxStatus = "sent"
	OutboxStatusFailed     OutboxStatus = "failed"
	OutboxStatusDeadLetter OutboxStatus = "dead_letter"
)

type OutboxMessage struct {
	ID            string                 `json:"id"`
	AggregateType string                 `json:"aggregate_type"`
	AggregateID   string                 `json:"aggregate_id"`
	EventType     string                 `json:"event_type"`
	Payload       map[string]interface{} `json:"payload"`
	Destination   string                 `json:"destination"`
	Status        OutboxStatus           `json:"status"`
	RetryCount    int                    `json:"retry_count"`
	MaxRetries    int                    `json:"max_retries"`
	CreatedAt     time.Time              `json:"created_at"`
	ProcessedAt   *time.Time             `json:"processed_at,omitempty"`
	LastError     string                 `json:"last_error,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type InboxMessage struct {
	ID             string    `json:"id"`
	MessageID      string    `json:"message_id"`
	EventType      string    `json:"event_type"`
	ConsumerID     string    `json:"consumer_id"`
	ProcessedAt    time.Time `json:"processed_at"`
	IdempotencyKey string    `json:"idempotency_key"`
}

type OutboxConfig struct {
	PollIntervalMs        int
	BatchSize             int
	MaxRetries            int
	RetryDelayMs          int
	DeadLetterAfterRetries int
}

type Publisher func(ctx context.Context, message *OutboxMessage) error

type TransactionalOutbox struct {
	mu              sync.RWMutex
	config          OutboxConfig
	outboxStore     map[string]*OutboxMessage
	deadLetterQueue []*OutboxMessage
	publishers      map[string]Publisher
	isRunning       bool
	stopChan        chan struct{}
	eventHandlers   map[string][]func(*OutboxMessage)
}

func NewTransactionalOutbox(config *OutboxConfig) *TransactionalOutbox {
	cfg := OutboxConfig{
		PollIntervalMs:        1000,
		BatchSize:             100,
		MaxRetries:            5,
		RetryDelayMs:          5000,
		DeadLetterAfterRetries: 10,
	}

	if config != nil {
		if config.PollIntervalMs > 0 {
			cfg.PollIntervalMs = config.PollIntervalMs
		}
		if config.BatchSize > 0 {
			cfg.BatchSize = config.BatchSize
		}
		if config.MaxRetries > 0 {
			cfg.MaxRetries = config.MaxRetries
		}
		if config.RetryDelayMs > 0 {
			cfg.RetryDelayMs = config.RetryDelayMs
		}
		if config.DeadLetterAfterRetries > 0 {
			cfg.DeadLetterAfterRetries = config.DeadLetterAfterRetries
		}
	}

	return &TransactionalOutbox{
		config:          cfg,
		outboxStore:     make(map[string]*OutboxMessage),
		deadLetterQueue: make([]*OutboxMessage, 0),
		publishers:      make(map[string]Publisher),
		eventHandlers:   make(map[string][]func(*OutboxMessage)),
		stopChan:        make(chan struct{}),
	}
}

func (to *TransactionalOutbox) RegisterPublisher(destination string, publisher Publisher) {
	to.mu.Lock()
	defer to.mu.Unlock()
	to.publishers[destination] = publisher
}

func (to *TransactionalOutbox) On(event string, handler func(*OutboxMessage)) {
	to.mu.Lock()
	defer to.mu.Unlock()
	to.eventHandlers[event] = append(to.eventHandlers[event], handler)
}

func (to *TransactionalOutbox) emit(event string, message *OutboxMessage) {
	to.mu.RLock()
	handlers := to.eventHandlers[event]
	to.mu.RUnlock()

	for _, handler := range handlers {
		go handler(message)
	}
}

type AddMessageParams struct {
	AggregateType string
	AggregateID   string
	EventType     string
	Payload       map[string]interface{}
	Destination   string
	Metadata      map[string]interface{}
}

func (to *TransactionalOutbox) AddMessage(params AddMessageParams) (*OutboxMessage, error) {
	to.mu.Lock()
	defer to.mu.Unlock()

	message := &OutboxMessage{
		ID:            uuid.New().String(),
		AggregateType: params.AggregateType,
		AggregateID:   params.AggregateID,
		EventType:     params.EventType,
		Payload:       params.Payload,
		Destination:   params.Destination,
		Status:        OutboxStatusPending,
		RetryCount:    0,
		MaxRetries:    to.config.MaxRetries,
		CreatedAt:     time.Now(),
		Metadata:      params.Metadata,
	}

	to.outboxStore[message.ID] = message
	to.emit("messageAdded", message)
	return message, nil
}

func (to *TransactionalOutbox) ProcessMessages(ctx context.Context) (int, error) {
	to.mu.Lock()

	pendingMessages := make([]*OutboxMessage, 0)
	for _, m := range to.outboxStore {
		if (m.Status == OutboxStatusPending || m.Status == OutboxStatusFailed) &&
			m.RetryCount < to.config.DeadLetterAfterRetries {
			pendingMessages = append(pendingMessages, m)
		}
		if len(pendingMessages) >= to.config.BatchSize {
			break
		}
	}
	to.mu.Unlock()

	processed := 0

	for _, message := range pendingMessages {
		to.mu.Lock()
		message.Status = OutboxStatusProcessing
		to.mu.Unlock()

		to.mu.RLock()
		publisher, ok := to.publishers[message.Destination]
		to.mu.RUnlock()

		if !ok {
			to.mu.Lock()
			message.RetryCount++
			message.LastError = fmt.Sprintf("no publisher registered for destination: %s", message.Destination)
			message.Status = OutboxStatusFailed
			to.mu.Unlock()
			to.emit("messageFailed", message)
			continue
		}

		err := publisher(ctx, message)
		if err != nil {
			to.mu.Lock()
			message.RetryCount++
			message.LastError = err.Error()

			if message.RetryCount >= to.config.DeadLetterAfterRetries {
				message.Status = OutboxStatusDeadLetter
				to.deadLetterQueue = append(to.deadLetterQueue, message)
				delete(to.outboxStore, message.ID)
				to.mu.Unlock()
				to.emit("messageDeadLettered", message)
			} else {
				message.Status = OutboxStatusFailed
				to.mu.Unlock()
				to.emit("messageFailed", message)
			}
			continue
		}

		to.mu.Lock()
		now := time.Now()
		message.Status = OutboxStatusSent
		message.ProcessedAt = &now
		to.mu.Unlock()

		processed++
		to.emit("messageSent", message)
	}

	return processed, nil
}

func (to *TransactionalOutbox) Start(ctx context.Context) {
	to.mu.Lock()
	if to.isRunning {
		to.mu.Unlock()
		return
	}
	to.isRunning = true
	to.stopChan = make(chan struct{})
	to.mu.Unlock()

	ticker := time.NewTicker(time.Duration(to.config.PollIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-to.stopChan:
			return
		case <-ticker.C:
			to.ProcessMessages(ctx)
		}
	}
}

func (to *TransactionalOutbox) Stop() {
	to.mu.Lock()
	defer to.mu.Unlock()

	if !to.isRunning {
		return
	}

	to.isRunning = false
	close(to.stopChan)
}

type OutboxStats struct {
	Pending    int `json:"pending"`
	Processing int `json:"processing"`
	Sent       int `json:"sent"`
	Failed     int `json:"failed"`
	DeadLetter int `json:"dead_letter"`
}

func (to *TransactionalOutbox) GetStats() OutboxStats {
	to.mu.RLock()
	defer to.mu.RUnlock()

	stats := OutboxStats{}
	for _, m := range to.outboxStore {
		switch m.Status {
		case OutboxStatusPending:
			stats.Pending++
		case OutboxStatusProcessing:
			stats.Processing++
		case OutboxStatusSent:
			stats.Sent++
		case OutboxStatusFailed:
			stats.Failed++
		}
	}
	stats.DeadLetter = len(to.deadLetterQueue)
	return stats
}

func (to *TransactionalOutbox) GetDeadLetterQueue() []*OutboxMessage {
	to.mu.RLock()
	defer to.mu.RUnlock()

	result := make([]*OutboxMessage, len(to.deadLetterQueue))
	copy(result, to.deadLetterQueue)
	return result
}

func (to *TransactionalOutbox) RetryDeadLetter(messageID string) error {
	to.mu.Lock()
	defer to.mu.Unlock()

	for i, m := range to.deadLetterQueue {
		if m.ID == messageID {
			to.deadLetterQueue = append(to.deadLetterQueue[:i], to.deadLetterQueue[i+1:]...)
			m.Status = OutboxStatusPending
			m.RetryCount = 0
			m.LastError = ""
			to.outboxStore[m.ID] = m
			to.emit("deadLetterRetried", m)
			return nil
		}
	}

	return errors.New("message not found in dead letter queue")
}

type ConsumerDeduplication struct {
	mu         sync.RWMutex
	consumerID string
	inboxStore map[string]*InboxMessage
}

func NewConsumerDeduplication(consumerID string) *ConsumerDeduplication {
	return &ConsumerDeduplication{
		consumerID: consumerID,
		inboxStore: make(map[string]*InboxMessage),
	}
}

func (cd *ConsumerDeduplication) getDedupeKey(messageID, idempotencyKey string) string {
	key := idempotencyKey
	if key == "" {
		key = messageID
	}
	return fmt.Sprintf("%s:%s", cd.consumerID, key)
}

func (cd *ConsumerDeduplication) IsDuplicate(messageID, idempotencyKey string) bool {
	cd.mu.RLock()
	defer cd.mu.RUnlock()

	key := cd.getDedupeKey(messageID, idempotencyKey)
	_, exists := cd.inboxStore[key]
	return exists
}

func (cd *ConsumerDeduplication) MarkProcessed(messageID, eventType, idempotencyKey string) {
	cd.mu.Lock()
	defer cd.mu.Unlock()

	key := cd.getDedupeKey(messageID, idempotencyKey)
	iKey := idempotencyKey
	if iKey == "" {
		iKey = messageID
	}

	cd.inboxStore[key] = &InboxMessage{
		ID:             uuid.New().String(),
		MessageID:      messageID,
		EventType:      eventType,
		ConsumerID:     cd.consumerID,
		ProcessedAt:    time.Now(),
		IdempotencyKey: iKey,
	}
}

type ProcessResult struct {
	Processed bool
	Result    interface{}
	Duplicate bool
}

func (cd *ConsumerDeduplication) ProcessWithDeduplication(
	messageID, eventType, idempotencyKey string,
	processor func() (interface{}, error),
) (*ProcessResult, error) {
	if cd.IsDuplicate(messageID, idempotencyKey) {
		return &ProcessResult{Processed: false, Duplicate: true}, nil
	}

	result, err := processor()
	if err != nil {
		return nil, err
	}

	cd.MarkProcessed(messageID, eventType, idempotencyKey)
	return &ProcessResult{Processed: true, Result: result, Duplicate: false}, nil
}

type KafkaMessage struct {
	Topic   string
	Key     string
	Value   []byte
	Headers map[string]string
}

func CreateKafkaPublisher(sendFunc func(ctx context.Context, msg *KafkaMessage) error) Publisher {
	return func(ctx context.Context, message *OutboxMessage) error {
		payload := map[string]interface{}{
			"id":            message.ID,
			"type":          message.EventType,
			"aggregate_type": message.AggregateType,
			"aggregate_id":  message.AggregateID,
			"payload":       message.Payload,
			"timestamp":     message.CreatedAt.Format(time.RFC3339),
			"metadata":      message.Metadata,
		}

		value, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal message: %w", err)
		}

		kafkaMsg := &KafkaMessage{
			Topic: message.Destination,
			Key:   message.AggregateID,
			Value: value,
			Headers: map[string]string{
				"event-type":     message.EventType,
				"aggregate-type": message.AggregateType,
				"message-id":     message.ID,
			},
		}

		return sendFunc(ctx, kafkaMsg)
	}
}
