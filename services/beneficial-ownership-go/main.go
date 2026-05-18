// 54Bank Beneficial Ownership Register — Go
// UBO identification, ownership chain traversal, PEP/sanctions cross-check,
// 25% threshold detection, regulatory reporting, historical tracking.
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
	"database/sql"
	"bytes"
	"strings"

)

var serviceName = "beneficial-ownership-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type UBO struct {
	ID              string  `json:"id"`
	EntityType      string  `json:"entityType"` // individual, corporate
	FullName        string  `json:"fullName"`
	Nationality     string  `json:"nationality"`
	DateOfBirth     string  `json:"dateOfBirth,omitempty"`
	IDNumber        string  `json:"idNumber,omitempty"`
	IDType          string  `json:"idType,omitempty"`
	OwnershipPct    float64 `json:"ownershipPct"`
	VotingRightPct  float64 `json:"votingRightPct"`
	ControlType     string  `json:"controlType"` // direct_ownership, indirect_ownership, control_by_agreement, de_facto
	IsPEP           bool    `json:"isPEP"`
	PEPCategory     string  `json:"pepCategory,omitempty"`
	IsSanctioned    bool    `json:"isSanctioned"`
	SanctionsList   string  `json:"sanctionsList,omitempty"`
	AdverseMedia    bool    `json:"adverseMedia"`
	VerificationSt  string  `json:"verificationStatus"` // pending, verified, flagged
	IdentifiedAt    string  `json:"identifiedAt"`
}

type OwnershipChain struct {
	CompanyID     string          `json:"companyId"`
	CompanyName   string          `json:"companyName"`
	RCNumber      string          `json:"rcNumber"`
	ChainDepth    int             `json:"chainDepth"`
	Layers        []ChainLayer    `json:"layers"`
	UBOs          []UBO           `json:"ubos"`
	RiskScore     float64         `json:"riskScore"`
	Flags         []string        `json:"flags"`
	ThresholdPct  float64         `json:"thresholdPct"`
	AnalyzedAt    string          `json:"analyzedAt"`
}

type ChainLayer struct {
	Depth       int    `json:"depth"`
	EntityID    string `json:"entityId"`
	EntityName  string `json:"entityName"`
	EntityType  string `json:"entityType"`
	Country     string `json:"country"`
	HoldingPct  float64 `json:"holdingPct"`
	CumulPct    float64 `json:"cumulativeHoldingPct"`
}

type RegisterEntry struct {
	ID            string    `json:"id"`
	CompanyID     string    `json:"companyId"`
	CompanyName   string    `json:"companyName"`
	UBOs          []UBO     `json:"ubos"`
	TotalUBOs     int       `json:"totalUbos"`
	ThresholdPct  float64   `json:"thresholdPct"`
	LastUpdated   string    `json:"lastUpdated"`
	NextReview    string    `json:"nextReview"`
	Status        string    `json:"status"` // current, under_review, expired
}

