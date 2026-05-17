package main

import (
	"log"
	"multi-currency-support/internal/models"
	"multi-currency-support/internal/service"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=multi_currency port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.Currency{}, &models.ExchangeRate{}, &models.CurrencyConversion{}, &models.CurrencyConfig{})

	svc := service.NewCurrencyService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.GET("/currencies", func(c *gin.Context) {
			currencies, err := svc.GetCurrencies(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, currencies)
		})

		api.GET("/rates/:from/:to", func(c *gin.Context) {
			rate, err := svc.GetExchangeRate(c.Request.Context(), c.Param("from"), c.Param("to"))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Rate not found"})
				return
			}
			c.JSON(http.StatusOK, rate)
		})

		api.POST("/rates", func(c *gin.Context) {
			var rate models.ExchangeRate
			if err := c.ShouldBindJSON(&rate); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.SetExchangeRate(c.Request.Context(), &rate); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, rate)
		})

		api.GET("/rates/:from/:to/history", func(c *gin.Context) {
			days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
			rates, err := svc.GetRateHistory(c.Request.Context(), c.Param("from"), c.Param("to"), days)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, rates)
		})

		api.POST("/convert", func(c *gin.Context) {
			var req struct {
				From   string  `json:"from"`
				To     string  `json:"to"`
				Amount float64 `json:"amount"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			conversion, err := svc.Convert(c.Request.Context(), req.From, req.To, req.Amount)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, conversion)
		})

		api.GET("/conversions", func(c *gin.Context) {
			entityType := c.Query("entity_type")
			entityID, _ := uuid.Parse(c.Query("entity_id"))
			conversions, err := svc.GetConversionHistory(c.Request.Context(), entityType, entityID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, conversions)
		})

		api.GET("/config", func(c *gin.Context) {
			config, err := svc.GetConfig(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
				return
			}
			c.JSON(http.StatusOK, config)
		})

		api.PUT("/config", func(c *gin.Context) {
			var config models.CurrencyConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.UpdateConfig(c.Request.Context(), &config); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, config)
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetCurrencyStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}
	log.Printf("Multi-Currency Support starting on port %s", port)
	r.Run(":" + port)
}
