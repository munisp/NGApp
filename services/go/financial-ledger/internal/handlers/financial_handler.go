// Package handlers provides HTTP handlers for the Financial Ledger Service.
package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/og-rmm/financial-ledger/internal/ledger"
	"github.com/og-rmm/financial-ledger/internal/mojaloop"
)

// FinancialHandler handles financial HTTP endpoints.
type FinancialHandler struct {
	pool      *pgxpool.Pool
	tbClient  *ledger.TigerBeetleClient
	mojClient *mojaloop.Client
}

// NewFinancialHandler creates a new handler.
func NewFinancialHandler(
	pool *pgxpool.Pool,
	tbClient *ledger.TigerBeetleClient,
	mojClient *mojaloop.Client,
) *FinancialHandler {
	return &FinancialHandler{pool: pool, tbClient: tbClient, mojClient: mojClient}
}

// CreateAccount handles POST /api/v1/financial/accounts
func (h *FinancialHandler) CreateAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WellID      string `json:"well_id"`
		AccountType string `json:"account_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Parse well_id to uint64 for TigerBeetle
	wellIDNum := hashStringToUint64(req.WellID)
	if err := h.tbClient.CreateProductionAccount(r.Context(), wellIDNum); err != nil {
		writeError(w, http.StatusInternalServerError, "account creation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"well_id":       req.WellID,
		"tb_account_id": wellIDNum,
		"status":        "created",
	})
}

// GetAccount handles GET /api/v1/financial/accounts/{id}
func (h *FinancialHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetBalance handles GET /api/v1/financial/accounts/{id}/balance
func (h *FinancialHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	accountID := r.PathValue("id")
	acct, err := h.tbClient.GetAccountBalance(r.Context(), hashStringToUint64(accountID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"account_id":      accountID,
		"credits_posted":  acct.CreditsPosted,
		"debits_posted":   acct.DebitsPosted,
		"balance":         acct.Balance(),
		"ledger":          acct.Ledger,
	})
}

// RecordProduction handles POST /api/v1/financial/production
func (h *FinancialHandler) RecordProduction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WellID         string    `json:"well_id"`
		VolumeBarrels  uint64    `json:"volume_barrels"`
		PricePerBarrel uint64    `json:"price_per_barrel_cents"`
		Date           string    `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	event := ledger.ProductionEvent{
		WellID:         hashStringToUint64(req.WellID),
		VolumeBarrels:  req.VolumeBarrels,
		PricePerBarrel: req.PricePerBarrel,
		Timestamp:      time.Now().UTC(),
	}

	transfer, err := h.tbClient.RecordProduction(r.Context(), event)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "production recording failed: "+err.Error())
		return
	}

	// Also persist to PostgreSQL for audit trail
	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO production_records (well_id, production_date, oil_barrels, gross_revenue_cents, tb_transfer_id)
		 VALUES ($1::uuid, $2::date, $3, $4, $5)
		 ON CONFLICT (well_id, production_date) DO UPDATE
		 SET oil_barrels = production_records.oil_barrels + EXCLUDED.oil_barrels,
		     gross_revenue_cents = production_records.gross_revenue_cents + EXCLUDED.gross_revenue_cents`,
		req.WellID,
		req.Date,
		float64(req.VolumeBarrels),
		req.VolumeBarrels*req.PricePerBarrel,
		int64(transfer.ID),
	)
	if err != nil {
		slog.Error("PostgreSQL production insert failed", "err", err)
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"transfer_id":    transfer.ID,
		"well_id":        req.WellID,
		"volume_barrels": req.VolumeBarrels,
		"recorded_at":    transfer.Timestamp,
	})
}

// CreateTransfer handles POST /api/v1/financial/transfers
func (h *FinancialHandler) CreateTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DebitAccountID  uint64 `json:"debit_account_id"`
		CreditAccountID uint64 `json:"credit_account_id"`
		Amount          uint64 `json:"amount"`
		Ledger          uint32 `json:"ledger"`
		Code            uint16 `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "transfer_queued"})
}

