package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

type MobileMoneyProvider struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Code     string   `json:"code"`
	Country  string   `json:"country"`
	Currency string   `json:"currency"`
	Features []string `json:"features"`
	Active   bool     `json:"active"`
}

type MobileMoneyWallet struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	Provider    string  `json:"provider"`
	PhoneNumber string  `json:"phone_number"`
	Balance     float64 `json:"balance"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
	LinkedAt    time.Time `json:"linked_at"`
}

type MobileMoneyTxn struct {
	ID          string    `json:"id"`
	WalletID    string    `json:"wallet_id"`
	UserID      string    `json:"user_id"`
	Provider    string    `json:"provider"`
	Type        string    `json:"type"`
	Amount      float64   `json:"amount"`
	Fee         float64   `json:"fee"`
	Currency    string    `json:"currency"`
	Recipient   string    `json:"recipient"`
	Status      string    `json:"status"`
	Reference   string    `json:"reference"`
	CreatedAt   time.Time `json:"created_at"`
}

type AgentBankingAgent struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Location  string    `json:"location"`
	Country   string    `json:"country"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Services  []string  `json:"services"`
	Rating    float64   `json:"rating"`
	Active    bool      `json:"active"`
	Distance  float64   `json:"distance,omitempty"`
}

type CooperativeGroup struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	Description   string    `json:"description"`
	Members       []string  `json:"members"`
	TargetAmount  float64   `json:"target_amount"`
	CurrentAmount float64   `json:"current_amount"`
	Currency      string    `json:"currency"`
	Frequency     string    `json:"frequency"`
	NextPayout    time.Time `json:"next_payout"`
	PayoutOrder   []string  `json:"payout_order"`
	CurrentRound  int       `json:"current_round"`
	Status        string    `json:"status"`
	Country       string    `json:"country"`
	CreatedAt     time.Time `json:"created_at"`
}

type CoopContribution struct {
	ID       string    `json:"id"`
	GroupID  string    `json:"group_id"`
	UserID   string    `json:"user_id"`
	Amount   float64   `json:"amount"`
	Round    int       `json:"round"`
	PaidAt   time.Time `json:"paid_at"`
}

type USSDSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Code      string    `json:"ussd_code"`
	Input     string    `json:"input"`
	Response  string    `json:"response"`
	Level     int       `json:"level"`
	CreatedAt time.Time `json:"created_at"`
}

type AirtimeProduct struct {
	ID       string  `json:"id"`
	Network  string  `json:"network"`
	Country  string  `json:"country"`
	Currency string  `json:"currency"`
	Amounts  []float64 `json:"amounts"`
}

