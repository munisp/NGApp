package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/enterprise-crm/crm-core-service/internal/models"
	"github.com/enterprise-crm/crm-core-service/internal/repository"
)

// LeadService interface defines lead business operations
type LeadService interface {
	CreateLead(ctx context.Context, req CreateLeadRequest) (*models.Lead, error)
	GetLead(ctx context.Context, id uuid.UUID) (*models.Lead, error)
	GetLeadByEmail(ctx context.Context, email string) (*models.Lead, error)
	GetLeadByNumber(ctx context.Context, leadNumber string) (*models.Lead, error)
	UpdateLead(ctx context.Context, id uuid.UUID, req UpdateLeadRequest) (*models.Lead, error)
	DeleteLead(ctx context.Context, id uuid.UUID) error
	ListLeads(ctx context.Context, filters repository.LeadFilters, pagination repository.Pagination) ([]*models.Lead, int64, error)
	SearchLeads(ctx context.Context, query string, filters repository.LeadFilters, pagination repository.Pagination) ([]*models.Lead, int64, error)
	QualifyLead(ctx context.Context, id uuid.UUID, req QualifyLeadRequest) (*models.Lead, error)
	ConvertLead(ctx context.Context, id uuid.UUID, req ConvertLeadRequest) (*ConvertLeadResponse, error)
	AssignLead(ctx context.Context, id uuid.UUID, req AssignLeadRequest) (*models.Lead, error)
	ScoreLead(ctx context.Context, id uuid.UUID) (*models.Lead, error)
	BulkCreateLeads(ctx context.Context, req BulkCreateLeadsRequest) (*BulkCreateLeadsResponse, error)
	BulkUpdateLeads(ctx context.Context, req BulkUpdateLeadsRequest) (*BulkUpdateLeadsResponse, error)
	BulkDeleteLeads(ctx context.Context, req BulkDeleteLeadsRequest) (*BulkDeleteLeadsResponse, error)
	GetLeadStatistics(ctx context.Context, filters repository.LeadFilters) (*repository.LeadStatistics, error)
	GetConversionFunnel(ctx context.Context, filters repository.LeadFilters) (*repository.ConversionFunnel, error)
	ImportLeads(ctx context.Context, req ImportLeadsRequest) (*ImportLeadsResponse, error)
	ExportLeads(ctx context.Context, req ExportLeadsRequest) (*ExportLeadsResponse, error)
}

// leadService implements LeadService interface
type leadService struct {
	leadRepo    repository.LeadRepository
	eventRepo   repository.EventRepository
	kafkaProducer *repository.KafkaProducer
	logger      *logrus.Logger
}

// NewLeadService creates a new lead service
func NewLeadService(leadRepo repository.LeadRepository, eventRepo repository.EventRepository, kafkaProducer *repository.KafkaProducer, logger *logrus.Logger) LeadService {
	return &leadService{
		leadRepo:    leadRepo,
		eventRepo:   eventRepo,
		kafkaProducer: kafkaProducer,
		logger:      logger,
	}
}

// Request/Response structures

