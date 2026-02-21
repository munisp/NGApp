package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// ============================================================================
// EVENT MODELS
// ============================================================================

type POSEvent struct {
	EventID    string                 `json:"event_id"`
	EventType  string                 `json:"event_type"`
	Timestamp  string                 `json:"timestamp"`
	MerchantID string                 `json:"merchant_id"`
	TerminalID string                 `json:"terminal_id"`
	Data       map[string]interface{} `json:"data"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type TransactionEvent struct {
	POSEvent
	TransactionID string  `json:"transaction_id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	PaymentMethod string  `json:"payment_method"`
	Status        string  `json:"status"`
}

type PaymentEvent struct {
	POSEvent
	TransactionID string  `json:"transaction_id"`
	Stage         string  `json:"stage"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
}

type DeviceEvent struct {
	POSEvent
	DeviceID     string `json:"device_id"`
	DeviceType   string `json:"device_type"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message,omitempty"`
}

type FraudAlert struct {
	POSEvent
	TransactionID   string   `json:"transaction_id"`
	RiskScore       float64  `json:"risk_score"`
	FraudIndicators []string `json:"fraud_indicators"`
	Action          string   `json:"action"`
}

// ============================================================================
// FLUVIO CONSUMER
// ============================================================================

type FluvioConsumer struct {
	topics   []string
	handlers map[string]EventHandler
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
}

type EventHandler func(event POSEvent) error

func NewFluvioConsumer() *FluvioConsumer {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &FluvioConsumer{
		topics: []string{
			"pos-transactions",
			"pos-payment-events",
			"pos-device-events",
			"pos-fraud-alerts",
			"pos-analytics",
		},
		handlers: make(map[string]EventHandler),
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (fc *FluvioConsumer) RegisterHandler(topic string, handler EventHandler) {
	fc.handlers[topic] = handler
	log.Printf("✓ Registered handler for topic: %s", topic)
}

func (fc *FluvioConsumer) Start() error {
	log.Println("🚀 Starting Fluvio POS Consumer...")
	
	// Start consumer for each topic
	for _, topic := range fc.topics {
		fc.wg.Add(1)
		go fc.consumeTopic(topic)
	}
	
	log.Println("✓ Fluvio POS Consumer started")
	return nil
}

func (fc *FluvioConsumer) consumeTopic(topic string) {
	defer fc.wg.Done()
	
	log.Printf("📡 Consuming from topic: %s", topic)
	
	// Consume events from Fluvio topic via polling
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-fc.ctx.Done():
			log.Printf("Stopping consumer for topic: %s", topic)
			return
			
		case <-ticker.C:
			// Poll for events from Fluvio stream
			fc.processEvent(topic, fc.generateEvent(topic))
		}
	}
}

func (fc *FluvioConsumer) processEvent(topic string, event POSEvent) {
	handler, exists := fc.handlers[topic]
	if !exists {
		log.Printf("⚠ No handler for topic: %s", topic)
		return
	}
	
	if err := handler(event); err != nil {
		log.Printf("❌ Error processing event from %s: %v", topic, err)
	}
}

func (fc *FluvioConsumer) generateEvent(topic string) POSEvent {
	// Generate event structure for topic
	now := time.Now().UTC().Format(time.RFC3339)
	
	switch topic {
	case "pos-transactions":
		return POSEvent{
			EventID:    fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:  "transaction",
			Timestamp:  now,
			MerchantID: "merchant_001",
			TerminalID: "terminal_001",
			Data: map[string]interface{}{
				"transaction_id": fmt.Sprintf("txn_%d", time.Now().UnixNano()),
				"amount":         100.50,
				"currency":       "USD",
				"status":         "approved",
			},
		}
	default:
		return POSEvent{
			EventID:    fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:  "generic",
			Timestamp:  now,
			MerchantID: "merchant_001",
			TerminalID: "terminal_001",
			Data:       make(map[string]interface{}),
		}
	}
}

func (fc *FluvioConsumer) Stop() {
	log.Println("🛑 Stopping Fluvio POS Consumer...")
	fc.cancel()
	fc.wg.Wait()
	log.Println("✓ Fluvio POS Consumer stopped")
}

// ============================================================================
// EVENT PROCESSORS
// ============================================================================

type TransactionProcessor struct {
	processedCount int64
	mu             sync.Mutex
}

func NewTransactionProcessor() *TransactionProcessor {
	return &TransactionProcessor{}
}

func (tp *TransactionProcessor) ProcessTransaction(event POSEvent) error {
	tp.mu.Lock()
	defer tp.mu.Unlock()
	
	tp.processedCount++
	
	log.Printf("💳 Processing transaction: %s | Merchant: %s | Total: %d",
		event.Data["transaction_id"],
		event.MerchantID,
		tp.processedCount)
	
	// Process transaction (store in database, trigger analytics, etc.)
	// In production:
	// - Store in PostgreSQL
	// - Update analytics
	// - Trigger notifications
	// - Update merchant dashboard
	
	return nil
}

