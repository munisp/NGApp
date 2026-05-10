package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Invoice struct {
	ID              string  `json:"id"`
	InvoiceRef      string  `json:"invoiceRef"`
	ProgramType     string  `json:"programType"` // receivables, payables, reverse_factoring, dynamic_discounting, distributor, dealer, warehouse, pre_shipment
	BuyerID         string  `json:"buyerId"`
	BuyerName       string  `json:"buyerName"`
	SellerID        string  `json:"sellerId"`
	SellerName      string  `json:"sellerName"`
	Currency        string  `json:"currency"`
	FaceValue       float64 `json:"faceValue"`
	DiscountRate    float64 `json:"discountRate"`
	FinancedAmount  float64 `json:"financedAmount"`
	DaysTillMaturity int    `json:"daysTillMaturity"`
	DiscountAmount  float64 `json:"discountAmount"`
	NetProceeds     float64 `json:"netProceeds"`
	Status          string  `json:"status"` // submitted, approved, financed, settled, overdue
	InvoiceDate     string  `json:"invoiceDate"`
	DueDate         string  `json:"dueDate"`
	FinancedDate    string  `json:"financedDate,omitempty"`
	SettledDate     string  `json:"settledDate,omitempty"`
}

type Program struct {
	ID           string  `json:"id"`
	ProgramType  string  `json:"programType"`
	AnchorName   string  `json:"anchorName"`
	AnchorID     string  `json:"anchorId"`
	CreditLimit  float64 `json:"creditLimit"`
	Utilized     float64 `json:"utilized"`
	Available    float64 `json:"available"`
	CounterpartyCount int `json:"counterpartyCount"`
	Currency     string  `json:"currency"`
	Status       string  `json:"status"`
	StartDate    string  `json:"startDate"`
	ExpiryDate   string  `json:"expiryDate"`
}

type FinanceRequest struct {
	InvoiceRef    string  `json:"invoiceRef"`
	ProgramType   string  `json:"programType"`
	BuyerName     string  `json:"buyerName"`
	SellerName    string  `json:"sellerName"`
	FaceValue     float64 `json:"faceValue"`
	DaysTillMaturity int  `json:"daysTillMaturity"`
	DiscountRate  float64 `json:"discountRate"`
}

var (
	invoices []Invoice
	programs []Program
	mu       sync.Mutex
)

func calcDiscount(faceValue, rate float64, days int) (float64, float64) {
	discount := faceValue * (rate / 100.0) * float64(days) / 360.0
	discount = float64(int(discount*100)) / 100.0
	return discount, faceValue - discount
}

