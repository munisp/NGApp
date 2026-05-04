package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Event represents a domain event in the event store
type Event struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AggregateID   uuid.UUID              `json:"aggregate_id" gorm:"type:uuid;not null;index"`
	AggregateType string                 `json:"aggregate_type" gorm:"not null;index"`
	EventType     string                 `json:"event_type" gorm:"not null;index"`
	EventVersion  int                    `json:"event_version" gorm:"not null"`
	EventData     map[string]interface{} `json:"event_data" gorm:"type:jsonb"`
	Metadata      map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	Timestamp     time.Time              `json:"timestamp" gorm:"not null;index"`
	UserID        *uuid.UUID             `json:"user_id,omitempty" gorm:"type:uuid;index"`
	CorrelationID *uuid.UUID             `json:"correlation_id,omitempty" gorm:"type:uuid;index"`
	CausationID   *uuid.UUID             `json:"causation_id,omitempty" gorm:"type:uuid;index"`
	StreamVersion int64                  `json:"stream_version" gorm:"not null"`
	CreatedAt     time.Time              `json:"created_at" gorm:"autoCreateTime"`
}

// Snapshot represents an aggregate snapshot for performance optimization
type Snapshot struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AggregateID   uuid.UUID              `json:"aggregate_id" gorm:"type:uuid;not null;uniqueIndex:idx_snapshot_aggregate"`
	AggregateType string                 `json:"aggregate_type" gorm:"not null;uniqueIndex:idx_snapshot_aggregate"`
	Version       int64                  `json:"version" gorm:"not null;uniqueIndex:idx_snapshot_aggregate"`
	Data          map[string]interface{} `json:"data" gorm:"type:jsonb"`
	Timestamp     time.Time              `json:"timestamp" gorm:"not null"`
	CreatedAt     time.Time              `json:"created_at" gorm:"autoCreateTime"`
}

// EventProjection represents a read model projection
type EventProjection struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProjectionName string                `json:"projection_name" gorm:"not null;index"`
	AggregateID   uuid.UUID              `json:"aggregate_id" gorm:"type:uuid;not null;index"`
	AggregateType string                 `json:"aggregate_type" gorm:"not null;index"`
	LastEventID   uuid.UUID              `json:"last_event_id" gorm:"type:uuid;not null"`
	Version       int64                  `json:"version" gorm:"not null"`
	Data          map[string]interface{} `json:"data" gorm:"type:jsonb"`
	UpdatedAt     time.Time              `json:"updated_at" gorm:"autoUpdateTime"`
	CreatedAt     time.Time              `json:"created_at" gorm:"autoCreateTime"`
}

// EventStore provides event sourcing capabilities
type EventStore struct {
	db           *gorm.DB
	kafkaWriter  *kafka.Writer
	projections  map[string]ProjectionHandler
}

// ProjectionHandler defines the interface for event projections
type ProjectionHandler interface {
	Handle(event Event) error
	GetProjectionName() string
}

// EventStoreConfig holds configuration for the event store
type EventStoreConfig struct {
	DatabaseURL      string
	KafkaBootstrap   string
	SnapshotInterval int64
}

