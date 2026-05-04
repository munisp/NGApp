package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/enterprise-crm/customer-service/internal/models"
)

// EventRepository defines the interface for event data operations
type EventRepository interface {
	// Event CRUD operations
	Create(ctx context.Context, event *models.CustomerEvent) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.CustomerEvent, error)
	GetByCustomerID(ctx context.Context, customerID uuid.UUID, filters EventFilters, pagination Pagination) ([]*models.CustomerEvent, int64, error)
	List(ctx context.Context, filters EventFilters, pagination Pagination) ([]*models.CustomerEvent, int64, error)
	Delete(ctx context.Context, id uuid.UUID) error
	
	// Event analytics
	GetEventStats(ctx context.Context, customerID *uuid.UUID, timeRange TimeRange) (*EventStats, error)
	GetEventsByType(ctx context.Context, eventType string, timeRange TimeRange) ([]*models.CustomerEvent, error)
	GetCustomerEventTimeline(ctx context.Context, customerID uuid.UUID, limit int) ([]*models.CustomerEvent, error)
}

// eventRepository implements EventRepository interface
type eventRepository struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewEventRepository creates a new event repository
func NewEventRepository(db *gorm.DB, logger *logrus.Logger) EventRepository {
	return &eventRepository{
		db:     db,
		logger: logger,
	}
}

// EventFilters defines filters for event queries
type EventFilters struct {
	CustomerID *uuid.UUID `json:"customer_id"`
	EventTypes []string   `json:"event_types"`
	Source     []string   `json:"source"`
	UserID     *uuid.UUID `json:"user_id"`
	SessionID  string     `json:"session_id"`
	IPAddress  string     `json:"ip_address"`
	DateFrom   *time.Time `json:"date_from"`
	DateTo     *time.Time `json:"date_to"`
}

// TimeRange defines a time range for queries
type TimeRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// EventStats represents event statistics
type EventStats struct {
	TotalEvents      int64             `json:"total_events"`
	EventsByType     map[string]int64  `json:"events_by_type"`
	EventsBySource   map[string]int64  `json:"events_by_source"`
	EventsByHour     map[string]int64  `json:"events_by_hour"`
	UniqueCustomers  int64             `json:"unique_customers"`
	UniqueSessions   int64             `json:"unique_sessions"`
	AveragePerCustomer float64         `json:"average_per_customer"`
}

// Create creates a new customer event
func (r *eventRepository) Create(ctx context.Context, event *models.CustomerEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}
	
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}

	if err := r.db.WithContext(ctx).Create(event).Error; err != nil {
		r.logger.WithError(err).WithFields(logrus.Fields{
			"customer_id": event.CustomerID,
			"event_type":  event.EventType,
		}).Error("Failed to create customer event")
		return fmt.Errorf("failed to create customer event: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"event_id":    event.ID,
		"customer_id": event.CustomerID,
		"event_type":  event.EventType,
	}).Info("Customer event created successfully")

	return nil
}

// GetByID retrieves an event by ID
func (r *eventRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.CustomerEvent, error) {
	var event models.CustomerEvent
	err := r.db.WithContext(ctx).First(&event, "id = ?", id).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("event not found")
		}
		r.logger.WithError(err).WithField("event_id", id).Error("Failed to get event by ID")
		return nil, fmt.Errorf("failed to get event: %w", err)
	}

	return &event, nil
}

// GetByCustomerID retrieves events for a specific customer
func (r *eventRepository) GetByCustomerID(ctx context.Context, customerID uuid.UUID, filters EventFilters, pagination Pagination) ([]*models.CustomerEvent, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.CustomerEvent{}).Where("customer_id = ?", customerID)

	// Apply additional filters
	query = r.applyEventFilters(query, filters)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).WithField("customer_id", customerID).Error("Failed to count customer events")
		return nil, 0, fmt.Errorf("failed to count customer events: %w", err)
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	// Execute query
	var events []*models.CustomerEvent
	if err := query.Find(&events).Error; err != nil {
		r.logger.WithError(err).WithField("customer_id", customerID).Error("Failed to get customer events")
		return nil, 0, fmt.Errorf("failed to get customer events: %w", err)
	}

	return events, total, nil
}

// List retrieves events with filters and pagination
func (r *eventRepository) List(ctx context.Context, filters EventFilters, pagination Pagination) ([]*models.CustomerEvent, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.CustomerEvent{})

	// Apply filters
	query = r.applyEventFilters(query, filters)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count events")
		return nil, 0, fmt.Errorf("failed to count events: %w", err)
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	// Execute query
	var events []*models.CustomerEvent
	if err := query.Find(&events).Error; err != nil {
		r.logger.WithError(err).Error("Failed to list events")
		return nil, 0, fmt.Errorf("failed to list events: %w", err)
	}

	return events, total, nil
}

