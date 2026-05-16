package main

import (
	"disaster-recovery-module/internal/models"
	"disaster-recovery-module/internal/service"
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
		dsn = "host=localhost user=postgres password=postgres dbname=disaster_recovery port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.Backup{}, &models.BackupSchedule{}, &models.FailoverConfig{}, &models.RecoveryPoint{}, &models.DRMetrics{})

	svc := service.NewDRService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.POST("/backups", func(c *gin.Context) {
			var backup models.Backup
			if err := c.ShouldBindJSON(&backup); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateBackup(c.Request.Context(), &backup); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, backup)
		})

		api.GET("/backups", func(c *gin.Context) {
			status := c.Query("status")
			backups, err := svc.GetBackups(c.Request.Context(), status)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, backups)
		})

		api.GET("/backups/:id", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			backup, err := svc.GetBackup(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
				return
			}
			c.JSON(http.StatusOK, backup)
		})

		api.POST("/backups/:id/start", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.StartBackup(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Backup started"})
		})

		api.POST("/backups/:id/complete", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			var req struct {
				SizeBytes int64  `json:"size_bytes"`
				Checksum  string `json:"checksum"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CompleteBackup(c.Request.Context(), id, req.SizeBytes, req.Checksum); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Backup completed"})
		})

		api.GET("/schedules", func(c *gin.Context) {
			schedules, err := svc.GetSchedules(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, schedules)
		})

		api.POST("/schedules", func(c *gin.Context) {
			var schedule models.BackupSchedule
			if err := c.ShouldBindJSON(&schedule); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateSchedule(c.Request.Context(), &schedule); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, schedule)
		})

		api.GET("/failover", func(c *gin.Context) {
			configs, err := svc.GetFailoverConfigs(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, configs)
		})

		api.POST("/failover", func(c *gin.Context) {
			var config models.FailoverConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateFailoverConfig(c.Request.Context(), &config); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, config)
		})

		api.POST("/failover/:id/trigger", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.TriggerFailover(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Failover triggered"})
		})

		api.POST("/failover/:id/recover", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.RecoverFromFailover(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Recovery completed"})
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetDRStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8092"
	}
	log.Printf("Disaster Recovery Module starting on port %s", port)
	r.Run(":" + port)
}
