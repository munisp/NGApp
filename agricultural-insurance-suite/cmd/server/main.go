package main

import (
	"agricultural-insurance-suite/internal/handlers"
	"agricultural-insurance-suite/internal/repository"
	"agricultural-insurance-suite/internal/service"
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
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "agricultural-insurance-suite"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)

	log.Println("[agricultural-insurance-suite] starting on :8140 — 13 climate/agricultural products")
	log.Fatal(http.ListenAndServe(":8140", r))
}
