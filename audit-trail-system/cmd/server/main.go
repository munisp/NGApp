package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"audit-trail-system/internal/handlers"
	"audit-trail-system/internal/repository"
	"audit-trail-system/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8098"
	}
	db, err := gorm.Open(sqlite.Open("audit.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewAuditRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewAuditService(repo)
	handler := handlers.NewAuditHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("audit-trail-system starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
