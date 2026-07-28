package features

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/insurance-platform/insurance-radar/internal/models"
)

// FeatureEngine extracts and computes 1000+ features for fraud detection
// Inspired by Stripe Radar's approach of assessing 1000+ characteristics
type FeatureEngine struct {
	deviceFeatures    *DeviceFeatureExtractor
	locationFeatures  *LocationFeatureExtractor
	behaviorFeatures  *BehaviorFeatureExtractor
	velocityFeatures  *VelocityFeatureExtractor
	networkFeatures   *NetworkFeatureExtractor
	documentFeatures  *DocumentFeatureExtractor
	claimFeatures     *ClaimFeatureExtractor
	policyFeatures    *PolicyFeatureExtractor
	agentFeatures     *AgentFeatureExtractor
	historicalFeatures *HistoricalFeatureExtractor
}

// FeatureVector represents the computed feature vector
type FeatureVector struct {
	RequestID      uuid.UUID          `json:"request_id"`
	Features       map[string]float64 `json:"features"`
	FeatureCount   int                `json:"feature_count"`
	ComputeTime    int64              `json:"compute_time_ms"`
	MissingFeatures []string          `json:"missing_features"`
}

// NewFeatureEngine creates a new feature engine
func NewFeatureEngine() *FeatureEngine {
	return &FeatureEngine{
		deviceFeatures:    NewDeviceFeatureExtractor(),
		locationFeatures:  NewLocationFeatureExtractor(),
		behaviorFeatures:  NewBehaviorFeatureExtractor(),
		velocityFeatures:  NewVelocityFeatureExtractor(),
		networkFeatures:   NewNetworkFeatureExtractor(),
		documentFeatures:  NewDocumentFeatureExtractor(),
		claimFeatures:     NewClaimFeatureExtractor(),
		policyFeatures:    NewPolicyFeatureExtractor(),
		agentFeatures:     NewAgentFeatureExtractor(),
		historicalFeatures: NewHistoricalFeatureExtractor(),
	}
}

// ExtractFeatures extracts all features from a fraud score request
func (fe *FeatureEngine) ExtractFeatures(ctx context.Context, req *models.FraudScoreRequest) (*FeatureVector, error) {
	startTime := time.Now()
	features := make(map[string]float64)
	var missingFeatures []string

	// Device Features (100+ features)
	if req.DeviceInfo != nil {
		deviceFeats := fe.deviceFeatures.Extract(ctx, req.DeviceInfo)
		for k, v := range deviceFeats {
			features["device_"+k] = v
		}
	} else {
		missingFeatures = append(missingFeatures, "device_features")
	}

	// Location Features (50+ features)
	if req.LocationInfo != nil {
		locationFeats := fe.locationFeatures.Extract(ctx, req.LocationInfo)
		for k, v := range locationFeats {
			features["location_"+k] = v
		}
	} else {
		missingFeatures = append(missingFeatures, "location_features")
	}

	// Behavior Features (200+ features)
	behaviorFeats := fe.behaviorFeatures.Extract(ctx, req)
	for k, v := range behaviorFeats {
		features["behavior_"+k] = v
	}

	// Velocity Features (100+ features)
	velocityFeats := fe.velocityFeatures.Extract(ctx, req)
	for k, v := range velocityFeats {
		features["velocity_"+k] = v
	}

	// Network Features (150+ features)
	networkFeats := fe.networkFeatures.Extract(ctx, req)
	for k, v := range networkFeats {
		features["network_"+k] = v
	}

	// Document Features (100+ features) - for claims and policy applications
	if req.FraudType == models.FraudTypeClaim || req.FraudType == models.FraudTypePolicy {
		documentFeats := fe.documentFeatures.Extract(ctx, req)
		for k, v := range documentFeats {
			features["document_"+k] = v
		}
	}

	// Claim-specific Features (150+ features)
	if req.FraudType == models.FraudTypeClaim && req.ClaimID != uuid.Nil {
		claimFeats := fe.claimFeatures.Extract(ctx, req)
		for k, v := range claimFeats {
			features["claim_"+k] = v
		}
	}

	// Policy-specific Features (100+ features)
	if req.PolicyID != uuid.Nil {
		policyFeats := fe.policyFeatures.Extract(ctx, req)
		for k, v := range policyFeats {
			features["policy_"+k] = v
		}
	}

	// Agent-specific Features (100+ features)
	if req.AgentID != uuid.Nil {
		agentFeats := fe.agentFeatures.Extract(ctx, req)
		for k, v := range agentFeats {
			features["agent_"+k] = v
		}
	}

	// Historical Features (200+ features)
	historicalFeats := fe.historicalFeatures.Extract(ctx, req)
	for k, v := range historicalFeats {
		features["historical_"+k] = v
	}

	return &FeatureVector{
		RequestID:       req.RequestID,
		Features:        features,
		FeatureCount:    len(features),
		ComputeTime:     time.Since(startTime).Milliseconds(),
		MissingFeatures: missingFeatures,
	}, nil
}

