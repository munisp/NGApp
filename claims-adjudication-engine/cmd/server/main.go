package main

import (
	"claims-adjudication-engine/internal/models"
	"claims-adjudication-engine/internal/service"
	"log"
	"net/http"
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
		dsn = "host=localhost user=postgres password=postgres dbname=claims_adjudication port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.Claim{}, &models.AdjudicationRule{}, &models.AdjudicationDecision{}, &models.ClaimDocument{}, &models.ClaimPayment{})

	svc := service.NewAdjudicationService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := r.Group("/api/v1")
	{
		api.POST("/claims/:id/adjudicate", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			decision, err := svc.ProcessClaim(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, decision)
		})

		api.GET("/claims/:id/decisions", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			decisions, err := svc.GetClaimDecisions(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, decisions)
		})

		api.GET("/rules", func(c *gin.Context) {
			rules, err := svc.GetRules(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, rules)
		})

		api.POST("/rules", func(c *gin.Context) {
			var rule models.AdjudicationRule
			if err := c.ShouldBindJSON(&rule); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateRule(c.Request.Context(), &rule); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, rule)
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetAdjudicationStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	log.Printf("Claims Adjudication Engine starting on port %s", port)
	r.Run(":" + port)
}