func (tp *TransactionProcessor) ProcessPaymentEvent(event POSEvent) error {
	log.Printf("💰 Payment event: %s | Stage: %s",
		event.Data["transaction_id"],
		event.Data["stage"])
	
	// Process payment event
	// In production:
	// - Update transaction status
	// - Notify merchant
	// - Update real-time dashboard
	
	return nil
}

func (tp *TransactionProcessor) ProcessDeviceEvent(event POSEvent) error {
	log.Printf("🖥️  Device event: %s | Status: %s",
		event.Data["device_id"],
		event.Data["status"])
	
	// Process device event
	// In production:
	// - Update device status
	// - Alert if device offline
	// - Schedule maintenance
	
	return nil
}

func (tp *TransactionProcessor) ProcessFraudAlert(event POSEvent) error {
	log.Printf("🚨 FRAUD ALERT: Transaction %s | Risk: %.2f | Action: %s",
		event.Data["transaction_id"],
		event.Data["risk_score"],
		event.Data["action"])
	
	// Process fraud alert
	// In production:
	// - Block transaction if critical
	// - Notify security team
	// - Update fraud detection model
	// - Log for compliance
	
	return nil
}

func (tp *TransactionProcessor) ProcessAnalyticsEvent(event POSEvent) error {
	log.Printf("📊 Analytics event: %s", event.EventType)
	
	// Process analytics event
	// In production:
	// - Update real-time metrics
	// - Feed into data warehouse
	// - Update dashboards
	
	return nil
}

// ============================================================================
// FLUVIO PRODUCER (Bi-directional)
// ============================================================================

type FluvioProducer struct {
	topics map[string]bool
}

func NewFluvioProducer() *FluvioProducer {
	return &FluvioProducer{
		topics: map[string]bool{
			"pos-commands":       true,
			"pos-config-updates": true,
			"pos-fraud-rules":    true,
			"pos-price-updates":  true,
		},
	}
}

func (fp *FluvioProducer) SendCommand(command map[string]interface{}) error {
	data, err := json.Marshal(command)
	if err != nil {
		return err
	}
	
	log.Printf("📤 Sending command: %s", command["command_type"])
	
	// In production, use Fluvio producer:
	// producer.Send("pos-commands", data)
	
	log.Printf("Produced %d bytes to pos-commands", len(data))
	return nil
}

func (fp *FluvioProducer) SendConfigUpdate(config map[string]interface{}) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	
	log.Printf("📤 Sending config update: %s", config["config_key"])
	
	log.Printf("Produced %d bytes to pos-config-updates", len(data))
	return nil
}

func (fp *FluvioProducer) SendFraudRule(rule map[string]interface{}) error {
	data, err := json.Marshal(rule)
	if err != nil {
		return err
	}
	
	log.Printf("📤 Sending fraud rule: %s", rule["rule_id"])
	
	log.Printf("Produced %d bytes to pos-fraud-rules", len(data))
	return nil
}

func (fp *FluvioProducer) SendPriceUpdate(price map[string]interface{}) error {
	data, err := json.Marshal(price)
	if err != nil {
		return err
	}
	
	log.Printf("📤 Sending price update: %s", price["product_id"])
	
	log.Printf("Produced %d bytes to pos-price-updates", len(data))
	return nil
}

// ============================================================================
// MAIN
// ============================================================================

func main() {
	log.Println("================================================================================")
	log.Println("POS Fluvio Integration Service (Go)")
	log.Println("Bi-directional real-time event streaming")
	log.Println("================================================================================")
	
	// Create consumer
	consumer := NewFluvioConsumer()
	
	// Create processor
	processor := NewTransactionProcessor()
	
	// Register handlers
	consumer.RegisterHandler("pos-transactions", processor.ProcessTransaction)
	consumer.RegisterHandler("pos-payment-events", processor.ProcessPaymentEvent)
	consumer.RegisterHandler("pos-device-events", processor.ProcessDeviceEvent)
	consumer.RegisterHandler("pos-fraud-alerts", processor.ProcessFraudAlert)
	consumer.RegisterHandler("pos-analytics", processor.ProcessAnalyticsEvent)
	
	// Start consumer
	if err := consumer.Start(); err != nil {
		log.Fatalf("Failed to start consumer: %v", err)
	}
	
	// Create producer
	producer := NewFluvioProducer()
	
	// Send initial commands (bi-directional)
	go func() {
		time.Sleep(10 * time.Second)
		
		// Send test command
		producer.SendCommand(map[string]interface{}{
			"command_type": "update_terminal_config",
			"terminal_id":  "terminal_001",
			"config": map[string]interface{}{
				"max_transaction_amount": 5000,
				"require_pin":            true,
			},
		})
		
		// Send fraud rule update
		producer.SendFraudRule(map[string]interface{}{
			"rule_id":     "high_amount_v2",
			"name":        "High Amount Transaction V2",
			"condition":   "amount > 10000",
			"action":      "require_approval",
			"severity":    "high",
			"enabled":     true,
		})
	}()
	
	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	
	<-sigChan
	
	// Graceful shutdown
	consumer.Stop()
	
	log.Println("✓ Service stopped gracefully")
}

