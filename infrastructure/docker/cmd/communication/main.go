// Communication gateway — consolidates Notification, Multi-Language, Gamification
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	port := envOr("HTTP_PORT", "8700")

	mux := http.NewServeMux()
	started := time.Now()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"service":        "communication",
			"group":          "notification,multi-language,gamification",
			"uptime_seconds": time.Since(started).Seconds(),
		})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"ready": true})
	})
	mux.HandleFunc("/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"alive": true})
	})

	// Notifications
	mux.HandleFunc("/api/v1/notifications/send", handleNotificationSend)
	mux.HandleFunc("/api/v1/notifications/templates", handleNotificationTemplates)
	// Multi-Language
	mux.HandleFunc("/api/v1/i18n/languages", handleLanguages)
	mux.HandleFunc("/api/v1/i18n/translate", handleTranslate)
	// Gamification
	mux.HandleFunc("/api/v1/gamification/points", handleGamificationPoints)
	mux.HandleFunc("/api/v1/gamification/leaderboard", handleLeaderboard)

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# TYPE communication_http_requests_total counter\ncommunication_http_requests_total 0\n")
	})

	fmt.Printf("[communication] Starting on :%s\n", port)
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}

func handleNotificationSend(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      fmt.Sprintf("NOTIF-%d", time.Now().UnixMilli()),
		"status":  "queued",
		"channel": "sms",
	})
}

func handleNotificationTemplates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": []map[string]interface{}{
			{"id": "welcome", "name": "Welcome Message", "channels": []string{"sms", "email", "push"}},
			{"id": "claim-update", "name": "Claim Status Update", "channels": []string{"sms", "email"}},
			{"id": "payment-reminder", "name": "Payment Reminder", "channels": []string{"sms", "push", "ussd"}},
			{"id": "policy-renewal", "name": "Policy Renewal Notice", "channels": []string{"sms", "email"}},
		},
	})
}

func handleLanguages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"languages": []map[string]interface{}{
			{"code": "en", "name": "English", "coverage": 1.0},
			{"code": "yo", "name": "Yoruba", "coverage": 0.85},
			{"code": "ha", "name": "Hausa", "coverage": 0.82},
			{"code": "ig", "name": "Igbo", "coverage": 0.80},
			{"code": "pcm", "name": "Nigerian Pidgin", "coverage": 0.75},
			{"code": "fr", "name": "French", "coverage": 0.90},
			{"code": "sw", "name": "Swahili", "coverage": 0.70},
		},
	})
}

func handleTranslate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"from":        "en",
		"to":          "yo",
		"original":    "Your policy has been renewed successfully",
		"translation": "Ilana iṣeduro rẹ ti di atunṣe ni aṣeyọri",
		"confidence":  0.92,
	})
}

func handleGamificationPoints(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_points":    2500,
		"level":           "gold",
		"next_level":      "platinum",
		"points_to_next":  500,
		"achievements":    []string{"first_policy", "referral_5", "on_time_payments_12"},
		"rewards_earned":  3,
	})
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"period": time.Now().Format("2006-01"),
		"top_agents": []map[string]interface{}{
			{"rank": 1, "agent_id": "AGT-001", "points": 15000, "policies_sold": 45},
			{"rank": 2, "agent_id": "AGT-002", "points": 12500, "policies_sold": 38},
			{"rank": 3, "agent_id": "AGT-003", "points": 11000, "policies_sold": 35},
		},
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