func init() {
	programs = []Program{
		{"PRG-001", "receivables", "Dangote Cement PLC", "DGL-001", 50_000_000_000, 32_000_000_000, 18_000_000_000, 45, "NGN", "active", "2026-01-01", "2027-01-01"},
		{"PRG-002", "payables", "MTN Nigeria", "MTN-001", 30_000_000_000, 18_500_000_000, 11_500_000_000, 120, "NGN", "active", "2026-02-01", "2027-02-01"},
		{"PRG-003", "reverse_factoring", "Nigerian Breweries", "NB-001", 15_000_000_000, 9_200_000_000, 5_800_000_000, 30, "NGN", "active", "2026-03-01", "2026-12-31"},
		{"PRG-004", "dynamic_discounting", "Flour Mills Nigeria", "FMN-001", 10_000_000_000, 4_500_000_000, 5_500_000_000, 25, "NGN", "active", "2026-01-15", "2026-12-15"},
		{"PRG-005", "distributor", "Nestle Nigeria", "NST-001", 20_000_000_000, 12_800_000_000, 7_200_000_000, 80, "NGN", "active", "2026-04-01", "2027-04-01"},
	}

	seedInvoices := []struct {
		id, ref_, prog, buyID, buyName, sellID, sellName string
		face, rate float64
		days int
		status, invDate, dueDate string
	}{
		{"INV-001", "DGL-INV-2026-0451", "receivables", "DGL-001", "Dangote Cement PLC", "SUP-001", "Lafarge Africa PLC", 2_500_000_000, 14.5, 60, "financed", "2026-04-01", "2026-05-31"},
		{"INV-002", "MTN-INV-2026-1122", "payables", "MTN-001", "MTN Nigeria", "SUP-002", "Huawei Technologies", 1_800_000_000, 13.0, 90, "financed", "2026-03-15", "2026-06-13"},
		{"INV-003", "NB-INV-2026-0330", "reverse_factoring", "NB-001", "Nigerian Breweries", "SUP-003", "Crown Packaging Nigeria", 750_000_000, 12.5, 45, "settled", "2026-02-15", "2026-04-01"},
		{"INV-004", "FMN-INV-2026-0512", "dynamic_discounting", "FMN-001", "Flour Mills Nigeria", "SUP-004", "Olam Nigeria Ltd", 500_000_000, 8.0, 30, "approved", "2026-05-01", "2026-05-31"},
		{"INV-005", "DGL-INV-2026-0555", "receivables", "DGL-001", "Dangote Cement PLC", "SUP-005", "WAPCO PLC", 3_200_000_000, 15.0, 75, "submitted", "2026-05-05", "2026-07-19"},
		{"INV-006", "NST-INV-2026-0901", "distributor", "NST-001", "Nestle Nigeria", "DIST-001", "Chi Limited", 1_200_000_000, 13.5, 60, "financed", "2026-04-10", "2026-06-09"},
		{"INV-007", "DGL-INV-2026-0320", "receivables", "DGL-001", "Dangote Cement PLC", "SUP-006", "Berger Paints Nigeria", 900_000_000, 14.0, 45, "overdue", "2026-02-01", "2026-03-18"},
	}

	for _, s := range seedInvoices {
		disc, net := calcDiscount(s.face, s.rate, s.days)
		inv := Invoice{
			ID: s.id, InvoiceRef: s.ref_, ProgramType: s.prog,
			BuyerID: s.buyID, BuyerName: s.buyName, SellerID: s.sellID, SellerName: s.sellName,
			Currency: "NGN", FaceValue: s.face, DiscountRate: s.rate, FinancedAmount: s.face,
			DaysTillMaturity: s.days, DiscountAmount: disc, NetProceeds: net,
			Status: s.status, InvoiceDate: s.invDate, DueDate: s.dueDate,
		}
		if s.status == "financed" || s.status == "settled" {
			inv.FinancedDate = s.invDate
		}
		if s.status == "settled" {
			inv.SettledDate = s.dueDate
		}
		invoices = append(invoices, inv)
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"status": "ok", "service": "supply-chain-finance",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"scf.invoice.submitted", "scf.invoice.financed", "scf.invoice.settled"}},
				"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"scf:programs", "scf:limits", "scf:counterparty_ratings"}},
				"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"scf_invoices", "scf_programs", "scf_counterparties"}},
				"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"scf-invoices", "scf-audit"}},
				"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "scf-service"},
				"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"scf_invoice", "scf_program", "scf_financing"}},
				"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "supply-chain-finance", "pubsub": "scf-events"},
				"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"scf-erp-feed", "scf-settlement-stream"}},
				"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"InvoiceFinancingWorkflow", "SettlementWorkflow", "ProgramRenewalWorkflow"}},
				"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "supplier-payments"},
				"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"scf_receivables", "scf_payables", "scf_financing"}},
				"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"scf_invoices_history", "scf_program_analytics"}},
				"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/api/scf/*"}},
				"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "scf-waf-rules"},
			},
		})
	})

	mux.HandleFunc("/v1/scf/invoices", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			mu.Lock()
			respondJSON(w, 200, map[string]interface{}{"items": invoices, "total": len(invoices)})
			mu.Unlock()
			return
		}
		if r.Method == http.MethodPost {
			var req FinanceRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
				return
			}
			if req.FaceValue <= 0 {
				respondJSON(w, 400, map[string]string{"error": "faceValue must be positive"})
				return
			}
			if req.DaysTillMaturity <= 0 {
				respondJSON(w, 400, map[string]string{"error": "daysTillMaturity must be positive"})
				return
			}
			if req.DiscountRate <= 0 || req.DiscountRate > 100 {
				respondJSON(w, 400, map[string]string{"error": "discountRate must be 0-100"})
				return
			}
			disc, net := calcDiscount(req.FaceValue, req.DiscountRate, req.DaysTillMaturity)
			mu.Lock()
			inv := Invoice{
				ID: fmt.Sprintf("INV-%03d", len(invoices)+1), InvoiceRef: req.InvoiceRef,
				ProgramType: req.ProgramType, BuyerName: req.BuyerName, SellerName: req.SellerName,
				Currency: "NGN", FaceValue: req.FaceValue, DiscountRate: req.DiscountRate,
				FinancedAmount: req.FaceValue, DaysTillMaturity: req.DaysTillMaturity,
				DiscountAmount: disc, NetProceeds: net, Status: "submitted",
				InvoiceDate: time.Now().UTC().Format("2006-01-02"), DueDate: "TBD",
			}
			invoices = append(invoices, inv)
			mu.Unlock()
			respondJSON(w, 201, inv)
			return
		}
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	})

	mux.HandleFunc("/v1/scf/programs", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"items": programs, "total": len(programs)})
	})

	mux.HandleFunc("/v1/scf/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		totalFinanced := 0.0
		totalDiscount := 0.0
		overdue := 0
		for _, inv := range invoices {
			if inv.Status == "financed" || inv.Status == "settled" {
				totalFinanced += inv.FinancedAmount
				totalDiscount += inv.DiscountAmount
			}
			if inv.Status == "overdue" {
				overdue++
			}
		}
		totalLimit := 0.0
		totalUtilized := 0.0
		for _, p := range programs {
			totalLimit += p.CreditLimit
			totalUtilized += p.Utilized
		}
		respondJSON(w, 200, map[string]interface{}{
			"totalInvoices": len(invoices), "totalFinanced": totalFinanced,
			"totalDiscountEarned": totalDiscount, "overdueInvoices": overdue,
			"totalProgramLimit": totalLimit, "totalUtilized": totalUtilized,
			"utilizationRate": fmt.Sprintf("%.1f%%", totalUtilized/totalLimit*100),
			"activePrograms": len(programs),
		})
	})

	fmt.Println("Supply Chain Finance service on :8158")
	http.ListenAndServe(":8158", mux)
}
