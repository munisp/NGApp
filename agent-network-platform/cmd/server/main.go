package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"agent-network-platform/internal/handlers"
	"agent-network-platform/internal/repository"
	"agent-network-platform/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8093"
	}
	repo := repository.NewAgentRepository()
	svc := service.NewAgentService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"agent-network-platform","version":"2.0.0"}`))
	})
	log.Printf("Agent Network Platform v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