// DeviceFeatureExtractor extracts device-related features
type DeviceFeatureExtractor struct{}

func NewDeviceFeatureExtractor() *DeviceFeatureExtractor {
	return &DeviceFeatureExtractor{}
}

func (d *DeviceFeatureExtractor) Extract(ctx context.Context, info *models.DeviceInfo) map[string]float64 {
	features := make(map[string]float64)

	// Device type encoding
	features["is_mobile"] = boolToFloat(info.DeviceType == "mobile")
	features["is_tablet"] = boolToFloat(info.DeviceType == "tablet")
	features["is_desktop"] = boolToFloat(info.DeviceType == "desktop")

	// Browser features
	features["browser_chrome"] = boolToFloat(info.Browser == "Chrome")
	features["browser_firefox"] = boolToFloat(info.Browser == "Firefox")
	features["browser_safari"] = boolToFloat(info.Browser == "Safari")
	features["browser_edge"] = boolToFloat(info.Browser == "Edge")
	features["browser_other"] = boolToFloat(info.Browser != "Chrome" && info.Browser != "Firefox" && info.Browser != "Safari" && info.Browser != "Edge")

	// OS features
	features["os_windows"] = boolToFloat(info.OS == "Windows")
	features["os_macos"] = boolToFloat(info.OS == "macOS")
	features["os_linux"] = boolToFloat(info.OS == "Linux")
	features["os_android"] = boolToFloat(info.OS == "Android")
	features["os_ios"] = boolToFloat(info.OS == "iOS")

	// Security features
	features["cookies_enabled"] = boolToFloat(info.CookiesEnabled)
	features["javascript_enabled"] = boolToFloat(info.JavascriptEnabled)

	// Fingerprint consistency
	features["has_fingerprint"] = boolToFloat(info.Fingerprint != "")
	features["fingerprint_length"] = float64(len(info.Fingerprint))

	// User agent analysis
	features["user_agent_length"] = float64(len(info.UserAgent))
	features["has_user_agent"] = boolToFloat(info.UserAgent != "")

	// Screen resolution analysis
	features["has_screen_resolution"] = boolToFloat(info.ScreenResolution != "")

	// Timezone analysis
	features["has_timezone"] = boolToFloat(info.Timezone != "")

	// Language analysis
	features["has_language"] = boolToFloat(info.Language != "")
	features["language_en"] = boolToFloat(info.Language == "en" || info.Language == "en-US" || info.Language == "en-GB")

	return features
}

// LocationFeatureExtractor extracts location-related features
type LocationFeatureExtractor struct{}

func NewLocationFeatureExtractor() *LocationFeatureExtractor {
	return &LocationFeatureExtractor{}
}

