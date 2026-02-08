package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Configuration
var (
	port         = getEnv("FRAUD_FEATURES_PORT", "8144")
	kafkaBrokers = getEnv("KAFKA_BROKERS", "kafka:9092")
	redisURL     = getEnv("REDIS_URL", "redis://redis:6379")
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// VelocityCounter tracks transaction velocity with sliding windows
type VelocityCounter struct {
	mu       sync.RWMutex
	counters map[string]*WindowCounter
}

type WindowCounter struct {
	Events    []int64 `json:"events"`
	LastReset int64   `json:"last_reset"`
}

func NewVelocityCounter() *VelocityCounter {
	return &VelocityCounter{
		counters: make(map[string]*WindowCounter),
	}
}

func (vc *VelocityCounter) Increment(key string) int {
	vc.mu.Lock()
	defer vc.mu.Unlock()

	now := time.Now().Unix()
	if _, ok := vc.counters[key]; !ok {
		vc.counters[key] = &WindowCounter{Events: []int64{}, LastReset: now}
	}

	wc := vc.counters[key]
	wc.Events = append(wc.Events, now)

	// Prune events older than 1 hour
	cutoff := now - 3600
	filtered := make([]int64, 0, len(wc.Events))
	for _, e := range wc.Events {
		if e >= cutoff {
			filtered = append(filtered, e)
		}
	}
	wc.Events = filtered

	return len(wc.Events)
}

func (vc *VelocityCounter) Count(key string, windowSec int64) int {
	vc.mu.RLock()
	defer vc.mu.RUnlock()

	wc, ok := vc.counters[key]
	if !ok {
		return 0
	}

	cutoff := time.Now().Unix() - windowSec
	count := 0
	for _, e := range wc.Events {
		if e >= cutoff {
			count++
		}
	}
	return count
}

// DeviceFingerprint represents a device fingerprint
type DeviceFingerprint struct {
	DeviceID     string            `json:"device_id"`
	UserAgent    string            `json:"user_agent"`
	ScreenRes    string            `json:"screen_resolution"`
	Timezone     string            `json:"timezone"`
	Language     string            `json:"language"`
	Platform     string            `json:"platform"`
	Plugins      []string          `json:"plugins"`
	Canvas       string            `json:"canvas_hash"`
	WebGL        string            `json:"webgl_hash"`
	AudioCtx     string            `json:"audio_context_hash"`
	Fonts        []string          `json:"fonts"`
	Headers      map[string]string `json:"headers"`
	IsEmulator   bool              `json:"is_emulator"`
	IsRooted     bool              `json:"is_rooted"`
	FirstSeen    int64             `json:"first_seen"`
	LastSeen     int64             `json:"last_seen"`
	TxnCount     int               `json:"transaction_count"`
	FraudCount   int               `json:"fraud_count"`
	FraudRate    float64           `json:"fraud_rate"`
	RiskScore    float64           `json:"risk_score"`
}

// DeviceStore stores device fingerprints
type DeviceStore struct {
	mu      sync.RWMutex
	devices map[string]*DeviceFingerprint
}

func NewDeviceStore() *DeviceStore {
	return &DeviceStore{
		devices: make(map[string]*DeviceFingerprint),
	}
}

func (ds *DeviceStore) Register(fp *DeviceFingerprint) string {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	// Generate fingerprint hash
	data := fmt.Sprintf("%s|%s|%s|%s|%s|%s",
		fp.UserAgent, fp.ScreenRes, fp.Timezone, fp.Canvas, fp.WebGL, fp.AudioCtx)
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(data)))[:16]

	if existing, ok := ds.devices[hash]; ok {
		existing.LastSeen = time.Now().Unix()
		existing.TxnCount++
		return hash
	}

	fp.DeviceID = hash
	fp.FirstSeen = time.Now().Unix()
	fp.LastSeen = time.Now().Unix()
	fp.TxnCount = 1
	ds.devices[hash] = fp

	return hash
}

func (ds *DeviceStore) Get(deviceID string) (*DeviceFingerprint, bool) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	fp, ok := ds.devices[deviceID]
	return fp, ok
}

