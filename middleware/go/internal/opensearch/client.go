// Package opensearch provides an OpenSearch client for the OG-RMM platform.
// Handles log aggregation, telemetry search, audit indexing, and alarm
// full-text search across the platform.
package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// Config holds OpenSearch connection configuration.
type Config struct {
	URL      string
	Username string
	Password string
	Enabled  bool
}

// ConfigFromEnv loads OpenSearch config from environment variables.
func ConfigFromEnv() Config {
	url := os.Getenv("OPENSEARCH_URL")
	if url == "" {
		url = "http://opensearch:9200"
	}
	return Config{
		URL:      url,
		Username: os.Getenv("OPENSEARCH_USER"),
		Password: os.Getenv("OPENSEARCH_PASSWORD"),
		Enabled:  os.Getenv("OPENSEARCH_ENABLED") != "false",
	}
}

// Client wraps the OpenSearch REST API.
type Client struct {
	cfg    Config
	client *http.Client
}

// NewClient creates a new OpenSearch client.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) do(ctx context.Context, method, path string, body any) ([]byte, error) {
	if !c.cfg.Enabled {
		return nil, nil
	}
	var r io.Reader
	if body != nil {
		switch v := body.(type) {
		case string:
			r = strings.NewReader(v)
		case []byte:
			r = bytes.NewReader(v)
		default:
			data, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("opensearch: marshal: %w", err)
			}
			r = bytes.NewReader(data)
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, c.cfg.URL+path, r)
	if err != nil {
		return nil, fmt.Errorf("opensearch: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.cfg.Username != "" {
		req.SetBasicAuth(c.cfg.Username, c.cfg.Password)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("opensearch: HTTP %d: %s", resp.StatusCode, respBody)
	}
	return respBody, nil
}

// IndexDocument indexes a single document.
func (c *Client) IndexDocument(ctx context.Context, index string, id string, doc any) error {
	path := fmt.Sprintf("/%s/_doc", index)
	if id != "" {
		path = fmt.Sprintf("/%s/_doc/%s", index, id)
	}
	_, err := c.do(ctx, http.MethodPost, path, doc)
	if err != nil {
		slog.Warn("opensearch: index failed", "index", index, "error", err)
	}
	return err
}

// BulkIndex indexes multiple documents in a single bulk request.
func (c *Client) BulkIndex(ctx context.Context, index string, docs []map[string]any) error {
	if !c.cfg.Enabled || len(docs) == 0 {
		return nil
	}
	var buf bytes.Buffer
	for _, doc := range docs {
		meta, _ := json.Marshal(map[string]any{"index": map[string]string{"_index": index}})
		buf.Write(meta)
		buf.WriteByte('\n')
		data, _ := json.Marshal(doc)
		buf.Write(data)
		buf.WriteByte('\n')
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.URL+"/_bulk", &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if c.cfg.Username != "" {
		req.SetBasicAuth(c.cfg.Username, c.cfg.Password)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("opensearch bulk: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("opensearch bulk HTTP %d: %s", resp.StatusCode, body)
	}
	return nil
}

// SearchResult holds search results.
type SearchResult struct {
	Total int              `json:"total"`
	Hits  []map[string]any `json:"hits"`
	Took  int              `json:"took"`
}

// Search performs a full-text search query.
func (c *Client) Search(ctx context.Context, index string, query map[string]any, size int) (*SearchResult, error) {
	if !c.cfg.Enabled {
		return &SearchResult{}, nil
	}
	body := map[string]any{"query": query, "size": size}
	data, err := c.do(ctx, http.MethodPost, fmt.Sprintf("/%s/_search", index), body)
	if err != nil {
		return nil, err
	}
	var raw struct {
		Took int `json:"took"`
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source map[string]any `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("opensearch: decode: %w", err)
	}
	hits := make([]map[string]any, 0, len(raw.Hits.Hits))
	for _, h := range raw.Hits.Hits {
		hits = append(hits, h.Source)
	}
	return &SearchResult{
		Total: raw.Hits.Total.Value,
		Hits:  hits,
		Took:  raw.Took,
	}, nil
}

// ClusterHealth returns cluster health status.
func (c *Client) ClusterHealth(ctx context.Context) (map[string]any, error) {
	if !c.cfg.Enabled {
		return map[string]any{"status": "disabled"}, nil
	}
	data, err := c.do(ctx, http.MethodGet, "/_cluster/health", nil)
	if err != nil {
		return map[string]any{"status": "unreachable", "error": err.Error()}, nil
	}
	var result map[string]any
	json.Unmarshal(data, &result)
	return result, nil
}

// EnsureIndexTemplate creates an index template if it doesn't exist.
func (c *Client) EnsureIndexTemplate(ctx context.Context, name string, template map[string]any) error {
	_, err := c.do(ctx, http.MethodPut, fmt.Sprintf("/_index_template/%s", name), template)
	return err
}

// IndexAuditEvent indexes an audit log entry to og-audit-YYYY.MM.DD.
func (c *Client) IndexAuditEvent(ctx context.Context, event map[string]any) error {
	now := time.Now().UTC()
	index := fmt.Sprintf("og-audit-%s", now.Format("2006.01.02"))
	if _, ok := event["@timestamp"]; !ok {
		event["@timestamp"] = now.Format(time.RFC3339)
	}
	return c.IndexDocument(ctx, index, "", event)
}

// IndexTelemetryBatch indexes a batch of telemetry readings.
func (c *Client) IndexTelemetryBatch(ctx context.Context, readings []map[string]any) error {
	now := time.Now().UTC()
	index := fmt.Sprintf("og-telemetry-%s", now.Format("2006.01.02"))
	return c.BulkIndex(ctx, index, readings)
}

// IndexAlarmEvent indexes an alarm event.
func (c *Client) IndexAlarmEvent(ctx context.Context, event map[string]any) error {
	now := time.Now().UTC()
	index := fmt.Sprintf("og-alarms-%s", now.Format("2006.01.02"))
	if _, ok := event["@timestamp"]; !ok {
		event["@timestamp"] = now.Format(time.RFC3339)
	}
	return c.IndexDocument(ctx, index, "", event)
}
