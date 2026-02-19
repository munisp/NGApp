import os
// Agent Hierarchy Service - Go Microservice
// This service manages the 4-tier agent hierarchy: Master Agents, Super Agents, Agents, and Sub Agents
// with complete CRUD operations, territory management, and performance tracking.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// =====================================================
// DATABASE MODELS
// =====================================================

// AgentTier enumeration - 5-tier hierarchy
type AgentTier string

const (
	TraineeTier     AgentTier = "trainee"
	SubAgentTier    AgentTier = "sub_agent"
	AgentTier_      AgentTier = "agent"
	SuperAgentTier  AgentTier = "super_agent"
	MasterAgentTier AgentTier = "master_agent"
)

// AgentStatus enumeration
type AgentStatus string

const (
	StatusPending     AgentStatus = "pending"
	StatusActive      AgentStatus = "active"
	StatusSuspended   AgentStatus = "suspended"
	StatusInactive    AgentStatus = "inactive"
	StatusTerminated  AgentStatus = "terminated"
	StatusUnderReview AgentStatus = "under_review"
)

// TerritoryType enumeration
type TerritoryType string

const (
	TerritoryRural        TerritoryType = "rural"
	TerritoryUrban        TerritoryType = "urban"
	TerritorySemiUrban    TerritoryType = "semi_urban"
	TerritoryMetropolitan TerritoryType = "metropolitan"
)

// PerformanceRating enumeration
type PerformanceRating string

const (
	RatingExcellent        PerformanceRating = "excellent"
	RatingGood             PerformanceRating = "good"
	RatingSatisfactory     PerformanceRating = "satisfactory"
	RatingNeedsImprovement PerformanceRating = "needs_improvement"
	RatingPoor             PerformanceRating = "poor"
)

// MasterAgent model - Top-level network coordinators
type MasterAgent struct {
	ID                      uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentCode               string            `json:"agent_code" gorm:"uniqueIndex;not null"`
	CompanyName             string            `json:"company_name" gorm:"not null"`
	RegistrationNumber      string            `json:"registration_number" gorm:"uniqueIndex;not null"`
	TaxID                   string            `json:"tax_id" gorm:"uniqueIndex;not null"`
	PrimaryContactName      string            `json:"primary_contact_name" gorm:"not null"`
	PrimaryContactEmail     string            `json:"primary_contact_email" gorm:"uniqueIndex;not null"`
	PrimaryContactPhone     string            `json:"primary_contact_phone" gorm:"not null"`
	SecondaryContactName    *string           `json:"secondary_contact_name"`
	SecondaryContactEmail   *string           `json:"secondary_contact_email"`
	SecondaryContactPhone   *string           `json:"secondary_contact_phone"`
	HeadquartersAddress     string            `json:"headquarters_address" gorm:"not null"`
	City                    string            `json:"city" gorm:"not null"`
	StateProvince           string            `json:"state_province" gorm:"not null"`
	Country                 string            `json:"country" gorm:"not null"`
	PostalCode              string            `json:"postal_code" gorm:"not null"`
	BusinessType            string            `json:"business_type" gorm:"not null"`
	YearsInOperation        int               `json:"years_in_operation" gorm:"not null"`
	AnnualRevenue           *float64          `json:"annual_revenue"`
	EmployeeCount           *int              `json:"employee_count"`
	BankName                string            `json:"bank_name" gorm:"not null"`
	BankAccountNumber       string            `json:"bank_account_number" gorm:"not null"`
	BankRoutingNumber       string            `json:"bank_routing_number" gorm:"not null"`
	BankSwiftCode           *string           `json:"bank_swift_code"`
	Status                  AgentStatus       `json:"status" gorm:"default:'pending'"`
	Tier                    AgentTier         `json:"tier" gorm:"default:'master_agent'"`
	PerformanceRating       PerformanceRating `json:"performance_rating" gorm:"default:'satisfactory'"`
	TotalNetworkSize        int               `json:"total_network_size" gorm:"default:0"`
	TotalTransactionVolume  float64           `json:"total_transaction_volume" gorm:"default:0"`
	TotalCommissionEarned   float64           `json:"total_commission_earned" gorm:"default:0"`
	AssignedRegions         pq.StringArray    `json:"assigned_regions" gorm:"type:text[]"`
	TerritorySizeKm2        *float64          `json:"territory_size_km2"`
	PopulationCoverage      *int              `json:"population_coverage"`
	RiskScore               float64           `json:"risk_score" gorm:"default:50.0"`
	ComplianceScore         float64           `json:"compliance_score" gorm:"default:50.0"`
	LastAuditDate           *time.Time        `json:"last_audit_date"`
	NextAuditDue            *time.Time        `json:"next_audit_due"`
	CreatedAt               time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt               time.Time         `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy               *uuid.UUID        `json:"created_by"`
	UpdatedBy               *uuid.UUID        `json:"updated_by"`

	// Relationships
	SuperAgents []SuperAgent `json:"super_agents,omitempty" gorm:"foreignKey:MasterAgentID"`
}

// SuperAgent model - Regional managers and supervisors
type SuperAgent struct {
	ID                        uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentCode                 string            `json:"agent_code" gorm:"uniqueIndex;not null"`
	MasterAgentID             uuid.UUID         `json:"master_agent_id" gorm:"not null"`
	FirstName                 string            `json:"first_name" gorm:"not null"`
	LastName                  string            `json:"last_name" gorm:"not null"`
	MiddleName                *string           `json:"middle_name"`
	DateOfBirth               time.Time         `json:"date_of_birth" gorm:"not null"`
	Gender                    *string           `json:"gender"`
	Nationality               string            `json:"nationality" gorm:"not null"`
	NationalID                string            `json:"national_id" gorm:"uniqueIndex;not null"`
	Email                     string            `json:"email" gorm:"uniqueIndex;not null"`
	PhonePrimary              string            `json:"phone_primary" gorm:"not null"`
	PhoneSecondary            *string           `json:"phone_secondary"`
	EmergencyContactName      *string           `json:"emergency_contact_name"`
	EmergencyContactPhone     *string           `json:"emergency_contact_phone"`
	ResidentialAddress        string            `json:"residential_address" gorm:"not null"`
	City                      string            `json:"city" gorm:"not null"`
	StateProvince             string            `json:"state_province" gorm:"not null"`
	Country                   string            `json:"country" gorm:"not null"`
	PostalCode                string            `json:"postal_code" gorm:"not null"`
	EducationLevel            *string           `json:"education_level"`
	WorkExperienceYears       *int              `json:"work_experience_years"`
	PreviousBankingExperience bool              `json:"previous_banking_experience" gorm:"default:false"`
	LanguagesSpoken           pq.StringArray    `json:"languages_spoken" gorm:"type:text[]"`
	BankName                  string            `json:"bank_name" gorm:"not null"`
	BankAccountNumber         string            `json:"bank_account_number" gorm:"not null"`
	BankRoutingNumber         string            `json:"bank_routing_number" gorm:"not null"`
	Status                    AgentStatus       `json:"status" gorm:"default:'pending'"`
	Tier                      AgentTier         `json:"tier" gorm:"default:'super_agent'"`
	PerformanceRating         PerformanceRating `json:"performance_rating" gorm:"default:'satisfactory'"`
	SupervisedAgentsCount     int               `json:"supervised_agents_count" gorm:"default:0"`
	TotalTransactionVolume    float64           `json:"total_transaction_volume" gorm:"default:0"`
	TotalCommissionEarned     float64           `json:"total_commission_earned" gorm:"default:0"`
	AssignedTerritories       pq.StringArray    `json:"assigned_territories" gorm:"type:text[]"`
	TerritoryType             *TerritoryType    `json:"territory_type"`
	CoverageAreaKm2           *float64          `json:"coverage_area_km2"`
	PopulationServed          *int              `json:"population_served"`
	MonthlyTransactionTarget  *float64          `json:"monthly_transaction_target"`
	MonthlyTransactionAchieved *float64         `json:"monthly_transaction_achieved"`
	CustomerSatisfactionScore *float64          `json:"customer_satisfaction_score"`
	NetworkGrowthRate         *float64          `json:"network_growth_rate"`
	RiskScore                 float64           `json:"risk_score" gorm:"default:50.0"`
	ComplianceScore           float64           `json:"compliance_score" gorm:"default:50.0"`
	OnboardedAt               *time.Time        `json:"onboarded_at"`
	ActivatedAt               *time.Time        `json:"activated_at"`
	LastLoginAt               *time.Time        `json:"last_login_at"`
	CreatedAt                 time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                 time.Time         `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                 *uuid.UUID        `json:"created_by"`
	UpdatedBy                 *uuid.UUID        `json:"updated_by"`

	// Relationships
	MasterAgent *MasterAgent `json:"master_agent,omitempty" gorm:"foreignKey:MasterAgentID"`
	Agents      []Agent      `json:"agents,omitempty" gorm:"foreignKey:SuperAgentID"`
}

