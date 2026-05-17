package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"

	"reinsurer-api/api/http/handler"
	"reinsurer-api/internal/repository"
	"reinsurer-api/internal/service"
	"reinsurer-api/pkg/temporal"
	"reinsurer-api/pkg/util"
)

// Config struct to hold application configuration
type Config struct {
	Server struct {
		Port         string        `mapstructure:"port"`
		ReadTimeout  time.Duration `mapstructure:"readTimeout"`
		WriteTimeout time.Duration `mapstructure:"writeTimeout"`
	} `mapstructure:"server"`
	Auth struct {
		APIKeyHeader string   `mapstructure:"apiKeyHeader"`
		ValidAPIKeys []string `mapstructure:"validApiKeys"`
	} `mapstructure:"auth"`
	Services struct {
		PolicyServiceURL string `mapstructure:"policyServiceUrl"`
		ClaimsServiceURL string `mapstructure:"claimsServiceUrl"`
	} `mapstructure:"services"`
	Temporal struct {
		HostPort  string `mapstructure:"hostPort"`
		Namespace string `mapstructure:"namespace"`
		TaskQueue string `mapstructure:"taskQueue"`
	} `mapstructure:"temporal"`
	Database struct {
		Driver   string `mapstructure:"driver"`
		Host     string `mapstructure:"host"`
		Port     int    `mapstructure:"port"`
		User     string `mapstructure:"user"`
		Password string `mapstructure:"password"`
		Name     string `mapstructure:"name"`
		SSLMode  string `mapstructure:"sslmode"`
	} `mapstructure:"database"`
}

func loadConfig() *Config {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./configs")
	viper.AddConfigPath(".")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Error reading config file, %s", err)
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to decode into struct, %s", err)
	}

	// Set defaults and environment variable overrides
	if cfg.Server.Port == "" {
		cfg.Server.Port = "8080"
	}
	if os.Getenv("PORT") != "" {
		cfg.Server.Port = os.Getenv("PORT")
	}

	return &cfg
}

func main() {
	cfg := loadConfig()

	// 1. Initialize PostgreSQL database
	dbDSN := os.Getenv("DATABASE_URL")
	if dbDSN == "" {
		dbDSN = fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
			cfg.Database.User, cfg.Database.Password,
			cfg.Database.Host, cfg.Database.Port,
			cfg.Database.Name, cfg.Database.SSLMode)
	}
	db, err := repository.NewPostgresReinsurerDB(dbDSN)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer db.Close()
	log.Println("PostgreSQL database initialized")

	// 2. Initialize Temporal Client
	temporalClient, err := temporal.NewClient(cfg.Temporal.HostPort, cfg.Temporal.Namespace)
	if err != nil {
		log.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer temporalClient.Close()
	log.Println("Temporal client initialized")

	// 3. Initialize Repositories and Services
	reinsurerRepo := repository.NewReinsurerRepository(db)
	reinsurerService := service.NewReinsurerService(reinsurerRepo, temporalClient, cfg.Services.PolicyServiceURL, cfg.Services.ClaimsServiceURL)

	// 4. Initialize HTTP Handlers
	reinsurerHandler := handler.NewReinsurerHandler(reinsurerService)

	// 5. Setup Gin Router
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(util.PrometheusMiddleware()) // Prometheus metrics middleware

	// API Group with Authentication Middleware
	api := router.Group("/api/v1/reinsurer")
	api.Use(util.AuthMiddleware(cfg.Auth.APIKeyHeader, cfg.Auth.ValidAPIKeys))
	{
		// Quote Submission Endpoint
		api.POST("/quotes", reinsurerHandler.SubmitQuote)
		// Claim Notification Endpoint (from core system to reinsurer)
		api.POST("/claims", reinsurerHandler.NotifyClaim)
	}

	// Health and Metrics Endpoints
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "UP"}) })
	router.GET("/metrics", util.PrometheusHandler())

	// 6. Start HTTP Server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Printf("Server listening on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// 7. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
