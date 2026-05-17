package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/etherisc/facultative-reinsurance-service/internal/api"
	"github.com/etherisc/facultative-reinsurance-service/internal/repo"
	"github.com/etherisc/facultative-reinsurance-service/internal/service"
	"github.com/etherisc/facultative-reinsurance-service/internal/temporal"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	// 1. Initialize Temporal Client
	// Temporal is assumed to be running and accessible via environment variables
	c, err := client.Dial(client.Options{
		HostPort:  os.Getenv("TEMPORAL_HOST_PORT"), // e.g., "localhost:7233"
		Namespace: os.Getenv("TEMPORAL_NAMESPACE"), // e.g., "default"
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	// 2. Initialize Repository and Service
	repository := repo.NewMockRepository() // Using mock for now
	reinsuranceService := service.NewReinsuranceService(repository, c)

	// 3. Setup Temporal Worker
	w := worker.New(c, temporal.TaskQueue, worker.Options{})
	w.RegisterWorkflow(temporal.FacultativeReinsuranceWorkflow)
	w.RegisterWorkflow(temporal.CedeClaimWorkflow)
	w.RegisterActivity(temporal.NewActivities(reinsuranceService))

	// Start worker in a goroutine
	go func() {
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Printf("Temporal Worker failed: %v", err)
		}
	}()
	log.Println("Temporal Worker started.")

	// 4. Setup HTTP Server (API and Metrics)
	router := api.NewRouter(reinsuranceService, c)
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	// Start HTTP server in a goroutine
	go func() {
		log.Printf("HTTP Server listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP Server failed: %v", err)
		}
	}()

	// 5. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Stop Temporal Worker
	w.Stop()
	log.Println("Temporal Worker stopped.")

	// Shutdown HTTP Server
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server gracefully stopped.")
}