// Agent model - Primary service providers
type Agent struct {
	ID                        uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentCode                 string            `json:"agent_code" gorm:"uniqueIndex;not null"`
	SuperAgentID              uuid.UUID         `json:"super_agent_id" gorm:"not null"`
	MasterAgentID             uuid.UUID         `json:"master_agent_id" gorm:"not null"`
	FirstName                 string            `json:"first_name" gorm:"not null"`
	LastName                  string            `json:"last_name" gorm:"not null"`
	MiddleName                *string           `json:"middle_name"`
	DateOfBirth               time.Time         `json:"date_of_birth" gorm:"not null"`
	Gender                    *string           `json:"gender"`
	Nationality               string            `json:"nationality" gorm:"not null"`
	NationalID                string            `json:"national_id" gorm:"uniqueIndex;not null"`
	Email                     string            `json:"email" gorm:"uniqueIndex;not null"`
	PhonePrimary              string            `json:"phone_primary" gorm:"not null"`
	PhoneSecondary            *string           `json:"phone_secondary"`
	EmergencyContactName      *string           `json:"emergency_contact_name"`
	EmergencyContactPhone     *string           `json:"emergency_contact_phone"`
	ResidentialAddress        string            `json:"residential_address" gorm:"not null"`
	BusinessAddress           *string           `json:"business_address"`
	City                      string            `json:"city" gorm:"not null"`
	StateProvince             string            `json:"state_province" gorm:"not null"`
	Country                   string            `json:"country" gorm:"not null"`
	PostalCode                string            `json:"postal_code" gorm:"not null"`
	EducationLevel            *string           `json:"education_level"`
	WorkExperienceYears       *int              `json:"work_experience_years"`
	PreviousBankingExperience bool              `json:"previous_banking_experience" gorm:"default:false"`
	BusinessType              *string           `json:"business_type"`
	BusinessRegistrationNumber *string          `json:"business_registration_number"`
	LanguagesSpoken           pq.StringArray    `json:"languages_spoken" gorm:"type:text[]"`
	BankName                  string            `json:"bank_name" gorm:"not null"`
	BankAccountNumber         string            `json:"bank_account_number" gorm:"not null"`
	BankRoutingNumber         string            `json:"bank_routing_number" gorm:"not null"`
	Status                    AgentStatus       `json:"status" gorm:"default:'pending'"`
	Tier                      AgentTier         `json:"tier" gorm:"default:'agent'"`
	PerformanceRating         PerformanceRating `json:"performance_rating" gorm:"default:'satisfactory'"`
	SubAgentsCount            int               `json:"sub_agents_count" gorm:"default:0"`
	TotalTransactionVolume    float64           `json:"total_transaction_volume" gorm:"default:0"`
	TotalCommissionEarned     float64           `json:"total_commission_earned" gorm:"default:0"`
	AssignedArea              *string           `json:"assigned_area"`
	TerritoryType             *TerritoryType    `json:"territory_type"`
	CoverageRadiusKm          *float64          `json:"coverage_radius_km"`
	EstimatedPopulation       *int              `json:"estimated_population"`
	OperatingHours            *string           `json:"operating_hours"`
	DailyTransactionLimit     float64           `json:"daily_transaction_limit" gorm:"default:50000"`
	MonthlyTransactionLimit   float64           `json:"monthly_transaction_limit" gorm:"default:1000000"`
	CurrentDailyVolume        float64           `json:"current_daily_volume" gorm:"default:0"`
	CurrentMonthlyVolume      float64           `json:"current_monthly_volume" gorm:"default:0"`
	CustomerCount             int               `json:"customer_count" gorm:"default:0"`
	CustomerSatisfactionScore *float64          `json:"customer_satisfaction_score"`
	CommissionRate            float64           `json:"commission_rate" gorm:"default:0.0025"`
	CommissionTier            string            `json:"commission_tier" gorm:"default:'standard'"`
	BonusEligibility          bool              `json:"bonus_eligibility" gorm:"default:true"`
	RiskScore                 float64           `json:"risk_score" gorm:"default:50.0"`
	ComplianceScore           float64           `json:"compliance_score" gorm:"default:50.0"`
	OnboardedAt               *time.Time        `json:"onboarded_at"`
	ActivatedAt               *time.Time        `json:"activated_at"`
	LastLoginAt               *time.Time        `json:"last_login_at"`
	LastTransactionAt         *time.Time        `json:"last_transaction_at"`
	CreatedAt                 time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                 time.Time         `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                 *uuid.UUID        `json:"created_by"`
	UpdatedBy                 *uuid.UUID        `json:"updated_by"`

	// Relationships
	SuperAgent  *SuperAgent `json:"super_agent,omitempty" gorm:"foreignKey:SuperAgentID"`
	MasterAgent *MasterAgent `json:"master_agent,omitempty" gorm:"foreignKey:MasterAgentID"`
	SubAgents   []SubAgent  `json:"sub_agents,omitempty" gorm:"foreignKey:ParentAgentID"`
}

// SubAgent model - Local community representatives
type SubAgent struct {
	ID                        uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AgentCode                 string            `json:"agent_code" gorm:"uniqueIndex;not null"`
	ParentAgentID             uuid.UUID         `json:"parent_agent_id" gorm:"not null"`
	SuperAgentID              uuid.UUID         `json:"super_agent_id" gorm:"not null"`
	MasterAgentID             uuid.UUID         `json:"master_agent_id" gorm:"not null"`
	FirstName                 string            `json:"first_name" gorm:"not null"`
	LastName                  string            `json:"last_name" gorm:"not null"`
	MiddleName                *string           `json:"middle_name"`
	DateOfBirth               time.Time         `json:"date_of_birth" gorm:"not null"`
	Gender                    *string           `json:"gender"`
	Nationality               string            `json:"nationality" gorm:"not null"`
	NationalID                string            `json:"national_id" gorm:"uniqueIndex;not null"`
	Email                     *string           `json:"email"`
	PhonePrimary              string            `json:"phone_primary" gorm:"not null"`
	PhoneSecondary            *string           `json:"phone_secondary"`
	EmergencyContactName      *string           `json:"emergency_contact_name"`
	EmergencyContactPhone     *string           `json:"emergency_contact_phone"`
	ResidentialAddress        string            `json:"residential_address" gorm:"not null"`
	BusinessAddress           *string           `json:"business_address"`
	VillageCommunity          *string           `json:"village_community"`
	City                      string            `json:"city" gorm:"not null"`
	StateProvince             string            `json:"state_province" gorm:"not null"`
	Country                   string            `json:"country" gorm:"not null"`
	PostalCode                *string           `json:"postal_code"`
	EducationLevel            *string           `json:"education_level"`
	PrimaryOccupation         *string           `json:"primary_occupation"`
	CommunityRole             *string           `json:"community_role"`
	LocalLanguage             *string           `json:"local_language"`
	LiteracyLevel             *string           `json:"literacy_level"`
	BankName                  *string           `json:"bank_name"`
	BankAccountNumber         *string           `json:"bank_account_number"`
	BankRoutingNumber         *string           `json:"bank_routing_number"`
	MobileMoneyProvider       *string           `json:"mobile_money_provider"`
	MobileMoneyNumber         *string           `json:"mobile_money_number"`
	Status                    AgentStatus       `json:"status" gorm:"default:'pending'"`
	Tier                      AgentTier         `json:"tier" gorm:"default:'sub_agent'"`
	PerformanceRating         PerformanceRating `json:"performance_rating" gorm:"default:'satisfactory'"`
	TotalTransactionVolume    float64           `json:"total_transaction_volume" gorm:"default:0"`
	TotalCommissionEarned     float64           `json:"total_commission_earned" gorm:"default:0"`
	AssignedCommunity         *string           `json:"assigned_community"`
	TerritoryType             TerritoryType     `json:"territory_type" gorm:"default:'rural'"`
	CoverageRadiusKm          float64           `json:"coverage_radius_km" gorm:"default:5.0"`
	EstimatedPopulation       *int              `json:"estimated_population"`
	OperatingDays             pq.StringArray    `json:"operating_days" gorm:"type:text[]"`
	OperatingHours            *string           `json:"operating_hours"`
	DailyTransactionLimit     float64           `json:"daily_transaction_limit" gorm:"default:10000"`
	MonthlyTransactionLimit   float64           `json:"monthly_transaction_limit" gorm:"default:200000"`
	CurrentDailyVolume        float64           `json:"current_daily_volume" gorm:"default:0"`
	CurrentMonthlyVolume      float64           `json:"current_monthly_volume" gorm:"default:0"`
	CustomerCount             int               `json:"customer_count" gorm:"default:0"`
	CommunityTrustScore       *float64          `json:"community_trust_score"`
	CommissionRate            float64           `json:"commission_rate" gorm:"default:0.002"`
	CommissionTier            string            `json:"commission_tier" gorm:"default:'basic'"`
	RiskScore                 float64           `json:"risk_score" gorm:"default:50.0"`
	OnboardedAt               *time.Time        `json:"onboarded_at"`
	ActivatedAt               *time.Time        `json:"activated_at"`
	LastActivityAt            *time.Time        `json:"last_activity_at"`
	CreatedAt                 time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt                 time.Time         `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	CreatedBy                 *uuid.UUID        `json:"created_by"`
	UpdatedBy                 *uuid.UUID        `json:"updated_by"`

	// Relationships
	ParentAgent *Agent       `json:"parent_agent,omitempty" gorm:"foreignKey:ParentAgentID"`
	SuperAgent  *SuperAgent  `json:"super_agent,omitempty" gorm:"foreignKey:SuperAgentID"`
	MasterAgent *MasterAgent `json:"master_agent,omitempty" gorm:"foreignKey:MasterAgentID"`
}

