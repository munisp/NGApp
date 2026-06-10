package fluvio

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a Fluvio HTTP API client.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient creates a Fluvio client from environment.
func NewClient() *Client {
	return &Client{
		baseURL: envOr("FLUVIO_URL", "http://fluvio:9003"),
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies Fluvio is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("fluvio health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("fluvio unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// TopicInfo represents a Fluvio topic.
type TopicInfo struct {
	Name       string `json:"name"`
	Partitions int    `json:"partitions"`
	Replicas   int    `json:"replicas"`
	Status     string `json:"status"`
}

// ListTopics returns all Fluvio topics.
func (c *Client) ListTopics(ctx context.Context) ([]TopicInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/topics", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var topics []TopicInfo
	json.NewDecoder(resp.Body).Decode(&topics)
	return topics, nil
}

// Produce sends a record to a Fluvio topic.
func (c *Client) Produce(ctx context.Context, topic string, key string, value interface{}) error {
	payload := map[string]interface{}{
		"key":   key,
		"value": value,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/v1/produce/%s", c.baseURL, topic)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("fluvio produce: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("produce failed: status %d", resp.StatusCode)
	}
	return nil
}

// Consume reads records from a Fluvio topic.
func (c *Client) Consume(ctx context.Context, topic string, offset int64, maxRecords int) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/v1/consume/%s?offset=%d&max_bytes=1048576", c.baseURL, topic, offset)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var records []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&records)
	return records, nil
}

// SmartModuleInfo represents a deployed SmartModule.
type SmartModuleInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"` // filter, map, aggregate, filter-map
	Status  string `json:"status"`
	Version string `json:"version"`
}

// ListSmartModules returns deployed SmartModules.
func (c *Client) ListSmartModules(ctx context.Context) ([]SmartModuleInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/smartmodules", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var modules []SmartModuleInfo
	json.NewDecoder(resp.Body).Decode(&modules)
	return modules, nil
}

// DeploySmartModule deploys a SmartModule to a topic.
func (c *Client) DeploySmartModule(ctx context.Context, topic, moduleName, moduleType string) error {
	payload := map[string]interface{}{
		"topic":       topic,
		"smartmodule": moduleName,
		"type":        moduleType,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/smartmodules/deploy", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("deploy smartmodule: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("deploy failed: status %d", resp.StatusCode)
	}
	return nil
}

// ConnectorStatus represents a Kafka-Fluvio connector.
type ConnectorStatus struct {
	Name          string `json:"name"`
	Direction     string `json:"direction"` // kafka-to-fluvio, fluvio-to-kafka
	Status        string `json:"status"`
	RecordsIn     int64  `json:"records_in"`
	RecordsOut    int64  `json:"records_out"`
	ErrorCount    int    `json:"error_count"`
	LastSync      time.Time `json:"last_sync"`
}

// ListConnectors returns Kafka-Fluvio connector status.
func (c *Client) ListConnectors(ctx context.Context) ([]ConnectorStatus, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/connectors", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var connectors []ConnectorStatus
	json.NewDecoder(resp.Body).Decode(&connectors)
	return connectors, nil
}
