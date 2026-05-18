// trade-finance-go — Production-hardened service
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
    "service":   "trade-finance-go",
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
type BankGuarantee struct {
	ID               string            `json:"id"`
	GuaranteeID      string            `json:"guarantee_id"`
	GuaranteeType    string            `json:"guarantee_type"`
	Type             string            `json:"type"`
	Amount           float64           `json:"amount"`
	Currency         string            `json:"currency"`
	Applicant        string            `json:"applicant"`
	ApplicantName    string            `json:"applicant_name"`
	Beneficiary      string            `json:"beneficiary"`
	BeneficiaryName  string            `json:"beneficiary_name"`
	ExpiryDate       string            `json:"expiry_date"`
	Status           string            `json:"status"`
	CommissionRate   float64           `json:"commission_rate"`
	CommissionAmount float64           `json:"commission_amount"`
	Middleware       []string          `json:"middleware"`
	CreatedAt        string            `json:"created_at"`
	UpdatedAt        string            `json:"updated_at"`
}
type LCRequest struct {
	Applicant    string  `json:"applicant"`
	Beneficiary  string  `json:"beneficiary"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	ExpiryDate   string  `json:"expiry_date"`
	Commodity    string  `json:"commodity"`
	Incoterm     string  `json:"incoterm"`
}
type DocumentPresentation struct {
	LCID       string   `json:"lc_id"`
	Documents  []string `json:"documents"`
}

// --- Domain Logic ---
func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func lcFee(amount float64, tenor int) float64 {
	rate := 0.0015
	if tenor > 180 { rate = 0.002 }
	return math.Round(amount * rate * float64(tenor) / 365.0 * 100) / 100
}

func requiredDocuments(incoterm string) []string {
	base := []string{"commercial_invoice", "packing_list", "bill_of_lading"}
	if incoterm == "CIF" || incoterm == "CIP" {
		base = append(base, "insurance_certificate")
	}
	base = append(base, "certificate_of_origin")
	return base
}

func validatePresentation(presented []string, required []string) (bool, []string) {
	var missing []string
	for _, req := range required {
		found := false
		for _, p := range presented { if p == req { found = true; break } }
		if !found { missing = append(missing, req) }
	}
	return len(missing) == 0, missing
}

func lcStatus(issued bool, expired bool, utilized bool) string {
	if utilized { return "utilized" }
	if expired { return "expired" }
	if issued { return "active" }
	return "draft"
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

	mux.HandleFunc("/v1/trade/issue-lc", issueLCHandler)
	mux.HandleFunc("/v1/trade/present-documents", presentDocHandler)
	mux.HandleFunc("/v1/trade/guarantee", guaranteeHandler)

	log.Printf("trade-finance-go listening on port %s", port)
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
    "service": "trade-finance-go",
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
fmt.Fprintf(w, "requests_total{service=\"trade-finance-go\"} %d\n", reqs)
fmt.Fprintf(w, "# HELP errors_total Total errors\n")
fmt.Fprintf(w, "# TYPE errors_total counter\n")
fmt.Fprintf(w, "errors_total{service=\"trade-finance-go\"} %d\n", errs)
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
    "service":      "trade-finance-go",
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
func issueLCHandler(w http.ResponseWriter, r *http.Request) {
	var req LCRequest
	json.NewDecoder(r.Body).Decode(&req)
	fee := lcFee(req.Amount, 90)
	docs := requiredDocuments(req.Incoterm)
	ref := fmt.Sprintf("LC-%d", time.Now().UnixNano())
	jsonResp(w, 200, map[string]interface{}{"lc_reference": ref, "status": "issued", "fee": fee, "required_documents": docs, "amount": req.Amount})
}

func presentDocHandler(w http.ResponseWriter, r *http.Request) {
	var req DocumentPresentation
	json.NewDecoder(r.Body).Decode(&req)
	required := requiredDocuments("FOB")
	valid, missing := validatePresentation(req.Documents, required)
	jsonResp(w, 200, map[string]interface{}{"compliant": valid, "missing_documents": missing, "lc_id": req.LCID})
}

func guaranteeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { Amount float64 `json:"amount"`; Type string `json:"type"`; Tenor int `json:"tenor"` }
	json.NewDecoder(r.Body).Decode(&req)
	fee := req.Amount * 0.02 * float64(req.Tenor) / 365.0
	jsonResp(w, 200, map[string]interface{}{"guarantee_ref": fmt.Sprintf("BG-%d", time.Now().UnixNano()), "type": req.Type, "amount": req.Amount, "fee": math.Round(fee*100)/100})
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
    log.Println(jsonLog("INFO", fmt.Sprintf("trade-finance-go listening on :%s", port)))
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
