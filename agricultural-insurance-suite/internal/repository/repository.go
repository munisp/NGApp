package repository

import (
	"agricultural-insurance-suite/internal/models"
	"sync"
	"time"
)

type Repository struct {
	mu       sync.RWMutex
	products map[string]*models.Product
	policies map[string]*models.Policy
	triggers map[string]*models.TriggerEvent
	payouts  map[string]*models.ClaimPayout
}

func NewRepository() *Repository {
	r := &Repository{
		products: make(map[string]*models.Product),
		policies: make(map[string]*models.Policy),
		triggers: make(map[string]*models.TriggerEvent),
		payouts:  make(map[string]*models.ClaimPayout),
	}
	r.seedProducts()
	return r
}

func (r *Repository) seedProducts() {
	products := []models.Product{
		{ID: "PROD-RAIN-001", Name: "ClimaCash RainCash", Type: models.ProductClimaCashRain, Description: "Parametric payout when rainfall exceeds threshold — protects farmers from flood damage", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet", ThresholdValue: 255, ThresholdUnit: "mm/week", PayoutAmount: 50000, PremiumAmount: 2500, CoverageRegions: []string{"North-Central", "South-West", "South-South"}, CoveredAssets: []string{"crops", "farmland"}, MaxPayoutNGN: 200000, Season: "rainy", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-DROUGHT-001", Name: "ClimaCash DroughtCash", Type: models.ProductClimaCashDrought, Description: "Auto payout when rainfall drops below minimum for extended period", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet", ThresholdValue: 20, ThresholdUnit: "mm/month", PayoutAmount: 75000, PremiumAmount: 3500, CoverageRegions: []string{"North-West", "North-East", "North-Central"}, CoveredAssets: []string{"crops", "livestock_feed"}, MaxPayoutNGN: 300000, Season: "dry", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-FLOOD-001", Name: "ClimaCash FloodCash", Type: models.ProductClimaCashFlood, Description: "Emergency cash for communities impacted by flooding events", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet", ThresholdValue: 380, ThresholdUnit: "mm/week", PayoutAmount: 100000, PremiumAmount: 5000, CoverageRegions: []string{"South-South", "South-East", "North-Central"}, CoveredAssets: []string{"property", "crops", "livestock"}, MaxPayoutNGN: 500000, Season: "rainy", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-HEAT-001", Name: "ClimaCash HeatCash", Type: models.ProductClimaCashHeat, Description: "Payout when temperature exceeds dangerous threshold for livestock and crops", TriggerType: models.TriggerTemperature, TriggerSource: "NiMet", ThresholdValue: 42, ThresholdUnit: "celsius", PayoutAmount: 40000, PremiumAmount: 2000, CoverageRegions: []string{"North-East", "North-West"}, CoveredAssets: []string{"livestock", "crops"}, MaxPayoutNGN: 160000, Season: "harmattan", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-WICI-001", Name: "Weather Index Crop Insurance", Type: models.ProductWeatherIndexCrop, Description: "NiMet satellite rainfall data triggers automatic crop loss payouts — GIZ-EU VACE Programme", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet-Satellite", ThresholdValue: 150, ThresholdUnit: "mm/season", PayoutAmount: 85000, PremiumAmount: 4200, CoverageRegions: []string{"Benue", "Niger", "Kaduna"}, CoveredAssets: []string{"maize", "rice", "sorghum", "millet", "cassava"}, MaxPayoutNGN: 350000, Season: "long_rains", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-IBLI-001", Name: "Index-Based Livestock Insurance", Type: models.ProductLivestockIndex, Description: "NDVI satellite monitors pasture — auto-payout below 20th percentile — Africa Re model", TriggerType: models.TriggerNDVI, TriggerSource: "NDVI-Satellite", ThresholdValue: 0.20, ThresholdUnit: "percentile", PayoutAmount: 120000, PremiumAmount: 6000, CoverageRegions: []string{"Sokoto", "Bauchi", "Adamawa", "Plateau"}, CoveredAssets: []string{"cattle", "camels", "sheep", "goats"}, MaxPayoutNGN: 500000, Season: "year_round", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-IBLT-001", Name: "Index-Based Livestock Takaful", Type: models.ProductLivestockTakaful, Description: "Sharia-compliant IBLI with Takaful mutual structure and NDVI triggers", TriggerType: models.TriggerNDVI, TriggerSource: "NDVI-Satellite", ThresholdValue: 0.20, ThresholdUnit: "percentile", PayoutAmount: 120000, PremiumAmount: 5500, CoverageRegions: []string{"Sokoto", "Zamfara", "Katsina", "Kano", "Borno"}, CoveredAssets: []string{"cattle", "camels", "sheep", "goats"}, MaxPayoutNGN: 500000, Season: "year_round", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-FERT-001", Name: "Fertiliser-Bundled Crop Insurance", Type: models.ProductFertiliserBundled, Description: "Auto coverage bundled with subsidised fertiliser purchase — zero-friction enrollment", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet", ThresholdValue: 100, ThresholdUnit: "mm/season", PayoutAmount: 7000, PremiumAmount: 500, CoverageRegions: []string{"Trans-Nzoia", "Kakamega", "Kericho"}, CoveredAssets: []string{"fertiliser_investment", "crops"}, MaxPayoutNGN: 28000, Season: "long_rains", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-AYI-001", Name: "Area Yield Index Insurance", Type: models.ProductAreaYieldIndex, Description: "Payouts based on average area yield — lower basis risk than weather-only indices", TriggerType: models.TriggerAreaYield, TriggerSource: "NAIC-Nigeria", ThresholdValue: 70, ThresholdUnit: "pct_of_avg", PayoutAmount: 95000, PremiumAmount: 4800, CoverageRegions: []string{"Benue", "Niger", "Kaduna", "Kogi", "Taraba"}, CoveredAssets: []string{"maize", "rice", "yam", "cassava"}, MaxPayoutNGN: 400000, Season: "harvest", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-AQUA-001", Name: "Aquaculture & Fisheries Insurance", Type: models.ProductAquaculture, Description: "Protects fisherfolk against storms — wind speed + wave height triggers", TriggerType: models.TriggerWindSpeed, TriggerSource: "NiMet-Marine", ThresholdValue: 65, ThresholdUnit: "kmh", PayoutAmount: 80000, PremiumAmount: 4000, CoverageRegions: []string{"Lagos", "Rivers", "Bayelsa", "Cross-River", "Akwa-Ibom"}, CoveredAssets: []string{"fishing_boats", "nets", "catch", "aquaculture_ponds"}, MaxPayoutNGN: 350000, Season: "year_round", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-MPCI-001", Name: "Multi-Peril Crop Insurance", Type: models.ProductMultiPerilCrop, Description: "Hybrid parametric + indemnity combining weather index with named perils", TriggerType: models.TriggerRainfall, TriggerSource: "NiMet+FieldAssessors", ThresholdValue: 100, ThresholdUnit: "mm/season", PayoutAmount: 150000, PremiumAmount: 7500, CoverageRegions: []string{"All-Nigeria"}, CoveredAssets: []string{"all_crops"}, MaxPayoutNGN: 600000, Season: "year_round", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-PAST-001", Name: "Pastoral Migration Route Insurance", Type: models.ProductPastoralRoute, Description: "Insures pastoralist transhumance corridor movements with GPS + drought triggers", TriggerType: models.TriggerGPS, TriggerSource: "GPS+NDVI", ThresholdValue: 0.25, ThresholdUnit: "ndvi_along_route", PayoutAmount: 60000, PremiumAmount: 3000, CoverageRegions: []string{"Adamawa-Taraba-Benue-Corridor", "Sokoto-Zamfara-Corridor"}, CoveredAssets: []string{"cattle_in_transit", "herder_equipment"}, MaxPayoutNGN: 250000, Season: "migration", IsActive: true, CreatedAt: time.Now()},
		{ID: "PROD-CARB-001", Name: "Carbon Credit Insurance", Type: models.ProductCarbonCredit, Description: "Protects farmers carbon credit revenue from climate events reducing sequestration", TriggerType: models.TriggerCarbonFlux, TriggerSource: "Verra-Registry", ThresholdValue: 30, ThresholdUnit: "pct_reduction", PayoutAmount: 200000, PremiumAmount: 10000, CoverageRegions: []string{"All-Nigeria"}, CoveredAssets: []string{"carbon_credits", "agroforestry"}, MaxPayoutNGN: 800000, Season: "year_round", IsActive: true, CreatedAt: time.Now()},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
}

func (r *Repository) GetProducts() []models.Product {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.Product, 0, len(r.products))
	for _, p := range r.products {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetProduct(id string) *models.Product {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.products[id]; ok {
		copy := *p
		return &copy
	}
	return nil
}

func (r *Repository) CreatePolicy(p *models.Policy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
}

func (r *Repository) GetPolicies() []models.Policy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.Policy, 0, len(r.policies))
	for _, p := range r.policies {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetPoliciesByProduct(productID string) []models.Policy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Policy
	for _, p := range r.policies {
		if p.ProductID == productID {
			result = append(result, *p)
		}
	}
	return result
}

func (r *Repository) RecordTrigger(t *models.TriggerEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.triggers[t.ID] = t
}

func (r *Repository) GetTriggers() []models.TriggerEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.TriggerEvent, 0, len(r.triggers))
	for _, t := range r.triggers {
		result = append(result, *t)
	}
	return result
}

func (r *Repository) RecordPayout(p *models.ClaimPayout) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.payouts[p.ID] = p
}

func (r *Repository) GetPayouts() []models.ClaimPayout {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.ClaimPayout, 0, len(r.payouts))
	for _, p := range r.payouts {
		result = append(result, *p)
	}
	return result
}
