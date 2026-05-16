package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"instant-payout-service/internal/handlers"
	"instant-payout-service/internal/repository"
	"instant-payout-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8101"
	}

	repo := repository.NewPayoutRepository()
	svc := service.NewPayoutService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"instant-payout-service","version":"2.0.0"}`))
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))
	})

	log.Printf("Instant Payout Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
