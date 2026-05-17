package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"agent-commission-management/internal/handlers"
	"agent-commission-management/internal/repository"
	"agent-commission-management/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8097"
	}
	db, err := gorm.Open(sqlite.Open("commission.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewCommissionRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewCommissionService(repo)
	handler := handlers.NewCommissionHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("agent-commission-management starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
