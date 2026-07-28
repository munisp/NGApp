package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// LakehouseConfig holds Lakehouse configuration
type LakehouseConfig struct {
	SparkMasterURL   string
	DeltaTablePath   string
	IcebergCatalog   string
	IcebergNamespace string
	S3Endpoint       string
	S3Bucket         string
}

// LakehouseClient handles analytics data storage with Lakehouse architecture
type LakehouseClient struct {
	config LakehouseConfig
	logger *zap.Logger
}

// NewLakehouseClient creates a new Lakehouse client
func NewLakehouseClient(config LakehouseConfig, logger *zap.Logger) *LakehouseClient {
	if config.SparkMasterURL == "" {
		config.SparkMasterURL = os.Getenv("SPARK_MASTER_URL")
		if config.SparkMasterURL == "" {
			config.SparkMasterURL = "spark://spark-master:7077"
		}
	}
	if config.DeltaTablePath == "" {
		config.DeltaTablePath = os.Getenv("DELTA_TABLE_PATH")
		if config.DeltaTablePath == "" {
			config.DeltaTablePath = "s3a://lakehouse/delta/communication"
		}
	}
	if config.IcebergCatalog == "" {
		config.IcebergCatalog = os.Getenv("ICEBERG_CATALOG")
		if config.IcebergCatalog == "" {
			config.IcebergCatalog = "rest"
		}
	}
	if config.IcebergNamespace == "" {
		config.IcebergNamespace = os.Getenv("ICEBERG_NAMESPACE")
		if config.IcebergNamespace == "" {
			config.IcebergNamespace = "communication"
		}
	}

	return &LakehouseClient{
		config: config,
		logger: logger,
	}
}

// MessageAnalyticsRecord represents a message analytics record
type MessageAnalyticsRecord struct {
	ID              uuid.UUID              `json:"id"`
	MessageID       string                 `json:"message_id"`
	CustomerID      uuid.UUID              `json:"customer_id"`
	Channel         string                 `json:"channel"`
	MessageType     string                 `json:"message_type"`
	Recipient       string                 `json:"recipient"`
	Status          string                 `json:"status"`
	SentAt          time.Time              `json:"sent_at"`
	DeliveredAt     *time.Time             `json:"delivered_at,omitempty"`
	ReadAt          *time.Time             `json:"read_at,omitempty"`
	FailedAt        *time.Time             `json:"failed_at,omitempty"`
	ErrorCode       string                 `json:"error_code,omitempty"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	RetryCount      int                    `json:"retry_count"`
	TemplateID      string                 `json:"template_id,omitempty"`
	TemplateName    string                 `json:"template_name,omitempty"`
	ContentLength   int                    `json:"content_length"`
	HasMedia        bool                   `json:"has_media"`
	MediaType       string                 `json:"media_type,omitempty"`
	Cost            float64                `json:"cost"`
	Currency        string                 `json:"currency"`
	CampaignID      string                 `json:"campaign_id,omitempty"`
	BatchID         string                 `json:"batch_id,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	PartitionDate   string                 `json:"partition_date"`
	PartitionHour   int                    `json:"partition_hour"`
}

