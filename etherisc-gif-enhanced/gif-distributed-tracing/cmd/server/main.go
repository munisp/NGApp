package main

import (
	"context"
	"encoding/json"
	"gif-distributed-tracing/internal/tracing"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8133"
	}

	svc := tracing.NewTracingService()
	tracing.GenerateSampleTraces(svc)

	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"service": "gif-distributed-tracing",
		})
	}).Methods("GET")

	r.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}).Methods("GET")

	r.HandleFunc("/api/v1/traces/{traceID}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		trace, err := svc.GetTrace(req.Context(), vars["traceID"])
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, trace)
	}).Methods("GET")

	r.HandleFunc("/api/v1/traces", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		serviceName := q.Get("service")
		operationName := q.Get("operation")
		limit := 20
		if l, err := strconv.Atoi(q.Get("limit")); err == nil && l > 0 {
			limit = l
		}
		var minDuration, maxDuration time.Duration
		if d, err := time.ParseDuration(q.Get("min_duration")); err == nil {
			minDuration = d
		}
		if d, err := time.ParseDuration(q.Get("max_duration")); err == nil {
			maxDuration = d
		}

		traces, err := svc.SearchTraces(req.Context(), serviceName, operationName, minDuration, maxDuration, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"traces": traces,
			"total":  len(traces),
		})
	}).Methods("GET")

	r.HandleFunc("/api/v1/spans", func(w http.ResponseWriter, req *http.Request) {
		var span tracing.Span
		if err := json.NewDecoder(req.Body).Decode(&span); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}
		if span.ServiceName == "" || span.OperationName == "" {
			writeError(w, http.StatusBadRequest, "service_name and operation_name are required")
			return
		}
		if err := svc.IngestSpan(req.Context(), &span); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{
			"trace_id": span.TraceID,
			"span_id":  span.SpanID,
			"status":   "ingested",
		})
	}).Methods("POST")

	r.HandleFunc("/api/v1/services", func(w http.ResponseWriter, req *http.Request) {
		services, err := svc.GetServices(req.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"services": services})
	}).Methods("GET")

	r.HandleFunc("/api/v1/services/{name}/metrics", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		metrics, err := svc.GetServiceMetrics(req.Context(), vars["name"])
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, metrics)
	}).Methods("GET")

	r.HandleFunc("/api/v1/dependencies", func(w http.ResponseWriter, req *http.Request) {
		deps, err := svc.GetServiceDependencies(req.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"dependencies": deps,
			"total":        len(deps),
		})
	}).Methods("GET")

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("GIF Distributed Tracing Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]interface{}{
		"error": map[string]interface{}{
			"code":    status,
			"message": message,
		},
	})
}
