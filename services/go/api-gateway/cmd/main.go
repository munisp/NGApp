// Oil & Gas RMM Platform — API Gateway
// Design: Operational Command Dark Amber Dashboard
// Role: Central HTTP/WebSocket gateway; routes to downstream microservices,
//       enforces JWT auth (Keycloak OIDC), rate-limits, and provides
//       WebSocket relay for real-time alarm streams.
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/og-rmm/api-gateway/internal/auth"
	"github.com/og-rmm/api-gateway/internal/middleware"
	"github.com/og-rmm/api-gateway/internal/ws"
)

// ServiceRoutes maps URL prefixes to upstream service addresses.
var ServiceRoutes = map[string]string{
	"/api/v1/wells":     "http://well-management:8081",
	"/api/v1/telemetry": "http://telemetry-ingestion:8082",
	"/api/v1/financial": "http://financial-ledger:8083",
	"/api/v1/alarms":    "http://alarm-manager:8084",
	"/api/v1/analytics": "http://analytics:8085",
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	keycloakURL := getEnv("KEYCLOAK_URL", "http://keycloak:8080")
	realm := getEnv("KEYCLOAK_REALM", "og-rmm")
	port := getEnv("PORT", "8080")

	// JWT verifier (Keycloak OIDC)
	jwtVerifier := auth.NewKeycloakVerifier(keycloakURL, realm)

	mux := http.NewServeMux()

	// Health check — unauthenticated
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "api-gateway",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// WebSocket relay for real-time alarm stream
	hub := ws.NewHub()
	go hub.Run()
	mux.Handle("/api/v1/stream/alarms", middleware.Chain(
		http.HandlerFunc(hub.ServeWS),
		middleware.CORS(),
		middleware.JWT(jwtVerifier),
	))

	// Reverse-proxy routes
	var proxyMu sync.RWMutex
	proxies := make(map[string]*httputil.ReverseProxy)
	for prefix, target := range ServiceRoutes {
		t, _ := url.Parse(target)
		proxies[prefix] = httputil.NewSingleHostReverseProxy(t)
	}

	mux.HandleFunc("/api/v1/", func(w http.ResponseWriter, r *http.Request) {
		// Find matching upstream
		proxyMu.RLock()
		var matched *httputil.ReverseProxy
		var matchedPrefix string
		for prefix, proxy := range proxies {
			if strings.HasPrefix(r.URL.Path, prefix) {
				if len(prefix) > len(matchedPrefix) {
					matchedPrefix = prefix
					matched = proxy
				}
			}
		}
		proxyMu.RUnlock()

		if matched == nil {
			http.Error(w, `{"error":"route not found"}`, http.StatusNotFound)
			return
		}

		// Apply middleware chain: CORS → rate-limit → JWT → proxy
		handler := middleware.Chain(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				matched.ServeHTTP(w, r)
			}),
			middleware.CORS(),
			middleware.RateLimit(1000, time.Minute),
			middleware.JWT(jwtVerifier),
			middleware.RequestID(),
			middleware.Logger(),
		)
		handler.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		slog.Info("API Gateway starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	slog.Info("API Gateway stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
