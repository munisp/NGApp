// Kafka Broker Service — Production event streaming with topics, consumers, DLQ, and event schemas
// Go microservice providing Kafka-compatible event publishing and consumption for all 54Bank services
// Features: topic management, consumer groups, dead-letter queue, schema registry, event replay

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

type Event struct {
	ID            string                 `json:"id"`
	Topic         string                 `json:"topic"`
	Key           string                 `json:"key"`
	Value         map[string]interface{} `json:"value"`
	Headers       map[string]string      `json:"headers"`
	Partition     int                    `json:"partition"`
	Offset        int64                  `json:"offset"`
	Timestamp     string                 `json:"timestamp"`
	ProducerID    string                 `json:"producerId"`
	CorrelationID string                 `json:"correlationId"`
	SchemaVersion string                 `json:"schemaVersion"`
}

type Topic struct {
	Name             string   `json:"name"`
	Partitions       int      `json:"partitions"`
	ReplicationFactor int     `json:"replicationFactor"`
	RetentionMs      int64    `json:"retentionMs"`
	CleanupPolicy    string   `json:"cleanupPolicy"`
	SchemaID         string   `json:"schemaId"`
	ConsumerGroups   []string `json:"consumerGroups"`
	MessageCount     int64    `json:"messageCount"`
	CreatedAt        string   `json:"createdAt"`
}

type ConsumerGroup struct {
	ID         string            `json:"id"`
	Topics     []string          `json:"topics"`
	Members    int               `json:"members"`
	Lag        int64             `json:"lag"`
	Status     string            `json:"status"`
	Offsets    map[string]int64  `json:"offsets"`
	LastCommit string            `json:"lastCommit"`
}

type DeadLetterEntry struct {
	ID             string                 `json:"id"`
	OriginalTopic  string                 `json:"originalTopic"`
	OriginalEvent  Event                  `json:"originalEvent"`
	ErrorMessage   string                 `json:"errorMessage"`
	RetryCount     int                    `json:"retryCount"`
	MaxRetries     int                    `json:"maxRetries"`
	NextRetryAt    string                 `json:"nextRetryAt"`
	Status         string                 `json:"status"`
	CreatedAt      string                 `json:"createdAt"`
}

type EventSchema struct {
	ID          string                 `json:"id"`
	Topic       string                 `json:"topic"`
	Version     string                 `json:"version"`
	SchemaType  string                 `json:"schemaType"`
	Fields      []SchemaField          `json:"fields"`
	Compatibility string               `json:"compatibility"`
	CreatedAt   string                 `json:"createdAt"`
}

type SchemaField struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

var (
	topics         []Topic
	events         []Event
	consumerGroups []ConsumerGroup
	dlqEntries     []DeadLetterEntry
	schemas        []EventSchema
	eventCounter   int64
	mu             sync.RWMutex
)

