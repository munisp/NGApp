// ERP Connector Service — SAP S/4HANA + Oracle ERP Integration
// Spec: §13 — ERP integration for financial reconciliation and work orders
//
// This service bridges the OG-RMM platform with enterprise ERP systems:
//   - SAP S/4HANA: Work orders (PM module), cost centers, GL postings
//   - Oracle ERP Cloud: Financial reconciliation, purchase orders, assets
//
// Exposes a REST API consumed by the main platform's erp tRPC router.

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

	"og-rmm-platform/services/go/erp-connector/internal/oracle"
	"og-rmm-platform/services/go/erp-connector/internal/sap"
)

const defaultPort = "8095"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	sapClient := sap.NewClient(
		os.Getenv("SAP_BASE_URL"),
		os.Getenv("SAP_USERNAME"),
		os.Getenv("SAP_PASSWORD"),
		os.Getenv("SAP_CLIENT"),
	)

	oracleClient := oracle.NewClient(
		os.Getenv("ORACLE_BASE_URL"),
		os.Getenv("ORACLE_CLIENT_ID"),
		os.Getenv("ORACLE_CLIENT_SECRET"),
	)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "erp-connector"})
	})

	// SAP endpoints
	mux.HandleFunc("/sap/work-orders", handleSAPWorkOrders(sapClient))
	mux.HandleFunc("/sap/work-orders/create", handleCreateSAPWorkOrder(sapClient))
	mux.HandleFunc("/sap/cost-centers", handleSAPCostCenters(sapClient))
	mux.HandleFunc("/sap/gl-postings", handleSAPGLPostings(sapClient))
	mux.HandleFunc("/sap/materials", handleSAPMaterials(sapClient))

	// Oracle endpoints
	mux.HandleFunc("/oracle/purchase-orders", handleOraclePOs(oracleClient))
	mux.HandleFunc("/oracle/assets", handleOracleAssets(oracleClient))
	mux.HandleFunc("/oracle/invoices", handleOracleInvoices(oracleClient))
	mux.HandleFunc("/oracle/reconcile", handleOracleReconcile(oracleClient))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      loggingMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	log.Printf("[ERP-Connector] Starting on port %s", port)
	log.Printf("[ERP-Connector] SAP: %s | Oracle: %s",
		os.Getenv("SAP_BASE_URL"), os.Getenv("ORACLE_BASE_URL"))

	// Graceful shutdown on SIGINT/SIGTERM
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[ERP-Connector] Server error: %v", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[ERP-Connector] Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[ERP-Connector] Shutdown error: %v", err)
	}
	log.Println("[ERP-Connector] Stopped")
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[ERP-Connector] %s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ─── SAP Handlers ─────────────────────────────────────────────────────────────

func handleSAPWorkOrders(client *sap.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "GET only")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		wellID := r.URL.Query().Get("wellId")
		orders, err := client.GetWorkOrders(ctx, wellID)
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("SAP error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, orders)
	}
}

func handleCreateSAPWorkOrder(client *sap.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST only")
			return
		}
		var req sap.CreateWorkOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		result, err := client.CreateWorkOrder(ctx, req)
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("SAP error: %v", err))
			return
		}
		writeJSON(w, http.StatusCreated, result)
	}
}

func handleSAPCostCenters(client *sap.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		centers, err := client.GetCostCenters(ctx)
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("SAP error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, centers)
	}
}

func handleSAPGLPostings(client *sap.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		postings, err := client.GetGLPostings(ctx, r.URL.Query().Get("from"), r.URL.Query().Get("to"))
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("SAP error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, postings)
	}
}

func handleSAPMaterials(client *sap.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		materials, err := client.GetMaterials(ctx, r.URL.Query().Get("plant"))
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("SAP error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, materials)
	}
}

// ─── Oracle Handlers ──────────────────────────────────────────────────────────

func handleOraclePOs(client *oracle.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		pos, err := client.GetPurchaseOrders(ctx, r.URL.Query().Get("status"))
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("Oracle error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, pos)
	}
}

func handleOracleAssets(client *oracle.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		assets, err := client.GetAssets(ctx, r.URL.Query().Get("category"))
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("Oracle error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, assets)
	}
}

func handleOracleInvoices(client *oracle.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		invoices, err := client.GetInvoices(ctx, r.URL.Query().Get("from"), r.URL.Query().Get("to"))
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("Oracle error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, invoices)
	}
}

func handleOracleReconcile(client *oracle.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST only")
			return
		}
		var req oracle.ReconcileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
		defer cancel()
		result, err := client.Reconcile(ctx, req)
		if err != nil {
			writeError(w, http.StatusBadGateway, fmt.Sprintf("Oracle error: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
