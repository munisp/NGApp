package main

import (
	"digital-consumer-products/internal/handlers"
	"digital-consumer-products/internal/repository"
	"digital-consumer-products/internal/service"
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
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "digital-consumer-products"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)
	log.Println("[digital-consumer-products] starting on :8142 — 8 consumer product lines")
	log.Fatal(http.ListenAndServe(":8142", r))
}
