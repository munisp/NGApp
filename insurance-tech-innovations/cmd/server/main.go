package main

import (
	"encoding/json"
	"insurance-tech-innovations/internal/handlers"
	"insurance-tech-innovations/internal/service"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	svc := service.NewService()
	h := handlers.NewHandler(svc)
	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "insurance-tech-innovations"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")
	h.RegisterRoutes(r)
	log.Println("[insurance-tech-innovations] starting on :8145 — AI pricing, instant claims, gamification, P2P, product builder")
	log.Fatal(http.ListenAndServe(":8145", r))
}
