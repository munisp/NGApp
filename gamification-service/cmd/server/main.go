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
		port = "8110"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/loyalty/profile", handleProfile)
	mux.HandleFunc("/api/v1/loyalty/earn", handleEarn)
	mux.HandleFunc("/api/v1/loyalty/redeem", handleRedeem)
	mux.HandleFunc("/api/v1/loyalty/challenges", handleChallenges)
	mux.HandleFunc("/api/v1/loyalty/leaderboard", handleLeaderboard)
	mux.HandleFunc("/api/v1/loyalty/tiers", handleTiers)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"gamification-service"}`))
	})
	log.Printf("Gamification Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

func handleProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"customer_id": "CUST-001",
		"points":      2450,
		"tier":        "Silver",
		"tier_progress": map[string]interface{}{
			"current": 2450, "next_tier": "Gold", "required": 5000, "progress_pct": 49,
		},
		"lifetime_points": 8200,
		"redeemed_points": 5750,
		"streak_days":     15,
		"badges": []map[string]interface{}{
			{"id": "early_bird", "name": "Early Bird", "description": "Paid premium before due date 3 times", "earned_at": "2026-03-15"},
			{"id": "safe_driver", "name": "Safe Driver", "description": "No claims for 12 months", "earned_at": "2026-01-15"},
			{"id": "referral_star", "name": "Referral Star", "description": "Referred 5 friends", "earned_at": "2026-04-20"},
		},
		"referral_code": "JOHN2450",
		"referral_count": 5,
		"referral_earnings": 7500,
	})
}

func handleEarn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"points_earned": 100,
		"new_balance":   2550,
		"reason":        "premium_payment",
		"message":       "You earned 100 points for paying your premium on time!",
	})
}

func handleRedeem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rewards": []map[string]interface{}{
			{"id": "RWD-001", "name": "Premium Discount 5%", "points_required": 1000, "type": "discount"},
			{"id": "RWD-002", "name": "Free Device Insurance (1 month)", "points_required": 500, "type": "free_cover"},
			{"id": "RWD-003", "name": "N500 Airtime", "points_required": 250, "type": "airtime"},
			{"id": "RWD-004", "name": "N1000 Data Bundle", "points_required": 400, "type": "data"},
			{"id": "RWD-005", "name": "Movie Ticket", "points_required": 750, "type": "entertainment"},
		},
	})
}

func handleChallenges(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"active_challenges": []map[string]interface{}{
			{"id": "CH-001", "name": "Pay On Time", "description": "Pay 3 premiums before due date", "reward_points": 500, "progress": 2, "target": 3, "expires": "2026-06-30"},
			{"id": "CH-002", "name": "Refer a Friend", "description": "Get 1 friend to buy a policy", "reward_points": 300, "progress": 0, "target": 1, "expires": "2026-07-31"},
			{"id": "CH-003", "name": "Complete Profile", "description": "Add emergency contact and next of kin", "reward_points": 200, "progress": 1, "target": 2, "expires": "2026-12-31"},
			{"id": "CH-004", "name": "Health Hero", "description": "Log 10,000 steps for 7 days", "reward_points": 150, "progress": 4, "target": 7, "expires": "2026-05-31"},
		},
	})
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"period": "2026-05",
		"leaderboard": []map[string]interface{}{
			{"rank": 1, "name": "Amina B.", "points": 5200, "tier": "Gold"},
			{"rank": 2, "name": "Chukwu E.", "points": 4800, "tier": "Gold"},
			{"rank": 3, "name": "Adebayo O.", "points": 4500, "tier": "Silver"},
			{"rank": 4, "name": "John O.", "points": 2450, "tier": "Silver", "is_current_user": true},
		},
	})
}

func handleTiers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tiers": []map[string]interface{}{
			{"name": "Bronze", "min_points": 0, "benefits": []string{"Basic rewards", "SMS notifications"}},
			{"name": "Silver", "min_points": 2000, "benefits": []string{"5% premium discount", "Priority claims", "WhatsApp support"}},
			{"name": "Gold", "min_points": 5000, "benefits": []string{"10% premium discount", "Fast-track claims", "Dedicated agent", "Free device cover"}},
			{"name": "Platinum", "min_points": 10000, "benefits": []string{"15% premium discount", "VIP claims", "Concierge service", "Free family cover add-on"}},
		},
	})
}
