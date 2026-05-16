package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"batch-processing-engine/internal/handlers"
	"batch-processing-engine/internal/repository"
	"batch-processing-engine/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8099"
	}
	db, err := gorm.Open(sqlite.Open("batchproc.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	repo := repository.NewBatchRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	svc := service.NewBatchService(repo)
	handler := handlers.NewBatchHandler(svc)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	addr := fmt.Sprintf(":%s", port)
	log.Printf("batch-processing-engine starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
