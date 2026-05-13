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

// Client provides OpenSearch indexing and search for CRM.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates an OpenSearch client.
func NewClient() *Client {
	url := os.Getenv("OPENSEARCH_URL")
	if url == "" {
		url = "http://opensearch:9200"
	}
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		baseURL:    url,
	}
}

// IndexDocument indexes a document.
func (c *Client) IndexDocument(ctx context.Context, index, id string, doc interface{}) error {
	body, _ := json.Marshal(doc)
	url := fmt.Sprintf("%s/%s/_doc/%s", c.baseURL, index, id)
	req, _ := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("opensearch index %s/%s: status %d", index, id, resp.StatusCode)
	}
	return nil
}

// Search performs a search query.
func (c *Client) Search(ctx context.Context, index string, query map[string]interface{}) ([]json.RawMessage, int64, error) {
	body, _ := json.Marshal(query)
	url := fmt.Sprintf("%s/%s/_search", c.baseURL, index)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Hits struct {
			Total struct{ Value int64 } `json:"total"`
			Hits  []struct{ Source json.RawMessage `json:"_source"` } `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, 0, err
	}
	docs := make([]json.RawMessage, len(result.Hits.Hits))
	for i, h := range result.Hits.Hits {
		docs[i] = h.Source
	}
	return docs, result.Hits.Total.Value, nil
}

// BulkIndex indexes multiple documents in a single request.
func (c *Client) BulkIndex(ctx context.Context, index string, docs map[string]interface{}) error {
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
	url := fmt.Sprintf("%s/_bulk", c.baseURL)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, &buf)
	req.Header.Set("Content-Type", "application/x-ndjson")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// CRM index names
const (
	IndexCustomers     = "crm-customers"
	IndexInteractions  = "crm-interactions"
	IndexCampaigns     = "crm-campaigns"
	IndexAuditLog      = "crm-audit-log"
	IndexTrades        = "crm-commodity-trades"
	IndexMessages      = "crm-cpaas-messages"
	IndexSubscribers   = "crm-telco-subscribers"
)
