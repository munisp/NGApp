package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"native-mobile-ios/internal/handlers"
	"native-mobile-ios/internal/repository"
	"native-mobile-ios/internal/service"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8111"
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
		repo := repository.NewMobileRepository(db)
		if err := repo.AutoMigrate(); err != nil {
			log.Printf("WARNING: Migration failed: %v", err)
		}

		svc := service.NewMobileService(repo)
		handler := handlers.NewMobileHandler(svc)

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
			log.Printf("Native Mobile iOS API starting on port %s", port)
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
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"native-mobile-ios","db":"disconnected"}`))
	})
	log.Printf("Native Mobile iOS API starting on port %s (no database)", port)
	http.ListenAndServe(":"+port, mux)
}
