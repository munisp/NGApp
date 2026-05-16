package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"premium-finance-service/internal/handlers"
	"premium-finance-service/internal/repository"
	"premium-finance-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8103"
	}

	repo := repository.NewFinanceRepository()
	svc := service.NewFinanceService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"premium-finance-service","version":"2.0.0"}`))
	})

	log.Printf("Premium Finance Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
