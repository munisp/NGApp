package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"mobile-money-service/internal/handlers"
	"mobile-money-service/internal/repository"
	"mobile-money-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8092"
	}

	repo := repository.NewMoMoRepository()
	svc := service.NewMoMoService(repo)
	h := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"mobile-money-service","version":"2.0.0"}`))
	})

	log.Printf("Mobile Money Service v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
