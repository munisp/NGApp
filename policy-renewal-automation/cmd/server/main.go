package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"policy-renewal-automation/internal/handlers"
	"policy-renewal-automation/internal/repository"
	"policy-renewal-automation/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8101"
	}
	db, err := gorm.Open(sqlite.Open("renewal.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewRenewalRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewRenewalService(repo)
	handler := handlers.NewRenewalHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("policy-renewal-automation starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