// NewEventStore creates a new event store instance
func NewEventStore(config EventStoreConfig) (*EventStore, error) {
	// Connect to PostgreSQL
	db, err := gorm.Open(postgres.Open(config.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate tables
	err = db.AutoMigrate(&Event{}, &Snapshot{}, &EventProjection{})
	if err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	// Create indexes for performance
	db.Exec(`
		CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_aggregate_stream 
		ON events (aggregate_id, aggregate_type, stream_version);
		
		CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp_type 
		ON events (timestamp, event_type);
		
		CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_correlation 
		ON events (correlation_id) WHERE correlation_id IS NOT NULL;
		
		CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projections_name_aggregate 
		ON event_projections (projection_name, aggregate_id);
	`)

	// Setup Kafka writer
	kafkaWriter := &kafka.Writer{
		Addr:         kafka.TCP(config.KafkaBootstrap),
		Topic:        "enterprise-crm.events",
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Compression:  kafka.Snappy,
		BatchTimeout: 10 * time.Millisecond,
	}

	return &EventStore{
		db:          db,
		kafkaWriter: kafkaWriter,
		projections: make(map[string]ProjectionHandler),
	}, nil
}

// AppendEvent appends a new event to the event store
func (es *EventStore) AppendEvent(ctx context.Context, event Event) error {
	// Set event metadata
	event.ID = uuid.New()
	event.Timestamp = time.Now()

	// Start transaction
	tx := es.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get current stream version
	var currentVersion int64
	err := tx.Model(&Event{}).
		Where("aggregate_id = ? AND aggregate_type = ?", event.AggregateID, event.AggregateType).
		Select("COALESCE(MAX(stream_version), 0)").
		Scan(&currentVersion).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to get current stream version: %w", err)
	}

	// Set stream version
	event.StreamVersion = currentVersion + 1

	// Insert event
	err = tx.Create(&event).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Commit transaction
	err = tx.Commit().Error
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Publish event to Kafka
	go es.publishEventToKafka(event)

	// Update projections
	go es.updateProjections(event)

	// Create snapshot if needed
	go es.createSnapshotIfNeeded(event)

	return nil
}

// GetEvents retrieves events for an aggregate
func (es *EventStore) GetEvents(ctx context.Context, aggregateID uuid.UUID, aggregateType string, fromVersion int64) ([]Event, error) {
	var events []Event
	
	query := es.db.Where("aggregate_id = ? AND aggregate_type = ?", aggregateID, aggregateType)
	if fromVersion > 0 {
		query = query.Where("stream_version > ?", fromVersion)
	}
	
	err := query.Order("stream_version ASC").Find(&events).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get events: %w", err)
	}

	return events, nil
}

// GetEventsFromSnapshot retrieves events from the latest snapshot
func (es *EventStore) GetEventsFromSnapshot(ctx context.Context, aggregateID uuid.UUID, aggregateType string) ([]Event, *Snapshot, error) {
	// Get latest snapshot
	var snapshot Snapshot
	err := es.db.Where("aggregate_id = ? AND aggregate_type = ?", aggregateID, aggregateType).
		Order("version DESC").
		First(&snapshot).Error
	
	var fromVersion int64 = 0
	var snapshotPtr *Snapshot = nil
	
	if err == nil {
		fromVersion = snapshot.Version
		snapshotPtr = &snapshot
	} else if err != gorm.ErrRecordNotFound {
		return nil, nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	// Get events from snapshot version
	events, err := es.GetEvents(ctx, aggregateID, aggregateType, fromVersion)
	if err != nil {
		return nil, nil, err
	}

	return events, snapshotPtr, nil
}

// CreateSnapshot creates a snapshot for an aggregate
func (es *EventStore) CreateSnapshot(ctx context.Context, aggregateID uuid.UUID, aggregateType string, version int64, data map[string]interface{}) error {
	snapshot := Snapshot{
		AggregateID:   aggregateID,
		AggregateType: aggregateType,
		Version:       version,
		Data:          data,
		Timestamp:     time.Now(),
	}

	// Delete old snapshots (keep only latest)
	es.db.Where("aggregate_id = ? AND aggregate_type = ?", aggregateID, aggregateType).Delete(&Snapshot{})

	// Create new snapshot
	err := es.db.Create(&snapshot).Error
	if err != nil {
		return fmt.Errorf("failed to create snapshot: %w", err)
	}

	return nil
}

// GetEventsByType retrieves events by type within a time range
func (es *EventStore) GetEventsByType(ctx context.Context, eventType string, from, to time.Time, limit int) ([]Event, error) {
	var events []Event
	
	query := es.db.Where("event_type = ? AND timestamp BETWEEN ? AND ?", eventType, from, to)
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Order("timestamp ASC").Find(&events).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get events by type: %w", err)
	}

	return events, nil
}

// GetEventsByCorrelationID retrieves events by correlation ID
func (es *EventStore) GetEventsByCorrelationID(ctx context.Context, correlationID uuid.UUID) ([]Event, error) {
	var events []Event
	
	err := es.db.Where("correlation_id = ?", correlationID).
		Order("timestamp ASC").
		Find(&events).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get events by correlation ID: %w", err)
	}

	return events, nil
}

