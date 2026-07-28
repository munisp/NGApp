package main

import (
	"encoding/json"
	"log"
	"net/http"
	"niira-compulsory-insurance/internal/handlers"
	"niira-compulsory-insurance/internal/repository"
	"niira-compulsory-insurance/internal/service"

	"github.com/gorilla/mux"
)

func main() {
	repo := repository.NewRepository()
	svc := service.NewService(repo)
	h := handlers.NewHandler(svc)
	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "niira-compulsory-insurance"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)
	log.Println("[niira-compulsory-insurance] starting on :8144 — 11 NIIRA 2025 compulsory classes, July 2026 deadline")
	log.Fatal(http.ListenAndServe(":8144", r))
}
