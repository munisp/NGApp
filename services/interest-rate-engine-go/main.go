package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

// A4: Interest Rate Engine — centralized rate management, CBN MPR tracking, spread matrices

type BaseRate struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Rate        float64   `json:"rate"`
	EffectiveAt string    `json:"effectiveAt"`
	Source      string    `json:"source"`
	Currency    string    `json:"currency"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

type SpreadMatrix struct {
	ID           string  `json:"id"`
	BaseRateRef  string  `json:"baseRateRef"`
	ProductType  string  `json:"productType"`
	RiskBand     string  `json:"riskBand"`
	SpreadBps    int     `json:"spreadBps"`
	EffectiveRate float64 `json:"effectiveRate"`
	MinRate      float64 `json:"minRate"`
	MaxRate      float64 `json:"maxRate"`
}

type RateChange struct {
	ID            string    `json:"id"`
	BaseRateID    string    `json:"baseRateId"`
	OldRate       float64   `json:"oldRate"`
	NewRate       float64   `json:"newRate"`
	Reason        string    `json:"reason"`
	AffectedLoans int       `json:"affectedLoans"`
	EffectiveAt   string    `json:"effectiveAt"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ProductRate struct {
	ProductType   string  `json:"productType"`
	BaseRate      float64 `json:"baseRate"`
	Spread        float64 `json:"spread"`
	EffectiveRate float64 `json:"effectiveRate"`
	Floor         float64 `json:"floor"`
	Ceiling       float64 `json:"ceiling"`
}

var (
	mu            sync.RWMutex
	baseRates     []BaseRate
	spreadMatrices []SpreadMatrix
	rateChanges   []RateChange
)

