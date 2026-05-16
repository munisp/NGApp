package main

import (
	"log"
	"os"

	"aml-screening-service/internal/api"
	"aml-screening-service/internal/models"
	"aml-screening-service/internal/services"

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

	if err := db.AutoMigrate(&models.AMLScreening{}, &models.Hit{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	amlService := services.NewAMLService(db)

	router := gin.Default()

	handler := api.NewHandler(amlService)
	handler.RegisterRoutes(router)

	log.Println("AML Screening Service starting on :8003")
	if err := router.Run(":8003"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
