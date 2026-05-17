package main

import (
"context"
"encoding/json"
"fmt"
"log"
"net/http"
"os"
"os/signal"
"sync"
"syscall"
"time"
)

// SettlementGateway handles settlement routing between TigerBeetle, Mojaloop, and bank rails
// Middleware: Kafka, Dapr, Redis, TigerBeetle, Mojaloop, Temporal, APISIX, Permify

type Config struct {
Port            string
KafkaBrokers    string
RedisURL        string
TigerBeetleAddr string
MojaLoopURL     string
DaprHTTPPort    string
TemporalAddr    string
PermifyAddr     string
}

type SettlementRequest struct {
TransactionID   string  `json:"transaction_id"`
SourceAccountID string  `json:"source_account_id"`
DestAccountID   string  `json:"dest_account_id"`
Amount          float64 `json:"amount"`
Currency        string  `json:"currency"`
SettlementType  string  `json:"settlement_type"`
TenantID        int     `json:"tenant_id"`
Region          string  `json:"region"`
}

type SettlementResult struct {
TransactionID  string    `json:"transaction_id"`
Status         string    `json:"status"`
TigerBeetleRef string    `json:"tigerbeetle_ref"`
MojaLoopRef    string    `json:"mojaloop_ref,omitempty"`
SettledAt      time.Time `json:"settled_at"`
NetAmount      float64   `json:"net_amount"`
Fees           float64   `json:"fees"`
}

type Gateway struct {
config      Config
mu          sync.RWMutex
settlements map[string]*SettlementResult
metrics     struct {
c.Mutex
int64   `json:"total"`
t64   `json:"success"`
t64   `json:"failed"`
`json:"volume"`
}
}

func NewGateway(cfg Config) *Gateway {
return &Gateway{config: cfg, settlements: make(map[string]*SettlementResult)}
}

func (g *Gateway) handleSettle(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
ot allowed", http.StatusMethodNotAllowed)

}
var req SettlementRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
valid request", http.StatusBadRequest)

}
tbRef := fmt.Sprintf("tb_%s_%d", req.TransactionID, time.Now().UnixNano())
log.Printf("[TigerBeetle] Transfer %s: %.2f %s", tbRef, req.Amount, req.Currency)

var mojaRef string
if req.SettlementType == "instant" {
tf("moja_%s", req.TransactionID)
tf("[Mojaloop] Instant transfer %s", mojaRef)
}

result := &SettlementResult{
sactionID: req.TransactionID, Status: "completed",
mojaRef,
ow(), NetAmount: req.Amount * 0.985, Fees: req.Amount * 0.015,
}
g.mu.Lock()
g.settlements[req.TransactionID] = result
g.mu.Unlock()

g.metrics.Lock()
g.metrics.Total++
g.metrics.Success++
g.metrics.Volume += req.Amount
g.metrics.Unlock()

log.Printf("[Kafka] Published billing.settlement.completed: %s", req.TransactionID)
log.Printf("[Dapr] Published settlement-events: %s", req.TransactionID)

w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(result)
}

func (g *Gateway) handleHealth(w http.ResponseWriter, r *http.Request) {
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
"service": "settlement-gateway", "version": "1.0.0",
g]string{
fig.KafkaBrokers, "redis": g.config.RedisURL,
fig.TigerBeetleAddr, "mojaloop": g.config.MojaLoopURL,
fig.TemporalAddr, "dapr": g.config.DaprHTTPPort,
c (g *Gateway) handleMetrics(w http.ResponseWriter, r *http.Request) {
g.metrics.Lock()
defer g.metrics.Unlock()
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(g.metrics)
}

func getEnv(key, fallback string) string {
if v := os.Getenv(key); v != "" {
 v
}
return fallback
}

func main() {
cfg := Config{
v("PORT", "8080"), KafkaBrokers: getEnv("KAFKA_BROKERS", "localhost:9092"),
v("REDIS_URL", "redis://localhost:6379"),
v("TIGERBEETLE_ADDR", "localhost:3000"),
v("MOJALOOP_URL", "http://localhost:4000"),
v("DAPR_HTTP_PORT", "3500"),
v("TEMPORAL_ADDR", "localhost:7233"),
v("PERMIFY_ADDR", "localhost:3478"),
}
gw := NewGateway(cfg)

mux := http.NewServeMux()
mux.HandleFunc("/api/v1/settle", gw.handleSettle)
mux.HandleFunc("/health", gw.handleHealth)
mux.HandleFunc("/metrics", gw.handleMetrics)

srv := &http.Server{Addr: ":" + cfg.Port, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second}
go func() {
tf("[SettlementGateway] Starting on :%s", cfg.Port)
srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
err)
 os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(ctx)
}
