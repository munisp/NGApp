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
		port = "8093"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/agents", handleAgents)
	mux.HandleFunc("/api/v1/agents/onboard", handleOnboard)
	mux.HandleFunc("/api/v1/agents/territories", handleTerritories)
	mux.HandleFunc("/api/v1/agents/leaderboard", handleLeaderboard)
	mux.HandleFunc("/api/v1/agents/training", handleTraining)
	mux.HandleFunc("/api/v1/agents/performance", handlePerformance)
	mux.HandleFunc("/api/v1/agents/gamification", handleGamification)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"agent-network-platform"}`))
	})

	log.Printf("Agent Network Platform starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

// Agent represents an insurance sales agent
type Agent struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Phone           string    `json:"phone"`
	Email           string    `json:"email"`
	Status          string    `json:"status"` // pending, active, suspended, deactivated
	Tier            string    `json:"tier"`   // bronze, silver, gold, platinum
	TerritoryID     string    `json:"territory_id"`
	TotalPolicies   int       `json:"total_policies_sold"`
	TotalPremium    float64   `json:"total_premium_collected"`
	CommissionEarned float64  `json:"commission_earned"`
	Rating          float64   `json:"rating"`
	Badges          []string  `json:"badges"`
	TrainingScore   float64   `json:"training_score"`
	JoinedAt        time.Time `json:"joined_at"`
	LastActive      time.Time `json:"last_active"`
	Location        Location  `json:"location"`
}

// Location represents GPS coordinates
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   string  `json:"address"`
	LGA       string  `json:"lga"`
	State     string  `json:"state"`
}

// Territory represents an agent's assigned territory
type Territory struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	State    string   `json:"state"`
	LGAs     []string `json:"lgas"`
	AgentIDs []string `json:"agent_ids"`
	Center   Location `json:"center"`
	Radius   float64  `json:"radius_km"`
}

// LeaderboardEntry for agent gamification
type LeaderboardEntry struct {
	Rank           int     `json:"rank"`
	AgentID        string  `json:"agent_id"`
	AgentName      string  `json:"agent_name"`
	PoliciesSold   int     `json:"policies_sold"`
	PremiumCollected float64 `json:"premium_collected"`
	Commission     float64 `json:"commission"`
	Points         int     `json:"points"`
	Streak         int     `json:"streak_days"`
	Tier           string  `json:"tier"`
}

// TrainingModule for agent certification
type TrainingModule struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // video, quiz, document
	Duration    int      `json:"duration_minutes"`
	Required    bool     `json:"required"`
	Topics      []string `json:"topics"`
	PassScore   float64  `json:"pass_score"`
}

func handleAgents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	agents := []Agent{
		{
			ID: "AGT-001", Name: "Adebayo Ogundimu", Phone: "+2348012345678",
			Status: "active", Tier: "gold", TotalPolicies: 87,
			TotalPremium: 4350000, CommissionEarned: 652500, Rating: 4.8,
			Badges: []string{"top_seller_q1", "100_percent_retention", "fast_closer"},
			Location: Location{Latitude: 6.5244, Longitude: 3.3792, State: "Lagos", LGA: "Ikeja"},
		},
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"agents": agents, "total": len(agents)})
}

func handleOnboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"agent_id": fmt.Sprintf("AGT-%d", time.Now().UnixNano()),
		"status":   "pending_verification",
		"next_steps": []string{
			"Complete KYC verification",
			"Complete mandatory training modules",
			"Pass certification exam (score >= 70%)",
			"Territory assignment",
		},
	})
}

func handleTerritories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"territories": []Territory{
			{ID: "TER-LAG-IKJ", Name: "Lagos - Ikeja", State: "Lagos",
				LGAs: []string{"Ikeja", "Agege", "Ifako-Ijaiye"},
				Center: Location{Latitude: 6.6018, Longitude: 3.3515}, Radius: 15},
			{ID: "TER-LAG-VIC", Name: "Lagos - Victoria Island", State: "Lagos",
				LGAs: []string{"Eti-Osa", "Lagos Island"},
				Center: Location{Latitude: 6.4281, Longitude: 3.4219}, Radius: 10},
			{ID: "TER-ABJ-CTR", Name: "Abuja - Central", State: "FCT",
				LGAs: []string{"Municipal", "Gwagwalada"},
				Center: Location{Latitude: 9.0579, Longitude: 7.4951}, Radius: 20},
		},
	})
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"period": "2026-Q2",
		"leaderboard": []LeaderboardEntry{
			{Rank: 1, AgentID: "AGT-001", AgentName: "Adebayo Ogundimu",
				PoliciesSold: 87, PremiumCollected: 4350000, Commission: 652500,
				Points: 2450, Streak: 23, Tier: "gold"},
			{Rank: 2, AgentID: "AGT-002", AgentName: "Chioma Nwosu",
				PoliciesSold: 72, PremiumCollected: 3600000, Commission: 504000,
				Points: 2100, Streak: 15, Tier: "gold"},
			{Rank: 3, AgentID: "AGT-003", AgentName: "Ibrahim Musa",
				PoliciesSold: 65, PremiumCollected: 3250000, Commission: 422500,
				Points: 1890, Streak: 8, Tier: "silver"},
		},
	})
}

func handleTraining(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"modules": []TrainingModule{
			{ID: "TRN-001", Title: "Insurance Fundamentals", Type: "video",
				Duration: 30, Required: true, PassScore: 70,
				Topics: []string{"What is insurance", "Types of insurance", "Nigerian insurance market"}},
			{ID: "TRN-002", Title: "Motor Insurance Products", Type: "quiz",
				Duration: 20, Required: true, PassScore: 80,
				Topics: []string{"Third party cover", "Comprehensive cover", "NMID requirements"}},
			{ID: "TRN-003", Title: "Life & Health Products", Type: "video",
				Duration: 25, Required: true, PassScore: 70,
				Topics: []string{"Term life", "Group life", "Hospital cash", "Funeral cover"}},
			{ID: "TRN-004", Title: "Sales Techniques", Type: "document",
				Duration: 15, Required: false, PassScore: 60,
				Topics: []string{"Consultative selling", "Objection handling", "Closing techniques"}},
			{ID: "TRN-005", Title: "KYC & Compliance", Type: "quiz",
				Duration: 20, Required: true, PassScore: 90,
				Topics: []string{"NAICOM rules", "AML/CFT", "Data protection", "Customer due diligence"}},
		},
	})
}

func handlePerformance(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"agent_id":      "AGT-001",
		"period":        "2026-05",
		"policies_sold": 12,
		"premium_collected": 600000,
		"commission_earned": 90000,
		"conversion_rate": 0.42,
		"avg_policy_value": 50000,
		"customer_satisfaction": 4.7,
		"targets": map[string]interface{}{
			"policies_target":    15,
			"policies_progress":  0.80,
			"premium_target":     750000,
			"premium_progress":   0.80,
		},
	})
}

func handleGamification(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"agent_id":    "AGT-001",
		"total_points": 2450,
		"current_tier": "gold",
		"next_tier":    "platinum",
		"points_to_next_tier": 550,
		"streak_days": 23,
		"badges": []map[string]interface{}{
			{"id": "top_seller_q1", "name": "Top Seller Q1 2026", "earned_at": "2026-04-01"},
			{"id": "100_pct_retention", "name": "100% Customer Retention", "earned_at": "2026-03-15"},
			{"id": "fast_closer", "name": "Fast Closer (avg < 2 days)", "earned_at": "2026-02-28"},
			{"id": "training_complete", "name": "All Training Complete", "earned_at": "2026-01-15"},
		},
		"challenges": []map[string]interface{}{
			{"id": "may_challenge", "title": "May Sales Sprint", "target": 20,
				"current": 12, "reward_points": 500, "ends_at": "2026-05-31"},
			{"id": "referral_race", "title": "Referral Race", "target": 10,
				"current": 4, "reward_points": 300, "ends_at": "2026-06-15"},
		},
	})
}
