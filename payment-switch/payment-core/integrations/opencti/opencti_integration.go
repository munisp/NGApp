// Package opencti provides integration with OpenCTI threat intelligence platform
package opencti

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Config holds OpenCTI configuration
type Config struct {
	URL             string
	APIToken        string
	RefreshInterval time.Duration
	AutoEnforce     bool
	ThreatThreshold float64
	FraudServiceURL string
	GatewayURL      string
}

// Indicator represents a threat indicator (IOC)
type Indicator struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Pattern         string    `json:"pattern"`
	PatternType     string    `json:"pattern_type"`
	ValidFrom       time.Time `json:"valid_from"`
	ValidUntil      time.Time `json:"valid_until"`
	Score           int       `json:"x_opencti_score"`
	DetectionTypes  []string  `json:"x_opencti_detection"`
	MainObservable  string    `json:"x_opencti_main_observable_type"`
	Labels          []string  `json:"labels"`
	CreatedBy       string    `json:"created_by_ref"`
	ExternalRefs    []string  `json:"external_references"`
}

// Observable represents an observable entity
type Observable struct {
	ID              string                 `json:"id"`
	Type            string                 `json:"entity_type"`
	Value           string                 `json:"value"`
	Score           int                    `json:"x_opencti_score"`
	Description     string                 `json:"x_opencti_description"`
	Labels          []string               `json:"labels"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	Indicators      []string               `json:"indicators"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// ThreatActor represents a threat actor
type ThreatActor struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Aliases         []string `json:"aliases"`
	Goals           []string `json:"goals"`
	Sophistication  string   `json:"sophistication"`
	ResourceLevel   string   `json:"resource_level"`
	PrimaryMotivation string `json:"primary_motivation"`
	Labels          []string `json:"labels"`
}

// Campaign represents a threat campaign
type Campaign struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Objective   string    `json:"objective"`
	Labels      []string  `json:"labels"`
}

// MaliciousIP represents a malicious IP indicator
type MaliciousIP struct {
	IP          string    `json:"ip"`
	Score       int       `json:"score"`
	ThreatType  string    `json:"threat_type"`
	Country     string    `json:"country"`
	ASN         string    `json:"asn"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Campaigns   []string  `json:"campaigns"`
	IsBlocked   bool      `json:"is_blocked"`
}

// FraudIndicator represents fraud-related threat intelligence
type FraudIndicator struct {
	Type        string                 `json:"type"`
	Value       string                 `json:"value"`
	Score       float64                `json:"score"`
	Category    string                 `json:"category"`
	Source      string                 `json:"source"`
	Confidence  float64                `json:"confidence"`
	ValidUntil  time.Time              `json:"valid_until"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// Client provides OpenCTI integration
type Client struct {
	config     Config
	httpClient *http.Client
	mu         sync.RWMutex
	
	// Cached threat intelligence
	indicators      map[string]*Indicator
	maliciousIPs    map[string]*MaliciousIP
	fraudIndicators []FraudIndicator
	threatActors    map[string]*ThreatActor
	campaigns       map[string]*Campaign
	
	// Sync state
	lastSync        time.Time
	syncErrors      int
}

// NewClient creates a new OpenCTI client
func NewClient(config Config) *Client {
	if config.RefreshInterval == 0 {
		config.RefreshInterval = 15 * time.Minute
	}
	if config.ThreatThreshold == 0 {
		config.ThreatThreshold = 70.0
	}
	
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		indicators:      make(map[string]*Indicator),
		maliciousIPs:    make(map[string]*MaliciousIP),
		threatActors:    make(map[string]*ThreatActor),
		campaigns:       make(map[string]*Campaign),
	}
}

// Start begins the OpenCTI integration
func (c *Client) Start(ctx context.Context) error {
	// Initial sync
	if err := c.syncThreatIntelligence(ctx); err != nil {
		return fmt.Errorf("initial sync failed: %w", err)
	}
	
	// Start background sync
	go c.backgroundSync(ctx)
	
	return nil
}