func init() {
	now := time.Now()
	baseRates = []BaseRate{
		{ID: "BR-001", Name: "CBN Monetary Policy Rate (MPR)", Rate: 18.75, EffectiveAt: "2026-01-01", Source: "CBN", Currency: "NGN", Status: "active", CreatedAt: now},
		{ID: "BR-002", Name: "NIBOR (3-month)", Rate: 14.50, EffectiveAt: "2026-01-01", Source: "FMDQ", Currency: "NGN", Status: "active", CreatedAt: now},
		{ID: "BR-003", Name: "Treasury Bill Rate (91-day)", Rate: 11.50, EffectiveAt: "2026-01-01", Source: "CBN", Currency: "NGN", Status: "active", CreatedAt: now},
		{ID: "BR-004", Name: "SOFR (USD)", Rate: 5.33, EffectiveAt: "2026-01-01", Source: "FRBNY", Currency: "USD", Status: "active", CreatedAt: now},
		{ID: "BR-005", Name: "Savings Deposit Rate (Floor)", Rate: 6.20, EffectiveAt: "2026-01-01", Source: "CBN", Currency: "NGN", Status: "active", CreatedAt: now},
	}
	spreadMatrices = []SpreadMatrix{
		{ID: "SM-001", BaseRateRef: "BR-001", ProductType: "personal_loan", RiskBand: "low", SpreadBps: 250, EffectiveRate: 21.25, MinRate: 15.0, MaxRate: 30.0},
		{ID: "SM-002", BaseRateRef: "BR-001", ProductType: "personal_loan", RiskBand: "medium", SpreadBps: 450, EffectiveRate: 23.25, MinRate: 15.0, MaxRate: 30.0},
		{ID: "SM-003", BaseRateRef: "BR-001", ProductType: "personal_loan", RiskBand: "high", SpreadBps: 700, EffectiveRate: 25.75, MinRate: 15.0, MaxRate: 30.0},
		{ID: "SM-004", BaseRateRef: "BR-001", ProductType: "mortgage", RiskBand: "low", SpreadBps: 150, EffectiveRate: 20.25, MinRate: 12.0, MaxRate: 25.0},
		{ID: "SM-005", BaseRateRef: "BR-001", ProductType: "mortgage", RiskBand: "medium", SpreadBps: 300, EffectiveRate: 21.75, MinRate: 12.0, MaxRate: 25.0},
		{ID: "SM-006", BaseRateRef: "BR-001", ProductType: "sme_loan", RiskBand: "low", SpreadBps: 200, EffectiveRate: 20.75, MinRate: 14.0, MaxRate: 28.0},
		{ID: "SM-007", BaseRateRef: "BR-001", ProductType: "agriculture_loan", RiskBand: "low", SpreadBps: 100, EffectiveRate: 19.75, MinRate: 5.0, MaxRate: 15.0},
		{ID: "SM-008", BaseRateRef: "BR-005", ProductType: "savings", RiskBand: "low", SpreadBps: 0, EffectiveRate: 6.20, MinRate: 4.0, MaxRate: 12.0},
		{ID: "SM-009", BaseRateRef: "BR-005", ProductType: "fixed_deposit", RiskBand: "low", SpreadBps: 200, EffectiveRate: 8.20, MinRate: 6.0, MaxRate: 18.0},
		{ID: "SM-010", BaseRateRef: "BR-003", ProductType: "treasury_bill", RiskBand: "low", SpreadBps: 0, EffectiveRate: 11.50, MinRate: 8.0, MaxRate: 20.0},
	}
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
	"redis":       map[string]string{"url": envOr("REDIS_URL", "redis://localhost:6379")},
	"postgres":    map[string]string{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
	"opensearch":  map[string]string{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
	"keycloak":    map[string]string{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]string{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
	"dapr":        map[string]string{"url": envOr("DAPR_URL", "http://localhost:3500")},
	"fluvio":      map[string]string{"url": envOr("FLUVIO_URL", "localhost:9003")},
	"temporal":    map[string]string{"url": envOr("TEMPORAL_URL", "localhost:7233")},
	"mojaloop":    map[string]string{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
	"tigerbeetle": map[string]string{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
	"lakehouse":   map[string]string{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
	"apisix":      map[string]string{"url": envOr("APISIX_URL", "http://localhost:9080")},
	"openappsec":  map[string]string{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8131"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "interest-rate-engine", "port": port})
	})
	mux.HandleFunc("/v1/rates/base", handleBaseRates)
	mux.HandleFunc("/v1/rates/spreads", handleSpreads)
	mux.HandleFunc("/v1/rates/changes", handleRateChanges)
	mux.HandleFunc("/v1/rates/product", handleProductRate)
	mux.HandleFunc("/v1/rates/calculate", handleCalculateRate)
	mux.HandleFunc("/v1/rates/mpr-update", handleMPRUpdate)

	log.Printf("Interest Rate Engine listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleBaseRates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()

	if r.Method == http.MethodPost {
		var rate BaseRate
		if err := json.NewDecoder(r.Body).Decode(&rate); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		rate.ID = fmt.Sprintf("BR-%03d", len(baseRates)+1)
		rate.CreatedAt = time.Now()
		mu.RUnlock()
		mu.Lock()
		baseRates = append(baseRates, rate)
		mu.Unlock()
		mu.RLock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(rate)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": baseRates, "total": len(baseRates)})
}

func handleSpreads(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()

	if r.Method == http.MethodPost {
		var sm SpreadMatrix
		if err := json.NewDecoder(r.Body).Decode(&sm); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		sm.ID = fmt.Sprintf("SM-%03d", len(spreadMatrices)+1)
		for _, br := range baseRates {
			if br.ID == sm.BaseRateRef {
				sm.EffectiveRate = br.Rate + float64(sm.SpreadBps)/100.0
				break
			}
		}
		mu.RUnlock()
		mu.Lock()
		spreadMatrices = append(spreadMatrices, sm)
		mu.Unlock()
		mu.RLock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(sm)
		return
	}
	json.NewEncoder(w).Encode(spreadMatrices)
}

func handleRateChanges(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(rateChanges)
}

func handleProductRate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	productType := r.URL.Query().Get("product")
	riskBand := r.URL.Query().Get("risk")
	if riskBand == "" {
		riskBand = "low"
	}

	mu.RLock()
	defer mu.RUnlock()

	for _, sm := range spreadMatrices {
		if sm.ProductType == productType && sm.RiskBand == riskBand {
			var base float64
			for _, br := range baseRates {
				if br.ID == sm.BaseRateRef {
					base = br.Rate
					break
				}
			}
			pr := ProductRate{
				ProductType:   productType,
				BaseRate:      base,
				Spread:        float64(sm.SpreadBps) / 100.0,
				EffectiveRate: sm.EffectiveRate,
				Floor:         sm.MinRate,
				Ceiling:       sm.MaxRate,
			}
			json.NewEncoder(w).Encode(pr)
			return
		}
	}
	http.Error(w, `{"error":"no rate found for product/risk combination"}`, 404)
}

func handleCalculateRate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		Principal   float64 `json:"principal"`
		RatePercent float64 `json:"ratePercent"`
		TenorMonths int     `json:"tenorMonths"`
		Method      string  `json:"method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	if req.Method == "" {
		req.Method = "reducing_balance"
	}

	monthlyRate := req.RatePercent / 100.0 / 12.0
	var emi, totalInterest, totalPayment float64

	if req.Method == "flat" {
		totalInterest = req.Principal * (req.RatePercent / 100.0) * float64(req.TenorMonths) / 12.0
		totalPayment = req.Principal + totalInterest
		emi = totalPayment / float64(req.TenorMonths)
	} else {
		if monthlyRate > 0 {
			emi = req.Principal * monthlyRate * math.Pow(1+monthlyRate, float64(req.TenorMonths)) / (math.Pow(1+monthlyRate, float64(req.TenorMonths)) - 1)
		} else {
			emi = req.Principal / float64(req.TenorMonths)
		}
		totalPayment = emi * float64(req.TenorMonths)
		totalInterest = totalPayment - req.Principal
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"principal":     req.Principal,
		"rate":          req.RatePercent,
		"tenorMonths":   req.TenorMonths,
		"method":        req.Method,
		"monthlyPayment": math.Round(emi*100) / 100,
		"totalInterest":  math.Round(totalInterest*100) / 100,
		"totalPayment":   math.Round(totalPayment*100) / 100,
	})
}

func handleMPRUpdate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		NewRate     float64 `json:"newRate"`
		EffectiveAt string  `json:"effectiveAt"`
		Reason      string  `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	affected := 0
	for i, br := range baseRates {
		if br.Name == "CBN Monetary Policy Rate (MPR)" {
			oldRate := br.Rate
			baseRates[i].Rate = req.NewRate

			for j, sm := range spreadMatrices {
				if sm.BaseRateRef == br.ID {
					spreadMatrices[j].EffectiveRate = req.NewRate + float64(sm.SpreadBps)/100.0
					affected++
				}
			}

			rc := RateChange{
				ID:            fmt.Sprintf("RC-%03d", len(rateChanges)+1),
				BaseRateID:    br.ID,
				OldRate:       oldRate,
				NewRate:       req.NewRate,
				Reason:        req.Reason,
				AffectedLoans: affected,
				EffectiveAt:   req.EffectiveAt,
				Status:        "applied",
				CreatedAt:     time.Now(),
			}
			rateChanges = append(rateChanges, rc)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"rateChange":          rc,
				"affectedSpreadRules": affected,
				"message":             fmt.Sprintf("MPR updated from %.2f%% to %.2f%%, %d spread rules recalculated", oldRate, req.NewRate, affected),
			})
			return
		}
	}
	http.Error(w, `{"error":"MPR base rate not found"}`, 404)
}
