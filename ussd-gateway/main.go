package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// USSDSession represents an active USSD session
type USSDSession struct {
	SessionID    string                 `json:"session_id"`
	PhoneNumber  string                 `json:"phone_number"`
	ServiceCode  string                 `json:"service_code"`
	CurrentMenu  string                 `json:"current_menu"`
	Data         map[string]interface{} `json:"data"`
	CreatedAt    time.Time              `json:"created_at"`
	LastActivity time.Time              `json:"last_activity"`
}

// USSDRequest represents incoming USSD request from telco
type USSDRequest struct {
	SessionID   string `json:"sessionId"`
	PhoneNumber string `json:"phoneNumber"`
	ServiceCode string `json:"serviceCode"`
	Text        string `json:"text"`
	NetworkCode string `json:"networkCode"`
}

// USSDResponse represents response to telco
type USSDResponse struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
	EndSession bool   `json:"endSession"`
}

// USSDGateway handles USSD interactions
type USSDGateway struct {
	sessions     map[string]*USSDSession
	sessionMutex sync.RWMutex
	menuHandlers map[string]MenuHandler
}

// MenuHandler processes menu selections
type MenuHandler func(session *USSDSession, input string) (string, bool)

// NewUSSDGateway creates a new USSD gateway
func NewUSSDGateway() *USSDGateway {
	gw := &USSDGateway{
		sessions:     make(map[string]*USSDSession),
		menuHandlers: make(map[string]MenuHandler),
	}
	gw.registerMenuHandlers()
	return gw
}

func (gw *USSDGateway) registerMenuHandlers() {
	gw.menuHandlers["main"] = gw.handleMainMenu
	gw.menuHandlers["buy_insurance"] = gw.handleBuyInsurance
	gw.menuHandlers["motor_insurance"] = gw.handleMotorInsurance
	gw.menuHandlers["motor_type"] = gw.handleMotorType
	gw.menuHandlers["motor_reg"] = gw.handleMotorRegistration
	gw.menuHandlers["motor_confirm"] = gw.handleMotorConfirm
	gw.menuHandlers["check_policy"] = gw.handleCheckPolicy
	gw.menuHandlers["policy_number"] = gw.handlePolicyNumber
	gw.menuHandlers["file_claim"] = gw.handleFileClaim
	gw.menuHandlers["claim_policy"] = gw.handleClaimPolicy
	gw.menuHandlers["claim_type"] = gw.handleClaimType
	gw.menuHandlers["claim_confirm"] = gw.handleClaimConfirm
	gw.menuHandlers["renew_policy"] = gw.handleRenewPolicy
	gw.menuHandlers["renew_confirm"] = gw.handleRenewConfirm
	gw.menuHandlers["get_quote"] = gw.handleGetQuote
	gw.menuHandlers["quote_type"] = gw.handleQuoteType
	gw.menuHandlers["quote_value"] = gw.handleQuoteValue
	gw.menuHandlers["contact_agent"] = gw.handleContactAgent
	gw.menuHandlers["life_insurance"] = gw.handleLifeInsurance
	gw.menuHandlers["life_type"] = gw.handleLifeType
	gw.menuHandlers["life_amount"] = gw.handleLifeAmount
	gw.menuHandlers["life_confirm"] = gw.handleLifeConfirm
	gw.menuHandlers["payment"] = gw.handlePayment
	gw.menuHandlers["payment_method"] = gw.handlePaymentMethod
}

func (gw *USSDGateway) handleMainMenu(session *USSDSession, input string) (string, bool) {
	menu := `Welcome to A&G Insurance
1. Buy Insurance
2. Check Policy Status
3. File a Claim
4. Renew Policy
5. Get Quote
6. Contact Agent
0. Exit`
	session.CurrentMenu = "main_selection"
	return menu, false
}

