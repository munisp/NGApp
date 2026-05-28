// Package opencti provides a client for the OpenCTI threat intelligence platform.
// OpenCTI is an open-source platform for managing cyber threat intelligence.
// Spec: IEC 62443 §21.2 — FetchOpenCTIData activity in IncidentTriageWorkflow.
//
// API: OpenCTI GraphQL API at /graphql
// Auth: Bearer token (OPENCTI_API_KEY env var)
package opencti

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Indicator represents a threat intelligence indicator from OpenCTI.
type Indicator struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Pattern     string    `json:"pattern"`
	PatternType string    `json:"pattern_type"` // stix, yara, sigma
	ValidFrom   time.Time `json:"valid_from"`
	ValidUntil  time.Time `json:"valid_until"`
	Score       int       `json:"x_opencti_score"` // 0-100 confidence score
	Labels      []string  `json:"labels"`
}

// ThreatActor represents a threat actor entity from OpenCTI.
type ThreatActor struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Aliases     []string `json:"aliases"`
	Sectors     []string `json:"sectors"` // e.g. ["Energy", "Oil & Gas"]
	Countries   []string `json:"countries"`
	Motivation  string   `json:"motivation"`
}

// IncidentContext bundles threat intelligence relevant to a security event.
type IncidentContext struct {
	MatchedIndicators []Indicator   `json:"matched_indicators"`
	ThreatActors      []ThreatActor `json:"threat_actors"`
	SeverityScore     int           `json:"severity_score"` // 0-100 composite
	TLPID             string        `json:"tlp_id"`         // TLP:RED, TLP:AMBER, etc.
	RecommendedAction string        `json:"recommended_action"`
}

// Client is the OpenCTI API client.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new OpenCTI client.
// baseURL: e.g. "http://opencti:8080"
// apiKey: OpenCTI API token
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// graphqlRequest executes a GraphQL query against the OpenCTI API.
func (c *Client) graphqlRequest(ctx context.Context, query string, variables map[string]any) (json.RawMessage, error) {
	body := map[string]any{
		"query":     query,
		"variables": variables,
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal graphql request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/graphql", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opencti request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opencti returned %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("opencti graphql error: %s", result.Errors[0].Message)
	}
	return result.Data, nil
}

// FetchIndicatorsForIP retrieves threat indicators matching a given IP address.
// Used in the IncidentTriageWorkflow to check if the source IP is known malicious.
func (c *Client) FetchIndicatorsForIP(ctx context.Context, ipAddress string) ([]Indicator, error) {
	query := `
		query IndicatorsForIP($search: String) {
			indicators(filters: {
				mode: and,
				filters: [{ key: "pattern", values: [$search] }],
				filterGroups: []
			}) {
				edges {
					node {
						id
						name
						pattern
						pattern_type
						valid_from
						valid_until
						x_opencti_score
						objectLabel { edges { node { value } } }
					}
				}
			}
		}
	`
	data, err := c.graphqlRequest(ctx, query, map[string]any{"search": ipAddress})
	if err != nil {
		return nil, err
	}

	var result struct {
		Indicators struct {
			Edges []struct {
				Node struct {
					ID          string    `json:"id"`
					Name        string    `json:"name"`
					Pattern     string    `json:"pattern"`
					PatternType string    `json:"pattern_type"`
					ValidFrom   time.Time `json:"valid_from"`
					ValidUntil  time.Time `json:"valid_until"`
					Score       int       `json:"x_opencti_score"`
					ObjectLabel struct {
						Edges []struct {
							Node struct{ Value string `json:"value"` } `json:"node"`
						} `json:"edges"`
					} `json:"objectLabel"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"indicators"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal indicators: %w", err)
	}

	indicators := make([]Indicator, 0, len(result.Indicators.Edges))
	for _, edge := range result.Indicators.Edges {
		n := edge.Node
		labels := make([]string, 0, len(n.ObjectLabel.Edges))
		for _, l := range n.ObjectLabel.Edges {
			labels = append(labels, l.Node.Value)
		}
		indicators = append(indicators, Indicator{
			ID:          n.ID,
			Name:        n.Name,
			Pattern:     n.Pattern,
			PatternType: n.PatternType,
			ValidFrom:   n.ValidFrom,
			ValidUntil:  n.ValidUntil,
			Score:       n.Score,
			Labels:      labels,
		})
	}
	return indicators, nil
}

// FetchThreatActorsBySector retrieves threat actors targeting the energy/oil-gas sector.
// Used to enrich incident context with attribution information.
func (c *Client) FetchThreatActorsBySector(ctx context.Context, sector string) ([]ThreatActor, error) {
	query := `
		query ThreatActorsBySector($sector: String) {
			threatActors(filters: {
				mode: and,
				filters: [{ key: "sectors", values: [$sector] }],
				filterGroups: []
			}) {
				edges {
					node {
						id
						name
						description
						aliases
						x_opencti_motivation
					}
				}
			}
		}
	`
	data, err := c.graphqlRequest(ctx, query, map[string]any{"sector": sector})
	if err != nil {
		return nil, err
	}

	var result struct {
		ThreatActors struct {
			Edges []struct {
				Node struct {
					ID          string   `json:"id"`
					Name        string   `json:"name"`
					Description string   `json:"description"`
					Aliases     []string `json:"aliases"`
					Motivation  string   `json:"x_opencti_motivation"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"threatActors"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal threat actors: %w", err)
	}

	actors := make([]ThreatActor, 0, len(result.ThreatActors.Edges))
	for _, edge := range result.ThreatActors.Edges {
		n := edge.Node
		actors = append(actors, ThreatActor{
			ID:          n.ID,
			Name:        n.Name,
			Description: n.Description,
			Aliases:     n.Aliases,
			Motivation:  n.Motivation,
			Sectors:     []string{sector},
		})
	}
	return actors, nil
}

// BuildIncidentContext constructs a full IncidentContext for a security event.
// This is the main entry point called by the FetchOpenCTIData Temporal activity.
func (c *Client) BuildIncidentContext(ctx context.Context, sourceIP, eventType string) (*IncidentContext, error) {
	indicators, err := c.FetchIndicatorsForIP(ctx, sourceIP)
	if err != nil {
		// Non-fatal: continue with empty indicators if OpenCTI is unreachable
		indicators = []Indicator{}
	}

	actors, err := c.FetchThreatActorsBySector(ctx, "Energy")
	if err != nil {
		actors = []ThreatActor{}
	}

	// Compute composite severity score
	score := 0
	for _, ind := range indicators {
		if ind.Score > score {
			score = ind.Score
		}
	}

	// Determine TLP classification based on score
	tlp := "TLP:WHITE"
	switch {
	case score >= 80:
		tlp = "TLP:RED"
	case score >= 60:
		tlp = "TLP:AMBER"
	case score >= 40:
		tlp = "TLP:GREEN"
	}

	// Determine recommended action
	action := "Monitor and log"
	switch {
	case score >= 80:
		action = "Immediate isolation required — critical threat actor activity detected"
	case score >= 60:
		action = "Isolate affected node and escalate to SOC — high-confidence indicator match"
	case score >= 40:
		action = "Increase monitoring frequency and alert SOC — moderate threat indicator"
	}

	return &IncidentContext{
		MatchedIndicators: indicators,
		ThreatActors:      actors,
		SeverityScore:     score,
		TLPID:             tlp,
		RecommendedAction: action,
	}, nil
}
