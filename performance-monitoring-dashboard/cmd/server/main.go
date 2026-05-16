package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"performance-monitoring-dashboard/internal/handlers"
	"performance-monitoring-dashboard/internal/repository"
	"performance-monitoring-dashboard/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8103"
	}
	db, err := gorm.Open(sqlite.Open("perfmon.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewPerfMonRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewPerfMonService(repo)
	handler := handlers.NewPerfMonHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("performance-monitoring-dashboard starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