// AgentHierarchyView for unified agent queries
type AgentHierarchyView struct {
	AgentType              string    `json:"agent_type"`
	ID                     uuid.UUID `json:"id"`
	AgentCode              string    `json:"agent_code"`
	Name                   string    `json:"name"`
	Email                  string    `json:"email"`
	Phone                  string    `json:"phone"`
	Status                 string    `json:"status"`
	PerformanceRating      string    `json:"performance_rating"`
	TotalNetworkSize       int       `json:"total_network_size"`
	TotalTransactionVolume float64   `json:"total_transaction_volume"`
	ParentID               *uuid.UUID `json:"parent_id"`
	CreatedAt              time.Time `json:"created_at"`
}

// =====================================================
// REQUEST/RESPONSE MODELS
// =====================================================

// CreateMasterAgentRequest for creating master agents
type CreateMasterAgentRequest struct {
	CompanyName           string   `json:"company_name" binding:"required"`
	RegistrationNumber    string   `json:"registration_number" binding:"required"`
	TaxID                 string   `json:"tax_id" binding:"required"`
	PrimaryContactName    string   `json:"primary_contact_name" binding:"required"`
	PrimaryContactEmail   string   `json:"primary_contact_email" binding:"required,email"`
	PrimaryContactPhone   string   `json:"primary_contact_phone" binding:"required"`
	SecondaryContactName  *string  `json:"secondary_contact_name"`
	SecondaryContactEmail *string  `json:"secondary_contact_email"`
	SecondaryContactPhone *string  `json:"secondary_contact_phone"`
	HeadquartersAddress   string   `json:"headquarters_address" binding:"required"`
	City                  string   `json:"city" binding:"required"`
	StateProvince         string   `json:"state_province" binding:"required"`
	Country               string   `json:"country" binding:"required"`
	PostalCode            string   `json:"postal_code" binding:"required"`
	BusinessType          string   `json:"business_type" binding:"required"`
	YearsInOperation      int      `json:"years_in_operation" binding:"required,min=0"`
	AnnualRevenue         *float64 `json:"annual_revenue"`
	EmployeeCount         *int     `json:"employee_count"`
	BankName              string   `json:"bank_name" binding:"required"`
	BankAccountNumber     string   `json:"bank_account_number" binding:"required"`
	BankRoutingNumber     string   `json:"bank_routing_number" binding:"required"`
	BankSwiftCode         *string  `json:"bank_swift_code"`
	AssignedRegions       []string `json:"assigned_regions"`
	TerritorySizeKm2      *float64 `json:"territory_size_km2"`
	PopulationCoverage    *int     `json:"population_coverage"`
}

// CreateSuperAgentRequest for creating super agents
type CreateSuperAgentRequest struct {
	MasterAgentID             uuid.UUID `json:"master_agent_id" binding:"required"`
	FirstName                 string    `json:"first_name" binding:"required"`
	LastName                  string    `json:"last_name" binding:"required"`
	MiddleName                *string   `json:"middle_name"`
	DateOfBirth               string    `json:"date_of_birth" binding:"required"`
	Gender                    *string   `json:"gender"`
	Nationality               string    `json:"nationality" binding:"required"`
	NationalID                string    `json:"national_id" binding:"required"`
	Email                     string    `json:"email" binding:"required,email"`
	PhonePrimary              string    `json:"phone_primary" binding:"required"`
	PhoneSecondary            *string   `json:"phone_secondary"`
	EmergencyContactName      *string   `json:"emergency_contact_name"`
	EmergencyContactPhone     *string   `json:"emergency_contact_phone"`
	ResidentialAddress        string    `json:"residential_address" binding:"required"`
	City                      string    `json:"city" binding:"required"`
	StateProvince             string    `json:"state_province" binding:"required"`
	Country                   string    `json:"country" binding:"required"`
	PostalCode                string    `json:"postal_code" binding:"required"`
	EducationLevel            *string   `json:"education_level"`
	WorkExperienceYears       *int      `json:"work_experience_years"`
	PreviousBankingExperience bool      `json:"previous_banking_experience"`
	LanguagesSpoken           []string  `json:"languages_spoken"`
	BankName                  string    `json:"bank_name" binding:"required"`
	BankAccountNumber         string    `json:"bank_account_number" binding:"required"`
	BankRoutingNumber         string    `json:"bank_routing_number" binding:"required"`
	AssignedTerritories       []string  `json:"assigned_territories"`
	TerritoryType             *string   `json:"territory_type"`
	CoverageAreaKm2           *float64  `json:"coverage_area_km2"`
	PopulationServed          *int      `json:"population_served"`
}

