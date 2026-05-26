// Package opensearch provides integration with OpenSearch for log analytics
package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Config holds OpenSearch configuration
type Config struct {
	URL             string
	Username        string
	Password        string
	IndexPrefix     string
	RetentionDays   int
	BulkSize        int
	FlushInterval   time.Duration
}

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp     time.Time              `json:"@timestamp"`
	Level         string                 `json:"level"`
	Service       string                 `json:"service"`
	Namespace     string                 `json:"namespace"`
	PodName       string                 `json:"pod_name"`
	ContainerName string                 `json:"container_name"`
	Message       string                 `json:"message"`
	TraceID       string                 `json:"trace_id,omitempty"`
	SpanID        string                 `json:"span_id,omitempty"`
	ParentSpanID  string                 `json:"parent_span_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	TenantID      string                 `json:"tenant_id,omitempty"`
	TransactionID string                 `json:"transaction_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	Method        string                 `json:"method,omitempty"`
	Path          string                 `json:"path,omitempty"`
	StatusCode    int                    `json:"status_code,omitempty"`
	Duration      float64                `json:"duration_ms,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
	StackTrace    string                 `json:"stack_trace,omitempty"`
	Labels        map[string]string      `json:"labels,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// SecurityEvent represents a security-related log event
type SecurityEvent struct {
	Timestamp     time.Time              `json:"@timestamp"`
	EventType     string                 `json:"event_type"`
	Severity      string                 `json:"severity"`
	Source        string                 `json:"source"`
	SourceIP      string                 `json:"source_ip,omitempty"`
	DestIP        string                 `json:"dest_ip,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource,omitempty"`
	Result        string                 `json:"result"`
	Description   string                 `json:"description"`
	RuleID        string                 `json:"rule_id,omitempty"`
	AlertID       string                 `json:"alert_id,omitempty"`
	MITRE         []string               `json:"mitre,omitempty"`
	Compliance    []string               `json:"compliance,omitempty"`
	RawLog        string                 `json:"raw_log,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// AuditEvent represents an audit log event
type AuditEvent struct {
	Timestamp     time.Time              `json:"@timestamp"`
	EventType     string                 `json:"event_type"`
	Actor         string                 `json:"actor"`
	ActorType     string                 `json:"actor_type"`
	ActorIP       string                 `json:"actor_ip,omitempty"`
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id,omitempty"`
	Result        string                 `json:"result"`
	Changes       map[string]interface{} `json:"changes,omitempty"`
	Reason        string                 `json:"reason,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// TransactionLog represents a payment transaction log
type TransactionLog struct {
	Timestamp       time.Time              `json:"@timestamp"`
	TransactionID   string                 `json:"transaction_id"`
	TransactionType string                 `json:"transaction_type"`
	Status          string                 `json:"status"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	PayerID         string                 `json:"payer_id"`
	PayeeID         string                 `json:"payee_id"`
	PayerBank       string                 `json:"payer_bank,omitempty"`
	PayeeBank       string                 `json:"payee_bank,omitempty"`
	Channel         string                 `json:"channel"`
	ProcessingTime  float64                `json:"processing_time_ms"`
	ErrorCode       string                 `json:"error_code,omitempty"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	FraudScore      float64                `json:"fraud_score,omitempty"`
	RiskLevel       string                 `json:"risk_level,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// SearchQuery represents a search query
type SearchQuery struct {
	Index       string
	Query       map[string]interface{}
	From        int
	Size        int
	Sort        []map[string]interface{}
	Aggregations map[string]interface{}
	Highlight   map[string]interface{}
}

// SearchResult represents search results
type SearchResult struct {
	Total    int64                    `json:"total"`
	MaxScore float64                  `json:"max_score"`
	Hits     []map[string]interface{} `json:"hits"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
}

// Dashboard represents a saved dashboard
type Dashboard struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Panels      []DashboardPanel       `json:"panels"`
	TimeRange   TimeRange              `json:"time_range"`
	RefreshInterval string             `json:"refresh_interval"`
	Tags        []string               `json:"tags"`
}

// DashboardPanel represents a dashboard panel
type DashboardPanel struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Type        string                 `json:"type"`
	Query       map[string]interface{} `json:"query"`
	Visualization map[string]interface{} `json:"visualization"`
	GridPos     GridPosition           `json:"grid_pos"`
}

// GridPosition represents panel position
type GridPosition struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

// TimeRange represents a time range
type TimeRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Client provides OpenSearch integration
type Client struct {
	config     Config
	httpClient *http.Client
	mu         sync.RWMutex
	
	// Bulk indexing buffer
	buffer     []bulkItem
	bufferMu   sync.Mutex
	
	// Index templates
	templates  map[string]bool
	
	// Metrics
	docsIndexed   int64
	searchQueries int64
	errors        int64
}

type bulkItem struct {
	Index string
	Doc   interface{}
}

// NewClient creates a new OpenSearch client
func NewClient(config Config) *Client {
	if config.IndexPrefix == "" {
		config.IndexPrefix = "payment-switch"
	}
	if config.RetentionDays == 0 {
		config.RetentionDays = 30
	}
	if config.BulkSize == 0 {
		config.BulkSize = 1000
	}
	if config.FlushInterval == 0 {
		config.FlushInterval = 5 * time.Second
	}
	
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		buffer:    make([]bulkItem, 0, config.BulkSize),
		templates: make(map[string]bool),
	}
}

// Start initializes the OpenSearch client
func (c *Client) Start(ctx context.Context) error {
	// Create index templates
	if err := c.createIndexTemplates(ctx); err != nil {
		return fmt.Errorf("create templates: %w", err)
	}
	
	// Start background flusher
	go c.backgroundFlusher(ctx)
	
	return nil
}

// createIndexTemplates creates index templates for different log types
func (c *Client) createIndexTemplates(ctx context.Context) error {
	templates := map[string]map[string]interface{}{
		"logs": {
			"index_patterns": []string{c.config.IndexPrefix + "-logs-*"},
			"template": map[string]interface{}{
				"settings": map[string]interface{}{
					"number_of_shards":   3,
					"number_of_replicas": 1,
					"refresh_interval":   "5s",
				},
				"mappings": map[string]interface{}{
					"properties": map[string]interface{}{
						"@timestamp":     map[string]string{"type": "date"},
						"level":          map[string]string{"type": "keyword"},
						"service":        map[string]string{"type": "keyword"},
						"namespace":      map[string]string{"type": "keyword"},
						"pod_name":       map[string]string{"type": "keyword"},
						"message":        map[string]string{"type": "text"},
						"trace_id":       map[string]string{"type": "keyword"},
						"span_id":        map[string]string{"type": "keyword"},
						"user_id":        map[string]string{"type": "keyword"},
						"tenant_id":      map[string]string{"type": "keyword"},
						"transaction_id": map[string]string{"type": "keyword"},
						"request_id":     map[string]string{"type": "keyword"},
						"method":         map[string]string{"type": "keyword"},
						"path":           map[string]string{"type": "keyword"},
						"status_code":    map[string]string{"type": "integer"},
						"duration_ms":    map[string]string{"type": "float"},
						"error_message":  map[string]string{"type": "text"},
					},
				},
			},
		},
		"security": {
			"index_patterns": []string{c.config.IndexPrefix + "-security-*"},
			"template": map[string]interface{}{
				"settings": map[string]interface{}{
					"number_of_shards":   2,
					"number_of_replicas": 2,
				},
				"mappings": map[string]interface{}{
					"properties": map[string]interface{}{
						"@timestamp":   map[string]string{"type": "date"},
						"event_type":   map[string]string{"type": "keyword"},
						"severity":     map[string]string{"type": "keyword"},
						"source":       map[string]string{"type": "keyword"},
						"source_ip":    map[string]string{"type": "ip"},
						"dest_ip":      map[string]string{"type": "ip"},
						"user_id":      map[string]string{"type": "keyword"},
						"action":       map[string]string{"type": "keyword"},
						"resource":     map[string]string{"type": "keyword"},
						"result":       map[string]string{"type": "keyword"},
						"description":  map[string]string{"type": "text"},
						"rule_id":      map[string]string{"type": "keyword"},
						"alert_id":     map[string]string{"type": "keyword"},
						"mitre":        map[string]string{"type": "keyword"},
						"compliance":   map[string]string{"type": "keyword"},
					},
				},
			},
		},
		"audit": {
			"index_patterns": []string{c.config.IndexPrefix + "-audit-*"},
			"template": map[string]interface{}{
				"settings": map[string]interface{}{
					"number_of_shards":   2,
					"number_of_replicas": 2,
				},
				"mappings": map[string]interface{}{
					"properties": map[string]interface{}{
						"@timestamp":   map[string]string{"type": "date"},
						"event_type":   map[string]string{"type": "keyword"},
						"actor":        map[string]string{"type": "keyword"},
						"actor_type":   map[string]string{"type": "keyword"},
						"actor_ip":     map[string]string{"type": "ip"},
						"action":       map[string]string{"type": "keyword"},
						"resource":     map[string]string{"type": "keyword"},
						"resource_id":  map[string]string{"type": "keyword"},
						"result":       map[string]string{"type": "keyword"},
						"session_id":   map[string]string{"type": "keyword"},
						"request_id":   map[string]string{"type": "keyword"},
					},
				},
			},
		},
		"transactions": {
			"index_patterns": []string{c.config.IndexPrefix + "-transactions-*"},
			"template": map[string]interface{}{
				"settings": map[string]interface{}{
					"number_of_shards":   5,
					"number_of_replicas": 1,
				},
				"mappings": map[string]interface{}{
					"properties": map[string]interface{}{
						"@timestamp":        map[string]string{"type": "date"},
						"transaction_id":    map[string]string{"type": "keyword"},
						"transaction_type":  map[string]string{"type": "keyword"},
						"status":            map[string]string{"type": "keyword"},
						"amount":            map[string]string{"type": "double"},
						"currency":          map[string]string{"type": "keyword"},
						"payer_id":          map[string]string{"type": "keyword"},
						"payee_id":          map[string]string{"type": "keyword"},
						"payer_bank":        map[string]string{"type": "keyword"},
						"payee_bank":        map[string]string{"type": "keyword"},
						"channel":           map[string]string{"type": "keyword"},
						"processing_time_ms": map[string]string{"type": "float"},
						"error_code":        map[string]string{"type": "keyword"},
						"fraud_score":       map[string]string{"type": "float"},
						"risk_level":        map[string]string{"type": "keyword"},
					},
				},
			},
		},
	}
	
	for name, template := range templates {
		if err := c.createTemplate(ctx, name, template); err != nil {
			return fmt.Errorf("create template %s: %w", name, err)
		}
		c.templates[name] = true
	}
	
	return nil
}

// createTemplate creates an index template
func (c *Client) createTemplate(ctx context.Context, name string, template map[string]interface{}) error {
	body, err := json.Marshal(template)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequestWithContext(ctx, "PUT",
		c.config.URL+"/_index_template/"+c.config.IndexPrefix+"-"+name, bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("template creation failed: %s - %s", resp.Status, string(respBody))
	}
	
	return nil
}

// backgroundFlusher periodically flushes the buffer
func (c *Client) backgroundFlusher(ctx context.Context) {
	ticker := time.NewTicker(c.config.FlushInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			c.flush(context.Background())
			return
		case <-ticker.C:
			c.flush(ctx)
		}
	}
}

// IndexLog indexes a log entry
func (c *Client) IndexLog(entry LogEntry) {
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}
	
	index := fmt.Sprintf("%s-logs-%s", c.config.IndexPrefix, entry.Timestamp.Format("2006.01.02"))
	c.addToBuffer(index, entry)
}

// IndexSecurityEvent indexes a security event
func (c *Client) IndexSecurityEvent(event SecurityEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	
	index := fmt.Sprintf("%s-security-%s", c.config.IndexPrefix, event.Timestamp.Format("2006.01.02"))
	c.addToBuffer(index, event)
}

// IndexAuditEvent indexes an audit event
func (c *Client) IndexAuditEvent(event AuditEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	
	index := fmt.Sprintf("%s-audit-%s", c.config.IndexPrefix, event.Timestamp.Format("2006.01.02"))
	c.addToBuffer(index, event)
}

// IndexTransaction indexes a transaction log
func (c *Client) IndexTransaction(tx TransactionLog) {
	if tx.Timestamp.IsZero() {
		tx.Timestamp = time.Now()
	}
	
	index := fmt.Sprintf("%s-transactions-%s", c.config.IndexPrefix, tx.Timestamp.Format("2006.01.02"))
	c.addToBuffer(index, tx)
}

// addToBuffer adds a document to the bulk buffer
func (c *Client) addToBuffer(index string, doc interface{}) {
	c.bufferMu.Lock()
	c.buffer = append(c.buffer, bulkItem{Index: index, Doc: doc})
	shouldFlush := len(c.buffer) >= c.config.BulkSize
	c.bufferMu.Unlock()
	
	if shouldFlush {
		go c.flush(context.Background())
	}
}

// flush sends buffered documents to OpenSearch
func (c *Client) flush(ctx context.Context) {
	c.bufferMu.Lock()
	if len(c.buffer) == 0 {
		c.bufferMu.Unlock()
		return
	}
	
	items := c.buffer
	c.buffer = make([]bulkItem, 0, c.config.BulkSize)
	c.bufferMu.Unlock()
	
	// Build bulk request body
	var buf bytes.Buffer
	for _, item := range items {
		meta := map[string]interface{}{
			"index": map[string]string{
				"_index": item.Index,
			},
		}
		metaBytes, _ := json.Marshal(meta)
		buf.Write(metaBytes)
		buf.WriteByte('\n')
		
		docBytes, _ := json.Marshal(item.Doc)
		buf.Write(docBytes)
		buf.WriteByte('\n')
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.URL+"/_bulk", &buf)
	if err != nil {
		c.mu.Lock()
		c.errors++
		c.mu.Unlock()
		return
	}
	
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/x-ndjson")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.mu.Lock()
		c.errors++
		c.mu.Unlock()
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusOK {
		c.mu.Lock()
		c.docsIndexed += int64(len(items))
		c.mu.Unlock()
	} else {
		c.mu.Lock()
		c.errors++
		c.mu.Unlock()
	}
}

// Search performs a search query
func (c *Client) Search(ctx context.Context, query SearchQuery) (*SearchResult, error) {
	body := map[string]interface{}{
		"query": query.Query,
		"from":  query.From,
		"size":  query.Size,
	}
	
	if len(query.Sort) > 0 {
		body["sort"] = query.Sort
	}
	if len(query.Aggregations) > 0 {
		body["aggs"] = query.Aggregations
	}
	if len(query.Highlight) > 0 {
		body["highlight"] = query.Highlight
	}
	
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.URL+"/"+query.Index+"/_search", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	c.mu.Lock()
	c.searchQueries++
	c.mu.Unlock()
	
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search failed: %s - %s", resp.Status, string(respBody))
	}
	
	var result struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			MaxScore float64 `json:"max_score"`
			Hits     []struct {
				Source map[string]interface{} `json:"_source"`
				Score  float64                `json:"_score"`
			} `json:"hits"`
		} `json:"hits"`
		Aggregations map[string]interface{} `json:"aggregations"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	searchResult := &SearchResult{
		Total:        result.Hits.Total.Value,
		MaxScore:     result.Hits.MaxScore,
		Aggregations: result.Aggregations,
	}
	
	for _, hit := range result.Hits.Hits {
		searchResult.Hits = append(searchResult.Hits, hit.Source)
	}
	
	return searchResult, nil
}

// SearchLogs searches log entries
func (c *Client) SearchLogs(ctx context.Context, service string, level string, from, to time.Time, limit int) (*SearchResult, error) {
	must := []map[string]interface{}{
		{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{
					"gte": from.Format(time.RFC3339),
					"lte": to.Format(time.RFC3339),
				},
			},
		},
	}
	
	if service != "" {
		must = append(must, map[string]interface{}{
			"term": map[string]string{"service": service},
		})
	}
	
	if level != "" {
		must = append(must, map[string]interface{}{
			"term": map[string]string{"level": level},
		})
	}
	
	return c.Search(ctx, SearchQuery{
		Index: c.config.IndexPrefix + "-logs-*",
		Query: map[string]interface{}{
			"bool": map[string]interface{}{
				"must": must,
			},
		},
		Size: limit,
		Sort: []map[string]interface{}{
			{"@timestamp": map[string]string{"order": "desc"}},
		},
	})
}

