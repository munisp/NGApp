package services

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/agent-banking/agent-management/models"
	"github.com/agent-banking/agent-management/repositories"
	"github.com/agent-banking/agent-management/utils"
	"github.com/agent-banking/agent-management/config"
)

// Service errors
var (
	ErrAgentNotFound         = errors.New("agent not found")
	ErrAgentAlreadyExists    = errors.New("agent already exists")
	ErrInvalidHierarchy      = errors.New("invalid hierarchy configuration")
	ErrInvalidStatus         = errors.New("invalid status transition")
	ErrInvalidLimits         = errors.New("invalid transaction limits")
	ErrUnauthorized          = errors.New("unauthorized operation")
	ErrInvalidFileType       = errors.New("invalid file type")
	ErrFileTooLarge          = errors.New("file too large")
	ErrDocumentNotFound      = errors.New("document not found")
)

// AgentService handles agent business logic
type AgentService struct {
	agentRepo       repositories.AgentRepository
	hierarchyRepo   repositories.HierarchyRepository
	documentRepo    repositories.DocumentRepository
	transactionRepo repositories.TransactionRepository
	auditService    *AuditService
	notificationService *NotificationService
	kycService      *KYCService
	riskService     *RiskService
	config          *config.Config
	db              *sql.DB
}

// NewAgentService creates a new agent service
func NewAgentService(
	agentRepo repositories.AgentRepository,
	hierarchyRepo repositories.HierarchyRepository,
	documentRepo repositories.DocumentRepository,
	transactionRepo repositories.TransactionRepository,
	auditService *AuditService,
	notificationService *NotificationService,
	kycService *KYCService,
	riskService *RiskService,
	config *config.Config,
	db *sql.DB,
) *AgentService {
	return &AgentService{
		agentRepo:       agentRepo,
		hierarchyRepo:   hierarchyRepo,
		documentRepo:    documentRepo,
		transactionRepo: transactionRepo,
		auditService:    auditService,
		notificationService: notificationService,
		kycService:      kycService,
		riskService:     riskService,
		config:          config,
		db:              db,
	}
}