func (gw *USSDGateway) handleBuyInsurance(session *USSDSession, input string) (string, bool) {
	menu := `Select Insurance Type:
1. Motor Insurance
2. Motorcycle Insurance
3. Tricycle (Keke) Insurance
4. Life Assurance
5. Fire Insurance
6. Marine Insurance
7. Goods-in-Transit
0. Back`
	session.CurrentMenu = "buy_selection"
	return menu, false
}

func (gw *USSDGateway) handleMotorInsurance(session *USSDSession, input string) (string, bool) {
	menu := `Motor Insurance Type:
1. Third Party Only (N15,000/yr)
2. Third Party Fire & Theft (N25,000/yr)
3. Comprehensive (N45,000/yr)
0. Back`
	session.CurrentMenu = "motor_type"
	return menu, false
}

func (gw *USSDGateway) handleMotorType(session *USSDSession, input string) (string, bool) {
	switch input {
	case "1":
		session.Data["motor_type"] = "third_party"
		session.Data["premium"] = 15000
	case "2":
		session.Data["motor_type"] = "third_party_fire_theft"
		session.Data["premium"] = 25000
	case "3":
		session.Data["motor_type"] = "comprehensive"
		session.Data["premium"] = 45000
	default:
		return "Invalid selection. Please try again.", false
	}
	session.CurrentMenu = "motor_reg"
	return "Enter Vehicle Registration Number:", false
}

func (gw *USSDGateway) handleMotorRegistration(session *USSDSession, input string) (string, bool) {
	if len(input) < 6 {
		return "Invalid registration. Enter valid plate number:", false
	}
	session.Data["vehicle_reg"] = strings.ToUpper(input)
	session.CurrentMenu = "motor_confirm"
	
	premium := session.Data["premium"].(int)
	motorType := session.Data["motor_type"].(string)
	vehicleReg := session.Data["vehicle_reg"].(string)
	
	return fmt.Sprintf(`Confirm Purchase:
Type: %s
Vehicle: %s
Premium: N%d/year

1. Confirm & Pay
2. Cancel`, motorType, vehicleReg, premium), false
}

func (gw *USSDGateway) handleMotorConfirm(session *USSDSession, input string) (string, bool) {
	if input == "1" {
		session.CurrentMenu = "payment"
		return `Select Payment Method:
1. Bank Transfer
2. Card Payment
3. Mobile Money
4. USSD Banking
0. Cancel`, false
	}
	return "Purchase cancelled. Thank you for using A&G Insurance.", true
}

func (gw *USSDGateway) handleCheckPolicy(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "policy_number"
	return "Enter your Policy Number:", false
}

func (gw *USSDGateway) handlePolicyNumber(session *USSDSession, input string) (string, bool) {
	if len(input) < 8 {
		return "Invalid policy number. Please try again:", false
	}
	
	// Simulate policy lookup
	return fmt.Sprintf(`Policy: %s
Status: ACTIVE
Type: Motor Third Party
Expiry: 31-Dec-2026
Premium Paid: N15,000

1. Renew Policy
2. Download Certificate
3. File Claim
0. Main Menu`, strings.ToUpper(input)), true
}

func (gw *USSDGateway) handleFileClaim(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "claim_policy"
	return "Enter Policy Number for Claim:", false
}

func (gw *USSDGateway) handleClaimPolicy(session *USSDSession, input string) (string, bool) {
	session.Data["claim_policy"] = strings.ToUpper(input)
	session.CurrentMenu = "claim_type"
	return `Select Claim Type:
1. Accident
2. Theft
3. Fire Damage
4. Third Party Liability
5. Other
0. Cancel`, false
}

func (gw *USSDGateway) handleClaimType(session *USSDSession, input string) (string, bool) {
	claimTypes := map[string]string{
		"1": "Accident",
		"2": "Theft",
		"3": "Fire Damage",
		"4": "Third Party Liability",
		"5": "Other",
	}
	
	if claimType, ok := claimTypes[input]; ok {
		session.Data["claim_type"] = claimType
		session.CurrentMenu = "claim_confirm"
		return fmt.Sprintf(`Claim Details:
Policy: %s
Type: %s

1. Submit Claim
2. Cancel

Note: An agent will contact you within 24hrs`, session.Data["claim_policy"], claimType), false
	}
	return "Invalid selection. Please try again.", false
}