// CreateLeadRequest represents a request to create a lead
type CreateLeadRequest struct {
	FirstName     string                 `json:"first_name" validate:"required,min=1,max=100"`
	LastName      string                 `json:"last_name" validate:"required,min=1,max=100"`
	Email         string                 `json:"email" validate:"required,email"`
	Phone         string                 `json:"phone" validate:"omitempty,min=10,max=20"`
	Company       string                 `json:"company" validate:"required,min=1,max=200"`
	JobTitle      string                 `json:"job_title" validate:"omitempty,max=100"`
	Industry      string                 `json:"industry" validate:"omitempty,max=100"`
	CompanySize   string                 `json:"company_size" validate:"omitempty,max=50"`
	AnnualRevenue *float64               `json:"annual_revenue" validate:"omitempty,min=0"`
	Website       string                 `json:"website" validate:"omitempty,url"`
	Source        string                 `json:"source" validate:"required,max=100"`
	Campaign      string                 `json:"campaign" validate:"omitempty,max=100"`
	Medium        string                 `json:"medium" validate:"omitempty,max=50"`
	Content       string                 `json:"content" validate:"omitempty,max=200"`
	Term          string                 `json:"term" validate:"omitempty,max=100"`
	OwnerID       *uuid.UUID             `json:"owner_id" validate:"omitempty"`
	OwnerName     string                 `json:"owner_name" validate:"omitempty,max=100"`
	Status        models.LeadStatus      `json:"status" validate:"omitempty"`
	Grade         models.LeadGrade       `json:"grade" validate:"omitempty"`
	Score         int                    `json:"score" validate:"omitempty,min=0,max=100"`
	Notes         string                 `json:"notes" validate:"omitempty,max=2000"`
	Tags          []string               `json:"tags" validate:"omitempty"`
	CustomFields  map[string]interface{} `json:"custom_fields" validate:"omitempty"`
	Address       *AddressRequest        `json:"address" validate:"omitempty"`
}

// UpdateLeadRequest represents a request to update a lead
type UpdateLeadRequest struct {
	FirstName     *string                `json:"first_name" validate:"omitempty,min=1,max=100"`
	LastName      *string                `json:"last_name" validate:"omitempty,min=1,max=100"`
	Email         *string                `json:"email" validate:"omitempty,email"`
	Phone         *string                `json:"phone" validate:"omitempty,min=10,max=20"`
	Company       *string                `json:"company" validate:"omitempty,min=1,max=200"`
	JobTitle      *string                `json:"job_title" validate:"omitempty,max=100"`
	Industry      *string                `json:"industry" validate:"omitempty,max=100"`
	CompanySize   *string                `json:"company_size" validate:"omitempty,max=50"`
	AnnualRevenue *float64               `json:"annual_revenue" validate:"omitempty,min=0"`
	Website       *string                `json:"website" validate:"omitempty,url"`
	Source        *string                `json:"source" validate:"omitempty,max=100"`
	Campaign      *string                `json:"campaign" validate:"omitempty,max=100"`
	Medium        *string                `json:"medium" validate:"omitempty,max=50"`
	Content       *string                `json:"content" validate:"omitempty,max=200"`
	Term          *string                `json:"term" validate:"omitempty,max=100"`
	OwnerID       *uuid.UUID             `json:"owner_id" validate:"omitempty"`
	OwnerName     *string                `json:"owner_name" validate:"omitempty,max=100"`
	Status        *models.LeadStatus     `json:"status" validate:"omitempty"`
	Grade         *models.LeadGrade      `json:"grade" validate:"omitempty"`
	Score         *int                   `json:"score" validate:"omitempty,min=0,max=100"`
	Notes         *string                `json:"notes" validate:"omitempty,max=2000"`
	Tags          []string               `json:"tags" validate:"omitempty"`
	CustomFields  map[string]interface{} `json:"custom_fields" validate:"omitempty"`
	Address       *AddressRequest        `json:"address" validate:"omitempty"`
}

// AddressRequest represents an address in requests
type AddressRequest struct {
	Street     string  `json:"street" validate:"omitempty,max=200"`
	City       string  `json:"city" validate:"omitempty,max=100"`
	State      string  `json:"state" validate:"omitempty,max=100"`
	PostalCode string  `json:"postal_code" validate:"omitempty,max=20"`
	Country    string  `json:"country" validate:"omitempty,max=100"`
	Latitude   *float64 `json:"latitude" validate:"omitempty,min=-90,max=90"`
	Longitude  *float64 `json:"longitude" validate:"omitempty,min=-180,max=180"`
}

// QualifyLeadRequest represents a request to qualify a lead
type QualifyLeadRequest struct {
	Grade        models.LeadGrade `json:"grade" validate:"required"`
	Score        int              `json:"score" validate:"required,min=0,max=100"`
	Reason       string           `json:"reason" validate:"required,max=500"`
	QualifiedBy  uuid.UUID        `json:"qualified_by" validate:"required"`
	QualifierName string          `json:"qualifier_name" validate:"required,max=100"`
}