// Delete deletes an event
func (r *eventRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Delete(&models.CustomerEvent{}, id)
	
	if result.Error != nil {
		r.logger.WithError(result.Error).WithField("event_id", id).Error("Failed to delete event")
		return fmt.Errorf("failed to delete event: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("event not found")
	}

	r.logger.WithField("event_id", id).Info("Event deleted successfully")
	return nil
}

// GetEventStats retrieves event statistics
func (r *eventRepository) GetEventStats(ctx context.Context, customerID *uuid.UUID, timeRange TimeRange) (*EventStats, error) {
	query := r.db.WithContext(ctx).Model(&models.CustomerEvent{})

	// Apply customer filter if provided
	if customerID != nil {
		query = query.Where("customer_id = ?", *customerID)
	}

	// Apply time range filter
	query = query.Where("timestamp >= ? AND timestamp <= ?", timeRange.From, timeRange.To)

	// Get total events count
	var totalEvents int64
	if err := query.Count(&totalEvents).Error; err != nil {
		return nil, fmt.Errorf("failed to count total events: %w", err)
	}

	// Get events by type
	var eventsByType []struct {
		EventType string `json:"event_type"`
		Count     int64  `json:"count"`
	}
	if err := query.Select("event_type, COUNT(*) as count").
		Group("event_type").
		Find(&eventsByType).Error; err != nil {
		return nil, fmt.Errorf("failed to get events by type: %w", err)
	}

	// Get events by source
	var eventsBySource []struct {
		Source string `json:"source"`
		Count  int64  `json:"count"`
	}
	if err := query.Select("source, COUNT(*) as count").
		Group("source").
		Find(&eventsBySource).Error; err != nil {
		return nil, fmt.Errorf("failed to get events by source: %w", err)
	}

	// Get events by hour
	var eventsByHour []struct {
		Hour  string `json:"hour"`
		Count int64  `json:"count"`
	}
	if err := query.Select("DATE_TRUNC('hour', timestamp) as hour, COUNT(*) as count").
		Group("hour").
		Order("hour").
		Find(&eventsByHour).Error; err != nil {
		return nil, fmt.Errorf("failed to get events by hour: %w", err)
	}

	// Get unique customers count
	var uniqueCustomers int64
	if err := query.Select("COUNT(DISTINCT customer_id)").Row().Scan(&uniqueCustomers); err != nil {
		return nil, fmt.Errorf("failed to count unique customers: %w", err)
	}

	// Get unique sessions count
	var uniqueSessions int64
	if err := query.Where("session_id IS NOT NULL AND session_id != ''").
		Select("COUNT(DISTINCT session_id)").Row().Scan(&uniqueSessions); err != nil {
		return nil, fmt.Errorf("failed to count unique sessions: %w", err)
	}

	// Build response maps
	eventTypeMap := make(map[string]int64)
	for _, item := range eventsByType {
		eventTypeMap[item.EventType] = item.Count
	}

	eventSourceMap := make(map[string]int64)
	for _, item := range eventsBySource {
		eventSourceMap[item.Source] = item.Count
	}

	eventHourMap := make(map[string]int64)
	for _, item := range eventsByHour {
		eventHourMap[item.Hour] = item.Count
	}

	// Calculate average events per customer
	var averagePerCustomer float64
	if uniqueCustomers > 0 {
		averagePerCustomer = float64(totalEvents) / float64(uniqueCustomers)
	}

	stats := &EventStats{
		TotalEvents:        totalEvents,
		EventsByType:       eventTypeMap,
		EventsBySource:     eventSourceMap,
		EventsByHour:       eventHourMap,
		UniqueCustomers:    uniqueCustomers,
		UniqueSessions:     uniqueSessions,
		AveragePerCustomer: averagePerCustomer,
	}

	return stats, nil
}

// GetEventsByType retrieves events of a specific type within a time range
func (r *eventRepository) GetEventsByType(ctx context.Context, eventType string, timeRange TimeRange) ([]*models.CustomerEvent, error) {
	var events []*models.CustomerEvent
	
	err := r.db.WithContext(ctx).
		Where("event_type = ? AND timestamp >= ? AND timestamp <= ?", eventType, timeRange.From, timeRange.To).
		Order("timestamp DESC").
		Find(&events).Error

	if err != nil {
		r.logger.WithError(err).WithField("event_type", eventType).Error("Failed to get events by type")
		return nil, fmt.Errorf("failed to get events by type: %w", err)
	}

	return events, nil
}

// GetCustomerEventTimeline retrieves recent events for a customer timeline
func (r *eventRepository) GetCustomerEventTimeline(ctx context.Context, customerID uuid.UUID, limit int) ([]*models.CustomerEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	var events []*models.CustomerEvent
	
	err := r.db.WithContext(ctx).
		Where("customer_id = ?", customerID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&events).Error

	if err != nil {
		r.logger.WithError(err).WithField("customer_id", customerID).Error("Failed to get customer event timeline")
		return nil, fmt.Errorf("failed to get customer event timeline: %w", err)
	}

	return events, nil
}

// Helper methods for query building
func (r *eventRepository) applyEventFilters(query *gorm.DB, filters EventFilters) *gorm.DB {
	if filters.CustomerID != nil {
		query = query.Where("customer_id = ?", *filters.CustomerID)
	}
	if len(filters.EventTypes) > 0 {
		query = query.Where("event_type IN ?", filters.EventTypes)
	}
	if len(filters.Source) > 0 {
		query = query.Where("source IN ?", filters.Source)
	}
	if filters.UserID != nil {
		query = query.Where("user_id = ?", *filters.UserID)
	}
	if filters.SessionID != "" {
		query = query.Where("session_id = ?", filters.SessionID)
	}
	if filters.IPAddress != "" {
		query = query.Where("ip_address = ?", filters.IPAddress)
	}
	if filters.DateFrom != nil {
		query = query.Where("timestamp >= ?", *filters.DateFrom)
	}
	if filters.DateTo != nil {
		query = query.Where("timestamp <= ?", *filters.DateTo)
	}

	return query
}

func (r *eventRepository) applyPagination(query *gorm.DB, pagination Pagination) *gorm.DB {
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}
	if pagination.Page <= 0 {
		pagination.Page = 1
	}

	offset := (pagination.Page - 1) * pagination.PageSize
	query = query.Offset(offset).Limit(pagination.PageSize)

	if pagination.SortBy != "" {
		order := pagination.SortBy
		if pagination.SortDesc {
			order += " DESC"
		}
		query = query.Order(order)
	} else {
		query = query.Order("timestamp DESC")
	}

	return query
}