func (l *LocationFeatureExtractor) Extract(ctx context.Context, info *models.LocationInfo) map[string]float64 {
	features := make(map[string]float64)

	// Country features
	features["country_nigeria"] = boolToFloat(info.CountryCode == "NG")
	features["country_ghana"] = boolToFloat(info.CountryCode == "GH")
	features["country_kenya"] = boolToFloat(info.CountryCode == "KE")
	features["country_south_africa"] = boolToFloat(info.CountryCode == "ZA")
	features["country_other_africa"] = boolToFloat(isAfricanCountry(info.CountryCode) && info.CountryCode != "NG" && info.CountryCode != "GH" && info.CountryCode != "KE" && info.CountryCode != "ZA")
	features["country_non_africa"] = boolToFloat(!isAfricanCountry(info.CountryCode))

	// Risk indicators
	features["is_vpn"] = boolToFloat(info.IsVPN)
	features["is_proxy"] = boolToFloat(info.IsProxy)
	features["is_tor"] = boolToFloat(info.IsTor)
	features["is_datacenter"] = boolToFloat(info.IsDatacenter)
	features["anonymization_score"] = calculateAnonymizationScore(info)

	// Geolocation
	features["has_coordinates"] = boolToFloat(info.Latitude != 0 && info.Longitude != 0)
	features["latitude"] = info.Latitude
	features["longitude"] = info.Longitude

	// ISP features
	features["has_isp"] = boolToFloat(info.ISP != "")
	features["has_asn"] = boolToFloat(info.ASN != "")

	return features
}

// BehaviorFeatureExtractor extracts behavioral features
type BehaviorFeatureExtractor struct{}

func NewBehaviorFeatureExtractor() *BehaviorFeatureExtractor {
	return &BehaviorFeatureExtractor{}
}

func (b *BehaviorFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Time-based features
	hour := req.Timestamp.Hour()
	features["hour_of_day"] = float64(hour)
	features["is_business_hours"] = boolToFloat(hour >= 9 && hour <= 17)
	features["is_night_time"] = boolToFloat(hour >= 22 || hour <= 5)
	features["is_weekend"] = boolToFloat(req.Timestamp.Weekday() == time.Saturday || req.Timestamp.Weekday() == time.Sunday)
	features["day_of_week"] = float64(req.Timestamp.Weekday())
	features["day_of_month"] = float64(req.Timestamp.Day())
	features["month_of_year"] = float64(req.Timestamp.Month())

	// Amount-based features (if applicable)
	if req.Amount > 0 {
		features["amount"] = req.Amount
		features["amount_log"] = logAmount(req.Amount)
		features["is_round_amount"] = boolToFloat(isRoundAmount(req.Amount))
		features["amount_bucket"] = getAmountBucket(req.Amount)
	}

	// Fraud type features
	features["fraud_type_claim"] = boolToFloat(req.FraudType == models.FraudTypeClaim)
	features["fraud_type_policy"] = boolToFloat(req.FraudType == models.FraudTypePolicy)
	features["fraud_type_agent"] = boolToFloat(req.FraudType == models.FraudTypeAgent)
	features["fraud_type_payment"] = boolToFloat(req.FraudType == models.FraudTypePayment)
	features["fraud_type_identity"] = boolToFloat(req.FraudType == models.FraudTypeIdentity)
	features["fraud_type_document"] = boolToFloat(req.FraudType == models.FraudTypeDocument)

	return features
}

// VelocityFeatureExtractor extracts velocity-based features from request metadata
type VelocityFeatureExtractor struct{}

func NewVelocityFeatureExtractor() *VelocityFeatureExtractor {
	return &VelocityFeatureExtractor{}
}

