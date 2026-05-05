package opensearch

import "time"

// OpenSearch integration — full-text search, analytics dashboards,
// log aggregation, and real-time monitoring for CRM platform

type OpenSearchConfig struct {
	Hosts    []string `json:"hosts"`
	Username string   `json:"username"`
	Password string   `json:"-"`
	UseTLS   bool     `json:"use_tls"`
}

func DefaultConfig() *OpenSearchConfig {
	return &OpenSearchConfig{
		Hosts:    []string{"https://opensearch-0.opensearch.crm.svc:9200", "https://opensearch-1.opensearch.crm.svc:9200", "https://opensearch-2.opensearch.crm.svc:9200"},
		Username: "admin",
		UseTLS:   true,
	}
}

type IndexConfig struct {
	Name        string                 `json:"name"`
	Shards      int                    `json:"shards"`
	Replicas    int                    `json:"replicas"`
	RefreshMs   int                    `json:"refresh_interval_ms"`
	Mappings    map[string]interface{} `json:"mappings"`
	Lifecycle   IndexLifecycle         `json:"lifecycle"`
}

type IndexLifecycle struct {
	HotDays    int `json:"hot_days"`
	WarmDays   int `json:"warm_days"`
	ColdDays   int `json:"cold_days"`
	DeleteDays int `json:"delete_days"`
}

func CRMIndices() []IndexConfig {
	return []IndexConfig{
		{
			Name: "crm-customers", Shards: 5, Replicas: 1, RefreshMs: 1000,
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"customer_id":  map[string]string{"type": "keyword"},
					"tenant_id":    map[string]string{"type": "keyword"},
					"name":         map[string]interface{}{"type": "text", "analyzer": "standard"},
					"email":        map[string]string{"type": "keyword"},
					"phone":        map[string]string{"type": "keyword"},
					"bvn_hash":     map[string]string{"type": "keyword"},
					"status":       map[string]string{"type": "keyword"},
					"risk_score":   map[string]string{"type": "float"},
					"products":     map[string]string{"type": "keyword"},
					"created_at":   map[string]string{"type": "date"},
					"location":     map[string]string{"type": "geo_point"},
				},
			},
			Lifecycle: IndexLifecycle{HotDays: 30, WarmDays: 90, ColdDays: 365, DeleteDays: 2555},
		},
		{
			Name: "crm-transactions", Shards: 10, Replicas: 1, RefreshMs: 5000,
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"transaction_id": map[string]string{"type": "keyword"},
					"tenant_id":     map[string]string{"type": "keyword"},
					"customer_id":   map[string]string{"type": "keyword"},
					"type":          map[string]string{"type": "keyword"},
					"amount":        map[string]string{"type": "double"},
					"currency":      map[string]string{"type": "keyword"},
					"status":        map[string]string{"type": "keyword"},
					"channel":       map[string]string{"type": "keyword"},
					"timestamp":     map[string]string{"type": "date"},
				},
			},
			Lifecycle: IndexLifecycle{HotDays: 7, WarmDays: 30, ColdDays: 90, DeleteDays: 2555},
		},
		{
			Name: "crm-audit-logs", Shards: 5, Replicas: 1, RefreshMs: 5000,
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"event_id":      map[string]string{"type": "keyword"},
					"tenant_id":     map[string]string{"type": "keyword"},
					"actor_id":      map[string]string{"type": "keyword"},
					"action":        map[string]string{"type": "keyword"},
					"resource_type": map[string]string{"type": "keyword"},
					"category":      map[string]string{"type": "keyword"},
					"severity":      map[string]string{"type": "keyword"},
					"status":        map[string]string{"type": "keyword"},
					"ip_address":    map[string]string{"type": "ip"},
					"timestamp":     map[string]string{"type": "date"},
					"description":   map[string]interface{}{"type": "text", "analyzer": "standard"},
				},
			},
			Lifecycle: IndexLifecycle{HotDays: 30, WarmDays: 180, ColdDays: 365, DeleteDays: 2555},
		},
		{
			Name: "crm-security-events", Shards: 3, Replicas: 2, RefreshMs: 1000,
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"event_id":   map[string]string{"type": "keyword"},
					"threat_type": map[string]string{"type": "keyword"},
					"severity":   map[string]string{"type": "keyword"},
					"source_ip":  map[string]string{"type": "ip"},
					"target":     map[string]string{"type": "keyword"},
					"blocked":    map[string]string{"type": "boolean"},
					"rule_id":    map[string]string{"type": "keyword"},
					"timestamp":  map[string]string{"type": "date"},
				},
			},
			Lifecycle: IndexLifecycle{HotDays: 30, WarmDays: 90, ColdDays: 365, DeleteDays: 2555},
		},
		{
			Name: "crm-campaigns", Shards: 3, Replicas: 1, RefreshMs: 5000,
			Mappings: map[string]interface{}{
				"properties": map[string]interface{}{
					"campaign_id":  map[string]string{"type": "keyword"},
					"tenant_id":    map[string]string{"type": "keyword"},
					"name":         map[string]interface{}{"type": "text", "analyzer": "standard"},
					"channel":      map[string]string{"type": "keyword"},
					"status":       map[string]string{"type": "keyword"},
					"sent":         map[string]string{"type": "integer"},
					"delivered":    map[string]string{"type": "integer"},
					"opened":       map[string]string{"type": "integer"},
					"converted":    map[string]string{"type": "integer"},
					"created_at":   map[string]string{"type": "date"},
				},
			},
			Lifecycle: IndexLifecycle{HotDays: 90, WarmDays: 365, ColdDays: 730, DeleteDays: 2555},
		},
	}
}

// OpenSearch Dashboards configuration
type DashboardConfig struct {
	Name        string            `json:"name"`
	IndexPattern string           `json:"index_pattern"`
	TimeField   string            `json:"time_field"`
	Panels      []DashboardPanel  `json:"panels"`
}

type DashboardPanel struct {
	Title string `json:"title"`
	Type  string `json:"type"` // visualization, search, lens, map
	Query string `json:"query,omitempty"`
}

func CRMDashboards() []DashboardConfig {
	return []DashboardConfig{
		{
			Name: "CRM Operations Overview", IndexPattern: "crm-*", TimeField: "timestamp",
			Panels: []DashboardPanel{
				{Title: "Total Customers", Type: "metric"},
				{Title: "Transaction Volume", Type: "line_chart"},
				{Title: "Customer Growth", Type: "area_chart"},
				{Title: "Revenue by Product", Type: "pie_chart"},
			},
		},
		{
			Name: "Security Monitor", IndexPattern: "crm-security-*", TimeField: "timestamp",
			Panels: []DashboardPanel{
				{Title: "Threats Blocked", Type: "metric"},
				{Title: "Attack Timeline", Type: "line_chart"},
				{Title: "Top Source IPs", Type: "data_table"},
				{Title: "Threat Categories", Type: "pie_chart"},
				{Title: "Geographic Threat Map", Type: "map"},
			},
		},
		{
			Name: "Audit Trail", IndexPattern: "crm-audit-*", TimeField: "timestamp",
			Panels: []DashboardPanel{
				{Title: "Recent Events", Type: "data_table"},
				{Title: "Events by Category", Type: "bar_chart"},
				{Title: "Events by Severity", Type: "pie_chart"},
				{Title: "Top Actors", Type: "data_table"},
			},
		},
	}
}

func init() {
	_ = time.Now
}
