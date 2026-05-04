package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Analytics Models for Cross-Service Business Intelligence

// Dashboard represents a business intelligence dashboard
type Dashboard struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	Type        string         `json:"type" gorm:"not null;index"` // executive, operational, analytical, strategic
	Category    string         `json:"category" gorm:"index"`      // sales, marketing, inventory, finance, customer
	Layout      string         `json:"layout" gorm:"type:jsonb"`   // Dashboard layout configuration
	Widgets     []Widget       `json:"widgets" gorm:"foreignKey:DashboardID"`
	IsPublic    bool           `json:"is_public" gorm:"default:false"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Widget represents a dashboard widget
type Widget struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	DashboardID  uuid.UUID      `json:"dashboard_id" gorm:"not null;index"`
	Dashboard    *Dashboard     `json:"dashboard,omitempty"`
	Name         string         `json:"name" gorm:"not null"`
	Type         string         `json:"type" gorm:"not null"` // chart, table, metric, gauge, map
	ChartType    string         `json:"chart_type"`           // line, bar, pie, donut, area, scatter
	DataSource   string         `json:"data_source" gorm:"not null"`
	Query        string         `json:"query" gorm:"type:text"`
	Configuration string        `json:"configuration" gorm:"type:jsonb"`
	Position     int            `json:"position" gorm:"default:0"`
	Width        int            `json:"width" gorm:"default:4"`
	Height       int            `json:"height" gorm:"default:3"`
	RefreshRate  int            `json:"refresh_rate" gorm:"default:300"` // seconds
	IsActive     bool           `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Report represents a business report
type Report struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	Type        string         `json:"type" gorm:"not null;index"` // scheduled, adhoc, template
	Category    string         `json:"category" gorm:"index"`      // sales, marketing, inventory, finance, customer
	Format      string         `json:"format" gorm:"not null"`     // pdf, excel, csv, json
	Query       string         `json:"query" gorm:"type:text;not null"`
	Parameters  string         `json:"parameters" gorm:"type:jsonb"`
	Schedule    string         `json:"schedule"`                   // cron expression
	Recipients  string         `json:"recipients" gorm:"type:jsonb"` // email list
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	LastRun     *time.Time     `json:"last_run"`
	NextRun     *time.Time     `json:"next_run"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// ReportExecution represents a report execution instance
type ReportExecution struct {
	ID         uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ReportID   uuid.UUID       `json:"report_id" gorm:"not null;index"`
	Report     *Report         `json:"report,omitempty"`
	Status     string          `json:"status" gorm:"not null;index"` // pending, running, completed, failed
	StartTime  time.Time       `json:"start_time"`
	EndTime    *time.Time      `json:"end_time"`
	Duration   *int64          `json:"duration"` // milliseconds
	FileSize   *int64          `json:"file_size"` // bytes
	FilePath   string          `json:"file_path"`
	Error      string          `json:"error"`
	Parameters string          `json:"parameters" gorm:"type:jsonb"`
	CreatedBy  *uuid.UUID      `json:"created_by" gorm:"index"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	DeletedAt  gorm.DeletedAt  `json:"deleted_at" gorm:"index"`
}