// ConvertLeadRequest represents a request to convert a lead
type ConvertLeadRequest struct {
	CreateAccount     bool      `json:"create_account"`
	AccountName       string    `json:"account_name" validate:"required_if=CreateAccount true,max=200"`
	CreateContact     bool      `json:"create_contact"`
	CreateOpportunity bool      `json:"create_opportunity"`
	OpportunityName   string    `json:"opportunity_name" validate:"required_if=CreateOpportunity true,max=200"`
	OpportunityAmount *float64  `json:"opportunity_amount" validate:"omitempty,min=0"`
	CloseDate         *time.Time `json:"close_date" validate:"omitempty"`
	ConvertedBy       uuid.UUID `json:"converted_by" validate:"required"`
	ConverterName     string    `json:"converter_name" validate:"required,max=100"`
	Notes             string    `json:"notes" validate:"omitempty,max=1000"`
}

// ConvertLeadResponse represents the response from lead conversion
type ConvertLeadResponse struct {
	Lead        *models.Lead        `json:"lead"`
	Account     *models.Account     `json:"account,omitempty"`
	Contact     *models.Contact     `json:"contact,omitempty"`
	Opportunity *models.Opportunity `json:"opportunity,omitempty"`
}

// AssignLeadRequest represents a request to assign a lead
type AssignLeadRequest struct {
	OwnerID     uuid.UUID `json:"owner_id" validate:"required"`
	OwnerName   string    `json:"owner_name" validate:"required,max=100"`
	AssignedBy  uuid.UUID `json:"assigned_by" validate:"required"`
	AssignerName string   `json:"assigner_name" validate:"required,max=100"`
	Reason      string    `json:"reason" validate:"omitempty,max=500"`
}

// Bulk operation requests and responses

// BulkCreateLeadsRequest represents a bulk create request
type BulkCreateLeadsRequest struct {
	Leads     []CreateLeadRequest `json:"leads" validate:"required,min=1,max=1000"`
	CreatedBy uuid.UUID           `json:"created_by" validate:"required"`
	CreatorName string            `json:"creator_name" validate:"required,max=100"`
}

// BulkCreateLeadsResponse represents a bulk create response
type BulkCreateLeadsResponse struct {
	SuccessCount int                    `json:"success_count"`
	FailureCount int                    `json:"failure_count"`
	Errors       []BulkOperationError   `json:"errors,omitempty"`
	CreatedLeads []*models.Lead         `json:"created_leads"`
}

// BulkUpdateLeadsRequest represents a bulk update request
type BulkUpdateLeadsRequest struct {
	Updates     []BulkLeadUpdate `json:"updates" validate:"required,min=1,max=1000"`
	UpdatedBy   uuid.UUID        `json:"updated_by" validate:"required"`
	UpdaterName string           `json:"updater_name" validate:"required,max=100"`
}

// BulkLeadUpdate represents a single lead update in bulk operation
type BulkLeadUpdate struct {
	ID     uuid.UUID         `json:"id" validate:"required"`
	Update UpdateLeadRequest `json:"update" validate:"required"`
}

// BulkUpdateLeadsResponse represents a bulk update response
type BulkUpdateLeadsResponse struct {
	SuccessCount int                  `json:"success_count"`
	FailureCount int                  `json:"failure_count"`
	Errors       []BulkOperationError `json:"errors,omitempty"`
	UpdatedLeads []*models.Lead       `json:"updated_leads"`
}

// BulkDeleteLeadsRequest represents a bulk delete request
type BulkDeleteLeadsRequest struct {
	IDs         []uuid.UUID `json:"ids" validate:"required,min=1,max=1000"`
	DeletedBy   uuid.UUID   `json:"deleted_by" validate:"required"`
	DeleterName string      `json:"deleter_name" validate:"required,max=100"`
	Reason      string      `json:"reason" validate:"omitempty,max=500"`
}

