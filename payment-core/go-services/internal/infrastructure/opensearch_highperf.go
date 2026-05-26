// Package infrastructure provides high-performance OpenSearch client
package infrastructure

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// OpenSearchHighPerfConfig configures the high-performance OpenSearch client
type OpenSearchHighPerfConfig struct {
	// Cluster nodes
	Nodes    []string
	Username string
	Password string

	// Index settings
	IndexPrefix      string
	NumberOfShards   int
	NumberOfReplicas int
	RefreshInterval  string

	// Bulk settings
	BulkSize      int
	BulkActions   int
	FlushInterval time.Duration

	// Connection settings
	MaxRetries   int
	RetryBackoff time.Duration
	Timeout      time.Duration

	// Performance settings
	Compression    bool
	EnableSniffing bool
}

// DefaultOpenSearchHighPerfConfig returns optimized defaults for 1M TPS
func DefaultOpenSearchHighPerfConfig() OpenSearchHighPerfConfig {
	return OpenSearchHighPerfConfig{
		Nodes:            []string{"opensearch-0:9200", "opensearch-1:9200", "opensearch-2:9200"},
		IndexPrefix:      "payment-switch",
		NumberOfShards:   10,
		NumberOfReplicas: 1,
		RefreshInterval:  "5s",
		BulkSize:         5 * 1024 * 1024, // 5MB
		BulkActions:      5000,
		FlushInterval:    5 * time.Second,
		MaxRetries:       3,
		RetryBackoff:     100 * time.Millisecond,
		Timeout:          30 * time.Second,
		Compression:      true,
		EnableSniffing:   true,
	}
}

// OpenSearchHighPerfClient is an optimized OpenSearch client
type OpenSearchHighPerfClient struct {
	config     OpenSearchHighPerfConfig
	httpClient *http.Client

	// Bulk buffer
	bulkBuffer []BulkItem
	bulkMu     sync.Mutex
	bulkSize   int

	// Node selection (round-robin)
	nodeIdx uint64

	// Stats
	docsIndexed   uint64
	searchQueries uint64
	errors        uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// BulkItem represents a bulk index item
type BulkItem struct {
	Index  string
	ID     string
	Doc    interface{}
	Action string // index, create, update, delete
}

// NewOpenSearchHighPerfClient creates a new high-performance OpenSearch client
func NewOpenSearchHighPerfClient(config OpenSearchHighPerfConfig) (*OpenSearchHighPerfClient, error) {
	ctx, cancel := context.WithCancel(context.Background())

	client := &OpenSearchHighPerfClient{
		config:     config,
		httpClient: &http.Client{Timeout: config.Timeout},
		bulkBuffer: make([]BulkItem, 0, config.BulkActions),
		ctx:        ctx,
		cancel:     cancel,
	}

	// Start background flusher
	client.wg.Add(1)
	go client.backgroundFlusher()

	log.Printf("OpenSearchHighPerfClient initialized: %d nodes, shards=%d, replicas=%d",
		len(config.Nodes), config.NumberOfShards, config.NumberOfReplicas)

	return client, nil
}

// getNode returns the next node using round-robin
func (c *OpenSearchHighPerfClient) getNode() string {
	idx := atomic.AddUint64(&c.nodeIdx, 1) % uint64(len(c.config.Nodes))
	return c.config.Nodes[idx]
}

// Index indexes a document
func (c *OpenSearchHighPerfClient) Index(index, id string, doc interface{}) error {
	c.bulkMu.Lock()
	c.bulkBuffer = append(c.bulkBuffer, BulkItem{
		Index:  index,
		ID:     id,
		Doc:    doc,
		Action: "index",
	})

	docBytes, _ := json.Marshal(doc)
	c.bulkSize += len(docBytes)

	shouldFlush := len(c.bulkBuffer) >= c.config.BulkActions || c.bulkSize >= c.config.BulkSize
	c.bulkMu.Unlock()

	if shouldFlush {
		go c.flush()
	}

	return nil
}

// IndexSync indexes a document synchronously
func (c *OpenSearchHighPerfClient) IndexSync(ctx context.Context, index, id string, doc interface{}) error {
	node := c.getNode()
	url := fmt.Sprintf("http://%s/%s/_doc/%s", node, index, id)

	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		atomic.AddUint64(&c.errors, 1)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		atomic.AddUint64(&c.errors, 1)
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("index failed: %s - %s", resp.Status, string(respBody))
	}

	atomic.AddUint64(&c.docsIndexed, 1)
	return nil
}

