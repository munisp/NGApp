package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// TigerBeetle ↔ Postgres Sync Service (Go)
// Port: 8263
// Event-driven sync via Kafka CDC + Balance Cache via Redis
// Middleware: Kafka, Redis, Postgres, TigerBeetle, Dapr, Temporal, OpenSearch, Lakehouse

type SyncConfig struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Direction         string `json:"direction"` // tb_to_pg, pg_to_tb, bidirectional
	TigerBeetleLedger int    `json:"tigerbeetleLedger"`
	PostgresTable     string `json:"postgresTable"`
	KafkaTopic        string `json:"kafkaTopic"`
	ConsumerGroup     string `json:"consumerGroup"`
	BatchSize         int    `json:"batchSize"`
	FlushIntervalMs   int    `json:"flushIntervalMs"`
	Status            string `json:"status"`
	EventsProcessed   int64  `json:"eventsProcessed"`
	LastProcessedAt   string `json:"lastProcessedAt"`
}

type SyncEvent struct {
	ID            string                 `json:"id"`
	Direction     string                 `json:"direction"`
	EventType     string                 `json:"eventType"`
	SourceEntity  string                 `json:"sourceEntity"`
	TargetEntity  string                 `json:"targetEntity"`
	Status        string                 `json:"status"`
	KafkaTopic    string                 `json:"kafkaTopic"`
	KafkaOffset   int64                  `json:"kafkaOffset"`
	Payload       map[string]interface{} `json:"payload"`
	RetryCount    int                    `json:"retryCount"`
	LatencyMs     float64                `json:"latencyMs"`
	CreatedAt     string                 `json:"createdAt"`
	SyncedAt      *string                `json:"syncedAt"`
}

type BalanceCacheEntry struct {
	AccountID        string  `json:"accountId"`
	AvailableBalance int64   `json:"availableBalance"`
	LedgerBalance    int64   `json:"ledgerBalance"`
	HoldAmount       int64   `json:"holdAmount"`
	Currency         string  `json:"currency"`
	CacheHit         bool    `json:"cacheHit"`
	CacheTTL         int     `json:"cacheTTLSeconds"`
	SourceOfTruth    string  `json:"sourceOfTruth"`
	LastRefreshedAt  string  `json:"lastRefreshedAt"`
}

var (
	syncConfigs []SyncConfig
	syncEvents  []SyncEvent
	cacheEntries []BalanceCacheEntry
	mu          sync.RWMutex
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]interface{}{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "tb.transfers.committed,cdc.core-banking.accounts,cdc.lending.disbursements"},
		"redis":       map[string]interface{}{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "balance-cache,sync-state"},
		"postgres":    map[string]interface{}{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "account_balances,gl_journal_entries,sync_audit_log"},
		"tigerbeetle": map[string]interface{}{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "source-of-truth-ledger"},
		"dapr":        map[string]interface{}{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "sync-events"},
		"temporal":    map[string]interface{}{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "TBPGSyncWorkflow"},
		"opensearch":  map[string]interface{}{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "tb-pg-sync-audit"},
		"keycloak":    map[string]interface{}{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
		"permify":     map[string]interface{}{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "sync:manage"},
		"mojaloop":    map[string]interface{}{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "settlement-sync"},
		"fluvio":      map[string]interface{}{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "tb-sync-stream"},
		"apisix":      map[string]interface{}{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/tb-pg-sync/*"},
		"openappsec":  map[string]interface{}{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "sync-protection"},
		"lakehouse":   map[string]interface{}{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "sync_audit_events,balance_snapshots"},
	}
}

func seedData() {
	now := time.Now().Format(time.RFC3339)
	syncConfigs = []SyncConfig{
		{ID: "SYNC-001", Name: "Account Balances → Postgres", Direction: "tb_to_pg", TigerBeetleLedger: 1, PostgresTable: "account_balances", KafkaTopic: "tb.transfers.committed", ConsumerGroup: "tb-pg-sync-balances", BatchSize: 500, FlushIntervalMs: 1000, Status: "active", EventsProcessed: 45200000, LastProcessedAt: now},
		{ID: "SYNC-002", Name: "New Accounts → TigerBeetle", Direction: "pg_to_tb", TigerBeetleLedger: 1, PostgresTable: "accounts", KafkaTopic: "cdc.core-banking.accounts", ConsumerGroup: "pg-tb-sync-accounts", BatchSize: 100, FlushIntervalMs: 500, Status: "active", EventsProcessed: 2800000, LastProcessedAt: now},
		{ID: "SYNC-003", Name: "Loan Disbursements → TigerBeetle", Direction: "pg_to_tb", TigerBeetleLedger: 2, PostgresTable: "loan_disbursements", KafkaTopic: "cdc.lending.disbursements", ConsumerGroup: "pg-tb-sync-loans", BatchSize: 50, FlushIntervalMs: 2000, Status: "active", EventsProcessed: 850000, LastProcessedAt: now},
		{ID: "SYNC-004", Name: "GL Postings → Postgres", Direction: "tb_to_pg", TigerBeetleLedger: 3, PostgresTable: "gl_journal_entries", KafkaTopic: "tb.transfers.gl-postings", ConsumerGroup: "tb-pg-sync-gl", BatchSize: 1000, FlushIntervalMs: 500, Status: "active", EventsProcessed: 32000000, LastProcessedAt: now},
		{ID: "SYNC-005", Name: "Settlement Entries → Both", Direction: "bidirectional", TigerBeetleLedger: 4, PostgresTable: "settlement_entries", KafkaTopic: "cdc.settlement.entries", ConsumerGroup: "settlement-sync", BatchSize: 100, FlushIntervalMs: 2000, Status: "active", EventsProcessed: 4200000, LastProcessedAt: now},
	}
	cacheEntries = []BalanceCacheEntry{
		{AccountID: "ACC-GTBANK-SAV-001", AvailableBalance: 125000000000, LedgerBalance: 125500000000, HoldAmount: 500000000, Currency: "NGN", CacheHit: true, CacheTTL: 30, SourceOfTruth: "tigerbeetle", LastRefreshedAt: now},
		{AccountID: "GL-1001-CASH-NGN", AvailableBalance: 89000000000000, LedgerBalance: 89000000000000, HoldAmount: 0, Currency: "NGN", CacheHit: true, CacheTTL: 60, SourceOfTruth: "tigerbeetle", LastRefreshedAt: now},
	}
}

func main() {
	seedData()
	port := getEnv("PORT", "8263")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "tigerbeetle-sync-go", "port": port, "middleware": middlewareConfig()})
	})
	mux.HandleFunc("/v1/sync/configs", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock(); defer mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": syncConfigs, "total": len(syncConfigs)})
	})
	mux.HandleFunc("/v1/sync/events", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock(); defer mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": syncEvents, "total": len(syncEvents)})
	})
	mux.HandleFunc("/v1/cache/entries", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock(); defer mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": cacheEntries, "total": len(cacheEntries)})
	})

	log.Printf("TigerBeetle Sync Service (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