// BulkDeleteLeadsResponse represents a bulk delete response
type BulkDeleteLeadsResponse struct {
	SuccessCount int                  `json:"success_count"`
	FailureCount int                  `json:"failure_count"`
	Errors       []BulkOperationError `json:"errors,omitempty"`
	DeletedIDs   []uuid.UUID          `json:"deleted_ids"`
}

// BulkOperationError represents an error in bulk operations
type BulkOperationError struct {
	Index   int    `json:"index"`
	ID      string `json:"id,omitempty"`
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// Import/Export requests and responses

// ImportLeadsRequest represents an import request
type ImportLeadsRequest struct {
	Data        []map[string]interface{} `json:"data" validate:"required,min=1"`
	Mapping     map[string]string        `json:"mapping" validate:"required"`
	ImportedBy  uuid.UUID                `json:"imported_by" validate:"required"`
	ImporterName string                  `json:"importer_name" validate:"required,max=100"`
	SkipDuplicates bool                  `json:"skip_duplicates"`
	UpdateExisting bool                  `json:"update_existing"`
}

// ImportLeadsResponse represents an import response
type ImportLeadsResponse struct {
	TotalRecords   int                  `json:"total_records"`
	SuccessCount   int                  `json:"success_count"`
	FailureCount   int                  `json:"failure_count"`
	SkippedCount   int                  `json:"skipped_count"`
	Errors         []BulkOperationError `json:"errors,omitempty"`
	ImportedLeads  []*models.Lead       `json:"imported_leads"`
}

// ExportLeadsRequest represents an export request
type ExportLeadsRequest struct {
	Filters     repository.LeadFilters `json:"filters"`
	Format      string                 `json:"format" validate:"required,oneof=csv json xlsx"`
	Fields      []string               `json:"fields"`
	ExportedBy  uuid.UUID              `json:"exported_by" validate:"required"`
	ExporterName string                `json:"exporter_name" validate:"required,max=100"`
}

// ExportLeadsResponse represents an export response
type ExportLeadsResponse struct {
	FileName    string `json:"file_name"`
	FileURL     string `json:"file_url"`
	RecordCount int    `json:"record_count"`
	FileSize    int64  `json:"file_size"`
}

// Service implementation

// CreateLead creates a new lead
func (s *leadService) CreateLead(ctx context.Context, req CreateLeadRequest) (*models.Lead, error) {
	// Validate request
	if err := s.validateCreateLeadRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Check for duplicate email
	if existingLead, _ := s.leadRepo.GetByEmail(ctx, req.Email); existingLead != nil {
		return nil, fmt.Errorf("lead with email %s already exists", req.Email)
	}

	// Create lead model
	lead := &models.Lead{
		ID:            uuid.New(),
		LeadNumber:    s.generateLeadNumber(),
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Email:         req.Email,
		Phone:         req.Phone,
		Company:       req.Company,
		JobTitle:      req.JobTitle,
		Industry:      req.Industry,
		CompanySize:   req.CompanySize,
		AnnualRevenue: req.AnnualRevenue,
		Website:       req.Website,
		Source:        req.Source,
		Campaign:      req.Campaign,
		Medium:        req.Medium,
		Content:       req.Content,
		Term:          req.Term,
		OwnerID:       req.OwnerID,
		OwnerName:     req.OwnerName,
		Status:        models.LeadStatusNew,
		Grade:         models.LeadGradeC,
		Score:         req.Score,
		Notes:         req.Notes,
		Tags:          req.Tags,
		CustomFields:  req.CustomFields,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	// Set default status and grade if not provided
	if req.Status != "" {
		lead.Status = req.Status
	}
	if req.Grade != "" {
		lead.Grade = req.Grade
	}

	// Set address if provided
	if req.Address != nil {
		lead.Street = req.Address.Street
		lead.City = req.Address.City
		lead.State = req.Address.State
		lead.PostalCode = req.Address.PostalCode
		lead.Country = req.Address.Country
		lead.Latitude = req.Address.Latitude
		lead.Longitude = req.Address.Longitude
	}

	// Calculate initial score if not provided
	if lead.Score == 0 {
		lead.Score = s.calculateLeadScore(lead)
	}

	// Determine grade based on score
	lead.Grade = s.determineLeadGrade(lead.Score)

	// Create lead in repository
	if err := s.leadRepo.Create(ctx, lead); err != nil {
		s.logger.WithError(err).Error("Failed to create lead")
		return nil, fmt.Errorf("failed to create lead: %w", err)
	}

	// Create audit event
	s.createLeadEvent(ctx, models.EventTypeLeadCreated, lead.ID, nil, lead.OwnerName, models.ActionCreate, "Lead created", nil, s.leadToMap(lead), nil)

	// Publish Kafka event
	s.publishLeadEvent(ctx, models.EventTypeLeadCreated, lead.ID, lead, nil, nil)

	s.logger.WithFields(logrus.Fields{
		"lead_id":     lead.ID,
		"lead_number": lead.LeadNumber,
		"email":       lead.Email,
	}).Info("Lead created successfully")

	return lead, nil
}

// GetLead retrieves a lead by ID
func (s *leadService) GetLead(ctx context.Context, id uuid.UUID) (*models.Lead, error) {
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		s.logger.WithError(err).WithField("lead_id", id).Error("Failed to get lead")
		return nil, fmt.Errorf("failed to get lead: %w", err)
	}

	return lead, nil
}

// GetLeadByEmail retrieves a lead by email
func (s *leadService) GetLeadByEmail(ctx context.Context, email string) (*models.Lead, error) {
	lead, err := s.leadRepo.GetByEmail(ctx, email)
	if err != nil {
		s.logger.WithError(err).WithField("email", email).Error("Failed to get lead by email")
		return nil, fmt.Errorf("failed to get lead by email: %w", err)
	}

	return lead, nil
}

// GetLeadByNumber retrieves a lead by lead number
func (s *leadService) GetLeadByNumber(ctx context.Context, leadNumber string) (*models.Lead, error) {
	lead, err := s.leadRepo.GetByLeadNumber(ctx, leadNumber)
	if err != nil {
		s.logger.WithError(err).WithField("lead_number", leadNumber).Error("Failed to get lead by number")
		return nil, fmt.Errorf("failed to get lead by number: %w", err)
	}

	return lead, nil
}

// UpdateLead updates a lead
func (s *leadService) UpdateLead(ctx context.Context, id uuid.UUID, req UpdateLeadRequest) (*models.Lead, error) {
	// Get existing lead
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get lead: %w", err)
	}

	// Store old values for audit
	oldValues := s.leadToMap(lead)

	// Update fields
	changes := make(map[string]interface{})
	
	if req.FirstName != nil && *req.FirstName != lead.FirstName {
		changes["first_name"] = map[string]interface{}{"from": lead.FirstName, "to": *req.FirstName}
		lead.FirstName = *req.FirstName
	}
	
	if req.LastName != nil && *req.LastName != lead.LastName {
		changes["last_name"] = map[string]interface{}{"from": lead.LastName, "to": *req.LastName}
		lead.LastName = *req.LastName
	}
	
	if req.Email != nil && *req.Email != lead.Email {
		// Check for duplicate email
		if existingLead, _ := s.leadRepo.GetByEmail(ctx, *req.Email); existingLead != nil && existingLead.ID != id {
			return nil, fmt.Errorf("lead with email %s already exists", *req.Email)
		}
		changes["email"] = map[string]interface{}{"from": lead.Email, "to": *req.Email}
		lead.Email = *req.Email
	}
	
	if req.Phone != nil && *req.Phone != lead.Phone {
		changes["phone"] = map[string]interface{}{"from": lead.Phone, "to": *req.Phone}
		lead.Phone = *req.Phone
	}
	
	if req.Company != nil && *req.Company != lead.Company {
		changes["company"] = map[string]interface{}{"from": lead.Company, "to": *req.Company}
		lead.Company = *req.Company
	}
	
	if req.Status != nil && *req.Status != lead.Status {
		changes["status"] = map[string]interface{}{"from": lead.Status, "to": *req.Status}
		lead.Status = *req.Status
	}
	
	if req.Grade != nil && *req.Grade != lead.Grade {
		changes["grade"] = map[string]interface{}{"from": lead.Grade, "to": *req.Grade}
		lead.Grade = *req.Grade
	}
	
	if req.Score != nil && *req.Score != lead.Score {
		changes["score"] = map[string]interface{}{"from": lead.Score, "to": *req.Score}
		lead.Score = *req.Score
	}

	// Update other fields...
	if req.JobTitle != nil {
		lead.JobTitle = *req.JobTitle
	}
	if req.Industry != nil {
		lead.Industry = *req.Industry
	}
	if req.CompanySize != nil {
		lead.CompanySize = *req.CompanySize
	}
	if req.AnnualRevenue != nil {
		lead.AnnualRevenue = req.AnnualRevenue
	}
	if req.Website != nil {
		lead.Website = *req.Website
	}
	if req.Source != nil {
		lead.Source = *req.Source
	}
	if req.OwnerID != nil {
		lead.OwnerID = req.OwnerID
	}
	if req.OwnerName != nil {
		lead.OwnerName = *req.OwnerName
	}
	if req.Notes != nil {
		lead.Notes = *req.Notes
	}
	if req.Tags != nil {
		lead.Tags = req.Tags
	}
	if req.CustomFields != nil {
		lead.CustomFields = req.CustomFields
	}

	// Update address if provided
	if req.Address != nil {
		lead.Street = req.Address.Street
		lead.City = req.Address.City
		lead.State = req.Address.State
		lead.PostalCode = req.Address.PostalCode
		lead.Country = req.Address.Country
		lead.Latitude = req.Address.Latitude
		lead.Longitude = req.Address.Longitude
	}

	lead.UpdatedAt = time.Now().UTC()

	// Update lead in repository
	if err := s.leadRepo.Update(ctx, lead); err != nil {
		s.logger.WithError(err).WithField("lead_id", id).Error("Failed to update lead")
		return nil, fmt.Errorf("failed to update lead: %w", err)
	}

	// Create audit event if there were changes
	if len(changes) > 0 {
		newValues := s.leadToMap(lead)
		s.createLeadEvent(ctx, models.EventTypeLeadUpdated, lead.ID, lead.OwnerID, lead.OwnerName, models.ActionUpdate, "Lead updated", oldValues, newValues, changes)
		
		// Publish Kafka event
		s.publishLeadEvent(ctx, models.EventTypeLeadUpdated, lead.ID, lead, changes, oldValues)
	}

	s.logger.WithField("lead_id", id).Info("Lead updated successfully")
	return lead, nil
}

