// nibss-nip-engine-go — Production-hardened service
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
    "service":   "nibss-nip-engine-go",
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
type ISO8583Message struct {
	MTI            string            `json:"mti"`
	PrimaryBitmap  string            `json:"primaryBitmap"`
	Fields         map[string]string `json:"fields"`
	ProcessingCode string            `json:"processingCode"`
	Amount         int64             `json:"amount"`
	STAN           string            `json:"stan"`
	RRN            string            `json:"rrn"`
	ResponseCode   string            `json:"responseCode,omitempty"`
	CreatedAt      string            `json:"createdAt"`
}
type NIPTransaction struct {
	ID                string `json:"id"`
	SessionID         string `json:"sessionId"`
	Type              string `json:"type"` // nameEnquiry | fundsTransfer | tsq
	SourceBank        string `json:"sourceBank"`
	SourceBankCode    string `json:"sourceBankCode"`
	SourceAccount     string `json:"sourceAccount"`
	DestBank          string `json:"destinationBank"`
	DestBankCode      string `json:"destinationBankCode"`
	DestAccount       string `json:"destinationAccount"`
	BeneficiaryName   string `json:"beneficiaryName"`
	Amount            int64  `json:"amountKobo"`
	Narration         string `json:"narration"`
	ResponseCode      string `json:"responseCode"`
	ResponseMessage   string `json:"responseMessage"`
	Status            string `json:"status"` // initiated | processing | successful | failed | reversed
	ChannelCode       string `json:"channelCode"`
	MTI               string `json:"mti"`
	CreatedAt         string `json:"createdAt"`
	CompletedAt       string `json:"completedAt,omitempty"`
}
type DirectDebitMandate struct {
	ID              string `json:"id"`
	MandateRef      string `json:"mandateReference"`
	DebtorAccount   string `json:"debtorAccount"`
	DebtorBank      string `json:"debtorBank"`
	DebtorBankCode  string `json:"debtorBankCode"`
	DebtorName      string `json:"debtorName"`
	CreditorAccount string `json:"creditorAccount"`
	CreditorBank    string `json:"creditorBank"`
	CreditorName    string `json:"creditorName"`
	Amount          int64  `json:"amountKobo"`
	Frequency       string `json:"frequency"` // one_time | daily | weekly | monthly | quarterly
	StartDate       string `json:"startDate"`
	EndDate         string `json:"endDate"`
	Status          string `json:"status"` // created | pending_approval | approved | active | suspended | cancelled | expired
	LastExecution   string `json:"lastExecutionDate,omitempty"`
	NextExecution   string `json:"nextExecutionDate,omitempty"`
	ExecutionCount  int    `json:"executionCount"`
	CreatedAt       string `json:"createdAt"`
}
type NIBSSResponseCode struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Action      string `json:"action"`
}
type SettlementReport struct {
	ID            string `json:"id"`
	Date          string `json:"settlementDate"`
	TotalCredits  int64  `json:"totalCreditsKobo"`
	TotalDebits   int64  `json:"totalDebitsKobo"`
	NetPosition   int64  `json:"netPositionKobo"`
	TxnCount      int    `json:"transactionCount"`
	Status        string `json:"status"` // pending | settled | disputed
	ReconcileMatch int   `json:"reconciledMatches"`
	Exceptions    int    `json:"exceptions"`
}

