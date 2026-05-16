package main

import (
	"fmt"; "log"; "net/http"; "os"
	"multi-country-regulatory/internal/handlers"
	"multi-country-regulatory/internal/repository"
	"multi-country-regulatory/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8105" }
	repo := repository.NewRegulatoryRepository()
	svc := service.NewRegulatoryService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"multi-country-regulatory","version":"2.0.0"}`))
	})
	log.Printf("Multi-Country Regulatory Service v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
