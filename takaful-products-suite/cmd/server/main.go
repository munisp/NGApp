package main

import (
	"encoding/json"
	"log"
	"net/http"
	"takaful-products-suite/internal/handlers"
	"takaful-products-suite/internal/repository"
	"takaful-products-suite/internal/service"

	"github.com/gorilla/mux"
)

func main() {
	repo := repository.NewRepository()
	svc := service.NewService(repo)
	h := handlers.NewHandler(svc)
	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "takaful-products-suite"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)
	log.Println("[takaful-products-suite] starting on :8143 — 6 Sharia-compliant products, 6 pools")
	log.Fatal(http.ListenAndServe(":8143", r))
}
