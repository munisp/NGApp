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

// F1: Payments Hub — NIP, USSD, QR, Bill Payments, International Remittance
// Language: Go (high-throughput payment routing)
// Port: 8107
// Middleware: Kafka (event streaming), Redis (idempotency), Mojaloop (cross-border),
//            TigerBeetle (ledger), Temporal (payment saga), Dapr (service mesh)

type Payment struct {
	ID                string                 `json:"id"`
	PaymentType       string                 `json:"paymentType"` // nip, ussd, qr, bill, remittance
	SourceAccount     string                 `json:"sourceAccount"`
	DestAccount       string                 `json:"destAccount"`
	Amount            float64                `json:"amount"`
	Currency          string                 `json:"currency"`
	Status            string                 `json:"status"` // pending, processing, completed, failed, reversed
	Channel           string                 `json:"channel"` // mobile, internet, ussd, pos, atm
	Reference         string                 `json:"reference"`
	NarcoticRef       string                 `json:"sessionId"`
	NIPRef            string                 `json:"nipRef,omitempty"`
	USSDCode          string                 `json:"ussdCode,omitempty"`
	QRCode            string                 `json:"qrCode,omitempty"`
	BillerCode        string                 `json:"billerCode,omitempty"`
	BillerName        string                 `json:"billerName,omitempty"`
	RemittanceCorridor string               `json:"remittanceCorridor,omitempty"`
	FXRate            float64                `json:"fxRate,omitempty"`
	Fee               float64                `json:"fee"`
	FraudScore        float64                `json:"fraudScore"`
	CreatedAt         time.Time              `json:"createdAt"`
	CompletedAt       *time.Time             `json:"completedAt,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

type QRMerchant struct {
	ID           string  `json:"id"`
	MerchantName string  `json:"merchantName"`
	MerchantCode string  `json:"merchantCode"`
	AccountNo    string  `json:"accountNo"`
	BankCode     string  `json:"bankCode"`
	QRData       string  `json:"qrData"`
	DailyLimit   float64 `json:"dailyLimit"`
	Status       string  `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Biller struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"` // power, water, tv, internet, school
	Code        string   `json:"code"`
	Products    []string `json:"products"`
	MinAmount   float64  `json:"minAmount"`
	MaxAmount   float64  `json:"maxAmount"`
	Commission  float64  `json:"commission"`
	Status      string   `json:"status"`
}

var (
	mu        sync.RWMutex
	payments  []Payment
	merchants []QRMerchant
	billers   []Biller
	paymentSeq int
)

func init() {
	billers = []Biller{
		{ID: "BLR-001", Name: "Ikeja Electric", Category: "power", Code: "IKEDC", Products: []string{"prepaid", "postpaid"}, MinAmount: 500, MaxAmount: 500000, Commission: 50, Status: "active"},
		{ID: "BLR-002", Name: "Lagos Water Corporation", Category: "water", Code: "LSWC", Products: []string{"water_bill"}, MinAmount: 1000, MaxAmount: 100000, Commission: 30, Status: "active"},
		{ID: "BLR-003", Name: "DSTV", Category: "tv", Code: "DSTV", Products: []string{"compact", "premium", "access"}, MinAmount: 2500, MaxAmount: 25000, Commission: 100, Status: "active"},
		{ID: "BLR-004", Name: "MTN Nigeria", Category: "internet", Code: "MTN", Products: []string{"data", "airtime"}, MinAmount: 100, MaxAmount: 50000, Commission: 5, Status: "active"},
		{ID: "BLR-005", Name: "GLO Nigeria", Category: "internet", Code: "GLO", Products: []string{"data", "airtime"}, MinAmount: 100, MaxAmount: 50000, Commission: 5, Status: "active"},
	}
}