// CreateAgentRequest for creating agents
type CreateAgentRequest struct {
	SuperAgentID              uuid.UUID `json:"super_agent_id" binding:"required"`
	MasterAgentID             uuid.UUID `json:"master_agent_id" binding:"required"`
	FirstName                 string    `json:"first_name" binding:"required"`
	LastName                  string    `json:"last_name" binding:"required"`
	MiddleName                *string   `json:"middle_name"`
	DateOfBirth               string    `json:"date_of_birth" binding:"required"`
	Gender                    *string   `json:"gender"`
	Nationality               string    `json:"nationality" binding:"required"`
	NationalID                string    `json:"national_id" binding:"required"`
	Email                     string    `json:"email" binding:"required,email"`
	PhonePrimary              string    `json:"phone_primary" binding:"required"`
	PhoneSecondary            *string   `json:"phone_secondary"`
	EmergencyContactName      *string   `json:"emergency_contact_name"`
	EmergencyContactPhone     *string   `json:"emergency_contact_phone"`
	ResidentialAddress        string    `json:"residential_address" binding:"required"`
	BusinessAddress           *string   `json:"business_address"`
	City                      string    `json:"city" binding:"required"`
	StateProvince             string    `json:"state_province" binding:"required"`
	Country                   string    `json:"country" binding:"required"`
	PostalCode                string    `json:"postal_code" binding:"required"`
	EducationLevel            *string   `json:"education_level"`
	WorkExperienceYears       *int      `json:"work_experience_years"`
	PreviousBankingExperience bool      `json:"previous_banking_experience"`
	BusinessType              *string   `json:"business_type"`
	BusinessRegistrationNumber *string  `json:"business_registration_number"`
	LanguagesSpoken           []string  `json:"languages_spoken"`
	BankName                  string    `json:"bank_name" binding:"required"`
	BankAccountNumber         string    `json:"bank_account_number" binding:"required"`
	BankRoutingNumber         string    `json:"bank_routing_number" binding:"required"`
	AssignedArea              *string   `json:"assigned_area"`
	TerritoryType             *string   `json:"territory_type"`
	CoverageRadiusKm          *float64  `json:"coverage_radius_km"`
	EstimatedPopulation       *int      `json:"estimated_population"`
	OperatingHours            *string   `json:"operating_hours"`
	DailyTransactionLimit     *float64  `json:"daily_transaction_limit"`
	MonthlyTransactionLimit   *float64  `json:"monthly_transaction_limit"`
	CommissionRate            *float64  `json:"commission_rate"`
	CommissionTier            *string   `json:"commission_tier"`
}

// CreateSubAgentRequest for creating sub agents
type CreateSubAgentRequest struct {
	ParentAgentID         uuid.UUID `json:"parent_agent_id" binding:"required"`
	SuperAgentID          uuid.UUID `json:"super_agent_id" binding:"required"`
	MasterAgentID         uuid.UUID `json:"master_agent_id" binding:"required"`
	FirstName             string    `json:"first_name" binding:"required"`
	LastName              string    `json:"last_name" binding:"required"`
	MiddleName            *string   `json:"middle_name"`
	DateOfBirth           string    `json:"date_of_birth" binding:"required"`
	Gender                *string   `json:"gender"`
	Nationality           string    `json:"nationality" binding:"required"`
	NationalID            string    `json:"national_id" binding:"required"`
	Email                 *string   `json:"email"`
	PhonePrimary          string    `json:"phone_primary" binding:"required"`
	PhoneSecondary        *string   `json:"phone_secondary"`
	EmergencyContactName  *string   `json:"emergency_contact_name"`
	EmergencyContactPhone *string   `json:"emergency_contact_phone"`
	ResidentialAddress    string    `json:"residential_address" binding:"required"`
	BusinessAddress       *string   `json:"business_address"`
	VillageCommunity      *string   `json:"village_community"`
	City                  string    `json:"city" binding:"required"`
	StateProvince         string    `json:"state_province" binding:"required"`
	Country               string    `json:"country" binding:"required"`
	PostalCode            *string   `json:"postal_code"`
	EducationLevel        *string   `json:"education_level"`
	PrimaryOccupation     *string   `json:"primary_occupation"`
	CommunityRole         *string   `json:"community_role"`
	LocalLanguage         *string   `json:"local_language"`
	LiteracyLevel         *string   `json:"literacy_level"`
	BankName              *string   `json:"bank_name"`
	BankAccountNumber     *string   `json:"bank_account_number"`
	BankRoutingNumber     *string   `json:"bank_routing_number"`
	MobileMoneyProvider   *string   `json:"mobile_money_provider"`
	MobileMoneyNumber     *string   `json:"mobile_money_number"`
	AssignedCommunity     *string   `json:"assigned_community"`
	TerritoryType         *string   `json:"territory_type"`
	CoverageRadiusKm      *float64  `json:"coverage_radius_km"`
	EstimatedPopulation   *int      `json:"estimated_population"`
	OperatingDays         []string  `json:"operating_days"`
	OperatingHours        *string   `json:"operating_hours"`
	DailyTransactionLimit *float64  `json:"daily_transaction_limit"`
	MonthlyTransactionLimit *float64 `json:"monthly_transaction_limit"`
	CommissionRate        *float64  `json:"commission_rate"`
}

// ListAgentsRequest for listing agents with filters
type ListAgentsRequest struct {
	Page           int         `form:"page,default=1"`
	Limit          int         `form:"limit,default=20"`
	AgentTier      *AgentTier  `form:"tier"`
	Status         *AgentStatus `form:"status"`
	MasterAgentID  *uuid.UUID  `form:"master_agent_id"`
	SuperAgentID   *uuid.UUID  `form:"super_agent_id"`
	ParentAgentID  *uuid.UUID  `form:"parent_agent_id"`
	Search         string      `form:"search"`
	SortBy         string      `form:"sort_by,default=created_at"`
	SortOrder      string      `form:"sort_order,default=desc"`
}

// ListAgentsResponse for paginated agent listing
type ListAgentsResponse struct {
	Agents     []AgentHierarchyView `json:"agents"`
	Total      int64                `json:"total"`
	Page       int                  `json:"page"`
	Limit      int                  `json:"limit"`
	TotalPages int                  `json:"total_pages"`
}

// =====================================================
// DATABASE CONNECTION
// =====================================================

var db *gorm.DB

func initDB() {
	var err error
	
	// Get database configuration from environment variables
	host := getEnv("DB_HOST", "os.getenv("HOST", "os.getenv("HOST", "os.getenv("HOST", "os.getenv("HOST", "localhost")")")")")
	user := requireEnv("DB_USER")      // Required - no default
	password := requireEnv("DB_PASSWORD") // Required - no default (security)
	dbname := requireEnv("DB_NAME")    // Required - no default
	port := getEnv("DB_PORT", "5432")
	sslmode := getEnv("DB_SSLMODE", "require") // Default to secure
	
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s", 
		host, user, password, dbname, port, sslmode)
	
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(&MasterAgent{}, &SuperAgent{}, &Agent{}, &SubAgent{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Database connected and migrated successfully")
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}
	if value := os.Getenv(key); value != "" {

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}
		return value

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}
	}

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}
	return defaultValue

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}
}

// requireEnv returns the value of an environment variable or panics if not set
// Use this for critical configuration like database passwords, API keys, etc.
func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("CRITICAL: Required environment variable %s is not set. Cannot start service.", key)
	}
	return value
}

// =====================================================
// SERVICE IMPLEMENTATION
// =====================================================

// AgentHierarchyService handles business logic for agent hierarchy
type AgentHierarchyService struct {
	db *gorm.DB
}

// NewAgentHierarchyService creates a new service instance
func NewAgentHierarchyService(db *gorm.DB) *AgentHierarchyService {
	return &AgentHierarchyService{db: db}
}

