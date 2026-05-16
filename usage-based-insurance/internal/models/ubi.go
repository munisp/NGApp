package models

import "time"

type TelematicsData struct {
	ID              string    `json:"id"`
	PolicyID        string    `json:"policy_id"`
	DeviceID        string    `json:"device_id"`
	Timestamp       time.Time `json:"timestamp"`
	Speed           float64   `json:"speed_kmh"`
	Acceleration    float64   `json:"acceleration"`
	Braking         float64   `json:"braking_force"`
	Cornering       float64   `json:"cornering_force"`
	DistanceKm      float64   `json:"distance_km"`
	FuelConsumption float64   `json:"fuel_consumption_l"`
	EngineRPM       int       `json:"engine_rpm"`
	Location        GeoPoint  `json:"location"`
	IsNightDriving  bool      `json:"is_night_driving"`
	RoadType        string    `json:"road_type"`
	WeatherCondition string   `json:"weather_condition"`
}

type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type DrivingScore struct {
	ID              string    `json:"id"`
	PolicyID        string    `json:"policy_id"`
	Period          string    `json:"period"`
	OverallScore    float64   `json:"overall_score"`
	SpeedScore      float64   `json:"speed_score"`
	BrakingScore    float64   `json:"braking_score"`
	AccelScore      float64   `json:"acceleration_score"`
	CorneringScore  float64   `json:"cornering_score"`
	NightDrivingPct float64   `json:"night_driving_pct"`
	TotalDistanceKm float64   `json:"total_distance_km"`
	TotalTrips      int       `json:"total_trips"`
	HardBrakeEvents int       `json:"hard_brake_events"`
	SpeedingEvents  int       `json:"speeding_events"`
	PremiumDiscount float64   `json:"premium_discount_pct"`
	RiskCategory    string    `json:"risk_category"`
	CalculatedAt    time.Time `json:"calculated_at"`
}

type UBIPolicy struct {
	ID               string    `json:"id"`
	CustomerID       string    `json:"customer_id"`
	VehicleReg       string    `json:"vehicle_reg"`
	VehicleMake      string    `json:"vehicle_make"`
	VehicleModel     string    `json:"vehicle_model"`
	VehicleYear      int       `json:"vehicle_year"`
	DeviceID         string    `json:"device_id"`
	BasePremium      float64   `json:"base_premium"`
	AdjustedPremium  float64   `json:"adjusted_premium"`
	CurrentDiscount  float64   `json:"current_discount_pct"`
	Status           string    `json:"status"`
	LastScoreDate    *time.Time `json:"last_score_date,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

type Trip struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	DistanceKm  float64   `json:"distance_km"`
	DurationMin float64   `json:"duration_min"`
	AvgSpeed    float64   `json:"avg_speed_kmh"`
	MaxSpeed    float64   `json:"max_speed_kmh"`
	Score       float64   `json:"trip_score"`
	Events      int       `json:"safety_events"`
}
