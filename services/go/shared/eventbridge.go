package shared

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type ServiceEvent struct {
	ID            string                 `json:"id"`
	Source        string                 `json:"source"`
	Type          string                 `json:"type"`
	Data          map[string]interface{} `json:"data"`
	CorrelationID string                 `json:"correlation_id"`
	Timestamp     int64                  `json:"timestamp"`
}

type EventSubscription struct {
	EventType string
	Handler   func(ServiceEvent)
}

type EventBridge struct {
	mu            sync.RWMutex
	subscriptions map[string][]func(ServiceEvent)
	eventLog      []ServiceEvent
	logger        *StructuredLogger
	kafkaURL      string
	fluvioURL     string
	httpClient    *HTTPClient
}

func NewEventBridge(serviceName, kafkaURL, fluvioURL string) *EventBridge {
	return &EventBridge{
		subscriptions: make(map[string][]func(ServiceEvent)),
		logger:        NewLogger(serviceName + "-eventbridge"),
		kafkaURL:      kafkaURL,
		fluvioURL:     fluvioURL,
		httpClient:    NewHTTPClient(serviceName+"-events", 10*time.Second, 5),
	}
}

func (eb *EventBridge) Subscribe(eventType string, handler func(ServiceEvent)) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	eb.subscriptions[eventType] = append(eb.subscriptions[eventType], handler)
}

func (eb *EventBridge) Publish(event ServiceEvent) error {
	event.Timestamp = time.Now().UnixMilli()
	if event.ID == "" {
		event.ID = fmt.Sprintf("evt-%d", time.Now().UnixNano())
	}

	eb.mu.Lock()
	eb.eventLog = append(eb.eventLog, event)
	if len(eb.eventLog) > 10000 {
		eb.eventLog = eb.eventLog[5000:]
	}
	handlers := eb.subscriptions[event.Type]
	eb.mu.Unlock()

	for _, handler := range handlers {
		go handler(event)
	}

	go eb.forwardToKafka(event)
	go eb.forwardToFluvio(event)

	return nil
}

func (eb *EventBridge) forwardToKafka(event ServiceEvent) {
	if eb.kafkaURL == "" {
		return
	}
	topicMap := map[string]string{
		"transaction.created":  "transactions.created",
		"transaction.updated":  "transactions.updated",
		"payment.initiated":    "payments.initiated",
		"payment.completed":    "payments.completed",
		"payment.failed":       "payments.failed",
		"account.created":      "accounts.created",
		"account.updated":      "accounts.updated",
		"kyc.submitted":        "kyc.submitted",
		"kyc.approved":         "kyc.approved",
		"auth.login":           "auth.login",
		"auth.logout":          "auth.logout",
		"fraud.detected":       "fraud.detected",
		"notification.sent":    "notifications.sent",
	}
	topic, exists := topicMap[event.Type]
	if !exists {
		topic = "events.general"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"topic":   topic,
		"key":     event.CorrelationID,
		"value":   event.Data,
		"headers": map[string]string{"source": event.Source, "event_type": event.Type, "correlation_id": event.CorrelationID},
	})

	req, _ := http.NewRequest("POST", eb.kafkaURL+"/produce", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Correlation-ID", event.CorrelationID)

	RetryWithBackoff(2, 500*time.Millisecond, func() error {
		resp, err := eb.httpClient.Do(req)
		if err != nil {
			return err
		}
		resp.Body.Close()
		return nil
	})
}

func (eb *EventBridge) forwardToFluvio(event ServiceEvent) {
	if eb.fluvioURL == "" {
		return
	}
	streamMap := map[string]string{
		"transaction.created": "transaction-stream",
		"transaction.updated": "transaction-stream",
		"payment.initiated":   "payment-events",
		"payment.completed":   "payment-events",
		"account.created":     "account-changes",
		"account.updated":     "account-changes",
		"fraud.detected":      "fraud-signals",
		"auth.login":          "user-activity",
		"auth.logout":         "user-activity",
	}
	topic, exists := streamMap[event.Type]
	if !exists {
		return
	}

	body, _ := json.Marshal(map[string]interface{}{
		"topic": topic,
		"key":   event.CorrelationID,
		"value": event.Data,
	})

	req, _ := http.NewRequest("POST", eb.fluvioURL+"/produce", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	RetryWithBackoff(2, 500*time.Millisecond, func() error {
		resp, err := eb.httpClient.Do(req)
		if err != nil {
			return err
		}
		resp.Body.Close()
		return nil
	})
}

func (eb *EventBridge) GetEventLog(limit int) []ServiceEvent {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	start := 0
	if len(eb.eventLog) > limit {
		start = len(eb.eventLog) - limit
	}
	result := make([]ServiceEvent, len(eb.eventLog[start:]))
	copy(result, eb.eventLog[start:])
	return result
}

type DataPipeline struct {
	logger       *StructuredLogger
	kafkaURL     string
	fluvioURL    string
	lakehouseURL string
	httpClient   *HTTPClient
}

func NewDataPipeline(kafkaURL, fluvioURL, lakehouseURL string) *DataPipeline {
	return &DataPipeline{
		logger:       NewLogger("data-pipeline"),
		kafkaURL:     kafkaURL,
		fluvioURL:    fluvioURL,
		lakehouseURL: lakehouseURL,
		httpClient:   NewHTTPClient("data-pipeline", 30*time.Second, 5),
	}
}

func (dp *DataPipeline) StartCDCPipeline() {
	dp.logger.Info("Starting CDC pipeline: Kafka -> Fluvio -> Lakehouse", nil)
	go dp.pollAndForward()
}

func (dp *DataPipeline) pollAndForward() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	topics := []string{"transactions.created", "transactions.updated", "payments.initiated", "payments.completed", "accounts.created"}

	for range ticker.C {
		for _, topic := range topics {
			dp.processTopicBatch(topic)
		}
	}
}

func (dp *DataPipeline) processTopicBatch(topic string) {
	if dp.kafkaURL == "" {
		return
	}

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/consume?topic=%s&limit=100", dp.kafkaURL, topic), nil)
	resp, err := dp.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var records []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&records)

	if len(records) == 0 {
		return
	}

	if dp.fluvioURL != "" {
		streamTopic := dp.mapToFluvioTopic(topic)
		for _, record := range records {
			body, _ := json.Marshal(map[string]interface{}{
				"topic": streamTopic,
				"key":   record["key"],
				"value": record["value"],
			})
			req, _ := http.NewRequest("POST", dp.fluvioURL+"/produce", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			dp.httpClient.Do(req)
		}
	}
}

func (dp *DataPipeline) mapToFluvioTopic(kafkaTopic string) string {
	mapping := map[string]string{
		"transactions.created": "transaction-stream",
		"transactions.updated": "transaction-stream",
		"payments.initiated":   "payment-events",
		"payments.completed":   "payment-events",
		"accounts.created":     "account-changes",
	}
	if t, ok := mapping[kafkaTopic]; ok {
		return t
	}
	return "general-stream"
}