// generateAgentCode generates a unique agent code based on tier
func (s *AgentHierarchyService) generateAgentCode(tier AgentTier) string {
	var prefix string
	switch tier {
	case MasterAgentTier:
		prefix = "MA"
	case SuperAgentTier:
		prefix = "SA"
	case AgentTier_:
		prefix = "AG"
	case SubAgentTier:
		prefix = "SUB"
	default:
		prefix = "AG"
	}
	
	// Generate a unique code with timestamp
	timestamp := time.Now().Unix()
	return fmt.Sprintf("%s%d", prefix, timestamp)
}

// =====================================================
// MASTER AGENT OPERATIONS
// =====================================================

// CreateMasterAgent creates a new master agent
func (s *AgentHierarchyService) CreateMasterAgent(ctx context.Context, req *CreateMasterAgentRequest) (*MasterAgent, error) {
	agent := &MasterAgent{
		AgentCode:             s.generateAgentCode(MasterAgentTier),
		CompanyName:           req.CompanyName,
		RegistrationNumber:    req.RegistrationNumber,
		TaxID:                 req.TaxID,
		PrimaryContactName:    req.PrimaryContactName,
		PrimaryContactEmail:   req.PrimaryContactEmail,
		PrimaryContactPhone:   req.PrimaryContactPhone,
		SecondaryContactName:  req.SecondaryContactName,
		SecondaryContactEmail: req.SecondaryContactEmail,
		SecondaryContactPhone: req.SecondaryContactPhone,
		HeadquartersAddress:   req.HeadquartersAddress,
		City:                  req.City,
		StateProvince:         req.StateProvince,
		Country:               req.Country,
		PostalCode:            req.PostalCode,
		BusinessType:          req.BusinessType,
		YearsInOperation:      req.YearsInOperation,
		AnnualRevenue:         req.AnnualRevenue,
		EmployeeCount:         req.EmployeeCount,
		BankName:              req.BankName,
		BankAccountNumber:     req.BankAccountNumber,
		BankRoutingNumber:     req.BankRoutingNumber,
		BankSwiftCode:         req.BankSwiftCode,
		AssignedRegions:       pq.StringArray(req.AssignedRegions),
		TerritorySizeKm2:      req.TerritorySizeKm2,
		PopulationCoverage:    req.PopulationCoverage,
		Status:                StatusPending,
		Tier:                  MasterAgentTier,
		PerformanceRating:     RatingSatisfactory,
	}

	if err := s.db.WithContext(ctx).Create(agent).Error; err != nil {
		return nil, fmt.Errorf("failed to create master agent: %w", err)
	}

	return agent, nil
}

// GetMasterAgent retrieves a master agent by ID
func (s *AgentHierarchyService) GetMasterAgent(ctx context.Context, id uuid.UUID) (*MasterAgent, error) {
	var agent MasterAgent
	if err := s.db.WithContext(ctx).Preload("SuperAgents").First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get master agent: %w", err)
	}
	return &agent, nil
}

// UpdateMasterAgent updates a master agent
func (s *AgentHierarchyService) UpdateMasterAgent(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*MasterAgent, error) {
	var agent MasterAgent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("master agent not found: %w", err)
	}

	if err := s.db.WithContext(ctx).Model(&agent).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update master agent: %w", err)
	}

	return &agent, nil
}

// DeleteMasterAgent deletes a master agent
func (s *AgentHierarchyService) DeleteMasterAgent(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&MasterAgent{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete master agent: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("master agent not found")
	}
	return nil
}

// =====================================================
// SUPER AGENT OPERATIONS
// =====================================================

// CreateSuperAgent creates a new super agent
func (s *AgentHierarchyService) CreateSuperAgent(ctx context.Context, req *CreateSuperAgentRequest) (*SuperAgent, error) {
	// Verify master agent exists
	var masterAgent MasterAgent
	if err := s.db.WithContext(ctx).First(&masterAgent, "id = ?", req.MasterAgentID).Error; err != nil {
		return nil, fmt.Errorf("master agent not found: %w", err)
	}

	// Parse date of birth
	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		return nil, fmt.Errorf("invalid date of birth format: %w", err)
	}

	agent := &SuperAgent{
		AgentCode:                 s.generateAgentCode(SuperAgentTier),
		MasterAgentID:             req.MasterAgentID,
		FirstName:                 req.FirstName,
		LastName:                  req.LastName,
		MiddleName:                req.MiddleName,
		DateOfBirth:               dob,
		Gender:                    req.Gender,
		Nationality:               req.Nationality,
		NationalID:                req.NationalID,
		Email:                     req.Email,
		PhonePrimary:              req.PhonePrimary,
		PhoneSecondary:            req.PhoneSecondary,
		EmergencyContactName:      req.EmergencyContactName,
		EmergencyContactPhone:     req.EmergencyContactPhone,
		ResidentialAddress:        req.ResidentialAddress,
		City:                      req.City,
		StateProvince:             req.StateProvince,
		Country:                   req.Country,
		PostalCode:                req.PostalCode,
		EducationLevel:            req.EducationLevel,
		WorkExperienceYears:       req.WorkExperienceYears,
		PreviousBankingExperience: req.PreviousBankingExperience,
		LanguagesSpoken:           pq.StringArray(req.LanguagesSpoken),
		BankName:                  req.BankName,
		BankAccountNumber:         req.BankAccountNumber,
		BankRoutingNumber:         req.BankRoutingNumber,
		AssignedTerritories:       pq.StringArray(req.AssignedTerritories),
		CoverageAreaKm2:           req.CoverageAreaKm2,
		PopulationServed:          req.PopulationServed,
		Status:                    StatusPending,
		Tier:                      SuperAgentTier,
		PerformanceRating:         RatingSatisfactory,
	}

	if req.TerritoryType != nil {
		territoryType := TerritoryType(*req.TerritoryType)
		agent.TerritoryType = &territoryType
	}

	if err := s.db.WithContext(ctx).Create(agent).Error; err != nil {
		return nil, fmt.Errorf("failed to create super agent: %w", err)
	}

	return agent, nil
}

// GetSuperAgent retrieves a super agent by ID
func (s *AgentHierarchyService) GetSuperAgent(ctx context.Context, id uuid.UUID) (*SuperAgent, error) {
	var agent SuperAgent
	if err := s.db.WithContext(ctx).Preload("MasterAgent").Preload("Agents").First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get super agent: %w", err)
	}
	return &agent, nil
}

// UpdateSuperAgent updates a super agent
func (s *AgentHierarchyService) UpdateSuperAgent(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*SuperAgent, error) {
	var agent SuperAgent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("super agent not found: %w", err)
	}

	if err := s.db.WithContext(ctx).Model(&agent).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update super agent: %w", err)
	}

	return &agent, nil
}

// DeleteSuperAgent deletes a super agent
func (s *AgentHierarchyService) DeleteSuperAgent(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&SuperAgent{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete super agent: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("super agent not found")
	}
	return nil
}

// =====================================================
// AGENT OPERATIONS
// =====================================================

