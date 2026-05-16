package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"multi-currency-service/internal/handlers"
	"multi-currency-service/internal/repository"
	"multi-currency-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8102"
	}

	repo := repository.NewCurrencyRepository()
	svc := service.NewCurrencyService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"multi-currency-service","version":"2.0.0"}`))
	})

	log.Printf("Multi-Currency Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
