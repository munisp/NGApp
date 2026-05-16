package main

import (
	"fmt"; "log"; "net/http"; "os"
	"multi-tenant-platform/internal/handlers"
	"multi-tenant-platform/internal/repository"
	"multi-tenant-platform/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8112" }
	repo := repository.NewTenantRepository()
	svc := service.NewTenantService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"multi-tenant-platform","version":"2.0.0"}`))
	})
	log.Printf("Multi-Tenant Platform v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