// backgroundSync periodically syncs threat intelligence
func (c *Client) backgroundSync(ctx context.Context) {
	ticker := time.NewTicker(c.config.RefreshInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.syncThreatIntelligence(ctx); err != nil {
				c.mu.Lock()
				c.syncErrors++
				c.mu.Unlock()
				fmt.Printf("OpenCTI sync error: %v\n", err)
			}
		}
	}
}

// syncThreatIntelligence fetches latest threat intelligence
func (c *Client) syncThreatIntelligence(ctx context.Context) error {
	// Fetch indicators
	indicators, err := c.fetchIndicators(ctx)
	if err != nil {
		return fmt.Errorf("fetch indicators: %w", err)
	}
	
	// Fetch malicious IPs
	ips, err := c.fetchMaliciousIPs(ctx)
	if err != nil {
		return fmt.Errorf("fetch malicious IPs: %w", err)
	}
	
	// Fetch fraud indicators
	fraudIndicators, err := c.fetchFraudIndicators(ctx)
	if err != nil {
		return fmt.Errorf("fetch fraud indicators: %w", err)
	}
	
	// Update cache
	c.mu.Lock()
	c.indicators = make(map[string]*Indicator)
	for i := range indicators {
		c.indicators[indicators[i].ID] = &indicators[i]
	}
	
	c.maliciousIPs = make(map[string]*MaliciousIP)
	for i := range ips {
		c.maliciousIPs[ips[i].IP] = &ips[i]
	}
	
	c.fraudIndicators = fraudIndicators
	c.lastSync = time.Now()
	c.mu.Unlock()
	
	// Push to enforcement points if auto-enforce enabled
	if c.config.AutoEnforce {
		if err := c.pushToGateway(ctx, ips); err != nil {
			fmt.Printf("Failed to push to gateway: %v\n", err)
		}
		if err := c.pushToFraudService(ctx, fraudIndicators); err != nil {
			fmt.Printf("Failed to push to fraud service: %v\n", err)
		}
	}
	
	return nil
}

// fetchIndicators retrieves indicators from OpenCTI GraphQL API
func (c *Client) fetchIndicators(ctx context.Context) ([]Indicator, error) {
	query := `
		query GetIndicators($first: Int, $after: ID) {
			indicators(first: $first, after: $after, orderBy: created_at, orderMode: desc) {
				edges {
					node {
						id
						name
						description
						pattern
						pattern_type
						valid_from
						valid_until
						x_opencti_score
						x_opencti_detection
						x_opencti_main_observable_type
						objectLabel {
							edges {
								node {
									value
								}
							}
						}
					}
				}
				pageInfo {
					hasNextPage
					endCursor
				}
			}
		}
	`
	
	variables := map[string]interface{}{
		"first": 1000,
	}
	
	result, err := c.graphqlQuery(ctx, query, variables)
	if err != nil {
		return nil, err
	}
	
	// Parse response
	var indicators []Indicator
	if data, ok := result["data"].(map[string]interface{}); ok {
		if indicatorsData, ok := data["indicators"].(map[string]interface{}); ok {
			if edges, ok := indicatorsData["edges"].([]interface{}); ok {
				for _, edge := range edges {
					if edgeMap, ok := edge.(map[string]interface{}); ok {
						if node, ok := edgeMap["node"].(map[string]interface{}); ok {
							indicator := Indicator{
								ID:          getString(node, "id"),
								Name:        getString(node, "name"),
								Description: getString(node, "description"),
								Pattern:     getString(node, "pattern"),
								PatternType: getString(node, "pattern_type"),
								Score:       getInt(node, "x_opencti_score"),
							}
							indicators = append(indicators, indicator)
						}
					}
				}
			}
		}
	}
	
	return indicators, nil
}

