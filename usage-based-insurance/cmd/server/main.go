package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8097"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/ubi/policies", handleUBIPolicies)
	mux.HandleFunc("/api/v1/ubi/telematics", handleTelematics)
	mux.HandleFunc("/api/v1/ubi/driving-score", handleDrivingScore)
	mux.HandleFunc("/api/v1/ubi/premium-adjust", handlePremiumAdjust)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"usage-based-insurance"}`))
	})
	log.Printf("Usage-Based Insurance starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

// TelematicsData from OBD-II or phone GPS
type TelematicsData struct {
	PolicyID       string    `json:"policy_id"`
	Timestamp      time.Time `json:"timestamp"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	Speed          float64   `json:"speed_kmh"`
	Acceleration   float64   `json:"acceleration_ms2"`
	Braking        float64   `json:"braking_ms2"`
	CorneringForce float64   `json:"cornering_force_g"`
	DistanceKm     float64   `json:"distance_km"`
	TimeOfDay      string    `json:"time_of_day"` // day, night, rush_hour
	RoadType       string    `json:"road_type"`   // highway, urban, rural
}

// DrivingScore represents an aggregated driving behavior score
type DrivingScore struct {
	PolicyID         string  `json:"policy_id"`
	OverallScore     float64 `json:"overall_score"`
	SpeedScore       float64 `json:"speed_score"`
	BrakingScore     float64 `json:"braking_score"`
	AccelerationScore float64 `json:"acceleration_score"`
	CorneringScore   float64 `json:"cornering_score"`
	TimeOfDayScore   float64 `json:"time_of_day_score"`
	DistanceRisk     float64 `json:"distance_risk_score"`
	TotalDistanceKm  float64 `json:"total_distance_km"`
	TripCount        int     `json:"trip_count"`
	PremiumDiscount  float64 `json:"premium_discount_pct"`
	RiskCategory     string  `json:"risk_category"` // low, medium, high
	Period           string  `json:"period"`
}

func handleUBIPolicies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"products": []map[string]interface{}{
			{
				"id":          "UBI-MOTOR-001",
				"name":        "Pay-Per-Kilometer Motor",
				"type":        "motor",
				"base_rate":   "N3/km",
				"min_monthly": 2000,
				"max_monthly": 25000,
				"data_source": "Phone GPS or OBD-II device",
				"description": "Pay only for the kilometers you drive. Safe drivers get up to 40% discount.",
			},
			{
				"id":          "UBI-HEALTH-001",
				"name":        "Active Health Rewards",
				"type":        "health",
				"base_rate":   "N5,000/month",
				"min_monthly": 3000,
				"max_monthly": 8000,
				"data_source": "Fitness tracker / Phone pedometer",
				"description": "Hit your daily step goal and earn premium discounts. 10,000 steps = 20% off.",
			},
			{
				"id":          "UBI-DEVICE-001",
				"name":        "Active Device Cover",
				"type":        "device",
				"base_rate":   "N10/day (active days only)",
				"min_monthly": 0,
				"max_monthly": 300,
				"data_source": "Device activity detection",
				"description": "Only pay for days your device is actively used. Inactive days = no charge.",
			},
		},
	})
}

func handleTelematics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var data TelematicsData
	json.NewDecoder(r.Body).Decode(&data)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "recorded",
		"trip_id":  fmt.Sprintf("TRIP-%d", time.Now().UnixNano()%1000000),
		"distance": data.DistanceKm,
		"charge":   math.Round(data.DistanceKm*3*100) / 100, // N3/km
	})
}

func handleDrivingScore(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DrivingScore{
		PolicyID:          "UBI-POL-001",
		OverallScore:      82.5,
		SpeedScore:        85.0,
		BrakingScore:      78.0,
		AccelerationScore: 88.0,
		CorneringScore:    80.0,
		TimeOfDayScore:    90.0,
		DistanceRisk:      75.0,
		TotalDistanceKm:   1250.5,
		TripCount:         45,
		PremiumDiscount:   25.0,
		RiskCategory:      "low",
		Period:            "2026-05",
	})
}

func handlePremiumAdjust(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"policy_id":        "UBI-POL-001",
		"base_premium":     5000,
		"usage_charge":     3751.50,
		"safe_driving_discount": -937.88,
		"adjusted_premium": 7813.62,
		"savings_vs_traditional": "38%",
		"next_review":      "2026-06-01",
	})
}
