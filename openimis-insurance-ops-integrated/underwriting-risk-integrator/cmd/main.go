package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"underwriting-risk-integrator/internal/openimis"
	"underwriting-risk-integrator/internal/service"
	"underwriting-risk-integrator/internal/temporal"
	"underwriting-risk-integrator/pkg/models"
)

func main() {
	// 1. Initialize Temporal Client
	temporalHost := getEnv("TEMPORAL_HOST", client.DefaultHostPort)
	c, err := client.Dial(client.Options{
		HostPort: temporalHost,
	})
	if err != nil {
		log.Fatalln("Unable to create Temporal client", err)
	}
	defer c.Close()

	// 2. Initialize Dependencies — real OpenIMIS HTTP client
	openimisURL := getEnv("OPENIMIS_URL", "http://openimis-service:8001")
	openimisToken := getEnv("OPENIMIS_TOKEN", "")
	openIMISClient := openimis.NewClient(openimisURL, openimisToken)
	activityContext := temporal.NewActivityContext(openIMISClient)
	underwritingService := service.NewUnderwritingService(c)

	// 3. Start Temporal Worker
	w := worker.New(c, service.TaskQueue, worker.Options{})
	w.RegisterWorkflow(temporal.UnderwritingRiskAssessmentWorkflow)
	w.RegisterActivity(activityContext)

	go func() {
		log.Println("Starting Temporal worker...")
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Fatalln("Unable to start Temporal worker", err)
		}
	}()

	// 4. Start Underwriting Risk Assessment API Server
	router := mux.NewRouter()
	router.HandleFunc("/v1/risk-assessment", func(w http.ResponseWriter, r *http.Request) {
		var uc models.UnderwritingCase
		if err := json.NewDecoder(r.Body).Decode(&uc); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Set a unique CaseID if not provided
		if uc.CaseID == "" {
			uc.CaseID = fmt.Sprintf("CASE-%d", time.Now().UnixNano())
		}

		decision, err := underwritingService.StartRiskAssessmentWorkflow(r.Context(), uc)
		if err != nil {
			log.Printf("Workflow failed for case %s: %v", uc.CaseID, err)
			http.Error(w, fmt.Sprintf("Workflow failed: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(decision)

	}).Methods("POST")

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	// 5. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Println("Starting API server on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on :8080: %v\n", err)
		}
	}()

	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exiting")
}

// getEnv returns the value of the environment variable named by key,
// or fallback if the variable is not set.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
