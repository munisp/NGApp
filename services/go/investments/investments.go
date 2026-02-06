package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sync"
	"time"
)

type InvestmentType string

const (
	TypeFixedDeposit InvestmentType = "fixed_deposit"
	TypeMoneyMarket  InvestmentType = "money_market"
	TypeMutualFund   InvestmentType = "mutual_fund"
	TypeTBills       InvestmentType = "treasury_bills"
	TypeBonds        InvestmentType = "bonds"
	TypeStocks       InvestmentType = "stocks"
	TypeREIT         InvestmentType = "reit"
)

type InvestmentProduct struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Type           InvestmentType `json:"type"`
	Description    string         `json:"description"`
	MinAmount      float64        `json:"min_amount"`
	Currency       string         `json:"currency"`
	ExpectedReturn float64        `json:"expected_return"`
	RiskLevel      string         `json:"risk_level"`
	LockPeriodDays int            `json:"lock_period_days"`
	Active         bool           `json:"active"`
}

type Portfolio struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Name        string            `json:"name"`
	TotalValue  float64           `json:"total_value"`
	TotalGain   float64           `json:"total_gain"`
	Holdings    []Holding         `json:"holdings"`
	RiskProfile string            `json:"risk_profile"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type Holding struct {
	ID           string         `json:"id"`
	ProductID    string         `json:"product_id"`
	ProductName  string         `json:"product_name"`
	Type         InvestmentType `json:"type"`
	Units        float64        `json:"units"`
	BuyPrice     float64        `json:"buy_price"`
	CurrentPrice float64        `json:"current_price"`
	TotalValue   float64        `json:"total_value"`
	Gain         float64        `json:"gain"`
	GainPercent  float64        `json:"gain_percent"`
	BoughtAt     time.Time      `json:"bought_at"`
}

type FixedDeposit struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	Principal     float64   `json:"principal"`
	Rate          float64   `json:"rate"`
	TenorDays     int       `json:"tenor_days"`
	MaturityDate  time.Time `json:"maturity_date"`
	ExpectedYield float64   `json:"expected_yield"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	AutoRollover  bool      `json:"auto_rollover"`
	CreatedAt     time.Time `json:"created_at"`
}

type RoboAdvisorProfile struct {
	UserID          string  `json:"user_id"`
	RiskTolerance   string  `json:"risk_tolerance"`
	InvestmentGoal  string  `json:"investment_goal"`
	TimeHorizon     int     `json:"time_horizon_years"`
	MonthlyBudget   float64 `json:"monthly_budget"`
	Recommendation  []AllocationRec `json:"recommendation"`
	ExpectedReturn  float64 `json:"expected_return"`
	ProjectedValue  float64 `json:"projected_value"`
}

type AllocationRec struct {
	AssetClass string  `json:"asset_class"`
	Allocation float64 `json:"allocation"`
	Product    string  `json:"product"`
	Risk       string  `json:"risk"`
}

