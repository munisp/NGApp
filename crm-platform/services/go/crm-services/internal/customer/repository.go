package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// CustomerRepository defines the interface for customer data operations
type CustomerRepository interface {
	// CRUD operations
	Create(ctx context.Context, customer *models.Customer) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Customer, error)
	GetByEmail(ctx context.Context, email string) (*models.Customer, error)
	GetByCustomerNumber(ctx context.Context, customerNumber string) (*models.Customer, error)
	Update(ctx context.Context, customer *models.Customer) error
	Delete(ctx context.Context, id uuid.UUID) error
	
	// List and search operations
	List(ctx context.Context, filters CustomerFilters, pagination Pagination) ([]*models.Customer, int64, error)
	Search(ctx context.Context, query string, filters CustomerFilters, pagination Pagination) ([]*models.Customer, int64, error)
	
	// Profile operations
	GetProfile(ctx context.Context, customerID uuid.UUID) (*models.CustomerProfile, error)
	UpdateProfile(ctx context.Context, profile *models.CustomerProfile) error
	
	// Address operations
	GetAddresses(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerAddress, error)
	AddAddress(ctx context.Context, address *models.CustomerAddress) error
	UpdateAddress(ctx context.Context, address *models.CustomerAddress) error
	DeleteAddress(ctx context.Context, id uuid.UUID) error
	
	// Interaction operations
	GetInteractions(ctx context.Context, customerID uuid.UUID, filters InteractionFilters, pagination Pagination) ([]*models.CustomerInteraction, int64, error)
	AddInteraction(ctx context.Context, interaction *models.CustomerInteraction) error
	
	// Segment operations
	GetSegments(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerSegment, error)
	UpdateSegments(ctx context.Context, customerID uuid.UUID, segmentIDs []uuid.UUID) error
	
	// Preferences operations
	GetPreferences(ctx context.Context, customerID uuid.UUID) (*models.CustomerPreferences, error)
	UpdatePreferences(ctx context.Context, preferences *models.CustomerPreferences) error
	
	// Bulk operations
	BulkCreate(ctx context.Context, customers []*models.Customer) error
	BulkUpdate(ctx context.Context, customers []*models.Customer) error
	BulkDelete(ctx context.Context, ids []uuid.UUID) error
	
	// Analytics operations
	GetSegmentAnalytics(ctx context.Context) ([]*SegmentAnalytics, error)
	GetLifecycleAnalytics(ctx context.Context) ([]*LifecycleAnalytics, error)
	GetValueAnalytics(ctx context.Context) ([]*ValueAnalytics, error)
	GetChurnAnalytics(ctx context.Context) ([]*ChurnAnalytics, error)
}

