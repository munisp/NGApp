package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Lakehouse Architecture Models for Advanced Analytics and Geospatial Processing

// DataLake represents a data lake configuration
type DataLake struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;unique;index"`
	Description   string         `json:"description"`
	Type          string         `json:"type" gorm:"not null;index"` // delta, iceberg, hudi
	StoragePath   string         `json:"storage_path" gorm:"not null"`
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	Schema        string         `json:"schema" gorm:"type:jsonb"`
	Partitioning  string         `json:"partitioning" gorm:"type:jsonb"`
	Compression   string         `json:"compression" gorm:"default:'snappy'"`
	Format        string         `json:"format" gorm:"default:'parquet'"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// DeltaTable represents a Delta Lake table
type DeltaTable struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	DataLakeID    uuid.UUID      `json:"data_lake_id" gorm:"not null;index"`
	DataLake      *DataLake      `json:"data_lake,omitempty"`
	Name          string         `json:"name" gorm:"not null;index"`
	TablePath     string         `json:"table_path" gorm:"not null"`
	Schema        string         `json:"schema" gorm:"type:jsonb;not null"`
	Partitions    string         `json:"partitions" gorm:"type:jsonb"`
	Properties    string         `json:"properties" gorm:"type:jsonb"`
	Version       int64          `json:"version" gorm:"default:0"`
	RowCount      int64          `json:"row_count" gorm:"default:0"`
	SizeBytes     int64          `json:"size_bytes" gorm:"default:0"`
	LastOptimized *time.Time     `json:"last_optimized"`
	LastVacuumed  *time.Time     `json:"last_vacuumed"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SparkJob represents an Apache Spark job
type SparkJob struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	JobType       string         `json:"job_type" gorm:"not null;index"` // batch, streaming, ml, sql
	ApplicationID string         `json:"application_id" gorm:"index"`
	DriverID      string         `json:"driver_id" gorm:"index"`
	Status        string         `json:"status" gorm:"not null;index"` // pending, running, completed, failed, cancelled
	Priority      int            `json:"priority" gorm:"default:0"`
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	Code          string         `json:"code" gorm:"type:text"`
	InputTables   string         `json:"input_tables" gorm:"type:jsonb"`
	OutputTables  string         `json:"output_tables" gorm:"type:jsonb"`
	Parameters    string         `json:"parameters" gorm:"type:jsonb"`
	Schedule      string         `json:"schedule"` // cron expression
	StartTime     *time.Time     `json:"start_time"`
	EndTime       *time.Time     `json:"end_time"`
	Duration      *int64         `json:"duration"` // milliseconds
	ErrorMessage  string         `json:"error_message"`
	LogPath       string         `json:"log_path"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// DataFusionQuery represents an Apache DataFusion query
type DataFusionQuery struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name         string         `json:"name" gorm:"not null;index"`
	Description  string         `json:"description"`
	QueryType    string         `json:"query_type" gorm:"not null;index"` // sql, logical_plan, physical_plan
	SQL          string         `json:"sql" gorm:"type:text"`
	LogicalPlan  string         `json:"logical_plan" gorm:"type:text"`
	PhysicalPlan string         `json:"physical_plan" gorm:"type:text"`
	Status       string         `json:"status" gorm:"not null;index"` // pending, running, completed, failed
	ExecutionTime *int64        `json:"execution_time"` // milliseconds
	RowsReturned *int64         `json:"rows_returned"`
	BytesScanned *int64         `json:"bytes_scanned"`
	ErrorMessage string         `json:"error_message"`
	CreatedBy    *uuid.UUID     `json:"created_by" gorm:"index"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// RayCluster represents a Ray cluster configuration
