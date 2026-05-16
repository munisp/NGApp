package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"takaful-module/internal/handlers"
	"takaful-module/internal/repository"
	"takaful-module/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8098"
	}

	repo := repository.NewTakafulRepository()
	svc := service.NewTakafulService(repo)
	handler := handlers.NewHandler(svc)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"takaful-module","version":"2.0.0"}`))
	})

	log.Printf("Takaful Module v2.0 starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}