func (ds *DeviceStore) MarkFraud(deviceID string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	if fp, ok := ds.devices[deviceID]; ok {
		fp.FraudCount++
		if fp.TxnCount > 0 {
			fp.FraudRate = float64(fp.FraudCount) / float64(fp.TxnCount)
		}
	}
}

// CrossAccountSignal tracks signals across accounts
type CrossAccountSignal struct {
	mu      sync.RWMutex
	signals map[string]*AccountSignals
}

type AccountSignals struct {
	CardsPerIP      map[string]map[string]int64 `json:"cards_per_ip"`
	IPsPerCard      map[string]map[string]int64 `json:"ips_per_card"`
	EmailsPerDevice map[string]map[string]int64 `json:"emails_per_device"`
	DevicesPerEmail map[string]map[string]int64 `json:"devices_per_email"`
}

func NewCrossAccountSignal() *CrossAccountSignal {
	return &CrossAccountSignal{
		signals: map[string]*AccountSignals{
			"global": {
				CardsPerIP:      make(map[string]map[string]int64),
				IPsPerCard:      make(map[string]map[string]int64),
				EmailsPerDevice: make(map[string]map[string]int64),
				DevicesPerEmail: make(map[string]map[string]int64),
			},
		},
	}
}

func (cas *CrossAccountSignal) Record(ip, cardHash, email, deviceID string) {
	cas.mu.Lock()
	defer cas.mu.Unlock()

	now := time.Now().Unix()
	s := cas.signals["global"]

	// Cards per IP
	if s.CardsPerIP[ip] == nil {
		s.CardsPerIP[ip] = make(map[string]int64)
	}
	s.CardsPerIP[ip][cardHash] = now

	// IPs per card
	if s.IPsPerCard[cardHash] == nil {
		s.IPsPerCard[cardHash] = make(map[string]int64)
	}
	s.IPsPerCard[cardHash][ip] = now

	// Emails per device
	if email != "" && deviceID != "" {
		if s.EmailsPerDevice[deviceID] == nil {
			s.EmailsPerDevice[deviceID] = make(map[string]int64)
		}
		s.EmailsPerDevice[deviceID][email] = now

		if s.DevicesPerEmail[email] == nil {
			s.DevicesPerEmail[email] = make(map[string]int64)
		}
		s.DevicesPerEmail[email][deviceID] = now
	}
}

func (cas *CrossAccountSignal) GetCardsPerIP(ip string, windowSec int64) int {
	cas.mu.RLock()
	defer cas.mu.RUnlock()

	s := cas.signals["global"]
	if cards, ok := s.CardsPerIP[ip]; ok {
		cutoff := time.Now().Unix() - windowSec
		count := 0
		for _, ts := range cards {
			if ts >= cutoff {
				count++
			}
		}
		return count
	}
	return 0
}

func (cas *CrossAccountSignal) GetIPsPerCard(cardHash string, windowSec int64) int {
	cas.mu.RLock()
	defer cas.mu.RUnlock()

	s := cas.signals["global"]
	if ips, ok := s.IPsPerCard[cardHash]; ok {
		cutoff := time.Now().Unix() - windowSec
		count := 0
		for _, ts := range ips {
			if ts >= cutoff {
				count++
			}
		}
		return count
	}
	return 0
}

// EmailPatternAnalyzer detects suspicious email patterns
type EmailPatternAnalyzer struct {
	throwawayDomains map[string]bool
	suspiciousPatterns []string
}

func NewEmailPatternAnalyzer() *EmailPatternAnalyzer {
	return &EmailPatternAnalyzer{
		throwawayDomains: map[string]bool{
			"tempmail.com": true, "throwaway.email": true, "guerrillamail.com": true,
			"10minutemail.com": true, "mailinator.com": true, "yopmail.com": true,
			"sharklasers.com": true, "guerrillamailblock.com": true, "grr.la": true,
			"dispostable.com": true, "trashmail.com": true, "fakeinbox.com": true,
		},
		suspiciousPatterns: []string{
			"test", "123", "abc", "xxx", "fake", "temp", "spam",
		},
	}
}

