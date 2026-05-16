package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"microinsurance-engine/internal/handlers"
	"microinsurance-engine/internal/repository"
	"microinsurance-engine/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8094"
	}

	repo := repository.NewMicroRepository()
	svc := service.NewMicroService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"microinsurance-engine","version":"2.0.0"}`))
	})

	log.Printf("Microinsurance Engine v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