// SearchSecurityEvents searches security events
func (c *Client) SearchSecurityEvents(ctx context.Context, severity string, from, to time.Time, limit int) (*SearchResult, error) {
	must := []map[string]interface{}{
		{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{
					"gte": from.Format(time.RFC3339),
					"lte": to.Format(time.RFC3339),
				},
			},
		},
	}
	
	if severity != "" {
		must = append(must, map[string]interface{}{
			"term": map[string]string{"severity": severity},
		})
	}
	
	return c.Search(ctx, SearchQuery{
		Index: c.config.IndexPrefix + "-security-*",
		Query: map[string]interface{}{
			"bool": map[string]interface{}{
				"must": must,
			},
		},
		Size: limit,
		Sort: []map[string]interface{}{
			{"@timestamp": map[string]string{"order": "desc"}},
		},
	})
}

// GetTransactionMetrics returns transaction metrics aggregations
func (c *Client) GetTransactionMetrics(ctx context.Context, from, to time.Time) (map[string]interface{}, error) {
	result, err := c.Search(ctx, SearchQuery{
		Index: c.config.IndexPrefix + "-transactions-*",
		Query: map[string]interface{}{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{
					"gte": from.Format(time.RFC3339),
					"lte": to.Format(time.RFC3339),
				},
			},
		},
		Size: 0,
		Aggregations: map[string]interface{}{
			"total_volume": map[string]interface{}{
				"sum": map[string]string{"field": "amount"},
			},
			"avg_processing_time": map[string]interface{}{
				"avg": map[string]string{"field": "processing_time_ms"},
			},
			"by_status": map[string]interface{}{
				"terms": map[string]string{"field": "status"},
			},
			"by_channel": map[string]interface{}{
				"terms": map[string]string{"field": "channel"},
			},
			"by_bank": map[string]interface{}{
				"terms": map[string]string{"field": "payer_bank"},
			},
			"fraud_score_histogram": map[string]interface{}{
				"histogram": map[string]interface{}{
					"field":    "fraud_score",
					"interval": 0.1,
				},
			},
		},
	})
	
	if err != nil {
		return nil, err
	}
	
	return result.Aggregations, nil
}