// customerRepository implements CustomerRepository interface
type customerRepository struct {
	db     *gorm.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewCustomerRepository creates a new customer repository
func NewCustomerRepository(db *gorm.DB, redis *redis.Client, logger *logrus.Logger) CustomerRepository {
	return &customerRepository{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// CustomerFilters defines filters for customer queries
type CustomerFilters struct {
	Status        []models.CustomerStatus `json:"status"`
	Tier          []models.CustomerTier   `json:"tier"`
	KYCStatus     []models.KYCStatus      `json:"kyc_status"`
	Source        []string                `json:"source"`
	Country       []string                `json:"country"`
	City          []string                `json:"city"`
	AgeMin        *int                    `json:"age_min"`
	AgeMax        *int                    `json:"age_max"`
	IncomeMin     *float64                `json:"income_min"`
	IncomeMax     *float64                `json:"income_max"`
	RiskScoreMin  *float64                `json:"risk_score_min"`
	RiskScoreMax  *float64                `json:"risk_score_max"`
	CreatedAfter  *time.Time              `json:"created_after"`
	CreatedBefore *time.Time              `json:"created_before"`
	Tags          []string                `json:"tags"`
	SegmentIDs    []uuid.UUID             `json:"segment_ids"`
}

// InteractionFilters defines filters for interaction queries
type InteractionFilters struct {
	Type      []models.InteractionType      `json:"type"`
	Channel   []models.InteractionChannel   `json:"channel"`
	Status    []models.InteractionStatus    `json:"status"`
	Priority  []models.InteractionPriority  `json:"priority"`
	AgentID   *uuid.UUID                    `json:"agent_id"`
	DateFrom  *time.Time                    `json:"date_from"`
	DateTo    *time.Time                    `json:"date_to"`
}

// Pagination defines pagination parameters
type Pagination struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	SortBy   string `json:"sort_by"`
	SortDesc bool   `json:"sort_desc"`
}

// Analytics structures
type SegmentAnalytics struct {
	SegmentID     uuid.UUID `json:"segment_id"`
	SegmentName   string    `json:"segment_name"`
	CustomerCount int64     `json:"customer_count"`
	AvgLifetimeValue float64 `json:"avg_lifetime_value"`
	AvgRiskScore  float64   `json:"avg_risk_score"`
}

type LifecycleAnalytics struct {
	Stage         string  `json:"stage"`
	CustomerCount int64   `json:"customer_count"`
	Percentage    float64 `json:"percentage"`
	AvgDuration   int     `json:"avg_duration_days"`
}

type ValueAnalytics struct {
	Tier          models.CustomerTier `json:"tier"`
	CustomerCount int64               `json:"customer_count"`
	TotalValue    float64             `json:"total_value"`
	AvgValue      float64             `json:"avg_value"`
}

type ChurnAnalytics struct {
	Period        string  `json:"period"`
	ChurnRate     float64 `json:"churn_rate"`
	ChurnedCount  int64   `json:"churned_count"`
	RetainedCount int64   `json:"retained_count"`
}

// Cache keys
const (
	customerCachePrefix      = "customer:"
	customerEmailCachePrefix = "customer:email:"
	customerNumberCachePrefix = "customer:number:"
	customerProfileCachePrefix = "customer:profile:"
	customerAddressesCachePrefix = "customer:addresses:"
	customerSegmentsCachePrefix = "customer:segments:"
	customerPreferencesCachePrefix = "customer:preferences:"
	cacheTTL = 1 * time.Hour
)

// Create creates a new customer
func (r *customerRepository) Create(ctx context.Context, customer *models.Customer) error {
	if err := r.db.WithContext(ctx).Create(customer).Error; err != nil {
		r.logger.WithError(err).Error("Failed to create customer")
		return fmt.Errorf("failed to create customer: %w", err)
	}

	// Cache the customer
	if err := r.cacheCustomer(ctx, customer); err != nil {
		r.logger.WithError(err).Warn("Failed to cache customer after creation")
	}

	r.logger.WithField("customer_id", customer.ID).Info("Customer created successfully")
	return nil
}

// GetByID retrieves a customer by ID
func (r *customerRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Customer, error) {
	// Try cache first
	if customer, err := r.getCustomerFromCache(ctx, id); err == nil && customer != nil {
		return customer, nil
	}

	var customer models.Customer
	err := r.db.WithContext(ctx).
		Preload("Profile").
		Preload("Addresses").
		Preload("Segments").
		Preload("Preferences").
		First(&customer, "id = ?", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("customer not found")
		}
		r.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer by ID")
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	// Cache the customer
	if err := r.cacheCustomer(ctx, &customer); err != nil {
		r.logger.WithError(err).Warn("Failed to cache customer after retrieval")
	}

	return &customer, nil
}

// GetByEmail retrieves a customer by email
func (r *customerRepository) GetByEmail(ctx context.Context, email string) (*models.Customer, error) {
	// Try cache first
	cacheKey := customerEmailCachePrefix + email
	if cachedID, err := r.redis.Get(ctx, cacheKey).Result(); err == nil {
		if id, err := uuid.Parse(cachedID); err == nil {
			return r.GetByID(ctx, id)
		}
	}

	var customer models.Customer
	err := r.db.WithContext(ctx).
		Preload("Profile").
		Preload("Addresses").
		Preload("Segments").
		Preload("Preferences").
		First(&customer, "email = ?", email).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("customer not found")
		}
		r.logger.WithError(err).WithField("email", email).Error("Failed to get customer by email")
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	// Cache the customer and email mapping
	if err := r.cacheCustomer(ctx, &customer); err != nil {
		r.logger.WithError(err).Warn("Failed to cache customer after retrieval")
	}
	r.redis.Set(ctx, cacheKey, customer.ID.String(), cacheTTL)

	return &customer, nil
}

// GetByCustomerNumber retrieves a customer by customer number
func (r *customerRepository) GetByCustomerNumber(ctx context.Context, customerNumber string) (*models.Customer, error) {
	// Try cache first
	cacheKey := customerNumberCachePrefix + customerNumber
	if cachedID, err := r.redis.Get(ctx, cacheKey).Result(); err == nil {
		if id, err := uuid.Parse(cachedID); err == nil {
			return r.GetByID(ctx, id)
		}
	}

	var customer models.Customer
	err := r.db.WithContext(ctx).
		Preload("Profile").
		Preload("Addresses").
		Preload("Segments").
		Preload("Preferences").
		First(&customer, "customer_number = ?", customerNumber).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("customer not found")
		}
		r.logger.WithError(err).WithField("customer_number", customerNumber).Error("Failed to get customer by number")
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	// Cache the customer and number mapping
	if err := r.cacheCustomer(ctx, &customer); err != nil {
		r.logger.WithError(err).Warn("Failed to cache customer after retrieval")
	}
	r.redis.Set(ctx, cacheKey, customer.ID.String(), cacheTTL)

	return &customer, nil
}

