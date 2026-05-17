package main

import (
	"document-management-system/internal/models"
	"document-management-system/internal/service"
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
		dsn = "host=localhost user=postgres password=postgres dbname=document_management port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.Document{}, &models.DocumentVersion{}, &models.DocumentAccess{}, &models.DocumentFolder{}, &models.DocumentTemplate{})

	svc := service.NewDocumentService(db)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })

	api := r.Group("/api/v1")
	{
		api.POST("/documents", func(c *gin.Context) {
			var doc models.Document
			if err := c.ShouldBindJSON(&doc); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateDocument(c.Request.Context(), &doc); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, doc)
		})

		api.GET("/documents/:id", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			doc, err := svc.GetDocument(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
				return
			}
			c.JSON(http.StatusOK, doc)
		})

		api.GET("/documents/search", func(c *gin.Context) {
			query := c.Query("q")
			entityType := c.Query("entity_type")
			entityID, _ := uuid.Parse(c.Query("entity_id"))
			docs, err := svc.SearchDocuments(c.Request.Context(), query, entityType, entityID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, docs)
		})

		api.GET("/documents/:id/versions", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			versions, err := svc.GetVersions(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, versions)
		})

		api.POST("/documents/:id/verify", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.VerifyDocument(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Document verified"})
		})

		api.POST("/documents/:id/archive", func(c *gin.Context) {
			id, _ := uuid.Parse(c.Param("id"))
			if err := svc.ArchiveDocument(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Document archived"})
		})

		api.GET("/folders", func(c *gin.Context) {
			var parentID *uuid.UUID
			if pid := c.Query("parent_id"); pid != "" {
				id, _ := uuid.Parse(pid)
				parentID = &id
			}
			folders, err := svc.GetFolders(c.Request.Context(), parentID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, folders)
		})

		api.POST("/folders", func(c *gin.Context) {
			var folder models.DocumentFolder
			if err := c.ShouldBindJSON(&folder); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := svc.CreateFolder(c.Request.Context(), &folder); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, folder)
		})

		api.GET("/stats", func(c *gin.Context) {
			stats, err := svc.GetDocumentStats(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, stats)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8087"
	}
	log.Printf("Document Management System starting on port %s", port)
	r.Run(":" + port)
}
