package main

import (
	"log"
	"net/http"
	"nigerian-bank-integrations/internal/models"
	"nigerian-bank-integrations/internal/service"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=nigerian_banks port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.Bank{}, &models.BankAccount{}, &models.BankTransaction{}, &models.AccountVerification{}, &models.DirectDebitMandate{})

	svc := service.NewBankService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.GET("/banks", func(c *gin.Context) {
			banks, err := svc.GetBanks(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, banks)
		})

		api.POST("/accounts/verify", func(c *gin.Context) {
			var req struct {
				AccountNumber string `json:"account_number"`
				BankCode      string `json:"bank_code"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			verification, err := svc.VerifyAccount(c.Request.Context(), req.AccountNumber, req.BankCode)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, verification)
		})

		api.POST("/transfers", func(c *gin.Context) {
			var tx models.BankTransaction
			if err := c.ShouldBindJSON(&tx); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.InitiateTransfer(c.Request.Context(), &tx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, tx)
		})

		api.POST("/transfers/:ref/process", func(c *gin.Context) {
			if err := svc.ProcessTransfer(c.Request.Context(), c.Param("ref")); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Transfer processed"})
		})

		api.GET("/transfers/:ref", func(c *gin.Context) {
			tx, err := svc.GetTransaction(c.Request.Context(), c.Param("ref"))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
				return
			}
			c.JSON(http.StatusOK, tx)
		})

		api.GET("/customers/:id/accounts", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			accounts, err := svc.GetCustomerAccounts(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, accounts)
		})

		api.POST("/customers/:id/accounts", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var account models.BankAccount
			if err := c.ShouldBindJSON(&account); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			account.CustomerID = id
			if err := svc.AddBankAccount(c.Request.Context(), &account); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, account)
		})

		api.POST("/mandates", func(c *gin.Context) {
			var mandate models.DirectDebitMandate
			if err := c.ShouldBindJSON(&mandate); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateDirectDebitMandate(c.Request.Context(), &mandate); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, mandate)
		})

		api.GET("/customers/:id/mandates", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			mandates, err := svc.GetMandates(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, mandates)
		})

		api.DELETE("/mandates/:ref", func(c *gin.Context) {
			if err := svc.CancelMandate(c.Request.Context(), c.Param("ref")); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Mandate cancelled"})
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetBankStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	log.Printf("Nigerian Bank Integrations starting on port %s", port)
	r.Run(":" + port)
}
