package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/unified-platform/services/kubernetes/internal"
)

func main() {
	cfg := internal.LoadConfig()
	client, err := internal.NewK8sClient(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[K8s] Failed to initialize: %v\n", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.Health())
	})

	mux.HandleFunc("/namespaces", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.ListNamespaces())
	})

	mux.HandleFunc("/deployments", func(w http.ResponseWriter, r *http.Request) {
		ns := r.URL.Query().Get("namespace")
		if ns == "" {
			ns = "default"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.ListDeployments(ns))
	})

	mux.HandleFunc("/deployments/scale", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req internal.ScaleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if err := client.ScaleDeployment(req.Namespace, req.Name, req.Replicas); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "scaled"})
	})

	mux.HandleFunc("/deployments/restart", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Namespace string `json:"namespace"`
			Name      string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if err := client.RestartDeployment(req.Namespace, req.Name); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "restarting"})
	})

	mux.HandleFunc("/pods", func(w http.ResponseWriter, r *http.Request) {
		ns := r.URL.Query().Get("namespace")
		if ns == "" {
			ns = "default"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.ListPods(ns))
	})

	mux.HandleFunc("/pods/logs", func(w http.ResponseWriter, r *http.Request) {
		ns := r.URL.Query().Get("namespace")
		name := r.URL.Query().Get("name")
		logs := client.GetPodLogs(ns, name)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"logs": logs})
	})

	mux.HandleFunc("/services", func(w http.ResponseWriter, r *http.Request) {
		ns := r.URL.Query().Get("namespace")
		if ns == "" {
			ns = "default"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.ListServices(ns))
	})

	mux.HandleFunc("/nodes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.ListNodes())
	})

	mux.HandleFunc("/metrics/cluster", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.GetClusterMetrics())
	})

	mux.HandleFunc("/hpa", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			ns := r.URL.Query().Get("namespace")
			if ns == "" {
				ns = "default"
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(client.ListHPAs(ns))
		case http.MethodPost:
			var req internal.HPARequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				return
			}
			if err := client.CreateHPA(req); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"status": "created"})
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	port := os.Getenv("K8S_SERVICE_PORT")
	if port == "" {
		port = "8088"
	}

	server := &http.Server{Addr: ":" + port, Handler: mux}
	go func() {
		fmt.Printf("[K8s] Service listening on :%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "[K8s] Server error: %v\n", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	fmt.Println("[K8s] Shutting down...")
	server.Close()
}