// Search performs a search query
func (c *OpenSearchHighPerfClient) Search(ctx context.Context, index string, query map[string]interface{}) (*SearchResponse, error) {
	node := c.getNode()
	url := fmt.Sprintf("http://%s/%s/_search", node, index)

	body, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		atomic.AddUint64(&c.errors, 1)
		return nil, err
	}
	defer resp.Body.Close()

	atomic.AddUint64(&c.searchQueries, 1)

	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// SearchResponse represents a search response
type SearchResponse struct {
	Took     int  `json:"took"`
	TimedOut bool `json:"timed_out"`
	Hits     struct {
		Total struct {
			Value    int    `json:"value"`
			Relation string `json:"relation"`
		} `json:"total"`
		MaxScore float64 `json:"max_score"`
		Hits     []struct {
			Index  string                 `json:"_index"`
			ID     string                 `json:"_id"`
			Score  float64                `json:"_score"`
			Source map[string]interface{} `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
}

// backgroundFlusher periodically flushes the bulk buffer
func (c *OpenSearchHighPerfClient) backgroundFlusher() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			c.flush()
			return
		case <-ticker.C:
			c.flush()
		}
	}
}

// flush sends buffered documents to OpenSearch
func (c *OpenSearchHighPerfClient) flush() {
	c.bulkMu.Lock()
	if len(c.bulkBuffer) == 0 {
		c.bulkMu.Unlock()
		return
	}

	items := c.bulkBuffer
	c.bulkBuffer = make([]BulkItem, 0, c.config.BulkActions)
	c.bulkSize = 0
	c.bulkMu.Unlock()

	// Build bulk request body
	var buf bytes.Buffer
	for _, item := range items {
		meta := map[string]interface{}{
			item.Action: map[string]interface{}{
				"_index": item.Index,
				"_id":    item.ID,
			},
		}
		metaBytes, _ := json.Marshal(meta)
		buf.Write(metaBytes)
		buf.WriteByte('\n')

		if item.Action != "delete" {
			docBytes, _ := json.Marshal(item.Doc)
			buf.Write(docBytes)
			buf.WriteByte('\n')
		}
	}

	node := c.getNode()
	url := fmt.Sprintf("http://%s/_bulk", node)

	req, err := http.NewRequestWithContext(c.ctx, "POST", url, &buf)
	if err != nil {
		atomic.AddUint64(&c.errors, 1)
		return
	}

	c.setAuth(req)
	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		atomic.AddUint64(&c.errors, 1)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		atomic.AddUint64(&c.docsIndexed, uint64(len(items)))
	} else {
		atomic.AddUint64(&c.errors, 1)
	}
}

// setAuth sets authentication headers
func (c *OpenSearchHighPerfClient) setAuth(req *http.Request) {
	if c.config.Username != "" {
		req.SetBasicAuth(c.config.Username, c.config.Password)
	}
}

// CreateIndex creates an index with optimized settings
func (c *OpenSearchHighPerfClient) CreateIndex(ctx context.Context, index string, mappings map[string]interface{}) error {
	node := c.getNode()
	url := fmt.Sprintf("http://%s/%s", node, index)

	settings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   c.config.NumberOfShards,
			"number_of_replicas": c.config.NumberOfReplicas,
			"refresh_interval":   c.config.RefreshInterval,
			"index": map[string]interface{}{
				"translog": map[string]interface{}{
					"durability":    "async",
					"sync_interval": "5s",
				},
				"merge": map[string]interface{}{
					"scheduler": map[string]interface{}{
						"max_thread_count": 4,
					},
				},
			},
		},
		"mappings": mappings,
	}

	body, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
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

	if resp.StatusCode >= 400 && resp.StatusCode != 400 { // 400 = index exists
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create index failed: %s - %s", resp.Status, string(respBody))
	}

	return nil
}

// Stats returns client statistics
func (c *OpenSearchHighPerfClient) Stats() (indexed, searches, errors uint64) {
	return atomic.LoadUint64(&c.docsIndexed),
		atomic.LoadUint64(&c.searchQueries),
		atomic.LoadUint64(&c.errors)
}

// Close shuts down the client
func (c *OpenSearchHighPerfClient) Close() error {
	c.cancel()
	c.wg.Wait()
	return nil
}

// OpenSearchClusterConfig represents OpenSearch cluster configuration
type OpenSearchClusterConfig struct {
	ClusterName      string
	NodeCount        int
	MasterNodes      int
	DataNodes        int
	IngestNodes      int
	CoordinatorNodes int
	NodeMemory       string
	NodeCPU          string
	StorageSize      string
	StorageClass     string
}

// OptimalOpenSearchClusterConfig returns optimized cluster config
func OptimalOpenSearchClusterConfig() OpenSearchClusterConfig {
	return OpenSearchClusterConfig{
		ClusterName:      "payment-switch-opensearch",
		NodeCount:        6,
		MasterNodes:      3,
		DataNodes:        3,
		IngestNodes:      2,
		CoordinatorNodes: 2,
		NodeMemory:       "16Gi",
		NodeCPU:          "4000m",
		StorageSize:      "500Gi",
		StorageClass:     "fast-ssd",
	}
}

// GenerateOpenSearchConfig generates OpenSearch configuration
func GenerateOpenSearchConfig(config OpenSearchClusterConfig, nodeRole string, nodeID int) string {
	return fmt.Sprintf(`cluster.name: %s
node.name: opensearch-%d

# Node roles
node.roles: [%s]

# Network
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300

# Discovery
discovery.seed_hosts:
  - opensearch-0
  - opensearch-1
  - opensearch-2
cluster.initial_master_nodes:
  - opensearch-0
  - opensearch-1
  - opensearch-2

# Memory
bootstrap.memory_lock: true

# Performance tuning
indices.memory.index_buffer_size: 20%%
indices.queries.cache.size: 15%%
indices.fielddata.cache.size: 15%%

# Thread pools
thread_pool:
  write:
    size: 16
    queue_size: 10000
  search:
    size: 25
    queue_size: 1000
  get:
    size: 8
    queue_size: 1000

# Indexing
index.refresh_interval: 5s
index.translog.durability: async
index.translog.sync_interval: 5s

# Merge
index.merge.scheduler.max_thread_count: 4

# Circuit breakers
indices.breaker.total.limit: 70%%
indices.breaker.request.limit: 40%%
indices.breaker.fielddata.limit: 30%%

# Security
plugins.security.ssl.transport.enabled: true
plugins.security.ssl.http.enabled: true
plugins.security.allow_default_init_securityindex: true
plugins.security.authcz.admin_dn:
  - CN=admin,OU=payment-switch,O=payment-switch,L=City,ST=State,C=US

# Monitoring
cluster.routing.allocation.disk.threshold_enabled: true
cluster.routing.allocation.disk.watermark.low: 85%%
cluster.routing.allocation.disk.watermark.high: 90%%
cluster.routing.allocation.disk.watermark.flood_stage: 95%%
`,
		config.ClusterName, nodeID, nodeRole,
	)
}

// OptimalIndexMappings returns optimized index mappings for payment switch
func OptimalIndexMappings() map[string]map[string]interface{} {
	return map[string]map[string]interface{}{
		"transactions": {
			"dynamic": "strict",
			"properties": map[string]interface{}{
				"@timestamp":       map[string]string{"type": "date"},
				"transaction_id":   map[string]string{"type": "keyword"},
				"transaction_type": map[string]string{"type": "keyword"},
				"status":           map[string]string{"type": "keyword"},
				"amount":           map[string]string{"type": "scaled_float", "scaling_factor": "100"},
				"currency":         map[string]string{"type": "keyword"},
				"payer_id":         map[string]string{"type": "keyword"},
				"payee_id":         map[string]string{"type": "keyword"},
				"payer_bank":       map[string]string{"type": "keyword"},
				"payee_bank":       map[string]string{"type": "keyword"},
				"channel":          map[string]string{"type": "keyword"},
				"processing_time":  map[string]string{"type": "float"},
				"fraud_score":      map[string]string{"type": "float"},
				"risk_level":       map[string]string{"type": "keyword"},
				"error_code":       map[string]string{"type": "keyword"},
				"metadata":         map[string]string{"type": "object", "enabled": "false"},
			},
		},
		"audit": {
			"dynamic": "strict",
			"properties": map[string]interface{}{
				"@timestamp":  map[string]string{"type": "date"},
				"event_type":  map[string]string{"type": "keyword"},
				"actor":       map[string]string{"type": "keyword"},
				"actor_type":  map[string]string{"type": "keyword"},
				"actor_ip":    map[string]string{"type": "ip"},
				"action":      map[string]string{"type": "keyword"},
				"resource":    map[string]string{"type": "keyword"},
				"resource_id": map[string]string{"type": "keyword"},
				"result":      map[string]string{"type": "keyword"},
				"session_id":  map[string]string{"type": "keyword"},
				"request_id":  map[string]string{"type": "keyword"},
				"changes":     map[string]string{"type": "object", "enabled": "false"},
			},
		},
		"security": {
			"dynamic": "strict",
			"properties": map[string]interface{}{
				"@timestamp":  map[string]string{"type": "date"},
				"event_type":  map[string]string{"type": "keyword"},
				"severity":    map[string]string{"type": "keyword"},
				"source":      map[string]string{"type": "keyword"},
				"source_ip":   map[string]string{"type": "ip"},
				"dest_ip":     map[string]string{"type": "ip"},
				"user_id":     map[string]string{"type": "keyword"},
				"action":      map[string]string{"type": "keyword"},
				"resource":    map[string]string{"type": "keyword"},
				"result":      map[string]string{"type": "keyword"},
				"description": map[string]string{"type": "text"},
				"rule_id":     map[string]string{"type": "keyword"},
				"alert_id":    map[string]string{"type": "keyword"},
				"mitre":       map[string]string{"type": "keyword"},
				"compliance":  map[string]string{"type": "keyword"},
			},
		},
		"logs": {
			"dynamic": "true",
			"properties": map[string]interface{}{
				"@timestamp":     map[string]string{"type": "date"},
				"level":          map[string]string{"type": "keyword"},
				"service":        map[string]string{"type": "keyword"},
				"namespace":      map[string]string{"type": "keyword"},
				"pod_name":       map[string]string{"type": "keyword"},
				"message":        map[string]string{"type": "text"},
				"trace_id":       map[string]string{"type": "keyword"},
				"span_id":        map[string]string{"type": "keyword"},
				"transaction_id": map[string]string{"type": "keyword"},
				"request_id":     map[string]string{"type": "keyword"},
				"method":         map[string]string{"type": "keyword"},
				"path":           map[string]string{"type": "keyword"},
				"status_code":    map[string]string{"type": "integer"},
				"duration_ms":    map[string]string{"type": "float"},
			},
		},
	}
}

// IndexLifecyclePolicy represents an ILM policy
type IndexLifecyclePolicy struct {
	Name   string
	Phases map[string]ILMPhase
}

// ILMPhase represents an ILM phase
type ILMPhase struct {
	MinAge  string
	Actions map[string]interface{}
}

// OptimalILMPolicies returns optimized ILM policies
func OptimalILMPolicies() []IndexLifecyclePolicy {
	return []IndexLifecyclePolicy{
		{
			Name: "transactions-policy",
			Phases: map[string]ILMPhase{
				"hot": {
					Actions: map[string]interface{}{
						"rollover": map[string]interface{}{
							"max_size": "50gb",
							"max_age":  "1d",
						},
					},
				},
				"warm": {
					MinAge: "7d",
					Actions: map[string]interface{}{
						"shrink": map[string]interface{}{
							"number_of_shards": 1,
						},
						"forcemerge": map[string]interface{}{
							"max_num_segments": 1,
						},
					},
				},
				"cold": {
					MinAge: "30d",
					Actions: map[string]interface{}{
						"freeze": map[string]interface{}{},
					},
				},
				"delete": {
					MinAge: "90d",
					Actions: map[string]interface{}{
						"delete": map[string]interface{}{},
					},
				},
			},
		},
		{
			Name: "audit-policy",
			Phases: map[string]ILMPhase{
				"hot": {
					Actions: map[string]interface{}{
						"rollover": map[string]interface{}{
							"max_size": "30gb",
							"max_age":  "1d",
						},
					},
				},
				"warm": {
					MinAge: "30d",
					Actions: map[string]interface{}{
						"shrink": map[string]interface{}{
							"number_of_shards": 1,
						},
					},
				},
				"cold": {
					MinAge: "90d",
					Actions: map[string]interface{}{
						"freeze": map[string]interface{}{},
					},
				},
				"delete": {
					MinAge: "365d",
					Actions: map[string]interface{}{
						"delete": map[string]interface{}{},
					},
				},
			},
		},
		{
			Name: "logs-policy",
			Phases: map[string]ILMPhase{
				"hot": {
					Actions: map[string]interface{}{
						"rollover": map[string]interface{}{
							"max_size": "50gb",
							"max_age":  "1d",
						},
					},
				},
				"warm": {
					MinAge: "3d",
					Actions: map[string]interface{}{
						"shrink": map[string]interface{}{
							"number_of_shards": 1,
						},
					},
				},
				"delete": {
					MinAge: "30d",
					Actions: map[string]interface{}{
						"delete": map[string]interface{}{},
					},
				},
			},
		},
	}
}

// Singleton for high-performance OpenSearch client
var (
	opensearchClient     *OpenSearchHighPerfClient
	opensearchClientOnce sync.Once
	opensearchClientErr  error
)

// GetOpenSearchClient returns the singleton OpenSearch client
func GetOpenSearchClient() (*OpenSearchHighPerfClient, error) {
	opensearchClientOnce.Do(func() {
		opensearchClient, opensearchClientErr = NewOpenSearchHighPerfClient(DefaultOpenSearchHighPerfConfig())
	})
	return opensearchClient, opensearchClientErr
}
