package main

import (
	"context"
	"database/sql"
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

type Customer struct {
	ID          string    `json:"id"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	DateOfBirth time.Time `json:"date_of_birth"`
	Address     string    `json:"address"`
	KYCStatus   string    `json:"kyc_status"` // pending, verified, rejected
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Policy struct {
	ID         string    `json:"id"`
	CustomerID string    `json:"customer_id"`
	PolicyType string    `json:"policy_type"`
	Status     string    `json:"status"`
	Premium    float64   `json:"premium"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
}

type Claim struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	CustomerID  string    `json:"customer_id"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"`
	FiledDate   time.Time `json:"filed_date"`
}

type Payment struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	CustomerID  string    `json:"customer_id"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"`
	PaymentDate time.Time `json:"payment_date"`
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
		// Customer routes
		customers := v1.Group("/customers")
		{
			customers.POST("/", createCustomer)
			customers.GET("/", listCustomers)
			customers.GET("/:id", getCustomer)
			customers.PUT("/:id", updateCustomer)
			customers.DELETE("/:id", deleteCustomer)
			customers.GET("/:id/policies", getCustomerPolicies)
			customers.GET("/:id/claims", getCustomerClaims)
			customers.GET("/:id/payments", getCustomerPayments)
			customers.PUT("/:id/kyc-status", updateKYCStatus)
		}
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Customer Service starting on port %s", port)
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
		"status":    "healthy",
		"service":   "customer-service",
		"timestamp": time.Now().Unix(),
	})
}

func createCustomer(c *gin.Context) {
	var customer Customer
	if err := c.ShouldBindJSON(&customer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer.ID = uuid.New().String()
	customer.KYCStatus = "pending"
	customer.CreatedAt = time.Now()
	customer.UpdatedAt = time.Now()

	query := `
		INSERT INTO customers (id, first_name, last_name, email, phone, date_of_birth, address, kyc_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := db.Exec(query, customer.ID, customer.FirstName, customer.LastName, customer.Email,
		customer.Phone, customer.DateOfBirth, customer.Address, customer.KYCStatus, customer.CreatedAt, customer.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
		return
	}

	c.JSON(http.StatusCreated, customer)
}

func listCustomers(c *gin.Context) {
	kycStatus := c.Query("kyc_status")
	search := c.Query("search")

	query := "SELECT id, first_name, last_name, email, phone, date_of_birth, address, kyc_status, created_at, updated_at FROM customers WHERE 1=1"
	args := []interface{}{}
	argCount := 1

	if kycStatus != "" {
		query += fmt.Sprintf(" AND kyc_status = $%d", argCount)
		args = append(args, kycStatus)
		argCount++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (first_name ILIKE $%d OR last_name ILIKE $%d OR email ILIKE $%d)", argCount, argCount, argCount)
		args = append(args, "%"+search+"%")
		argCount++
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customers"})
		return
	}
	defer rows.Close()

	customers := []Customer{}
	for rows.Next() {
		var customer Customer
		err := rows.Scan(&customer.ID, &customer.FirstName, &customer.LastName, &customer.Email,
			&customer.Phone, &customer.DateOfBirth, &customer.Address, &customer.KYCStatus,
			&customer.CreatedAt, &customer.UpdatedAt)
		if err != nil {
			continue
		}
		customers = append(customers, customer)
	}

	c.JSON(http.StatusOK, customers)
}

func getCustomer(c *gin.Context) {
	id := c.Param("id")

	var customer Customer
	query := "SELECT id, first_name, last_name, email, phone, date_of_birth, address, kyc_status, created_at, updated_at FROM customers WHERE id = $1"
	err := db.QueryRow(query, id).Scan(&customer.ID, &customer.FirstName, &customer.LastName,
		&customer.Email, &customer.Phone, &customer.DateOfBirth, &customer.Address,
		&customer.KYCStatus, &customer.CreatedAt, &customer.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customer"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

func updateCustomer(c *gin.Context) {
	id := c.Param("id")

	var customer Customer
	if err := c.ShouldBindJSON(&customer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer.UpdatedAt = time.Now()

	query := `
		UPDATE customers 
		SET first_name = $1, last_name = $2, email = $3, phone = $4, date_of_birth = $5, address = $6, updated_at = $7
		WHERE id = $8
	`
	result, err := db.Exec(query, customer.FirstName, customer.LastName, customer.Email,
		customer.Phone, customer.DateOfBirth, customer.Address, customer.UpdatedAt, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	customer.ID = id
	c.JSON(http.StatusOK, customer)
}

func deleteCustomer(c *gin.Context) {
	id := c.Param("id")

	query := "DELETE FROM customers WHERE id = $1"
	result, err := db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete customer"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Customer deleted successfully"})
}

func getCustomerPolicies(c *gin.Context) {
	customerID := c.Param("id")

	query := "SELECT id, customer_id, policy_type, status, premium, start_date, end_date FROM policies WHERE customer_id = $1 ORDER BY start_date DESC"
	rows, err := db.Query(query, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch policies"})
		return
	}
	defer rows.Close()

	policies := []Policy{}
	for rows.Next() {
		var policy Policy
		err := rows.Scan(&policy.ID, &policy.CustomerID, &policy.PolicyType, &policy.Status,
			&policy.Premium, &policy.StartDate, &policy.EndDate)
		if err != nil {
			continue
		}
		policies = append(policies, policy)
	}

	c.JSON(http.StatusOK, policies)
}

func getCustomerClaims(c *gin.Context) {
	customerID := c.Param("id")

	query := "SELECT id, policy_id, customer_id, amount, status, filed_date FROM claims WHERE customer_id = $1 ORDER BY filed_date DESC"
	rows, err := db.Query(query, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch claims"})
		return
	}
	defer rows.Close()

	claims := []Claim{}
	for rows.Next() {
		var claim Claim
		err := rows.Scan(&claim.ID, &claim.PolicyID, &claim.CustomerID, &claim.Amount, &claim.Status, &claim.FiledDate)
		if err != nil {
			continue
		}
		claims = append(claims, claim)
	}

	c.JSON(http.StatusOK, claims)
}

func getCustomerPayments(c *gin.Context) {
	customerID := c.Param("id")

	query := "SELECT id, policy_id, customer_id, amount, status, payment_date FROM payments WHERE customer_id = $1 ORDER BY payment_date DESC"
	rows, err := db.Query(query, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payments"})
		return
	}
	defer rows.Close()

	payments := []Payment{}
	for rows.Next() {
		var payment Payment
		err := rows.Scan(&payment.ID, &payment.PolicyID, &payment.CustomerID, &payment.Amount, &payment.Status, &payment.PaymentDate)
		if err != nil {
			continue
		}
		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, payments)
}

func updateKYCStatus(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		KYCStatus string `json:"kyc_status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := "UPDATE customers SET kyc_status = $1, updated_at = $2 WHERE id = $3"
	result, err := db.Exec(query, body.KYCStatus, time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update KYC status"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "KYC status updated successfully"})
}
