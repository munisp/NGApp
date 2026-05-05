package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OpenSearch Models for Platform-Wide Search Capabilities

// SearchIndex represents an OpenSearch index configuration
type SearchIndex struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;unique;index"`
	DisplayName   string         `json:"display_name" gorm:"not null"`
	Description   string         `json:"description"`
	IndexName     string         `json:"index_name" gorm:"not null;unique"` // OpenSearch index name
	EntityType    string         `json:"entity_type" gorm:"not null;index"` // customer, product, lead, opportunity, etc.
	Mapping       string         `json:"mapping" gorm:"type:jsonb;not null"`
	Settings      string         `json:"settings" gorm:"type:jsonb"`
	Aliases       string         `json:"aliases" gorm:"type:jsonb"`
	Shards        int            `json:"shards" gorm:"default:1"`
	Replicas      int            `json:"replicas" gorm:"default:1"`
	RefreshInterval string       `json:"refresh_interval" gorm:"default:'1s'"`
	DocumentCount int64          `json:"document_count" gorm:"default:0"`
	StorageSize   int64          `json:"storage_size" gorm:"default:0"` // bytes
	LastIndexed   *time.Time     `json:"last_indexed"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SearchDocument represents a document in OpenSearch
type SearchDocument struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	IndexID     uuid.UUID      `json:"index_id" gorm:"not null;index"`
	Index       *SearchIndex   `json:"index,omitempty"`
	DocumentID  string         `json:"document_id" gorm:"not null;index"` // OpenSearch document ID
	EntityType  string         `json:"entity_type" gorm:"not null;index"`
	EntityID    uuid.UUID      `json:"entity_id" gorm:"not null;index"`
	Title       string         `json:"title" gorm:"not null"`
	Content     string         `json:"content" gorm:"type:text"`
	Summary     string         `json:"summary"`
	Tags        string         `json:"tags" gorm:"type:jsonb"`
	Metadata    string         `json:"metadata" gorm:"type:jsonb"`
	Permissions string         `json:"permissions" gorm:"type:jsonb"`
	Status      string         `json:"status" gorm:"not null;index"` // indexed, pending, failed
	Version     int            `json:"version" gorm:"default:1"`
	LastIndexed *time.Time     `json:"last_indexed"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SearchQuery represents a search query execution
type SearchQuery struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	QueryText     string         `json:"query_text" gorm:"not null"`
	QueryType     string         `json:"query_type" gorm:"not null;index"` // simple, advanced, fuzzy, wildcard, regex
	Filters       string         `json:"filters" gorm:"type:jsonb"`
	Sort          string         `json:"sort" gorm:"type:jsonb"`
	Aggregations  string         `json:"aggregations" gorm:"type:jsonb"`
	Indices       string         `json:"indices" gorm:"type:jsonb"` // target indices
	UserID        *uuid.UUID     `json:"user_id" gorm:"index"`
	SessionID     string         `json:"session_id" gorm:"index"`
	IPAddress     string         `json:"ip_address"`
	UserAgent     string         `json:"user_agent"`
	ExecutionTime int64          `json:"execution_time"` // milliseconds
	ResultCount   int            `json:"result_count"`
	MaxScore      *float64       `json:"max_score"`
	TimedOut      bool           `json:"timed_out" gorm:"default:false"`
	ErrorMessage  string         `json:"error_message"`
	CreatedAt     time.Time      `json:"created_at"`
}

// SearchResult represents a search result
type SearchResult struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	QueryID      uuid.UUID      `json:"query_id" gorm:"not null;index"`
	Query        *SearchQuery   `json:"query,omitempty"`
	DocumentID   uuid.UUID      `json:"document_id" gorm:"not null;index"`
	Document     *SearchDocument `json:"document,omitempty"`
	Score        float64        `json:"score"`
	Rank         int            `json:"rank"`
	Highlights   string         `json:"highlights" gorm:"type:jsonb"`
	Explanation  string         `json:"explanation" gorm:"type:jsonb"`
	CreatedAt    time.Time      `json:"created_at"`
}

// SearchSuggestion represents search suggestions and autocomplete
type SearchSuggestion struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Text        string         `json:"text" gorm:"not null;index"`
	Type        string         `json:"type" gorm:"not null;index"` // completion, phrase, term
	EntityType  string         `json:"entity_type" gorm:"index"`
	Weight      int            `json:"weight" gorm:"default:1"`
	Frequency   int            `json:"frequency" gorm:"default:0"`
	Context     string         `json:"context" gorm:"type:jsonb"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SearchAnalytics represents search analytics and insights
type SearchAnalytics struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Date          time.Time      `json:"date" gorm:"not null;index"`
	QueryText     string         `json:"query_text" gorm:"not null;index"`
	QueryCount    int            `json:"query_count" gorm:"default:1"`
	ClickCount    int            `json:"click_count" gorm:"default:0"`
	ClickThrough  float64        `json:"click_through" gorm:"default:0.0"`
	AvgPosition   float64        `json:"avg_position" gorm:"default:0.0"`
	AvgScore      float64        `json:"avg_score" gorm:"default:0.0"`
	ZeroResults   int            `json:"zero_results" gorm:"default:0"`
	EntityType    string         `json:"entity_type" gorm:"index"`
	UserSegment   string         `json:"user_segment" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// SearchTemplate represents saved search templates