func (gw *USSDGateway) handleClaimConfirm(session *USSDSession, input string) (string, bool) {
	if input == "1" {
		claimRef := fmt.Sprintf("CLM%d", time.Now().Unix())
		return fmt.Sprintf(`Claim Submitted Successfully!

Reference: %s
Status: PENDING REVIEW

An agent will contact you at %s within 24 hours.

Thank you for using A&G Insurance.`, claimRef, session.PhoneNumber), true
	}
	return "Claim cancelled. Thank you for using A&G Insurance.", true
}

func (gw *USSDGateway) handleRenewPolicy(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "renew_confirm"
	return `Enter Policy Number to Renew:`, false
}

func (gw *USSDGateway) handleRenewConfirm(session *USSDSession, input string) (string, bool) {
	session.Data["renew_policy"] = strings.ToUpper(input)
	session.CurrentMenu = "payment"
	return fmt.Sprintf(`Renewing Policy: %s
Premium Due: N15,000

Select Payment Method:
1. Bank Transfer
2. Card Payment
3. Mobile Money
4. USSD Banking
0. Cancel`, session.Data["renew_policy"]), false
}

func (gw *USSDGateway) handleGetQuote(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "quote_type"
	return `Get Insurance Quote:
1. Motor Vehicle
2. Motorcycle
3. Tricycle (Keke)
4. Life Insurance
5. Fire Insurance
6. Marine Cargo
0. Back`, false
}

func (gw *USSDGateway) handleQuoteType(session *USSDSession, input string) (string, bool) {
	quoteTypes := map[string]string{
		"1": "motor",
		"2": "motorcycle",
		"3": "tricycle",
		"4": "life",
		"5": "fire",
		"6": "marine",
	}
	
	if qType, ok := quoteTypes[input]; ok {
		session.Data["quote_type"] = qType
		session.CurrentMenu = "quote_value"
		
		switch qType {
		case "motor", "motorcycle", "tricycle":
			return "Enter Vehicle Value (Naira):", false
		case "life":
			return "Enter Sum Assured (Naira):", false
		case "fire":
			return "Enter Property Value (Naira):", false
		case "marine":
			return "Enter Cargo Value (Naira):", false
		}
	}
	return "Invalid selection. Please try again.", false
}

func (gw *USSDGateway) handleQuoteValue(session *USSDSession, input string) (string, bool) {
	var value int
	fmt.Sscanf(input, "%d", &value)
	
	if value <= 0 {
		return "Invalid amount. Enter value in Naira:", false
	}
	
	qType := session.Data["quote_type"].(string)
	var premium int
	var coverage string
	
	switch qType {
	case "motor":
		premium = max(15000, value*3/100)
		coverage = "Third Party + Comprehensive"
	case "motorcycle":
		premium = max(5000, value*4/100)
		coverage = "Third Party + Theft"
	case "tricycle":
		premium = max(8000, value*35/1000)
		coverage = "Third Party + Comprehensive"
	case "life":
		premium = value * 2 / 100
		coverage = "Term Life 10 Years"
	case "fire":
		premium = value * 15 / 10000
		coverage = "Fire & Allied Perils"
	case "marine":
		premium = value * 5 / 1000
		coverage = "All Risks Marine Cargo"
	}
	
	return fmt.Sprintf(`Insurance Quote:
Type: %s
Value: N%d
Coverage: %s
Annual Premium: N%d

1. Buy Now
2. Get Call Back
0. Main Menu`, qType, value, coverage, premium), true
}

