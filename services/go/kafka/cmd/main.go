package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/unified-platform/services/kafka/internal"
)

func main() {
	cfg := internal.LoadConfig()
	client, err := internal.NewKafkaClient(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Kafka] Failed to initialize: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	client.RegisterDefaultConsumers()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		status := client.Health()
		w.Header().Set("Content-Type", "application/json")
		if !status.Connected {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(status)
	})

	mux.HandleFunc("/produce", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req internal.ProduceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := client.Produce(req.Topic, req.Key, req.Value, req.Headers); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "produced"})
	})

	mux.HandleFunc("/topics", func(w http.ResponseWriter, r *http.Request) {
		topics := client.ListTopics()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(topics)
	})

	mux.HandleFunc("/dlq", func(w http.ResponseWriter, r *http.Request) {
		messages := client.GetDeadLetterQueue()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	})

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		metrics := client.GetMetrics()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(metrics)
	})

	port := os.Getenv("KAFKA_SERVICE_PORT")
	if port == "" {
		port = "8081"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		fmt.Printf("[Kafka] Service listening on :%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "[Kafka] Server error: %v\n", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("[Kafka] Shutting down...")
	server.Close()
}
