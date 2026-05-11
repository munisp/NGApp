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

// Dapr Sidecar Manager Service
// Port: 8128
// Manages Dapr building blocks: service invocation, pub/sub, state management, bindings, secrets
// Middleware: Dapr, Redis, Kafka, Postgres

type DaprApp struct {
	ID         string `json:"id"`
	AppID      string `json:"appId"`
	AppPort    int    `json:"appPort"`
	Protocol   string `json:"protocol"` // http, grpc
	SidecarPort int   `json:"sidecarPort"`
	Status     string `json:"status"` // running, stopped, error
	Components []string `json:"components"`
	LastHeartbeat string `json:"lastHeartbeat"`
}

type StateEntry struct {
	ID        string      `json:"id"`
	Store     string      `json:"store"`
	Key       string      `json:"key"`
	Value     interface{} `json:"value"`
	ETag      string      `json:"etag"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	UpdatedAt string      `json:"updatedAt"`
}

type PubSubMessage struct {
	ID        string      `json:"id"`
	Pubsub    string      `json:"pubsub"`
	Topic     string      `json:"topic"`
	Data      interface{} `json:"data"`
	Source    string      `json:"source"`
	Status    string      `json:"status"` // published, delivered, failed
	Timestamp string      `json:"timestamp"`
}

type Binding struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"` // input, output
	Component string `json:"component"` // redis, kafka, postgres, http, cron
	Status    string `json:"status"`
	InvokeCount int64 `json:"invokeCount"`
	CreatedAt string `json:"createdAt"`
}

type SecretEntry struct {
	ID    string `json:"id"`
	Store string `json:"store"`
	Name  string `json:"name"`
	Scope string `json:"scope"` // default, app-specific
}

var (
	mu          sync.RWMutex
	apps        []DaprApp
	stateStore  []StateEntry
	messages    []PubSubMessage
	bindings    []Binding
	secrets     []SecretEntry
	msgCounter  int64
	stateCounter int64
)