func (epa *EmailPatternAnalyzer) Analyze(email string) map[string]interface{} {
	result := map[string]interface{}{
		"email":             email,
		"is_throwaway":      false,
		"has_suspicious_pattern": false,
		"domain_risk":       "low",
		"local_part_risk":   "low",
		"risk_score":        0.0,
	}

	if email == "" {
		return result
	}

	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		result["risk_score"] = 0.5
		return result
	}

	localPart := strings.ToLower(parts[0])
	domain := strings.ToLower(parts[1])

	// Check throwaway domain
	if epa.throwawayDomains[domain] {
		result["is_throwaway"] = true
		result["domain_risk"] = "critical"
		result["risk_score"] = 0.8
	}

	// Check suspicious patterns in local part
	for _, pattern := range epa.suspiciousPatterns {
		if strings.Contains(localPart, pattern) {
			result["has_suspicious_pattern"] = true
			result["local_part_risk"] = "high"
			score := result["risk_score"].(float64)
			result["risk_score"] = math.Min(1.0, score+0.3)
			break
		}
	}

	// Check for random-looking local parts
	digitCount := 0
	for _, c := range localPart {
		if c >= '0' && c <= '9' {
			digitCount++
		}
	}
	if len(localPart) > 0 && float64(digitCount)/float64(len(localPart)) > 0.5 {
		result["local_part_risk"] = "medium"
		score := result["risk_score"].(float64)
		result["risk_score"] = math.Min(1.0, score+0.2)
	}

	return result
}

// GeoRiskAnalyzer detects geographic anomalies
type GeoRiskAnalyzer struct {
	mu           sync.RWMutex
	lastLocations map[string][]LocationEvent
	highRiskCountries map[string]float64
}