// Update updates a customer
func (r *customerRepository) Update(ctx context.Context, customer *models.Customer) error {
	if err := r.db.WithContext(ctx).Save(customer).Error; err != nil {
		r.logger.WithError(err).WithField("customer_id", customer.ID).Error("Failed to update customer")
		return fmt.Errorf("failed to update customer: %w", err)
	}

	// Update cache
	if err := r.cacheCustomer(ctx, customer); err != nil {
		r.logger.WithError(err).Warn("Failed to update customer cache")
	}

	r.logger.WithField("customer_id", customer.ID).Info("Customer updated successfully")
	return nil
}

// Delete soft deletes a customer
func (r *customerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&models.Customer{}, id).Error; err != nil {
		r.logger.WithError(err).WithField("customer_id", id).Error("Failed to delete customer")
		return fmt.Errorf("failed to delete customer: %w", err)
	}

	// Remove from cache
	r.invalidateCustomerCache(ctx, id)

	r.logger.WithField("customer_id", id).Info("Customer deleted successfully")
	return nil
}

// List retrieves customers with filters and pagination
func (r *customerRepository) List(ctx context.Context, filters CustomerFilters, pagination Pagination) ([]*models.Customer, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Customer{})

	// Apply filters
	query = r.applyCustomerFilters(query, filters)

	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count customers")
		return nil, 0, fmt.Errorf("failed to count customers: %w", err)
	}

	// Apply pagination and sorting
	query = r.applyPagination(query, pagination)

	// Execute query
	var customers []*models.Customer
	if err := query.
		Preload("Profile").
		Preload("Addresses").
		Preload("Segments").
		Find(&customers).Error; err != nil {
		r.logger.WithError(err).Error("Failed to list customers")
		return nil, 0, fmt.Errorf("failed to list customers: %w", err)
	}

	return customers, total, nil
}

// Search performs full-text search on customers
func (r *customerRepository) Search(ctx context.Context, query string, filters CustomerFilters, pagination Pagination) ([]*models.Customer, int64, error) {
	dbQuery := r.db.WithContext(ctx).Model(&models.Customer{})

	// Apply search query
	if query != "" {
		searchQuery := fmt.Sprintf("%%%s%%", query)
		dbQuery = dbQuery.Where(
			"first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR customer_number ILIKE ?",
			searchQuery, searchQuery, searchQuery, searchQuery, searchQuery,
		)
	}

	// Apply filters
	dbQuery = r.applyCustomerFilters(dbQuery, filters)

	// Count total records
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		r.logger.WithError(err).Error("Failed to count search results")
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Apply pagination and sorting
	dbQuery = r.applyPagination(dbQuery, pagination)

	// Execute query
	var customers []*models.Customer
	if err := dbQuery.
		Preload("Profile").
		Preload("Addresses").
		Preload("Segments").
		Find(&customers).Error; err != nil {
		r.logger.WithError(err).Error("Failed to search customers")
		return nil, 0, fmt.Errorf("failed to search customers: %w", err)
	}

	return customers, total, nil
}

// Helper methods for caching
func (r *customerRepository) cacheCustomer(ctx context.Context, customer *models.Customer) error {
	data, err := json.Marshal(customer)
	if err != nil {
		return err
	}

	cacheKey := customerCachePrefix + customer.ID.String()
	return r.redis.Set(ctx, cacheKey, data, cacheTTL).Err()
}

func (r *customerRepository) getCustomerFromCache(ctx context.Context, id uuid.UUID) (*models.Customer, error) {
	cacheKey := customerCachePrefix + id.String()
	data, err := r.redis.Get(ctx, cacheKey).Result()
	if err != nil {
		return nil, err
	}

	var customer models.Customer
	if err := json.Unmarshal([]byte(data), &customer); err != nil {
		return nil, err
	}

	return &customer, nil
}