// CreateAgent creates a new agent
func (s *AgentService) CreateAgent(ctx context.Context, req *models.CreateAgentRequest, createdBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if agent already exists
	existingAgent, _ := s.agentRepo.GetByEmail(ctx, req.Email)
	if existingAgent != nil {
		return nil, ErrAgentAlreadyExists
	}

	existingAgent, _ = s.agentRepo.GetByPhone(ctx, req.Phone)
	if existingAgent != nil {
		return nil, ErrAgentAlreadyExists
	}

	existingAgent, _ = s.agentRepo.GetByNationalID(ctx, req.NationalID)
	if existingAgent != nil {
		return nil, ErrAgentAlreadyExists
	}

	// Validate hierarchy if parent agent specified
	hierarchyLevel := 1
	if req.ParentAgentID != nil {
		parentAgent, err := s.agentRepo.GetByID(ctx, *req.ParentAgentID)
		if err != nil {
			return nil, fmt.Errorf("parent agent not found: %w", err)
		}

		// Validate hierarchy rules
		if err := s.validateHierarchyRules(req.AgentType, parentAgent.AgentType); err != nil {
			return nil, err
		}

		hierarchyLevel = parentAgent.HierarchyLevel + 1
	}

	// Generate agent code
	agentCode, err := s.generateAgentCode(ctx, req.AgentType, req.Region)
	if err != nil {
		return nil, fmt.Errorf("failed to generate agent code: %w", err)
	}

	// Create agent entity
	agent := &models.Agent{
		ID:                uuid.New().String(),
		AgentCode:         agentCode,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		Email:             req.Email,
		Phone:             req.Phone,
		AlternatePhone:    req.AlternatePhone,
		DateOfBirth:       req.DateOfBirth,
		Gender:            req.Gender,
		NationalID:        req.NationalID,
		BusinessName:      req.BusinessName,
		BusinessType:      req.BusinessType,
		BusinessLicense:   req.BusinessLicense,
		TaxID:             req.TaxID,
		Address:           req.Address,
		Location:          req.Location,
		BankAccount:       req.BankAccount,
		AgentType:         req.AgentType,
		Status:            models.AgentStatusPending,
		ParentAgentID:     req.ParentAgentID,
		HierarchyLevel:    hierarchyLevel,
		Region:            req.Region,
		Territory:         req.Territory,
		KYCStatus:         models.KYCStatusPending,
		OnboardingData: models.OnboardingData{
			OnboardingStage:     "registration",
			CompletedSteps:      []string{"basic_info"},
			PendingSteps:        []string{"kyc_verification", "training", "approval"},
			OnboardingStartDate: time.Now(),
			TrainingCompleted:   false,
			CertificationStatus: "pending",
		},
		Metadata:  req.Metadata,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		CreatedBy: createdBy,
		UpdatedBy: createdBy,
		IsActive:  false,
		Version:   1,
	}

	// Set default transaction limits based on agent type
	agent.TransactionLimits = s.getDefaultTransactionLimits(req.AgentType)

	// Set default commission profile
	agent.CommissionProfile = s.getDefaultCommissionProfile(req.AgentType)

	// Perform initial risk assessment
	riskScore, err := s.riskService.AssessAgentRisk(ctx, agent)
	if err != nil {
		return nil, fmt.Errorf("failed to assess risk: %w", err)
	}

	agent.KYCData.RiskScore = riskScore
	agent.KYCData.RiskCategory = s.riskService.GetRiskCategory(riskScore)

	// Save agent
	if err := s.agentRepo.Create(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	// Create hierarchy relationship if parent exists
	if req.ParentAgentID != nil {
		hierarchy := &models.AgentHierarchy{
			ID:            uuid.New().String(),
			ParentAgentID: *req.ParentAgentID,
			ChildAgentID:  agent.ID,
			RelationType:  "direct",
			CreatedAt:     time.Now(),
			CreatedBy:     createdBy,
			IsActive:      true,
		}

		if err := s.hierarchyRepo.Create(ctx, tx, hierarchy); err != nil {
			return nil, fmt.Errorf("failed to create hierarchy: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Trigger async processes
	go s.processNewAgent(agent)

	return agent, nil
}

// GetAgentByID retrieves agent by ID
func (s *AgentService) GetAgentByID(ctx context.Context, agentID string) (*models.Agent, error) {
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Enrich agent data
	if err := s.enrichAgentData(ctx, agent); err != nil {
		return nil, fmt.Errorf("failed to enrich agent data: %w", err)
	}

	return agent, nil
}

// UpdateAgent updates agent information
func (s *AgentService) UpdateAgent(ctx context.Context, agentID string, req *models.UpdateAgentRequest, updatedBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get existing agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Check authorization
	if !s.canUpdateAgent(updatedBy, agent) {
		return nil, ErrUnauthorized
	}

	// Track changes for audit
	changes := make(map[string]interface{})

	// Update fields if provided
	if req.FirstName != nil && *req.FirstName != agent.FirstName {
		changes["first_name"] = map[string]string{"from": agent.FirstName, "to": *req.FirstName}
		agent.FirstName = *req.FirstName
	}

	if req.LastName != nil && *req.LastName != agent.LastName {
		changes["last_name"] = map[string]string{"from": agent.LastName, "to": *req.LastName}
		agent.LastName = *req.LastName
	}

	if req.Email != nil && *req.Email != agent.Email {
		// Check if email is already taken
		existingAgent, _ := s.agentRepo.GetByEmail(ctx, *req.Email)
		if existingAgent != nil && existingAgent.ID != agentID {
			return nil, ErrAgentAlreadyExists
		}
		changes["email"] = map[string]string{"from": agent.Email, "to": *req.Email}
		agent.Email = *req.Email
	}

	if req.Phone != nil && *req.Phone != agent.Phone {
		// Check if phone is already taken
		existingAgent, _ := s.agentRepo.GetByPhone(ctx, *req.Phone)
		if existingAgent != nil && existingAgent.ID != agentID {
			return nil, ErrAgentAlreadyExists
		}
		changes["phone"] = map[string]string{"from": agent.Phone, "to": *req.Phone}
		agent.Phone = *req.Phone
	}

	if req.AlternatePhone != nil {
		changes["alternate_phone"] = map[string]string{"from": agent.AlternatePhone, "to": *req.AlternatePhone}
		agent.AlternatePhone = *req.AlternatePhone
	}

	if req.BusinessName != nil {
		changes["business_name"] = map[string]string{"from": agent.BusinessName, "to": *req.BusinessName}
		agent.BusinessName = *req.BusinessName
	}

	if req.BusinessType != nil {
		changes["business_type"] = map[string]string{"from": agent.BusinessType, "to": *req.BusinessType}
		agent.BusinessType = *req.BusinessType
	}

	if req.BusinessLicense != nil {
		changes["business_license"] = map[string]string{"from": agent.BusinessLicense, "to": *req.BusinessLicense}
		agent.BusinessLicense = *req.BusinessLicense
	}

	if req.TaxID != nil {
		changes["tax_id"] = map[string]string{"from": agent.TaxID, "to": *req.TaxID}
		agent.TaxID = *req.TaxID
	}

	if req.Address != nil {
		changes["address"] = map[string]interface{}{"from": agent.Address, "to": *req.Address}
		agent.Address = *req.Address
	}

	if req.Location != nil {
		changes["location"] = map[string]interface{}{"from": agent.Location, "to": *req.Location}
		agent.Location = *req.Location
	}

	if req.BankAccount != nil {
		changes["bank_account"] = map[string]interface{}{"from": agent.BankAccount, "to": *req.BankAccount}
		agent.BankAccount = *req.BankAccount
		// Reset verification status when bank account changes
		agent.BankAccount.IsVerified = false
		agent.BankAccount.VerifiedAt = nil
	}

	if req.Region != nil {
		changes["region"] = map[string]string{"from": agent.Region, "to": *req.Region}
		agent.Region = *req.Region
	}

	if req.Territory != nil {
		changes["territory"] = map[string]string{"from": agent.Territory, "to": *req.Territory}
		agent.Territory = *req.Territory
	}

	if req.Metadata != nil {
		changes["metadata"] = map[string]interface{}{"from": agent.Metadata, "to": req.Metadata}
		agent.Metadata = req.Metadata
	}

	// Update timestamps and version
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = updatedBy
	agent.Version++

	// Save changes
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Log changes if any
	if len(changes) > 0 {
		s.auditService.LogEvent(ctx, &models.AuditEvent{
			UserID:     updatedBy,
			Action:     "agent.updated",
			EntityID:   agentID,
			EntityType: "agent",
			Details:    map[string]interface{}{"changes": changes},
			Timestamp:  time.Now(),
		})
	}

	return agent, nil
}

// ListAgents retrieves agents with filtering and pagination
func (s *AgentService) ListAgents(ctx context.Context, filters *models.AgentFilters, pagination *models.Pagination, sorting *models.Sorting, userID, userRole string) (*models.AgentListResponse, error) {
	// Apply role-based filtering
	if err := s.applyRoleBasedFilters(filters, userID, userRole); err != nil {
		return nil, fmt.Errorf("failed to apply role filters: %w", err)
	}

	// Calculate offset
	pagination.Offset = (pagination.Page - 1) * pagination.Limit

	// Get agents
	agents, total, err := s.agentRepo.List(ctx, filters, pagination, sorting)
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	// Enrich agent data
	for i := range agents {
		if err := s.enrichAgentData(ctx, &agents[i]); err != nil {
			// Log error but don't fail the entire request
			continue
		}
	}

	return &models.AgentListResponse{
		Agents:     agents,
		Pagination: *pagination,
		Total:      total,
		Filters:    *filters,
	}, nil
}

// ApproveAgent approves a pending agent
func (s *AgentService) ApproveAgent(ctx context.Context, agentID string, req *models.ApprovalRequest, approvedBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate status transition
	if agent.Status != models.AgentStatusPending && agent.Status != models.AgentStatusUnderReview {
		return nil, ErrInvalidStatus
	}

	// Update agent status
	agent.Status = models.AgentStatusActive
	agent.IsActive = true
	agent.ApprovedAt = &time.Time{}
	*agent.ApprovedAt = time.Now()
	agent.ApprovedBy = &approvedBy
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = approvedBy
	agent.Version++

	// Update commission profile if provided
	if req.CommissionProfile != nil {
		agent.CommissionProfile = *req.CommissionProfile
	}

	// Update transaction limits if provided
	if req.TransactionLimits != nil {
		agent.TransactionLimits = *req.TransactionLimits
	}

	// Update onboarding data
	agent.OnboardingData.OnboardingStage = "approved"
	agent.OnboardingData.CompletedSteps = append(agent.OnboardingData.CompletedSteps, "approval")
	agent.OnboardingData.OnboardingEndDate = agent.ApprovedAt

	// Save agent
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Create approval record
	approval := &models.AgentApproval{
		ID:        uuid.New().String(),
		AgentID:   agentID,
		ApprovedBy: approvedBy,
		ApprovedAt: time.Now(),
		Notes:     req.Notes,
		Conditions: req.Conditions,
		Metadata:  req.Metadata,
	}

	if err := s.agentRepo.CreateApproval(ctx, tx, approval); err != nil {
		return nil, fmt.Errorf("failed to create approval record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Trigger post-approval processes
	go s.processAgentApproval(agent)

	return agent, nil
}

// RejectAgent rejects a pending agent
func (s *AgentService) RejectAgent(ctx context.Context, agentID string, req *models.RejectionRequest, rejectedBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate status transition
	if agent.Status != models.AgentStatusPending && agent.Status != models.AgentStatusUnderReview {
		return nil, ErrInvalidStatus
	}

	// Update agent status
	agent.Status = models.AgentStatusRejected
	agent.IsActive = false
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = rejectedBy
	agent.Version++

	// Update onboarding data
	agent.OnboardingData.OnboardingStage = "rejected"

	// Save agent
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Create rejection record
	rejection := &models.AgentRejection{
		ID:         uuid.New().String(),
		AgentID:    agentID,
		RejectedBy: rejectedBy,
		RejectedAt: time.Now(),
		Reason:     req.Reason,
		Notes:      req.Notes,
		Metadata:   req.Metadata,
	}

	if err := s.agentRepo.CreateRejection(ctx, tx, rejection); err != nil {
		return nil, fmt.Errorf("failed to create rejection record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return agent, nil
}

// SuspendAgent suspends an active agent
func (s *AgentService) SuspendAgent(ctx context.Context, agentID string, req *models.SuspensionRequest, suspendedBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate status transition
	if agent.Status != models.AgentStatusActive {
		return nil, ErrInvalidStatus
	}

	// Update agent status
	agent.Status = models.AgentStatusSuspended
	agent.IsActive = false
	agent.SuspendedAt = &time.Time{}
	*agent.SuspendedAt = time.Now()
	agent.SuspendedBy = &suspendedBy
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = suspendedBy
	agent.Version++

	// Save agent
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Create suspension record
	suspension := &models.AgentSuspension{
		ID:          uuid.New().String(),
		AgentID:     agentID,
		SuspendedBy: suspendedBy,
		SuspendedAt: time.Now(),
		Reason:      req.Reason,
		Duration:    req.Duration,
		Notes:       req.Notes,
		Conditions:  req.Conditions,
		Metadata:    req.Metadata,
	}

	if err := s.agentRepo.CreateSuspension(ctx, tx, suspension); err != nil {
		return nil, fmt.Errorf("failed to create suspension record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return agent, nil
}

// ReactivateAgent reactivates a suspended agent
func (s *AgentService) ReactivateAgent(ctx context.Context, agentID string, req *models.ReactivationRequest, reactivatedBy string) (*models.Agent, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate status transition
	if agent.Status != models.AgentStatusSuspended {
		return nil, ErrInvalidStatus
	}

	// Update agent status
	agent.Status = models.AgentStatusActive
	agent.IsActive = true
	agent.SuspendedAt = nil
	agent.SuspendedBy = nil
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = reactivatedBy
	agent.Version++

	// Save agent
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Create reactivation record
	reactivation := &models.AgentReactivation{
		ID:            uuid.New().String(),
		AgentID:       agentID,
		ReactivatedBy: reactivatedBy,
		ReactivatedAt: time.Now(),
		Notes:         req.Notes,
		Conditions:    req.Conditions,
		Metadata:      req.Metadata,
	}

	if err := s.agentRepo.CreateReactivation(ctx, tx, reactivation); err != nil {
		return nil, fmt.Errorf("failed to create reactivation record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return agent, nil
}

// GetAgentPerformance retrieves agent performance metrics
func (s *AgentService) GetAgentPerformance(ctx context.Context, agentID string, startDate, endDate time.Time) (*models.AgentPerformance, error) {
	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Calculate performance metrics
	performance := &models.AgentPerformance{
		AgentID:   agentID,
		Period:    fmt.Sprintf("%s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")),
		StartDate: startDate,
		EndDate:   endDate,
	}

	// Get transaction metrics
	transactionMetrics, err := s.calculateTransactionMetrics(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate transaction metrics: %w", err)
	}
	performance.TransactionMetrics = *transactionMetrics

	// Get commission metrics
	commissionMetrics, err := s.calculateCommissionMetrics(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate commission metrics: %w", err)
	}
	performance.CommissionMetrics = *commissionMetrics

	// Get customer metrics
	customerMetrics, err := s.calculateCustomerMetrics(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate customer metrics: %w", err)
	}
	performance.CustomerMetrics = *customerMetrics

	// Get compliance metrics
	complianceMetrics, err := s.calculateComplianceMetrics(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate compliance metrics: %w", err)
	}
	performance.ComplianceMetrics = *complianceMetrics

	// Calculate overall performance score
	performance.PerformanceScore = s.calculatePerformanceScore(performance)

	// Get ranking
	ranking, err := s.getAgentRanking(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent ranking: %w", err)
	}
	performance.Ranking = ranking

	// Get achievements
	achievements, err := s.getAgentAchievements(ctx, agentID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get achievements: %w", err)
	}
	performance.Achievements = achievements

	// Generate recommendations
	performance.Recommendations = s.generatePerformanceRecommendations(performance)

	return performance, nil
}

// GetAgentTransactions retrieves agent transaction history
func (s *AgentService) GetAgentTransactions(ctx context.Context, agentID string, filters *models.TransactionFilters, pagination *models.Pagination) (*models.TransactionListResponse, error) {
	// Verify agent exists
	_, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Get transactions
	transactions, total, err := s.transactionRepo.GetByAgentID(ctx, agentID, filters, pagination)
	if err != nil {
		return nil, fmt.Errorf("failed to get transactions: %w", err)
	}

	return &models.TransactionListResponse{
		Transactions: transactions,
		Pagination:   *pagination,
		Total:        total,
		Filters:      *filters,
	}, nil
}

// UpdateAgentLimits updates agent transaction limits
func (s *AgentService) UpdateAgentLimits(ctx context.Context, agentID string, req *models.UpdateLimitsRequest, updatedBy string) (*models.TransactionLimits, error) {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get agent
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate limits
	if err := s.validateTransactionLimits(req); err != nil {
		return nil, err
	}

	// Update limits
	limits := agent.TransactionLimits

	if req.DailyTransactionLimit != nil {
		limits.DailyTransactionLimit = *req.DailyTransactionLimit
	}
	if req.MonthlyTransactionLimit != nil {
		limits.MonthlyTransactionLimit = *req.MonthlyTransactionLimit
	}
	if req.SingleTransactionLimit != nil {
		limits.SingleTransactionLimit = *req.SingleTransactionLimit
	}
	if req.DailyTransactionCount != nil {
		limits.DailyTransactionCount = *req.DailyTransactionCount
	}
	if req.MonthlyTransactionCount != nil {
		limits.MonthlyTransactionCount = *req.MonthlyTransactionCount
	}
	if req.CashInLimit != nil {
		limits.CashInLimit = *req.CashInLimit
	}
	if req.CashOutLimit != nil {
		limits.CashOutLimit = *req.CashOutLimit
	}
	if req.TransferLimit != nil {
		limits.TransferLimit = *req.TransferLimit
	}
	if req.BillPaymentLimit != nil {
		limits.BillPaymentLimit = *req.BillPaymentLimit
	}
	if req.CurrencyLimits != nil {
		limits.CurrencyLimits = req.CurrencyLimits
	}

	limits.LastUpdated = time.Now()
	limits.UpdatedBy = updatedBy

	// Update agent
	agent.TransactionLimits = limits
	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = updatedBy
	agent.Version++

	// Save agent
	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Create limits change record
	limitsChange := &models.AgentLimitsChange{
		ID:        uuid.New().String(),
		AgentID:   agentID,
		ChangedBy: updatedBy,
		ChangedAt: time.Now(),
		Reason:    req.Reason,
		OldLimits: agent.TransactionLimits,
		NewLimits: limits,
	}

	if err := s.agentRepo.CreateLimitsChange(ctx, tx, limitsChange); err != nil {
		return nil, fmt.Errorf("failed to create limits change record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &limits, nil
}

// BulkUpdateAgents performs bulk operations on multiple agents
func (s *AgentService) BulkUpdateAgents(ctx context.Context, req *models.BulkUpdateRequest, updatedBy string) (*models.BulkUpdateResult, error) {
	result := &models.BulkUpdateResult{
		TotalCount: len(req.AgentIDs),
		Results:    make([]models.BulkOperationResult, 0, len(req.AgentIDs)),
		Errors:     make([]models.BulkOperationError, 0),
	}

	// Process each agent
	for _, agentID := range req.AgentIDs {
		err := s.processBulkOperation(ctx, agentID, req.Operation, req.Data, updatedBy)
		if err != nil {
			result.FailureCount++
			result.Errors = append(result.Errors, models.BulkOperationError{
				AgentID: agentID,
				Error:   err.Error(),
			})
		} else {
			result.SuccessCount++
			result.Results = append(result.Results, models.BulkOperationResult{
				AgentID: agentID,
				Status:  "success",
				Message: fmt.Sprintf("Operation %s completed successfully", req.Operation),
			})
		}
	}

	return result, nil
}

// ExportAgents exports agent data in specified format
func (s *AgentService) ExportAgents(ctx context.Context, filters *models.AgentFilters, format, userID string) ([]byte, error) {
	// Get all agents matching filters (no pagination for export)
	pagination := &models.Pagination{Page: 1, Limit: 10000}
	sorting := &models.Sorting{Field: "created_at", Order: "asc"}

	agents, _, err := s.agentRepo.List(ctx, filters, pagination, sorting)
	if err != nil {
		return nil, fmt.Errorf("failed to get agents for export: %w", err)
	}

	switch format {
	case "csv":
		return s.exportToCSV(agents)
	case "json":
		return s.exportToJSON(agents)
	case "xlsx":
		return s.exportToXLSX(agents)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// GetAgentDocuments retrieves agent documents
func (s *AgentService) GetAgentDocuments(ctx context.Context, agentID string) ([]models.Document, error) {
	// Verify agent exists
	_, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Get documents
	documents, err := s.documentRepo.GetByAgentID(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %w", err)
	}

	return documents, nil
}

// UploadAgentDocument uploads a document for an agent
func (s *AgentService) UploadAgentDocument(ctx context.Context, agentID string, file multipart.File, header *multipart.FileHeader, documentType, description, uploadedBy string) (*models.Document, error) {
	// Verify agent exists
	_, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAgentNotFound
		}
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}

	// Validate file
	if err := s.validateUploadedFile(header); err != nil {
		return nil, err
	}

	// Upload file and create document record
	document, err := s.documentRepo.Upload(ctx, agentID, file, header, documentType, description, uploadedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}

	return document, nil
}

// DeleteAgentDocument deletes an agent document
func (s *AgentService) DeleteAgentDocument(ctx context.Context, agentID, documentID, deletedBy string) error {
	// Verify agent exists
	_, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrAgentNotFound
		}
		return fmt.Errorf("failed to get agent: %w", err)
	}

	// Delete document
	if err := s.documentRepo.Delete(ctx, agentID, documentID, deletedBy); err != nil {
		if err == sql.ErrNoRows {
			return ErrDocumentNotFound
		}
		return fmt.Errorf("failed to delete document: %w", err)
	}

	return nil
}

// Helper methods

func (s *AgentService) validateHierarchyRules(childType, parentType models.AgentType) error {
	// Define valid hierarchy relationships
	validRelationships := map[models.AgentType][]models.AgentType{
		models.AgentTypeMaster:   {},                                                                    // Master agents have no parent
		models.AgentTypeSuper:    {models.AgentTypeMaster},                                             // Super agents can have master parents
		models.AgentTypeRegular:  {models.AgentTypeMaster, models.AgentTypeSuper},                     // Regular agents can have master or super parents
		models.AgentTypeSubAgent: {models.AgentTypeMaster, models.AgentTypeSuper, models.AgentTypeRegular}, // Sub-agents can have any parent
		models.AgentTypeMobile:   {models.AgentTypeMaster, models.AgentTypeSuper, models.AgentTypeRegular}, // Mobile agents can have any parent
		models.AgentTypeKiosk:    {models.AgentTypeMaster, models.AgentTypeSuper, models.AgentTypeRegular}, // Kiosk agents can have any parent
		models.AgentTypePartner:  {models.AgentTypeMaster},                                             // Partner agents can only have master parents
	}

	validParents, exists := validRelationships[childType]
	if !exists {
		return ErrInvalidHierarchy
	}

	for _, validParent := range validParents {
		if parentType == validParent {
			return nil
		}
	}

	return ErrInvalidHierarchy
}

func (s *AgentService) generateAgentCode(ctx context.Context, agentType models.AgentType, region string) (string, error) {
	// Generate agent code based on type and region
	prefix := s.getAgentCodePrefix(agentType)
	regionCode := s.getRegionCode(region)
	
	// Get next sequence number
	sequence, err := s.agentRepo.GetNextSequence(ctx, prefix, regionCode)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s%s%06d", prefix, regionCode, sequence), nil
}

func (s *AgentService) getAgentCodePrefix(agentType models.AgentType) string {
	prefixes := map[models.AgentType]string{
		models.AgentTypeMaster:   "MA",
		models.AgentTypeSuper:    "SA",
		models.AgentTypeRegular:  "AG",
		models.AgentTypeSubAgent: "SB",
		models.AgentTypeMobile:   "MB",
		models.AgentTypeKiosk:    "KS",
		models.AgentTypePartner:  "PT",
	}
	
	if prefix, exists := prefixes[agentType]; exists {
		return prefix
	}
	return "AG" // Default to regular agent
}

func (s *AgentService) getRegionCode(region string) string {
	// Map region names to codes
	regionCodes := map[string]string{
		"nairobi":   "NB",
		"mombasa":   "MB",
		"kisumu":    "KS",
		"nakuru":    "NK",
		"eldoret":   "ED",
		"thika":     "TK",
		"malindi":   "ML",
		"kitale":    "KT",
		"garissa":   "GR",
		"machakos":  "MC",
	}
	
	regionLower := strings.ToLower(region)
	if code, exists := regionCodes[regionLower]; exists {
		return code
	}
	return "XX" // Default code for unknown regions
}

func (s *AgentService) getDefaultTransactionLimits(agentType models.AgentType) models.TransactionLimits {
	// Define default limits based on agent type
	limitsMap := map[models.AgentType]models.TransactionLimits{
		models.AgentTypeMaster: {
			DailyTransactionLimit:   1000000.0,
			MonthlyTransactionLimit: 30000000.0,
			SingleTransactionLimit:  500000.0,
			DailyTransactionCount:   1000,
			MonthlyTransactionCount: 30000,
			CashInLimit:            500000.0,
			CashOutLimit:           500000.0,
			TransferLimit:          500000.0,
			BillPaymentLimit:       100000.0,
			CurrencyLimits: map[string]float64{
				"KES": 1000000.0,
				"USD": 10000.0,
				"EUR": 8500.0,
			},
			IsActive:    true,
			LastUpdated: time.Now(),
		},
		models.AgentTypeSuper: {
			DailyTransactionLimit:   500000.0,
			MonthlyTransactionLimit: 15000000.0,
			SingleTransactionLimit:  250000.0,
			DailyTransactionCount:   500,
			MonthlyTransactionCount: 15000,
			CashInLimit:            250000.0,
			CashOutLimit:           250000.0,
			TransferLimit:          250000.0,
			BillPaymentLimit:       50000.0,
			CurrencyLimits: map[string]float64{
				"KES": 500000.0,
				"USD": 5000.0,
				"EUR": 4250.0,
			},
			IsActive:    true,
			LastUpdated: time.Now(),
		},
		models.AgentTypeRegular: {
			DailyTransactionLimit:   100000.0,
			MonthlyTransactionLimit: 3000000.0,
			SingleTransactionLimit:  50000.0,
			DailyTransactionCount:   200,
			MonthlyTransactionCount: 6000,
			CashInLimit:            50000.0,
			CashOutLimit:           50000.0,
			TransferLimit:          50000.0,
			BillPaymentLimit:       25000.0,
			CurrencyLimits: map[string]float64{
				"KES": 100000.0,
				"USD": 1000.0,
				"EUR": 850.0,
			},
			IsActive:    true,
			LastUpdated: time.Now(),
		},
	}

	if limits, exists := limitsMap[agentType]; exists {
		return limits
	}
	
	// Return default limits for unknown agent types
	return limitsMap[models.AgentTypeRegular]
}

func (s *AgentService) getDefaultCommissionProfile(agentType models.AgentType) models.CommissionProfile {
	// Define default commission profiles based on agent type
	profilesMap := map[models.AgentType]models.CommissionProfile{
		models.AgentTypeMaster: {
			ProfileID:   "master_default",
			ProfileName: "Master Agent Default",
			CommissionRates: map[string]float64{
				"cash_in":      0.015, // 1.5%
				"cash_out":     0.020, // 2.0%
				"transfer":     0.010, // 1.0%
				"bill_payment": 0.005, // 0.5%
				"airtime":      0.008, // 0.8%
			},
			FeeStructure: map[string]float64{
				"monthly_fee":    0.0,
				"transaction_fee": 0.0,
				"setup_fee":      0.0,
			},
			MinimumCommission: 10.0,
			MaximumCommission: 10000.0,
			SettlementPeriod:  "daily",
			PaymentMethod:     "bank_transfer",
			TaxRate:          0.16, // 16% VAT
			IsActive:         true,
			EffectiveFrom:    time.Now(),
		},
		models.AgentTypeSuper: {
			ProfileID:   "super_default",
			ProfileName: "Super Agent Default",
			CommissionRates: map[string]float64{
				"cash_in":      0.012, // 1.2%
				"cash_out":     0.018, // 1.8%
				"transfer":     0.008, // 0.8%
				"bill_payment": 0.004, // 0.4%
				"airtime":      0.006, // 0.6%
			},
			FeeStructure: map[string]float64{
				"monthly_fee":    0.0,
				"transaction_fee": 0.0,
				"setup_fee":      0.0,
			},
			MinimumCommission: 5.0,
			MaximumCommission: 5000.0,
			SettlementPeriod:  "daily",
			PaymentMethod:     "bank_transfer",
			TaxRate:          0.16, // 16% VAT
			IsActive:         true,
			EffectiveFrom:    time.Now(),
		},
		models.AgentTypeRegular: {
			ProfileID:   "regular_default",
			ProfileName: "Regular Agent Default",
			CommissionRates: map[string]float64{
				"cash_in":      0.010, // 1.0%
				"cash_out":     0.015, // 1.5%
				"transfer":     0.006, // 0.6%
				"bill_payment": 0.003, // 0.3%
				"airtime":      0.005, // 0.5%
			},
			FeeStructure: map[string]float64{
				"monthly_fee":    0.0,
				"transaction_fee": 0.0,
				"setup_fee":      0.0,
			},
			MinimumCommission: 2.0,
			MaximumCommission: 2000.0,
			SettlementPeriod:  "weekly",
			PaymentMethod:     "mobile_money",
			TaxRate:          0.16, // 16% VAT
			IsActive:         true,
			EffectiveFrom:    time.Now(),
		},
	}

	if profile, exists := profilesMap[agentType]; exists {
		return profile
	}
	
	// Return default profile for unknown agent types
	return profilesMap[models.AgentTypeRegular]
}

func (s *AgentService) enrichAgentData(ctx context.Context, agent *models.Agent) error {
	// Add any additional data enrichment logic here
	// For example: calculate current balance, recent activity, etc.
	return nil
}

func (s *AgentService) applyRoleBasedFilters(filters *models.AgentFilters, userID, userRole string) error {
	// Apply role-based filtering logic
	switch userRole {
	case "admin", "system":
		// Admins can see all agents
		return nil
	case "master_agent":
		// Master agents can see their hierarchy
		// Add parent_id filter if not already specified
		if filters.ParentID == "" {
			filters.ParentID = userID
		}
	case "super_agent":
		// Super agents can see their sub-agents
		if filters.ParentID == "" {
			filters.ParentID = userID
		}
	case "agent":
		// Regular agents can only see themselves
		// This would require additional filtering logic
	}
	
	return nil
}

func (s *AgentService) canUpdateAgent(userID string, agent *models.Agent) bool {
	// Implement authorization logic
	// For now, allow updates by creator or admin
	return agent.CreatedBy == userID || s.isAdmin(userID)
}

func (s *AgentService) isAdmin(userID string) bool {
	var role string
	err := s.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role)
	if err != nil {
		return false
	}
	return role == "admin" || role == "system"
}

func (s *AgentService) processNewAgent(agent *models.Agent) {
	ctx := context.Background()

	s.notificationService.Send(ctx, &models.Notification{
		RecipientID: agent.ID,
		Type:        "welcome",
		Channel:     "email",
		Subject:     "Welcome to the Agent Banking Platform",
		Body:        fmt.Sprintf("Dear %s %s, your agent registration is being processed.", agent.FirstName, agent.LastName),
	})

	s.kycService.InitiateVerification(ctx, agent.ID, agent.NationalID)

	s.auditService.LogEvent(ctx, &models.AuditEvent{
		UserID:     agent.CreatedBy,
		Action:     "agent.created",
		EntityID:   agent.ID,
		EntityType: "agent",
		Details:    map[string]interface{}{"agent_code": agent.AgentCode, "type": agent.AgentType},
		Timestamp:  time.Now(),
	})
}

func (s *AgentService) processAgentApproval(agent *models.Agent) {
	ctx := context.Background()

	s.notificationService.Send(ctx, &models.Notification{
		RecipientID: agent.ID,
		Type:        "approval",
		Channel:     "email",
		Subject:     "Agent Application Approved",
		Body:        fmt.Sprintf("Dear %s %s, your agent application has been approved. Your agent code is %s.", agent.FirstName, agent.LastName, agent.AgentCode),
	})

	s.auditService.LogEvent(ctx, &models.AuditEvent{
		UserID:     *agent.ApprovedBy,
		Action:     "agent.approved",
		EntityID:   agent.ID,
		EntityType: "agent",
		Details:    map[string]interface{}{"agent_code": agent.AgentCode},
		Timestamp:  time.Now(),
	})
}

func (s *AgentService) calculateTransactionMetrics(ctx context.Context, agentID string, startDate, endDate time.Time) (*models.TransactionMetrics, error) {
	metrics := &models.TransactionMetrics{}

	row := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(amount), 0),
		        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0)
		 FROM transactions WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`,
		agentID, startDate, endDate,
	)
	if err := row.Scan(&metrics.TotalTransactions, &metrics.TotalVolume, &metrics.SuccessRate); err != nil {
		return nil, fmt.Errorf("failed to query transaction metrics: %w", err)
	}

	return metrics, nil
}

func (s *AgentService) calculateCommissionMetrics(ctx context.Context, agentID string, startDate, endDate time.Time) (*models.CommissionMetrics, error) {
	metrics := &models.CommissionMetrics{}

	row := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0), COALESCE(AVG(amount), 0)
		 FROM commissions WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`,
		agentID, startDate, endDate,
	)
	if err := row.Scan(&metrics.TotalCommission, &metrics.AverageCommission); err != nil {
		return nil, fmt.Errorf("failed to query commission metrics: %w", err)
	}

	return metrics, nil
}

func (s *AgentService) calculateCustomerMetrics(ctx context.Context, agentID string, startDate, endDate time.Time) (*models.CustomerMetrics, error) {
	metrics := &models.CustomerMetrics{}

	row := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(COUNT(*), 0) FROM customers WHERE agent_id = $1`,
		agentID,
	)
	if err := row.Scan(&metrics.TotalCustomers); err != nil {
		return nil, fmt.Errorf("failed to query total customers: %w", err)
	}

	row = s.db.QueryRowContext(ctx,
		`SELECT COALESCE(COUNT(*), 0) FROM customers WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`,
		agentID, startDate, endDate,
	)
	if err := row.Scan(&metrics.NewCustomers); err != nil {
		return nil, fmt.Errorf("failed to query new customers: %w", err)
	}

	return metrics, nil
}

func (s *AgentService) calculateComplianceMetrics(ctx context.Context, agentID string, startDate, endDate time.Time) (*models.ComplianceMetrics, error) {
	metrics := &models.ComplianceMetrics{}

	var totalChecks, passedChecks int
	row := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(COUNT(*), 0),
		        COALESCE(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END), 0)
		 FROM compliance_checks WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`,
		agentID, startDate, endDate,
	)
	if err := row.Scan(&totalChecks, &passedChecks); err != nil {
		return nil, fmt.Errorf("failed to query compliance metrics: %w", err)
	}
	if totalChecks > 0 {
		metrics.ComplianceScore = float64(passedChecks) / float64(totalChecks) * 100.0
	}

	var totalKYC, completedKYC int
	row = s.db.QueryRowContext(ctx,
		`SELECT COALESCE(COUNT(*), 0),
		        COALESCE(SUM(CASE WHEN kyc_status = 'verified' THEN 1 ELSE 0 END), 0)
		 FROM customers WHERE agent_id = $1`,
		agentID,
	)
	if err := row.Scan(&totalKYC, &completedKYC); err != nil {
		return nil, fmt.Errorf("failed to query KYC completion: %w", err)
	}
	if totalKYC > 0 {
		metrics.KYCCompletionRate = float64(completedKYC) / float64(totalKYC) * 100.0
	}

	return metrics, nil
}

func (s *AgentService) calculatePerformanceScore(performance *models.AgentPerformance) float64 {
	txWeight := 0.30
	commWeight := 0.25
	custWeight := 0.25
	compWeight := 0.20

	txScore := performance.TransactionMetrics.SuccessRate * 100.0
	commScore := 0.0
	if performance.CommissionMetrics.TotalCommission > 0 {
		commScore = 80.0
	}
	custScore := 0.0
	if performance.CustomerMetrics.NewCustomers > 0 {
		custScore = float64(performance.CustomerMetrics.NewCustomers) / float64(performance.CustomerMetrics.TotalCustomers+1) * 100.0
	}
	compScore := performance.ComplianceMetrics.ComplianceScore

	score := txScore*txWeight + commScore*commWeight + custScore*custWeight + compScore*compWeight
	if score > 100.0 {
		score = 100.0
	}
	return score
}

func (s *AgentService) getAgentRanking(ctx context.Context, agentID string, startDate, endDate time.Time) (int, error) {
	var ranking int
	err := s.db.QueryRowContext(ctx,
		`WITH agent_volumes AS (
			SELECT agent_id, COALESCE(SUM(amount), 0) as total_volume
			FROM transactions
			WHERE created_at BETWEEN $1 AND $2
			GROUP BY agent_id
		), ranked AS (
			SELECT agent_id, ROW_NUMBER() OVER (ORDER BY total_volume DESC) as rank
			FROM agent_volumes
		)
		SELECT COALESCE(rank, 0) FROM ranked WHERE agent_id = $3`,
		startDate, endDate, agentID,
	).Scan(&ranking)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to calculate ranking: %w", err)
	}
	return ranking, nil
}

func (s *AgentService) getAgentAchievements(ctx context.Context, agentID string, startDate, endDate time.Time) ([]models.Achievement, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, description, achieved_at FROM agent_achievements
		 WHERE agent_id = $1 AND achieved_at BETWEEN $2 AND $3 ORDER BY achieved_at DESC`,
		agentID, startDate, endDate,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query achievements: %w", err)
	}
	defer rows.Close()

	var achievements []models.Achievement
	for rows.Next() {
		var a models.Achievement
		if err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.AchievedAt); err != nil {
			return nil, fmt.Errorf("failed to scan achievement: %w", err)
		}
		achievements = append(achievements, a)
	}
	return achievements, rows.Err()
}

func (s *AgentService) generatePerformanceRecommendations(performance *models.AgentPerformance) []string {
	var recs []string

	if performance.TransactionMetrics.SuccessRate < 0.9 {
		recs = append(recs, "Transaction success rate is below 90%. Review failed transactions for common issues.")
	}
	if performance.CustomerMetrics.NewCustomers == 0 {
		recs = append(recs, "No new customers acquired this period. Focus on customer acquisition.")
	}
	if performance.ComplianceMetrics.KYCCompletionRate < 80.0 {
		recs = append(recs, "KYC completion rate is below 80%. Ensure all customers complete verification.")
	}
	if performance.ComplianceMetrics.ComplianceScore < 70.0 {
		recs = append(recs, "Compliance score needs improvement. Review recent compliance check failures.")
	}
	if performance.PerformanceScore < 50.0 {
		recs = append(recs, "Overall performance is below expectations. Schedule a performance review meeting.")
	}

	if len(recs) == 0 {
		recs = append(recs, "Strong performance across all metrics. Continue current practices.")
	}
	return recs
}

func (s *AgentService) validateTransactionLimits(req *models.UpdateLimitsRequest) error {
	if req.DailyLimit != nil && *req.DailyLimit < 0 {
		return ErrInvalidLimits
	}
	if req.TransactionLimit != nil && *req.TransactionLimit < 0 {
		return ErrInvalidLimits
	}
	if req.DailyLimit != nil && req.TransactionLimit != nil && *req.TransactionLimit > *req.DailyLimit {
		return fmt.Errorf("%w: per-transaction limit cannot exceed daily limit", ErrInvalidLimits)
	}
	if req.MonthlyLimit != nil && req.DailyLimit != nil && *req.DailyLimit*31 > *req.MonthlyLimit {
		return fmt.Errorf("%w: daily limit * 31 exceeds monthly limit", ErrInvalidLimits)
	}
	return nil
}

func (s *AgentService) processBulkOperation(ctx context.Context, agentID, operation string, data map[string]interface{}, updatedBy string) error {
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		return fmt.Errorf("agent %s not found: %w", agentID, err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	switch operation {
	case "activate":
		agent.Status = models.AgentStatusActive
		agent.IsActive = true
	case "suspend":
		agent.Status = models.AgentStatusSuspended
		agent.IsActive = false
	case "update_limits":
		if limits, ok := data["transaction_limits"]; ok {
			if limitsMap, ok := limits.(map[string]interface{}); ok {
				if daily, ok := limitsMap["daily_limit"].(float64); ok {
					agent.TransactionLimits.DailyLimit = daily
				}
			}
		}
	default:
		return fmt.Errorf("unsupported bulk operation: %s", operation)
	}

	agent.UpdatedAt = time.Now()
	agent.UpdatedBy = updatedBy
	agent.Version++

	if err := s.agentRepo.Update(ctx, tx, agent); err != nil {
		return fmt.Errorf("failed to update agent %s: %w", agentID, err)
	}

	return tx.Commit()
}

func (s *AgentService) exportToCSV(agents []models.Agent) ([]byte, error) {
	var buf strings.Builder
	writer := csv.NewWriter(&buf)

	header := []string{"ID", "AgentCode", "FirstName", "LastName", "Email", "Phone", "AgentType", "Status", "Region", "CreatedAt"}
	if err := writer.Write(header); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	for _, a := range agents {
		row := []string{
			a.ID, a.AgentCode, a.FirstName, a.LastName,
			a.Email, a.Phone, a.AgentType, string(a.Status),
			a.Region, a.CreatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV flush error: %w", err)
	}

	return []byte(buf.String()), nil
}

func (s *AgentService) exportToJSON(agents []models.Agent) ([]byte, error) {
	return json.Marshal(agents)
}

func (s *AgentService) exportToXLSX(agents []models.Agent) ([]byte, error) {
	var buf strings.Builder
	buf.WriteString("ID\tAgentCode\tFirstName\tLastName\tEmail\tPhone\tAgentType\tStatus\tRegion\tCreatedAt\n")
	for _, a := range agents {
		buf.WriteString(fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			a.ID, a.AgentCode, a.FirstName, a.LastName,
			a.Email, a.Phone, a.AgentType, string(a.Status),
			a.Region, a.CreatedAt.Format(time.RFC3339),
		))
	}
	return []byte(buf.String()), nil
}

func (s *AgentService) validateUploadedFile(header *multipart.FileHeader) error {
	// Validate file type and size
	maxSize := int64(10 << 20) // 10MB
	if header.Size > maxSize {
		return ErrFileTooLarge
	}

	// Check file type
	allowedTypes := []string{
		"image/jpeg",
		"image/png",
		"image/gif",
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	}

	// This is a simplified check - in production, you'd want to validate the actual file content
	contentType := header.Header.Get("Content-Type")
	for _, allowedType := range allowedTypes {
		if contentType == allowedType {
			return nil
		}
	}

	return ErrInvalidFileType
}

