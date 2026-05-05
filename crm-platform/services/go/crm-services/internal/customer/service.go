package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
)

// CustomerService defines the interface for customer business logic
type CustomerService interface {
	// Customer CRUD operations
	CreateCustomer(ctx context.Context, req *CreateCustomerRequest) (*models.Customer, error)
	GetCustomer(ctx context.Context, id uuid.UUID) (*models.Customer, error)
	GetCustomerByEmail(ctx context.Context, email string) (*models.Customer, error)
	GetCustomerByNumber(ctx context.Context, customerNumber string) (*models.Customer, error)
	UpdateCustomer(ctx context.Context, id uuid.UUID, req *UpdateCustomerRequest) (*models.Customer, error)
	DeleteCustomer(ctx context.Context, id uuid.UUID) error
	
	// Customer listing and search
	ListCustomers(ctx context.Context, req *ListCustomersRequest) (*ListCustomersResponse, error)
	SearchCustomers(ctx context.Context, req *SearchCustomersRequest) (*SearchCustomersResponse, error)
	
	// Customer profile operations
	GetCustomerProfile(ctx context.Context, customerID uuid.UUID) (*models.CustomerProfile, error)
	UpdateCustomerProfile(ctx context.Context, customerID uuid.UUID, req *UpdateProfileRequest) (*models.CustomerProfile, error)
	
	// Customer interaction operations
	GetCustomerInteractions(ctx context.Context, customerID uuid.UUID, req *GetInteractionsRequest) (*GetInteractionsResponse, error)
	CreateCustomerInteraction(ctx context.Context, req *CreateInteractionRequest) (*models.CustomerInteraction, error)
	
	// Customer segmentation
	GetCustomerSegments(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerSegment, error)
	UpdateCustomerSegments(ctx context.Context, customerID uuid.UUID, segmentIDs []uuid.UUID) error
	
	// Bulk operations
	BulkCreateCustomers(ctx context.Context, req *BulkCreateCustomersRequest) (*BulkCreateCustomersResponse, error)
	BulkUpdateCustomers(ctx context.Context, req *BulkUpdateCustomersRequest) (*BulkUpdateCustomersResponse, error)
	BulkDeleteCustomers(ctx context.Context, customerIDs []uuid.UUID) (*BulkDeleteCustomersResponse, error)
	
	// Analytics operations
	GetSegmentAnalytics(ctx context.Context) ([]*repository.SegmentAnalytics, error)
	GetLifecycleAnalytics(ctx context.Context) ([]*repository.LifecycleAnalytics, error)
	GetValueAnalytics(ctx context.Context) ([]*repository.ValueAnalytics, error)
	GetChurnAnalytics(ctx context.Context) ([]*repository.ChurnAnalytics, error)
	
	// Event handling
	HandleCustomerEvent(ctx context.Context, event *CustomerEventRequest) error
	HandleInteractionEvent(ctx context.Context, event *InteractionEventRequest) error
	HandleSegmentEvent(ctx context.Context, event *SegmentEventRequest) error
}

// customerService implements CustomerService interface
type customerService struct {
	customerRepo repository.CustomerRepository
	eventRepo    repository.EventRepository
	logger       *logrus.Logger
}

// NewCustomerService creates a new customer service
func NewCustomerService(customerRepo repository.CustomerRepository, eventRepo repository.EventRepository, logger *logrus.Logger) CustomerService {
	return &customerService{
		customerRepo: customerRepo,
		eventRepo:    eventRepo,
		logger:       logger,
	}
}

// Request/Response structures
type CreateCustomerRequest struct {
	ExternalID        string                 `json:"external_id" validate:"required"`
	FirstName         string                 `json:"first_name" validate:"required"`
	LastName          string                 `json:"last_name" validate:"required"`
	MiddleName        string                 `json:"middle_name"`
	Email             string                 `json:"email" validate:"required,email"`
	Phone             string                 `json:"phone" validate:"required"`
	AlternatePhone    string                 `json:"alternate_phone"`
	DateOfBirth       *time.Time             `json:"date_of_birth"`
	Gender            string                 `json:"gender"`
	MaritalStatus     string                 `json:"marital_status"`
	Nationality       string                 `json:"nationality"`
	PreferredLanguage string                 `json:"preferred_language"`
	Source            string                 `json:"source"`
	ReferredBy        *uuid.UUID             `json:"referred_by"`
	Tags              []string               `json:"tags"`
	Metadata          map[string]interface{} `json:"metadata"`
}