type SearchTemplate struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	Template    string         `json:"template" gorm:"type:jsonb;not null"`
	Parameters  string         `json:"parameters" gorm:"type:jsonb"`
	EntityTypes string         `json:"entity_types" gorm:"type:jsonb"`
	IsPublic    bool           `json:"is_public" gorm:"default:false"`
	UsageCount  int            `json:"usage_count" gorm:"default:0"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SearchFilter represents saved search filters
type SearchFilter struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	FilterType  string         `json:"filter_type" gorm:"not null;index"` // term, range, exists, bool, geo
	Field       string         `json:"field" gorm:"not null"`
	Operator    string         `json:"operator" gorm:"not null"` // eq, ne, gt, lt, gte, lte, in, not_in, exists, range
	Value       string         `json:"value" gorm:"type:jsonb"`
	EntityTypes string         `json:"entity_types" gorm:"type:jsonb"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SearchConfiguration represents OpenSearch cluster configuration
type SearchConfiguration struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;unique;index"`
	Description   string         `json:"description"`
	ClusterName   string         `json:"cluster_name" gorm:"not null"`
	Endpoints     string         `json:"endpoints" gorm:"type:jsonb;not null"`
	Username      string         `json:"username"`
	Password      string         `json:"password"`
	APIKey        string         `json:"api_key"`
	TLSConfig     string         `json:"tls_config" gorm:"type:jsonb"`
	Timeout       int            `json:"timeout" gorm:"default:30"` // seconds
	MaxRetries    int            `json:"max_retries" gorm:"default:3"`
	Settings      string         `json:"settings" gorm:"type:jsonb"`
	IsDefault     bool           `json:"is_default" gorm:"default:false"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// IndexingJob represents a background indexing job
type IndexingJob struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	JobType       string         `json:"job_type" gorm:"not null;index"` // full, incremental, delta
	IndexID       uuid.UUID      `json:"index_id" gorm:"not null;index"`
	Index         *SearchIndex   `json:"index,omitempty"`
	EntityType    string         `json:"entity_type" gorm:"not null;index"`
	Query         string         `json:"query" gorm:"type:text"`
	BatchSize     int            `json:"batch_size" gorm:"default:1000"`
	Status        string         `json:"status" gorm:"not null;index"` // pending, running, completed, failed, cancelled
	Progress      int            `json:"progress" gorm:"default:0"` // percentage
	StartTime     *time.Time     `json:"start_time"`
	EndTime       *time.Time     `json:"end_time"`
	Duration      *int64         `json:"duration"` // milliseconds
	RecordsTotal  int64          `json:"records_total" gorm:"default:0"`
	RecordsIndexed int64         `json:"records_indexed" gorm:"default:0"`
	RecordsFailed int64          `json:"records_failed" gorm:"default:0"`
	ErrorMessage  string         `json:"error_message"`
	LogPath       string         `json:"log_path"`
	Schedule      string         `json:"schedule"` // cron expression
	LastRun       *time.Time     `json:"last_run"`
	NextRun       *time.Time     `json:"next_run"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// SearchFacet represents search facets for filtering