// setAuth sets authentication headers
func (c *Client) setAuth(req *http.Request) {
	if c.config.Username != "" && c.config.Password != "" {
		req.SetBasicAuth(c.config.Username, c.config.Password)
	}
}

// CreateDashboard creates a saved dashboard
func (c *Client) CreateDashboard(ctx context.Context, dashboard Dashboard) error {
	body, err := json.Marshal(dashboard)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.URL+"/_dashboards/api/saved_objects/dashboard/"+dashboard.ID, bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("osd-xsrf", "true")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("dashboard creation failed: %s", resp.Status)
	}
	
	return nil
}

// GetNOCDashboardData returns data for NOC dashboard
func (c *Client) GetNOCDashboardData(ctx context.Context) (map[string]interface{}, error) {
	now := time.Now()
	last24h := now.Add(-24 * time.Hour)
	
	// Get transaction metrics
	txMetrics, err := c.GetTransactionMetrics(ctx, last24h, now)
	if err != nil {
		txMetrics = map[string]interface{}{}
	}
	
	// Get security events count
	secEvents, err := c.SearchSecurityEvents(ctx, "", last24h, now, 0)
	securityCount := int64(0)
	if err == nil {
		securityCount = secEvents.Total
	}
	
	// Get error logs count
	errorLogs, err := c.SearchLogs(ctx, "", "error", last24h, now, 0)
	errorCount := int64(0)
	if err == nil {
		errorCount = errorLogs.Total
	}
	
	return map[string]interface{}{
		"timestamp":        now,
		"period":           "24h",
		"transactions":     txMetrics,
		"security_events":  securityCount,
		"error_logs":       errorCount,
		"docs_indexed":     c.docsIndexed,
		"search_queries":   c.searchQueries,
	}, nil
}

