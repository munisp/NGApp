package main

import (
	"log"
	"net/http"
	"os"
	"reconciliation-engine/internal/models"
	"reconciliation-engine/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=reconciliation port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.ReconciliationJob{}, &models.ReconciliationItem{}, &models.BankStatement{}, &models.StatementTransaction{})

	svc := service.NewReconciliationService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.POST("/jobs", func(c *gin.Context) {
			var job models.ReconciliationJob
			if err := c.ShouldBindJSON(&job); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateJob(c.Request.Context(), &job); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, job)
		})

		api.GET("/jobs", func(c *gin.Context) {
			status := c.Query("status")
			jobs, err := svc.GetJobs(c.Request.Context(), status)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, jobs)
		})

		api.GET("/jobs/:id", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			job, err := svc.GetJob(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
				return
			}
			c.JSON(http.StatusOK, job)
		})

		api.POST("/jobs/:id/start", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.StartJob(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Job started"})
		})

		api.POST("/jobs/:id/complete", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.CompleteJob(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Job completed"})
		})

		api.GET("/jobs/:id/items", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			status := c.Query("status")
			items, err := svc.GetJobItems(c.Request.Context(), id, status)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, items)
		})

		api.POST("/jobs/:id/items", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var item models.ReconciliationItem
			if err := c.ShouldBindJSON(&item); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			item.JobID = id
			if err := svc.AddReconciliationItem(c.Request.Context(), &item); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, item)
		})

		api.POST("/items/:id/resolve", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var req struct {
				ResolvedBy string `json:"resolved_by"`
				Notes      string `json:"notes"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			resolvedBy, _ := uuid.Parse(req.ResolvedBy)
			if err := svc.ResolveItem(c.Request.Context(), id, resolvedBy, req.Notes); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Item resolved"})
		})

		api.POST("/statements", func(c *gin.Context) {
			var statement models.BankStatement
			if err := c.ShouldBindJSON(&statement); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.UploadStatement(c.Request.Context(), &statement); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, statement)
		})

		api.GET("/statements", func(c *gin.Context) {
			bankCode := c.Query("bank_code")
			accountNumber := c.Query("account_number")
			statements, err := svc.GetStatements(c.Request.Context(), bankCode, accountNumber)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, statements)
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetReconciliationStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8091"
	}
	log.Printf("Reconciliation Engine starting on port %s", port)
	r.Run(":" + port)
}