// DeleteLead deletes a lead
func (s *leadService) DeleteLead(ctx context.Context, id uuid.UUID) error {
	// Get existing lead for audit
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get lead: %w", err)
	}

	// Delete lead
	if err := s.leadRepo.Delete(ctx, id); err != nil {
		s.logger.WithError(err).WithField("lead_id", id).Error("Failed to delete lead")
		return fmt.Errorf("failed to delete lead: %w", err)
	}

	// Create audit event
	oldValues := s.leadToMap(lead)
	s.createLeadEvent(ctx, models.EventTypeLeadDeleted, id, lead.OwnerID, lead.OwnerName, models.ActionDelete, "Lead deleted", oldValues, nil, nil)

	// Publish Kafka event
	s.publishLeadEvent(ctx, models.EventTypeLeadDeleted, id, lead, nil, oldValues)

	s.logger.WithField("lead_id", id).Info("Lead deleted successfully")
	return nil
}

// ListLeads lists leads with filters and pagination
func (s *leadService) ListLeads(ctx context.Context, filters repository.LeadFilters, pagination repository.Pagination) ([]*models.Lead, int64, error) {
	leads, total, err := s.leadRepo.List(ctx, filters, pagination)
	if err != nil {
		s.logger.WithError(err).Error("Failed to list leads")
		return nil, 0, fmt.Errorf("failed to list leads: %w", err)
	}

	return leads, total, nil
}

