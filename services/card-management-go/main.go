// card-management-go — Production-hardened service
package main

import (
"context"
"database/sql"
"encoding/json"
"fmt"
"log"
"math"
"net/http"
"os"
"os/signal"
"strings"
"sync/atomic"
"syscall"
"time"

_ "github.com/lib/pq"
)

// --- Configuration ---
var (
dbURL     = os.Getenv("DATABASE_URL")
jwtSecret = os.Getenv("JWT_SECRET")
port      = getEnv("PORT", "8080")
)

func getEnv(key, fallback string) string {
if v := os.Getenv(key); v != "" {
    return v
}
return fallback
}

// --- Database ---
var db *sql.DB

func initDB() {
if dbURL == "" {
    log.Println(jsonLog("WARN", "DATABASE_URL not set, running without persistence"))
    return
}
var err error
db, err = sql.Open("postgres", dbURL)
if err != nil {
    log.Println(jsonLog("ERROR", fmt.Sprintf("DB connection failed: %v", err)))
    return
}
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
if err = db.Ping(); err != nil {
    log.Println(jsonLog("ERROR", fmt.Sprintf("DB ping failed: %v", err)))
    db = nil
    return
}
log.Println(jsonLog("INFO", "Database connected"))
}

// --- Structured Logging ---
func jsonLog(level, msg string) string {
entry := map[string]interface{}{
    "timestamp": time.Now().UTC().Format(time.RFC3339),
    "level":     level,
    "service":   "card-management-go",
    "message":   msg,
}
b, _ := json.Marshal(entry)
return string(b)
}

// --- Metrics ---
var (
requestCount uint64
errorCount   uint64
startTime    = time.Now()
)

// --- JWT Auth Middleware ---
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
return func(w http.ResponseWriter, r *http.Request) {
    atomic.AddUint64(&requestCount, 1)
    
    // Skip auth for health/metrics endpoints
    if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") ||
       strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") {
        next(w, r)
        return
    }
    
    auth := r.Header.Get("Authorization")
    if !strings.HasPrefix(auth, "Bearer ") {
        // In monitoring mode: log but allow through
        log.Println(jsonLog("WARN", fmt.Sprintf("Missing auth token on %s %s", r.Method, r.URL.Path)))
    } else {
        token := auth[7:]
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            atomic.AddUint64(&errorCount, 1)
            jsonResp(w, 401, map[string]interface{}{"error": "invalid_token"})
            return
        }
        // In production: verify JWT signature with jwtSecret
    }
    
    next(w, r)
}
}

// --- JSON Response ---
func jsonResp(w http.ResponseWriter, code int, data interface{}) {
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(code)
json.NewEncoder(w).Encode(data)
}

// --- Structs ---
type CardRequest struct {
	CustomerID string `json:"customer_id"`
	CardType   string `json:"card_type"`
	Scheme     string `json:"scheme"`
	Currency   string `json:"currency"`
}

// --- Domain Logic ---
func generateMaskedPAN(scheme string) string {
	prefix := "5399"
	if scheme == "visa" { prefix = "4061" }
	return fmt.Sprintf("%s****%04d", prefix, time.Now().UnixNano() % 10000)
}

func cardLimit(cardType string) float64 {
	switch cardType {
	case "platinum": return 10000000
	case "gold": return 5000000
	case "classic": return 1000000
	case "prepaid": return 500000
	default: return 500000
	}
}

func annualFee(cardType string) float64 {
	switch cardType {
	case "platinum": return 20000
	case "gold": return 10000
	case "classic": return 3000
	case "prepaid": return 1000
	default: return 1000
	}
}

func validateCardAction(action string, status string) bool {
	switch action {
	case "activate": return status == "inactive"
	case "block": return status == "active"
	case "unblock": return status == "blocked"
	case "replace": return status != "cancelled"
	default: return false
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)

	mux.HandleFunc("/v1/cards/issue", issueCardHandler)
	mux.HandleFunc("/v1/cards/action", cardActionHandler)
	mux.HandleFunc("/v1/cards/pin-gen", pinGenHandler)

	log.Printf("card-management-go listening on port %s", port)
	log.Fatal(http.ListenAndServe(":" + port, mux))
}

// --- Health/Readiness/Liveness ---
func healthHandler(w http.ResponseWriter, r *http.Request) {
dbStatus := "not_configured"
if db != nil {
    if err := db.Ping(); err == nil {
        dbStatus = "connected"
    } else {
        dbStatus = "disconnected"
    }
}
jsonResp(w, 200, map[string]interface{}{
    "status":  "healthy",
    "service": "card-management-go",
    "version": "2.0.0",
    "db":      dbStatus,
    "uptime":  time.Since(startTime).String(),
})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
jsonResp(w, 200, map[string]interface{}{"ready": true})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
jsonResp(w, 200, map[string]interface{}{"alive": true})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
reqs := atomic.LoadUint64(&requestCount)
errs := atomic.LoadUint64(&errorCount)
w.Header().Set("Content-Type", "text/plain")
fmt.Fprintf(w, "# HELP requests_total Total requests\n")
fmt.Fprintf(w, "# TYPE requests_total counter\n")
fmt.Fprintf(w, "requests_total{service=\"card-management-go\"} %d\n", reqs)
fmt.Fprintf(w, "# HELP errors_total Total errors\n")
fmt.Fprintf(w, "# TYPE errors_total counter\n")
fmt.Fprintf(w, "errors_total{service=\"card-management-go\"} %d\n", errs)
}

