package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"gamification-service/internal/handlers"
	"gamification-service/internal/repository"
	"gamification-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8110"
	}

	repo := repository.NewGamificationRepository()
	svc := service.NewGamificationService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"gamification-service","version":"2.0.0"}`))
	})

	log.Printf("Gamification Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
