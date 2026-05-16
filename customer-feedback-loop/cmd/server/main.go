package main

import (
	"customer-feedback-loop/internal/models"
	"customer-feedback-loop/internal/service"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=customer_feedback port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.NPSSurvey{}, &models.SatisfactionSurvey{}, &models.Complaint{}, &models.ComplaintNote{}, &models.FeedbackAnalytics{})

	svc := service.NewFeedbackService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.POST("/nps", func(c *gin.Context) {
			var survey models.NPSSurvey
			if err := c.ShouldBindJSON(&survey); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.SubmitNPSSurvey(c.Request.Context(), &survey); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, survey)
		})

		api.POST("/satisfaction", func(c *gin.Context) {
			var survey models.SatisfactionSurvey
			if err := c.ShouldBindJSON(&survey); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.SubmitSatisfactionSurvey(c.Request.Context(), &survey); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, survey)
		})

		api.POST("/complaints", func(c *gin.Context) {
			var complaint models.Complaint
			if err := c.ShouldBindJSON(&complaint); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateComplaint(c.Request.Context(), &complaint); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, complaint)
		})

		api.GET("/complaints/:id", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			complaint, err := svc.GetComplaint(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Complaint not found"})
				return
			}
			c.JSON(http.StatusOK, complaint)
		})

		api.PUT("/complaints/:id/status", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var req struct {
				Status     models.FeedbackStatus `json:"status"`
				Resolution string                `json:"resolution"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.UpdateComplaintStatus(c.Request.Context(), id, req.Status, req.Resolution); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
		})

		api.POST("/complaints/:id/escalate", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.EscalateComplaint(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Complaint escalated"})
		})

		api.GET("/complaints/:id/notes", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			notes, err := svc.GetComplaintNotes(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, notes)
		})

		api.POST("/complaints/:id/notes", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var note models.ComplaintNote
			if err := c.ShouldBindJSON(&note); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			note.ComplaintID = id
			if err := svc.AddComplaintNote(c.Request.Context(), &note); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, note)
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetFeedbackStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}
	log.Printf("Customer Feedback Loop starting on port %s", port)
	r.Run(":" + port)
}
