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
)

var db *sql.DB

type Claim struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	CustomerID  string    `json:"customer_id"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"` // pending, approved, rejected, paid
	Description string    `json:"description"`
	IncidentDate time.Time `json:"incident_date"`
	FiledDate   time.Time `json:"filed_date"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ClaimDocument struct {
	ID          string    `json:"id"`
	ClaimID     string    `json:"claim_id"`
	DocumentType string   `json:"document_type"`
	DocumentURL string    `json:"document_url"`
	UploadedAt  time.Time `json:"uploaded_at"`
}

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

	// Initialize Gin router
	router := gin.Default()

	// Health check
	router.GET("/health", healthCheck)

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Claim routes
		claims := v1.Group("/claims")
		{
			claims.POST("/", createClaim)
			claims.GET("/", listClaims)
			claims.GET("/:id", getClaim)
			claims.PUT("/:id", updateClaim)
			claims.DELETE("/:id", deleteClaim)
			claims.POST("/:id/approve", approveClaim)
			claims.POST("/:id/reject", rejectClaim)
			claims.GET("/:id/documents", listClaimDocuments)
			claims.POST("/:id/documents", uploadClaimDocument)
		}
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Claim Service starting on port %s", port)
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
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"service": "claim-service",
		"timestamp": time.Now().Unix(),
	})
}

func createClaim(c *gin.Context) {
	var claim Claim
	if err := c.ShouldBindJSON(&claim); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claim.ID = uuid.New().String()
	claim.Status = "pending"
	claim.FiledDate = time.Now()
	claim.UpdatedAt = time.Now()

	query := `
		INSERT INTO claims (id, policy_id, customer_id, amount, status, description, incident_date, filed_date, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := db.Exec(query, claim.ID, claim.PolicyID, claim.CustomerID, claim.Amount, claim.Status, 
		claim.Description, claim.IncidentDate, claim.FiledDate, claim.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create claim"})
		return
	}

	c.JSON(http.StatusCreated, claim)
}

func listClaims(c *gin.Context) {
	status := c.Query("status")
	customerID := c.Query("customer_id")
	policyID := c.Query("policy_id")

	query := "SELECT id, policy_id, customer_id, amount, status, description, incident_date, filed_date, updated_at FROM claims WHERE 1=1"
	args := []interface{}{}
	argCount := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, status)
		argCount++
	}
	if customerID != "" {
		query += fmt.Sprintf(" AND customer_id = $%d", argCount)
		args = append(args, customerID)
		argCount++
	}
	if policyID != "" {
		query += fmt.Sprintf(" AND policy_id = $%d", argCount)
		args = append(args, policyID)
		argCount++
	}

	query += " ORDER BY filed_date DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch claims"})
		return
	}
	defer rows.Close()

	claims := []Claim{}
	for rows.Next() {
		var claim Claim
		err := rows.Scan(&claim.ID, &claim.PolicyID, &claim.CustomerID, &claim.Amount, &claim.Status,
			&claim.Description, &claim.IncidentDate, &claim.FiledDate, &claim.UpdatedAt)
		if err != nil {
			continue
		}
		claims = append(claims, claim)
	}

	c.JSON(http.StatusOK, claims)
}

func getClaim(c *gin.Context) {
	id := c.Param("id")

	var claim Claim
	query := "SELECT id, policy_id, customer_id, amount, status, description, incident_date, filed_date, updated_at FROM claims WHERE id = $1"
	err := db.QueryRow(query, id).Scan(&claim.ID, &claim.PolicyID, &claim.CustomerID, &claim.Amount,
		&claim.Status, &claim.Description, &claim.IncidentDate, &claim.FiledDate, &claim.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Claim not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch claim"})
		return
	}

	c.JSON(http.StatusOK, claim)
}

func updateClaim(c *gin.Context) {
	id := c.Param("id")

	var claim Claim
	if err := c.ShouldBindJSON(&claim); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claim.UpdatedAt = time.Now()

	query := `
		UPDATE claims 
		SET amount = $1, description = $2, incident_date = $3, updated_at = $4
		WHERE id = $5
	`
	result, err := db.Exec(query, claim.Amount, claim.Description, claim.IncidentDate, claim.UpdatedAt, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update claim"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Claim not found"})
		return
	}

	claim.ID = id
	c.JSON(http.StatusOK, claim)
}

func deleteClaim(c *gin.Context) {
	id := c.Param("id")

	query := "DELETE FROM claims WHERE id = $1"
	result, err := db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete claim"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Claim not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Claim deleted successfully"})
}

func approveClaim(c *gin.Context) {
	id := c.Param("id")

	query := "UPDATE claims SET status = 'approved', updated_at = $1 WHERE id = $2"
	result, err := db.Exec(query, time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve claim"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Claim not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Claim approved successfully"})
}

func rejectClaim(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := "UPDATE claims SET status = 'rejected', description = description || ' | Rejection reason: ' || $1, updated_at = $2 WHERE id = $3"
	result, err := db.Exec(query, body.Reason, time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject claim"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Claim not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Claim rejected successfully"})
}

func listClaimDocuments(c *gin.Context) {
	claimID := c.Param("id")

	query := "SELECT id, claim_id, document_type, document_url, uploaded_at FROM claim_documents WHERE claim_id = $1 ORDER BY uploaded_at DESC"
	rows, err := db.Query(query, claimID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch documents"})
		return
	}
	defer rows.Close()

	documents := []ClaimDocument{}
	for rows.Next() {
		var doc ClaimDocument
		err := rows.Scan(&doc.ID, &doc.ClaimID, &doc.DocumentType, &doc.DocumentURL, &doc.UploadedAt)
		if err != nil {
			continue
		}
		documents = append(documents, doc)
	}

	c.JSON(http.StatusOK, documents)
}

func uploadClaimDocument(c *gin.Context) {
	claimID := c.Param("id")

	var doc ClaimDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	doc.ID = uuid.New().String()
	doc.ClaimID = claimID
	doc.UploadedAt = time.Now()

	query := `
		INSERT INTO claim_documents (id, claim_id, document_type, document_url, uploaded_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := db.Exec(query, doc.ID, doc.ClaimID, doc.DocumentType, doc.DocumentURL, doc.UploadedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload document"})
		return
	}

	c.JSON(http.StatusCreated, doc)
}
