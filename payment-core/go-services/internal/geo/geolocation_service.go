package geo

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type GeolocationData struct {
	IP        string `json:"ip"`
	Country   string `json:"country"`
	City      string `json:"city"`
	Region    string `json:"region"`
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
}

type cachedGeo struct {
	data      *GeolocationData
	timestamp time.Time
}

type GeolocationService struct {
	mu         sync.RWMutex
	cache      map[string]*cachedGeo
	cacheTTL   time.Duration
	httpClient *http.Client
	apiURL     string
}

func NewGeolocationService() *GeolocationService {
	return &GeolocationService{
		cache:    make(map[string]*cachedGeo),
		cacheTTL: 24 * time.Hour,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		apiURL: "https://ipapi.co",
	}
}

func (s *GeolocationService) SetCacheTTL(ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cacheTTL = ttl
}

func (s *GeolocationService) SetAPIURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.apiURL = url
}

func (s *GeolocationService) GetGeolocation(ipAddress string) (*GeolocationData, error) {
	if ipAddress == "" || ipAddress == "127.0.0.1" || ipAddress == "::1" || ipAddress == "localhost" {
		return &GeolocationData{
			IP:        ipAddress,
			Country:   "Local",
			City:      "Local",
			Region:    "Local",
			Latitude:  "0",
			Longitude: "0",
		}, nil
	}

	s.mu.RLock()
	cached, exists := s.cache[ipAddress]
	s.mu.RUnlock()

	if exists && time.Since(cached.timestamp) < s.cacheTTL {
		return cached.data, nil
	}

	s.mu.RLock()
	apiURL := s.apiURL
	s.mu.RUnlock()

	url := fmt.Sprintf("%s/%s/json/", apiURL, ipAddress)
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch geolocation: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geolocation API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var apiResponse struct {
		IP          string  `json:"ip"`
		CountryName string  `json:"country_name"`
		City        string  `json:"city"`
		Region      string  `json:"region"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	geoData := &GeolocationData{
		IP:        ipAddress,
		Country:   apiResponse.CountryName,
		City:      apiResponse.City,
		Region:    apiResponse.Region,
		Latitude:  fmt.Sprintf("%f", apiResponse.Latitude),
		Longitude: fmt.Sprintf("%f", apiResponse.Longitude),
	}

	if geoData.Country == "" {
		geoData.Country = "Unknown"
	}
	if geoData.City == "" {
		geoData.City = "Unknown"
	}
	if geoData.Region == "" {
		geoData.Region = "Unknown"
	}

	s.mu.Lock()
	s.cache[ipAddress] = &cachedGeo{
		data:      geoData,
		timestamp: time.Now(),
	}
	s.mu.Unlock()

	return geoData, nil
}

func (s *GeolocationService) IsSignificantLocationChange(loc1, loc2 *GeolocationData) bool {
	if loc1 == nil || loc2 == nil {
		return false
	}

	if loc1.Country == "Unknown" || loc2.Country == "Unknown" {
		return false
	}

	return loc1.Country != loc2.Country
}

func (s *GeolocationService) ClearCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache = make(map[string]*cachedGeo)
}

func (s *GeolocationService) GetCacheSize() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.cache)
}

func (s *GeolocationService) CleanupExpiredCache() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	now := time.Now()

	for ip, cached := range s.cache {
		if now.Sub(cached.timestamp) > s.cacheTTL {
			delete(s.cache, ip)
			count++
		}
	}

	return count
}

func (s *GeolocationService) GetCachedGeolocation(ipAddress string) (*GeolocationData, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cached, exists := s.cache[ipAddress]
	if !exists {
		return nil, false
	}

	if time.Since(cached.timestamp) > s.cacheTTL {
		return nil, false
	}

	return cached.data, true
}

func (s *GeolocationService) IsSameCity(loc1, loc2 *GeolocationData) bool {
	if loc1 == nil || loc2 == nil {
		return false
	}
	return loc1.City == loc2.City && loc1.Country == loc2.Country
}

func (s *GeolocationService) IsSameRegion(loc1, loc2 *GeolocationData) bool {
	if loc1 == nil || loc2 == nil {
		return false
	}
	return loc1.Region == loc2.Region && loc1.Country == loc2.Country
}

func (s *GeolocationService) IsSameCountry(loc1, loc2 *GeolocationData) bool {
	if loc1 == nil || loc2 == nil {
		return false
	}
	return loc1.Country == loc2.Country
}

func (s *GeolocationService) GetLocationString(geo *GeolocationData) string {
	if geo == nil {
		return "Unknown"
	}

	if geo.City != "Unknown" && geo.Country != "Unknown" {
		return fmt.Sprintf("%s, %s", geo.City, geo.Country)
	}

	if geo.Country != "Unknown" {
		return geo.Country
	}

	return "Unknown"
}