// Metric represents a business metric
type Metric struct {
	ID          uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string          `json:"name" gorm:"not null;index"`
	DisplayName string          `json:"display_name" gorm:"not null"`
	Description string          `json:"description"`
	Category    string          `json:"category" gorm:"not null;index"` // sales, marketing, inventory, finance, customer
	Type        string          `json:"type" gorm:"not null"`           // counter, gauge, histogram, summary
	Unit        string          `json:"unit"`                           // currency, percentage, count, time
	Query       string          `json:"query" gorm:"type:text;not null"`
	Aggregation string          `json:"aggregation" gorm:"not null"`    // sum, avg, count, min, max
	Frequency   string          `json:"frequency" gorm:"not null"`      // realtime, hourly, daily, weekly, monthly
	Target      *decimal.Decimal `json:"target" gorm:"type:decimal(15,2)"`
	IsActive    bool            `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID      `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID      `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `json:"deleted_at" gorm:"index"`
}

// MetricValue represents a metric value at a point in time
type MetricValue struct {
	ID        uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MetricID  uuid.UUID       `json:"metric_id" gorm:"not null;index"`
	Metric    *Metric         `json:"metric,omitempty"`
	Value     decimal.Decimal `json:"value" gorm:"type:decimal(15,2);not null"`
	Timestamp time.Time       `json:"timestamp" gorm:"not null;index"`
	Dimensions string         `json:"dimensions" gorm:"type:jsonb"` // Additional dimensions like region, product, etc.
	CreatedAt time.Time       `json:"created_at"`
}

// Alert represents a business alert
type Alert struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	MetricID    *uuid.UUID     `json:"metric_id" gorm:"index"`
	Metric      *Metric        `json:"metric,omitempty"`
	Condition   string         `json:"condition" gorm:"not null"` // gt, lt, eq, ne, gte, lte
	Threshold   decimal.Decimal `json:"threshold" gorm:"type:decimal(15,2);not null"`
	Severity    string         `json:"severity" gorm:"not null;index"` // low, medium, high, critical
	Status      string         `json:"status" gorm:"not null;index"`   // active, inactive, triggered, resolved
	Query       string         `json:"query" gorm:"type:text"`
	Recipients  string         `json:"recipients" gorm:"type:jsonb"` // notification recipients
	LastTriggered *time.Time   `json:"last_triggered"`
	TriggerCount  int          `json:"trigger_count" gorm:"default:0"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// AlertExecution represents an alert execution instance
type AlertExecution struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AlertID     uuid.UUID      `json:"alert_id" gorm:"not null;index"`
	Alert       *Alert         `json:"alert,omitempty"`
	Status      string         `json:"status" gorm:"not null;index"` // triggered, resolved, acknowledged
	Value       decimal.Decimal `json:"value" gorm:"type:decimal(15,2)"`
	Threshold   decimal.Decimal `json:"threshold" gorm:"type:decimal(15,2)"`
	Message     string         `json:"message"`
	NotifiedAt  *time.Time     `json:"notified_at"`
	AcknowledgedAt *time.Time  `json:"acknowledged_at"`
	AcknowledgedBy *uuid.UUID  `json:"acknowledged_by" gorm:"index"`
	ResolvedAt  *time.Time     `json:"resolved_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// DataSource represents an external data source
type DataSource struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name         string         `json:"name" gorm:"not null;unique;index"`
	Type         string         `json:"type" gorm:"not null;index"` // database, api, file, stream
	ConnectionString string     `json:"connection_string"`
	Configuration string        `json:"configuration" gorm:"type:jsonb"`
	IsActive     bool           `json:"is_active" gorm:"default:true"`
	LastSync     *time.Time     `json:"last_sync"`
	SyncStatus   string         `json:"sync_status" gorm:"index"` // success, failed, in_progress
	CreatedBy    *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy    *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// AnalyticsEvent represents an analytics event for tracking
type AnalyticsEvent struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	EventType  string         `json:"event_type" gorm:"not null;index"`
	Source     string         `json:"source" gorm:"not null;index"`
	EntityType string         `json:"entity_type" gorm:"index"`
	EntityID   *uuid.UUID     `json:"entity_id" gorm:"index"`
	UserID     *uuid.UUID     `json:"user_id" gorm:"index"`
	SessionID  string         `json:"session_id" gorm:"index"`
	Properties string         `json:"properties" gorm:"type:jsonb"`
	Timestamp  time.Time      `json:"timestamp" gorm:"not null;index"`
	IPAddress  string         `json:"ip_address"`
	UserAgent  string         `json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`
}

// KPI represents a Key Performance Indicator
type KPI struct {
	ID          uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string          `json:"name" gorm:"not null;index"`
	DisplayName string          `json:"display_name" gorm:"not null"`
	Description string          `json:"description"`
	Category    string          `json:"category" gorm:"not null;index"`
	Formula     string          `json:"formula" gorm:"type:text;not null"`
	Unit        string          `json:"unit"`
	Target      *decimal.Decimal `json:"target" gorm:"type:decimal(15,2)"`
	Frequency   string          `json:"frequency" gorm:"not null"` // daily, weekly, monthly, quarterly, yearly
	IsActive    bool            `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID      `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID      `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `json:"deleted_at" gorm:"index"`
}