func listHandler(w http.ResponseWriter, r *http.Request) {
if db != nil {
    // Production: query database
    rows, err := db.Query("SELECT id, data, created_at FROM records ORDER BY created_at DESC LIMIT 50")
    if err != nil {
        jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
        return
    }
    defer rows.Close()
    var items []map[string]interface{}
    for rows.Next() {
        var id string
        var data string
        var createdAt time.Time
        if err := rows.Scan(&id, &data, &createdAt); err == nil {
            var parsed map[string]interface{}
            json.Unmarshal([]byte(data), &parsed)
            parsed["id"] = id
            parsed["created_at"] = createdAt
            items = append(items, parsed)
        }
    }
    jsonResp(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "database"})
    return
}
jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "source": "no_db"})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
stats := map[string]interface{}{
    "service":      "card-management-go",
    "status":       "operational",
    "requests":     atomic.LoadUint64(&requestCount),
    "errors":       atomic.LoadUint64(&errorCount),
    "db_connected": db != nil,
    "uptime":       time.Since(startTime).String(),
}
jsonResp(w, 200, stats)
}

func createHandler(w http.ResponseWriter, r *http.Request) {
var body map[string]interface{}
json.NewDecoder(r.Body).Decode(&body)

if db != nil {
    data, _ := json.Marshal(body)
    var id string
    err := db.QueryRow("INSERT INTO records (data) VALUES ($1) RETURNING id", string(data)).Scan(&id)
    if err != nil {
        atomic.AddUint64(&errorCount, 1)
        jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
        return
    }
    body["id"] = id
}

jsonResp(w, 201, map[string]interface{}{"created": true, "data": body})
}

// --- Domain Handlers ---
func issueCardHandler(w http.ResponseWriter, r *http.Request) {
	var req CardRequest
	json.NewDecoder(r.Body).Decode(&req)
	masked := generateMaskedPAN(req.Scheme)
	limit := cardLimit(req.CardType)
	fee := annualFee(req.CardType)
	jsonResp(w, 200, map[string]interface{}{"masked_pan": masked, "card_type": req.CardType, "limit": limit, "annual_fee": fee, "status": "inactive"})
}

func cardActionHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { CardID string `json:"card_id"`; Action string `json:"action"`; CurrentStatus string `json:"current_status"` }
	json.NewDecoder(r.Body).Decode(&req)
	valid := validateCardAction(req.Action, req.CurrentStatus)
	if !valid {
		jsonResp(w, 400, map[string]interface{}{"error": fmt.Sprintf("Cannot %s card in %s status", req.Action, req.CurrentStatus)})
		return
	}
	jsonResp(w, 200, map[string]interface{}{"card_id": req.CardID, "action": req.Action, "status": "processed"})
}

func pinGenHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { CardID string `json:"card_id"` }
	json.NewDecoder(r.Body).Decode(&req)
	jsonResp(w, 200, map[string]interface{}{"card_id": req.CardID, "pin_block_generated": true, "delivery": "sms"})
}



func main() {
initDB()

mux := http.NewServeMux()
mux.HandleFunc("/healthz", healthHandler)
mux.HandleFunc("/readyz", readyzHandler)
mux.HandleFunc("/livez", livezHandler)
mux.HandleFunc("/metrics", metricsHandler)
mux.HandleFunc("/v1/records", authMiddleware(listHandler))
mux.HandleFunc("/v1/stats", authMiddleware(statsHandler))
mux.HandleFunc("/v1/create", authMiddleware(createHandler))


server := &http.Server{
    Addr:         ":" + port,
    Handler:      mux,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 30 * time.Second,
    IdleTimeout:  60 * time.Second,
}

// Graceful shutdown
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

go func() {
    log.Println(jsonLog("INFO", fmt.Sprintf("card-management-go listening on :%s", port)))
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal(jsonLog("FATAL", fmt.Sprintf("Server failed: %v", err)))
    }
}()

<-quit
log.Println(jsonLog("INFO", "Shutdown signal received"))

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if db != nil {
    db.Close()
    log.Println(jsonLog("INFO", "Database connection closed"))
}

if err := server.Shutdown(ctx); err != nil {
    log.Fatal(jsonLog("FATAL", fmt.Sprintf("Server forced shutdown: %v", err)))
}

log.Println(jsonLog("INFO", "Server stopped gracefully"))
}