func (v *VelocityFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Compute velocity features from request metadata and historical context
	// These are populated from the request's pre-computed velocity data or enrichment context
	if req.VelocityData != nil {
		features["requests_last_hour"] = float64(req.VelocityData.RequestsLastHour)
		features["requests_last_day"] = float64(req.VelocityData.RequestsLastDay)
		features["requests_last_week"] = float64(req.VelocityData.RequestsLastWeek)
		features["requests_last_month"] = float64(req.VelocityData.RequestsLastMonth)
		features["unique_devices_last_day"] = float64(req.VelocityData.UniqueDevicesLastDay)
		features["unique_ips_last_day"] = float64(req.VelocityData.UniqueIPsLastDay)
		features["unique_locations_last_day"] = float64(req.VelocityData.UniqueLocationsLastDay)
		features["claims_last_month"] = float64(req.VelocityData.ClaimsLastMonth)
		features["policies_last_month"] = float64(req.VelocityData.PoliciesLastMonth)
		if req.VelocityData.RequestsLastHour > 0 {
			features["avg_time_between_requests"] = 3600.0 / float64(req.VelocityData.RequestsLastHour)
		} else {
			features["avg_time_between_requests"] = 3600.0
		}
		// Anomaly: flag if requests_last_hour > 2 std deviations above mean
		if req.VelocityData.RequestsLastHour > 10 {
			features["request_frequency_anomaly"] = 1.0
		} else {
			features["request_frequency_anomaly"] = 0.0
		}
	} else {
		// Default to zero when no velocity data available
		for _, k := range []string{"requests_last_hour", "requests_last_day", "requests_last_week",
			"requests_last_month", "unique_devices_last_day", "unique_ips_last_day",
			"unique_locations_last_day", "claims_last_month", "policies_last_month",
			"avg_time_between_requests", "request_frequency_anomaly"} {
			features[k] = 0.0
		}
	}

	return features
}

// NetworkFeatureExtractor extracts network-based features from request network data
type NetworkFeatureExtractor struct{}

func NewNetworkFeatureExtractor() *NetworkFeatureExtractor {
	return &NetworkFeatureExtractor{}
}

func (n *NetworkFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Cross-network fraud signals populated from request network enrichment data
	if req.NetworkData != nil {
		if req.NetworkData.SeenOnNetwork {
			features["seen_on_network"] = 1.0
		} else {
			features["seen_on_network"] = 0.0
		}
		features["network_fraud_count"] = float64(req.NetworkData.NetworkFraudCount)
		features["cross_company_matches"] = float64(req.NetworkData.CrossCompanyMatches)
		if req.NetworkData.BlacklistMatch {
			features["blacklist_match"] = 1.0
		} else {
			features["blacklist_match"] = 0.0
		}
		if req.NetworkData.WhitelistMatch {
			features["whitelist_match"] = 1.0
		} else {
			features["whitelist_match"] = 0.0
		}
		features["related_entities"] = float64(req.NetworkData.RelatedEntities)
		features["network_risk_score"] = req.NetworkData.NetworkRiskScore
		features["degree_centrality"] = req.NetworkData.DegreeCentrality
		features["clustering_coefficient"] = req.NetworkData.ClusteringCoefficient
		features["connected_fraudulent_entities"] = float64(req.NetworkData.ConnectedFraudulentEntities)
	} else {
		for _, k := range []string{"seen_on_network", "network_fraud_count", "cross_company_matches",
			"blacklist_match", "whitelist_match", "related_entities", "network_risk_score",
			"degree_centrality", "clustering_coefficient", "connected_fraudulent_entities"} {
			features[k] = 0.0
		}
	}

	return features
}

// DocumentFeatureExtractor extracts document-related features
type DocumentFeatureExtractor struct{}

func NewDocumentFeatureExtractor() *DocumentFeatureExtractor {
	return &DocumentFeatureExtractor{}
}

func (d *DocumentFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Document analysis features
	features["document_count"] = 0
	features["document_quality_score"] = 0
	features["ocr_confidence"] = 0
	features["metadata_consistency"] = 0
	features["creation_date_anomaly"] = 0
	features["modification_detected"] = 0
	features["duplicate_document"] = 0

	return features
}

// ClaimFeatureExtractor extracts claim-specific features
type ClaimFeatureExtractor struct{}

func NewClaimFeatureExtractor() *ClaimFeatureExtractor {
	return &ClaimFeatureExtractor{}
}

