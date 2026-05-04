package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"github.com/swaggo/gin-swagger"
	"github.com/swaggo/gin-swagger/swaggerFiles"

	"github.com/enterprise-crm/customer-service/internal/config"
	"github.com/enterprise-crm/customer-service/internal/handlers"
	"github.com/enterprise-crm/customer-service/internal/repository"
	"github.com/enterprise-crm/customer-service/internal/service"
)

// @title Customer Management Service API
// @version 1.0
// @description Enterprise CRM Customer Management Service
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.enterprise-crm.com/support
// @contact.email support@enterprise-crm.com

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/v1
// @schemes http https

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization

func main() {
	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database
	db, err := repository.NewPostgresDB(cfg.Database)
	if err != nil {
		logger.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize Redis
	redisClient, err := repository.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Fatalf("Failed to initialize Redis: %v", err)
	}

	// Initialize repositories
	customerRepo := repository.NewCustomerRepository(db, redisClient, logger)
	eventRepo := repository.NewEventRepository(db, logger)

	// Initialize services
	customerService := service.NewCustomerService(customerRepo, eventRepo, logger)
	healthService := service.NewHealthService(db, redisClient, logger)

	// Initialize handlers
	customerHandler := handlers.NewCustomerHandler(customerService, logger)
	healthHandler := handlers.NewHealthHandler(healthService, logger)

	// Initialize Gin router
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// CORS configuration
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Requested-With"}
	router.Use(cors.New(corsConfig))

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health check endpoints
	router.GET("/health", healthHandler.HealthCheck)
	router.GET("/ready", healthHandler.ReadinessCheck)

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API routes
	v1 := router.Group("/api/v1")
	{
		customers := v1.Group("/customers")
		{
			customers.GET("", customerHandler.GetCustomers)
			customers.POST("", customerHandler.CreateCustomer)
			customers.GET("/:id", customerHandler.GetCustomer)
			customers.PUT("/:id", customerHandler.UpdateCustomer)
			customers.DELETE("/:id", customerHandler.DeleteCustomer)
			customers.GET("/:id/profile", customerHandler.GetCustomerProfile)
			customers.PUT("/:id/profile", customerHandler.UpdateCustomerProfile)
			customers.GET("/:id/interactions", customerHandler.GetCustomerInteractions)
			customers.POST("/:id/interactions", customerHandler.CreateCustomerInteraction)
			customers.GET("/:id/segments", customerHandler.GetCustomerSegments)
			customers.PUT("/:id/segments", customerHandler.UpdateCustomerSegments)
		}

		// Customer analytics endpoints
		analytics := v1.Group("/analytics")
		{
			analytics.GET("/segments", customerHandler.GetSegmentAnalytics)
			analytics.GET("/lifecycle", customerHandler.GetLifecycleAnalytics)
			analytics.GET("/value", customerHandler.GetValueAnalytics)
			analytics.GET("/churn", customerHandler.GetChurnAnalytics)
		}

		// Customer search and filtering
		search := v1.Group("/search")
		{
			search.GET("/customers", customerHandler.SearchCustomers)
			search.POST("/customers/advanced", customerHandler.AdvancedSearchCustomers)
		}

		// Bulk operations
		bulk := v1.Group("/bulk")
		{
			bulk.POST("/customers", customerHandler.BulkCreateCustomers)
			bulk.PUT("/customers", customerHandler.BulkUpdateCustomers)
			bulk.DELETE("/customers", customerHandler.BulkDeleteCustomers)
		}

		// Event handling endpoints
		events := v1.Group("/events")
		{
			events.POST("/customer", customerHandler.HandleCustomerEvent)
			events.POST("/interaction", customerHandler.HandleInteractionEvent)
			events.POST("/segment", customerHandler.HandleSegmentEvent)
		}
	}

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(cfg.Server.IdleTimeout) * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logger.Infof("Starting Customer Management Service on port %d", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down Customer Management Service...")

	// Create a context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		logger.Errorf("Server forced to shutdown: %v", err)
	}

	// Close database connections
	sqlDB, _ := db.DB()
	if err := sqlDB.Close(); err != nil {
		logger.Errorf("Failed to close database connection: %v", err)
	}

	// Close Redis connection
	if err := redisClient.Close(); err != nil {
		logger.Errorf("Failed to close Redis connection: %v", err)
	}

	logger.Info("Customer Management Service stopped")
}