type DividendRecord struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	HoldingID string    `json:"holding_id"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	PaidAt    time.Time `json:"paid_at"`
}

var (
	investProducts  = make(map[string]*InvestmentProduct)
	portfolios      = make(map[string]*Portfolio)
	fixedDeposits   = make(map[string]*FixedDeposit)
	dividends       = make(map[string][]DividendRecord)
	roboProfiles    = make(map[string]*RoboAdvisorProfile)
	mu              sync.RWMutex
	idCounter       int64
)

func generateID(prefix string) string {
	mu.Lock()
	idCounter++
	id := idCounter
	mu.Unlock()
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), id)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func readJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" { w.WriteHeader(200); return }
		next.ServeHTTP(w, r)
	})
}

func initProducts() {
	catalog := []struct {
		name   string; typ InvestmentType; desc string; min float64
		ret    float64; risk string; lock int
	}{
		{"AfriFixed 90-Day", TypeFixedDeposit, "90-day fixed deposit with guaranteed returns", 100000, 0.12, "low", 90},
		{"AfriFixed 180-Day", TypeFixedDeposit, "180-day fixed deposit with higher returns", 100000, 0.145, "low", 180},
		{"AfriFixed 365-Day", TypeFixedDeposit, "1-year fixed deposit with premium returns", 250000, 0.17, "low", 365},
		{"AfriMoney Market Fund", TypeMoneyMarket, "Daily accruing money market fund with next-day liquidity", 10000, 0.11, "low", 0},
		{"AfriEquity Growth Fund", TypeMutualFund, "Diversified equity fund tracking top African companies", 50000, 0.22, "high", 0},
		{"AfriBalanced Fund", TypeMutualFund, "Mixed asset fund with bonds and equities", 25000, 0.16, "medium", 0},
		{"FGN Treasury Bills", TypeTBills, "Federal Government of Nigeria treasury bills", 50000, 0.10, "low", 91},
		{"FGN Savings Bond", TypeBonds, "Federal Government savings bonds with quarterly coupon", 5000, 0.13, "low", 730},
		{"AfriREIT", TypeREIT, "Real estate investment trust focused on African commercial property", 100000, 0.18, "medium", 0},
		{"NSE Top 30 ETF", TypeStocks, "Exchange-traded fund tracking top 30 Nigerian Stock Exchange companies", 10000, 0.25, "high", 0},
	}

	for i, p := range catalog {
		id := fmt.Sprintf("inv_prod_%d", i+1)
		investProducts[id] = &InvestmentProduct{
			ID: id, Name: p.name, Type: p.typ, Description: p.desc,
			MinAmount: p.min, Currency: "NGN", ExpectedReturn: p.ret,
			RiskLevel: p.risk, LockPeriodDays: p.lock, Active: true,
		}
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "investments", "version": "1.0.0",
		"products": len(investProducts), "portfolios": len(portfolios),
	})
}

func handleListProducts(w http.ResponseWriter, r *http.Request) {
	typ := r.URL.Query().Get("type")
	var prods []*InvestmentProduct
	mu.RLock()
	for _, p := range investProducts {
		if typ == "" || string(p.Type) == typ {
			prods = append(prods, p)
		}
	}
	mu.RUnlock()
	writeJSON(w, 200, map[string]interface{}{"products": prods, "total": len(prods)})
}

func handleBuy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID    string  `json:"user_id"`
		ProductID string  `json:"product_id"`
		Amount    float64 `json:"amount"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.RLock()
	prod := investProducts[req.ProductID]
	mu.RUnlock()
	if prod == nil {
		writeJSON(w, 404, map[string]string{"error": "product not found"}); return
	}
	if req.Amount < prod.MinAmount {
		writeJSON(w, 400, map[string]string{"error": fmt.Sprintf("minimum amount is %.0f", prod.MinAmount)}); return
	}

	if prod.Type == TypeFixedDeposit {
		fd := &FixedDeposit{
			ID: generateID("fd"), UserID: req.UserID, Principal: req.Amount,
			Rate: prod.ExpectedReturn, TenorDays: prod.LockPeriodDays,
			MaturityDate: time.Now().AddDate(0, 0, prod.LockPeriodDays),
			ExpectedYield: req.Amount * prod.ExpectedReturn * float64(prod.LockPeriodDays) / 365.0,
			Currency: prod.Currency, Status: "active", AutoRollover: false,
			CreatedAt: time.Now(),
		}
		mu.Lock()
		fixedDeposits[fd.ID] = fd
		mu.Unlock()
		writeJSON(w, 201, fd)
		return
	}

	unitPrice := req.Amount / (1 + prod.ExpectedReturn/4)
	units := req.Amount / unitPrice

	holding := Holding{
		ID: generateID("hold"), ProductID: prod.ID, ProductName: prod.Name,
		Type: prod.Type, Units: units, BuyPrice: unitPrice,
		CurrentPrice: unitPrice, TotalValue: req.Amount,
		Gain: 0, GainPercent: 0, BoughtAt: time.Now(),
	}

	mu.Lock()
	port := portfolios[req.UserID]
	if port == nil {
		port = &Portfolio{
			ID: generateID("port"), UserID: req.UserID, Name: "My Portfolio",
			Holdings: []Holding{}, RiskProfile: "moderate", CreatedAt: time.Now(),
		}
		portfolios[req.UserID] = port
	}
	port.Holdings = append(port.Holdings, holding)
	port.TotalValue += req.Amount
	port.UpdatedAt = time.Now()
	mu.Unlock()

	writeJSON(w, 201, map[string]interface{}{"holding": holding, "portfolio_value": port.TotalValue})
}