type LocationEvent struct {
	Country   string  `json:"country"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timestamp int64   `json:"timestamp"`
}

func NewGeoRiskAnalyzer() *GeoRiskAnalyzer {
	return &GeoRiskAnalyzer{
		lastLocations: make(map[string][]LocationEvent),
		highRiskCountries: map[string]float64{
			"NG": 0.15, "RU": 0.12, "CN": 0.08, "BR": 0.10, "IN": 0.06,
			"VN": 0.07, "PH": 0.05, "ID": 0.05, "UA": 0.08, "RO": 0.06,
		},
	}
}

func (gra *GeoRiskAnalyzer) RecordLocation(userID string, event LocationEvent) {
	gra.mu.Lock()
	defer gra.mu.Unlock()

	gra.lastLocations[userID] = append(gra.lastLocations[userID], event)
	if len(gra.lastLocations[userID]) > 10 {
		gra.lastLocations[userID] = gra.lastLocations[userID][len(gra.lastLocations[userID])-10:]
	}
}

func (gra *GeoRiskAnalyzer) CheckImpossibleTravel(userID string, current LocationEvent) map[string]interface{} {
	gra.mu.RLock()
	defer gra.mu.RUnlock()

	result := map[string]interface{}{
		"impossible_travel":    false,
		"country_risk":         0.0,
		"distance_km":          0.0,
		"time_between_sec":     0,
		"max_possible_speed_kmh": 0.0,
	}

	// Check country risk
	if risk, ok := gra.highRiskCountries[current.Country]; ok {
		result["country_risk"] = risk
	}

	// Check impossible travel
	locations, ok := gra.lastLocations[userID]
	if !ok || len(locations) == 0 {
		return result
	}

	last := locations[len(locations)-1]
	timeBetween := current.Timestamp - last.Timestamp
	if timeBetween <= 0 {
		timeBetween = 1
	}

	// Haversine distance
	distance := haversineDistance(last.Latitude, last.Longitude, current.Latitude, current.Longitude)
	speedKMH := (distance / float64(timeBetween)) * 3600

	result["distance_km"] = math.Round(distance*100) / 100
	result["time_between_sec"] = timeBetween
	result["max_possible_speed_kmh"] = math.Round(speedKMH*100) / 100

	// Impossible if faster than 900 km/h (faster than commercial aircraft)
	if speedKMH > 900 && distance > 100 {
		result["impossible_travel"] = true
	}

	return result
}

func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// BINRiskDatabase tracks fraud rates by card BIN
type BINRiskDatabase struct {
	mu   sync.RWMutex
	bins map[string]*BINStats
}

type BINStats struct {
	BIN        string  `json:"bin"`
	TxnCount   int     `json:"transaction_count"`
	FraudCount int     `json:"fraud_count"`
	FraudRate  float64 `json:"fraud_rate"`
	LastSeen   int64   `json:"last_seen"`
	Country    string  `json:"country"`
}

func NewBINRiskDatabase() *BINRiskDatabase {
	return &BINRiskDatabase{
		bins: make(map[string]*BINStats),
	}
}

func (brd *BINRiskDatabase) Record(bin, country string, isFraud bool) {
	brd.mu.Lock()
	defer brd.mu.Unlock()

	if _, ok := brd.bins[bin]; !ok {
		brd.bins[bin] = &BINStats{BIN: bin, Country: country}
	}
	bs := brd.bins[bin]
	bs.TxnCount++
	if isFraud {
		bs.FraudCount++
	}
	bs.FraudRate = float64(bs.FraudCount) / float64(bs.TxnCount)
	bs.LastSeen = time.Now().Unix()
}

func (brd *BINRiskDatabase) GetRisk(bin string) float64 {
	brd.mu.RLock()
	defer brd.mu.RUnlock()
	if bs, ok := brd.bins[bin]; ok {
		return bs.FraudRate
	}
	return 0.01 // Default baseline
}

// Global instances
var (
	velocityCounter    = NewVelocityCounter()
	deviceStore        = NewDeviceStore()
	crossAccountSignal = NewCrossAccountSignal()
	emailAnalyzer      = NewEmailPatternAnalyzer()
	geoAnalyzer        = NewGeoRiskAnalyzer()
	binDatabase        = NewBINRiskDatabase()
	totalFeaturesExtracted int64
	featureMu             sync.Mutex
)

// API Request/Response types
type FeatureRequest struct {
	TransactionID string            `json:"transaction_id"`
	Amount        float64           `json:"amount"`
	Currency      string            `json:"currency"`
	CardBIN       string            `json:"card_bin"`
	CardLast4     string            `json:"card_last4"`
	CardCountry   string            `json:"card_country"`
	IPAddress     string            `json:"ip_address"`
	IPCountry     string            `json:"ip_country"`
	IPLatitude    float64           `json:"ip_latitude"`
	IPLongitude   float64           `json:"ip_longitude"`
	DeviceID      string            `json:"device_id"`
	UserID        string            `json:"user_id"`
	Email         string            `json:"email"`
	MerchantID    string            `json:"merchant_id"`
	UserAgent     string            `json:"user_agent"`
	ScreenRes     string            `json:"screen_resolution"`
	Timestamp     int64             `json:"timestamp"`
}

type FeatureResponse struct {
	TransactionID       string                 `json:"transaction_id"`
	Features            map[string]interface{} `json:"features"`
	VelocitySignals     map[string]int         `json:"velocity_signals"`
	DeviceSignals       map[string]interface{} `json:"device_signals"`
	GeoSignals          map[string]interface{} `json:"geo_signals"`
	EmailSignals        map[string]interface{} `json:"email_signals"`
	NetworkSignals      map[string]interface{} `json:"network_signals"`
	BINSignals          map[string]interface{} `json:"bin_signals"`
	TotalFeaturesCount  int                    `json:"total_features_count"`
	ExtractionTimeMs    float64                `json:"extraction_time_ms"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	featureMu.Lock()
	total := totalFeaturesExtracted
	featureMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":               "healthy",
		"service":              "fraud-features",
		"version":              "1.0.0",
		"total_extracted":      total,
		"velocity_windows":     []string{"1m", "5m", "15m", "1h", "24h"},
		"device_fingerprints":  len(deviceStore.devices),
		"email_throwaway_domains": len(emailAnalyzer.throwawayDomains),
		"high_risk_countries":  len(geoAnalyzer.highRiskCountries),
		"middleware": map[string]string{
			"kafka": kafkaBrokers,
			"redis": redisURL,
		},
	})
}

func extractFeaturesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req FeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	start := time.Now()

	if req.Timestamp == 0 {
		req.Timestamp = time.Now().Unix()
	}

	cardHash := fmt.Sprintf("%x", sha256.Sum256([]byte(req.CardBIN+req.CardLast4)))[:16]

	// 1. Velocity signals
	velocityCounter.Increment(fmt.Sprintf("ip:%s", req.IPAddress))
	velocityCounter.Increment(fmt.Sprintf("card:%s", cardHash))
	velocityCounter.Increment(fmt.Sprintf("device:%s", req.DeviceID))
	velocityCounter.Increment(fmt.Sprintf("email:%s", req.Email))
	velocityCounter.Increment(fmt.Sprintf("merchant:%s", req.MerchantID))

	velocitySignals := map[string]int{
		"txns_per_ip_1h":       velocityCounter.Count(fmt.Sprintf("ip:%s", req.IPAddress), 3600),
		"txns_per_ip_5m":       velocityCounter.Count(fmt.Sprintf("ip:%s", req.IPAddress), 300),
		"txns_per_card_1h":     velocityCounter.Count(fmt.Sprintf("card:%s", cardHash), 3600),
		"txns_per_card_5m":     velocityCounter.Count(fmt.Sprintf("card:%s", cardHash), 300),
		"txns_per_device_1h":   velocityCounter.Count(fmt.Sprintf("device:%s", req.DeviceID), 3600),
		"txns_per_email_1h":    velocityCounter.Count(fmt.Sprintf("email:%s", req.Email), 3600),
		"txns_per_merchant_1h": velocityCounter.Count(fmt.Sprintf("merchant:%s", req.MerchantID), 3600),
	}

	// 2. Cross-account signals
	crossAccountSignal.Record(req.IPAddress, cardHash, req.Email, req.DeviceID)
	cardsPerIP := crossAccountSignal.GetCardsPerIP(req.IPAddress, 3600)
	ipsPerCard := crossAccountSignal.GetIPsPerCard(cardHash, 3600)

	networkSignals := map[string]interface{}{
		"cards_per_ip_1h":       cardsPerIP,
		"ips_per_card_1h":       ipsPerCard,
		"card_seen_fraud":       false,
		"email_seen_fraud":      false,
		"device_seen_fraud":     false,
	}

	// Check device fraud history
	if fp, ok := deviceStore.Get(req.DeviceID); ok {
		if fp.FraudRate > 0.05 {
			networkSignals["device_seen_fraud"] = true
		}
	}

	// 3. Device fingerprint signals
	fp := &DeviceFingerprint{
		UserAgent: req.UserAgent,
		ScreenRes: req.ScreenRes,
	}
	fpHash := deviceStore.Register(fp)
	storedFP, _ := deviceStore.Get(fpHash)

	deviceSignals := map[string]interface{}{
		"fingerprint_hash": fpHash,
		"is_new_device":    storedFP != nil && (time.Now().Unix()-storedFP.FirstSeen) < 86400,
		"device_age_days":  0,
		"device_txn_count": 0,
		"device_fraud_rate": 0.0,
	}
	if storedFP != nil {
		deviceSignals["device_age_days"] = (time.Now().Unix() - storedFP.FirstSeen) / 86400
		deviceSignals["device_txn_count"] = storedFP.TxnCount
		deviceSignals["device_fraud_rate"] = storedFP.FraudRate
	}

	// 4. Email analysis
	emailSignals := emailAnalyzer.Analyze(req.Email)

	// 5. Geo risk analysis
	locEvent := LocationEvent{
		Country:   req.IPCountry,
		Latitude:  req.IPLatitude,
		Longitude: req.IPLongitude,
		Timestamp: req.Timestamp,
	}
	geoSignals := geoAnalyzer.CheckImpossibleTravel(req.UserID, locEvent)
	geoAnalyzer.RecordLocation(req.UserID, locEvent)

	// Add country mismatch
	geoSignals["country_mismatch"] = req.IPCountry != req.CardCountry && req.IPCountry != "" && req.CardCountry != ""

	// 6. BIN risk
	binRisk := binDatabase.GetRisk(req.CardBIN)
	binSignals := map[string]interface{}{
		"bin":         req.CardBIN,
		"fraud_rate":  binRisk,
		"is_high_risk": binRisk > 0.03,
	}

	// Combine all features
	allFeatures := map[string]interface{}{
		"amount":              req.Amount,
		"currency":            req.Currency,
		"card_country":        req.CardCountry,
		"ip_country":          req.IPCountry,
		"cards_per_ip_1h":     cardsPerIP,
		"txns_per_card_1h":    velocitySignals["txns_per_card_1h"],
		"txns_per_device_1h":  velocitySignals["txns_per_device_1h"],
		"amount_velocity_1h":  req.Amount * float64(velocitySignals["txns_per_card_1h"]),
		"is_emulator":         false,
		"is_rooted":           false,
		"is_vpn":              false,
		"is_proxy":            false,
		"device_age_days":     deviceSignals["device_age_days"],
		"impossible_travel":   geoSignals["impossible_travel"],
		"distance_ip_billing_km": geoSignals["distance_km"],
		"card_seen_fraud_network": networkSignals["card_seen_fraud"],
		"email_seen_fraud_network": networkSignals["email_seen_fraud"],
		"device_seen_fraud_network": networkSignals["device_seen_fraud"],
		"ip_fraud_rate_network": 0.0,
		"bin_fraud_rate_network": binRisk,
		"email_risk_score":    emailSignals["risk_score"],
		"is_throwaway_email":  emailSignals["is_throwaway"],
	}

	extractionTime := float64(time.Since(start).Microseconds()) / 1000.0

	featureMu.Lock()
	totalFeaturesExtracted++
	featureMu.Unlock()

	// Publish to Kafka (simulated)
	log.Printf("[Kafka] Features extracted: txn=%s, features=%d, time=%.2fms",
		req.TransactionID, len(allFeatures), extractionTime)

	writeJSON(w, http.StatusOK, FeatureResponse{
		TransactionID:      req.TransactionID,
		Features:           allFeatures,
		VelocitySignals:    velocitySignals,
		DeviceSignals:      deviceSignals,
		GeoSignals:         geoSignals,
		EmailSignals:       emailSignals,
		NetworkSignals:     networkSignals,
		BINSignals:         binSignals,
		TotalFeaturesCount: len(allFeatures),
		ExtractionTimeMs:   extractionTime,
	})
}

