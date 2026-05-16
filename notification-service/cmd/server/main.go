package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8109"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/notifications/send", handleSend)
	mux.HandleFunc("/api/v1/notifications/bulk", handleBulk)
	mux.HandleFunc("/api/v1/notifications/preferences", handlePreferences)
	mux.HandleFunc("/api/v1/notifications/channels", handleChannels)
	mux.HandleFunc("/api/v1/notifications/history", handleHistory)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"notification-service"}`))
	})
	log.Printf("Notification Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type NotificationRequest struct {
	RecipientID string   `json:"recipient_id"`
	Channels    []string `json:"channels"` // sms, whatsapp, email, push, ussd
	Template    string   `json:"template"`
	Language    string   `json:"language"`
	Data        map[string]string `json:"data"`
	Priority    string   `json:"priority"` // low, normal, high, urgent
	ScheduleAt  string   `json:"schedule_at,omitempty"`
}

type NotificationResponse struct {
	NotificationID string    `json:"notification_id"`
	Status         string    `json:"status"`
	ChannelResults []ChannelResult `json:"channel_results"`
	SentAt         time.Time `json:"sent_at"`
}

type ChannelResult struct {
	Channel   string `json:"channel"`
	Status    string `json:"status"`
	MessageID string `json:"message_id"`
	Cost      float64 `json:"cost_ngn"`
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req NotificationRequest
	json.NewDecoder(r.Body).Decode(&req)
	if req.Language == "" {
		req.Language = "en"
	}
	if len(req.Channels) == 0 {
		req.Channels = []string{"sms"}
	}

	results := make([]ChannelResult, len(req.Channels))
	for i, ch := range req.Channels {
		cost := 0.0
		switch ch {
		case "sms":
			cost = 4.0
		case "whatsapp":
			cost = 2.5
		case "email":
			cost = 0.5
		case "push":
			cost = 0.1
		}
		results[i] = ChannelResult{
			Channel:   ch,
			Status:    "delivered",
			MessageID: fmt.Sprintf("MSG-%s-%d", ch, time.Now().UnixNano()%100000),
			Cost:      cost,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(NotificationResponse{
		NotificationID: fmt.Sprintf("NTF-%d", time.Now().UnixNano()%1000000),
		Status:         "sent",
		ChannelResults: results,
		SentAt:         time.Now(),
	})
}

func handleBulk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"batch_id": fmt.Sprintf("BATCH-%d", time.Now().UnixNano()%1000000),
		"status":   "queued",
		"message":  "Bulk notification batch queued for processing",
	})
}

func handlePreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"customer_id": "CUST-001",
		"preferred_language": "en",
		"channels": map[string]bool{
			"sms": true, "whatsapp": true, "email": true, "push": false,
		},
		"quiet_hours": map[string]string{"start": "22:00", "end": "07:00"},
		"notification_types": map[string]bool{
			"payment_reminders": true, "claim_updates": true,
			"policy_renewal": true, "marketing": false,
		},
	})
}

func handleChannels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"channels": []map[string]interface{}{
			{"id": "sms", "name": "SMS", "provider": "Africa's Talking", "cost_per_msg": 4.0, "delivery_rate": 0.97},
			{"id": "whatsapp", "name": "WhatsApp Business", "provider": "Meta Cloud API", "cost_per_msg": 2.5, "delivery_rate": 0.99},
			{"id": "email", "name": "Email", "provider": "SendGrid", "cost_per_msg": 0.5, "delivery_rate": 0.95},
			{"id": "push", "name": "Push Notification", "provider": "Firebase", "cost_per_msg": 0.1, "delivery_rate": 0.85},
			{"id": "ussd", "name": "USSD Flash", "provider": "Africa's Talking", "cost_per_msg": 3.0, "delivery_rate": 0.92},
		},
	})
}

func handleHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"notifications": []map[string]interface{}{
			{"id": "NTF-001", "template": "payment_reminder", "channel": "sms", "status": "delivered", "sent_at": "2026-05-15T10:00:00Z"},
			{"id": "NTF-002", "template": "claim_update", "channel": "whatsapp", "status": "delivered", "sent_at": "2026-05-14T15:30:00Z"},
			{"id": "NTF-003", "template": "policy_renewal", "channel": "email", "status": "delivered", "sent_at": "2026-05-10T09:00:00Z"},
		},
		"total": 3,
	})
}
