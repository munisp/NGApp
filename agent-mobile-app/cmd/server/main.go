package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agent-mobile-app/internal/handlers"
	"agent-mobile-app/internal/models"
	"agent-mobile-app/internal/repository"
	"agent-mobile-app/internal/service"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8110"
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
			&models.AgentProfile{},
			&models.AgentLead{},
			&models.AgentQuote{},
			&models.AgentActivity{},
		); err != nil {
			log.Printf("WARNING: Migration failed: %v", err)
		}
	}

	repo := repository.NewAgentMobileRepository(db)
	svc := service.NewAgentMobileService(repo)
	handler := handlers.NewAgentMobileHandler(svc)

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
		log.Printf("Agent Mobile App API starting on port %s", port)
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