// SearchLeads performs full-text search on leads
func (s *leadService) SearchLeads(ctx context.Context, query string, filters repository.LeadFilters, pagination repository.Pagination) ([]*models.Lead, int64, error) {
	leads, total, err := s.leadRepo.Search(ctx, query, filters, pagination)
	if err != nil {
		s.logger.WithError(err).Error("Failed to search leads")
		return nil, 0, fmt.Errorf("failed to search leads: %w", err)
	}

	return leads, total, nil
}

// QualifyLead qualifies a lead
func (s *leadService) QualifyLead(ctx context.Context, id uuid.UUID, req QualifyLeadRequest) (*models.Lead, error) {
	// Get existing lead
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get lead: %w", err)
	}

	// Store old values for audit
	oldValues := s.leadToMap(lead)

	// Update lead
	oldStatus := lead.Status
	oldGrade := lead.Grade
	oldScore := lead.Score

	lead.Status = models.LeadStatusQualified
	lead.Grade = req.Grade
	lead.Score = req.Score
	lead.QualifiedAt = &time.Time{}
	*lead.QualifiedAt = time.Now().UTC()
	lead.UpdatedAt = time.Now().UTC()

	// Update lead in repository
	if err := s.leadRepo.Update(ctx, lead); err != nil {
		s.logger.WithError(err).WithField("lead_id", id).Error("Failed to qualify lead")
		return nil, fmt.Errorf("failed to qualify lead: %w", err)
	}

	// Create audit event
	changes := map[string]interface{}{
		"status": map[string]interface{}{"from": oldStatus, "to": lead.Status},
		"grade":  map[string]interface{}{"from": oldGrade, "to": lead.Grade},
		"score":  map[string]interface{}{"from": oldScore, "to": lead.Score},
		"reason": req.Reason,
		"qualified_by": req.QualifiedBy,
		"qualifier_name": req.QualifierName,
	}
	
	newValues := s.leadToMap(lead)
	s.createLeadEvent(ctx, models.EventTypeLeadQualified, lead.ID, &req.QualifiedBy, req.QualifierName, models.ActionUpdate, fmt.Sprintf("Lead qualified: %s", req.Reason), oldValues, newValues, changes)

	// Publish Kafka event
	s.publishLeadEvent(ctx, models.EventTypeLeadQualified, lead.ID, lead, changes, oldValues)

	s.logger.WithFields(logrus.Fields{
		"lead_id":        id,
		"grade":          req.Grade,
		"score":          req.Score,
		"qualified_by":   req.QualifiedBy,
	}).Info("Lead qualified successfully")

	return lead, nil
}