// KPIValue represents a KPI value at a point in time
type KPIValue struct {
	ID        uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	KPIID     uuid.UUID       `json:"kpi_id" gorm:"not null;index"`
	KPI       *KPI            `json:"kpi,omitempty"`
	Value     decimal.Decimal `json:"value" gorm:"type:decimal(15,2);not null"`
	Target    *decimal.Decimal `json:"target" gorm:"type:decimal(15,2)"`
	Period    string          `json:"period" gorm:"not null;index"` // 2024-01, 2024-Q1, 2024-W01, 2024-01-01
	Timestamp time.Time       `json:"timestamp" gorm:"not null;index"`
	CreatedAt time.Time       `json:"created_at"`
}

// Cohort represents a customer cohort for analysis
type Cohort struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	Criteria    string         `json:"criteria" gorm:"type:jsonb;not null"`
	Size        int            `json:"size" gorm:"default:0"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Segment represents a customer segment
type Segment struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"not null;index"`
	Description string         `json:"description"`
	Type        string         `json:"type" gorm:"not null;index"` // demographic, behavioral, geographic, psychographic
	Criteria    string         `json:"criteria" gorm:"type:jsonb;not null"`
	Size        int            `json:"size" gorm:"default:0"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	CreatedBy   *uuid.UUID     `json:"created_by" gorm:"index"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Enum constants

// Dashboard Types
const (
	DashboardTypeExecutive   = "executive"
	DashboardTypeOperational = "operational"
	DashboardTypeAnalytical  = "analytical"
	DashboardTypeStrategic   = "strategic"
)

// Dashboard Categories
const (
	DashboardCategorySales     = "sales"
	DashboardCategoryMarketing = "marketing"
	DashboardCategoryInventory = "inventory"
	DashboardCategoryFinance   = "finance"
	DashboardCategoryCustomer  = "customer"
)

// Widget Types
const (
	WidgetTypeChart  = "chart"
	WidgetTypeTable  = "table"
	WidgetTypeMetric = "metric"
	WidgetTypeGauge  = "gauge"
	WidgetTypeMap    = "map"
)

// Chart Types
const (
	ChartTypeLine    = "line"
	ChartTypeBar     = "bar"
	ChartTypePie     = "pie"
	ChartTypeDonut   = "donut"
	ChartTypeArea    = "area"
	ChartTypeScatter = "scatter"
)

// Report Types
const (
	ReportTypeScheduled = "scheduled"
	ReportTypeAdhoc     = "adhoc"
	ReportTypeTemplate  = "template"
)

// Report Formats
const (
	ReportFormatPDF   = "pdf"
	ReportFormatExcel = "excel"
	ReportFormatCSV   = "csv"
	ReportFormatJSON  = "json"
)

// Metric Types
const (
	MetricTypeCounter   = "counter"
	MetricTypeGauge     = "gauge"
	MetricTypeHistogram = "histogram"
	MetricTypeSummary   = "summary"
)

// Metric Units
const (
	MetricUnitCurrency   = "currency"
	MetricUnitPercentage = "percentage"
	MetricUnitCount      = "count"
	MetricUnitTime       = "time"
)

// Alert Conditions
const (
	AlertConditionGT  = "gt"  // greater than
	AlertConditionLT  = "lt"  // less than
	AlertConditionEQ  = "eq"  // equal
	AlertConditionNE  = "ne"  // not equal
	AlertConditionGTE = "gte" // greater than or equal
	AlertConditionLTE = "lte" // less than or equal
)

