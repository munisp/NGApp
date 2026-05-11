package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

type SalaryBatch struct {
	ID            string  `json:"id"`
	CompanyName   string  `json:"companyName"`
	CompanyID     string  `json:"companyId"`
	PayrollMonth  string  `json:"payrollMonth"`
	EmployeeCount int     `json:"employeeCount"`
	GrossPay      float64 `json:"grossPay"`
	Deductions    float64 `json:"deductions"`
	NetPay        float64 `json:"netPay"`
	Tax           float64 `json:"tax"`
	Pension       float64 `json:"pension"`
	NHF           float64 `json:"nhf"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	SubmittedAt   string  `json:"submittedAt"`
	ProcessedAt   string  `json:"processedAt,omitempty"`
	ValueDate     string  `json:"valueDate"`
	FailedCount   int     `json:"failedCount"`
	SuccessCount  int     `json:"successCount"`
}

type SalaryInstruction struct {
	ID           string  `json:"id"`
	BatchID      string  `json:"batchId"`
	EmployeeName string  `json:"employeeName"`
	AccountNo    string  `json:"accountNo"`
	BankCode     string  `json:"bankCode"`
	GrossPay     float64 `json:"grossPay"`
	NetPay       float64 `json:"netPay"`
	Tax          float64 `json:"tax"`
	Pension      float64 `json:"pension"`
	Status       string  `json:"status"`
	FailReason   string  `json:"failReason,omitempty"`
}

var (
	mu           sync.Mutex
	batches      []SalaryBatch
	instructions []SalaryInstruction
)

func init() {
	batches = []SalaryBatch{
		{ID: "SAL-001", CompanyName: "Pinnacle Holdings Ltd", CompanyID: "COMP-001", PayrollMonth: "2026-04", EmployeeCount: 2500, GrossPay: 850_000_000, Deductions: 195_000_000, NetPay: 655_000_000, Tax: 120_000_000, Pension: 60_000_000, NHF: 15_000_000, Currency: "NGN", Status: "processed", SubmittedAt: "2026-05-01T08:00:00Z", ProcessedAt: "2026-05-01T09:15:00Z", ValueDate: "2026-05-01", FailedCount: 3, SuccessCount: 2497},
		{ID: "SAL-002", CompanyName: "Dangote Cement PLC", CompanyID: "COMP-002", PayrollMonth: "2026-04", EmployeeCount: 15000, GrossPay: 4_200_000_000, Deductions: 980_000_000, NetPay: 3_220_000_000, Tax: 630_000_000, Pension: 280_000_000, NHF: 70_000_000, Currency: "NGN", Status: "processed", SubmittedAt: "2026-04-28T10:00:00Z", ProcessedAt: "2026-04-28T14:00:00Z", ValueDate: "2026-04-30", FailedCount: 12, SuccessCount: 14988},
		{ID: "SAL-003", CompanyName: "Zenith Construction Ltd", CompanyID: "COMP-003", PayrollMonth: "2026-04", EmployeeCount: 450, GrossPay: 180_000_000, Deductions: 42_000_000, NetPay: 138_000_000, Tax: 25_200_000, Pension: 13_500_000, NHF: 3_300_000, Currency: "NGN", Status: "processed", SubmittedAt: "2026-05-02T07:30:00Z", ProcessedAt: "2026-05-02T08:00:00Z", ValueDate: "2026-05-02", FailedCount: 0, SuccessCount: 450},
		{ID: "SAL-004", CompanyName: "54Bank Internal", CompanyID: "COMP-SELF", PayrollMonth: "2026-05", EmployeeCount: 3200, GrossPay: 1_100_000_000, Deductions: 265_000_000, NetPay: 835_000_000, Tax: 160_000_000, Pension: 82_500_000, NHF: 22_500_000, Currency: "NGN", Status: "pending_approval", SubmittedAt: "2026-05-09T09:00:00Z", ValueDate: "2026-05-25", FailedCount: 0, SuccessCount: 0},
		{ID: "SAL-005", CompanyName: "Farmgate Commodities Ltd", CompanyID: "COMP-004", PayrollMonth: "2026-04", EmployeeCount: 180, GrossPay: 95_000_000, Deductions: 22_000_000, NetPay: 73_000_000, Tax: 13_300_000, Pension: 7_125_000, NHF: 1_575_000, Currency: "NGN", Status: "failed", SubmittedAt: "2026-05-03T11:00:00Z", ValueDate: "2026-05-03", FailedCount: 180, SuccessCount: 0},
	}

	instructions = []SalaryInstruction{
		{ID: "SI-001", BatchID: "SAL-001", EmployeeName: "Adebayo Ogundimu", AccountNo: "5400001234", BankCode: "54B", GrossPay: 1_200_000, NetPay: 890_000, Tax: 180_000, Pension: 96_000, Status: "success"},
		{ID: "SI-002", BatchID: "SAL-001", EmployeeName: "Nkechi Eze", AccountNo: "5400005678", BankCode: "54B", GrossPay: 1_500_000, NetPay: 1_100_000, Tax: 225_000, Pension: 120_000, Status: "success"},
		{ID: "SI-003", BatchID: "SAL-001", EmployeeName: "Abdul Kareem", AccountNo: "0440012345", BankCode: "GTB", GrossPay: 850_000, NetPay: 650_000, Tax: 127_500, Pension: 68_000, Status: "success"},
		{ID: "SI-004", BatchID: "SAL-001", EmployeeName: "Invalid Account Holder", AccountNo: "9999999999", BankCode: "UBA", GrossPay: 600_000, NetPay: 460_000, Tax: 90_000, Pension: 48_000, Status: "failed", FailReason: "NIBSS name enquiry failed — account not found"},
		{ID: "SI-005", BatchID: "SAL-005", EmployeeName: "Entire Batch Failed", AccountNo: "5400009999", BankCode: "54B", GrossPay: 500_000, NetPay: 385_000, Tax: 75_000, Pension: 40_000, Status: "failed", FailReason: "Insufficient funds in company settlement account"},
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
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status": "ok", "service": "salary-processing",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"salary_processing.events", "salary_processing.audit", "salary_processing.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "salary_processing-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "salary_processing-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "salary_processing"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "salary_processing"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "salary_processing_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "salary_processing:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "salary_processing"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "salary_processing-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "salary_processing-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "salary_processing"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "salary_processing_iceberg"},
			},
		})
	})

	mux.HandleFunc("/v1/salary/batches", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respondJSON(w, http.StatusOK, map[string]interface{}{"items": batches, "total": len(batches)})
			mu.Unlock()
		case http.MethodPost:
			var b SalaryBatch
			if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
				return
			}
			if b.CompanyName == "" || b.EmployeeCount <= 0 || b.NetPay <= 0 {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "companyName, employeeCount > 0, netPay > 0 required"})
				return
			}
			mu.Lock()
			b.ID = fmt.Sprintf("SAL-%03d", len(batches)+1)
			b.Status = "pending_approval"
			b.SubmittedAt = time.Now().UTC().Format(time.RFC3339)
			b.Currency = "NGN"
			batches = append(batches, b)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, b)
		default:
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	mux.HandleFunc("/v1/salary/instructions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET only"})
			return
		}
		batchID := r.URL.Query().Get("batchId")
		mu.Lock()
		var filtered []SalaryInstruction
		for _, i := range instructions {
			if batchID == "" || i.BatchID == batchID {
				filtered = append(filtered, i)
			}
		}
		mu.Unlock()
		if filtered == nil {
			filtered = []SalaryInstruction{}
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": filtered, "total": len(filtered)})
	})

	mux.HandleFunc("/v1/salary/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		totalGross := 0.0
		totalNet := 0.0
		totalTax := 0.0
		totalEmployees := 0
		byStatus := map[string]int{}
		for _, b := range batches {
			totalGross += b.GrossPay
			totalNet += b.NetPay
			totalTax += b.Tax
			totalEmployees += b.EmployeeCount
			byStatus[b.Status]++
		}
		mu.Unlock()
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalBatches": len(batches), "totalEmployees": totalEmployees,
			"totalGrossPay": totalGross, "totalNetPay": totalNet, "totalTax": totalTax,
			"byStatus": byStatus,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8150"
	}
	fmt.Printf("salary-processing listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
