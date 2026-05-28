// Oil & Gas RMM Platform — Well Management Service
// Manages the well registry, equipment catalog, and operational status.
// Database: PostgreSQL (pgx/v5 driver)
// Spec: GET /api/v1/wells, POST /api/v1/wells, PATCH /api/v1/wells/{id}/status
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/og-rmm/well-management/internal/db"
	"github.com/og-rmm/well-management/internal/handlers"
	"github.com/og-rmm/well-management/internal/repository"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	dsn := getEnv("DATABASE_URL",
		"postgres://og_rmm:og_rmm_pass@postgres:5432/og_rmm?sslmode=disable")
	port := getEnv("PORT", "8081")

	// Connect to PostgreSQL
	pool, err := db.NewPool(context.Background(), dsn)
	if err != nil {
		slog.Error("failed to connect to PostgreSQL", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to PostgreSQL")

	// Run migrations
	if err := db.RunMigrations(context.Background(), pool); err != nil {
		slog.Error("migration failed", "err", err)
		os.Exit(1)
	}

	repo := repository.NewWellRepository(pool)
	h := handlers.NewWellHandler(repo)

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "well-management"})
	})

	// Well CRUD
	mux.HandleFunc("GET /api/v1/wells", h.ListWells)
	mux.HandleFunc("POST /api/v1/wells", h.CreateWell)
	mux.HandleFunc("GET /api/v1/wells/{id}", h.GetWell)
	mux.HandleFunc("PUT /api/v1/wells/{id}", h.UpdateWell)
	mux.HandleFunc("DELETE /api/v1/wells/{id}", h.DeleteWell)
	mux.HandleFunc("PATCH /api/v1/wells/{id}/status", h.UpdateWellStatus)

	// Equipment
	mux.HandleFunc("GET /api/v1/wells/{id}/equipment", h.ListEquipment)
	mux.HandleFunc("POST /api/v1/wells/{id}/equipment", h.AddEquipment)

	// Operators / Tenants
	mux.HandleFunc("GET /api/v1/operators", h.ListOperators)
	mux.HandleFunc("POST /api/v1/operators", h.CreateOperator)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("Well Management Service starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	slog.Info("Well Management Service stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
