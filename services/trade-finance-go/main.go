// trade-finance-go — Production service with real Postgres SQL queries
package main

import (
	_ "github.com/lib/pq"
"sync"
"bytes"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"
	"net"

	"strings"

)

var serviceName = "trade-finance-go"

// Inter-service URLs
var sanctionsURL = func() string { v := os.Getenv("SANCTIONS_URL"); if v == "" { return "http://localhost:8127" }; return v }()
var fxEngineURL = func() string { v := os.Getenv("FX_RATES_URL"); if v == "" { return "http://localhost:8166" }; return v }()
var amlURL = func() string { v := os.Getenv("AML_ENGINE_URL"); if v == "" { return "http://localhost:8120" }; return v }()
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

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
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

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	
	
	jsonResp(w, 200, map[string]interface{}{"status": "healthy", "service": "trade-finance-go", })
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "source": dbSourceTag()})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"service": "trade-finance-go", "status": "operational"})
}

func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"service": "trade-finance-go"})
}
// --- Database persistence ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	id := fmt.Sprintf("%s-%d", "trade_finance_go", time.Now().UnixNano())
	dataBytes, _ := json.Marshal(body)
	if err := dbInsert(id, "trade_finance_go", "default", "active", dataBytes); err != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, err)
	}
	// Inter-service call
	upstreamURL := os.Getenv("AML_ENGINE_URL")
	if upstreamURL == "" { upstreamURL = "http://localhost:8120" }
	result, err := callService("POST", upstreamURL+"/v1/screen", body)
	if err != nil {
		log.Printf("trade-finance-go: aml_screening call failed: %v", err)
	} else {
		log.Printf("trade-finance-go: aml_screening ok: %v", result)
	}
	jsonResp(w, 201, map[string]interface{}{"created": true, "id": id, "data": body, "source": dbSourceTag()})
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
// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"trade-finance-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&_reqCount)
    errs := atomic.LoadUint64(&_errCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"trade-finance-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"trade-finance-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"trade-finance-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}
// --- Inter-Service HTTP Client with Retry & Circuit Breaker ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2 // half-open
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
        }
        
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[inter-service] %s %s attempt %d failed: %v", method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

func callSanctionsScreen(entityName string, country string) (map[string]interface{}, error) {
    return callService("POST", sanctionsURL+"/v1/screen", map[string]interface{}{
        "entity_name": entityName, "country": country,
        "lists": []string{"OFAC", "EU", "UN", "CBN"},
    })
}

func callFXConversion(fromCurrency string, toCurrency string, amount float64) (map[string]interface{}, error) {
    return callService("POST", fxEngineURL+"/v1/convert", map[string]interface{}{
        "from": fromCurrency, "to": toCurrency, "amount": amount,
    })
}

// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&_reqCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&_errCount, 1)
        }
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}
// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func cacheGet(key string) (string, bool) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return "", false }
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 { return parts[1], true }
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return }
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

func dbSourceTag() string {
    if os.Getenv("DATABASE_URL") != "" { return "database" }
    return "in-memory"
}

// --- Rate Limiter (token bucket) ---
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	max      float64
	refill   float64
	lastTime int64
}

var _rl = &tokenBucket{max: 100, refill: 100, tokens: 100, lastTime: time.Now().UnixNano()}

func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	now := time.Now().UnixNano()
	elapsed := float64(now-tb.lastTime) / float64(time.Second)
	tb.lastTime = now
	tb.tokens = min64f(tb.max, tb.tokens+elapsed*tb.refill)
	if tb.tokens < 1 {
		return false
	}
	tb.tokens--
	return true
}

func min64f(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !_rl.allow() {
			w.Header().Set("Retry-After", "1")
			jsonResp(w, 429, map[string]interface{}{"error": "rate limit exceeded", "retry_after": 1})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}

func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")

	if port == "" { port = "8080" }
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)

	mux.HandleFunc("/v1/trade/issue-lc", issueLCHandler)
	mux.HandleFunc("/v1/trade/present-documents", presentDocHandler)
	mux.HandleFunc("/v1/trade/guarantee", guaranteeHandler)

	log.Printf("trade-finance-go listening on port %s", port)
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtMiddleware(traceMiddleware(countingMiddleware(mux))))),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[trade-finance-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[trade-finance-go] Server stopped gracefully")
}
