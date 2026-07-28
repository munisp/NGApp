package models

import "time"

type ProductType string

const (
	ProductClimaCashRain     ProductType = "climacash_rain"
	ProductClimaCashDrought  ProductType = "climacash_drought"
	ProductClimaCashFlood    ProductType = "climacash_flood"
	ProductClimaCashHeat     ProductType = "climacash_heat"
	ProductWeatherIndexCrop  ProductType = "weather_index_crop"
	ProductLivestockIndex    ProductType = "livestock_index_ibli"
	ProductLivestockTakaful  ProductType = "livestock_takaful_iblt"
	ProductFertiliserBundled ProductType = "fertiliser_bundled"
	ProductAreaYieldIndex    ProductType = "area_yield_index"
	ProductAquaculture       ProductType = "aquaculture_fisheries"
	ProductMultiPerilCrop    ProductType = "multi_peril_crop"
	ProductPastoralRoute     ProductType = "pastoral_route"
	ProductCarbonCredit      ProductType = "carbon_credit"
)

type TriggerType string

const (
	TriggerRainfall    TriggerType = "rainfall"
	TriggerTemperature TriggerType = "temperature"
	TriggerNDVI        TriggerType = "ndvi_vegetation"
	TriggerWindSpeed   TriggerType = "wind_speed"
	TriggerAreaYield   TriggerType = "area_yield"
	TriggerGPS         TriggerType = "gps_movement"
	TriggerCarbonFlux  TriggerType = "carbon_flux"
)

type Product struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Type            ProductType `json:"type"`
	Description     string      `json:"description"`
	TriggerType     TriggerType `json:"trigger_type"`
	TriggerSource   string      `json:"trigger_source"`
	ThresholdValue  float64     `json:"threshold_value"`
	ThresholdUnit   string      `json:"threshold_unit"`
	PayoutAmount    float64     `json:"payout_amount_ngn"`
	PremiumAmount   float64     `json:"premium_amount_ngn"`
	CoverageRegions []string    `json:"coverage_regions"`
	CoveredAssets   []string    `json:"covered_assets"`
	MaxPayoutNGN    float64     `json:"max_payout_ngn"`
	Season          string      `json:"season"`
	IsActive        bool        `json:"is_active"`
	CreatedAt       time.Time   `json:"created_at"`
}

type Policy struct {
	ID            string    `json:"id"`
	ProductID     string    `json:"product_id"`
	CustomerID    string    `json:"customer_id"`
	CustomerName  string    `json:"customer_name"`
	Region        string    `json:"region"`
	State         string    `json:"state"`
	LGA           string    `json:"lga"`
	Assets        []Asset   `json:"assets"`
	PremiumPaid   float64   `json:"premium_paid_ngn"`
	CoverageStart time.Time `json:"coverage_start"`
	CoverageEnd   time.Time `json:"coverage_end"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type Asset struct {
	Type     string  `json:"type"`
	Quantity int     `json:"quantity"`
	Value    float64 `json:"value_ngn"`
}

type TriggerEvent struct {
	ID            string    `json:"id"`
	ProductType   string    `json:"product_type"`
	TriggerType   string    `json:"trigger_type"`
	Region        string    `json:"region"`
	MeasuredValue float64   `json:"measured_value"`
	Threshold     float64   `json:"threshold"`
	Triggered     bool      `json:"triggered"`
	DataSource    string    `json:"data_source"`
	Timestamp     time.Time `json:"timestamp"`
}

type ClaimPayout struct {
	ID           string    `json:"id"`
	PolicyID     string    `json:"policy_id"`
	TriggerID    string    `json:"trigger_event_id"`
	Amount       float64   `json:"amount_ngn"`
	Status       string    `json:"status"`
	PayoutMethod string    `json:"payout_method"`
	ProcessedAt  time.Time `json:"processed_at"`
}

type NDVIReading struct {
	Region     string    `json:"region"`
	Value      float64   `json:"ndvi_value"`
	Percentile float64   `json:"percentile"`
	Condition  string    `json:"condition"`
	Timestamp  time.Time `json:"timestamp"`
}

type EnrollRequest struct {
	ProductID    string  `json:"product_id"`
	CustomerID   string  `json:"customer_id"`
	CustomerName string  `json:"customer_name"`
	Region       string  `json:"region"`
	State        string  `json:"state"`
	LGA          string  `json:"lga"`
	Assets       []Asset `json:"assets"`
}

type TriggerRequest struct {
	ProductType   string  `json:"product_type"`
	TriggerType   string  `json:"trigger_type"`
	Region        string  `json:"region"`
	MeasuredValue float64 `json:"measured_value"`
	DataSource    string  `json:"data_source"`
}