// Alert Severities
const (
	AlertSeverityLow      = "low"
	AlertSeverityMedium   = "medium"
	AlertSeverityHigh     = "high"
	AlertSeverityCritical = "critical"
)

// Alert Statuses
const (
	AlertStatusActive    = "active"
	AlertStatusInactive  = "inactive"
	AlertStatusTriggered = "triggered"
	AlertStatusResolved  = "resolved"
)

// Data Source Types
const (
	DataSourceTypeDatabase = "database"
	DataSourceTypeAPI      = "api"
	DataSourceTypeFile     = "file"
	DataSourceTypeStream   = "stream"
)

// Segment Types
const (
	SegmentTypeDemographic   = "demographic"
	SegmentTypeBehavioral    = "behavioral"
	SegmentTypeGeographic    = "geographic"
	SegmentTypePsychographic = "psychographic"
)

// Business logic methods

// TableName returns the table name for Dashboard
func (Dashboard) TableName() string {
	return "dashboards"
}

// TableName returns the table name for Widget
func (Widget) TableName() string {
	return "widgets"
}

// TableName returns the table name for Report
func (Report) TableName() string {
	return "reports"
}

// TableName returns the table name for ReportExecution
func (ReportExecution) TableName() string {
	return "report_executions"
}

// TableName returns the table name for Metric
func (Metric) TableName() string {
	return "metrics"
}

// TableName returns the table name for MetricValue
func (MetricValue) TableName() string {
	return "metric_values"
}

// TableName returns the table name for Alert
func (Alert) TableName() string {
	return "alerts"
}

// TableName returns the table name for AlertExecution
func (AlertExecution) TableName() string {
	return "alert_executions"
}

// TableName returns the table name for DataSource
func (DataSource) TableName() string {
	return "data_sources"
}

// TableName returns the table name for AnalyticsEvent
func (AnalyticsEvent) TableName() string {
	return "analytics_events"
}

// TableName returns the table name for KPI
func (KPI) TableName() string {
	return "kpis"
}

// TableName returns the table name for KPIValue
func (KPIValue) TableName() string {
	return "kpi_values"
}

// TableName returns the table name for Cohort
func (Cohort) TableName() string {
	return "cohorts"
}

// TableName returns the table name for Segment
func (Segment) TableName() string {
	return "segments"
}

// BeforeCreate hook for Dashboard
func (d *Dashboard) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// BeforeCreate hook for Widget
func (w *Widget) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// BeforeCreate hook for Report
func (r *Report) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// BeforeCreate hook for Metric
func (m *Metric) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// BeforeCreate hook for Alert
func (a *Alert) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// IsTriggered checks if an alert condition is met
func (a *Alert) IsTriggered(value decimal.Decimal) bool {
	switch a.Condition {
	case AlertConditionGT:
		return value.GreaterThan(a.Threshold)
	case AlertConditionLT:
		return value.LessThan(a.Threshold)
	case AlertConditionEQ:
		return value.Equal(a.Threshold)
	case AlertConditionNE:
		return !value.Equal(a.Threshold)
	case AlertConditionGTE:
		return value.GreaterThanOrEqual(a.Threshold)
	case AlertConditionLTE:
		return value.LessThanOrEqual(a.Threshold)
	default:
		return false
	}
}

// CalculateVariance calculates the variance between actual and target for KPI
func (k *KPIValue) CalculateVariance() *decimal.Decimal {
	if k.Target == nil {
		return nil
	}
	
	variance := k.Value.Sub(*k.Target)
	return &variance
}

// CalculateVariancePercentage calculates the variance percentage for KPI
func (k *KPIValue) CalculateVariancePercentage() *decimal.Decimal {
	if k.Target == nil || k.Target.IsZero() {
		return nil
	}
	
	variance := k.Value.Sub(*k.Target)
	percentage := variance.Div(*k.Target).Mul(decimal.NewFromInt(100))
	return &percentage
}