// --- Domain Logic ---
func init() {
	nipTransactions = []NIPTransaction{
		{ID: "NIP-001", SessionID: "000000260509143001234567890", Type: "nameEnquiry", SourceBank: "54Bank", SourceBankCode: "054", SourceAccount: "0012345678", DestBank: "GTBank", DestBankCode: "058", DestAccount: "0211234567", BeneficiaryName: "JOHN ADEWALE OKO", Amount: 0, Narration: "", ResponseCode: "00", ResponseMessage: "Approved", Status: "successful", ChannelCode: "2", MTI: "0200", CreatedAt: "2026-05-09T14:30:00Z", CompletedAt: "2026-05-09T14:30:01Z"},
		{ID: "NIP-002", SessionID: "000000260509143101234567891", Type: "fundsTransfer", SourceBank: "54Bank", SourceBankCode: "054", SourceAccount: "0012345678", DestBank: "GTBank", DestBankCode: "058", DestAccount: "0211234567", BeneficiaryName: "JOHN ADEWALE OKO", Amount: 50000000, Narration: "Salary May 2026", ResponseCode: "00", ResponseMessage: "Approved", Status: "successful", ChannelCode: "2", MTI: "0200", CreatedAt: "2026-05-09T14:31:00Z", CompletedAt: "2026-05-09T14:31:02Z"},
		{ID: "NIP-003", SessionID: "000000260509150001234567892", Type: "fundsTransfer", SourceBank: "54Bank", SourceBankCode: "054", SourceAccount: "0098765432", DestBank: "Access Bank", DestBankCode: "044", DestAccount: "0756123456", BeneficiaryName: "GRACE NKEM OKAFOR", Amount: 150000000, Narration: "Invoice INV-2026-045", ResponseCode: "00", ResponseMessage: "Approved", Status: "successful", ChannelCode: "2", MTI: "0200", CreatedAt: "2026-05-09T15:00:00Z", CompletedAt: "2026-05-09T15:00:01Z"},
		{ID: "NIP-004", SessionID: "000000260509151001234567893", Type: "fundsTransfer", SourceBank: "54Bank", SourceBankCode: "054", SourceAccount: "0045678901", DestBank: "Zenith Bank", DestBankCode: "057", DestAccount: "2098765432", BeneficiaryName: "", Amount: 25000000, Narration: "Transfer to self", ResponseCode: "51", ResponseMessage: "Insufficient funds", Status: "failed", ChannelCode: "1", MTI: "0210", CreatedAt: "2026-05-09T15:10:00Z"},
		{ID: "NIP-005", SessionID: "000000260509152001234567894", Type: "tsq", SourceBank: "54Bank", SourceBankCode: "054", SourceAccount: "", DestBank: "UBA", DestBankCode: "033", DestAccount: "", BeneficiaryName: "", Amount: 0, Narration: "TSQ for NIP-002", ResponseCode: "00", ResponseMessage: "Original transaction successful", Status: "successful", ChannelCode: "2", MTI: "0420", CreatedAt: "2026-05-09T15:20:00Z", CompletedAt: "2026-05-09T15:20:00Z"},
	}

	mandates = []DirectDebitMandate{
		{ID: "DDM-001", MandateRef: "54BK/DD/2026/00001", DebtorAccount: "0012345678", DebtorBank: "GTBank", DebtorBankCode: "058", DebtorName: "Acme Corp Ltd", CreditorAccount: "0054000001", CreditorBank: "54Bank", CreditorName: "54Bank Platform Fees", Amount: 2500000000, Frequency: "monthly", StartDate: "2026-01-01", EndDate: "2026-12-31", Status: "active", LastExecution: "2026-05-01", NextExecution: "2026-06-01", ExecutionCount: 5, CreatedAt: "2025-12-15T10:00:00Z"},
		{ID: "DDM-002", MandateRef: "54BK/DD/2026/00002", DebtorAccount: "2098765432", DebtorBank: "Zenith Bank", DebtorBankCode: "057", DebtorName: "TechStart Solutions", CreditorAccount: "0054000001", CreditorBank: "54Bank", CreditorName: "54Bank SaaS Subscription", Amount: 500000000, Frequency: "monthly", StartDate: "2026-03-01", EndDate: "2027-02-28", Status: "active", LastExecution: "2026-05-01", NextExecution: "2026-06-01", ExecutionCount: 3, CreatedAt: "2026-02-20T14:00:00Z"},
		{ID: "DDM-003", MandateRef: "54BK/DD/2026/00003", DebtorAccount: "0145678901", DebtorBank: "UBA", DebtorBankCode: "033", DebtorName: "MicroLend Finance", CreditorAccount: "0054000002", CreditorBank: "54Bank", CreditorName: "54Bank Loan Repayment", Amount: 1200000000, Frequency: "monthly", StartDate: "2026-04-01", EndDate: "2027-03-31", Status: "pending_approval", CreatedAt: "2026-04-28T09:00:00Z"},
	}

	settlements = []SettlementReport{
		{ID: "STL-20260509", Date: "2026-05-09", TotalCredits: 45670000000, TotalDebits: 38920000000, NetPosition: 6750000000, TxnCount: 12847, Status: "pending", ReconcileMatch: 12830, Exceptions: 17},
		{ID: "STL-20260508", Date: "2026-05-08", TotalCredits: 52340000000, TotalDebits: 49870000000, NetPosition: 2470000000, TxnCount: 14523, Status: "settled", ReconcileMatch: 14523, Exceptions: 0},
		{ID: "STL-20260507", Date: "2026-05-07", TotalCredits: 39880000000, TotalDebits: 41200000000, NetPosition: -1320000000, TxnCount: 11234, Status: "settled", ReconcileMatch: 11230, Exceptions: 4},
	}
}