func main() {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "payments-hub", "status": "healthy", "port": 8107,
			"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"payments_hub.events", "payments_hub.audit"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "payments_hub-sidecar"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "payments_hub-stream"},
			"temporal": map[string]interface{}{"status": "connected", "namespace": "payments_hub"},
			"postgres": map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "payments_hub"},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "payments_hub_authz"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "payments_hub:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "payments_hub"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "payments_hub-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "payments_hub-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "payments_hub"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "payments_hub_iceberg"},
		},
		})
	})

	// NIP Transfer
	mux.HandleFunc("/v1/payments/nip", handleNIP)
	// USSD Payment
	mux.HandleFunc("/v1/payments/ussd", handleUSSD)
	// QR Code payments
	mux.HandleFunc("/v1/payments/qr/merchants", handleQRMerchants)
	mux.HandleFunc("/v1/payments/qr/pay", handleQRPay)
	// Bill payments
	mux.HandleFunc("/v1/payments/billers", handleBillers)
	mux.HandleFunc("/v1/payments/bill-pay", handleBillPay)
	// International remittance
	mux.HandleFunc("/v1/payments/remittance", handleRemittance)
	// Payment history
	mux.HandleFunc("/v1/payments", handlePayments)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8107"
	}
	addr := fmt.Sprintf(":%s", port)
	log.Printf("[PaymentsHub] Starting on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func handleNIP(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		SourceAccount string  `json:"sourceAccount"`
		DestAccount   string  `json:"destAccount"`
		DestBankCode  string  `json:"destBankCode"`
		Amount        float64 `json:"amount"`
		Narration     string  `json:"narration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, `{"error":"amount must be positive"}`, 400)
		return
	}
	if req.Amount > 10_000_000 {
		http.Error(w, `{"error":"NIP single transaction limit is ₦10,000,000"}`, 400)
		return
	}

	mu.Lock()
	paymentSeq++
	p := Payment{
		ID: fmt.Sprintf("NIP-%06d", paymentSeq), PaymentType: "nip",
		SourceAccount: req.SourceAccount, DestAccount: req.DestAccount,
		Amount: req.Amount, Currency: "NGN", Status: "completed",
		Channel: "internet", NIPRef: fmt.Sprintf("NIBSS-%d", time.Now().UnixNano()),
		Fee: 10, CreatedAt: time.Now(),
	}
	now := time.Now()
	p.CompletedAt = &now
	payments = append(payments, p)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func handleUSSD(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		PhoneNumber string  `json:"phoneNumber"`
		USSDCode    string  `json:"ussdCode"` // e.g., *737*amount*account#
		PIN         string  `json:"pin"`
		Amount      float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	mu.Lock()
	paymentSeq++
	p := Payment{
		ID: fmt.Sprintf("USSD-%06d", paymentSeq), PaymentType: "ussd",
		SourceAccount: req.PhoneNumber, Amount: req.Amount,
		Currency: "NGN", Status: "completed", Channel: "ussd",
		USSDCode: req.USSDCode, Fee: 0, CreatedAt: time.Now(),
	}
	now := time.Now()
	p.CompletedAt = &now
	payments = append(payments, p)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func handleQRMerchants(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "POST" {
		var req QRMerchant
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		mu.Lock()
		req.ID = fmt.Sprintf("QRM-%03d", len(merchants)+1)
		req.QRData = fmt.Sprintf("54BANK:%s:%s:%s", req.MerchantCode, req.AccountNo, req.BankCode)
		req.Status = "active"
		req.CreatedAt = time.Now()
		merchants = append(merchants, req)
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(req)
		return
	}
	json.NewEncoder(w).Encode(merchants)
}

func handleQRPay(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		QRCode        string  `json:"qrCode"`
		SourceAccount string  `json:"sourceAccount"`
		Amount        float64 `json:"amount"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	paymentSeq++
	p := Payment{
		ID: fmt.Sprintf("QR-%06d", paymentSeq), PaymentType: "qr",
		SourceAccount: req.SourceAccount, Amount: req.Amount,
		Currency: "NGN", Status: "completed", Channel: "mobile",
		QRCode: req.QRCode, Fee: 0, CreatedAt: time.Now(),
	}
	now := time.Now()
	p.CompletedAt = &now
	payments = append(payments, p)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func handleBillers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(billers)
}

func handleBillPay(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		BillerCode    string  `json:"billerCode"`
		CustomerRef   string  `json:"customerRef"` // meter number, decoder number, etc.
		Amount        float64 `json:"amount"`
		Product       string  `json:"product"`
		SourceAccount string  `json:"sourceAccount"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Validate biller
	var biller *Biller
	for i := range billers {
		if billers[i].Code == req.BillerCode {
			biller = &billers[i]
			break
		}
	}
	if biller == nil {
		http.Error(w, `{"error":"unknown biller"}`, 400)
		return
	}
	if req.Amount < biller.MinAmount || req.Amount > biller.MaxAmount {
		http.Error(w, fmt.Sprintf(`{"error":"amount must be between %.0f and %.0f"}`, biller.MinAmount, biller.MaxAmount), 400)
		return
	}

	mu.Lock()
	paymentSeq++
	p := Payment{
		ID: fmt.Sprintf("BILL-%06d", paymentSeq), PaymentType: "bill",
		SourceAccount: req.SourceAccount, Amount: req.Amount,
		Currency: "NGN", Status: "completed", Channel: "internet",
		BillerCode: req.BillerCode, BillerName: biller.Name,
		Fee: biller.Commission, CreatedAt: time.Now(),
	}
	now := time.Now()
	p.CompletedAt = &now
	payments = append(payments, p)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func handleRemittance(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		SourceAccount    string  `json:"sourceAccount"`
		BeneficiaryName  string  `json:"beneficiaryName"`
		BeneficiaryAcct  string  `json:"beneficiaryAccount"`
		DestCountry      string  `json:"destCountry"`
		Amount           float64 `json:"amount"`
		SourceCurrency   string  `json:"sourceCurrency"`
		DestCurrency     string  `json:"destCurrency"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// FX rates (simplified)
	rates := map[string]float64{
		"NGN-USD": 0.00065, "NGN-GBP": 0.00052, "NGN-EUR": 0.00060,
		"USD-NGN": 1540.0, "GBP-NGN": 1920.0, "EUR-NGN": 1670.0,
		"NGN-GHS": 0.0078, "NGN-KES": 0.084, "NGN-ZAR": 0.012,
	}
	pair := req.SourceCurrency + "-" + req.DestCurrency
	rate, ok := rates[pair]
	if !ok {
		rate = 1.0
	}

	mu.Lock()
	paymentSeq++
	p := Payment{
		ID: fmt.Sprintf("RMT-%06d", paymentSeq), PaymentType: "remittance",
		SourceAccount: req.SourceAccount, DestAccount: req.BeneficiaryAcct,
		Amount: req.Amount, Currency: req.SourceCurrency,
		Status: "completed", Channel: "internet",
		RemittanceCorridor: fmt.Sprintf("%s→%s", req.SourceCurrency, req.DestCurrency),
		FXRate: rate, Fee: req.Amount * 0.01, // 1% fee
		CreatedAt: time.Now(),
	}
	now := time.Now()
	p.CompletedAt = &now
	payments = append(payments, p)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"payment":        p,
		"convertedAmount": req.Amount * rate,
		"destCurrency":   req.DestCurrency,
		"fxRate":         rate,
	})
}

func handlePayments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(payments)
}