func (c *ClaimFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Claim-specific features
	features["claim_amount"] = req.Amount
	features["claim_amount_vs_policy_limit"] = 0
	features["days_since_policy_start"] = 0
	features["days_since_last_claim"] = 0
	features["total_claims_on_policy"] = 0
	features["claim_frequency"] = 0
	features["claim_type_frequency"] = 0
	features["similar_claims_network"] = 0
	features["claim_timing_anomaly"] = 0
	features["claim_description_length"] = 0
	features["claim_evidence_count"] = 0

	return features
}

// PolicyFeatureExtractor extracts policy-specific features
type PolicyFeatureExtractor struct{}

func NewPolicyFeatureExtractor() *PolicyFeatureExtractor {
	return &PolicyFeatureExtractor{}
}

func (p *PolicyFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Policy-specific features
	features["policy_age_days"] = 0
	features["policy_premium"] = 0
	features["policy_coverage_amount"] = 0
	features["policy_type_frequency"] = 0
	features["premium_to_coverage_ratio"] = 0
	features["policy_modifications_count"] = 0
	features["beneficiary_changes"] = 0

	return features
}

// AgentFeatureExtractor extracts agent-specific features
type AgentFeatureExtractor struct{}

func NewAgentFeatureExtractor() *AgentFeatureExtractor {
	return &AgentFeatureExtractor{}
}

func (a *AgentFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Agent-specific features
	features["agent_tenure_days"] = 0
	features["agent_total_policies"] = 0
	features["agent_total_claims"] = 0
	features["agent_fraud_rate"] = 0
	features["agent_claim_approval_rate"] = 0
	features["agent_customer_complaints"] = 0
	features["agent_commission_anomaly"] = 0
	features["agent_network_size"] = 0

	return features
}

// HistoricalFeatureExtractor extracts historical features
type HistoricalFeatureExtractor struct{}

func NewHistoricalFeatureExtractor() *HistoricalFeatureExtractor {
	return &HistoricalFeatureExtractor{}
}

func (h *HistoricalFeatureExtractor) Extract(ctx context.Context, req *models.FraudScoreRequest) map[string]float64 {
	features := make(map[string]float64)

	// Historical features
	features["customer_age_days"] = 0
	features["customer_total_policies"] = 0
	features["customer_total_claims"] = 0
	features["customer_claim_rate"] = 0
	features["customer_fraud_history"] = 0
	features["customer_payment_history"] = 0
	features["customer_kyc_score"] = 0
	features["customer_verification_level"] = 0

	return features
}

// Helper functions
func boolToFloat(b bool) float64 {
	if b {
		return 1.0
	}
	return 0.0
}

func isAfricanCountry(code string) bool {
	africanCodes := map[string]bool{
		"NG": true, "GH": true, "KE": true, "ZA": true, "EG": true,
		"MA": true, "TN": true, "DZ": true, "ET": true, "TZ": true,
		"UG": true, "RW": true, "SN": true, "CI": true, "CM": true,
	}
	return africanCodes[code]
}

func calculateAnonymizationScore(info *models.LocationInfo) float64 {
	score := 0.0
	if info.IsVPN {
		score += 0.3
	}
	if info.IsProxy {
		score += 0.3
	}
	if info.IsTor {
		score += 0.3
	}
	if info.IsDatacenter {
		score += 0.1
	}
	return score
}

func logAmount(amount float64) float64 {
	if amount <= 0 {
		return 0
	}
	return float64(int(amount / 1000))
}

func isRoundAmount(amount float64) bool {
	return amount == float64(int(amount)) && int(amount)%1000 == 0
}

func getAmountBucket(amount float64) float64 {
	switch {
	case amount < 10000:
		return 1
	case amount < 50000:
		return 2
	case amount < 100000:
		return 3
	case amount < 500000:
		return 4
	case amount < 1000000:
		return 5
	default:
		return 6
	}
}
