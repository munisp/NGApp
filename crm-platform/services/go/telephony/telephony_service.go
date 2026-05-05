// AI Telephony Service for Banking CRM
// Integrates with VideoSDK for voice calls and AI agents
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Language constants for Nigerian languages
const (
	LanguageEnglish = "english"
	LanguageHausa   = "hausa"
	LanguageYoruba  = "yoruba"
	LanguageIgbo    = "igbo"
	LanguagePidgin  = "pidgin"
)

// Call types
const (
	CallTypeOutbound = "outbound"
	CallTypeInbound  = "inbound"
)

// Call status
const (
	CallStatusPending    = "pending"
	CallStatusDialing    = "dialing"
	CallStatusConnected  = "connected"
	CallStatusCompleted  = "completed"
	CallStatusFailed     = "failed"
	CallStatusCancelled  = "cancelled"
)

// Trigger types for outbound calls
const (
	TriggerFraudDetection    = "fraud_detection"
	TriggerProductPromotion  = "product_promotion"
	TriggerAccountMaintenance = "account_maintenance"
	TriggerPaymentReminder   = "payment_reminder"
	TriggerKYCReminder       = "kyc_reminder"
)

// Issue types for inbound calls
const (
	IssueBlockedAccount     = "blocked_account"
	IssueTransactionDispute = "transaction_dispute"
	IssueFraudReport        = "fraud_report"
	IssueGeneralInquiry     = "general_inquiry"
	IssueTechnicalSupport   = "technical_support"
)

