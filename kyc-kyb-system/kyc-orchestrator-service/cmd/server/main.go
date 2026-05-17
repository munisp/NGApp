package main

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/munisp/NGApp/kyc-kyb-system/kyc-orchestrator-service/internal/handlers"
	"github.com/munisp/NGApp/kyc-kyb-system/kyc-orchestrator-service/internal/services"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	livenessURL := os.Getenv("LIVENESS_ENGINE_URL")
	if livenessURL == "" {
		livenessURL = "http://localhost:8110"
	}

	ocrURL := os.Getenv("OCR_ENGINE_URL")
	if ocrURL == "" {
		ocrURL = "http://localhost:8111"
	}

	identityMatcherURL := os.Getenv("IDENTITY_MATCHER_URL")
	if identityMatcherURL == "" {
		identityMatcherURL = "http://localhost:8112"
	}

	kycService := services.NewKYCService(logger, livenessURL, ocrURL, identityMatcherURL)
	kybService := services.NewKYBService(logger)
	amlService := services.NewAMLService(logger)

	kycHandler := handlers.NewKYCHandler(kycService, amlService)
	kybHandler := handlers.NewKYBHandler(kybService)

	r := gin.Default()
	r.Use(corsMiddleware())

	startTime := time.Now()

	// Health endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":         "healthy",
			"version":        "1.0.0",
			"service":        "kyc-orchestrator",
			"uptime_seconds": time.Since(startTime).Seconds(),
		})
	})
	r.GET("/ready", func(c *gin.Context) {
		c.JSON(200, gin.H{"ready": true})
	})

	// KYC routes
	kyc := r.Group("/api/v1/kyc")
	{
		kyc.POST("/start", kycHandler.StartVerification)
		kyc.GET("/session/:sessionId", kycHandler.GetVerification)
		kyc.GET("/user/:userId", kycHandler.GetUserVerifications)
		kyc.POST("/document", kycHandler.SubmitDocument)
		kyc.POST("/selfie", kycHandler.SubmitSelfie)
		kyc.POST("/verify/nin", kycHandler.VerifyNIN)
		kyc.POST("/verify/bvn", kycHandler.VerifyBVN)
		kyc.POST("/verify/phone", kycHandler.VerifyPhone)
		kyc.POST("/review", kycHandler.ReviewDecision)
		kyc.GET("/events/:sessionId", kycHandler.GetEvents)
		kyc.POST("/aml/screen", kycHandler.AMLScreen)
		kyc.GET("/risk/:sessionId", kycHandler.AssessRisk)
	}

	// KYB routes
	kyb := r.Group("/api/v1/kyb")
	{
		kyb.POST("/start", kybHandler.StartVerification)
		kyb.GET("/session/:sessionId", kybHandler.GetVerification)
		kyb.POST("/verify/cac/:sessionId", kybHandler.VerifyCAC)
		kyb.POST("/verify/tin/:sessionId", kybHandler.VerifyTIN)
		kyb.POST("/director", kybHandler.AddDirector)
		kyb.POST("/ubo", kybHandler.AddUBO)
		kyb.POST("/document", kybHandler.SubmitDocument)
		kyb.POST("/review", kybHandler.ReviewDecision)
		kyb.GET("/events/:sessionId", kybHandler.GetEvents)
	}

	logger.Info("kyc_orchestrator_starting", zap.String("port", port))
	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		logger.Fatal("server_failed", zap.Error(err))
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