func (gw *USSDGateway) handleContactAgent(session *USSDSession, input string) (string, bool) {
	return fmt.Sprintf(`A&G Insurance Agent Contact:

Hotline: 0809-718-6794
Email: info@aginsuranceplc.com
WhatsApp: +234-809-718-6794

An agent will call you at %s within 1 hour.

Thank you for choosing A&G Insurance!`, session.PhoneNumber), true
}

func (gw *USSDGateway) handleLifeInsurance(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "life_type"
	return `Life Assurance Products:
1. Term Life (10 Years)
2. Whole Life
3. Education Endowment
4. Target Savings Plan
5. Investment Linked
6. Anti-Inflation Policy
0. Back`, false
}

func (gw *USSDGateway) handleLifeType(session *USSDSession, input string) (string, bool) {
	lifeTypes := map[string]string{
		"1": "Term Life",
		"2": "Whole Life",
		"3": "Education Endowment",
		"4": "Target Savings",
		"5": "Investment Linked",
		"6": "Anti-Inflation",
	}
	
	if lType, ok := lifeTypes[input]; ok {
		session.Data["life_type"] = lType
		session.CurrentMenu = "life_amount"
		return "Enter Sum Assured (Naira):", false
	}
	return "Invalid selection. Please try again.", false
}

func (gw *USSDGateway) handleLifeAmount(session *USSDSession, input string) (string, bool) {
	var amount int
	fmt.Sscanf(input, "%d", &amount)
	
	if amount < 100000 {
		return "Minimum sum assured is N100,000. Enter amount:", false
	}
	
	session.Data["sum_assured"] = amount
	premium := amount * 2 / 100 // 2% annual premium
	session.Data["premium"] = premium
	session.CurrentMenu = "life_confirm"
	
	return fmt.Sprintf(`Life Assurance Quote:
Type: %s
Sum Assured: N%d
Annual Premium: N%d
Monthly: N%d

1. Proceed to Buy
2. Get Call Back
0. Cancel`, session.Data["life_type"], amount, premium, premium/12), false
}

func (gw *USSDGateway) handleLifeConfirm(session *USSDSession, input string) (string, bool) {
	if input == "1" {
		session.CurrentMenu = "payment"
		return `Select Payment Method:
1. Bank Transfer
2. Card Payment
3. Mobile Money
4. USSD Banking
0. Cancel`, false
	} else if input == "2" {
		return fmt.Sprintf(`Thank you for your interest!

An agent will call you at %s within 2 hours to complete your Life Assurance application.

Reference: LIF%d`, session.PhoneNumber, time.Now().Unix()), true
	}
	return "Thank you for using A&G Insurance.", true
}

func (gw *USSDGateway) handlePayment(session *USSDSession, input string) (string, bool) {
	session.CurrentMenu = "payment_method"
	return gw.handlePaymentMethod(session, input)
}

func (gw *USSDGateway) handlePaymentMethod(session *USSDSession, input string) (string, bool) {
	switch input {
	case "1":
		return `Bank Transfer Details:
Bank: First Bank
Account: 2033456789
Name: A&G Insurance PLC

Transfer the premium amount and send receipt to 0809-718-6794

Your policy will be activated within 30 minutes of confirmation.`, true
	case "2":
		return fmt.Sprintf(`Card Payment:
Visit: pay.aginsuranceplc.com
Reference: PAY%d

Or dial *737*50*amount# (GTBank)
Or dial *894*amount# (First Bank)

Your policy will be activated instantly.`, time.Now().Unix()), true
	case "3":
		return `Mobile Money Payment:
OPay: *955*amount*2033456789#
PalmPay: Transfer to 2033456789
Paga: Pay to A&G Insurance

Send confirmation to 0809-718-6794`, true
	case "4":
		return `USSD Banking:
GTBank: *737*2*amount*2033456789*058#
First Bank: *894*amount*2033456789#
UBA: *919*4*2033456789*amount#
Access: *901*amount*2033456789#

Your policy activates within 30 minutes.`, true
	}
	return "Payment cancelled. Thank you for using A&G Insurance.", true
}

