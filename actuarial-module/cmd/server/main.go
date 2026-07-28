package main

import (
	"actuarial-module/internal/handlers"
	"actuarial-module/internal/repository"
	"actuarial-module/internal/service"
	"fmt"
	"log"
	"net/http"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "actuarial.db"
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	repo := repository.NewActuarialRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	svc := service.NewActuarialService(repo)
	handler := handlers.NewActuarialHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Actuarial module starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
