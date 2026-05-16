package main

import (
	"fmt"; "log"; "net/http"; "os"
	"pan-african-ekyc/internal/handlers"
	"pan-african-ekyc/internal/repository"
	"pan-african-ekyc/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8106" }
	repo := repository.NewEKYCRepository()
	svc := service.NewEKYCService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"pan-african-ekyc","version":"2.0.0"}`))
	})
	log.Printf("Pan-African eKYC v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