type RayCluster struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;unique;index"`
	Description   string         `json:"description"`
	ClusterType   string         `json:"cluster_type" gorm:"not null;index"` // local, kubernetes, yarn, standalone
	HeadNode      string         `json:"head_node" gorm:"type:jsonb"`
	WorkerNodes   string         `json:"worker_nodes" gorm:"type:jsonb"`
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	Status        string         `json:"status" gorm:"not null;index"` // starting, running, stopping, stopped, failed
	Namespace     string         `json:"namespace" gorm:"index"`
	Resources     string         `json:"resources" gorm:"type:jsonb"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// RayJob represents a Ray job execution
type RayJob struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ClusterID     uuid.UUID      `json:"cluster_id" gorm:"not null;index"`
	Cluster       *RayCluster    `json:"cluster,omitempty"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	JobType       string         `json:"job_type" gorm:"not null;index"` // train, tune, serve, data
	Framework     string         `json:"framework" gorm:"index"`         // pytorch, tensorflow, sklearn, xgboost
	Code          string         `json:"code" gorm:"type:text"`
	Entrypoint    string         `json:"entrypoint"`
	Parameters    string         `json:"parameters" gorm:"type:jsonb"`
	Resources     string         `json:"resources" gorm:"type:jsonb"`
	Status        string         `json:"status" gorm:"not null;index"` // pending, running, completed, failed, cancelled
	StartTime     *time.Time     `json:"start_time"`
	EndTime       *time.Time     `json:"end_time"`
	Duration      *int64         `json:"duration"` // milliseconds
	ErrorMessage  string         `json:"error_message"`
	LogPath       string         `json:"log_path"`
	ResultPath    string         `json:"result_path"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// GeospatialData represents geospatial data for Apache Sedona
type GeospatialData struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name         string         `json:"name" gorm:"not null;index"`
	Description  string         `json:"description"`
	DataType     string         `json:"data_type" gorm:"not null;index"` // point, linestring, polygon, multipoint, multilinestring, multipolygon
	GeometryType string         `json:"geometry_type" gorm:"not null"`   // WKT, WKB, GeoJSON
	Geometry     string         `json:"geometry" gorm:"type:text;not null"`
	Properties   string         `json:"properties" gorm:"type:jsonb"`
	SRID         int            `json:"srid" gorm:"default:4326"` // Spatial Reference System Identifier
	BoundingBox  string         `json:"bounding_box" gorm:"type:jsonb"`
	Area         *decimal.Decimal `json:"area" gorm:"type:decimal(15,6)"`
	Length       *decimal.Decimal `json:"length" gorm:"type:decimal(15,6)"`
	Centroid     string         `json:"centroid"`
	EntityType   string         `json:"entity_type" gorm:"index"` // customer, warehouse, supplier, territory
	EntityID     *uuid.UUID     `json:"entity_id" gorm:"index"`
	IsActive     bool           `json:"is_active" gorm:"default:true"`
	CreatedBy    *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy    *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SpatialIndex represents a spatial index for geospatial queries
type SpatialIndex struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;unique;index"`
	Description string         `json:"description"`
	IndexType   string         `json:"index_type" gorm:"not null;index"` // rtree, quadtree, kdtree, grid
	TableName   string         `json:"table_name" gorm:"not null;index"`
	ColumnName  string         `json:"column_name" gorm:"not null"`
	Configuration string       `json:"configuration" gorm:"type:jsonb"`
	Statistics  string         `json:"statistics" gorm:"type:jsonb"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SupersetDashboard represents an Apache Superset dashboard
type SupersetDashboard struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SupersetID    int            `json:"superset_id" gorm:"unique;index"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	URL           string         `json:"url"`
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	Charts        string         `json:"charts" gorm:"type:jsonb"`
	Filters       string         `json:"filters" gorm:"type:jsonb"`
	IsPublished   bool           `json:"is_published" gorm:"default:false"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// SupersetChart represents an Apache Superset chart
type SupersetChart struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SupersetID    int            `json:"superset_id" gorm:"unique;index"`
	DashboardID   *uuid.UUID     `json:"dashboard_id" gorm:"index"`
	Dashboard     *SupersetDashboard `json:"dashboard,omitempty"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	ChartType     string         `json:"chart_type" gorm:"not null;index"`
	DatasetID     int            `json:"dataset_id" gorm:"index"`
	Query         string         `json:"query" gorm:"type:text"`
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	URL           string         `json:"url"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// DataPipeline represents a data processing pipeline
type DataPipeline struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	Type          string         `json:"type" gorm:"not null;index"` // etl, elt, streaming, batch
	Source        string         `json:"source" gorm:"type:jsonb"`
	Destination   string         `json:"destination" gorm:"type:jsonb"`
	Transformations string       `json:"transformations" gorm:"type:jsonb"`
	Schedule      string         `json:"schedule"` // cron expression
	Configuration string         `json:"configuration" gorm:"type:jsonb"`
	Status        string         `json:"status" gorm:"not null;index"` // active, inactive, running, failed
	LastRun       *time.Time     `json:"last_run"`
	NextRun       *time.Time     `json:"next_run"`
	RunCount      int            `json:"run_count" gorm:"default:0"`
	SuccessCount  int            `json:"success_count" gorm:"default:0"`
	FailureCount  int            `json:"failure_count" gorm:"default:0"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// PipelineExecution represents a pipeline execution instance
