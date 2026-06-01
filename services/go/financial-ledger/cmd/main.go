// Oil & Gas RMM Platform — Financial Ledger Service
// Integrates TigerBeetle for immutable double-entry production accounting
// and Mojaloop for automated royalty payment settlement.
// Metadata and audit trails stored in PostgreSQL.
// Spec: FRQ-010 — 10K+ transfers/sec; FRQ-011 — Mojaloop royalty routing
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

	"github.com/og-rmm/financial-ledger/internal/db"
	"github.com/og-rmm/financial-ledger/internal/handlers"
	"github.com/og-rmm/financial-ledger/internal/ledger"
	"github.com/og-rmm/financial-ledger/internal/mojaloop"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := getEnv("PORT", "8083")
	pgDSN := getEnv("DATABASE_URL", "postgres://og_rmm:og_rmm_pass@postgres:5432/og_rmm?sslmode=disable")
	tbAddresses := getEnv("TIGERBEETLE_ADDRESSES", "tigerbeetle-0.tigerbeetle:3000,tigerbeetle-1.tigerbeetle:3000,tigerbeetle-2.tigerbeetle:3000")
	mojaloopURL := getEnv("MOJALOOP_URL", "http://mojaloop-switch:3001")

	// PostgreSQL for audit trail and metadata
	pool, err := db.NewPool(context.Background(), pgDSN)
	if err != nil {
		slog.Error("PostgreSQL connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.RunMigrations(context.Background(), pool); err != nil {
		slog.Error("financial migrations failed", "err", err)
		os.Exit(1)
	}

	// TigerBeetle client for high-performance double-entry ledger
	tbClient := ledger.NewTigerBeetleClient(tbAddresses)
	defer tbClient.Close()

	// Mojaloop client for inter-party settlements
	mojClient := mojaloop.NewClient(mojaloopURL)

	h := handlers.NewFinancialHandler(pool, tbClient, mojClient)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "financial-ledger",
		})
	})

	// Account management
	mux.HandleFunc("POST /api/v1/financial/accounts", h.CreateAccount)
	mux.HandleFunc("GET /api/v1/financial/accounts/{id}", h.GetAccount)
	mux.HandleFunc("GET /api/v1/financial/accounts/{id}/balance", h.GetBalance)

	// Production recording
	mux.HandleFunc("POST /api/v1/financial/production", h.RecordProduction)

	// Transfers
	mux.HandleFunc("POST /api/v1/financial/transfers", h.CreateTransfer)
	mux.HandleFunc("GET /api/v1/financial/transfers", h.ListTransfers)

	// Royalty distribution
	mux.HandleFunc("POST /api/v1/financial/royalties/distribute", h.DistributeRoyalties)
	mux.HandleFunc("GET /api/v1/financial/royalties/schedule", h.GetRoyaltySchedule)

	// Production accounting
	mux.HandleFunc("GET /api/v1/financial/production/summary", h.GetProductionSummary)
	mux.HandleFunc("GET /api/v1/financial/wells/{id}/ledger", h.GetWellLedger)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("Financial Ledger Service starting", "port", port)
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
	slog.Info("Financial Ledger Service stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
