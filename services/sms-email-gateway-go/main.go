package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
)

type MessageTemplate struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Channel  string `json:"channel"`
	Subject  string `json:"subject,omitempty"`
	Body     string `json:"body"`
	Vars     []string `json:"variables"`
	Status   string `json:"status"`
}

type DeliveryRecord struct {
	ID          string `json:"id"`
	TemplateID  string `json:"templateId"`
	Channel     string `json:"channel"`
	Recipient   string `json:"recipient"`
	Subject     string `json:"subject,omitempty"`
	Status      string `json:"status"`
	RetryCount  int    `json:"retryCount"`
	SentAt      string `json:"sentAt"`
	DeliveredAt string `json:"deliveredAt,omitempty"`
	FailReason  string `json:"failReason,omitempty"`
	Cost        float64 `json:"cost"`
}

type SendRequest struct {
	TemplateID string            `json:"templateId"`
	Channel    string            `json:"channel"`
	Recipient  string            `json:"recipient"`
	Variables  map[string]string `json:"variables"`
}

var (
	mu        sync.Mutex
	templates []MessageTemplate
	deliveries []DeliveryRecord
	nextDel   int
)

func init() {
	templates = []MessageTemplate{
		{ID: "TPL-001", Name: "OTP Verification", Channel: "sms", Body: "Your 54Bank OTP is {{otp}}. Valid for 5 minutes. Do NOT share.", Vars: []string{"otp"}, Status: "active"},
		{ID: "TPL-002", Name: "Transaction Alert", Channel: "sms", Body: "{{type}} of {{currency}}{{amount}} on acct {{account}}. Bal: {{currency}}{{balance}}. Ref: {{ref}}", Vars: []string{"type", "currency", "amount", "account", "balance", "ref"}, Status: "active"},
		{ID: "TPL-003", Name: "Welcome Email", Channel: "email", Subject: "Welcome to 54Bank — Your Account is Ready", Body: "Dear {{name}},\n\nWelcome to 54Bank. Your {{accountType}} account {{accountNumber}} is now active.\n\nDownload our mobile app to get started.\n\nBest regards,\n54Bank Team", Vars: []string{"name", "accountType", "accountNumber"}, Status: "active"},
		{ID: "TPL-004", Name: "Loan Disbursement", Channel: "email", Subject: "Loan Disbursement Confirmation — {{loanId}}", Body: "Dear {{name}},\n\nYour loan {{loanId}} of {{currency}}{{amount}} has been disbursed to account {{account}}.\n\nMonthly EMI: {{currency}}{{emi}}\nTenor: {{tenor}} months\n\nThank you for banking with 54Bank.", Vars: []string{"name", "loanId", "currency", "amount", "account", "emi", "tenor"}, Status: "active"},
		{ID: "TPL-005", Name: "Dormancy Warning", Channel: "sms", Body: "Your 54Bank acct {{account}} has been inactive for {{days}} days. Transact to avoid dormancy. Call 0700-54-BANK.", Vars: []string{"account", "days"}, Status: "active"},
		{ID: "TPL-006", Name: "Card Block Alert", Channel: "sms", Body: "Your 54Bank card ending {{last4}} has been BLOCKED due to {{reason}}. Call 0700-54-BANK immediately.", Vars: []string{"last4", "reason"}, Status: "active"},
		{ID: "TPL-007", Name: "Statement Ready", Channel: "email", Subject: "Your Monthly Statement is Ready — {{period}}", Body: "Dear {{name}},\n\nYour {{period}} statement for account {{account}} is ready. Log in to download.\n\nOpening: {{currency}}{{opening}}\nClosing: {{currency}}{{closing}}\n\n54Bank", Vars: []string{"name", "period", "account", "currency", "opening", "closing"}, Status: "active"},
		{ID: "TPL-008", Name: "WhatsApp Payment Link", Channel: "whatsapp", Body: "Hi {{name}}! Pay your {{billType}} of {{currency}}{{amount}} via this link: {{paymentLink}}. Powered by 54Bank.", Vars: []string{"name", "billType", "currency", "amount", "paymentLink"}, Status: "active"},
	}
	deliveries = []DeliveryRecord{
		{ID: "DLV-001", TemplateID: "TPL-002", Channel: "sms", Recipient: "+2348012345678", Status: "delivered", RetryCount: 0, SentAt: "2026-05-09T14:00:00Z", DeliveredAt: "2026-05-09T14:00:02Z", Cost: 4.0},
		{ID: "DLV-002", TemplateID: "TPL-001", Channel: "sms", Recipient: "+2348098765432", Status: "delivered", RetryCount: 0, SentAt: "2026-05-09T14:05:00Z", DeliveredAt: "2026-05-09T14:05:01Z", Cost: 4.0},
		{ID: "DLV-003", TemplateID: "TPL-003", Channel: "email", Recipient: "aisha@example.com", Subject: "Welcome to 54Bank — Your Account is Ready", Status: "delivered", RetryCount: 0, SentAt: "2026-05-09T10:00:00Z", DeliveredAt: "2026-05-09T10:00:05Z", Cost: 0.5},
		{ID: "DLV-004", TemplateID: "TPL-004", Channel: "email", Recipient: "ibrahim@example.com", Subject: "Loan Disbursement Confirmation — LN-002", Status: "delivered", RetryCount: 1, SentAt: "2026-05-09T11:00:00Z", DeliveredAt: "2026-05-09T11:02:00Z", Cost: 0.5},
		{ID: "DLV-005", TemplateID: "TPL-006", Channel: "sms", Recipient: "+2347011223344", Status: "failed", RetryCount: 3, SentAt: "2026-05-09T13:00:00Z", FailReason: "Number unreachable after 3 retries", Cost: 0},
		{ID: "DLV-006", TemplateID: "TPL-008", Channel: "whatsapp", Recipient: "+2348055667788", Status: "delivered", RetryCount: 0, SentAt: "2026-05-09T12:30:00Z", DeliveredAt: "2026-05-09T12:30:03Z", Cost: 2.0},
	}
	nextDel = len(deliveries) + 1
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
			"status": "ok", "service": "sms-email-gateway",
			"channels": []string{"sms", "email", "whatsapp", "push"},
			"middleware": []string{"Twilio", "SendGrid", "Firebase", "Redis"},
		})
	})

	mux.HandleFunc("/v1/messaging/templates", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			respondJSON(w, http.StatusOK, map[string]interface{}{"items": templates, "total": len(templates)})
		case http.MethodPost:
			var t MessageTemplate
			if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
				return
			}
			if t.Name == "" || t.Channel == "" || t.Body == "" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "name, channel, and body are required"})
				return
			}
			mu.Lock()
			t.ID = fmt.Sprintf("TPL-%03d", len(templates)+1)
			t.Status = "active"
			templates = append(templates, t)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, t)
		default:
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	mux.HandleFunc("/v1/messaging/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST only"})
			return
		}
		var req SendRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}
		if req.Recipient == "" || req.Channel == "" {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "recipient and channel are required"})
			return
		}
		validChannels := map[string]bool{"sms": true, "email": true, "whatsapp": true, "push": true}
		if !validChannels[req.Channel] {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid channel; must be sms, email, whatsapp, or push"})
			return
		}

		mu.Lock()
		now := time.Now().UTC().Format(time.RFC3339)
		cost := 0.0
		switch req.Channel {
		case "sms":
			cost = 4.0
		case "email":
			cost = 0.5
		case "whatsapp":
			cost = 2.0
		case "push":
			cost = 0.1
		}
		delivery := DeliveryRecord{
			ID:         fmt.Sprintf("DLV-%03d", nextDel),
			TemplateID: req.TemplateID,
			Channel:    req.Channel,
			Recipient:  req.Recipient,
			Status:     "queued",
			SentAt:     now,
			Cost:       cost,
		}
		if rand.Float64() > 0.1 {
			delivery.Status = "delivered"
			delivery.DeliveredAt = time.Now().UTC().Add(2 * time.Second).Format(time.RFC3339)
		} else {
			delivery.Status = "failed"
			delivery.FailReason = "Simulated delivery failure"
			delivery.RetryCount = 1
		}
		deliveries = append(deliveries, delivery)
		nextDel++
		mu.Unlock()
		respondJSON(w, http.StatusAccepted, delivery)
	})

	mux.HandleFunc("/v1/messaging/deliveries", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": deliveries, "total": len(deliveries)})
		mu.Unlock()
	})

	mux.HandleFunc("/v1/messaging/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		byChannel := map[string]int{}
		byStatus := map[string]int{}
		totalCost := 0.0
		for _, d := range deliveries {
			byChannel[d.Channel]++
			byStatus[d.Status]++
			totalCost += d.Cost
		}
		mu.Unlock()
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalDeliveries": len(deliveries), "totalTemplates": len(templates),
			"totalCost": totalCost, "byChannel": byChannel, "byStatus": byStatus,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8144"
	}
	fmt.Printf("sms-email-gateway listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