func (gw *USSDGateway) processInput(session *USSDSession, input string) (string, bool) {
	// Handle main menu selections
	if session.CurrentMenu == "main_selection" {
		switch input {
		case "1":
			return gw.handleBuyInsurance(session, input)
		case "2":
			return gw.handleCheckPolicy(session, input)
		case "3":
			return gw.handleFileClaim(session, input)
		case "4":
			return gw.handleRenewPolicy(session, input)
		case "5":
			return gw.handleGetQuote(session, input)
		case "6":
			return gw.handleContactAgent(session, input)
		case "0":
			return "Thank you for using A&G Insurance. Goodbye!", true
		}
	}
	
	// Handle buy insurance selections
	if session.CurrentMenu == "buy_selection" {
		switch input {
		case "1", "2", "3":
			return gw.handleMotorInsurance(session, input)
		case "4":
			return gw.handleLifeInsurance(session, input)
		case "0":
			return gw.handleMainMenu(session, "")
		}
	}
	
	// Use registered handlers
	if handler, ok := gw.menuHandlers[session.CurrentMenu]; ok {
		return handler(session, input)
	}
	
	return "Invalid input. Please try again.", false
}

func (gw *USSDGateway) HandleUSSD(w http.ResponseWriter, r *http.Request) {
	var req USSDRequest
	
	// Parse request based on content type
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
	} else {
		// Form data (common for African telcos)
		req.SessionID = r.FormValue("sessionId")
		req.PhoneNumber = r.FormValue("phoneNumber")
		req.ServiceCode = r.FormValue("serviceCode")
		req.Text = r.FormValue("text")
		req.NetworkCode = r.FormValue("networkCode")
	}
	
	// Get or create session
	gw.sessionMutex.Lock()
	session, exists := gw.sessions[req.SessionID]
	if !exists {
		session = &USSDSession{
			SessionID:    req.SessionID,
			PhoneNumber:  req.PhoneNumber,
			ServiceCode:  req.ServiceCode,
			CurrentMenu:  "main",
			Data:         make(map[string]interface{}),
			CreatedAt:    time.Now(),
			LastActivity: time.Now(),
		}
		gw.sessions[req.SessionID] = session
	}
	session.LastActivity = time.Now()
	gw.sessionMutex.Unlock()
	
	var response string
	var endSession bool
	
	// Process input
	inputs := strings.Split(req.Text, "*")
	lastInput := ""
	if len(inputs) > 0 {
		lastInput = inputs[len(inputs)-1]
	}
	
	if req.Text == "" || session.CurrentMenu == "main" {
		response, endSession = gw.handleMainMenu(session, "")
	} else {
		response, endSession = gw.processInput(session, lastInput)
	}
	
	// Clean up ended sessions
	if endSession {
		gw.sessionMutex.Lock()
		delete(gw.sessions, req.SessionID)
		gw.sessionMutex.Unlock()
	}
	
	// Send response
	resp := USSDResponse{
		SessionID:  req.SessionID,
		Message:    response,
		EndSession: endSession,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (gw *USSDGateway) cleanupSessions() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		gw.sessionMutex.Lock()
		now := time.Now()
		for id, session := range gw.sessions {
			if now.Sub(session.LastActivity) > 5*time.Minute {
				delete(gw.sessions, id)
			}
		}
		gw.sessionMutex.Unlock()
	}
}

func (gw *USSDGateway) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "healthy",
		"service":         "ussd-gateway",
		"active_sessions": len(gw.sessions),
		"timestamp":       time.Now(),
	})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func main() {
	gateway := NewUSSDGateway()
	
	// Start session cleanup goroutine
	go gateway.cleanupSessions()
	
	// Routes
	http.HandleFunc("/ussd", gateway.HandleUSSD)
	http.HandleFunc("/health", gateway.HealthCheck)
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	log.Printf("USSD Gateway starting on port %s", port)
	log.Printf("Supported service codes: *347*247#, *919*88#")
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