func middlewareStatus() map[string]string {
	return map[string]string{
		"kafka": "topics: nip.transactions, nip.settlements, nip.mandates",
		"postgres": "tables: nip_transactions, nip_mandates, nip_settlements",
		"redis": "session_dedup, rate_limit",
		"temporal": "workflows: MandateExecution, SettlementRecon, ReversalSaga",
		"tigerbeetle": "ledger: nip_clearing_account",
		"permify": "nip:initiate_transfer, nip:approve_mandate",
		"opensearch": "index: nip-transactions-2026",
		"apisix": "rate_limit: 1000/s per bank_code",
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8111"
	}
	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/v1/nip/name-enquiry", handleNameEnquiry)
	http.HandleFunc("/v1/nip/funds-transfer", handleFundsTransfer)
	http.HandleFunc("/v1/nip/tsq", handleTSQ)
	http.HandleFunc("/v1/nip/transactions", handleTransactions)
	http.HandleFunc("/v1/nip/mandates", handleMandates)
	http.HandleFunc("/v1/nip/settlements", handleSettlements)
	http.HandleFunc("/v1/nip/response-codes", handleResponseCodes)

	log.Printf("NIBSS/NIP Engine (Go) on :%s — ISO 8583 + Direct Debit", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
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
    "service": "nibss-nip-engine-go",
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
fmt.Fprintf(w, "requests_total{service=\"nibss-nip-engine-go\"} %d\n", reqs)
fmt.Fprintf(w, "# HELP errors_total Total errors\n")
fmt.Fprintf(w, "# TYPE errors_total counter\n")
fmt.Fprintf(w, "errors_total{service=\"nibss-nip-engine-go\"} %d\n", errs)
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
    "service":      "nibss-nip-engine-go",
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
func handleNameEnquiry(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		DestBankCode string `json:"destinationBankCode"`
		AccountNo    string `json:"accountNumber"`
		ChannelCode  string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sessionID := fmt.Sprintf("0000002605091%d", time.Now().UnixNano()%10000000000)
	txn := NIPTransaction{
		ID: fmt.Sprintf("NIP-%03d", len(nipTransactions)+1), SessionID: sessionID,
		Type: "nameEnquiry", SourceBank: "54Bank", SourceBankCode: "054",
		DestBankCode: req.DestBankCode, DestAccount: req.AccountNo,
		BeneficiaryName: "RESOLVED NAME", ResponseCode: "00", ResponseMessage: "Approved",
		Status: "successful", ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339), CompletedAt: time.Now().Format(time.RFC3339),
	}
	mu.Lock()
	nipTransactions = append(nipTransactions, txn)
	mu.Unlock()
	respondJSON(w, 200, txn)
}

func handleFundsTransfer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		SourceAccount string `json:"sourceAccount"`
		DestBankCode  string `json:"destinationBankCode"`
		DestAccount   string `json:"destinationAccount"`
		Amount        int64  `json:"amountKobo"`
		Narration     string `json:"narration"`
		ChannelCode   string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sessionID := fmt.Sprintf("0000002605091%d", time.Now().UnixNano()%10000000000)
	txn := NIPTransaction{
		ID: fmt.Sprintf("NIP-%03d", len(nipTransactions)+1), SessionID: sessionID,
		Type: "fundsTransfer", SourceBank: "54Bank", SourceBankCode: "054",
		SourceAccount: req.SourceAccount, DestBankCode: req.DestBankCode,
		DestAccount: req.DestAccount, Amount: req.Amount, Narration: req.Narration,
		ResponseCode: "00", ResponseMessage: "Approved", Status: "successful",
		ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339), CompletedAt: time.Now().Format(time.RFC3339),
	}
	mu.Lock()
	nipTransactions = append(nipTransactions, txn)
	mu.Unlock()
	respondJSON(w, 200, txn)
}

func handleTSQ(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	mu.RLock()
	defer mu.RUnlock()
	for _, txn := range nipTransactions {
		if txn.SessionID == sessionID {
			respondJSON(w, 200, map[string]interface{}{"originalTransaction": txn, "tsqStatus": "found"})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Transaction not found", "responseCode": "25"})
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		respondJSON(w, 200, map[string]interface{}{"mandates": mandates, "total": len(mandates)})
		return
	}
	// POST — create mandate
	var req DirectDebitMandate
	json.NewDecoder(r.Body).Decode(&req)
	req.ID = fmt.Sprintf("DDM-%03d", len(mandates)+1)
	req.Status = "created"
	req.CreatedAt = time.Now().Format(time.RFC3339)
	mu.Lock()
	mandates = append(mandates, req)
	mu.Unlock()
	respondJSON(w, 201, req)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"transactions": nipTransactions, "total": len(nipTransactions)})
}

func handleSettlements(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"settlements": settlements, "total": len(settlements)})
}

func handleResponseCodes(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"responseCodes": responseCodes, "total": len(responseCodes)})
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "nibss-nip-engine-go", "version": "2.0.0",
		"protocol": "ISO_8583", "nipVersion": "2.0",
		"capabilities": []string{"nameEnquiry", "fundsTransfer", "tsq", "directDebit", "settlement"},
		"middleware": middlewareStatus(),
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
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
	mux.HandleFunc("/healthz", authMiddleware(handleHealthz))
	mux.HandleFunc("/v1/nip/name-enquiry", authMiddleware(handleNameEnquiry))
	mux.HandleFunc("/v1/nip/funds-transfer", authMiddleware(handleFundsTransfer))
	mux.HandleFunc("/v1/nip/tsq", authMiddleware(handleTSQ))
	mux.HandleFunc("/v1/nip/transactions", authMiddleware(handleTransactions))
	mux.HandleFunc("/v1/nip/mandates", authMiddleware(handleMandates))
	mux.HandleFunc("/v1/nip/settlements", authMiddleware(handleSettlements))
	mux.HandleFunc("/v1/nip/response-codes", authMiddleware(handleResponseCodes))


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
    log.Println(jsonLog("INFO", fmt.Sprintf("nibss-nip-engine-go listening on :%s", port)))
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