type UpdateCustomerRequest struct {
	FirstName         *string                `json:"first_name"`
	LastName          *string                `json:"last_name"`
	MiddleName        *string                `json:"middle_name"`
	Email             *string                `json:"email" validate:"omitempty,email"`
	Phone             *string                `json:"phone"`
	AlternatePhone    *string                `json:"alternate_phone"`
	DateOfBirth       *time.Time             `json:"date_of_birth"`
	Gender            *string                `json:"gender"`
	MaritalStatus     *string                `json:"marital_status"`
	Nationality       *string                `json:"nationality"`
	PreferredLanguage *string                `json:"preferred_language"`
	Status            *models.CustomerStatus `json:"status"`
	Tier              *models.CustomerTier   `json:"tier"`
	Tags              []string               `json:"tags"`
	Metadata          map[string]interface{} `json:"metadata"`
}

type ListCustomersRequest struct {
	Filters    repository.CustomerFilters `json:"filters"`
	Pagination repository.Pagination      `json:"pagination"`
}

type ListCustomersResponse struct {
	Customers []*models.Customer `json:"customers"`
	Total     int64              `json:"total"`
	Page      int                `json:"page"`
	PageSize  int                `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}

type SearchCustomersRequest struct {
	Query      string                     `json:"query" validate:"required"`
	Filters    repository.CustomerFilters `json:"filters"`
	Pagination repository.Pagination      `json:"pagination"`
}

type SearchCustomersResponse struct {
	Customers []*models.Customer `json:"customers"`
	Total     int64              `json:"total"`
	Page      int                `json:"page"`
	PageSize  int                `json:"page_size"`
	TotalPages int               `json:"total_pages"`
	Query     string             `json:"query"`
}

type UpdateProfileRequest struct {
	Occupation          *string                `json:"occupation"`
	Industry            *string                `json:"industry"`
	Company             *string                `json:"company"`
	JobTitle            *string                `json:"job_title"`
	AnnualIncome        *float64               `json:"annual_income"`
	IncomeSource        *string                `json:"income_source"`
	Education           *string                `json:"education"`
	EmergencyContact    *models.EmergencyContact `json:"emergency_contact"`
	ProfilePictureURL   *string                `json:"profile_picture_url"`
	Bio                 *string                `json:"bio"`
	Interests           []string               `json:"interests"`
	SocialMediaProfiles map[string]string      `json:"social_media_profiles"`
	CustomFields        map[string]interface{} `json:"custom_fields"`
}

type GetInteractionsRequest struct {
	Filters    repository.InteractionFilters `json:"filters"`
	Pagination repository.Pagination         `json:"pagination"`
}

type GetInteractionsResponse struct {
	Interactions []*models.CustomerInteraction `json:"interactions"`
	Total        int64                         `json:"total"`
	Page         int                           `json:"page"`
	PageSize     int                           `json:"page_size"`
	TotalPages   int                           `json:"total_pages"`
}

type CreateInteractionRequest struct {
	CustomerID    uuid.UUID                      `json:"customer_id" validate:"required"`
	Type          models.InteractionType         `json:"type" validate:"required"`
	Channel       models.InteractionChannel      `json:"channel" validate:"required"`
	Direction     models.InteractionDirection    `json:"direction" validate:"required"`
	Subject       string                         `json:"subject"`
	Description   string                         `json:"description" validate:"required"`
	Priority      models.InteractionPriority     `json:"priority"`
	AgentID       *uuid.UUID                     `json:"agent_id"`
	AgentName     string                         `json:"agent_name"`
	Department    string                         `json:"department"`
	Tags          []string                       `json:"tags"`
	Attachments   []string                       `json:"attachments"`
	Metadata      map[string]interface{}         `json:"metadata"`
	ScheduledAt   *time.Time                     `json:"scheduled_at"`
}

type BulkCreateCustomersRequest struct {
	Customers []*CreateCustomerRequest `json:"customers" validate:"required,min=1,max=1000"`
}

type BulkCreateCustomersResponse struct {
	Created   []*models.Customer `json:"created"`
	Failed    []BulkOperationError `json:"failed"`
	Total     int                `json:"total"`
	Succeeded int                `json:"succeeded"`
	Failed    int                `json:"failed_count"`
}

type BulkUpdateCustomersRequest struct {
	Updates []BulkUpdateItem `json:"updates" validate:"required,min=1,max=1000"`
}

type BulkUpdateItem struct {
	CustomerID uuid.UUID              `json:"customer_id" validate:"required"`
	Updates    *UpdateCustomerRequest `json:"updates" validate:"required"`
}

type BulkUpdateCustomersResponse struct {
	Updated   []*models.Customer   `json:"updated"`
	Failed    []BulkOperationError `json:"failed"`
	Total     int                  `json:"total"`
	Succeeded int                  `json:"succeeded"`
	Failed    int                  `json:"failed_count"`
}

type BulkDeleteCustomersResponse struct {
	Deleted   []uuid.UUID          `json:"deleted"`
	Failed    []BulkOperationError `json:"failed"`
	Total     int                  `json:"total"`
	Succeeded int                  `json:"succeeded"`
	Failed    int                  `json:"failed_count"`
}

type BulkOperationError struct {
	ID    interface{} `json:"id"`
	Error string      `json:"error"`
}

// Event request structures
type CustomerEventRequest struct {
	CustomerID uuid.UUID              `json:"customer_id" validate:"required"`
	EventType  string                 `json:"event_type" validate:"required"`
	EventData  map[string]interface{} `json:"event_data"`
	Source     string                 `json:"source"`
	UserID     *uuid.UUID             `json:"user_id"`
	SessionID  string                 `json:"session_id"`
	IPAddress  string                 `json:"ip_address"`
	UserAgent  string                 `json:"user_agent"`
}

type InteractionEventRequest struct {
	InteractionID uuid.UUID              `json:"interaction_id" validate:"required"`
	EventType     string                 `json:"event_type" validate:"required"`
	EventData     map[string]interface{} `json:"event_data"`
	Source        string                 `json:"source"`
	UserID        *uuid.UUID             `json:"user_id"`
}

type SegmentEventRequest struct {
	SegmentID  uuid.UUID              `json:"segment_id" validate:"required"`
	EventType  string                 `json:"event_type" validate:"required"`
	EventData  map[string]interface{} `json:"event_data"`
	Source     string                 `json:"source"`
	UserID     *uuid.UUID             `json:"user_id"`
}

// CreateCustomer creates a new customer with business validation
func (s *customerService) CreateCustomer(ctx context.Context, req *CreateCustomerRequest) (*models.Customer, error) {
	s.logger.WithField("email", req.Email).Info("Creating new customer")

	// Check if customer already exists
	if existingCustomer, err := s.customerRepo.GetByEmail(ctx, req.Email); err == nil && existingCustomer != nil {
		return nil, fmt.Errorf("customer with email %s already exists", req.Email)
	}

	// Create customer model
	customer := &models.Customer{
		ID:                uuid.New(),
		ExternalID:        req.ExternalID,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		MiddleName:        req.MiddleName,
		Email:             req.Email,
		Phone:             req.Phone,
		AlternatePhone:    req.AlternatePhone,
		DateOfBirth:       req.DateOfBirth,
		Gender:            req.Gender,
		MaritalStatus:     req.MaritalStatus,
		Nationality:       req.Nationality,
		PreferredLanguage: req.PreferredLanguage,
		Status:            models.CustomerStatusActive,
		Tier:              models.CustomerTierBronze,
		Source:            req.Source,
		ReferredBy:        req.ReferredBy,
		KYCStatus:         models.KYCStatusPending,
		Tags:              req.Tags,
		Metadata:          req.Metadata,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}

	// Generate customer number
	customer.CustomerNumber = s.generateCustomerNumber()

	// Create customer in repository
	if err := s.customerRepo.Create(ctx, customer); err != nil {
		s.logger.WithError(err).Error("Failed to create customer in repository")
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	// Create customer event
	event := &models.CustomerEvent{
		CustomerID: customer.ID,
		EventType:  "customer_created",
		EventData: map[string]interface{}{
			"source":          req.Source,
			"referred_by":     req.ReferredBy,
			"initial_tier":    customer.Tier,
			"initial_status":  customer.Status,
		},
		Source:    "customer-service",
		Timestamp: time.Now().UTC(),
	}

	if err := s.eventRepo.Create(ctx, event); err != nil {
		s.logger.WithError(err).Warn("Failed to create customer event")
	}

	// Initialize default preferences
	preferences := &models.CustomerPreferences{
		CustomerID:            customer.ID,
		CommunicationChannels: []string{"email", "phone"},
		Language:              customer.PreferredLanguage,
		Currency:              "USD",
		EmailOptIn:            true,
		CallOptIn:             true,
		PushNotificationOptIn: true,
		Frequency:             models.NotificationFrequencyNormal,
		CreatedAt:             time.Now().UTC(),
		UpdatedAt:             time.Now().UTC(),
	}

	if err := s.customerRepo.UpdatePreferences(ctx, preferences); err != nil {
		s.logger.WithError(err).Warn("Failed to create default customer preferences")
	}

	s.logger.WithField("customer_id", customer.ID).Info("Customer created successfully")
	return customer, nil
}

// GetCustomer retrieves a customer by ID with business logic
func (s *customerService) GetCustomer(ctx context.Context, id uuid.UUID) (*models.Customer, error) {
	customer, err := s.customerRepo.GetByID(ctx, id)
	if err != nil {
		s.logger.WithError(err).WithField("customer_id", id).Error("Failed to get customer")
		return nil, err
	}

	// Update last activity if needed
	if customer.LastActivityAt == nil || time.Since(*customer.LastActivityAt) > 24*time.Hour {
		now := time.Now().UTC()
		customer.LastActivityAt = &now
		if err := s.customerRepo.Update(ctx, customer); err != nil {
			s.logger.WithError(err).Warn("Failed to update last activity")
		}
	}

	return customer, nil
}

// GetCustomerByEmail retrieves a customer by email
func (s *customerService) GetCustomerByEmail(ctx context.Context, email string) (*models.Customer, error) {
	return s.customerRepo.GetByEmail(ctx, email)
}

// GetCustomerByNumber retrieves a customer by customer number
func (s *customerService) GetCustomerByNumber(ctx context.Context, customerNumber string) (*models.Customer, error) {
	return s.customerRepo.GetByCustomerNumber(ctx, customerNumber)
}

// UpdateCustomer updates a customer with business validation
func (s *customerService) UpdateCustomer(ctx context.Context, id uuid.UUID, req *UpdateCustomerRequest) (*models.Customer, error) {
	// Get existing customer
	customer, err := s.customerRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.FirstName != nil {
		customer.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		customer.LastName = *req.LastName
	}
	if req.MiddleName != nil {
		customer.MiddleName = *req.MiddleName
	}
	if req.Email != nil {
		// Check if email is already taken by another customer
		if existingCustomer, err := s.customerRepo.GetByEmail(ctx, *req.Email); err == nil && existingCustomer.ID != id {
			return nil, fmt.Errorf("email %s is already taken", *req.Email)
		}
		customer.Email = *req.Email
	}
	if req.Phone != nil {
		customer.Phone = *req.Phone
	}
	if req.AlternatePhone != nil {
		customer.AlternatePhone = *req.AlternatePhone
	}
	if req.DateOfBirth != nil {
		customer.DateOfBirth = req.DateOfBirth
	}
	if req.Gender != nil {
		customer.Gender = *req.Gender
	}
	if req.MaritalStatus != nil {
		customer.MaritalStatus = *req.MaritalStatus
	}
	if req.Nationality != nil {
		customer.Nationality = *req.Nationality
	}
	if req.PreferredLanguage != nil {
		customer.PreferredLanguage = *req.PreferredLanguage
	}
	if req.Status != nil {
		customer.Status = *req.Status
	}
	if req.Tier != nil {
		customer.Tier = *req.Tier
	}
	if req.Tags != nil {
		customer.Tags = req.Tags
	}
	if req.Metadata != nil {
		customer.Metadata = req.Metadata
	}

	customer.UpdatedAt = time.Now().UTC()

	// Update in repository
	if err := s.customerRepo.Update(ctx, customer); err != nil {
		return nil, fmt.Errorf("failed to update customer: %w", err)
	}

	// Create update event
	event := &models.CustomerEvent{
		CustomerID: customer.ID,
		EventType:  "customer_updated",
		EventData: map[string]interface{}{
			"updated_fields": getUpdatedFields(req),
		},
		Source:    "customer-service",
		Timestamp: time.Now().UTC(),
	}

	if err := s.eventRepo.Create(ctx, event); err != nil {
		s.logger.WithError(err).Warn("Failed to create customer update event")
	}

	s.logger.WithField("customer_id", id).Info("Customer updated successfully")
	return customer, nil
}

// DeleteCustomer soft deletes a customer
func (s *customerService) DeleteCustomer(ctx context.Context, id uuid.UUID) error {
	// Get customer to ensure it exists
	customer, err := s.customerRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	// Perform soft delete
	if err := s.customerRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete customer: %w", err)
	}

	// Create deletion event
	event := &models.CustomerEvent{
		CustomerID: customer.ID,
		EventType:  "customer_deleted",
		EventData: map[string]interface{}{
			"customer_number": customer.CustomerNumber,
			"email":          customer.Email,
		},
		Source:    "customer-service",
		Timestamp: time.Now().UTC(),
	}

	if err := s.eventRepo.Create(ctx, event); err != nil {
		s.logger.WithError(err).Warn("Failed to create customer deletion event")
	}

	s.logger.WithField("customer_id", id).Info("Customer deleted successfully")
	return nil
}

// ListCustomers lists customers with filters and pagination
func (s *customerService) ListCustomers(ctx context.Context, req *ListCustomersRequest) (*ListCustomersResponse, error) {
	customers, total, err := s.customerRepo.List(ctx, req.Filters, req.Pagination)
	if err != nil {
		return nil, fmt.Errorf("failed to list customers: %w", err)
	}

	pageSize := req.Pagination.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &ListCustomersResponse{
		Customers:  customers,
		Total:      total,
		Page:       req.Pagination.Page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// SearchCustomers searches customers with query, filters and pagination
func (s *customerService) SearchCustomers(ctx context.Context, req *SearchCustomersRequest) (*SearchCustomersResponse, error) {
	customers, total, err := s.customerRepo.Search(ctx, req.Query, req.Filters, req.Pagination)
	if err != nil {
		return nil, fmt.Errorf("failed to search customers: %w", err)
	}

	pageSize := req.Pagination.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &SearchCustomersResponse{
		Customers:  customers,
		Total:      total,
		Page:       req.Pagination.Page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		Query:      req.Query,
	}, nil
}

// Helper methods
func (s *customerService) generateCustomerNumber() string {
	// Generate a unique customer number with timestamp and random component
	timestamp := time.Now().Unix()
	return fmt.Sprintf("CUST-%d-%s", timestamp, uuid.New().String()[:8])
}

func getUpdatedFields(req *UpdateCustomerRequest) []string {
	var fields []string
	if req.FirstName != nil {
		fields = append(fields, "first_name")
	}
	if req.LastName != nil {
		fields = append(fields, "last_name")
	}
	if req.Email != nil {
		fields = append(fields, "email")
	}
	if req.Phone != nil {
		fields = append(fields, "phone")
	}
	if req.Status != nil {
		fields = append(fields, "status")
	}
	if req.Tier != nil {
		fields = append(fields, "tier")
	}
	return fields
}

// Placeholder implementations for remaining methods
func (s *customerService) GetCustomerProfile(ctx context.Context, customerID uuid.UUID) (*models.CustomerProfile, error) {
	return s.customerRepo.GetProfile(ctx, customerID)
}

func (s *customerService) UpdateCustomerProfile(ctx context.Context, customerID uuid.UUID, req *UpdateProfileRequest) (*models.CustomerProfile, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) GetCustomerInteractions(ctx context.Context, customerID uuid.UUID, req *GetInteractionsRequest) (*GetInteractionsResponse, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) CreateCustomerInteraction(ctx context.Context, req *CreateInteractionRequest) (*models.CustomerInteraction, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) GetCustomerSegments(ctx context.Context, customerID uuid.UUID) ([]*models.CustomerSegment, error) {
	return s.customerRepo.GetSegments(ctx, customerID)
}

func (s *customerService) UpdateCustomerSegments(ctx context.Context, customerID uuid.UUID, segmentIDs []uuid.UUID) error {
	return s.customerRepo.UpdateSegments(ctx, customerID, segmentIDs)
}

func (s *customerService) BulkCreateCustomers(ctx context.Context, req *BulkCreateCustomersRequest) (*BulkCreateCustomersResponse, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) BulkUpdateCustomers(ctx context.Context, req *BulkUpdateCustomersRequest) (*BulkUpdateCustomersResponse, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) BulkDeleteCustomers(ctx context.Context, customerIDs []uuid.UUID) (*BulkDeleteCustomersResponse, error) {
	// Implementation would go here
	return nil, fmt.Errorf("not implemented")
}

func (s *customerService) GetSegmentAnalytics(ctx context.Context) ([]*repository.SegmentAnalytics, error) {
	return s.customerRepo.GetSegmentAnalytics(ctx)
}

func (s *customerService) GetLifecycleAnalytics(ctx context.Context) ([]*repository.LifecycleAnalytics, error) {
	return s.customerRepo.GetLifecycleAnalytics(ctx)
}

func (s *customerService) GetValueAnalytics(ctx context.Context) ([]*repository.ValueAnalytics, error) {
	return s.customerRepo.GetValueAnalytics(ctx)
}

func (s *customerService) GetChurnAnalytics(ctx context.Context) ([]*repository.ChurnAnalytics, error) {
	return s.customerRepo.GetChurnAnalytics(ctx)
}

func (s *customerService) HandleCustomerEvent(ctx context.Context, event *CustomerEventRequest) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (s *customerService) HandleInteractionEvent(ctx context.Context, event *InteractionEventRequest) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

func (s *customerService) HandleSegmentEvent(ctx context.Context, event *SegmentEventRequest) error {
	// Implementation would go here
	return fmt.Errorf("not implemented")
}