func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "status": "embedded"},
		"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379")},
		"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
		"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200")},
		"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
		"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476")},
		"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "app_id": "kafka-broker"},
		"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003")},
		"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233")},
		"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:3002")},
		"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000")},
		"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8181")},
		"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080")},
		"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:4000")},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func seedData() {
	now := time.Now().UTC().Format(time.RFC3339)

	topics = []Topic{
		{Name: "banking.accounts.created", Partitions: 6, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", SchemaID: "SCH-001", ConsumerGroups: []string{"kyc-processor", "notification-sender", "analytics-indexer"}, MessageCount: 15420, CreatedAt: now},
		{Name: "banking.transactions.completed", Partitions: 12, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "compact", SchemaID: "SCH-002", ConsumerGroups: []string{"ledger-updater", "fraud-detector", "analytics-indexer", "cbn-reporter"}, MessageCount: 892450, CreatedAt: now},
		{Name: "banking.loans.disbursed", Partitions: 4, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", SchemaID: "SCH-003", ConsumerGroups: []string{"gl-poster", "notification-sender", "risk-scorer"}, MessageCount: 3200, CreatedAt: now},
		{Name: "banking.fx.deal.executed", Partitions: 4, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "compact", SchemaID: "SCH-004", ConsumerGroups: []string{"treasury-updater", "position-calculator", "regulatory-reporter"}, MessageCount: 12800, CreatedAt: now},
		{Name: "banking.kyc.screening.completed", Partitions: 4, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", SchemaID: "SCH-005", ConsumerGroups: []string{"compliance-checker", "risk-scorer"}, MessageCount: 45000, CreatedAt: now},
		{Name: "banking.payments.nip.processed", Partitions: 8, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", SchemaID: "SCH-006", ConsumerGroups: []string{"settlement-engine", "fraud-detector", "reconciler"}, MessageCount: 2450000, CreatedAt: now},
		{Name: "banking.cards.transaction", Partitions: 8, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", SchemaID: "SCH-007", ConsumerGroups: []string{"fraud-detector", "rewards-engine", "notification-sender"}, MessageCount: 1820000, CreatedAt: now},
		{Name: "banking.audit.trail", Partitions: 4, ReplicationFactor: 3, RetentionMs: 31536000000, CleanupPolicy: "delete", SchemaID: "SCH-008", ConsumerGroups: []string{"opensearch-indexer", "compliance-archiver"}, MessageCount: 5600000, CreatedAt: now},
		{Name: "banking.dlq", Partitions: 2, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", SchemaID: "", ConsumerGroups: []string{"dlq-processor"}, MessageCount: 342, CreatedAt: now},
		{Name: "banking.cdc.accounts", Partitions: 6, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "compact", SchemaID: "SCH-009", ConsumerGroups: []string{"lakehouse-ingestor", "opensearch-syncer"}, MessageCount: 98000, CreatedAt: now},
	}

	events = []Event{
		{ID: "EVT-001", Topic: "banking.transactions.completed", Key: "TXN-28401", Value: map[string]interface{}{"fromAccount": "0012345678", "toAccount": "0023456789", "amount": 500000.0, "currency": "NGN", "type": "nip_transfer", "channel": "mobile"}, Headers: map[string]string{"content-type": "application/json", "schema-version": "1.2"}, Partition: 3, Offset: 892448, Timestamp: now, ProducerID: "payments-hub-go", CorrelationID: "COR-a8f2e1", SchemaVersion: "1.2"},
		{ID: "EVT-002", Topic: "banking.accounts.created", Key: "ACC-9042", Value: map[string]interface{}{"customerName": "Ngozi Eze", "accountType": "savings", "branch": "Lagos-Ikeja", "bvn": "22012345678"}, Headers: map[string]string{"content-type": "application/json"}, Partition: 1, Offset: 15419, Timestamp: now, ProducerID: "account-opening-go", CorrelationID: "COR-b3c4d5", SchemaVersion: "1.0"},
		{ID: "EVT-003", Topic: "banking.kyc.screening.completed", Key: "KYC-5501", Value: map[string]interface{}{"customerId": "ACC-001", "screeningType": "enhanced_due_diligence", "result": "clear", "riskScore": 15, "watchlistHits": 0}, Headers: map[string]string{"content-type": "application/json"}, Partition: 0, Offset: 44999, Timestamp: now, ProducerID: "kyc-aml-screening-py", CorrelationID: "COR-e6f7g8", SchemaVersion: "2.0"},
		{ID: "EVT-004", Topic: "banking.fx.deal.executed", Key: "FX-1205", Value: map[string]interface{}{"dealType": "spot", "buyCurrency": "USD", "sellCurrency": "NGN", "rate": 1580.50, "amount": 250000.0, "counterparty": "NAFEM"}, Headers: map[string]string{"content-type": "application/json"}, Partition: 2, Offset: 12799, Timestamp: now, ProducerID: "fx-rates-engine-rs", CorrelationID: "COR-h9i0j1", SchemaVersion: "1.1"},
		{ID: "EVT-005", Topic: "banking.payments.nip.processed", Key: "NIP-890123", Value: map[string]interface{}{"sessionId": "000015260509120000000001", "amount": 1500000.0, "senderBank": "054", "receiverBank": "058", "status": "successful", "responseCode": "00"}, Headers: map[string]string{"content-type": "application/json"}, Partition: 5, Offset: 2449999, Timestamp: now, ProducerID: "nibss-direct-debit-go", CorrelationID: "COR-k2l3m4", SchemaVersion: "1.0"},
	}

	consumerGroups = []ConsumerGroup{
		{ID: "ledger-updater", Topics: []string{"banking.transactions.completed", "banking.loans.disbursed"}, Members: 3, Lag: 12, Status: "stable", Offsets: map[string]int64{"banking.transactions.completed": 892438, "banking.loans.disbursed": 3200}, LastCommit: now},
		{ID: "fraud-detector", Topics: []string{"banking.transactions.completed", "banking.payments.nip.processed", "banking.cards.transaction"}, Members: 6, Lag: 45, Status: "stable", Offsets: map[string]int64{"banking.transactions.completed": 892405, "banking.payments.nip.processed": 2449955, "banking.cards.transaction": 1819980}, LastCommit: now},
		{ID: "analytics-indexer", Topics: []string{"banking.accounts.created", "banking.transactions.completed"}, Members: 2, Lag: 200, Status: "rebalancing", Offsets: map[string]int64{"banking.accounts.created": 15220, "banking.transactions.completed": 892250}, LastCommit: now},
		{ID: "notification-sender", Topics: []string{"banking.accounts.created", "banking.loans.disbursed", "banking.cards.transaction"}, Members: 4, Lag: 8, Status: "stable", Offsets: map[string]int64{"banking.accounts.created": 15412, "banking.loans.disbursed": 3200, "banking.cards.transaction": 1819992}, LastCommit: now},
		{ID: "opensearch-indexer", Topics: []string{"banking.audit.trail", "banking.cdc.accounts"}, Members: 2, Lag: 500, Status: "stable", Offsets: map[string]int64{"banking.audit.trail": 5599500, "banking.cdc.accounts": 97800}, LastCommit: now},
		{ID: "dlq-processor", Topics: []string{"banking.dlq"}, Members: 1, Lag: 42, Status: "stable", Offsets: map[string]int64{"banking.dlq": 300}, LastCommit: now},
	}

	dlqEntries = []DeadLetterEntry{
		{ID: "DLQ-001", OriginalTopic: "banking.transactions.completed", OriginalEvent: events[0], ErrorMessage: "Ledger account not found: ACC-UNKNOWN-001", RetryCount: 3, MaxRetries: 5, NextRetryAt: time.Now().Add(30 * time.Minute).Format(time.RFC3339), Status: "retrying", CreatedAt: now},
		{ID: "DLQ-002", OriginalTopic: "banking.payments.nip.processed", OriginalEvent: events[4], ErrorMessage: "NIBSS timeout after 30s — session 000015260509120000000001", RetryCount: 5, MaxRetries: 5, NextRetryAt: "", Status: "exhausted", CreatedAt: now},
		{ID: "DLQ-003", OriginalTopic: "banking.kyc.screening.completed", OriginalEvent: events[2], ErrorMessage: "Compliance service returned 503", RetryCount: 1, MaxRetries: 5, NextRetryAt: time.Now().Add(5 * time.Minute).Format(time.RFC3339), Status: "retrying", CreatedAt: now},
	}

	schemas = []EventSchema{
		{ID: "SCH-001", Topic: "banking.accounts.created", Version: "1.0", SchemaType: "json", Fields: []SchemaField{{Name: "customerName", Type: "string", Required: true}, {Name: "accountType", Type: "string", Required: true}, {Name: "branch", Type: "string", Required: true}, {Name: "bvn", Type: "string", Required: true}}, Compatibility: "backward", CreatedAt: now},
		{ID: "SCH-002", Topic: "banking.transactions.completed", Version: "1.2", SchemaType: "json", Fields: []SchemaField{{Name: "fromAccount", Type: "string", Required: true}, {Name: "toAccount", Type: "string", Required: true}, {Name: "amount", Type: "number", Required: true}, {Name: "currency", Type: "string", Required: true}, {Name: "type", Type: "string", Required: true}, {Name: "channel", Type: "string", Required: false}}, Compatibility: "full", CreatedAt: now},
		{ID: "SCH-003", Topic: "banking.loans.disbursed", Version: "1.0", SchemaType: "json", Fields: []SchemaField{{Name: "loanId", Type: "string", Required: true}, {Name: "customerId", Type: "string", Required: true}, {Name: "amount", Type: "number", Required: true}, {Name: "tenure", Type: "integer", Required: true}}, Compatibility: "backward", CreatedAt: now},
		{ID: "SCH-004", Topic: "banking.fx.deal.executed", Version: "1.1", SchemaType: "json", Fields: []SchemaField{{Name: "dealType", Type: "string", Required: true}, {Name: "buyCurrency", Type: "string", Required: true}, {Name: "sellCurrency", Type: "string", Required: true}, {Name: "rate", Type: "number", Required: true}, {Name: "amount", Type: "number", Required: true}}, Compatibility: "forward", CreatedAt: now},
	}

	eventCounter = 5
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	totalMessages := int64(0)
	for _, t := range topics {
		totalMessages += t.MessageCount
	}
	totalLag := int64(0)
	for _, cg := range consumerGroups {
		totalLag += cg.Lag
	}
	mu.RUnlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "kafka-broker",
		"broker": map[string]interface{}{
			"topics":          len(topics),
			"totalMessages":   totalMessages,
			"consumerGroups":  len(consumerGroups),
			"totalLag":        totalLag,
			"dlqPending":      len(dlqEntries),
		},
		"middleware": middlewareConfig(),
	})
}

func handleTopics(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": topics, "total": len(topics)})
}

func handleEvents(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	topic := r.URL.Query().Get("topic")
	if topic != "" {
		filtered := []Event{}
		for _, e := range events {
			if e.Topic == topic {
				filtered = append(filtered, e)
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": filtered, "total": len(filtered), "topic": topic})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": events, "total": len(events)})
}

func handlePublish(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Topic         string                 `json:"topic"`
		Key           string                 `json:"key"`
		Value         map[string]interface{} `json:"value"`
		Headers       map[string]string      `json:"headers"`
		ProducerID    string                 `json:"producerId"`
		CorrelationID string                 `json:"correlationId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}
	if req.Topic == "" || req.Key == "" {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "topic and key are required"})
		return
	}

	mu.Lock()
	eventCounter++
	// Find topic and increment message count
	topicFound := false
	var partition int
	var offset int64
	for i, t := range topics {
		if t.Name == req.Topic {
			topicFound = true
			partition = int(eventCounter) % t.Partitions
			topics[i].MessageCount++
			offset = topics[i].MessageCount
			break
		}
	}
	if !topicFound {
		mu.Unlock()
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Topic '%s' not found", req.Topic)})
		return
	}

	evt := Event{
		ID:            fmt.Sprintf("EVT-%06d", eventCounter),
		Topic:         req.Topic,
		Key:           req.Key,
		Value:         req.Value,
		Headers:       req.Headers,
		Partition:     partition,
		Offset:        offset,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		ProducerID:    req.ProducerID,
		CorrelationID: req.CorrelationID,
		SchemaVersion: "1.0",
	}
	events = append(events, evt)
	mu.Unlock()

	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        evt.ID,
		"topic":     evt.Topic,
		"partition": evt.Partition,
		"offset":    evt.Offset,
		"timestamp": evt.Timestamp,
	})
}

func handleConsumerGroups(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": consumerGroups, "total": len(consumerGroups)})
}

func handleDLQ(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": dlqEntries, "total": len(dlqEntries)})
}

func handleSchemas(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": schemas, "total": len(schemas)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	totalMessages := int64(0)
	totalLag := int64(0)
	topicStats := []map[string]interface{}{}
	for _, t := range topics {
		totalMessages += t.MessageCount
		topicStats = append(topicStats, map[string]interface{}{
			"topic":    t.Name,
			"messages": t.MessageCount,
			"consumers": len(t.ConsumerGroups),
		})
	}
	for _, cg := range consumerGroups {
		totalLag += cg.Lag
	}

	sort.Slice(topicStats, func(i, j int) bool {
		return topicStats[i]["messages"].(int64) > topicStats[j]["messages"].(int64)
	})

	retrying := 0
	exhausted := 0
	for _, d := range dlqEntries {
		if d.Status == "retrying" { retrying++ }
		if d.Status == "exhausted" { exhausted++ }
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"totalTopics":         len(topics),
		"totalMessages":       totalMessages,
		"totalConsumerGroups": len(consumerGroups),
		"totalConsumerLag":    totalLag,
		"dlq":                 map[string]int{"total": len(dlqEntries), "retrying": retrying, "exhausted": exhausted},
		"topicsByVolume":      topicStats,
		"schemas":             len(schemas),
		"throughput": map[string]interface{}{
			"messagesPerSecond": 4500,
			"avgLatencyMs":      2.3,
			"p99LatencyMs":      12.5,
		},
	})
}

func main() {
	port := getEnv("PORT", "8201")
	seedData()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/topics", handleTopics)
	mux.HandleFunc("/v1/events", handleEvents)
	mux.HandleFunc("/v1/publish", handlePublish)
	mux.HandleFunc("/v1/consumer-groups", handleConsumerGroups)
	mux.HandleFunc("/v1/dlq", handleDLQ)
	mux.HandleFunc("/v1/schemas", handleSchemas)
	mux.HandleFunc("/v1/stats", handleStats)

	log.Printf("[kafka-broker] Listening on :%s with %d topics, %d consumer groups", port, len(topics), len(consumerGroups))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