// Customer data structure
type Customer struct {
	ID                    string    `json:"id" gorm:"primaryKey"`
	BVN                   string    `json:"bvn" gorm:"uniqueIndex"`
	NIN                   string    `json:"nin"`
	FirstName             string    `json:"first_name"`
	LastName              string    `json:"last_name"`
	PhoneNumber           string    `json:"phone_number" gorm:"index"`
	Email                 string    `json:"email"`
	PreferredLanguage     string    `json:"preferred_language"`
	RiskScore             float64   `json:"risk_score"`
	CustomerSegment       string    `json:"customer_segment"`
	AccountStatus         string    `json:"account_status"`
	TotalBalance          float64   `json:"total_balance"`
	LastTransactionDate   time.Time `json:"last_transaction_date"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// Call record structure
type CallRecord struct {
	ID                    string    `json:"id" gorm:"primaryKey"`
	CustomerID            string    `json:"customer_id" gorm:"index"`
	CallType              string    `json:"call_type"`
	CallDirection         string    `json:"call_direction"`
	PhoneNumber           string    `json:"phone_number"`
	Language              string    `json:"language"`
	TriggerType           string    `json:"trigger_type,omitempty"`
	IssueType             string    `json:"issue_type,omitempty"`
	CallStatus            string    `json:"call_status"`
	StartTime             time.Time `json:"start_time"`
	EndTime               *time.Time `json:"end_time,omitempty"`
	Duration              int       `json:"duration"` // in seconds
	VideoSDKSessionID     string    `json:"videosdk_session_id"`
	AIAgentID             string    `json:"ai_agent_id"`
	CallSummary           string    `json:"call_summary"`
	CustomerSatisfaction  *int      `json:"customer_satisfaction,omitempty"` // 1-5 rating
	ResolutionStatus      string    `json:"resolution_status"`
	EscalatedToHuman      bool      `json:"escalated_to_human"`
	HumanAgentID          string    `json:"human_agent_id,omitempty"`
	CallRecordingURL      string    `json:"call_recording_url,omitempty"`
	TranscriptURL         string    `json:"transcript_url,omitempty"`
	Metadata              string    `json:"metadata"` // JSON string for additional data
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// Trigger event structure
type TriggerEvent struct {
	ID              string                 `json:"id" gorm:"primaryKey"`
	CustomerID      string                 `json:"customer_id" gorm:"index"`
	TriggerType     string                 `json:"trigger_type"`
	Priority        string                 `json:"priority"` // low, medium, high, critical
	TriggerData     string                 `json:"trigger_data"` // JSON string
	ProcessedAt     *time.Time             `json:"processed_at,omitempty"`
	CallID          string                 `json:"call_id,omitempty"`
	Status          string                 `json:"status"` // pending, processed, failed
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

// AI Agent configuration
type AIAgentConfig struct {
	AgentID           string            `json:"agent_id"`
	AgentName         string            `json:"agent_name"`
	Language          string            `json:"language"`
	Specialization    string            `json:"specialization"`
	VoiceModel        string            `json:"voice_model"`
	PersonalityTraits map[string]string `json:"personality_traits"`
	ScriptTemplates   map[string]string `json:"script_templates"`
	MaxCallDuration   int               `json:"max_call_duration"` // in minutes
	EscalationRules   map[string]string `json:"escalation_rules"`
}

// VideoSDK integration structures
type VideoSDKConfig struct {
	APIKey      string `json:"api_key"`
	APISecret   string `json:"api_secret"`
	BaseURL     string `json:"base_url"`
	WebhookURL  string `json:"webhook_url"`
}

type VideoSDKSession struct {
	SessionID   string `json:"session_id"`
	RoomID      string `json:"room_id"`
	Token       string `json:"token"`
	StartTime   time.Time `json:"start_time"`
	Status      string `json:"status"`
}

// Main service structure
type AITelephonyService struct {
	db                *gorm.DB
	logger            *zap.Logger
	videoSDKConfig    VideoSDKConfig
	aiAgents          map[string]AIAgentConfig
	activeCallsMutex  sync.RWMutex
	activeCalls       map[string]*CallRecord
	triggerProcessor  *TriggerProcessor
	callHandler       *CallHandler
	httpClient        *http.Client
}

// Trigger processor for outbound calls
type TriggerProcessor struct {
	service       *AITelephonyService
	processingQueue chan *TriggerEvent
	workers       int
	stopChan      chan struct{}
	wg            sync.WaitGroup
}

// Call handler for managing calls
type CallHandler struct {
	service    *AITelephonyService
	upgrader   websocket.Upgrader
	connections map[string]*websocket.Conn
	connMutex  sync.RWMutex
}

// Initialize the AI Telephony Service
func NewAITelephonyService() *AITelephonyService {
	// Initialize logger
	logger, _ := zap.NewProduction()

	// Initialize database connection
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=banking_crm port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto-migrate database schemas
	db.AutoMigrate(&Customer{}, &CallRecord{}, &TriggerEvent{})

	// Initialize VideoSDK configuration
	videoSDKConfig := VideoSDKConfig{
		APIKey:     os.Getenv("VIDEOSDK_API_KEY"),
		APISecret:  os.Getenv("VIDEOSDK_API_SECRET"),
		BaseURL:    "https://api.videosdk.live",
		WebhookURL: os.Getenv("VIDEOSDK_WEBHOOK_URL"),
	}

	service := &AITelephonyService{
		db:             db,
		logger:         logger,
		videoSDKConfig: videoSDKConfig,
		aiAgents:       make(map[string]AIAgentConfig),
		activeCalls:    make(map[string]*CallRecord),
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}

	// Initialize AI agents for different languages
	service.initializeAIAgents()

	// Initialize trigger processor
	service.triggerProcessor = &TriggerProcessor{
		service:         service,
		processingQueue: make(chan *TriggerEvent, 1000),
		workers:         10,
		stopChan:        make(chan struct{}),
	}

	// Initialize call handler
	service.callHandler = &CallHandler{
		service: service,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for demo
			},
		},
		connections: make(map[string]*websocket.Conn),
	}

	return service
}

// Initialize AI agents for different languages and specializations
func (s *AITelephonyService) initializeAIAgents() {
	agents := []AIAgentConfig{
		{
			AgentID:        "agent-english-fraud",
			AgentName:      "Sarah Johnson",
			Language:       LanguageEnglish,
			Specialization: "fraud_detection",
			VoiceModel:     "en-NG-female-1",
			PersonalityTraits: map[string]string{
				"tone":       "professional",
				"empathy":    "high",
				"urgency":    "medium",
				"formality":  "formal",
			},
			ScriptTemplates: map[string]string{
				"fraud_alert": "Hello {{.CustomerName}}, this is Sarah from {{.BankName}} security team. We've detected some unusual activity on your account and need to verify some transactions with you. This is for your account security. Can you please confirm if you made a transaction of {{.Amount}} at {{.Location}} on {{.Date}}?",
				"greeting":    "Good {{.TimeOfDay}}, this is Sarah from {{.BankName}}. Am I speaking with {{.CustomerName}}?",
				"verification": "For security purposes, can you please confirm your date of birth and the last four digits of your BVN?",
			},
			MaxCallDuration: 15,
			EscalationRules: map[string]string{
				"no_answer":           "send_sms_and_email",
				"customer_agitated":   "escalate_to_human",
				"complex_fraud_case":  "escalate_to_specialist",
			},
		},
		{
			AgentID:        "agent-hausa-fraud",
			AgentName:      "Aisha Mahmud",
			Language:       LanguageHausa,
			Specialization: "fraud_detection",
			VoiceModel:     "ha-NG-female-1",
			PersonalityTraits: map[string]string{
				"tone":       "respectful",
				"empathy":    "high",
				"urgency":    "medium",
				"formality":  "formal",
			},
			ScriptTemplates: map[string]string{
				"fraud_alert": "Sannu {{.CustomerName}}, ni Aisha daga {{.BankName}} security team. Mun gano wasu ayyukan da ba na al'ada ba a asusun ku kuma muna bukatar mu tabbatar da wasu ma'amaloli tare da ku. Wannan don tsaron asusun ku. Za ku iya tabbatar da cewa kun yi ma'amala ta {{.Amount}} a {{.Location}} a ranar {{.Date}}?",
				"greeting":    "{{.TimeOfDay}} mai kyau, ni Aisha daga {{.BankName}}. Ina magana da {{.CustomerName}}?",
				"verification": "Don tsaro, za ku iya tabbatar da ranar haihuwar ku da lambobi hudu na karshe na BVN ku?",
			},
			MaxCallDuration: 15,
			EscalationRules: map[string]string{
				"no_answer":           "send_sms_and_email",
				"customer_agitated":   "escalate_to_human",
				"complex_fraud_case":  "escalate_to_specialist",
			},
		},
		{
			AgentID:        "agent-yoruba-promotion",
			AgentName:      "Adunni Ogundimu",
			Language:       LanguageYoruba,
			Specialization: "product_promotion",
			VoiceModel:     "yo-NG-female-1",
			PersonalityTraits: map[string]string{
				"tone":       "friendly",
				"empathy":    "medium",
				"urgency":    "low",
				"formality":  "informal",
			},
			ScriptTemplates: map[string]string{
				"product_offer": "E ku aaro {{.CustomerName}}, emi ni Adunni lati {{.BankName}}. Mo pe yin lati so fun yin nipa eto owo ti o dara ti a ni fun yin. Nitori pe yin ni onibara ti o dara, a le fun yin ni {{.OfferDetails}}. Se e fe gbọ sii nipa eyi?",
				"greeting":     "E ku {{.TimeOfDay}} {{.CustomerName}}, emi ni Adunni lati {{.BankName}}. Bawo ni?",
				"offer_details": "Eto yi yoo fun yin ni {{.Benefits}} ati pe ko si owo ti e o san fun un ni osu {{.Months}} akọkọ.",
			},
			MaxCallDuration: 10,
			EscalationRules: map[string]string{
				"customer_interested": "schedule_callback",
				"customer_not_interested": "update_preferences",
			},
		},
		{
			AgentID:        "agent-igbo-support",
			AgentName:      "Chioma Okafor",
			Language:       LanguageIgbo,
			Specialization: "customer_support",
			VoiceModel:     "ig-NG-female-1",
			PersonalityTraits: map[string]string{
				"tone":       "caring",
				"empathy":    "very_high",
				"urgency":    "medium",
				"formality":  "semi-formal",
			},
			ScriptTemplates: map[string]string{
				"blocked_account": "Ndewo {{.CustomerName}}, a na m Chioma si {{.BankName}}. A chọrọ m inyere gị aka banyere nsogbu account gị. Achọpụtara m na account gị egbochiri. Ka m nyere gị aka idozi nsogbu a. Kedu ihe mere na ị chọrọ iji account gị?",
				"greeting":        "Ndewo {{.CustomerName}}, a na m Chioma si {{.BankName}}. Kedu ka ị mere?",
				"resolution":      "Ọ dị mma, enwere m ike idozi nsogbu a maka gị ugbu a. Naanị nyere m nkeji ole na ole.",
			},
			MaxCallDuration: 20,
			EscalationRules: map[string]string{
				"complex_issue":     "escalate_to_specialist",
				"regulatory_matter": "escalate_to_compliance",
			},
		},
		{
			AgentID:        "agent-pidgin-general",
			AgentName:      "Emeka Johnson",
			Language:       LanguagePidgin,
			Specialization: "general_support",
			VoiceModel:     "pcm-NG-male-1",
			PersonalityTraits: map[string]string{
				"tone":       "casual",
				"empathy":    "high",
				"urgency":    "low",
				"formality":  "very_informal",
			},
			ScriptTemplates: map[string]string{
				"general_inquiry": "How far {{.CustomerName}}? Na Emeka from {{.BankName}} dey call you. I wan help you with your account matter. Wetin you wan know?",
				"greeting":        "How you dey {{.CustomerName}}? Na Emeka from {{.BankName}}.",
				"assistance":      "No wahala, I go help you sort am out sharp sharp. Just give me small time.",
			},
			MaxCallDuration: 15,
			EscalationRules: map[string]string{
				"technical_issue": "escalate_to_tech_support",
				"complaint":       "escalate_to_supervisor",
			},
		},
	}

	for _, agent := range agents {
		s.aiAgents[agent.AgentID] = agent
	}

	s.logger.Info("Initialized AI agents", zap.Int("count", len(agents)))
}

// Start the service
func (s *AITelephonyService) Start() error {
	s.logger.Info("Starting AI Telephony Service")

	// Start trigger processor
	s.triggerProcessor.Start()

	// Setup HTTP routes
	router := gin.Default()
	s.setupRoutes(router)

	// Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	s.logger.Info("Starting HTTP server", zap.String("port", port))
	return router.Run(":" + port)
}

// Setup HTTP routes
func (s *AITelephonyService) setupRoutes(router *gin.Engine) {
	// Health check
	router.GET("/health", s.healthCheck)

	// Customer management
	router.POST("/customers", s.createCustomer)
	router.GET("/customers/:id", s.getCustomer)
	router.PUT("/customers/:id", s.updateCustomer)

	// Trigger management
	router.POST("/triggers", s.createTrigger)
	router.GET("/triggers", s.getTriggers)
	router.POST("/triggers/:id/process", s.processTrigger)

	// Call management
	router.POST("/calls/outbound", s.initiateOutboundCall)
	router.POST("/calls/inbound", s.handleInboundCall)
	router.GET("/calls/:id", s.getCall)
	router.PUT("/calls/:id/status", s.updateCallStatus)
	router.POST("/calls/:id/escalate", s.escalateCall)

	// WebSocket for real-time call updates
	router.GET("/ws/calls", s.callHandler.handleWebSocket)

	// VideoSDK webhooks
	router.POST("/webhooks/videosdk", s.handleVideoSDKWebhook)

	// Analytics and reporting
	router.GET("/analytics/calls", s.getCallAnalytics)
	router.GET("/analytics/triggers", s.getTriggerAnalytics)
	router.GET("/analytics/customer-satisfaction", s.getCustomerSatisfactionAnalytics)
}

// Health check endpoint
func (s *AITelephonyService) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
		"service":   "ai-telephony-service",
		"version":   "1.0.0",
	})
}

// Create customer
func (s *AITelephonyService) createCustomer(c *gin.Context) {
	var customer Customer
	if err := c.ShouldBindJSON(&customer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer.ID = uuid.New().String()
	customer.CreatedAt = time.Now()
	customer.UpdatedAt = time.Now()

	if err := s.db.Create(&customer).Error; err != nil {
		s.logger.Error("Failed to create customer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
		return
	}

	c.JSON(http.StatusCreated, customer)
}

// Get customer
func (s *AITelephonyService) getCustomer(c *gin.Context) {
	customerID := c.Param("id")
	
	var customer Customer
	if err := s.db.First(&customer, "id = ?", customerID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		s.logger.Error("Failed to get customer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get customer"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// Update customer
func (s *AITelephonyService) updateCustomer(c *gin.Context) {
	customerID := c.Param("id")
	
	var customer Customer
	if err := s.db.First(&customer, "id = ?", customerID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		s.logger.Error("Failed to find customer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find customer"})
		return
	}

	var updateData Customer
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updateData.UpdatedAt = time.Now()
	if err := s.db.Model(&customer).Updates(updateData).Error; err != nil {
		s.logger.Error("Failed to update customer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// Create trigger for outbound calls
func (s *AITelephonyService) createTrigger(c *gin.Context) {
	var trigger TriggerEvent
	if err := c.ShouldBindJSON(&trigger); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	trigger.ID = uuid.New().String()
	trigger.Status = "pending"
	trigger.CreatedAt = time.Now()
	trigger.UpdatedAt = time.Now()

	if err := s.db.Create(&trigger).Error; err != nil {
		s.logger.Error("Failed to create trigger", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create trigger"})
		return
	}

	// Queue trigger for processing
	select {
	case s.triggerProcessor.processingQueue <- &trigger:
		s.logger.Info("Trigger queued for processing", zap.String("trigger_id", trigger.ID))
	default:
		s.logger.Warn("Processing queue full, trigger not queued", zap.String("trigger_id", trigger.ID))
	}

	c.JSON(http.StatusCreated, trigger)
}

// Get triggers
func (s *AITelephonyService) getTriggers(c *gin.Context) {
	var triggers []TriggerEvent
	
	query := s.db.Model(&TriggerEvent{})
	
	// Filter by status if provided
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	
	// Filter by customer ID if provided
	if customerID := c.Query("customer_id"); customerID != "" {
		query = query.Where("customer_id = ?", customerID)
	}
	
	// Filter by trigger type if provided
	if triggerType := c.Query("trigger_type"); triggerType != "" {
		query = query.Where("trigger_type = ?", triggerType)
	}

	if err := query.Order("created_at DESC").Find(&triggers).Error; err != nil {
		s.logger.Error("Failed to get triggers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get triggers"})
		return
	}

	c.JSON(http.StatusOK, triggers)
}

// Process trigger manually
func (s *AITelephonyService) processTrigger(c *gin.Context) {
	triggerID := c.Param("id")
	
	var trigger TriggerEvent
	if err := s.db.First(&trigger, "id = ?", triggerID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Trigger not found"})
			return
		}
		s.logger.Error("Failed to find trigger", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find trigger"})
		return
	}

	// Queue trigger for processing
	select {
	case s.triggerProcessor.processingQueue <- &trigger:
		s.logger.Info("Trigger queued for processing", zap.String("trigger_id", trigger.ID))
		c.JSON(http.StatusOK, gin.H{"message": "Trigger queued for processing"})
	default:
		s.logger.Warn("Processing queue full", zap.String("trigger_id", trigger.ID))
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Processing queue full"})
	}
}

// Initiate outbound call
func (s *AITelephonyService) initiateOutboundCall(c *gin.Context) {
	var request struct {
		CustomerID   string `json:"customer_id" binding:"required"`
		TriggerType  string `json:"trigger_type" binding:"required"`
		Language     string `json:"language"`
		Priority     string `json:"priority"`
		TriggerData  string `json:"trigger_data"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get customer information
	var customer Customer
	if err := s.db.First(&customer, "id = ?", request.CustomerID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		s.logger.Error("Failed to find customer", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find customer"})
		return
	}

	// Determine language (use customer preference if not specified)
	language := request.Language
	if language == "" {
		language = customer.PreferredLanguage
	}
	if language == "" {
		language = LanguageEnglish // Default to English
	}

	// Select appropriate AI agent
	agentID := s.selectAIAgent(request.TriggerType, language)
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No suitable AI agent found"})
		return
	}

	// Create call record
	callRecord := &CallRecord{
		ID:                uuid.New().String(),
		CustomerID:        customer.ID,
		CallType:          CallTypeOutbound,
		CallDirection:     "outgoing",
		PhoneNumber:       customer.PhoneNumber,
		Language:          language,
		TriggerType:       request.TriggerType,
		CallStatus:        CallStatusPending,
		StartTime:         time.Now(),
		AIAgentID:         agentID,
		ResolutionStatus:  "pending",
		EscalatedToHuman:  false,
		Metadata:          request.TriggerData,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.db.Create(callRecord).Error; err != nil {
		s.logger.Error("Failed to create call record", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call record"})
		return
	}

	// Initiate call with VideoSDK
	sessionID, err := s.initiateVideoSDKCall(callRecord)
	if err != nil {
		s.logger.Error("Failed to initiate VideoSDK call", zap.Error(err))
		callRecord.CallStatus = CallStatusFailed
		s.db.Save(callRecord)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate call"})
		return
	}

	callRecord.VideoSDKSessionID = sessionID
	callRecord.CallStatus = CallStatusDialing
	s.db.Save(callRecord)

	// Add to active calls
	s.activeCallsMutex.Lock()
	s.activeCalls[callRecord.ID] = callRecord
	s.activeCallsMutex.Unlock()

	s.logger.Info("Outbound call initiated", 
		zap.String("call_id", callRecord.ID),
		zap.String("customer_id", customer.ID),
		zap.String("phone", customer.PhoneNumber),
		zap.String("language", language))

	c.JSON(http.StatusCreated, callRecord)
}

// Handle inbound call
func (s *AITelephonyService) handleInboundCall(c *gin.Context) {
	var request struct {
		PhoneNumber     string `json:"phone_number" binding:"required"`
		VideoSDKSession string `json:"videosdk_session"`
		Language        string `json:"language"`
		IssueType       string `json:"issue_type"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find customer by phone number
	var customer Customer
	if err := s.db.First(&customer, "phone_number = ?", request.PhoneNumber).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create temporary customer record for unknown callers
			customer = Customer{
				ID:                uuid.New().String(),
				PhoneNumber:       request.PhoneNumber,
				PreferredLanguage: request.Language,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			}
			s.db.Create(&customer)
		} else {
			s.logger.Error("Failed to find customer", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find customer"})
			return
		}
	}

	// Determine language
	language := request.Language
	if language == "" {
		language = customer.PreferredLanguage
	}
	if language == "" {
		language = LanguageEnglish
	}

	// Select appropriate AI agent for customer support
	agentID := s.selectAIAgent("customer_support", language)
	if agentID == "" {
		agentID = s.selectAIAgent("general_support", language)
	}
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No suitable AI agent found"})
		return
	}

	// Create call record
	callRecord := &CallRecord{
		ID:                uuid.New().String(),
		CustomerID:        customer.ID,
		CallType:          CallTypeInbound,
		CallDirection:     "incoming",
		PhoneNumber:       customer.PhoneNumber,
		Language:          language,
		IssueType:         request.IssueType,
		CallStatus:        CallStatusConnected,
		StartTime:         time.Now(),
		VideoSDKSessionID: request.VideoSDKSession,
		AIAgentID:         agentID,
		ResolutionStatus:  "in_progress",
		EscalatedToHuman:  false,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.db.Create(callRecord).Error; err != nil {
		s.logger.Error("Failed to create call record", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call record"})
		return
	}

	// Add to active calls
	s.activeCallsMutex.Lock()
	s.activeCalls[callRecord.ID] = callRecord
	s.activeCallsMutex.Unlock()

	s.logger.Info("Inbound call handled", 
		zap.String("call_id", callRecord.ID),
		zap.String("customer_id", customer.ID),
		zap.String("phone", customer.PhoneNumber),
		zap.String("language", language))

	c.JSON(http.StatusCreated, callRecord)
}

// Get call details
func (s *AITelephonyService) getCall(c *gin.Context) {
	callID := c.Param("id")
	
	var callRecord CallRecord
	if err := s.db.First(&callRecord, "id = ?", callID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
			return
		}
		s.logger.Error("Failed to get call", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get call"})
		return
	}

	c.JSON(http.StatusOK, callRecord)
}

// Update call status
func (s *AITelephonyService) updateCallStatus(c *gin.Context) {
	callID := c.Param("id")
	
	var request struct {
		Status               string `json:"status" binding:"required"`
		Duration             int    `json:"duration"`
		CallSummary          string `json:"call_summary"`
		CustomerSatisfaction int    `json:"customer_satisfaction"`
		ResolutionStatus     string `json:"resolution_status"`
		CallRecordingURL     string `json:"call_recording_url"`
		TranscriptURL        string `json:"transcript_url"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var callRecord CallRecord
	if err := s.db.First(&callRecord, "id = ?", callID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
			return
		}
		s.logger.Error("Failed to find call", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find call"})
		return
	}

	// Update call record
	callRecord.CallStatus = request.Status
	if request.Duration > 0 {
		callRecord.Duration = request.Duration
	}
	if request.CallSummary != "" {
		callRecord.CallSummary = request.CallSummary
	}
	if request.CustomerSatisfaction > 0 {
		callRecord.CustomerSatisfaction = &request.CustomerSatisfaction
	}
	if request.ResolutionStatus != "" {
		callRecord.ResolutionStatus = request.ResolutionStatus
	}
	if request.CallRecordingURL != "" {
		callRecord.CallRecordingURL = request.CallRecordingURL
	}
	if request.TranscriptURL != "" {
		callRecord.TranscriptURL = request.TranscriptURL
	}

	if request.Status == CallStatusCompleted || request.Status == CallStatusFailed {
		now := time.Now()
		callRecord.EndTime = &now
		
		// Remove from active calls
		s.activeCallsMutex.Lock()
		delete(s.activeCalls, callID)
		s.activeCallsMutex.Unlock()
	}

	callRecord.UpdatedAt = time.Now()

	if err := s.db.Save(&callRecord).Error; err != nil {
		s.logger.Error("Failed to update call", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update call"})
		return
	}

	s.logger.Info("Call status updated", 
		zap.String("call_id", callID),
		zap.String("status", request.Status))

	c.JSON(http.StatusOK, callRecord)
}

// Escalate call to human agent
func (s *AITelephonyService) escalateCall(c *gin.Context) {
	callID := c.Param("id")
	
	var request struct {
		HumanAgentID string `json:"human_agent_id" binding:"required"`
		Reason       string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var callRecord CallRecord
	if err := s.db.First(&callRecord, "id = ?", callID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
			return
		}
		s.logger.Error("Failed to find call", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find call"})
		return
	}

	// Update call record for escalation
	callRecord.EscalatedToHuman = true
	callRecord.HumanAgentID = request.HumanAgentID
	callRecord.UpdatedAt = time.Now()

	// Add escalation reason to metadata
	var metadata map[string]interface{}
	if callRecord.Metadata != "" {
		json.Unmarshal([]byte(callRecord.Metadata), &metadata)
	} else {
		metadata = make(map[string]interface{})
	}
	metadata["escalation_reason"] = request.Reason
	metadata["escalation_time"] = time.Now()
	
	metadataJSON, _ := json.Marshal(metadata)
	callRecord.Metadata = string(metadataJSON)

	if err := s.db.Save(&callRecord).Error; err != nil {
		s.logger.Error("Failed to escalate call", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to escalate call"})
		return
	}

	s.logger.Info("Call escalated to human agent", 
		zap.String("call_id", callID),
		zap.String("human_agent_id", request.HumanAgentID),
		zap.String("reason", request.Reason))

	c.JSON(http.StatusOK, gin.H{
		"message": "Call escalated successfully",
		"call":    callRecord,
	})
}

// Select appropriate AI agent based on specialization and language
func (s *AITelephonyService) selectAIAgent(specialization, language string) string {
	for agentID, agent := range s.aiAgents {
		if agent.Specialization == specialization && agent.Language == language {
			return agentID
		}
	}
	
	// Fallback to any agent with the same language
	for agentID, agent := range s.aiAgents {
		if agent.Language == language {
			return agentID
		}
	}
	
	// Final fallback to English agent
	for agentID, agent := range s.aiAgents {
		if agent.Language == LanguageEnglish {
			return agentID
		}
	}
	
	return ""
}

// Initiate call with VideoSDK
func (s *AITelephonyService) initiateVideoSDKCall(callRecord *CallRecord) (string, error) {
	// This would integrate with VideoSDK API to initiate the call
	// For now, return a mock session ID
	sessionID := fmt.Sprintf("videosdk-session-%s", uuid.New().String())
	
	s.logger.Info("VideoSDK call initiated", 
		zap.String("session_id", sessionID),
		zap.String("call_id", callRecord.ID),
		zap.String("phone", callRecord.PhoneNumber))
	
	return sessionID, nil
}

// Handle VideoSDK webhooks
func (s *AITelephonyService) handleVideoSDKWebhook(c *gin.Context) {
	var webhook map[string]interface{}
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	s.logger.Info("VideoSDK webhook received", zap.Any("webhook", webhook))

	// Process webhook based on event type
	eventType, ok := webhook["event"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook format"})
		return
	}

	sessionID, ok := webhook["session_id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing session_id"})
		return
	}

	// Find call record by VideoSDK session ID
	var callRecord CallRecord
	if err := s.db.First(&callRecord, "videosdk_session_id = ?", sessionID).Error; err != nil {
		s.logger.Error("Call record not found for VideoSDK session", 
			zap.String("session_id", sessionID),
			zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Call record not found"})
		return
	}

	// Process different event types
	switch eventType {
	case "call_connected":
		callRecord.CallStatus = CallStatusConnected
		s.logger.Info("Call connected", zap.String("call_id", callRecord.ID))
		
	case "call_ended":
		callRecord.CallStatus = CallStatusCompleted
		now := time.Now()
		callRecord.EndTime = &now
		
		// Calculate duration if not already set
		if callRecord.Duration == 0 {
			callRecord.Duration = int(now.Sub(callRecord.StartTime).Seconds())
		}
		
		// Remove from active calls
		s.activeCallsMutex.Lock()
		delete(s.activeCalls, callRecord.ID)
		s.activeCallsMutex.Unlock()
		
		s.logger.Info("Call ended", 
			zap.String("call_id", callRecord.ID),
			zap.Int("duration", callRecord.Duration))
		
	case "call_failed":
		callRecord.CallStatus = CallStatusFailed
		now := time.Now()
		callRecord.EndTime = &now
		
		// Remove from active calls
		s.activeCallsMutex.Lock()
		delete(s.activeCalls, callRecord.ID)
		s.activeCallsMutex.Unlock()
		
		s.logger.Info("Call failed", zap.String("call_id", callRecord.ID))
		
	case "recording_available":
		if recordingURL, ok := webhook["recording_url"].(string); ok {
			callRecord.CallRecordingURL = recordingURL
		}
		
	case "transcript_available":
		if transcriptURL, ok := webhook["transcript_url"].(string); ok {
			callRecord.TranscriptURL = transcriptURL
		}
	}

	callRecord.UpdatedAt = time.Now()
	s.db.Save(&callRecord)

	c.JSON(http.StatusOK, gin.H{"message": "Webhook processed successfully"})
}

// Get call analytics
func (s *AITelephonyService) getCallAnalytics(c *gin.Context) {
	// Get query parameters for filtering
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	callType := c.Query("call_type")
	language := c.Query("language")

	// Build query
	query := s.db.Model(&CallRecord{})
	
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate)
	}
	if callType != "" {
		query = query.Where("call_type = ?", callType)
	}
	if language != "" {
		query = query.Where("language = ?", language)
	}

	// Get basic statistics
	var totalCalls int64
	var completedCalls int64
	var failedCalls int64
	var averageDuration float64
	var averageSatisfaction float64

	query.Count(&totalCalls)
	query.Where("call_status = ?", CallStatusCompleted).Count(&completedCalls)
	query.Where("call_status = ?", CallStatusFailed).Count(&failedCalls)
	
	// Get average duration and satisfaction
	s.db.Model(&CallRecord{}).
		Where("call_status = ? AND duration > 0", CallStatusCompleted).
		Select("AVG(duration)").Scan(&averageDuration)
	
	s.db.Model(&CallRecord{}).
		Where("customer_satisfaction IS NOT NULL").
		Select("AVG(customer_satisfaction)").Scan(&averageSatisfaction)

	// Get call distribution by language
	var languageStats []struct {
		Language string `json:"language"`
		Count    int64  `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Select("language, COUNT(*) as count").
		Group("language").
		Scan(&languageStats)

	// Get call distribution by trigger type (for outbound calls)
	var triggerStats []struct {
		TriggerType string `json:"trigger_type"`
		Count       int64  `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Where("call_type = ?", CallTypeOutbound).
		Select("trigger_type, COUNT(*) as count").
		Group("trigger_type").
		Scan(&triggerStats)

	// Get call distribution by issue type (for inbound calls)
	var issueStats []struct {
		IssueType string `json:"issue_type"`
		Count     int64  `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Where("call_type = ?", CallTypeInbound).
		Select("issue_type, COUNT(*) as count").
		Group("issue_type").
		Scan(&issueStats)

	analytics := gin.H{
		"summary": gin.H{
			"total_calls":           totalCalls,
			"completed_calls":       completedCalls,
			"failed_calls":          failedCalls,
			"success_rate":          float64(completedCalls) / float64(totalCalls) * 100,
			"average_duration":      averageDuration,
			"average_satisfaction":  averageSatisfaction,
		},
		"language_distribution": languageStats,
		"trigger_distribution":  triggerStats,
		"issue_distribution":    issueStats,
	}

	c.JSON(http.StatusOK, analytics)
}

// Get trigger analytics
func (s *AITelephonyService) getTriggerAnalytics(c *gin.Context) {
	// Get trigger statistics
	var totalTriggers int64
	var processedTriggers int64
	var pendingTriggers int64
	var failedTriggers int64

	s.db.Model(&TriggerEvent{}).Count(&totalTriggers)
	s.db.Model(&TriggerEvent{}).Where("status = ?", "processed").Count(&processedTriggers)
	s.db.Model(&TriggerEvent{}).Where("status = ?", "pending").Count(&pendingTriggers)
	s.db.Model(&TriggerEvent{}).Where("status = ?", "failed").Count(&failedTriggers)

	// Get trigger distribution by type
	var triggerTypeStats []struct {
		TriggerType string `json:"trigger_type"`
		Count       int64  `json:"count"`
	}
	s.db.Model(&TriggerEvent{}).
		Select("trigger_type, COUNT(*) as count").
		Group("trigger_type").
		Scan(&triggerTypeStats)

	// Get trigger distribution by priority
	var priorityStats []struct {
		Priority string `json:"priority"`
		Count    int64  `json:"count"`
	}
	s.db.Model(&TriggerEvent{}).
		Select("priority, COUNT(*) as count").
		Group("priority").
		Scan(&priorityStats)

	analytics := gin.H{
		"summary": gin.H{
			"total_triggers":     totalTriggers,
			"processed_triggers": processedTriggers,
			"pending_triggers":   pendingTriggers,
			"failed_triggers":    failedTriggers,
			"processing_rate":    float64(processedTriggers) / float64(totalTriggers) * 100,
		},
		"type_distribution":     triggerTypeStats,
		"priority_distribution": priorityStats,
	}

	c.JSON(http.StatusOK, analytics)
}

// Get customer satisfaction analytics
func (s *AITelephonyService) getCustomerSatisfactionAnalytics(c *gin.Context) {
	// Get satisfaction distribution
	var satisfactionStats []struct {
		Rating int   `json:"rating"`
		Count  int64 `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Where("customer_satisfaction IS NOT NULL").
		Select("customer_satisfaction as rating, COUNT(*) as count").
		Group("customer_satisfaction").
		Order("customer_satisfaction").
		Scan(&satisfactionStats)

	// Get average satisfaction by language
	var languageSatisfaction []struct {
		Language           string  `json:"language"`
		AverageSatisfaction float64 `json:"average_satisfaction"`
		Count              int64   `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Where("customer_satisfaction IS NOT NULL").
		Select("language, AVG(customer_satisfaction) as average_satisfaction, COUNT(*) as count").
		Group("language").
		Scan(&languageSatisfaction)

	// Get average satisfaction by AI agent
	var agentSatisfaction []struct {
		AIAgentID          string  `json:"ai_agent_id"`
		AverageSatisfaction float64 `json:"average_satisfaction"`
		Count              int64   `json:"count"`
	}
	s.db.Model(&CallRecord{}).
		Where("customer_satisfaction IS NOT NULL").
		Select("ai_agent_id, AVG(customer_satisfaction) as average_satisfaction, COUNT(*) as count").
		Group("ai_agent_id").
		Scan(&agentSatisfaction)

	analytics := gin.H{
		"satisfaction_distribution": satisfactionStats,
		"language_satisfaction":     languageSatisfaction,
		"agent_satisfaction":        agentSatisfaction,
	}

	c.JSON(http.StatusOK, analytics)
}

// Start trigger processor
func (tp *TriggerProcessor) Start() {
	tp.service.logger.Info("Starting trigger processor", zap.Int("workers", tp.workers))
	
	for i := 0; i < tp.workers; i++ {
		tp.wg.Add(1)
		go tp.worker(i)
	}
}

// Stop trigger processor
func (tp *TriggerProcessor) Stop() {
	tp.service.logger.Info("Stopping trigger processor")
	close(tp.stopChan)
	tp.wg.Wait()
}

// Trigger processor worker
func (tp *TriggerProcessor) worker(workerID int) {
	defer tp.wg.Done()
	
	tp.service.logger.Info("Starting trigger processor worker", zap.Int("worker_id", workerID))
	
	for {
		select {
		case trigger := <-tp.processingQueue:
			tp.processTrigger(trigger)
		case <-tp.stopChan:
			return
		}
	}
}

// Process individual trigger
func (tp *TriggerProcessor) processTrigger(trigger *TriggerEvent) {
	tp.service.logger.Info("Processing trigger", 
		zap.String("trigger_id", trigger.ID),
		zap.String("trigger_type", trigger.TriggerType),
		zap.String("customer_id", trigger.CustomerID))

	// Get customer information
	var customer Customer
	if err := tp.service.db.First(&customer, "id = ?", trigger.CustomerID).Error; err != nil {
		tp.service.logger.Error("Failed to find customer for trigger", 
			zap.String("trigger_id", trigger.ID),
			zap.String("customer_id", trigger.CustomerID),
			zap.Error(err))
		
		trigger.Status = "failed"
		tp.service.db.Save(trigger)
		return
	}

	// Determine if call should be made based on trigger conditions
	shouldCall, priority := tp.evaluateTriggerConditions(trigger, &customer)
	if !shouldCall {
		tp.service.logger.Info("Trigger conditions not met, skipping call", 
			zap.String("trigger_id", trigger.ID))
		
		trigger.Status = "processed"
		now := time.Now()
		trigger.ProcessedAt = &now
		tp.service.db.Save(trigger)
		return
	}

	// Select appropriate AI agent
	language := customer.PreferredLanguage
	if language == "" {
		language = LanguageEnglish
	}
	
	agentID := tp.service.selectAIAgent(trigger.TriggerType, language)
	if agentID == "" {
		tp.service.logger.Error("No suitable AI agent found", 
			zap.String("trigger_id", trigger.ID),
			zap.String("trigger_type", trigger.TriggerType),
			zap.String("language", language))
		
		trigger.Status = "failed"
		tp.service.db.Save(trigger)
		return
	}

	// Create call record
	callRecord := &CallRecord{
		ID:                uuid.New().String(),
		CustomerID:        customer.ID,
		CallType:          CallTypeOutbound,
		CallDirection:     "outgoing",
		PhoneNumber:       customer.PhoneNumber,
		Language:          language,
		TriggerType:       trigger.TriggerType,
		CallStatus:        CallStatusPending,
		StartTime:         time.Now(),
		AIAgentID:         agentID,
		ResolutionStatus:  "pending",
		EscalatedToHuman:  false,
		Metadata:          trigger.TriggerData,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := tp.service.db.Create(callRecord).Error; err != nil {
		tp.service.logger.Error("Failed to create call record for trigger", 
			zap.String("trigger_id", trigger.ID),
			zap.Error(err))
		
		trigger.Status = "failed"
		tp.service.db.Save(trigger)
		return
	}

	// Initiate call with VideoSDK
	sessionID, err := tp.service.initiateVideoSDKCall(callRecord)
	if err != nil {
		tp.service.logger.Error("Failed to initiate VideoSDK call for trigger", 
			zap.String("trigger_id", trigger.ID),
			zap.Error(err))
		
		callRecord.CallStatus = CallStatusFailed
		tp.service.db.Save(callRecord)
		
		trigger.Status = "failed"
		tp.service.db.Save(trigger)
		return
	}

	callRecord.VideoSDKSessionID = sessionID
	callRecord.CallStatus = CallStatusDialing
	tp.service.db.Save(callRecord)

	// Add to active calls
	tp.service.activeCallsMutex.Lock()
	tp.service.activeCalls[callRecord.ID] = callRecord
	tp.service.activeCallsMutex.Unlock()

	// Update trigger as processed
	trigger.Status = "processed"
	trigger.CallID = callRecord.ID
	now := time.Now()
	trigger.ProcessedAt = &now
	tp.service.db.Save(trigger)

	tp.service.logger.Info("Trigger processed successfully", 
		zap.String("trigger_id", trigger.ID),
		zap.String("call_id", callRecord.ID))
}

// Evaluate trigger conditions to determine if call should be made
func (tp *TriggerProcessor) evaluateTriggerConditions(trigger *TriggerEvent, customer *Customer) (bool, string) {
	// Parse trigger data
	var triggerData map[string]interface{}
	if trigger.TriggerData != "" {
		json.Unmarshal([]byte(trigger.TriggerData), &triggerData)
	}

	switch trigger.TriggerType {
	case TriggerFraudDetection:
		// Always call for fraud detection
		return true, "critical"
		
	case TriggerProductPromotion:
		// Check if customer is eligible for promotion
		if customer.TotalBalance > 100000 { // High balance customers
			return true, "medium"
		}
		if customer.CustomerSegment == "affluent" || customer.CustomerSegment == "private_banking" {
			return true, "medium"
		}
		return false, "low"
		
	case TriggerAccountMaintenance:
		// Check account status
		if customer.AccountStatus == "dormant" || customer.AccountStatus == "restricted" {
			return true, "high"
		}
		return true, "medium"
		
	case TriggerPaymentReminder:
		// Always call for payment reminders
		return true, "high"
		
	case TriggerKYCReminder:
		// Always call for KYC reminders
		return true, "high"
		
	default:
		return false, "low"
	}
}

// Handle WebSocket connections for real-time call updates
func (ch *CallHandler) handleWebSocket(c *gin.Context) {
	conn, err := ch.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		ch.service.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
		return
	}
	defer conn.Close()

	connectionID := uuid.New().String()
	
	ch.connMutex.Lock()
	ch.connections[connectionID] = conn
	ch.connMutex.Unlock()

	defer func() {
		ch.connMutex.Lock()
		delete(ch.connections, connectionID)
		ch.connMutex.Unlock()
	}()

	ch.service.logger.Info("WebSocket connection established", zap.String("connection_id", connectionID))

	// Send current active calls
	ch.service.activeCallsMutex.RLock()
	activeCalls := make([]*CallRecord, 0, len(ch.service.activeCalls))
	for _, call := range ch.service.activeCalls {
		activeCalls = append(activeCalls, call)
	}
	ch.service.activeCallsMutex.RUnlock()

	if err := conn.WriteJSON(gin.H{
		"type": "active_calls",
		"data": activeCalls,
	}); err != nil {
		ch.service.logger.Error("Failed to send active calls", zap.Error(err))
		return
	}

	// Keep connection alive and handle messages
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				ch.service.logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}
	}
}

// Broadcast call updates to all WebSocket connections
func (ch *CallHandler) broadcastCallUpdate(callRecord *CallRecord, eventType string) {
	message := gin.H{
		"type": eventType,
		"data": callRecord,
	}

	ch.connMutex.RLock()
	defer ch.connMutex.RUnlock()

	for connectionID, conn := range ch.connections {
		if err := conn.WriteJSON(message); err != nil {
			ch.service.logger.Error("Failed to send WebSocket message", 
				zap.String("connection_id", connectionID),
				zap.Error(err))
			
			// Remove failed connection
			delete(ch.connections, connectionID)
		}
	}
}

// Main function
func main() {
	service := NewAITelephonyService()
	
	if err := service.Start(); err != nil {
		log.Fatal("Failed to start service:", err)
	}
}