// CreateAgent creates a new agent
func (s *AgentHierarchyService) CreateAgent(ctx context.Context, req *CreateAgentRequest) (*Agent, error) {
	// Verify super agent exists
	var superAgent SuperAgent
	if err := s.db.WithContext(ctx).First(&superAgent, "id = ?", req.SuperAgentID).Error; err != nil {
		return nil, fmt.Errorf("super agent not found: %w", err)
	}

	// Verify master agent exists
	var masterAgent MasterAgent
	if err := s.db.WithContext(ctx).First(&masterAgent, "id = ?", req.MasterAgentID).Error; err != nil {
		return nil, fmt.Errorf("master agent not found: %w", err)
	}

	// Parse date of birth
	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		return nil, fmt.Errorf("invalid date of birth format: %w", err)
	}

	agent := &Agent{
		AgentCode:                 s.generateAgentCode(AgentTier_),
		SuperAgentID:              req.SuperAgentID,
		MasterAgentID:             req.MasterAgentID,
		FirstName:                 req.FirstName,
		LastName:                  req.LastName,
		MiddleName:                req.MiddleName,
		DateOfBirth:               dob,
		Gender:                    req.Gender,
		Nationality:               req.Nationality,
		NationalID:                req.NationalID,
		Email:                     req.Email,
		PhonePrimary:              req.PhonePrimary,
		PhoneSecondary:            req.PhoneSecondary,
		EmergencyContactName:      req.EmergencyContactName,
		EmergencyContactPhone:     req.EmergencyContactPhone,
		ResidentialAddress:        req.ResidentialAddress,
		BusinessAddress:           req.BusinessAddress,
		City:                      req.City,
		StateProvince:             req.StateProvince,
		Country:                   req.Country,
		PostalCode:                req.PostalCode,
		EducationLevel:            req.EducationLevel,
		WorkExperienceYears:       req.WorkExperienceYears,
		PreviousBankingExperience: req.PreviousBankingExperience,
		BusinessType:              req.BusinessType,
		BusinessRegistrationNumber: req.BusinessRegistrationNumber,
		LanguagesSpoken:           pq.StringArray(req.LanguagesSpoken),
		BankName:                  req.BankName,
		BankAccountNumber:         req.BankAccountNumber,
		BankRoutingNumber:         req.BankRoutingNumber,
		AssignedArea:              req.AssignedArea,
		CoverageRadiusKm:          req.CoverageRadiusKm,
		EstimatedPopulation:       req.EstimatedPopulation,
		OperatingHours:            req.OperatingHours,
		Status:                    StatusPending,
		Tier:                      AgentTier_,
		PerformanceRating:         RatingSatisfactory,
	}

	// Set optional fields with defaults
	if req.TerritoryType != nil {
		territoryType := TerritoryType(*req.TerritoryType)
		agent.TerritoryType = &territoryType
	}
	if req.DailyTransactionLimit != nil {
		agent.DailyTransactionLimit = *req.DailyTransactionLimit
	}
	if req.MonthlyTransactionLimit != nil {
		agent.MonthlyTransactionLimit = *req.MonthlyTransactionLimit
	}
	if req.CommissionRate != nil {
		agent.CommissionRate = *req.CommissionRate
	}
	if req.CommissionTier != nil {
		agent.CommissionTier = *req.CommissionTier
	}

	if err := s.db.WithContext(ctx).Create(agent).Error; err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	return agent, nil
}

// GetAgent retrieves an agent by ID
func (s *AgentHierarchyService) GetAgent(ctx context.Context, id uuid.UUID) (*Agent, error) {
	var agent Agent
	if err := s.db.WithContext(ctx).Preload("SuperAgent").Preload("MasterAgent").Preload("SubAgents").First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}
	return &agent, nil
}

// UpdateAgent updates an agent
func (s *AgentHierarchyService) UpdateAgent(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*Agent, error) {
	var agent Agent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	if err := s.db.WithContext(ctx).Model(&agent).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	return &agent, nil
}

// DeleteAgent deletes an agent
func (s *AgentHierarchyService) DeleteAgent(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&Agent{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete agent: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("agent not found")
	}
	return nil
}

// =====================================================
// SUB AGENT OPERATIONS
// =====================================================

// CreateSubAgent creates a new sub agent
func (s *AgentHierarchyService) CreateSubAgent(ctx context.Context, req *CreateSubAgentRequest) (*SubAgent, error) {
	// Verify parent agent exists
	var parentAgent Agent
	if err := s.db.WithContext(ctx).First(&parentAgent, "id = ?", req.ParentAgentID).Error; err != nil {
		return nil, fmt.Errorf("parent agent not found: %w", err)
	}

	// Verify super agent exists
	var superAgent SuperAgent
	if err := s.db.WithContext(ctx).First(&superAgent, "id = ?", req.SuperAgentID).Error; err != nil {
		return nil, fmt.Errorf("super agent not found: %w", err)
	}

	// Verify master agent exists
	var masterAgent MasterAgent
	if err := s.db.WithContext(ctx).First(&masterAgent, "id = ?", req.MasterAgentID).Error; err != nil {
		return nil, fmt.Errorf("master agent not found: %w", err)
	}

	// Parse date of birth
	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		return nil, fmt.Errorf("invalid date of birth format: %w", err)
	}

	agent := &SubAgent{
		AgentCode:             s.generateAgentCode(SubAgentTier),
		ParentAgentID:         req.ParentAgentID,
		SuperAgentID:          req.SuperAgentID,
		MasterAgentID:         req.MasterAgentID,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		MiddleName:            req.MiddleName,
		DateOfBirth:           dob,
		Gender:                req.Gender,
		Nationality:           req.Nationality,
		NationalID:            req.NationalID,
		Email:                 req.Email,
		PhonePrimary:          req.PhonePrimary,
		PhoneSecondary:        req.PhoneSecondary,
		EmergencyContactName:  req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
		ResidentialAddress:    req.ResidentialAddress,
		BusinessAddress:       req.BusinessAddress,
		VillageCommunity:      req.VillageCommunity,
		City:                  req.City,
		StateProvince:         req.StateProvince,
		Country:               req.Country,
		PostalCode:            req.PostalCode,
		EducationLevel:        req.EducationLevel,
		PrimaryOccupation:     req.PrimaryOccupation,
		CommunityRole:         req.CommunityRole,
		LocalLanguage:         req.LocalLanguage,
		LiteracyLevel:         req.LiteracyLevel,
		BankName:              req.BankName,
		BankAccountNumber:     req.BankAccountNumber,
		BankRoutingNumber:     req.BankRoutingNumber,
		MobileMoneyProvider:   req.MobileMoneyProvider,
		MobileMoneyNumber:     req.MobileMoneyNumber,
		AssignedCommunity:     req.AssignedCommunity,
		EstimatedPopulation:   req.EstimatedPopulation,
		OperatingDays:         pq.StringArray(req.OperatingDays),
		OperatingHours:        req.OperatingHours,
		Status:                StatusPending,
		Tier:                  SubAgentTier,
		PerformanceRating:     RatingSatisfactory,
		TerritoryType:         TerritoryRural,
		CoverageRadiusKm:      5.0,
	}

	// Set optional fields with defaults
	if req.TerritoryType != nil {
		territoryType := TerritoryType(*req.TerritoryType)
		agent.TerritoryType = territoryType
	}
	if req.CoverageRadiusKm != nil {
		agent.CoverageRadiusKm = *req.CoverageRadiusKm
	}
	if req.DailyTransactionLimit != nil {
		agent.DailyTransactionLimit = *req.DailyTransactionLimit
	}
	if req.MonthlyTransactionLimit != nil {
		agent.MonthlyTransactionLimit = *req.MonthlyTransactionLimit
	}
	if req.CommissionRate != nil {
		agent.CommissionRate = *req.CommissionRate
	}

	if err := s.db.WithContext(ctx).Create(agent).Error; err != nil {
		return nil, fmt.Errorf("failed to create sub agent: %w", err)
	}

	return agent, nil
}

// GetSubAgent retrieves a sub agent by ID
func (s *AgentHierarchyService) GetSubAgent(ctx context.Context, id uuid.UUID) (*SubAgent, error) {
	var agent SubAgent
	if err := s.db.WithContext(ctx).Preload("ParentAgent").Preload("SuperAgent").Preload("MasterAgent").First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get sub agent: %w", err)
	}
	return &agent, nil
}

// UpdateSubAgent updates a sub agent
func (s *AgentHierarchyService) UpdateSubAgent(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*SubAgent, error) {
	var agent SubAgent
	if err := s.db.WithContext(ctx).First(&agent, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("sub agent not found: %w", err)
	}

	if err := s.db.WithContext(ctx).Model(&agent).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update sub agent: %w", err)
	}

	return &agent, nil
}

