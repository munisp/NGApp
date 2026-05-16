package main

import (
	"fmt"; "log"; "net/http"; "os"
	"dr-ha-service/internal/handlers"
	"dr-ha-service/internal/repository"
	"dr-ha-service/internal/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8113" }
	repo := repository.NewDRRepository()
	svc := service.NewDRService(repo)
	h := handlers.NewHandler(svc)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"dr-ha-service","version":"2.0.0"}`))
	})
	log.Printf("DR/HA Service v2.0 starting on port %s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
