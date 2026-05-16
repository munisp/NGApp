package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// USSDRequest represents an incoming USSD request from the telco aggregator
// Compatible with Africa's Talking USSD API format
type USSDRequest struct {
	SessionID   string `json:"sessionId"`
	ServiceCode string `json:"serviceCode"`
	PhoneNumber string `json:"phoneNumber"`
	Text        string `json:"text"`
	NetworkCode string `json:"networkCode,omitempty"`
}

// USSDResponse is sent back to the aggregator
type USSDResponse struct {
	Response string `json:"response"`
	Action   string `json:"action"` // "CON" (continue) or "END" (terminate)
}

// Session tracks a user's USSD session state
type Session struct {
	ID          string
	PhoneNumber string
	State       string
	Data        map[string]string
	CreatedAt   time.Time
	LastActive  time.Time
}

// USSDHandler processes USSD requests
type USSDHandler struct {
	sessions *SessionStore
}

// NewUSSDHandler creates a new USSD handler
func NewUSSDHandler(sessions *SessionStore) *USSDHandler {
	return &USSDHandler{sessions: sessions}
}

// HandleUSSD processes incoming USSD requests
func (h *USSDHandler) HandleUSSD(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req USSDRequest
	if err := r.ParseForm(); err == nil {
		req.SessionID = r.FormValue("sessionId")
		req.ServiceCode = r.FormValue("serviceCode")
		req.PhoneNumber = r.FormValue("phoneNumber")
		req.Text = r.FormValue("text")
		req.NetworkCode = r.FormValue("networkCode")
	}

	if req.SessionID == "" {
		json.NewDecoder(r.Body).Decode(&req)
	}

	session := h.sessions.GetOrCreate(req.SessionID, req.PhoneNumber)
	parts := strings.Split(req.Text, "*")

	response, action := h.processMenu(session, parts)

	w.Header().Set("Content-Type", "text/plain")
	if action == "END" {
		fmt.Fprintf(w, "END %s", response)
		h.sessions.Delete(req.SessionID)
	} else {
		fmt.Fprintf(w, "CON %s", response)
	}
}