// Helper methods

// validateCreateLeadRequest validates the create lead request
func (s *leadService) validateCreateLeadRequest(req CreateLeadRequest) error {
	if strings.TrimSpace(req.FirstName) == "" {
		return fmt.Errorf("first name is required")
	}
	if strings.TrimSpace(req.LastName) == "" {
		return fmt.Errorf("last name is required")
	}
	if strings.TrimSpace(req.Email) == "" {
		return fmt.Errorf("email is required")
	}
	if strings.TrimSpace(req.Company) == "" {
		return fmt.Errorf("company is required")
	}
	if strings.TrimSpace(req.Source) == "" {
		return fmt.Errorf("source is required")
	}
	return nil
}

// generateLeadNumber generates a unique lead number
func (s *leadService) generateLeadNumber() string {
	return fmt.Sprintf("LEAD-%d", time.Now().Unix())
}

// calculateLeadScore calculates the lead score based on various factors
func (s *leadService) calculateLeadScore(lead *models.Lead) int {
	score := 0

	// Company size scoring
	switch lead.CompanySize {
	case "Enterprise (1000+)":
		score += 30
	case "Large (500-999)":
		score += 25
	case "Medium (100-499)":
		score += 20
	case "Small (10-99)":
		score += 15
	case "Startup (1-9)":
		score += 10
	}

	// Annual revenue scoring
	if lead.AnnualRevenue != nil {
		if *lead.AnnualRevenue >= 10000000 { // $10M+
			score += 25
		} else if *lead.AnnualRevenue >= 1000000 { // $1M+
			score += 20
		} else if *lead.AnnualRevenue >= 100000 { // $100K+
			score += 15
		} else {
			score += 10
		}
	}

	// Job title scoring
	jobTitle := strings.ToLower(lead.JobTitle)
	if strings.Contains(jobTitle, "ceo") || strings.Contains(jobTitle, "president") || strings.Contains(jobTitle, "founder") {
		score += 20
	} else if strings.Contains(jobTitle, "cto") || strings.Contains(jobTitle, "cfo") || strings.Contains(jobTitle, "vp") {
		score += 15
	} else if strings.Contains(jobTitle, "director") || strings.Contains(jobTitle, "manager") {
		score += 10
	} else {
		score += 5
	}

	// Source scoring
	switch lead.Source {
	case "Referral":
		score += 15
	case "Website":
		score += 10
	case "Social Media":
		score += 8
	case "Email Campaign":
		score += 6
	case "Cold Call":
		score += 4
	default:
		score += 2
	}

	// Ensure score is within bounds
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	return score
}

