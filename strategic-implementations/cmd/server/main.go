package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"strategic-implementations/internal/handlers"
	"strategic-implementations/internal/models"
	"strategic-implementations/internal/repository"
	"strategic-implementations/internal/service"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8109"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=ngapp password=ngapp dbname=ngapp sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("WARNING: Database connection failed: %v — running with in-memory fallback", err)
		db = nil
	}

	if db != nil {
		if err := db.AutoMigrate(
			&models.StrategicInitiative{},
			&models.Milestone{},
			&models.KPI{},
			&models.RiskRegister{},
			&models.StrategicReport{},
		); err != nil {
			log.Printf("WARNING: Migration failed: %v", err)
		}
	}

	repo := repository.NewStrategyRepository(db)
	svc := service.NewStrategyService(repo)
	handler := handlers.NewStrategyHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Strategic Implementations service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
