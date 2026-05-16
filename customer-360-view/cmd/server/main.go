package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"customer-360-view/internal/handlers"
	"customer-360-view/internal/repository"
	"customer-360-view/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8102"
	}
	db, err := gorm.Open(sqlite.Open("customer360.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewCustomer360Repository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewCustomer360Service(repo)
	handler := handlers.NewCustomer360Handler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("customer-360-view starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
