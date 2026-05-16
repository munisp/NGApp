package main

import (
	"fmt"; "log"; "net/http"; "os"
	"api-marketplace/internal/handlers"
	"api-marketplace/internal/repository"
	"api-marketplace/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8111" }
	repo := repository.NewMarketplaceRepository()
	svc := service.NewMarketplaceService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"api-marketplace","version":"2.0.0"}`))
	})
	log.Printf("API Marketplace v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