var (
	providers     []MobileMoneyProvider
	wallets       = make(map[string]*MobileMoneyWallet)
	mmTxns        = make(map[string]*MobileMoneyTxn)
	agents        []AgentBankingAgent
	coopGroups    = make(map[string]*CooperativeGroup)
	coopContribs  = make(map[string][]CoopContribution)
	ussdSessions  = make(map[string]*USSDSession)
	airtimeProds  []AirtimeProduct
	mu            sync.RWMutex
	idCounter     int64
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

func initData() {
	providers = []MobileMoneyProvider{
		{"mpesa", "M-Pesa", "MPESA", "KE", "KES", []string{"send", "receive", "pay_bill", "buy_goods", "withdraw"}, true},
		{"mpesa_tz", "M-Pesa Tanzania", "MPESA_TZ", "TZ", "TZS", []string{"send", "receive", "pay_bill"}, true},
		{"mtn_momo", "MTN Mobile Money", "MTN_MOMO", "GH", "GHS", []string{"send", "receive", "pay_bill", "merchant_pay"}, true},
		{"mtn_momo_ng", "MTN MoMo Nigeria", "MTN_NG", "NG", "NGN", []string{"send", "receive", "pay_bill"}, true},
		{"mtn_momo_ug", "MTN MoMo Uganda", "MTN_UG", "UG", "UGX", []string{"send", "receive", "pay_bill"}, true},
		{"airtel_money", "Airtel Money", "AIRTEL", "KE", "KES", []string{"send", "receive", "pay_bill"}, true},
		{"airtel_money_ng", "Airtel Money Nigeria", "AIRTEL_NG", "NG", "NGN", []string{"send", "receive"}, true},
		{"orange_money", "Orange Money", "ORANGE", "SN", "XOF", []string{"send", "receive", "pay_bill"}, true},
		{"vodafone_cash", "Vodafone Cash", "VODA_CASH", "GH", "GHS", []string{"send", "receive"}, true},
		{"tigo_pesa", "Tigo Pesa", "TIGO", "TZ", "TZS", []string{"send", "receive"}, true},
		{"ecocash", "EcoCash", "ECOCASH", "ZW", "USD", []string{"send", "receive", "pay_bill"}, true},
		{"opay", "OPay", "OPAY", "NG", "NGN", []string{"send", "receive", "pay_bill", "pos"}, true},
	}

	cities := []struct{ name, country string; lat, lng float64 }{
		{"Lagos", "NG", 6.5244, 3.3792}, {"Ikeja", "NG", 6.6018, 3.3515},
		{"Victoria Island", "NG", 6.4281, 3.4219}, {"Lekki", "NG", 6.4698, 3.5852},
		{"Abuja", "NG", 9.0579, 7.4951}, {"Nairobi CBD", "KE", -1.2921, 36.8219},
		{"Westlands", "KE", -1.2673, 36.8117}, {"Accra", "GH", 5.6037, -0.1870},
		{"Osu", "GH", 5.5560, -0.1764}, {"Johannesburg", "ZA", -26.2041, 28.0473},
		{"Sandton", "ZA", -26.1076, 28.0567}, {"Kampala", "UG", 0.3476, 32.5825},
		{"Dar es Salaam", "TZ", -6.7924, 39.2083}, {"Kigali", "RW", -1.9403, 29.8739},
	}

	for i, c := range cities {
		agents = append(agents, AgentBankingAgent{
			ID: fmt.Sprintf("agent_%d", i+1), Name: fmt.Sprintf("Agent %s %d", c.name, i+1),
			Location: c.name, Country: c.country, Latitude: c.lat, Longitude: c.lng,
			Services: []string{"cash_in", "cash_out", "bill_payment", "account_opening", "kyc_verification"},
			Rating: 4.0 + rand.Float64(), Active: true,
		})
	}

	airtimeProds = []AirtimeProduct{
		{"air_mtn_ng", "MTN", "NG", "NGN", []float64{50, 100, 200, 500, 1000, 2000, 5000}},
		{"air_airtel_ng", "Airtel", "NG", "NGN", []float64{50, 100, 200, 500, 1000, 2000}},
		{"air_glo_ng", "Glo", "NG", "NGN", []float64{50, 100, 200, 500, 1000}},
		{"air_9mobile_ng", "9mobile", "NG", "NGN", []float64{50, 100, 200, 500, 1000}},
		{"air_safaricom_ke", "Safaricom", "KE", "KES", []float64{10, 20, 50, 100, 250, 500, 1000}},
		{"air_mtn_gh", "MTN", "GH", "GHS", []float64{1, 2, 5, 10, 20, 50}},
		{"air_vodafone_gh", "Vodafone", "GH", "GHS", []float64{1, 2, 5, 10, 20}},
		{"air_vodacom_za", "Vodacom", "ZA", "ZAR", []float64{5, 10, 29, 49, 99}},
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "african-markets", "version": "1.0.0",
		"providers": len(providers), "agents": len(agents),
		"cooperative_groups": len(coopGroups),
	})
}

func handleGetProviders(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	var filtered []MobileMoneyProvider
	for _, p := range providers {
		if country == "" || p.Country == country {
			filtered = append(filtered, p)
		}
	}
	writeJSON(w, 200, map[string]interface{}{"providers": filtered, "total": len(filtered)})
}

func handleLinkWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string `json:"user_id"`
		Provider    string `json:"provider"`
		PhoneNumber string `json:"phone_number"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	var prov *MobileMoneyProvider
	for _, p := range providers {
		if p.ID == req.Provider { prov = &p; break }
	}
	if prov == nil {
		writeJSON(w, 400, map[string]string{"error": "unknown provider"}); return
	}

	wallet := &MobileMoneyWallet{
		ID: generateID("mw"), UserID: req.UserID, Provider: req.Provider,
		PhoneNumber: req.PhoneNumber, Balance: 0, Currency: prov.Currency,
		Status: "active", LinkedAt: time.Now(),
	}

	mu.Lock()
	wallets[wallet.ID] = wallet
	mu.Unlock()

	writeJSON(w, 201, wallet)
}

func handleMobileMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WalletID  string  `json:"wallet_id"`
		UserID    string  `json:"user_id"`
		Type      string  `json:"type"`
		Amount    float64 `json:"amount"`
		Recipient string  `json:"recipient"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.RLock()
	wallet := wallets[req.WalletID]
	mu.RUnlock()
	if wallet == nil {
		writeJSON(w, 404, map[string]string{"error": "wallet not found"}); return
	}

	fee := req.Amount * 0.01
	if fee < 10 { fee = 10 }

	txn := &MobileMoneyTxn{
		ID: generateID("mmtxn"), WalletID: req.WalletID, UserID: req.UserID,
		Provider: wallet.Provider, Type: req.Type, Amount: req.Amount,
		Fee: fee, Currency: wallet.Currency, Recipient: req.Recipient,
		Status: "completed", Reference: generateID("mmref"), CreatedAt: time.Now(),
	}

	mu.Lock()
	mmTxns[txn.ID] = txn
	if req.Type == "send" {
		wallet.Balance -= (req.Amount + fee)
	} else if req.Type == "receive" || req.Type == "deposit" {
		wallet.Balance += req.Amount
	}
	mu.Unlock()

	writeJSON(w, 200, txn)
}

