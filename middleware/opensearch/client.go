package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a real OpenSearch client.
type Client struct {
	baseURL  string
	username string
	password string
	http     *http.Client
}

// NewClient creates an OpenSearch client from environment.
func NewClient() *Client {
	return &Client{
		baseURL:  envOr("OPENSEARCH_URL", "http://opensearch:9200"),
		username: envOr("OPENSEARCH_USERNAME", "admin"),
		password: os.Getenv("OPENSEARCH_PASSWORD"),
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ClusterHealth represents OpenSearch cluster health.
type ClusterHealth struct {
	ClusterName         string `json:"cluster_name"`
	Status              string `json:"status"`
	NumberOfNodes       int    `json:"number_of_nodes"`
	NumberOfDataNodes   int    `json:"number_of_data_nodes"`
	ActivePrimaryShards int    `json:"active_primary_shards"`
	ActiveShards        int    `json:"active_shards"`
	RelocatingShards    int    `json:"relocating_shards"`
	UnassignedShards    int    `json:"unassigned_shards"`
}

// HealthCheck pings the OpenSearch cluster.
func (c *Client) HealthCheck(ctx context.Context) error {
	_, err := c.GetClusterHealth(ctx)
	return err
}

// GetClusterHealth returns cluster health status.
func (c *Client) GetClusterHealth(ctx context.Context) (*ClusterHealth, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/_cluster/health", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch health: %w", err)
	}
	defer resp.Body.Close()
	var health ClusterHealth
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, err
	}
	return &health, nil
}

func (c *Client) setAuth(req *http.Request) {
	if c.username != "" && c.password != "" {
		req.SetBasicAuth(c.username, c.password)
	}
}

// IndexInfo represents an OpenSearch index.
type IndexInfo struct {
	Name      string `json:"index"`
	Health    string `json:"health"`
	Status    string `json:"status"`
	DocsCount string `json:"docs.count"`
	StoreSize string `json:"store.size"`
	Replicas  string `json:"rep"`
	Shards    string `json:"pri"`
}

// ListIndices returns all indices.
func (c *Client) ListIndices(ctx context.Context) ([]IndexInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/_cat/indices?format=json", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var indices []IndexInfo
	if err := json.NewDecoder(resp.Body).Decode(&indices); err != nil {
		return nil, err
	}
	return indices, nil
}

// IndexDocument indexes a document.
func (c *Client) IndexDocument(ctx context.Context, index string, docID string, doc interface{}) error {
	body, _ := json.Marshal(doc)
	url := fmt.Sprintf("%s/%s/_doc/%s", c.baseURL, index, docID)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("index document: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// Search executes a search query.
func (c *Client) Search(ctx context.Context, index string, query map[string]interface{}) ([]map[string]interface{}, error) {
	body, _ := json.Marshal(query)
	url := fmt.Sprintf("%s/%s/_search", c.baseURL, index)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Hits struct {
			Hits []struct {
				Source map[string]interface{} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	docs := make([]map[string]interface{}, len(result.Hits.Hits))
	for i, h := range result.Hits.Hits {
		docs[i] = h.Source
	}
	return docs, nil
}

// CreateISMPolicy creates an Index State Management policy.
func (c *Client) CreateISMPolicy(ctx context.Context, policyID string, policy map[string]interface{}) error {
	body, _ := json.Marshal(map[string]interface{}{"policy": policy})
	url := fmt.Sprintf("%s/_plugins/_ism/policies/%s", c.baseURL, policyID)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("create ISM policy: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// GetAnomalyDetectors lists anomaly detection detectors.
func (c *Client) GetAnomalyDetectors(ctx context.Context) ([]map[string]interface{}, error) {
	query := map[string]interface{}{
		"query": map[string]interface{}{"match_all": map[string]interface{}{}},
	}
	body, _ := json.Marshal(query)
	url := c.baseURL + "/_plugins/_anomaly_detection/detectors/_search"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Hits struct {
			Hits []struct {
				Source map[string]interface{} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	detectors := make([]map[string]interface{}, len(result.Hits.Hits))
	for i, h := range result.Hits.Hits {
		detectors[i] = h.Source
	}
	return detectors, nil
}
