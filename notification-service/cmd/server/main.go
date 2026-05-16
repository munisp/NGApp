package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"notification-service/internal/handlers"
	"notification-service/internal/repository"
	"notification-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8109" }
	repo := repository.NewNotificationRepository()
	svc := service.NewNotificationService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"notification-service","version":"2.0.0"}`))
	})
	log.Printf("Notification Service v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
