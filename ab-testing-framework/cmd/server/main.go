package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"ab-testing-framework/internal/handlers"
	"ab-testing-framework/internal/repository"
	"ab-testing-framework/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8096"
	}
	db, err := gorm.Open(sqlite.Open("abtest.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewABTestRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewABTestService(repo)
	handler := handlers.NewABTestHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("ab-testing-framework starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