// determineLeadGrade determines the lead grade based on score
func (s *leadService) determineLeadGrade(score int) models.LeadGrade {
	if score >= 80 {
		return models.LeadGradeA
	} else if score >= 60 {
		return models.LeadGradeB
	} else if score >= 40 {
		return models.LeadGradeC
	} else {
		return models.LeadGradeD
	}
}

// leadToMap converts a lead to a map for audit purposes
func (s *leadService) leadToMap(lead *models.Lead) map[string]interface{} {
	return map[string]interface{}{
		"id":             lead.ID,
		"lead_number":    lead.LeadNumber,
		"first_name":     lead.FirstName,
		"last_name":      lead.LastName,
		"email":          lead.Email,
		"phone":          lead.Phone,
		"company":        lead.Company,
		"job_title":      lead.JobTitle,
		"industry":       lead.Industry,
		"company_size":   lead.CompanySize,
		"annual_revenue": lead.AnnualRevenue,
		"website":        lead.Website,
		"source":         lead.Source,
		"status":         lead.Status,
		"grade":          lead.Grade,
		"score":          lead.Score,
		"owner_id":       lead.OwnerID,
		"owner_name":     lead.OwnerName,
		"created_at":     lead.CreatedAt,
		"updated_at":     lead.UpdatedAt,
	}
}

// createLeadEvent creates an audit event for lead operations
func (s *leadService) createLeadEvent(ctx context.Context, eventType string, leadID uuid.UUID, userID *uuid.UUID, userName, action, description string, oldValues, newValues, changes map[string]interface{}) {
	go func() {
		if err := s.eventRepo.CreateLeadEvent(context.Background(), eventType, leadID, userID, userName, action, description, oldValues, newValues, changes); err != nil {
			s.logger.WithError(err).Error("Failed to create lead event")
		}
	}()
}

// publishLeadEvent publishes a lead event to Kafka
func (s *leadService) publishLeadEvent(ctx context.Context, eventType string, leadID uuid.UUID, lead *models.Lead, changes, previous map[string]interface{}) {
	go func() {
		if err := s.kafkaProducer.PublishLeadEvent(context.Background(), eventType, leadID, lead, changes, previous); err != nil {
			s.logger.WithError(err).Error("Failed to publish lead event")
		}
	}()
}