func handleSell(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID    string  `json:"user_id"`
		HoldingID string  `json:"holding_id"`
		Units     float64 `json:"units"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.Lock()
	port := portfolios[req.UserID]
	if port == nil {
		mu.Unlock()
		writeJSON(w, 404, map[string]string{"error": "portfolio not found"}); return
	}

	var sold *Holding
	for i, h := range port.Holdings {
		if h.ID == req.HoldingID {
			if req.Units > h.Units {
				mu.Unlock()
				writeJSON(w, 400, map[string]string{"error": "insufficient units"}); return
			}
			proceeds := req.Units * h.CurrentPrice
			port.Holdings[i].Units -= req.Units
			port.Holdings[i].TotalValue = port.Holdings[i].Units * port.Holdings[i].CurrentPrice
			port.TotalValue -= proceeds
			sold = &port.Holdings[i]
			break
		}
	}
	mu.Unlock()

	if sold == nil {
		writeJSON(w, 404, map[string]string{"error": "holding not found"}); return
	}

	writeJSON(w, 200, map[string]interface{}{
		"holding": sold, "units_sold": req.Units,
		"proceeds": req.Units * sold.CurrentPrice,
	})
}

func handleGetPortfolio(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mu.RLock()
	port := portfolios[userID]
	mu.RUnlock()
	if port == nil {
		writeJSON(w, 200, map[string]interface{}{
			"portfolio": nil, "message": "no portfolio yet",
		}); return
	}

	totalGain := 0.0
	for i := range port.Holdings {
		gain := (port.Holdings[i].CurrentPrice - port.Holdings[i].BuyPrice) * port.Holdings[i].Units
		port.Holdings[i].Gain = math.Round(gain*100) / 100
		if port.Holdings[i].BuyPrice > 0 {
			port.Holdings[i].GainPercent = math.Round((port.Holdings[i].CurrentPrice/port.Holdings[i].BuyPrice-1)*10000) / 100
		}
		totalGain += gain
	}
	port.TotalGain = math.Round(totalGain*100) / 100

	writeJSON(w, 200, port)
}

func handleGetFixedDeposits(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mu.RLock()
	var userFDs []*FixedDeposit
	for _, fd := range fixedDeposits {
		if fd.UserID == userID {
			userFDs = append(userFDs, fd)
		}
	}
	mu.RUnlock()
	writeJSON(w, 200, map[string]interface{}{"fixed_deposits": userFDs, "total": len(userFDs)})
}

func handleBreakFixedDeposit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FixedDepositID string `json:"fixed_deposit_id"`
		UserID         string `json:"user_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.Lock()
	fd := fixedDeposits[req.FixedDepositID]
	if fd != nil && fd.UserID == req.UserID {
		daysHeld := time.Since(fd.CreatedAt).Hours() / 24
		penalty := 0.25
		actualYield := fd.Principal * fd.Rate * daysHeld / 365.0 * (1 - penalty)
		fd.ExpectedYield = math.Round(actualYield*100) / 100
		fd.Status = "broken"
	}
	mu.Unlock()

	if fd == nil {
		writeJSON(w, 404, map[string]string{"error": "fixed deposit not found"}); return
	}

	writeJSON(w, 200, map[string]interface{}{
		"fixed_deposit": fd,
		"payout": fd.Principal + fd.ExpectedYield,
		"penalty_applied": true,
	})
}