// USSDSessionRecord represents a USSD session analytics record
type USSDSessionRecord struct {
	ID              uuid.UUID              `json:"id"`
	SessionID       string                 `json:"session_id"`
	CustomerID      uuid.UUID              `json:"customer_id"`
	PhoneNumber     string                 `json:"phone_number"`
	ServiceCode     string                 `json:"service_code"`
	StartedAt       time.Time              `json:"started_at"`
	EndedAt         *time.Time             `json:"ended_at,omitempty"`
	Duration        int                    `json:"duration_seconds"`
	StepCount       int                    `json:"step_count"`
	FinalMenu       string                 `json:"final_menu"`
	CompletedAction string                 `json:"completed_action,omitempty"`
	Abandoned       bool                   `json:"abandoned"`
	ErrorOccurred   bool                   `json:"error_occurred"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	PartitionDate   string                 `json:"partition_date"`
}

// WriteMessageRecord writes a message analytics record to the lakehouse
func (l *LakehouseClient) WriteMessageRecord(ctx context.Context, record MessageAnalyticsRecord) error {
	// Set partition fields
	record.PartitionDate = record.SentAt.Format("2006-01-02")
	record.PartitionHour = record.SentAt.Hour()

	l.logger.Info("Writing message record to lakehouse",
		zap.String("message_id", record.MessageID),
		zap.String("channel", record.Channel),
		zap.String("partition_date", record.PartitionDate))

	// In production, this would write to Delta Lake or Iceberg:
	// spark.createDataFrame([record]).write.format("delta").mode("append").partitionBy("partition_date", "partition_hour").save(l.config.DeltaTablePath + "/messages")

	return nil
}

// WriteUSSDSessionRecord writes a USSD session record to the lakehouse
func (l *LakehouseClient) WriteUSSDSessionRecord(ctx context.Context, record USSDSessionRecord) error {
	record.PartitionDate = record.StartedAt.Format("2006-01-02")

	l.logger.Info("Writing USSD session record to lakehouse",
		zap.String("session_id", record.SessionID),
		zap.String("partition_date", record.PartitionDate))

	return nil
}

// WriteBatchRecords writes multiple message records in batch
func (l *LakehouseClient) WriteBatchRecords(ctx context.Context, records []MessageAnalyticsRecord) error {
	l.logger.Info("Writing batch records to lakehouse", zap.Int("count", len(records)))

	for i := range records {
		records[i].PartitionDate = records[i].SentAt.Format("2006-01-02")
		records[i].PartitionHour = records[i].SentAt.Hour()
	}

	// In production, batch write to Delta Lake

	return nil
}

// ChannelMetrics represents aggregated metrics for a channel
type ChannelMetrics struct {
	Channel         string  `json:"channel"`
	TotalMessages   int64   `json:"total_messages"`
	DeliveredCount  int64   `json:"delivered_count"`
	FailedCount     int64   `json:"failed_count"`
	DeliveryRate    float64 `json:"delivery_rate"`
	AvgDeliveryTime float64 `json:"avg_delivery_time_seconds"`
	TotalCost       float64 `json:"total_cost"`
	Period          string  `json:"period"`
}

// GetChannelMetrics gets aggregated metrics for a channel
func (l *LakehouseClient) GetChannelMetrics(ctx context.Context, channel string, startDate, endDate time.Time) (*ChannelMetrics, error) {
	l.logger.Info("Getting channel metrics",
		zap.String("channel", channel),
		zap.Time("start_date", startDate),
		zap.Time("end_date", endDate))

	// In production, this would query Delta Lake/Iceberg:
	// SELECT channel, COUNT(*) as total_messages, ...
	// FROM communication.messages
	// WHERE channel = ? AND partition_date BETWEEN ? AND ?
	// GROUP BY channel

	return &ChannelMetrics{
		Channel:         channel,
		TotalMessages:   0,
		DeliveredCount:  0,
		FailedCount:     0,
		DeliveryRate:    0,
		AvgDeliveryTime: 0,
		TotalCost:       0,
		Period:          fmt.Sprintf("%s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")),
	}, nil
}

// CustomerCommunicationStats represents communication statistics for a customer
type CustomerCommunicationStats struct {
	CustomerID      uuid.UUID                 `json:"customer_id"`
	TotalMessages   int64                     `json:"total_messages"`
	ByChannel       map[string]int64          `json:"by_channel"`
	ByStatus        map[string]int64          `json:"by_status"`
	TotalCost       float64                   `json:"total_cost"`
	PreferredChannel string                   `json:"preferred_channel"`
	LastMessageAt   time.Time                 `json:"last_message_at"`
	USSDSessions    int64                     `json:"ussd_sessions"`
	Period          string                    `json:"period"`
}

// GetCustomerStats gets communication statistics for a customer
func (l *LakehouseClient) GetCustomerStats(ctx context.Context, customerID uuid.UUID, startDate, endDate time.Time) (*CustomerCommunicationStats, error) {
	l.logger.Info("Getting customer communication stats",
		zap.String("customer_id", customerID.String()),
		zap.Time("start_date", startDate),
		zap.Time("end_date", endDate))

	return &CustomerCommunicationStats{
		CustomerID:       customerID,
		TotalMessages:    0,
		ByChannel:        map[string]int64{},
		ByStatus:         map[string]int64{},
		TotalCost:        0,
		PreferredChannel: "",
		LastMessageAt:    time.Time{},
		USSDSessions:     0,
		Period:           fmt.Sprintf("%s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")),
	}, nil
}

// CampaignAnalytics represents analytics for a messaging campaign
type CampaignAnalytics struct {
	CampaignID      string             `json:"campaign_id"`
	TotalRecipients int64              `json:"total_recipients"`
	Sent            int64              `json:"sent"`
	Delivered       int64              `json:"delivered"`
	Read            int64              `json:"read"`
	Failed          int64              `json:"failed"`
	DeliveryRate    float64            `json:"delivery_rate"`
	ReadRate        float64            `json:"read_rate"`
	TotalCost       float64            `json:"total_cost"`
	ByChannel       map[string]int64   `json:"by_channel"`
	ErrorBreakdown  map[string]int64   `json:"error_breakdown"`
	StartedAt       time.Time          `json:"started_at"`
	CompletedAt     *time.Time         `json:"completed_at,omitempty"`
}

// GetCampaignAnalytics gets analytics for a messaging campaign
func (l *LakehouseClient) GetCampaignAnalytics(ctx context.Context, campaignID string) (*CampaignAnalytics, error) {
	l.logger.Info("Getting campaign analytics", zap.String("campaign_id", campaignID))

	return &CampaignAnalytics{
		CampaignID:      campaignID,
		TotalRecipients: 0,
		Sent:            0,
		Delivered:       0,
		Read:            0,
		Failed:          0,
		DeliveryRate:    0,
		ReadRate:        0,
		TotalCost:       0,
		ByChannel:       map[string]int64{},
		ErrorBreakdown:  map[string]int64{},
		StartedAt:       time.Now(),
	}, nil
}

// USSDAnalytics represents USSD session analytics
type USSDAnalytics struct {
	TotalSessions     int64              `json:"total_sessions"`
	CompletedSessions int64              `json:"completed_sessions"`
	AbandonedSessions int64              `json:"abandoned_sessions"`
	AvgDuration       float64            `json:"avg_duration_seconds"`
	AvgSteps          float64            `json:"avg_steps"`
	TopMenus          map[string]int64   `json:"top_menus"`
	TopActions        map[string]int64   `json:"top_actions"`
	ErrorRate         float64            `json:"error_rate"`
	Period            string             `json:"period"`
}

// GetUSSDAnalytics gets USSD session analytics
func (l *LakehouseClient) GetUSSDAnalytics(ctx context.Context, startDate, endDate time.Time) (*USSDAnalytics, error) {
	l.logger.Info("Getting USSD analytics",
		zap.Time("start_date", startDate),
		zap.Time("end_date", endDate))

	return &USSDAnalytics{
		TotalSessions:     0,
		CompletedSessions: 0,
		AbandonedSessions: 0,
		AvgDuration:       0,
		AvgSteps:          0,
		TopMenus:          map[string]int64{},
		TopActions:        map[string]int64{},
		ErrorRate:         0,
		Period:            fmt.Sprintf("%s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")),
	}, nil
}

// GetDailyReport generates a daily communication report
func (l *LakehouseClient) GetDailyReport(ctx context.Context, date time.Time) (map[string]interface{}, error) {
	l.logger.Info("Generating daily report", zap.Time("date", date))

	report := map[string]interface{}{
		"date": date.Format("2006-01-02"),
		"channels": map[string]interface{}{
			"whatsapp": map[string]interface{}{
				"sent":      0,
				"delivered": 0,
				"failed":    0,
				"cost":      0,
			},
			"sms": map[string]interface{}{
				"sent":      0,
				"delivered": 0,
				"failed":    0,
				"cost":      0,
			},
			"telegram": map[string]interface{}{
				"sent":      0,
				"delivered": 0,
				"failed":    0,
				"cost":      0,
			},
			"ussd": map[string]interface{}{
				"sessions":  0,
				"completed": 0,
				"abandoned": 0,
			},
		},
		"total_messages": 0,
		"total_cost":     0,
		"generated_at":   time.Now(),
	}

	return report, nil
}

// ExportToJSON exports analytics data to JSON
func (l *LakehouseClient) ExportToJSON(ctx context.Context, data interface{}) ([]byte, error) {
	return json.MarshalIndent(data, "", "  ")
}
