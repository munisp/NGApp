package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"usage-based-insurance/internal/handlers"
	"usage-based-insurance/internal/repository"
	"usage-based-insurance/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8097"
	}

	repo := repository.NewUBIRepository()
	svc := service.NewUBIService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"usage-based-insurance","version":"2.0.0"}`))
	})

	log.Printf("Usage-Based Insurance Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
