package main

import (
	"embedded-distribution-platform/internal/handlers"
	"embedded-distribution-platform/internal/repository"
	"embedded-distribution-platform/internal/service"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	repo := repository.NewRepository()
	svc := service.NewService(repo)
	h := handlers.NewHandler(svc)
	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "embedded-distribution-platform"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)
	log.Println("[embedded-distribution-platform] starting on :8141 — 6 distribution channels, 6 partners")
	log.Fatal(http.ListenAndServe(":8141", r))
}