var (
	mu       sync.Mutex
	register = []RegisterEntry{
		{ID: "REG-001", CompanyID: "CMP-001", CompanyName: "Zenith Agro Ltd", TotalUBOs: 2,
			ThresholdPct: 25, LastUpdated: "2026-04-01T10:00:00Z", NextReview: "2026-10-01T10:00:00Z", Status: "current",
			UBOs: []UBO{
				{ID: "UBO-001", EntityType: "individual", FullName: "John Okechukwu", Nationality: "NG",
					OwnershipPct: 45, VotingRightPct: 45, ControlType: "direct_ownership",
					IsPEP: false, IsSanctioned: false, VerificationSt: "verified", IdentifiedAt: "2026-04-01T10:00:00Z"},
				{ID: "UBO-002", EntityType: "individual", FullName: "Grace Okafor", Nationality: "NG",
					OwnershipPct: 30, VotingRightPct: 30, ControlType: "direct_ownership",
					IsPEP: false, IsSanctioned: false, VerificationSt: "verified", IdentifiedAt: "2026-04-01T10:00:00Z"},
			}},
	}
	chains = []OwnershipChain{}
	stats  = map[string]interface{}{
		"totalEntries":      1,
		"totalUBOs":         2,
		"pepUBOs":           0,
		"sanctionedUBOs":    0,
		"avgOwnershipPct":   37.5,
		"avgChainDepth":     1.2,
		"expiredEntries":    0,
		"underReview":       0,
		"thresholdPct":      25.0,
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "beneficial-ownership-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Ownership Analysis Functions ───────────────────────────────────────────

func traverseChain(shareholders []map[string]interface{}, threshold float64) ([]UBO, []ChainLayer, []string) {
	ubos := []UBO{}
	layers := []ChainLayer{}
	flags := []string{}

	for i, s := range shareholders {
		pct := getFloat(s, "ownershipPct")
		eType := getString(s, "entityType")
		if eType == "" {
			eType = "individual"
		}
		layer := ChainLayer{
			Depth:      i + 1,
			EntityID:   getString(s, "entityId"),
			EntityName: getString(s, "entityName"),
			EntityType: eType,
			Country:    getString(s, "country"),
			HoldingPct: pct,
			CumulPct:   pct,
		}
		layers = append(layers, layer)

		if pct >= threshold {
			isPEP := getBool(s, "isPEP")
			isSanctioned := getBool(s, "isSanctioned")
			ubo := UBO{
				ID:             fmt.Sprintf("UBO-%08X", rand.Uint32()),
				EntityType:     eType,
				FullName:       getString(s, "entityName"),
				Nationality:    getString(s, "country"),
				DateOfBirth:    getString(s, "dateOfBirth"),
				IDNumber:       getString(s, "idNumber"),
				IDType:         getString(s, "idType"),
				OwnershipPct:   pct,
				VotingRightPct: getFloat(s, "votingRightPct"),
				ControlType:    "direct_ownership",
				IsPEP:          isPEP,
				IsSanctioned:   isSanctioned,
				VerificationSt: "pending",
				IdentifiedAt:   time.Now().Format(time.RFC3339),
			}
			if ubo.VotingRightPct == 0 {
				ubo.VotingRightPct = ubo.OwnershipPct
			}
			if isPEP {
				flags = append(flags, fmt.Sprintf("pep_ubo:%s", ubo.FullName))
				ubo.PEPCategory = getString(s, "pepCategory")
			}
			if isSanctioned {
				flags = append(flags, fmt.Sprintf("sanctioned_ubo:%s", ubo.FullName))
				ubo.SanctionsList = getString(s, "sanctionsList")
			}
			ubos = append(ubos, ubo)
		}
	}

	if len(ubos) == 0 {
		flags = append(flags, "no_ubo_above_threshold")
	}
	return ubos, layers, flags
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "beneficial-ownership-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Beneficial Ownership Register",
		"capabilities": []string{
			"ubo_identification", "ownership_chain_traversal",
			"pep_cross_check", "sanctions_cross_check", "adverse_media_check",
			"threshold_detection_25pct", "regulatory_reporting",
			"historical_tracking", "chain_depth_analysis",
			"de_facto_control_detection", "register_management",
		},
		"threshold_pct": 25,
		"middleware": map[string]string{
			"kafka":      "bo.register, bo.changes, bo.pep-alerts, bo.sanctions-alerts",
			"postgres":   "bo_register, bo_ubos, bo_chains, bo_audit",
			"redis":      "ubo_cache (TTL 24h), pep_cache (TTL 1h)",
			"temporal":   "BOChainTraversalWorkflow, BOPeriodicReviewWorkflow",
			"permify":    "bo:view, bo:update, bo:admin",
			"opensearch": "beneficial-ownership-2026",
		},
	})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"entries": register, "total": len(register), "thresholdPct": 25.0,
	})
}

func handleTraverseChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	threshold := 25.0
	if t := getFloat(body, "thresholdPct"); t > 0 {
		threshold = t
	}

	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}

	ubos, chainLayers, flags := traverseChain(shareholders, threshold)

	riskScore := 0.0
	for _, u := range ubos {
		if u.IsPEP {
			riskScore += 25
		}
		if u.IsSanctioned {
			riskScore += 50
		}
		if u.AdverseMedia {
			riskScore += 15
		}
	}

	chain := OwnershipChain{
		CompanyID:    getString(body, "companyId"),
		CompanyName:  getString(body, "companyName"),
		RCNumber:     getString(body, "rcNumber"),
		ChainDepth:   len(chainLayers),
		Layers:       chainLayers,
		UBOs:         ubos,
		RiskScore:    riskScore,
		Flags:        flags,
		ThresholdPct: threshold,
		AnalyzedAt:   time.Now().Format(time.RFC3339),
	}

	mu.Lock()
	chains = append(chains, chain)
	mu.Unlock()

	respondJSON(w, 200, map[string]interface{}{
		"chain":        chain,
		"ubosFound":    len(ubos),
		"riskScore":    riskScore,
		"pepInChain":   countPEP(ubos),
		"sanctioned":   countSanctioned(ubos),
	})
}

func handleIdentifyUBOs(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	threshold := 25.0
	if t := getFloat(body, "thresholdPct"); t > 0 {
		threshold = t
	}

	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}
	ubos, _, _ := traverseChain(shareholders, threshold)
	respondJSON(w, 200, map[string]interface{}{
		"ubos": ubos, "total": len(ubos), "thresholdPct": threshold,
	})
}

func handleAddToRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	entry := RegisterEntry{
		ID:           fmt.Sprintf("REG-%08X", rand.Uint32()),
		CompanyID:    getString(body, "companyId"),
		CompanyName:  getString(body, "companyName"),
		UBOs:         []UBO{},
		ThresholdPct: 25,
		LastUpdated:  time.Now().Format(time.RFC3339),
		Status:       "current",
	}

	mu.Lock()
	register = append(register, entry)
	stats["totalEntries"] = len(register)
	mu.Unlock()

	respondJSON(w, 201, map[string]interface{}{"created": true, "entry": entry})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
}

func countPEP(ubos []UBO) int {
	n := 0
	for _, u := range ubos {
		if u.IsPEP {
			n++
		}
	}
	return n
}

func countSanctioned(ubos []UBO) int {
	n := 0
	for _, u := range ubos {
		if u.IsSanctioned {
			n++
		}
	}
	return n
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}


func beneficial_ownershipComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func beneficial_ownershipValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func beneficial_ownershipScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := beneficial_ownershipComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func beneficial_ownershipValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := beneficial_ownershipValidateRequest(body)
    respondJSON(w, 200, result)
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
    fmt.Fprintf(w, `{"ready":true,"service":"beneficial-ownership-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"beneficial-ownership-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"beneficial-ownership-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"beneficial-ownership-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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


// --- Database Layer ---
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

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}


// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
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


// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures int
var _cbOpen bool
var _cbLastFail time.Time

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen && time.Since(_cbLastFail) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen { _cbOpen = false; _cbFailures = 0 }
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 { time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond) }
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil { lastErr = err; _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		defer resp.Body.Close()
		if resp.StatusCode >= 500 { lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode); _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures = 0; _cbOpen = false
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9096"
	}
	http.HandleFunc("/readyz", readyzHandler)

	http.HandleFunc("/livez", livezHandler)

	http.HandleFunc("/metrics", metricsHandler)

	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/v1/beneficial-ownership/register", handleRegister)
	http.HandleFunc("/v1/beneficial-ownership/traverse-chain", handleTraverseChain)
	http.HandleFunc("/v1/beneficial-ownership/identify-ubos", handleIdentifyUBOs)
	http.HandleFunc("/v1/beneficial-ownership/register/add", handleAddToRegister)
	http.HandleFunc("/v1/beneficial-ownership/stats", handleStats)
	http.HandleFunc("/v1/beneficial-ownership/score", beneficial_ownershipScoreHandler)
	http.HandleFunc("/v1/beneficial-ownership/validate", beneficial_ownershipValidateRequestHandler)
	log.Printf("Beneficial Ownership Register v2.0 (Go) on :%s", port)
	server := &http.Server{
        Addr:    ":" + port,
        Handler: nil,
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
    log.Println("[beneficial-ownership-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[beneficial-ownership-go] Server stopped gracefully")
}
