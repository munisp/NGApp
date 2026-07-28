package main

import (
	"context"
	"database/sql"
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
	_ "github.com/lib/pq"
	"policy-service/internal/models"
	"policy-service/internal/repository"
)

var (
	db         *sql.DB
	policyRepo *repository.PolicyRepository
)

func main() {
	// Initialize database
	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	// Initialize repository
	policyRepo = repository.NewPolicyRepository(db)

	// Initialize Gin router
	router := gin.Default()

	// Health check
	router.GET("/health", healthCheck)

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Policy routes
		policies := v1.Group("/policies")
		{
			policies.POST("/", createPolicy)
			policies.GET("/", listPolicies)
			policies.GET("/:id", getPolicy)
			policies.PUT("/:id", updatePolicy)
			policies.DELETE("/:id", deletePolicy)
			policies.POST("/:id/renew", renewPolicy)
			policies.POST("/:id/cancel", cancelPolicy)
			policies.GET("/customer/:customer_id", getPoliciesByCustomer)
		}

		// Quote routes
		quotes := v1.Group("/quotes")
		{
			quotes.POST("/", generateQuote)
		}
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Policy Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

// Health check handler
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "policy-service",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Create policy handler
func createPolicy(c *gin.Context) {
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate policy number
	policyNumber := fmt.Sprintf("POL-%s-%d", req.PolicyType, time.Now().Unix())

	// Calculate end date
	endDate := req.StartDate.AddDate(0, req.DurationMonths, 0)

	// Convert beneficiaries and coverage to JSON
	beneficiariesJSON, _ := json.Marshal(req.Beneficiaries)
	coverageJSON, _ := json.Marshal(req.CoverageDetails)
	metadataJSON, _ := json.Marshal(req.Metadata)

	// Create policy
	policy := &models.Policy{
		ID:               uuid.New(),
		PolicyNumber:     policyNumber,
		CustomerID:       req.CustomerID,
		AgentID:          req.AgentID,
		PolicyType:       req.PolicyType,
		Status:           models.PolicyStatusDraft,
		PremiumAmount:    req.PremiumAmount,
		PremiumFrequency: req.PremiumFrequency,
		SumAssured:       req.SumAssured,
		Currency:         req.Currency,
		StartDate:        req.StartDate,
		EndDate:          endDate,
		Beneficiaries:    string(beneficiariesJSON),
		CoverageDetails:  string(coverageJSON),
		Metadata:         string(metadataJSON),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// Calculate next premium due date
	nextDue := calculateNextPremiumDate(req.StartDate, req.PremiumFrequency)
	policy.NextPremiumDueDate = &nextDue

	// Save to database
	if err := policyRepo.Create(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create policy"})
		return
	}

	c.JSON(http.StatusCreated, policy)
}

// List policies handler
func listPolicies(c *gin.Context) {
	status := c.Query("status")
	policyType := c.Query("type")

	policies, err := policyRepo.List(status, policyType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list policies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// Get policy handler
func getPolicy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy ID"})
		return
	}

	policy, err := policyRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// Update policy handler
func updatePolicy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy ID"})
		return
	}

	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing policy
	policy, err := policyRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}

	// Update fields
	if req.Status != nil {
		policy.Status = *req.Status
	}
	if req.PremiumAmount != nil {
		policy.PremiumAmount = *req.PremiumAmount
	}
	if req.SumAssured != nil {
		policy.SumAssured = *req.SumAssured
	}
	if req.Beneficiaries != nil {
		beneficiariesJSON, _ := json.Marshal(req.Beneficiaries)
		policy.Beneficiaries = string(beneficiariesJSON)
	}
	if req.CoverageDetails != nil {
		coverageJSON, _ := json.Marshal(req.CoverageDetails)
		policy.CoverageDetails = string(coverageJSON)
	}

	policy.UpdatedAt = time.Now()

	// Save to database
	if err := policyRepo.Update(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update policy"})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// Delete policy handler
func deletePolicy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy ID"})
		return
	}

	if err := policyRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete policy"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Policy deleted successfully"})
}