// fetchMaliciousIPs retrieves malicious IP observables
func (c *Client) fetchMaliciousIPs(ctx context.Context) ([]MaliciousIP, error) {
	query := `
		query GetIPv4Addresses($first: Int) {
			stixCyberObservables(
				first: $first
				types: ["IPv4-Addr", "IPv6-Addr"]
				orderBy: x_opencti_score
				orderMode: desc
			) {
				edges {
					node {
						id
						entity_type
						observable_value
						x_opencti_score
						x_opencti_description
						objectLabel {
							edges {
								node {
									value
								}
							}
						}
					}
				}
			}
		}
	`
	
	variables := map[string]interface{}{
		"first": 5000,
	}
	
	result, err := c.graphqlQuery(ctx, query, variables)
	if err != nil {
		return nil, err
	}
	
	var ips []MaliciousIP
	if data, ok := result["data"].(map[string]interface{}); ok {
		if observables, ok := data["stixCyberObservables"].(map[string]interface{}); ok {
			if edges, ok := observables["edges"].([]interface{}); ok {
				for _, edge := range edges {
					if edgeMap, ok := edge.(map[string]interface{}); ok {
						if node, ok := edgeMap["node"].(map[string]interface{}); ok {
							score := getInt(node, "x_opencti_score")
							if score >= int(c.config.ThreatThreshold) {
								ip := MaliciousIP{
									IP:         getString(node, "observable_value"),
									Score:      score,
									ThreatType: getString(node, "x_opencti_description"),
									FirstSeen:  time.Now(),
									LastSeen:   time.Now(),
									IsBlocked:  score >= 80,
								}
								ips = append(ips, ip)
							}
						}
					}
				}
			}
		}
	}
	
	return ips, nil
}

// fetchFraudIndicators retrieves fraud-related indicators
func (c *Client) fetchFraudIndicators(ctx context.Context) ([]FraudIndicator, error) {
	query := `
		query GetFraudIndicators($first: Int) {
			indicators(
				first: $first
				filters: {
					mode: and
					filters: [
						{ key: "pattern_type", values: ["stix"] }
					]
					filterGroups: []
				}
				orderBy: x_opencti_score
				orderMode: desc
			) {
				edges {
					node {
						id
						name
						pattern
						x_opencti_score
						objectLabel {
							edges {
								node {
									value
								}
							}
						}
					}
				}
			}
		}
	`
	
	variables := map[string]interface{}{
		"first": 1000,
	}
	
	result, err := c.graphqlQuery(ctx, query, variables)
	if err != nil {
		return nil, err
	}
	
	var fraudIndicators []FraudIndicator
	if data, ok := result["data"].(map[string]interface{}); ok {
		if indicators, ok := data["indicators"].(map[string]interface{}); ok {
			if edges, ok := indicators["edges"].([]interface{}); ok {
				for _, edge := range edges {
					if edgeMap, ok := edge.(map[string]interface{}); ok {
						if node, ok := edgeMap["node"].(map[string]interface{}); ok {
							// Check if fraud-related by labels
							labels := getLabels(node)
							isFraud := false
							for _, label := range labels {
								if label == "fraud" || label == "financial-crime" || label == "payment-fraud" {
									isFraud = true
									break
								}
							}
							
							if isFraud {
								indicator := FraudIndicator{
									Type:       "indicator",
									Value:      getString(node, "pattern"),
									Score:      float64(getInt(node, "x_opencti_score")) / 100.0,
									Category:   "fraud",
									Source:     "opencti",
									Confidence: 0.8,
									ValidUntil: time.Now().Add(24 * time.Hour),
								}
								fraudIndicators = append(fraudIndicators, indicator)
							}
						}
					}
				}
			}
		}
	}
	
	return fraudIndicators, nil
}

// graphqlQuery executes a GraphQL query against OpenCTI
func (c *Client) graphqlQuery(ctx context.Context, query string, variables map[string]interface{}) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}
	
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.config.URL+"/graphql", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIToken)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GraphQL error: %s - %s", resp.Status, string(respBody))
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return result, nil
}