// ListTransfers handles GET /api/v1/financial/transfers
func (h *FinancialHandler) ListTransfers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT record_id, well_id, production_date, oil_barrels, gross_revenue_cents, verified, created_at
		 FROM production_records ORDER BY production_date DESC LIMIT 50`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, wellID string
		var date string
		var oilBbls float64
		var revCents int64
		var verified bool
		var createdAt time.Time
		if err := rows.Scan(&id, &wellID, &date, &oilBbls, &revCents, &verified, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{
			"record_id":            id,
			"well_id":              wellID,
			"production_date":      date,
			"oil_barrels":          oilBbls,
			"gross_revenue_cents":  revCents,
			"verified":             verified,
			"created_at":           createdAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": records})
}

// DistributeRoyalties handles POST /api/v1/financial/royalties/distribute
func (h *FinancialHandler) DistributeRoyalties(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WellID          string                  `json:"well_id"`
		RevenueAccountID uint64                 `json:"revenue_account_id"`
		Shares          []ledger.RoyaltyShare   `json:"shares"`
		Payments        []mojaloop.RoyaltyPayment `json:"payments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Step 1: TigerBeetle atomic transfers
	if err := h.tbClient.DistributeRoyalty(r.Context(), req.RevenueAccountID, req.Shares); err != nil {
		writeError(w, http.StatusInternalServerError, "TigerBeetle distribution failed: "+err.Error())
		return
	}

	// Step 2: Mojaloop payment initiation
	succeeded, err := h.mojClient.BatchRoyaltyPayments(r.Context(), req.Payments)
	if err != nil {
		slog.Error("Mojaloop batch payment error", "err", err)
	}

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"well_id":             req.WellID,
		"shares_distributed":  len(req.Shares),
		"payments_initiated":  succeeded,
		"status":              "processing",
	})
}

// GetRoyaltySchedule handles GET /api/v1/financial/royalties/schedule
func (h *FinancialHandler) GetRoyaltySchedule(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT schedule_id, well_id, owner_name, royalty_percentage, effective_from, effective_to
		 FROM royalty_schedules ORDER BY well_id, effective_from`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var schedules []map[string]interface{}
	for rows.Next() {
		var id, wellID, ownerName string
		var pct float64
		var from string
		var to *string
		if err := rows.Scan(&id, &wellID, &ownerName, &pct, &from, &to); err != nil {
			continue
		}
		schedules = append(schedules, map[string]interface{}{
			"schedule_id":        id,
			"well_id":            wellID,
			"owner_name":         ownerName,
			"royalty_percentage": pct,
			"effective_from":     from,
			"effective_to":       to,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": schedules})
}

// GetProductionSummary handles GET /api/v1/financial/production/summary
func (h *FinancialHandler) GetProductionSummary(w http.ResponseWriter, r *http.Request) {
	row := h.pool.QueryRow(r.Context(),
		`SELECT COUNT(*) as wells, COALESCE(SUM(oil_barrels), 0) as total_bbls,
		        COALESCE(SUM(gross_revenue_cents), 0) as total_revenue_cents
		 FROM production_records WHERE verified = true`)

	var wells int
	var totalBbls float64
	var totalRevCents int64
	row.Scan(&wells, &totalBbls, &totalRevCents)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"verified_wells":       wells,
		"total_barrels":        totalBbls,
		"total_revenue_cents":  totalRevCents,
		"total_revenue_usd":    float64(totalRevCents) / 100.0,
	})
}

// GetWellLedger handles GET /api/v1/financial/wells/{id}/ledger
func (h *FinancialHandler) GetWellLedger(w http.ResponseWriter, r *http.Request) {
	wellID := r.PathValue("id")
	rows, err := h.pool.Query(r.Context(),
		`SELECT record_id, production_date, oil_barrels, gross_revenue_cents, verified, created_at
		 FROM production_records WHERE well_id = $1::uuid
		 ORDER BY production_date DESC LIMIT 90`,
		wellID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, date string
		var oilBbls float64
		var revCents int64
		var verified bool
		var createdAt time.Time
		if err := rows.Scan(&id, &date, &oilBbls, &revCents, &verified, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{
			"record_id":           id,
			"production_date":     date,
			"oil_barrels":         oilBbls,
			"gross_revenue_cents": revCents,
			"verified":            verified,
			"created_at":          createdAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"well_id": wellID,
		"ledger":  records,
	})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"error": msg, "code": code})
}

// hashStringToUint64 converts a UUID string to uint64 for TigerBeetle.
func hashStringToUint64(s string) uint64 {
	var h uint64 = 14695981039346656037
	for i := 0; i < len(s); i++ {
		h ^= uint64(s[i])
		h *= 1099511628211
	}
	return h
}