func (r *customerRepository) invalidateCustomerCache(ctx context.Context, id uuid.UUID) {
	keys := []string{
		customerCachePrefix + id.String(),
		customerProfileCachePrefix + id.String(),
		customerAddressesCachePrefix + id.String(),
		customerSegmentsCachePrefix + id.String(),
		customerPreferencesCachePrefix + id.String(),
	}

	for _, key := range keys {
		r.redis.Del(ctx, key)
	}
}

// Helper methods for query building
func (r *customerRepository) applyCustomerFilters(query *gorm.DB, filters CustomerFilters) *gorm.DB {
	if len(filters.Status) > 0 {
		query = query.Where("status IN ?", filters.Status)
	}
	if len(filters.Tier) > 0 {
		query = query.Where("tier IN ?", filters.Tier)
	}
	if len(filters.KYCStatus) > 0 {
		query = query.Where("kyc_status IN ?", filters.KYCStatus)
	}
	if len(filters.Source) > 0 {
		query = query.Where("source IN ?", filters.Source)
	}
	if len(filters.Tags) > 0 {
		query = query.Where("tags && ?", filters.Tags)
	}
	if filters.RiskScoreMin != nil {
		query = query.Where("risk_score >= ?", *filters.RiskScoreMin)
	}
	if filters.RiskScoreMax != nil {
		query = query.Where("risk_score <= ?", *filters.RiskScoreMax)
	}
	if filters.CreatedAfter != nil {
		query = query.Where("created_at >= ?", *filters.CreatedAfter)
	}
	if filters.CreatedBefore != nil {
		query = query.Where("created_at <= ?", *filters.CreatedBefore)
	}
	if len(filters.SegmentIDs) > 0 {
		query = query.Joins("JOIN customer_segment_mappings csm ON customers.id = csm.customer_id").
			Where("csm.customer_segment_id IN ?", filters.SegmentIDs)
	}

	return query
}

func (r *customerRepository) applyPagination(query *gorm.DB, pagination Pagination) *gorm.DB {
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
		query = query.Order("created_at DESC")
	}

	return query
}

// Additional methods would be implemented here for:
// - GetProfile, UpdateProfile
// - GetAddresses, AddAddress, UpdateAddress, DeleteAddress
// - GetInteractions, AddInteraction
// - GetSegments, UpdateSegments
// - GetPreferences, UpdatePreferences
// - BulkCreate, BulkUpdate, BulkDelete
// - Analytics methods

// Placeholder implementations for remaining methods
func (r *customerRepository) GetProfile(ctx context.Context, customerID uuid.UUID) (*models.CustomerProfile, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) UpdateProfile(ctx context.Context, profile *models.CustomerProfile) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) GetAddresses(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerAddress, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) AddAddress(ctx context.Context, address *models.CustomerAddress) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) UpdateAddress(ctx context.Context, address *models.CustomerAddress) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) DeleteAddress(ctx context.Context, id uuid.UUID) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) GetInteractions(ctx context.Context, customerID uuid.UUID, filters InteractionFilters, pagination Pagination) ([]*models.CustomerInteraction, int64, error) {
	// Implementation would go here
	return nil, 0, fmt.Errorf("not implemented")
}

func (r *customerRepository) AddInteraction(ctx context.Context, interaction *models.CustomerInteraction) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) GetSegments(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerSegment, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) UpdateSegments(ctx context.Context, customerID uuid.UUID, segmentIDs []uuid.UUID) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) GetPreferences(ctx context.Context, customerID uuid.UUID) (*models.CustomerPreferences, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) UpdatePreferences(ctx context.Context, preferences *models.CustomerPreferences) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) BulkCreate(ctx context.Context, customers []*models.Customer) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) BulkUpdate(ctx context.Context, customers []*models.Customer) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) BulkDelete(ctx context.Context, ids []uuid.UUID) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (r *customerRepository) GetSegmentAnalytics(ctx context.Context) ([]*SegmentAnalytics, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) GetLifecycleAnalytics(ctx context.Context) ([]*LifecycleAnalytics, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) GetValueAnalytics(ctx context.Context) ([]*ValueAnalytics, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (r *customerRepository) GetChurnAnalytics(ctx context.Context) ([]*ChurnAnalytics, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

