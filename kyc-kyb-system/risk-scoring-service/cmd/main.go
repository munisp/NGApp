package main

import (
	"log"
	"os"

	"risk-scoring-service/internal/api"
	"risk-scoring-service/internal/models"
	"risk-scoring-service/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgresql://kyc_user:kyc_password@postgres:5432/kyc_db"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := db.AutoMigrate(&models.RiskScore{}, &models.RiskFactor{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	riskService := services.NewRiskScoringService(db)

	router := gin.Default()

	handler := api.NewHandler(riskService)
	handler.RegisterRoutes(router)

	log.Println("Risk Scoring Service starting on :8004")
	if err := router.Run(":8004"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
