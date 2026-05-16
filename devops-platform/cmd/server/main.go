package main

import (
	"fmt"; "log"; "net/http"; "os"
	"devops-platform/internal/handlers"
	"devops-platform/internal/repository"
	"devops-platform/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8115" }
	repo := repository.NewDevOpsRepository()
	svc := service.NewDevOpsService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"devops-platform","version":"2.0.0"}`))
	})
	log.Printf("DevOps Platform v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