func handleFindAgents(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	var filtered []AgentBankingAgent
	for _, a := range agents {
		if country == "" || a.Country == country {
			filtered = append(filtered, a)
		}
	}
	writeJSON(w, 200, map[string]interface{}{"agents": filtered, "total": len(filtered)})
}

func handleNearbyAgents(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		RadiusKM  float64 `json:"radius_km"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}
	if req.RadiusKM == 0 { req.RadiusKM = 10 }

	var nearby []AgentBankingAgent
	for _, a := range agents {
		dist := haversine(req.Latitude, req.Longitude, a.Latitude, a.Longitude)
		if dist <= req.RadiusKM {
			agent := a
			agent.Distance = math.Round(dist*100) / 100
			nearby = append(nearby, agent)
		}
	}

	writeJSON(w, 200, map[string]interface{}{"agents": nearby, "total": len(nearby)})
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	R := 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func handleCreateCooperative(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string   `json:"name"`
		Type         string   `json:"type"`
		Description  string   `json:"description"`
		CreatorID    string   `json:"creator_id"`
		Members      []string `json:"members"`
		TargetAmount float64  `json:"target_amount"`
		Currency     string   `json:"currency"`
		Frequency    string   `json:"frequency"`
		Country      string   `json:"country"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	validTypes := map[string]bool{"esusu": true, "ajo": true, "chama": true, "stokvel": true, "susu": true}
	if !validTypes[req.Type] {
		writeJSON(w, 400, map[string]string{"error": "invalid type, use: esusu, ajo, chama, stokvel, or susu"}); return
	}

	allMembers := append(req.Members, req.CreatorID)
	payoutOrder := make([]string, len(allMembers))
	copy(payoutOrder, allMembers)

	var nextPayout time.Time
	switch req.Frequency {
	case "weekly":
		nextPayout = time.Now().Add(7 * 24 * time.Hour)
	case "biweekly":
		nextPayout = time.Now().Add(14 * 24 * time.Hour)
	case "monthly":
		nextPayout = time.Now().AddDate(0, 1, 0)
	default:
		nextPayout = time.Now().AddDate(0, 1, 0)
	}

	group := &CooperativeGroup{
		ID: generateID("coop"), Name: req.Name, Type: req.Type,
		Description: req.Description, Members: allMembers,
		TargetAmount: req.TargetAmount, CurrentAmount: 0,
		Currency: req.Currency, Frequency: req.Frequency,
		NextPayout: nextPayout, PayoutOrder: payoutOrder,
		CurrentRound: 1, Status: "active", Country: req.Country,
		CreatedAt: time.Now(),
	}

	mu.Lock()
	coopGroups[group.ID] = group
	mu.Unlock()

	writeJSON(w, 201, group)
}