func handleRoboAdvisor(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID         string  `json:"user_id"`
		RiskTolerance  string  `json:"risk_tolerance"`
		InvestmentGoal string  `json:"investment_goal"`
		TimeHorizon    int     `json:"time_horizon_years"`
		MonthlyBudget  float64 `json:"monthly_budget"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	var recs []AllocationRec
	var expectedReturn float64

	switch req.RiskTolerance {
	case "conservative":
		recs = []AllocationRec{
			{"Fixed Deposits", 40, "AfriFixed 365-Day", "low"},
			{"Money Market", 25, "AfriMoney Market Fund", "low"},
			{"Treasury Bills", 20, "FGN Treasury Bills", "low"},
			{"Bonds", 15, "FGN Savings Bond", "low"},
		}
		expectedReturn = 0.13
	case "moderate":
		recs = []AllocationRec{
			{"Fixed Deposits", 20, "AfriFixed 180-Day", "low"},
			{"Money Market", 15, "AfriMoney Market Fund", "low"},
			{"Balanced Fund", 25, "AfriBalanced Fund", "medium"},
			{"REIT", 15, "AfriREIT", "medium"},
			{"Equities", 15, "AfriEquity Growth Fund", "high"},
			{"Treasury Bills", 10, "FGN Treasury Bills", "low"},
		}
		expectedReturn = 0.17
	case "aggressive":
		recs = []AllocationRec{
			{"Equities", 35, "AfriEquity Growth Fund", "high"},
			{"ETF", 20, "NSE Top 30 ETF", "high"},
			{"REIT", 15, "AfriREIT", "medium"},
			{"Balanced Fund", 15, "AfriBalanced Fund", "medium"},
			{"Money Market", 10, "AfriMoney Market Fund", "low"},
			{"Fixed Deposits", 5, "AfriFixed 90-Day", "low"},
		}
		expectedReturn = 0.22
	default:
		recs = []AllocationRec{
			{"Money Market", 30, "AfriMoney Market Fund", "low"},
			{"Fixed Deposits", 30, "AfriFixed 180-Day", "low"},
			{"Balanced Fund", 25, "AfriBalanced Fund", "medium"},
			{"Treasury Bills", 15, "FGN Treasury Bills", "low"},
		}
		expectedReturn = 0.14
	}

	monthlyRate := expectedReturn / 12
	months := float64(req.TimeHorizon * 12)
	projected := req.MonthlyBudget * ((math.Pow(1+monthlyRate, months) - 1) / monthlyRate)

	profile := &RoboAdvisorProfile{
		UserID: req.UserID, RiskTolerance: req.RiskTolerance,
		InvestmentGoal: req.InvestmentGoal, TimeHorizon: req.TimeHorizon,
		MonthlyBudget: req.MonthlyBudget, Recommendation: recs,
		ExpectedReturn: expectedReturn,
		ProjectedValue: math.Round(projected*100) / 100,
	}

	mu.Lock()
	roboProfiles[req.UserID] = profile
	mu.Unlock()

	writeJSON(w, 200, profile)
}

func handleDividends(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mu.RLock()
	userDivs := dividends[userID]
	mu.RUnlock()
	total := 0.0
	for _, d := range userDivs {
		total += d.Amount
	}
	writeJSON(w, 200, map[string]interface{}{
		"dividends": userDivs, "total_earned": total,
	})
}

func handleMaturityCheck(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	var matured []*FixedDeposit
	for _, fd := range fixedDeposits {
		if fd.Status == "active" && time.Now().After(fd.MaturityDate) {
			matured = append(matured, fd)
		}
	}
	mu.RUnlock()

	for _, fd := range matured {
		mu.Lock()
		if fd.AutoRollover {
			fd.CreatedAt = time.Now()
			fd.MaturityDate = time.Now().AddDate(0, 0, fd.TenorDays)
		} else {
			fd.Status = "matured"
		}
		mu.Unlock()
	}

	writeJSON(w, 200, map[string]interface{}{
		"matured": len(matured), "details": matured,
	})
}

func main() {
	initProducts()
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/products", handleListProducts)
	mux.HandleFunc("/buy", handleBuy)
	mux.HandleFunc("/sell", handleSell)
	mux.HandleFunc("/portfolio", handleGetPortfolio)
	mux.HandleFunc("/fixed-deposits", handleGetFixedDeposits)
	mux.HandleFunc("/fixed-deposits/break", handleBreakFixedDeposit)
	mux.HandleFunc("/robo-advisor", handleRoboAdvisor)
	mux.HandleFunc("/dividends", handleDividends)
	mux.HandleFunc("/maturity-check", handleMaturityCheck)

	handler := corsMiddleware(mux)
	port := "8116"
	log.Printf("Investment service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