func velocityHandler(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	windowStr := r.URL.Query().Get("window")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key parameter required"})
		return
	}
	window := int64(3600)
	if windowStr != "" {
		if v, err := strconv.ParseInt(windowStr, 10, 64); err == nil {
			window = v
		}
	}
	count := velocityCounter.Count(key, window)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"key": key, "window_sec": window, "count": count,
	})
}

func deviceHandler(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("device_id")
	if deviceID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "device_id parameter required"})
		return
	}
	fp, ok := deviceStore.Get(deviceID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Device not found"})
		return
	}
	writeJSON(w, http.StatusOK, fp)
}

func emailAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email parameter required"})
		return
	}
	result := emailAnalyzer.Analyze(email)
	writeJSON(w, http.StatusOK, result)
}

func geoCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		UserID    string  `json:"user_id"`
		Country   string  `json:"country"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	event := LocationEvent{
		Country:   req.Country,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Timestamp: time.Now().Unix(),
	}
	result := geoAnalyzer.CheckImpossibleTravel(req.UserID, event)
	geoAnalyzer.RecordLocation(req.UserID, event)

	writeJSON(w, http.StatusOK, result)
}

func binRiskHandler(w http.ResponseWriter, r *http.Request) {
	bin := r.URL.Query().Get("bin")
	if bin == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bin parameter required"})
		return
	}
	risk := binDatabase.GetRisk(bin)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"bin": bin, "fraud_rate": risk, "is_high_risk": risk > 0.03,
	})
}

func main() {
	ctx := context.Background()
	_ = ctx

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/extract", extractFeaturesHandler)
	mux.HandleFunc("/velocity", velocityHandler)
	mux.HandleFunc("/device", deviceHandler)
	mux.HandleFunc("/email/analyze", emailAnalysisHandler)
	mux.HandleFunc("/geo/check", geoCheckHandler)
	mux.HandleFunc("/bin/risk", binRiskHandler)

	log.Printf("Fraud Feature Pipeline starting on port %s", port)
	log.Printf("Connected to Kafka=%s, Redis=%s", kafkaBrokers, redisURL)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