// DeleteSubAgent deletes a sub agent
func (s *AgentHierarchyService) DeleteSubAgent(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&SubAgent{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete sub agent: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("sub agent not found")
	}
	return nil
}

// =====================================================
// HIERARCHY OPERATIONS
// =====================================================

// ListAgents lists agents with filtering and pagination
func (s *AgentHierarchyService) ListAgents(ctx context.Context, req *ListAgentsRequest) (*ListAgentsResponse, error) {
	var agents []AgentHierarchyView
	var total int64

	// Build the query
	query := s.db.WithContext(ctx).Table("(SELECT 'master_agent' as agent_type, id, agent_code, company_name as name, primary_contact_email as email, primary_contact_phone as phone, status::text, performance_rating::text, total_network_size, total_transaction_volume, NULL::uuid as parent_id, created_at FROM master_agents UNION ALL SELECT 'super_agent' as agent_type, id, agent_code, CONCAT(first_name, ' ', last_name) as name, email, phone_primary as phone, status::text, performance_rating::text, supervised_agents_count as total_network_size, total_transaction_volume, master_agent_id as parent_id, created_at FROM super_agents UNION ALL SELECT 'agent' as agent_type, id, agent_code, CONCAT(first_name, ' ', last_name) as name, email, phone_primary as phone, status::text, performance_rating::text, sub_agents_count as total_network_size, total_transaction_volume, super_agent_id as parent_id, created_at FROM agents UNION ALL SELECT 'sub_agent' as agent_type, id, agent_code, CONCAT(first_name, ' ', last_name) as name, email, phone_primary as phone, status::text, performance_rating::text, 0 as total_network_size, total_transaction_volume, parent_agent_id as parent_id, created_at FROM sub_agents) as agent_hierarchy_view")

	// Apply filters
	if req.AgentTier != nil {
		switch *req.AgentTier {
		case MasterAgentTier:
			query = query.Where("agent_type = ?", "master_agent")
		case SuperAgentTier:
			query = query.Where("agent_type = ?", "super_agent")
		case AgentTier_:
			query = query.Where("agent_type = ?", "agent")
		case SubAgentTier:
			query = query.Where("agent_type = ?", "sub_agent")
		}
	}

	if req.Status != nil {
		query = query.Where("status = ?", string(*req.Status))
	}

	if req.MasterAgentID != nil {
		query = query.Where("(agent_type = 'master_agent' AND id = ?) OR (agent_type != 'master_agent' AND parent_id = ?) OR (agent_type = 'agent' AND id IN (SELECT id FROM agents WHERE master_agent_id = ?)) OR (agent_type = 'sub_agent' AND id IN (SELECT id FROM sub_agents WHERE master_agent_id = ?))", 
			*req.MasterAgentID, *req.MasterAgentID, *req.MasterAgentID, *req.MasterAgentID)
	}

	if req.SuperAgentID != nil {
		query = query.Where("(agent_type = 'super_agent' AND id = ?) OR (agent_type = 'agent' AND parent_id = ?) OR (agent_type = 'sub_agent' AND id IN (SELECT id FROM sub_agents WHERE super_agent_id = ?))", 
			*req.SuperAgentID, *req.SuperAgentID, *req.SuperAgentID)
	}

	if req.ParentAgentID != nil {
		query = query.Where("parent_id = ?", *req.ParentAgentID)
	}

	if req.Search != "" {
		searchPattern := "%" + strings.ToLower(req.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(agent_code) LIKE ? OR LOWER(email) LIKE ?", 
			searchPattern, searchPattern, searchPattern)
	}

	// Count total records
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count agents: %w", err)
	}

	// Apply sorting
	orderClause := fmt.Sprintf("%s %s", req.SortBy, strings.ToUpper(req.SortOrder))
	query = query.Order(orderClause)

	// Apply pagination
	offset := (req.Page - 1) * req.Limit
	query = query.Offset(offset).Limit(req.Limit)

	// Execute query
	if err := query.Find(&agents).Error; err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	totalPages := int((total + int64(req.Limit) - 1) / int64(req.Limit))

	return &ListAgentsResponse{
		Agents:     agents,
		Total:      total,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetAgentHierarchy gets the complete hierarchy for an agent
func (s *AgentHierarchyService) GetAgentHierarchy(ctx context.Context, agentID uuid.UUID, agentType string) (map[string]interface{}, error) {
	hierarchy := make(map[string]interface{})

	switch agentType {
	case "master_agent":
		var masterAgent MasterAgent
		if err := s.db.WithContext(ctx).Preload("SuperAgents.Agents.SubAgents").First(&masterAgent, "id = ?", agentID).Error; err != nil {
			return nil, fmt.Errorf("failed to get master agent hierarchy: %w", err)
		}
		hierarchy["master_agent"] = masterAgent
		
	case "super_agent":
		var superAgent SuperAgent
		if err := s.db.WithContext(ctx).Preload("MasterAgent").Preload("Agents.SubAgents").First(&superAgent, "id = ?", agentID).Error; err != nil {
			return nil, fmt.Errorf("failed to get super agent hierarchy: %w", err)
		}
		hierarchy["super_agent"] = superAgent
		
	case "agent":
		var agent Agent
		if err := s.db.WithContext(ctx).Preload("SuperAgent.MasterAgent").Preload("SubAgents").First(&agent, "id = ?", agentID).Error; err != nil {
			return nil, fmt.Errorf("failed to get agent hierarchy: %w", err)
		}
		hierarchy["agent"] = agent
		
	case "sub_agent":
		var subAgent SubAgent
		if err := s.db.WithContext(ctx).Preload("ParentAgent.SuperAgent.MasterAgent").First(&subAgent, "id = ?", agentID).Error; err != nil {
			return nil, fmt.Errorf("failed to get sub agent hierarchy: %w", err)
		}
		hierarchy["sub_agent"] = subAgent
		
	default:
		return nil, fmt.Errorf("invalid agent type: %s", agentType)
	}

	return hierarchy, nil
}

// ActivateAgent activates an agent and updates status
func (s *AgentHierarchyService) ActivateAgent(ctx context.Context, agentID uuid.UUID, agentType string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":       StatusActive,
		"activated_at": now,
		"updated_at":   now,
	}

	var err error
	switch agentType {
	case "master_agent":
		err = s.db.WithContext(ctx).Model(&MasterAgent{}).Where("id = ?", agentID).Updates(updates).Error
	case "super_agent":
		err = s.db.WithContext(ctx).Model(&SuperAgent{}).Where("id = ?", agentID).Updates(updates).Error
	case "agent":
		err = s.db.WithContext(ctx).Model(&Agent{}).Where("id = ?", agentID).Updates(updates).Error
	case "sub_agent":
		err = s.db.WithContext(ctx).Model(&SubAgent{}).Where("id = ?", agentID).Updates(updates).Error
	default:
		return fmt.Errorf("invalid agent type: %s", agentType)
	}

	if err != nil {
		return fmt.Errorf("failed to activate agent: %w", err)
	}

	return nil
}

// SuspendAgent suspends an agent
func (s *AgentHierarchyService) SuspendAgent(ctx context.Context, agentID uuid.UUID, agentType string, reason string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":     StatusSuspended,
		"updated_at": now,
	}

	var err error
	switch agentType {
	case "master_agent":
		err = s.db.WithContext(ctx).Model(&MasterAgent{}).Where("id = ?", agentID).Updates(updates).Error
	case "super_agent":
		err = s.db.WithContext(ctx).Model(&SuperAgent{}).Where("id = ?", agentID).Updates(updates).Error
	case "agent":
		err = s.db.WithContext(ctx).Model(&Agent{}).Where("id = ?", agentID).Updates(updates).Error
	case "sub_agent":
		err = s.db.WithContext(ctx).Model(&SubAgent{}).Where("id = ?", agentID).Updates(updates).Error
	default:
		return fmt.Errorf("invalid agent type: %s", agentType)
	}

	if err != nil {
		return fmt.Errorf("failed to suspend agent: %w", err)
	}

	// TODO: Log suspension reason in audit trail

	return nil
}