// HandleCallback handles async callbacks (payment confirmations, etc.)
func (h *USSDHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"received"}`))
}

func (h *USSDHandler) processMenu(session *Session, inputs []string) (string, string) {
	depth := len(inputs)
	if depth == 0 || (depth == 1 && inputs[0] == "") {
		return h.mainMenu(), "CON"
	}

	firstChoice := inputs[0]
	switch firstChoice {
	case "1": // Buy Motor Insurance
		return h.motorInsuranceFlow(session, inputs[1:])
	case "2": // Buy Life Cover
		return h.lifeCoverFlow(session, inputs[1:])
	case "3": // Check My Policy
		return h.checkPolicyFlow(session, inputs[1:])
	case "4": // File a Claim
		return h.fileClaimFlow(session, inputs[1:])
	case "5": // Pay Premium
		return h.payPremiumFlow(session, inputs[1:])
	case "6": // My Account
		return h.accountFlow(session, inputs[1:])
	default:
		return "Invalid choice. Please try again.\n" + h.mainMenu(), "CON"
	}
}

func (h *USSDHandler) mainMenu() string {
	return "Welcome to NGApp Insurance\n" +
		"1. Buy Motor Insurance\n" +
		"2. Buy Life Cover\n" +
		"3. Check My Policy\n" +
		"4. File a Claim\n" +
		"5. Pay Premium\n" +
		"6. My Account"
}

func (h *USSDHandler) motorInsuranceFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "Motor Insurance\n" +
			"1. Third Party (from N5,000/yr)\n" +
			"2. Comprehensive\n" +
			"3. Get a Quote\n" +
			"0. Back", "CON"
	}
	switch inputs[0] {
	case "1":
		if len(inputs) == 1 {
			return "Enter vehicle registration number:", "CON"
		}
		if len(inputs) == 2 {
			session.Data["vehicle_reg"] = inputs[1]
			return "Enter vehicle value (Naira):", "CON"
		}
		if len(inputs) == 3 {
			session.Data["vehicle_value"] = inputs[2]
			return fmt.Sprintf(
				"Third Party Insurance\n"+
					"Vehicle: %s\n"+
					"Premium: N5,000/year\n"+
					"1. Confirm & Pay\n"+
					"2. Cancel",
				session.Data["vehicle_reg"]), "CON"
		}
		if len(inputs) == 4 && inputs[3] == "1" {
			return "Policy purchased! Certificate sent via SMS to " + session.PhoneNumber +
				"\nPolicy No: NGA-MTR-" + session.ID[:8] +
				"\nThank you for choosing NGApp Insurance.", "END"
		}
		return "Purchase cancelled. Thank you.", "END"
	case "2":
		if len(inputs) == 1 {
			return "Enter vehicle registration number:", "CON"
		}
		if len(inputs) == 2 {
			session.Data["vehicle_reg"] = inputs[1]
			return "Enter vehicle value (Naira):", "CON"
		}
		if len(inputs) == 3 {
			session.Data["vehicle_value"] = inputs[2]
			premium := "N25,000"
			return fmt.Sprintf(
				"Comprehensive Insurance\n"+
					"Vehicle: %s\n"+
					"Value: N%s\n"+
					"Premium: %s/year\n"+
					"1. Confirm & Pay\n"+
					"2. Cancel",
				session.Data["vehicle_reg"], session.Data["vehicle_value"], premium), "CON"
		}
		if len(inputs) == 4 && inputs[3] == "1" {
			return "Policy purchased! Certificate sent via SMS.\n" +
				"Policy No: NGA-CMP-" + session.ID[:8], "END"
		}
		return "Purchase cancelled.", "END"
	case "3":
		return "Enter vehicle registration and value via options above to get a quote.", "END"
	case "0":
		return h.mainMenu(), "CON"
	}
	return h.mainMenu(), "CON"
}

func (h *USSDHandler) lifeCoverFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "Life Cover\n" +
			"1. Funeral Cover (from N500/mo)\n" +
			"2. Term Life (from N2,000/mo)\n" +
			"3. Hospital Cash (from N1,000/mo)\n" +
			"0. Back", "CON"
	}
	switch inputs[0] {
	case "1":
		if len(inputs) == 1 {
			return "Funeral Cover: N500,000 payout\n" +
				"Premium: N500/month\n" +
				"1. Subscribe\n" +
				"2. Cancel", "CON"
		}
		if inputs[1] == "1" {
			return "Funeral Cover activated!\n" +
				"N500 will be deducted monthly.\n" +
				"Policy: NGA-FNR-" + session.ID[:8], "END"
		}
		return "Cancelled.", "END"
	case "2":
		if len(inputs) == 1 {
			return "Select coverage:\n" +
				"1. N1M (N2,000/mo)\n" +
				"2. N5M (N8,000/mo)\n" +
				"3. N10M (N15,000/mo)", "CON"
		}
		return "Term Life activated! Details sent via SMS.\n" +
			"Policy: NGA-TRM-" + session.ID[:8], "END"
	case "3":
		if len(inputs) == 1 {
			return "Hospital Cash: N5,000/day\n" +
				"Premium: N1,000/month\n" +
				"1. Subscribe\n" +
				"2. Cancel", "CON"
		}
		if inputs[1] == "1" {
			return "Hospital Cash activated!\n" +
				"Policy: NGA-HSP-" + session.ID[:8], "END"
		}
		return "Cancelled.", "END"
	case "0":
		return h.mainMenu(), "CON"
	}
	return h.mainMenu(), "CON"
}

func (h *USSDHandler) checkPolicyFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "Enter your policy number:", "CON"
	}
	session.Data["policy_number"] = inputs[0]
	return fmt.Sprintf(
		"Policy: %s\n"+
			"Status: Active\n"+
			"Type: Motor Third Party\n"+
			"Expiry: 31/12/2026\n"+
			"Premium Paid: Yes",
		session.Data["policy_number"]), "END"
}

func (h *USSDHandler) fileClaimFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "File a Claim\n" +
			"Enter your policy number:", "CON"
	}
	if len(inputs) == 1 {
		session.Data["policy_number"] = inputs[0]
		return "Claim Type:\n" +
			"1. Accident\n" +
			"2. Theft\n" +
			"3. Fire\n" +
			"4. Health\n" +
			"5. Death/Funeral", "CON"
	}
	if len(inputs) == 2 {
		session.Data["claim_type"] = inputs[1]
		return "Briefly describe what happened:", "CON"
	}
	if len(inputs) == 3 {
		return fmt.Sprintf(
			"Claim registered!\n"+
				"Claim No: NGA-CLM-%s\n"+
				"Policy: %s\n"+
				"An adjuster will contact you within 24 hours at %s.\n"+
				"For faster processing, send photos via WhatsApp to +234-800-NGAPP",
			session.ID[:8], session.Data["policy_number"], session.PhoneNumber), "END"
	}
	return h.mainMenu(), "CON"
}

func (h *USSDHandler) payPremiumFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "Pay Premium\n" +
			"Enter your policy number:", "CON"
	}
	if len(inputs) == 1 {
		session.Data["policy_number"] = inputs[0]
		return "Payment Method:\n" +
			"1. Mobile Money (OPay/PalmPay)\n" +
			"2. Bank Transfer (NIBSS)\n" +
			"3. Debit Card\n" +
			"4. USSD Bank Payment", "CON"
	}
	if len(inputs) == 2 {
		return "Amount Due: N5,000\n" +
			"1. Pay Full Amount\n" +
			"2. Pay Custom Amount", "CON"
	}
	if len(inputs) == 3 {
		return "Payment of N5,000 initiated!\n" +
			"You will receive a confirmation SMS shortly.\n" +
			"Ref: PAY-" + session.ID[:8], "END"
	}
	return h.mainMenu(), "CON"
}

func (h *USSDHandler) accountFlow(session *Session, inputs []string) (string, string) {
	if len(inputs) == 0 {
		return "My Account\n" +
			"Phone: " + session.PhoneNumber + "\n" +
			"1. View All Policies\n" +
			"2. Update Details\n" +
			"3. Claims History\n" +
			"0. Back", "CON"
	}
	switch inputs[0] {
	case "1":
		return "Your Policies:\n" +
			"1. NGA-MTR-001 Motor (Active)\n" +
			"2. NGA-FNR-002 Funeral (Active)\n" +
			"3. NGA-HSP-003 Hospital (Pending)", "END"
	case "2":
		return "Visit our portal at portal.ngapp.ng or contact +234-800-NGAPP", "END"
	case "3":
		return "Claims History:\n" +
			"No recent claims.", "END"
	case "0":
		return h.mainMenu(), "CON"
	}
	return h.mainMenu(), "CON"
}