// RegisterProjection registers a projection handler
func (es *EventStore) RegisterProjection(handler ProjectionHandler) {
	es.projections[handler.GetProjectionName()] = handler
}

// RebuildProjection rebuilds a projection from all events
func (es *EventStore) RebuildProjection(ctx context.Context, projectionName string) error {
	handler, exists := es.projections[projectionName]
	if !exists {
		return fmt.Errorf("projection handler not found: %s", projectionName)
	}

	// Delete existing projection data
	err := es.db.Where("projection_name = ?", projectionName).Delete(&EventProjection{}).Error
	if err != nil {
		return fmt.Errorf("failed to delete existing projection data: %w", err)
	}

	// Process all events
	var events []Event
	err = es.db.Order("timestamp ASC").Find(&events).Error
	if err != nil {
		return fmt.Errorf("failed to get events for projection rebuild: %w", err)
	}

	for _, event := range events {
		err = handler.Handle(event)
		if err != nil {
			log.Printf("Error processing event %s for projection %s: %v", event.ID, projectionName, err)
		}
	}

	return nil
}

// publishEventToKafka publishes an event to Kafka
func (es *EventStore) publishEventToKafka(event Event) {
	eventData, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal event for Kafka: %v", err)
		return
	}

	message := kafka.Message{
		Key:   []byte(event.AggregateID.String()),
		Value: eventData,
		Headers: []kafka.Header{
			{Key: "event-type", Value: []byte(event.EventType)},
			{Key: "aggregate-type", Value: []byte(event.AggregateType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = es.kafkaWriter.WriteMessages(ctx, message)
	if err != nil {
		log.Printf("Failed to publish event to Kafka: %v", err)
	}
}

// updateProjections updates all registered projections
func (es *EventStore) updateProjections(event Event) {
	for _, handler := range es.projections {
		err := handler.Handle(event)
		if err != nil {
			log.Printf("Error updating projection %s: %v", handler.GetProjectionName(), err)
		}
	}
}

// createSnapshotIfNeeded creates a snapshot if the interval is reached
func (es *EventStore) createSnapshotIfNeeded(event Event) {
	// Create snapshot every 100 events
	if event.StreamVersion%100 == 0 {
		// This would typically reconstruct the aggregate state
		// For now, we'll create a simple snapshot with event data
		snapshotData := map[string]interface{}{
			"last_event_type": event.EventType,
			"stream_version":  event.StreamVersion,
			"timestamp":       event.Timestamp,
		}

		err := es.CreateSnapshot(context.Background(), event.AggregateID, event.AggregateType, event.StreamVersion, snapshotData)
		if err != nil {
			log.Printf("Failed to create snapshot: %v", err)
		}
	}
}

// CustomerProjectionHandler handles customer-related events
type CustomerProjectionHandler struct {
	db *gorm.DB
}

func NewCustomerProjectionHandler(db *gorm.DB) *CustomerProjectionHandler {
	return &CustomerProjectionHandler{db: db}
}

func (h *CustomerProjectionHandler) GetProjectionName() string {
	return "customer_projection"
}

func (h *CustomerProjectionHandler) Handle(event Event) error {
	switch event.EventType {
	case "customer.created":
		return h.handleCustomerCreated(event)
	case "customer.updated":
		return h.handleCustomerUpdated(event)
	case "customer.deleted":
		return h.handleCustomerDeleted(event)
	default:
		// Ignore unknown events
		return nil
	}
}

func (h *CustomerProjectionHandler) handleCustomerCreated(event Event) error {
	projection := EventProjection{
		ProjectionName: h.GetProjectionName(),
		AggregateID:    event.AggregateID,
		AggregateType:  event.AggregateType,
		LastEventID:    event.ID,
		Version:        event.StreamVersion,
		Data: map[string]interface{}{
			"status":      "active",
			"created_at":  event.Timestamp,
			"event_count": 1,
		},
	}

	return h.db.Create(&projection).Error
}

func (h *CustomerProjectionHandler) handleCustomerUpdated(event Event) error {
	var projection EventProjection
	err := h.db.Where("projection_name = ? AND aggregate_id = ?", h.GetProjectionName(), event.AggregateID).First(&projection).Error
	if err != nil {
		return err
	}

	// Update projection data
	if projection.Data == nil {
		projection.Data = make(map[string]interface{})
	}
	projection.Data["updated_at"] = event.Timestamp
	projection.Data["event_count"] = projection.Data["event_count"].(float64) + 1
	projection.LastEventID = event.ID
	projection.Version = event.StreamVersion

	return h.db.Save(&projection).Error
}

func (h *CustomerProjectionHandler) handleCustomerDeleted(event Event) error {
	var projection EventProjection
	err := h.db.Where("projection_name = ? AND aggregate_id = ?", h.GetProjectionName(), event.AggregateID).First(&projection).Error
	if err != nil {
		return err
	}

	// Update projection data
	if projection.Data == nil {
		projection.Data = make(map[string]interface{})
	}
	projection.Data["status"] = "deleted"
	projection.Data["deleted_at"] = event.Timestamp
	projection.Data["event_count"] = projection.Data["event_count"].(float64) + 1
	projection.LastEventID = event.ID
	projection.Version = event.StreamVersion

	return h.db.Save(&projection).Error
}

// HTTP API for event store
func setupEventStoreAPI(es *EventStore) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	api := router.Group("/api/v1")

	// Append event
	api.POST("/events", func(c *gin.Context) {
		var event Event
		if err := c.ShouldBindJSON(&event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err := es.AppendEvent(c.Request.Context(), event)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"event_id": event.ID})
	})

	// Get events for aggregate
	api.GET("/aggregates/:id/events", func(c *gin.Context) {
		aggregateID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid aggregate ID"})
			return
		}

		aggregateType := c.Query("type")
		if aggregateType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "aggregate type is required"})
			return
		}

		events, err := es.GetEvents(c.Request.Context(), aggregateID, aggregateType, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"events": events})
	})

	// Get events by type
	api.GET("/events/type/:type", func(c *gin.Context) {
		eventType := c.Param("type")
		
		from := time.Now().Add(-24 * time.Hour) // Default: last 24 hours
		to := time.Now()
		
		if fromStr := c.Query("from"); fromStr != "" {
			if parsedFrom, err := time.Parse(time.RFC3339, fromStr); err == nil {
				from = parsedFrom
			}
		}
		
		if toStr := c.Query("to"); toStr != "" {
			if parsedTo, err := time.Parse(time.RFC3339, toStr); err == nil {
				to = parsedTo
			}
		}

		events, err := es.GetEventsByType(c.Request.Context(), eventType, from, to, 1000)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"events": events})
	})

	// Get events by correlation ID
	api.GET("/events/correlation/:id", func(c *gin.Context) {
		correlationID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid correlation ID"})
			return
		}

		events, err := es.GetEventsByCorrelationID(c.Request.Context(), correlationID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"events": events})
	})

	// Rebuild projection
	api.POST("/projections/:name/rebuild", func(c *gin.Context) {
		projectionName := c.Param("name")

		err := es.RebuildProjection(c.Request.Context(), projectionName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "projection rebuilt successfully"})
	})

	// Health check
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
			"service":   "event-sourcing-service",
		})
	})

	return router
}

func main() {
	// Configuration
	config := EventStoreConfig{
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		KafkaBootstrap:   os.Getenv("KAFKA_BOOTSTRAP_SERVERS"),
		SnapshotInterval: 100,
	}

	if config.DatabaseURL == "" {
		config.DatabaseURL = "postgres://postgres:password@localhost:5432/enterprise_crm?sslmode=disable"
	}
	if config.KafkaBootstrap == "" {
		config.KafkaBootstrap = "localhost:9092"
	}

	// Create event store
	eventStore, err := NewEventStore(config)
	if err != nil {
		log.Fatalf("Failed to create event store: %v", err)
	}

	// Register projections
	customerProjection := NewCustomerProjectionHandler(eventStore.db)
	eventStore.RegisterProjection(customerProjection)

	// Setup HTTP API
	router := setupEventStoreAPI(eventStore)

	// Start server
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Println("Event Sourcing Service started on :8080")

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	// Close Kafka writer
	eventStore.kafkaWriter.Close()

	log.Println("Server exited")
}

