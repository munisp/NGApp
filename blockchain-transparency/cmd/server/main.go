package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"blockchain-transparency/internal/handlers"
	"blockchain-transparency/internal/repository"
	"blockchain-transparency/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8104"
	}

	repo := repository.NewBlockchainRepository()
	svc := service.NewBlockchainService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"blockchain-transparency","version":"2.0.0"}`))
	})

	log.Printf("Blockchain Transparency Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