// Renew policy handler
func renewPolicy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy ID"})
		return
	}

	policy, err := policyRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}

	// Create renewal
	renewal := &models.PolicyRenewal{
		ID:               uuid.New(),
		PolicyID:         policy.ID,
		OldEndDate:       policy.EndDate,
		NewEndDate:       policy.EndDate.AddDate(1, 0, 0), // Add 1 year
		OldPremiumAmount: policy.PremiumAmount,
		NewPremiumAmount: policy.PremiumAmount, // Could apply increase
		Status:           models.PolicyStatusActive,
		CreatedAt:        time.Now(),
	}

	// Update policy
	policy.EndDate = renewal.NewEndDate
	policy.Status = models.PolicyStatusActive
	policy.UpdatedAt = time.Now()

	if err := policyRepo.Update(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to renew policy"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policy":  policy,
		"renewal": renewal,
	})
}

// Cancel policy handler
func cancelPolicy(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy ID"})
		return
	}

	policy, err := policyRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}

	// Update status
	policy.Status = models.PolicyStatusCancelled
	now := time.Now()
	policy.CancelledAt = &now
	policy.UpdatedAt = now

	if err := policyRepo.Update(policy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel policy"})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// Get policies by customer handler
func getPoliciesByCustomer(c *gin.Context) {
	customerIDStr := c.Param("customer_id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}

	policies, err := policyRepo.GetByCustomerID(customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get policies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
		"count":    len(policies),
	})
}

// Generate quote handler
func generateQuote(c *gin.Context) {
	var req models.PolicyQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Simple premium calculation (in production, use underwriting engine)
	basePremium := float64(req.SumAssured) * 0.05 // 5% of sum assured
	
	// Adjust for policy type
	typeMultiplier := map[models.PolicyType]float64{
		models.PolicyTypeMotor:    1.2,
		models.PolicyTypeHealth:   1.5,
		models.PolicyTypeLife:     1.0,
		models.PolicyTypeProperty: 1.3,
		models.PolicyTypeMarine:   1.8,
		models.PolicyTypeTravel:   0.8,
		models.PolicyTypeMicro:    0.5,
	}

	multiplier := typeMultiplier[req.PolicyType]
	if multiplier == 0 {
		multiplier = 1.0
	}

	annualPremium := int64(basePremium * multiplier)

	// Adjust for frequency
	var premiumAmount int64
	switch req.PremiumFrequency {
	case models.PremiumFrequencyDaily:
		premiumAmount = annualPremium / 365
	case models.PremiumFrequencyWeekly:
		premiumAmount = annualPremium / 52
	case models.PremiumFrequencyMonthly:
		premiumAmount = annualPremium / 12
	case models.PremiumFrequencyQuarterly:
		premiumAmount = annualPremium / 4
	default:
		premiumAmount = annualPremium
	}

	// Create quote response
	quote := models.PolicyQuoteResponse{
		QuoteID:          uuid.New(),
		CustomerID:       req.CustomerID,
		PolicyType:       req.PolicyType,
		SumAssured:       req.SumAssured,
		PremiumAmount:    premiumAmount,
		PremiumFrequency: req.PremiumFrequency,
		DurationMonths:   req.DurationMonths,
		ValidUntil:       time.Now().Add(7 * 24 * time.Hour), // Valid for 7 days
		RiskScore:        0.5, // Placeholder
		CreatedAt:        time.Now(),
	}

	c.JSON(http.StatusOK, quote)
}

// Helper function to calculate next premium date
func calculateNextPremiumDate(startDate time.Time, frequency models.PremiumFrequency) time.Time {
	switch frequency {
	case models.PremiumFrequencyDaily:
		return startDate.AddDate(0, 0, 1)
	case models.PremiumFrequencyWeekly:
		return startDate.AddDate(0, 0, 7)
	case models.PremiumFrequencyMonthly:
		return startDate.AddDate(0, 1, 0)
	case models.PremiumFrequencyQuarterly:
		return startDate.AddDate(0, 3, 0)
	case models.PremiumFrequencyAnnually:
		return startDate.AddDate(1, 0, 0)
	default:
		return startDate.AddDate(0, 1, 0)
	}
}
