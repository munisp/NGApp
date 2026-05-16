package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"multi-language-service/internal/handlers"
	"multi-language-service/internal/repository"
	"multi-language-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8108" }
	repo := repository.NewI18nRepository()
	svc := service.NewI18nService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"multi-language-service","version":"2.0.0"}`))
	})
	log.Printf("Multi-Language Service v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