// =====================================================
// API HANDLERS
// =====================================================

// AgentHierarchyHandler handles API requests
type AgentHierarchyHandler struct {
	service *AgentHierarchyService
}

// NewAgentHierarchyHandler creates a new handler instance
func NewAgentHierarchyHandler(service *AgentHierarchyService) *AgentHierarchyHandler {
	return &AgentHierarchyHandler{service: service}
}

// =====================================================
// MASTER AGENT HANDLERS
// =====================================================

// CreateMasterAgent handles master agent creation requests
func (h *AgentHierarchyHandler) CreateMasterAgent(c *gin.Context) {
	var req CreateMasterAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.CreateMasterAgent(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": agent})
}

// GetMasterAgent handles master agent retrieval requests
func (h *AgentHierarchyHandler) GetMasterAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agent, err := h.service.GetMasterAgent(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Master agent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// UpdateMasterAgent handles master agent update requests
func (h *AgentHierarchyHandler) UpdateMasterAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.UpdateMasterAgent(c.Request.Context(), id, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// DeleteMasterAgent handles master agent deletion requests
func (h *AgentHierarchyHandler) DeleteMasterAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := h.service.DeleteMasterAgent(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Master agent deleted successfully"})
}

// =====================================================
// SUPER AGENT HANDLERS
// =====================================================

// CreateSuperAgent handles super agent creation requests
func (h *AgentHierarchyHandler) CreateSuperAgent(c *gin.Context) {
	var req CreateSuperAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.CreateSuperAgent(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": agent})
}

// GetSuperAgent handles super agent retrieval requests
func (h *AgentHierarchyHandler) GetSuperAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agent, err := h.service.GetSuperAgent(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Super agent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// UpdateSuperAgent handles super agent update requests
func (h *AgentHierarchyHandler) UpdateSuperAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.UpdateSuperAgent(c.Request.Context(), id, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// DeleteSuperAgent handles super agent deletion requests
func (h *AgentHierarchyHandler) DeleteSuperAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := h.service.DeleteSuperAgent(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Super agent deleted successfully"})
}

// =====================================================
// AGENT HANDLERS
// =====================================================

// CreateAgent handles agent creation requests
func (h *AgentHierarchyHandler) CreateAgent(c *gin.Context) {
	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.CreateAgent(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": agent})
}

// GetAgent handles agent retrieval requests
func (h *AgentHierarchyHandler) GetAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agent, err := h.service.GetAgent(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// UpdateAgent handles agent update requests
func (h *AgentHierarchyHandler) UpdateAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.UpdateAgent(c.Request.Context(), id, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// DeleteAgent handles agent deletion requests
func (h *AgentHierarchyHandler) DeleteAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := h.service.DeleteAgent(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent deleted successfully"})
}

// =====================================================
// SUB AGENT HANDLERS
// =====================================================

// CreateSubAgent handles sub agent creation requests
func (h *AgentHierarchyHandler) CreateSubAgent(c *gin.Context) {
	var req CreateSubAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.CreateSubAgent(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": agent})
}

// GetSubAgent handles sub agent retrieval requests
func (h *AgentHierarchyHandler) GetSubAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agent, err := h.service.GetSubAgent(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub agent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// UpdateSubAgent handles sub agent update requests
func (h *AgentHierarchyHandler) UpdateSubAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.service.UpdateSubAgent(c.Request.Context(), id, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agent})
}

// DeleteSubAgent handles sub agent deletion requests
func (h *AgentHierarchyHandler) DeleteSubAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := h.service.DeleteSubAgent(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sub agent deleted successfully"})
}

// =====================================================
// HIERARCHY HANDLERS
// =====================================================

// ListAgents handles agent listing requests with filtering and pagination
func (h *AgentHierarchyHandler) ListAgents(c *gin.Context) {
	var req ListAgentsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 || req.Limit > 100 {
		req.Limit = 20
	}
	if req.SortBy == "" {
		req.SortBy = "created_at"
	}
	if req.SortOrder != "asc" && req.SortOrder != "desc" {
		req.SortOrder = "desc"
	}

	response, err := h.service.ListAgents(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// GetAgentHierarchy handles agent hierarchy retrieval requests
func (h *AgentHierarchyHandler) GetAgentHierarchy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agentType := c.Param("type")
	if agentType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent type is required"})
		return
	}

	hierarchy, err := h.service.GetAgentHierarchy(c.Request.Context(), id, agentType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": hierarchy})
}

// ActivateAgent handles agent activation requests
func (h *AgentHierarchyHandler) ActivateAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agentType := c.Param("type")
	if agentType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent type is required"})
		return
	}

	if err := h.service.ActivateAgent(c.Request.Context(), id, agentType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent activated successfully"})
}

// SuspendAgent handles agent suspension requests
func (h *AgentHierarchyHandler) SuspendAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	agentType := c.Param("type")
	if agentType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent type is required"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.SuspendAgent(c.Request.Context(), id, agentType, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent suspended successfully"})
}

// HealthCheck handles health check requests
func (h *AgentHierarchyHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "agent-hierarchy",
		"timestamp": time.Now().UTC(),
	})
}

// =====================================================
// ROUTES SETUP
// =====================================================

func setupRoutes(handler *AgentHierarchyHandler) *gin.Engine {
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"*"},
		AllowCredentials: true,
	}))

	// Health check
	r.GET("/health", handler.HealthCheck)

	// API routes
	api := r.Group("/api/v1/hierarchy")
	{
		// Master Agents
		masterAgents := api.Group("/master-agents")
		{
			masterAgents.POST("", handler.CreateMasterAgent)
			masterAgents.GET("/:id", handler.GetMasterAgent)
			masterAgents.PUT("/:id", handler.UpdateMasterAgent)
			masterAgents.DELETE("/:id", handler.DeleteMasterAgent)
		}

		// Super Agents
		superAgents := api.Group("/super-agents")
		{
			superAgents.POST("", handler.CreateSuperAgent)
			superAgents.GET("/:id", handler.GetSuperAgent)
			superAgents.PUT("/:id", handler.UpdateSuperAgent)
			superAgents.DELETE("/:id", handler.DeleteSuperAgent)
		}

		// Agents
		agents := api.Group("/agents")
		{
			agents.POST("", handler.CreateAgent)
			agents.GET("/:id", handler.GetAgent)
			agents.PUT("/:id", handler.UpdateAgent)
			agents.DELETE("/:id", handler.DeleteAgent)
		}

		// Sub Agents
		subAgents := api.Group("/sub-agents")
		{
			subAgents.POST("", handler.CreateSubAgent)
			subAgents.GET("/:id", handler.GetSubAgent)
			subAgents.PUT("/:id", handler.UpdateSubAgent)
			subAgents.DELETE("/:id", handler.DeleteSubAgent)
		}

		// Hierarchy operations
		api.GET("/agents", handler.ListAgents)
		api.GET("/:type/:id/hierarchy", handler.GetAgentHierarchy)
		api.POST("/:type/:id/activate", handler.ActivateAgent)
		api.POST("/:type/:id/suspend", handler.SuspendAgent)
	}

	return r
}

// =====================================================
// MAIN FUNCTION
// =====================================================

func main() {
	// Initialize database
	initDB()

	// Create service and handler
	service := NewAgentHierarchyService(db)
	handler := NewAgentHierarchyHandler(service)

	// Setup routes
	r := setupRoutes(handler)

	// Get port from environment
	port := getEnv("PORT", "8080")

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Agent Hierarchy Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}


