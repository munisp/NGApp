package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8219")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "ALL — manages 48 topics across 12 domains"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "consumer-offset-cache,dlq-retry-tracker"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "kafka_topics,consumer_groups,dlq_messages,event_schemas"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "event-audit-trail"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476")},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "kafka-management"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "purpose": "secondary-stream-processor"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "DLQRetryWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000")},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000")},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "event_archive,consumer_metrics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/kafka/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type Topic struct {
	Name         string `json:"name"`
	Domain       string `json:"domain"`
	Partitions   int    `json:"partitions"`
	Replication  int    `json:"replicationFactor"`
	RetentionMs  int64  `json:"retentionMs"`
	Consumers    int    `json:"activeConsumers"`
	MsgRate      float64 `json:"messagesPerSecond"`
	TotalMsgs    int64  `json:"totalMessages"`
	Schema       string `json:"schemaType"`
}

type ConsumerGroup struct {
	ID        string `json:"id"`
	Topic     string `json:"topic"`
	Members   int    `json:"members"`
	Lag       int64  `json:"consumerLag"`
	Status    string `json:"status"`
	Strategy  string `json:"assignmentStrategy"`
}

type DLQMessage struct {
	ID          string `json:"id"`
	OrigTopic   string `json:"originalTopic"`
	Error       string `json:"error"`
	RetryCount  int    `json:"retryCount"`
	MaxRetries  int    `json:"maxRetries"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

var (
	topics []Topic
	groups []ConsumerGroup
	dlq    []DLQMessage
	mu     sync.RWMutex
)

func init() {
	topics = []Topic{
		{Name: "payments.nip-transfer", Domain: "payments", Partitions: 12, Replication: 3, RetentionMs: 604800000, Consumers: 4, MsgRate: 245.8, TotalMsgs: 12500000, Schema: "avro"},
		{Name: "payments.neft-batch", Domain: "payments", Partitions: 6, Replication: 3, RetentionMs: 604800000, Consumers: 2, MsgRate: 12.3, TotalMsgs: 890000, Schema: "avro"},
		{Name: "payments.rtgs-transfer", Domain: "payments", Partitions: 3, Replication: 3, RetentionMs: 2592000000, Consumers: 2, MsgRate: 1.5, TotalMsgs: 45000, Schema: "avro"},
		{Name: "accounts.opened", Domain: "accounts", Partitions: 6, Replication: 3, RetentionMs: 2592000000, Consumers: 5, MsgRate: 8.2, TotalMsgs: 4500000, Schema: "avro"},
		{Name: "accounts.status-changed", Domain: "accounts", Partitions: 6, Replication: 3, RetentionMs: 2592000000, Consumers: 3, MsgRate: 15.4, TotalMsgs: 8900000, Schema: "avro"},
		{Name: "loans.disbursed", Domain: "lending", Partitions: 6, Replication: 3, RetentionMs: 2592000000, Consumers: 4, MsgRate: 3.2, TotalMsgs: 850000, Schema: "avro"},
		{Name: "loans.repayment-received", Domain: "lending", Partitions: 6, Replication: 3, RetentionMs: 604800000, Consumers: 3, MsgRate: 18.7, TotalMsgs: 5600000, Schema: "avro"},
		{Name: "eod.interest-accrual", Domain: "eod", Partitions: 12, Replication: 3, RetentionMs: 86400000, Consumers: 1, MsgRate: 0.0, TotalMsgs: 365, Schema: "json"},
		{Name: "eod.gl-balancing", Domain: "eod", Partitions: 3, Replication: 3, RetentionMs: 86400000, Consumers: 1, MsgRate: 0.0, TotalMsgs: 365, Schema: "json"},
		{Name: "fx.rate-updated", Domain: "treasury", Partitions: 3, Replication: 3, RetentionMs: 2592000000, Consumers: 6, MsgRate: 0.8, TotalMsgs: 120000, Schema: "avro"},
		{Name: "compliance.aml-alert", Domain: "compliance", Partitions: 3, Replication: 3, RetentionMs: 31536000000, Consumers: 2, MsgRate: 0.3, TotalMsgs: 12000, Schema: "avro"},
		{Name: "audit.action-logged", Domain: "audit", Partitions: 12, Replication: 3, RetentionMs: 31536000000, Consumers: 2, MsgRate: 125.0, TotalMsgs: 45000000, Schema: "json"},
	}

	groups = []ConsumerGroup{
		{ID: "payments-processor", Topic: "payments.nip-transfer", Members: 4, Lag: 128, Status: "stable", Strategy: "cooperative-sticky"},
		{ID: "notification-sender", Topic: "payments.nip-transfer", Members: 2, Lag: 45, Status: "stable", Strategy: "range"},
		{ID: "account-event-handler", Topic: "accounts.opened", Members: 3, Lag: 0, Status: "stable", Strategy: "cooperative-sticky"},
		{ID: "loan-lifecycle-processor", Topic: "loans.disbursed", Members: 2, Lag: 5, Status: "stable", Strategy: "range"},
		{ID: "eod-orchestrator", Topic: "eod.interest-accrual", Members: 1, Lag: 0, Status: "idle", Strategy: "range"},
		{ID: "compliance-monitor", Topic: "compliance.aml-alert", Members: 2, Lag: 0, Status: "stable", Strategy: "range"},
		{ID: "audit-indexer", Topic: "audit.action-logged", Members: 2, Lag: 1250, Status: "catching-up", Strategy: "cooperative-sticky"},
	}

	dlq = []DLQMessage{
		{ID: "DLQ-001", OrigTopic: "payments.nip-transfer", Error: "downstream-timeout: NIBSS NIP gateway unreachable", RetryCount: 3, MaxRetries: 5, Status: "pending-retry", CreatedAt: "2026-05-10T14:23:00Z"},
		{ID: "DLQ-002", OrigTopic: "loans.repayment-received", Error: "validation-failed: repayment exceeds outstanding balance", RetryCount: 5, MaxRetries: 5, Status: "exhausted", CreatedAt: "2026-05-10T11:05:00Z"},
		{ID: "DLQ-003", OrigTopic: "compliance.aml-alert", Error: "enrichment-failed: customer 360 service unavailable", RetryCount: 2, MaxRetries: 5, Status: "pending-retry", CreatedAt: "2026-05-10T16:00:00Z"},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "kafka-streaming")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		totalMsgRate := 0.0
		for _, t := range topics { totalMsgRate += t.MsgRate }
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "kafka-streaming",
			"cluster": map[string]interface{}{"topics": len(topics), "consumerGroups": len(groups), "dlqMessages": len(dlq), "totalMsgPerSec": totalMsgRate},
			"middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/topics", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": topics, "total": len(topics)}) })
	mux.HandleFunc("/v1/consumer-groups", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": groups, "total": len(groups)}) })
	mux.HandleFunc("/v1/dlq", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": dlq, "total": len(dlq)}) })
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		totalMsgs := int64(0); totalMsgRate := 0.0; totalLag := int64(0)
		for _, t := range topics { totalMsgs += t.TotalMsgs; totalMsgRate += t.MsgRate }
		for _, g := range groups { totalLag += g.Lag }
		jsonResponse(w, 200, map[string]interface{}{
			"totalTopics": len(topics), "totalConsumerGroups": len(groups), "totalMessages": totalMsgs,
			"totalMsgPerSec": totalMsgRate, "totalConsumerLag": totalLag, "dlqMessages": len(dlq),
			"domains": []string{"payments", "accounts", "lending", "eod", "treasury", "compliance", "audit"},
			"schemaRegistry": map[string]int{"avro": 9, "json": 3}, "deliveryGuarantee": "at-least-once",
		})
	})

	log.Printf("[kafka-streaming] Listening on :%s with %d topics, %d consumer groups, %d DLQ messages\n", port, len(topics), len(groups), len(dlq))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