// pushToGateway pushes malicious IPs to the API gateway for blocking
func (c *Client) pushToGateway(ctx context.Context, ips []MaliciousIP) error {
	if c.config.GatewayURL == "" {
		return nil
	}
	
	// Filter high-confidence IPs for blocking
	var blockList []map[string]interface{}
	for _, ip := range ips {
		if ip.Score >= 80 {
			blockList = append(blockList, map[string]interface{}{
				"ip":          ip.IP,
				"score":       ip.Score,
				"threat_type": ip.ThreatType,
				"source":      "opencti",
				"expires_at":  time.Now().Add(24 * time.Hour),
			})
		}
	}
	
	if len(blockList) == 0 {
		return nil
	}
	
	payload := map[string]interface{}{
		"action":    "block",
		"source":    "opencti",
		"ip_list":   blockList,
		"timestamp": time.Now(),
	}
	
	body, _ := json.Marshal(payload)
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.GatewayURL+"/api/v1/security/ip-blocklist", bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("gateway update failed: %s", resp.Status)
	}
	
	return nil
}

// pushToFraudService pushes fraud indicators to the fraud detection service
func (c *Client) pushToFraudService(ctx context.Context, indicators []FraudIndicator) error {
	if c.config.FraudServiceURL == "" || len(indicators) == 0 {
		return nil
	}
	
	payload := map[string]interface{}{
		"source":     "opencti",
		"indicators": indicators,
		"timestamp":  time.Now(),
	}
	
	body, _ := json.Marshal(payload)
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.FraudServiceURL+"/api/v1/threat-intel/indicators", bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("fraud service update failed: %s", resp.Status)
	}
	
	return nil
}

// GetMaliciousIPs returns all cached malicious IPs
func (c *Client) GetMaliciousIPs() []MaliciousIP {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	var ips []MaliciousIP
	for _, ip := range c.maliciousIPs {
		ips = append(ips, *ip)
	}
	return ips
}

// GetFraudIndicators returns all cached fraud indicators
func (c *Client) GetFraudIndicators() []FraudIndicator {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fraudIndicators
}

// IsIPMalicious checks if an IP is in the threat intelligence
func (c *Client) IsIPMalicious(ip string) (bool, *MaliciousIP) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if malIP, exists := c.maliciousIPs[ip]; exists {
		return true, malIP
	}
	return false, nil
}

// GetThreatScore returns the threat score for an IP
func (c *Client) GetThreatScore(ip string) int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if malIP, exists := c.maliciousIPs[ip]; exists {
		return malIP.Score
	}
	return 0
}

// GetStats returns sync statistics
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return map[string]interface{}{
		"last_sync":        c.lastSync,
		"sync_errors":      c.syncErrors,
		"indicators_count": len(c.indicators),
		"malicious_ips":    len(c.maliciousIPs),
		"fraud_indicators": len(c.fraudIndicators),
		"threat_actors":    len(c.threatActors),
		"campaigns":        len(c.campaigns),
	}
}

// Helper functions
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	if v, ok := m[key].(int); ok {
		return v
	}
	return 0
}

func getLabels(node map[string]interface{}) []string {
	var labels []string
	if objectLabel, ok := node["objectLabel"].(map[string]interface{}); ok {
		if edges, ok := objectLabel["edges"].([]interface{}); ok {
			for _, edge := range edges {
				if edgeMap, ok := edge.(map[string]interface{}); ok {
					if labelNode, ok := edgeMap["node"].(map[string]interface{}); ok {
						if value, ok := labelNode["value"].(string); ok {
							labels = append(labels, value)
						}
					}
				}
			}
		}
	}
	return labels
}

// HealthCheck performs a health check on OpenCTI
func (c *Client) HealthCheck(ctx context.Context) error {
	query := `query { about { version } }`
	
	_, err := c.graphqlQuery(ctx, query, nil)
	return err
}