type PipelineExecution struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PipelineID   uuid.UUID      `json:"pipeline_id" gorm:"not null;index"`
	Pipeline     *DataPipeline  `json:"pipeline,omitempty"`
	Status       string         `json:"status" gorm:"not null;index"` // pending, running, completed, failed, cancelled
	StartTime    time.Time      `json:"start_time"`
	EndTime      *time.Time     `json:"end_time"`
	Duration     *int64         `json:"duration"` // milliseconds
	RecordsRead  *int64         `json:"records_read"`
	RecordsWritten *int64       `json:"records_written"`
	BytesRead    *int64         `json:"bytes_read"`
	BytesWritten *int64         `json:"bytes_written"`
	ErrorMessage string         `json:"error_message"`
	LogPath      string         `json:"log_path"`
	Metrics      string         `json:"metrics" gorm:"type:jsonb"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// DataCatalog represents a data catalog entry
type DataCatalog struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"not null;index"`
	Description   string         `json:"description"`
	Type          string         `json:"type" gorm:"not null;index"` // table, view, dataset, file, api
	Source        string         `json:"source" gorm:"not null;index"`
	Schema        string         `json:"schema" gorm:"type:jsonb"`
	Location      string         `json:"location"`
	Format        string         `json:"format"`
	Size          *int64         `json:"size"`
	RowCount      *int64         `json:"row_count"`
	ColumnCount   *int           `json:"column_count"`
	Tags          string         `json:"tags" gorm:"type:jsonb"`
	Metadata      string         `json:"metadata" gorm:"type:jsonb"`
	Lineage       string         `json:"lineage" gorm:"type:jsonb"`
	Quality       string         `json:"quality" gorm:"type:jsonb"`
	LastUpdated   *time.Time     `json:"last_updated"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedBy     *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy     *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Enum constants for Lakehouse models

// Data Lake Types
const (
	DataLakeTypeDelta   = "delta"
	DataLakeTypeIceberg = "iceberg"
	DataLakeTypeHudi    = "hudi"
)

// Spark Job Types
const (
	SparkJobTypeBatch     = "batch"
	SparkJobTypeStreaming = "streaming"
	SparkJobTypeML        = "ml"
	SparkJobTypeSQL       = "sql"
)

// Job Statuses
const (
	JobStatusPending   = "pending"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusCancelled = "cancelled"
)

// Ray Cluster Types
const (
	RayClusterTypeLocal      = "local"
	RayClusterTypeKubernetes = "kubernetes"
	RayClusterTypeYarn       = "yarn"
	RayClusterTypeStandalone = "standalone"
)

// Ray Job Types
const (
	RayJobTypeTrain = "train"
	RayJobTypeTune  = "tune"
	RayJobTypeServe = "serve"
	RayJobTypeData  = "data"
)

// Geospatial Data Types
const (
	GeospatialDataTypePoint           = "point"
	GeospatialDataTypeLineString      = "linestring"
	GeospatialDataTypePolygon         = "polygon"
	GeospatialDataTypeMultiPoint      = "multipoint"
	GeospatialDataTypeMultiLineString = "multilinestring"
	GeospatialDataTypeMultiPolygon    = "multipolygon"
)

// Spatial Index Types
const (
	SpatialIndexTypeRTree    = "rtree"
	SpatialIndexTypeQuadTree = "quadtree"
	SpatialIndexTypeKDTree   = "kdtree"
	SpatialIndexTypeGrid     = "grid"
)

// Pipeline Types
const (
	PipelineTypeETL       = "etl"
	PipelineTypeELT       = "elt"
	PipelineTypeStreaming = "streaming"
	PipelineTypeBatch     = "batch"
)

// Data Catalog Types
const (
	DataCatalogTypeTable   = "table"
	DataCatalogTypeView    = "view"
	DataCatalogTypeDataset = "dataset"
	DataCatalogTypeFile    = "file"
	DataCatalogTypeAPI     = "api"
)

// Table names

func (DataLake) TableName() string {
	return "data_lakes"
}

func (DeltaTable) TableName() string {
	return "delta_tables"
}

func (SparkJob) TableName() string {
	return "spark_jobs"
}

func (DataFusionQuery) TableName() string {
	return "datafusion_queries"
}

func (RayCluster) TableName() string {
	return "ray_clusters"
}

func (RayJob) TableName() string {
	return "ray_jobs"
}

func (GeospatialData) TableName() string {
	return "geospatial_data"
}

func (SpatialIndex) TableName() string {
	return "spatial_indexes"
}

func (SupersetDashboard) TableName() string {
	return "superset_dashboards"
}

func (SupersetChart) TableName() string {
	return "superset_charts"
}

func (DataPipeline) TableName() string {
	return "data_pipelines"
}

func (PipelineExecution) TableName() string {
	return "pipeline_executions"
}

func (DataCatalog) TableName() string {
	return "data_catalog"
}

// Business logic methods

// BeforeCreate hooks
func (d *DataLake) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

func (dt *DeltaTable) BeforeCreate(tx *gorm.DB) error {
	if dt.ID == uuid.Nil {
		dt.ID = uuid.New()
	}
	return nil
}

func (sj *SparkJob) BeforeCreate(tx *gorm.DB) error {
	if sj.ID == uuid.Nil {
		sj.ID = uuid.New()
	}
	return nil
}

func (gd *GeospatialData) BeforeCreate(tx *gorm.DB) error {
	if gd.ID == uuid.Nil {
		gd.ID = uuid.New()
	}
	return nil
}

// IsCompleted checks if a job is completed
func (sj *SparkJob) IsCompleted() bool {
	return sj.Status == JobStatusCompleted
}

// IsFailed checks if a job has failed
func (sj *SparkJob) IsFailed() bool {
	return sj.Status == JobStatusFailed
}

// IsRunning checks if a job is running
func (sj *SparkJob) IsRunning() bool {
	return sj.Status == JobStatusRunning
}

// CalculateDuration calculates job duration
func (sj *SparkJob) CalculateDuration() *int64 {
	if sj.StartTime != nil && sj.EndTime != nil {
		duration := sj.EndTime.Sub(*sj.StartTime).Milliseconds()
		return &duration
	}
	return nil
}

// GetSuccessRate calculates pipeline success rate
func (dp *DataPipeline) GetSuccessRate() float64 {
	if dp.RunCount == 0 {
		return 0.0
	}
	return float64(dp.SuccessCount) / float64(dp.RunCount) * 100.0
}

// GetFailureRate calculates pipeline failure rate
func (dp *DataPipeline) GetFailureRate() float64 {
	if dp.RunCount == 0 {
		return 0.0
	}
	return float64(dp.FailureCount) / float64(dp.RunCount) * 100.0
}

// CalculateThroughput calculates pipeline throughput (records per second)
func (pe *PipelineExecution) CalculateThroughput() *float64 {
	if pe.Duration == nil || *pe.Duration == 0 || pe.RecordsRead == nil {
		return nil
	}
	
	seconds := float64(*pe.Duration) / 1000.0
	throughput := float64(*pe.RecordsRead) / seconds
	return &throughput
}

