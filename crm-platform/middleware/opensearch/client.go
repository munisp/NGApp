package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client provides OpenSearch indexing and search for CRM with authentication.
type Client struct {
	httpClient *http.Client
	baseURL    string
	username   string
	password   string
}

// NewClient creates an OpenSearch client with authentication.
func NewClient() *Client {
	url := os.Getenv("OPENSEARCH_URL")
	if url == "" {
		url = "https://opensearch:9200"
	}
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    url,
		username:   envOrDefault("OPENSEARCH_USERNAME", "admin"),
		password:   os.Getenv("OPENSEARCH_PASSWORD"),
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}
	return c.httpClient.Do(req)
}

// IndexDocument indexes a single document.
func (c *Client) IndexDocument(ctx context.Context, index, id string, doc interface{}) error {
	body, _ := json.Marshal(doc)
	resp, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/%s/_doc/%s", index, id), bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("opensearch index %s/%s: status %d: %s", index, id, resp.StatusCode, string(respBody))
	}
	return nil
}

// SearchResult holds search response data.
type SearchResult struct {
	Hits     []json.RawMessage
	Total    int64
	Took     int
	ScrollID string
}

// Search performs a search query and returns typed results.
func (c *Client) Search(ctx context.Context, index string, query map[string]interface{}) (*SearchResult, error) {
	body, _ := json.Marshal(query)
	resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/%s/_search", index), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch search %s: status %d: %s", index, resp.StatusCode, string(respBody))
	}

	var result struct {
		Took     int `json:"took"`
		ScrollID string `json:"_scroll_id"`
		Hits     struct {
			Total struct{ Value int64 } `json:"total"`
			Hits  []struct {
				ID     string          `json:"_id"`
				Source json.RawMessage `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	sr := &SearchResult{
		Total:    result.Hits.Total.Value,
		Took:     result.Took,
		ScrollID: result.ScrollID,
	}
	for _, h := range result.Hits.Hits {
		sr.Hits = append(sr.Hits, h.Source)
	}
	return sr, nil
}

// Aggregate performs an aggregation query.
func (c *Client) Aggregate(ctx context.Context, index string, query map[string]interface{}) (map[string]json.RawMessage, error) {
	body, _ := json.Marshal(query)
	resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/%s/_search", index), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Aggregations map[string]json.RawMessage `json:"aggregations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Aggregations, nil
}

// DeleteDocument removes a document by ID.
func (c *Client) DeleteDocument(ctx context.Context, index, id string) error {
	resp, err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/%s/_doc/%s", index, id), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 && resp.StatusCode != 404 {
		return fmt.Errorf("opensearch delete %s/%s: status %d", index, id, resp.StatusCode)
	}
	return nil
}

// UpdateByQuery updates documents matching a query.
func (c *Client) UpdateByQuery(ctx context.Context, index string, query map[string]interface{}) (int64, error) {
	body, _ := json.Marshal(query)
	resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/%s/_update_by_query", index), bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Updated int64 `json:"updated"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Updated, nil
}

// DeleteByQuery deletes documents matching a query.
func (c *Client) DeleteByQuery(ctx context.Context, index string, query map[string]interface{}) (int64, error) {
	body, _ := json.Marshal(query)
	resp, err := c.doRequest(ctx, "POST", fmt.Sprintf("/%s/_delete_by_query", index), bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Deleted int64 `json:"deleted"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Deleted, nil
}

// Scroll continues a scroll search.
func (c *Client) Scroll(ctx context.Context, scrollID string, keepAlive string) (*SearchResult, error) {
	body, _ := json.Marshal(map[string]string{
		"scroll_id": scrollID,
		"scroll":    keepAlive,
	})
	resp, err := c.doRequest(ctx, "POST", "/_search/scroll", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		ScrollID string `json:"_scroll_id"`
		Hits     struct {
			Total struct{ Value int64 } `json:"total"`
			Hits  []struct{ Source json.RawMessage `json:"_source"` } `json:"hits"`
		} `json:"hits"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	sr := &SearchResult{Total: result.Hits.Total.Value, ScrollID: result.ScrollID}
	for _, h := range result.Hits.Hits {
		sr.Hits = append(sr.Hits, h.Source)
	}
	return sr, nil
}

// BulkIndex indexes multiple documents in a single request with error checking.
func (c *Client) BulkIndex(ctx context.Context, index string, docs map[string]interface{}) (*BulkResult, error) {
	var buf bytes.Buffer
	for id, doc := range docs {
		meta := map[string]interface{}{"index": map[string]string{"_index": index, "_id": id}}
		j, _ := json.Marshal(meta)
		buf.Write(j)
		buf.WriteByte('\n')
		j, _ = json.Marshal(doc)
		buf.Write(j)
		buf.WriteByte('\n')
	}
	resp, err := c.doRequest(ctx, "POST", "/_bulk", &buf)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result BulkResult
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

// BulkResult holds the response from a bulk operation.
type BulkResult struct {
	Took   int  `json:"took"`
	Errors bool `json:"errors"`
	Items  []struct {
		Index struct {
			ID     string `json:"_id"`
			Status int    `json:"status"`
			Error  *struct {
				Type   string `json:"type"`
				Reason string `json:"reason"`
			} `json:"error,omitempty"`
		} `json:"index"`
	} `json:"items"`
}

// CreateIndexTemplate creates an index template with mappings and settings.
func (c *Client) CreateIndexTemplate(ctx context.Context, name string, template map[string]interface{}) error {
	body, _ := json.Marshal(template)
	resp, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/_index_template/%s", name), bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create template %s: status %d: %s", name, resp.StatusCode, string(respBody))
	}
	return nil
}

// CreateISMPolicy creates an Index State Management policy for lifecycle management.
func (c *Client) CreateISMPolicy(ctx context.Context, policyID string, policy map[string]interface{}) error {
	body, _ := json.Marshal(map[string]interface{}{"policy": policy})
	resp, err := c.doRequest(ctx, "PUT", fmt.Sprintf("/_plugins/_ism/policies/%s", policyID), bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create ISM policy %s: status %d: %s", policyID, resp.StatusCode, string(respBody))
	}
	return nil
}

// InitializeCRMIndices creates all CRM index templates and ISM policies.
func (c *Client) InitializeCRMIndices(ctx context.Context) error {
	for _, idx := range CRMIndices() {
		template := map[string]interface{}{
			"index_patterns": []string{idx.Name + "-*"},
			"template": map[string]interface{}{
				"settings": map[string]interface{}{
					"number_of_shards":   idx.Shards,
					"number_of_replicas": idx.Replicas,
					"refresh_interval":   fmt.Sprintf("%dms", idx.RefreshMs),
				},
				"mappings": idx.Mappings,
			},
		}
		if err := c.CreateIndexTemplate(ctx, idx.Name+"-template", template); err != nil {
			return fmt.Errorf("create template for %s: %w", idx.Name, err)
		}
	}

	ismPolicy := map[string]interface{}{
		"description": "CRM index lifecycle management",
		"default_state": "hot",
		"states": []map[string]interface{}{
			{
				"name": "hot",
				"transitions": []map[string]interface{}{
					{"state_name": "warm", "conditions": map[string]string{"min_index_age": "30d"}},
				},
			},
			{
				"name": "warm",
				"actions": []map[string]interface{}{
					{"replica_count": map[string]int{"number_of_replicas": 0}},
				},
				"transitions": []map[string]interface{}{
					{"state_name": "cold", "conditions": map[string]string{"min_index_age": "90d"}},
				},
			},
			{
				"name": "cold",
				"actions": []map[string]interface{}{
					{"read_only": map[string]interface{}{}},
				},
				"transitions": []map[string]interface{}{
					{"state_name": "delete", "conditions": map[string]string{"min_index_age": "365d"}},
				},
			},
			{
				"name": "delete",
				"actions": []map[string]interface{}{
					{"delete": map[string]interface{}{}},
				},
			},
		},
	}
	return c.CreateISMPolicy(ctx, "crm-lifecycle", ismPolicy)
}

// Health checks if OpenSearch cluster is reachable.
func (c *Client) Health(ctx context.Context) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/_cluster/health", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		Status string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Status, nil
}

// CRM index names
const (
	IndexCustomers    = "crm-customers"
	IndexInteractions = "crm-interactions"
	IndexCampaigns    = "crm-campaigns"
	IndexAuditLog     = "crm-audit-log"
	IndexTrades       = "crm-commodity-trades"
	IndexMessages     = "crm-cpaas-messages"
	IndexSubscribers  = "crm-telco-subscribers"
)