type SearchFacet struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	DisplayName string         `json:"display_name" gorm:"not null"`
	Field       string         `json:"field" gorm:"not null"`
	FacetType   string         `json:"facet_type" gorm:"not null;index"` // terms, range, date_histogram, geo_distance
	Configuration string       `json:"configuration" gorm:"type:jsonb"`
	EntityTypes string         `json:"entity_types" gorm:"type:jsonb"`
	Order       int            `json:"order" gorm:"default:0"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Enum constants for Search models

// Query Types
const (
	QueryTypeSimple   = "simple"
	QueryTypeAdvanced = "advanced"
	QueryTypeFuzzy    = "fuzzy"
	QueryTypeWildcard = "wildcard"
	QueryTypeRegex    = "regex"
)

// Document Statuses
const (
	DocumentStatusIndexed = "indexed"
	DocumentStatusPending = "pending"
	DocumentStatusFailed  = "failed"
)

// Suggestion Types
const (
	SuggestionTypeCompletion = "completion"
	SuggestionTypePhrase     = "phrase"
	SuggestionTypeTerm       = "term"
)

// Filter Types
const (
	FilterTypeTerm   = "term"
	FilterTypeRange  = "range"
	FilterTypeExists = "exists"
	FilterTypeBool   = "bool"
	FilterTypeGeo    = "geo"
)

// Filter Operators
const (
	FilterOperatorEQ    = "eq"
	FilterOperatorNE    = "ne"
	FilterOperatorGT    = "gt"
	FilterOperatorLT    = "lt"
	FilterOperatorGTE   = "gte"
	FilterOperatorLTE   = "lte"
	FilterOperatorIn    = "in"
	FilterOperatorNotIn = "not_in"
	FilterOperatorExists = "exists"
	FilterOperatorRange = "range"
)

// Indexing Job Types
const (
	IndexingJobTypeFull        = "full"
	IndexingJobTypeIncremental = "incremental"
	IndexingJobTypeDelta       = "delta"
)

// Facet Types
const (
	FacetTypeTerms         = "terms"
	FacetTypeRange         = "range"
	FacetTypeDateHistogram = "date_histogram"
	FacetTypeGeoDistance   = "geo_distance"
)

// Entity Types for Search
const (
	EntityTypeCustomer     = "customer"
	EntityTypeProduct      = "product"
	EntityTypeLead         = "lead"
	EntityTypeOpportunity  = "opportunity"
	EntityTypeAccount      = "account"
	EntityTypeContact      = "contact"
	EntityTypeSupplier     = "supplier"
	EntityTypeWarehouse    = "warehouse"
	EntityTypeInventory    = "inventory"
	EntityTypeOrder        = "order"
	EntityTypeInvoice      = "invoice"
	EntityTypeDocument     = "document"
	EntityTypeKnowledge    = "knowledge"
)

// Table names

func (SearchIndex) TableName() string {
	return "search_indexes"
}

func (SearchDocument) TableName() string {
	return "search_documents"
}

func (SearchQuery) TableName() string {
	return "search_queries"
}

func (SearchResult) TableName() string {
	return "search_results"
}

func (SearchSuggestion) TableName() string {
	return "search_suggestions"
}

func (SearchAnalytics) TableName() string {
	return "search_analytics"
}

func (SearchTemplate) TableName() string {
	return "search_templates"
}

func (SearchFilter) TableName() string {
	return "search_filters"
}

func (SearchConfiguration) TableName() string {
	return "search_configurations"
}

func (IndexingJob) TableName() string {
	return "indexing_jobs"
}

func (SearchFacet) TableName() string {
	return "search_facets"
}

// Business logic methods

// BeforeCreate hooks
func (si *SearchIndex) BeforeCreate(tx *gorm.DB) error {
	if si.ID == uuid.Nil {
		si.ID = uuid.New()
	}
	return nil
}

func (sd *SearchDocument) BeforeCreate(tx *gorm.DB) error {
	if sd.ID == uuid.Nil {
		sd.ID = uuid.New()
	}
	return nil
}

func (sq *SearchQuery) BeforeCreate(tx *gorm.DB) error {
	if sq.ID == uuid.Nil {
		sq.ID = uuid.New()
	}
	return nil
}

func (st *SearchTemplate) BeforeCreate(tx *gorm.DB) error {
	if st.ID == uuid.Nil {
		st.ID = uuid.New()
	}
	return nil
}

// IsCompleted checks if an indexing job is completed
func (ij *IndexingJob) IsCompleted() bool {
	return ij.Status == JobStatusCompleted
}

// IsFailed checks if an indexing job has failed
func (ij *IndexingJob) IsFailed() bool {
	return ij.Status == JobStatusFailed
}

// IsRunning checks if an indexing job is running
func (ij *IndexingJob) IsRunning() bool {
	return ij.Status == JobStatusRunning
}

// CalculateProgress calculates indexing progress percentage
func (ij *IndexingJob) CalculateProgress() int {
	if ij.RecordsTotal == 0 {
		return 0
	}
	return int((ij.RecordsIndexed * 100) / ij.RecordsTotal)
}

// CalculateSuccessRate calculates indexing success rate
func (ij *IndexingJob) CalculateSuccessRate() float64 {
	total := ij.RecordsIndexed + ij.RecordsFailed
	if total == 0 {
		return 0.0
	}
	return float64(ij.RecordsIndexed) / float64(total) * 100.0
}

// CalculateClickThrough calculates click-through rate for search analytics
func (sa *SearchAnalytics) CalculateClickThrough() float64 {
	if sa.QueryCount == 0 {
		return 0.0
	}
	return float64(sa.ClickCount) / float64(sa.QueryCount) * 100.0
}

// IncrementUsage increments template usage count
func (st *SearchTemplate) IncrementUsage(tx *gorm.DB) error {
	return tx.Model(st).Update("usage_count", gorm.Expr("usage_count + ?", 1)).Error
}

// IncrementFrequency increments suggestion frequency
func (ss *SearchSuggestion) IncrementFrequency(tx *gorm.DB) error {
	return tx.Model(ss).Update("frequency", gorm.Expr("frequency + ?", 1)).Error
}

