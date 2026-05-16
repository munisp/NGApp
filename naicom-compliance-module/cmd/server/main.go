package main

import (
	"log"
	"net/http"
	"naicom-compliance-module/internal/models"
	"naicom-compliance-module/internal/service"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=naicom_compliance port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(
		&models.ComplianceReport{},
		&models.FilingDeadline{},
		&models.SolvencyMetrics{},
		&models.PremiumIncomeReport{},
		&models.ClaimsReport{},
		&models.ComplianceAlert{},
		&models.NAICOMSubmission{},
	)

	svc := service.NewComplianceService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := r.Group("/api/v1")
	{
		api.GET("/dashboard", func(c *gin.Context) {
			dashboard, err := svc.GetComplianceDashboard(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, dashboard)
		})

		api.GET("/reports", func(c *gin.Context) {
			reports, err := svc.ListReports(c.Request.Context(), nil, nil)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, reports)
		})

		api.GET("/reports/:id", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			report, err := svc.GetReport(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, report)
		})

		api.POST("/reports/:id/submit", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			report, err := svc.SubmitReport(c.Request.Context(), id, uuid.New(), "/reports/"+id.String()+".pdf")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, report)
		})

		api.GET("/alerts", func(c *gin.Context) {
			alerts, err := svc.GetPendingAlerts(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, alerts)
		})

		api.GET("/deadlines", func(c *gin.Context) {
			deadlines, err := svc.GetUpcomingDeadlines(c.Request.Context(), 30)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, deadlines)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("NAICOM Compliance Module starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