func handleCoopContribute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GroupID string  `json:"group_id"`
		UserID  string  `json:"user_id"`
		Amount  float64 `json:"amount"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.Lock()
	group := coopGroups[req.GroupID]
	if group == nil {
		mu.Unlock()
		writeJSON(w, 404, map[string]string{"error": "group not found"}); return
	}

	contrib := CoopContribution{
		ID: generateID("contrib"), GroupID: req.GroupID, UserID: req.UserID,
		Amount: req.Amount, Round: group.CurrentRound, PaidAt: time.Now(),
	}
	coopContribs[req.GroupID] = append(coopContribs[req.GroupID], contrib)
	group.CurrentAmount += req.Amount

	var payout *string
	if group.CurrentAmount >= group.TargetAmount && len(group.PayoutOrder) > 0 {
		recipient := group.PayoutOrder[(group.CurrentRound-1)%len(group.PayoutOrder)]
		payout = &recipient
		group.CurrentRound++
		group.CurrentAmount = 0
		switch group.Frequency {
		case "weekly":
			group.NextPayout = time.Now().Add(7 * 24 * time.Hour)
		case "biweekly":
			group.NextPayout = time.Now().Add(14 * 24 * time.Hour)
		default:
			group.NextPayout = time.Now().AddDate(0, 1, 0)
		}
	}
	mu.Unlock()

	resp := map[string]interface{}{
		"contribution": contrib,
		"group_balance": group.CurrentAmount,
		"target": group.TargetAmount,
	}
	if payout != nil {
		resp["payout_triggered"] = true
		resp["payout_recipient"] = *payout
		resp["payout_amount"] = group.TargetAmount
	}

	writeJSON(w, 200, resp)
}

func handleGetCooperatives(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mu.RLock()
	var userGroups []*CooperativeGroup
	for _, g := range coopGroups {
		for _, m := range g.Members {
			if m == userID { userGroups = append(userGroups, g); break }
		}
	}
	mu.RUnlock()
	writeJSON(w, 200, map[string]interface{}{"groups": userGroups, "total": len(userGroups)})
}

func handleUSSDRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"user_id"`
		Code   string `json:"ussd_code"`
		Input  string `json:"input"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	var response string
	level := 0

	switch req.Input {
	case "":
		response = "Welcome to AfriFintech\n1. Check Balance\n2. Send Money\n3. Buy Airtime\n4. Pay Bills\n5. Savings\n6. Loans\n0. Exit"
		level = 1
	case "1":
		response = "Your Balances:\n1. Main: NGN 50,000.00\n2. Savings: NGN 120,000.00\n3. M-Pesa: KES 5,000.00\n0. Back"
		level = 2
	case "2":
		response = "Send Money To:\n1. Bank Account\n2. Mobile Money\n3. Another User\n0. Back"
		level = 2
	case "3":
		response = "Buy Airtime:\n1. Self\n2. Others\nEnter amount (50-5000):\n0. Back"
		level = 2
	case "4":
		response = "Pay Bills:\n1. Electricity (PHCN)\n2. Water\n3. Internet\n4. Cable TV\n5. School Fees\n0. Back"
		level = 2
	case "5":
		response = "Savings:\n1. View Goals\n2. Deposit to Savings\n3. Join Cooperative\n0. Back"
		level = 2
	case "6":
		response = "Loans:\n1. Check Eligibility\n2. Apply for Loan\n3. Repay Loan\n0. Back"
		level = 2
	default:
		response = "Invalid input. Try again.\n0. Back to Menu"
		level = 1
	}

	session := &USSDSession{
		ID: generateID("ussd"), UserID: req.UserID, Code: req.Code,
		Input: req.Input, Response: response, Level: level,
		CreatedAt: time.Now(),
	}

	mu.Lock()
	ussdSessions[session.ID] = session
	mu.Unlock()

	writeJSON(w, 200, map[string]interface{}{
		"session_id": session.ID,
		"response":   response,
		"level":      level,
	})
}

func handleBuyAirtime(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string  `json:"user_id"`
		Network     string  `json:"network"`
		PhoneNumber string  `json:"phone_number"`
		Amount      float64 `json:"amount"`
		Country     string  `json:"country"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":        generateID("air"),
		"network":   req.Network,
		"phone":     req.PhoneNumber,
		"amount":    req.Amount,
		"status":    "completed",
		"reference": generateID("airref"),
	})
}

func handleGetAirtimeProducts(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	var filtered []AirtimeProduct
	for _, p := range airtimeProds {
		if country == "" || p.Country == country {
			filtered = append(filtered, p)
		}
	}
	writeJSON(w, 200, map[string]interface{}{"products": filtered, "total": len(filtered)})
}

func main() {
	initData()
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/mobile-money/providers", handleGetProviders)
	mux.HandleFunc("/mobile-money/link", handleLinkWallet)
	mux.HandleFunc("/mobile-money/transfer", handleMobileMoneyTransfer)
	mux.HandleFunc("/agents", handleFindAgents)
	mux.HandleFunc("/agents/nearby", handleNearbyAgents)
	mux.HandleFunc("/cooperative/create", handleCreateCooperative)
	mux.HandleFunc("/cooperative/contribute", handleCoopContribute)
	mux.HandleFunc("/cooperative/list", handleGetCooperatives)
	mux.HandleFunc("/ussd", handleUSSDRequest)
	mux.HandleFunc("/airtime/buy", handleBuyAirtime)
	mux.HandleFunc("/airtime/products", handleGetAirtimeProducts)

	handler := corsMiddleware(mux)
	port := "8118"
	log.Printf("African Markets service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