func init() {
	services := []struct{ appID string; port int; components []string }{
		{"agriculture-banking", 8090, []string{"statestore-redis", "pubsub-kafka", "binding-postgres"}},
		{"teller-operations", 8091, []string{"statestore-redis", "pubsub-kafka", "binding-postgres"}},
		{"islamic-banking", 8092, []string{"statestore-redis", "pubsub-kafka", "secretstore-vault"}},
		{"trade-finance", 8093, []string{"statestore-redis", "pubsub-kafka", "binding-postgres", "binding-swift"}},
		{"mortgage-servicing", 8094, []string{"statestore-redis", "pubsub-kafka", "binding-postgres"}},
		{"tigerbeetle-ledger", 8121, []string{"statestore-redis", "pubsub-kafka", "binding-tigerbeetle"}},
		{"event-bus", 8122, []string{"pubsub-kafka", "statestore-redis"}},
		{"workflow-engine", 8123, []string{"statestore-redis", "pubsub-kafka", "binding-temporal"}},
		{"mojaloop-connector", 8124, []string{"statestore-redis", "pubsub-kafka", "binding-mojaloop"}},
	}
	for i, s := range services {
		apps = append(apps, DaprApp{
			ID: fmt.Sprintf("DAPP-%04d", i+1), AppID: s.appID, AppPort: s.port,
			Protocol: "http", SidecarPort: s.port + 10000,
			Status: "running", Components: s.components,
			LastHeartbeat: time.Now().UTC().Format(time.RFC3339),
		})
	}

	defaultBindings := []struct{ name, typ, component string }{
		{"redis-statestore", "output", "redis"},
		{"kafka-pubsub", "output", "kafka"},
		{"postgres-binding", "output", "postgres"},
		{"cron-eod", "input", "cron"},
		{"http-webhook", "output", "http"},
	}
	for i, b := range defaultBindings {
		bindings = append(bindings, Binding{
			ID: fmt.Sprintf("BND-%04d", i+1), Name: b.name, Type: b.typ,
			Component: b.component, Status: "active", InvokeCount: 0,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	defaultSecrets := []string{"DB_PASSWORD", "JWT_SECRET", "KAFKA_SASL_PASSWORD", "REDIS_PASSWORD", "KEYCLOAK_CLIENT_SECRET", "TIGERBEETLE_CLUSTER_ID"}
	for i, s := range defaultSecrets {
		secrets = append(secrets, SecretEntry{
			ID: fmt.Sprintf("SEC-%04d", i+1), Store: "vault", Name: s, Scope: "default",
		})
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8128"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/dapr/apps", handleApps)
	mux.HandleFunc("/v1/dapr/state", handleState)
	mux.HandleFunc("/v1/dapr/publish", handlePublish)
	mux.HandleFunc("/v1/dapr/messages", handleMessages)
	mux.HandleFunc("/v1/dapr/bindings", handleBindings)
	mux.HandleFunc("/v1/dapr/secrets", handleSecrets)
	mux.HandleFunc("/v1/dapr/invoke", handleInvoke)
	mux.HandleFunc("/v1/dapr/stats", handleStats)

	log.Printf("Dapr Sidecar Manager Service starting on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "dapr-sidecar", "status": "healthy", "port": 8128,
		"middleware": []string{"dapr", "redis", "kafka", "postgres", "keycloak", "apisix", "openappsec", "lakehouse"},
	})
}

func handleApps(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": apps, "total": len(apps)})
}

func handleState(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		mu.RLock()
		defer mu.RUnlock()
		store := r.URL.Query().Get("store")
		var filtered []StateEntry
		for _, s := range stateStore {
			if store == "" || s.Store == store { filtered = append(filtered, s) }
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": filtered, "total": len(filtered)})
	case http.MethodPost:
		var req struct {
			Store string      `json:"store"`
			Key   string      `json:"key"`
			Value interface{} `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, 400); return
		}
		if req.Store == "" || req.Key == "" {
			http.Error(w, `{"error":"store and key are required"}`, 400); return
		}
		mu.Lock()
		stateCounter++
		entry := StateEntry{
			ID: fmt.Sprintf("STE-%08d", stateCounter), Store: req.Store, Key: req.Key,
			Value: req.Value, ETag: fmt.Sprintf("etag-%d", stateCounter),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		}
		found := false
		for i, s := range stateStore {
			if s.Store == req.Store && s.Key == req.Key { stateStore[i] = entry; found = true; break }
		}
		if !found { stateStore = append(stateStore, entry) }
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(entry)
	default:
		http.Error(w, `{"error":"method not allowed"}`, 405)
	}
}

func handlePublish(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405); return
	}
	var req struct {
		Pubsub string      `json:"pubsub"`
		Topic  string      `json:"topic"`
		Data   interface{} `json:"data"`
		Source string      `json:"source"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400); return
	}
	if req.Topic == "" || req.Data == nil {
		http.Error(w, `{"error":"topic and data are required"}`, 400); return
	}
	if req.Pubsub == "" { req.Pubsub = "kafka" }
	mu.Lock()
	msgCounter++
	msg := PubSubMessage{
		ID: fmt.Sprintf("MSG-%08d", msgCounter), Pubsub: req.Pubsub, Topic: req.Topic,
		Data: req.Data, Source: req.Source, Status: "published",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	messages = append(messages, msg)
	mu.Unlock()
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(msg)
}

func handleMessages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	recent := messages
	if len(recent) > 100 { recent = recent[len(recent)-100:] }
	json.NewEncoder(w).Encode(map[string]interface{}{"items": recent, "total": len(messages)})
}

func handleBindings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": bindings, "total": len(bindings)})
}

func handleSecrets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": secrets, "total": len(secrets)})
}

func handleInvoke(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405); return
	}
	var req struct {
		AppID  string `json:"appId"`
		Method string `json:"method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400); return
	}
	mu.RLock()
	var target *DaprApp
	for i := range apps {
		if apps[i].AppID == req.AppID { target = &apps[i]; break }
	}
	mu.RUnlock()
	if target == nil {
		http.Error(w, `{"error":"app not found"}`, 404); return
	}
	if target.Status != "running" {
		http.Error(w, fmt.Sprintf(`{"error":"app %s is %s"}`, req.AppID, target.Status), 503); return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appId": req.AppID, "method": req.Method, "status": "invoked",
		"endpoint": fmt.Sprintf("http://localhost:%d/%s", target.AppPort, req.Method),
	})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	running := 0
	for _, a := range apps { if a.Status == "running" { running++ } }
	json.NewEncoder(w).Encode(map[string]interface{}{
		"totalApps": len(apps), "runningApps": running,
		"stateEntries": len(stateStore), "messagesPublished": len(messages),
		"bindings": len(bindings), "secrets": len(secrets),
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions { w.WriteHeader(204); return }
		next.ServeHTTP(w, r)
	})
}