// DeleteOldIndices deletes indices older than retention period
func (c *Client) DeleteOldIndices(ctx context.Context) error {
	cutoff := time.Now().AddDate(0, 0, -c.config.RetentionDays)
	
	// Get all indices
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/_cat/indices/"+c.config.IndexPrefix+"-*?format=json", nil)
	if err != nil {
		return err
	}
	
	c.setAuth(req)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	var indices []struct {
		Index string `json:"index"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&indices); err != nil {
		return err
	}
	
	// Delete old indices
	for _, idx := range indices {
		// Parse date from index name
		parts := strings.Split(idx.Index, "-")
		if len(parts) < 3 {
			continue
		}
		
		dateStr := parts[len(parts)-1]
		indexDate, err := time.Parse("2006.01.02", dateStr)
		if err != nil {
			continue
		}
		
		if indexDate.Before(cutoff) {
			deleteReq, err := http.NewRequestWithContext(ctx, "DELETE",
				c.config.URL+"/"+idx.Index, nil)
			if err != nil {
				continue
			}
			
			c.setAuth(deleteReq)
			
			deleteResp, err := c.httpClient.Do(deleteReq)
			if err != nil {
				continue
			}
			deleteResp.Body.Close()
		}
	}
	
	return nil
}

// GetStats returns client statistics
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return map[string]interface{}{
		"docs_indexed":   c.docsIndexed,
		"search_queries": c.searchQueries,
		"errors":         c.errors,
		"buffer_size":    len(c.buffer),
	}
}

// HealthCheck performs a health check
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/_cluster/health", nil)
	if err != nil {
		return err
	}
	
	c.setAuth(req)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: %s", resp.Status)
	}
	
	var health struct {
		Status string `json:"status"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return err
	}
	
	if health.Status == "red" {
		return fmt.Errorf("cluster status is red")
	}
	
	return nil
}
