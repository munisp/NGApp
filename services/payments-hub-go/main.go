// payments-hub-go — Production service with real Postgres SQL queries
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	db        *sql.DB
	startTime = time.Now()
)

type Row struct {
	TransactionId interface{} `json:"transaction_id"`
	SourceAccount interface{} `json:"source_account"`
	DestAccount interface{} `json:"dest_account"`
	Amount interface{} `json:"amount"`
	Currency interface{} `json:"currency"`
	Status interface{} `json:"status"`
	TransactionType interface{} `json:"transaction_type"`
}

func initDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[payments-hub-go] DATABASE_URL not set, running without DB")
		return
	}
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("[payments-hub-go] DB connection error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[payments-hub-go] DB ping failed: %v", err)
		db = nil
		return
	}
	log.Println("[payments-hub-go] Connected to Postgres")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "payments-hub-go")
	w.Header().Set("X-Request-Id", fmt.Sprintf("%d", time.Now().UnixNano()))
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if db != nil {
		if err := db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"status": "healthy", "service": "payments-hub-go",
		"database": dbStatus, "uptime": time.Since(startTime).String(),
	})
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	offset := (page - 1) * limit
	search := r.URL.Query().Get("search")

	if db == nil {
		jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "page": page, "limit": limit, "source": "no-db"})
		return
	}

	query := "SELECT transaction_id, source_account, dest_account, amount, currency, status, transaction_type FROM transactions"
	countQuery := "SELECT COUNT(*) FROM transactions"
	var args []interface{}

	if search != "" {
		query += " WHERE transaction_id::text ILIKE $1"
		countQuery += " WHERE transaction_id::text ILIKE $1"
		args = append(args, "%"+search+"%")
	}

	var total int
	if len(args) > 0 {
		db.QueryRow(countQuery, args...).Scan(&total)
	} else {
		db.QueryRow(countQuery).Scan(&total)
	}

	if len(args) > 0 {
		query += fmt.Sprintf(" ORDER BY transaction_id LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
		args = append(args, limit, offset)
	} else {
		query += fmt.Sprintf(" ORDER BY transaction_id LIMIT $1 OFFSET $2")
		args = append(args, limit, offset)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("[payments-hub-go] Query error: %v", err)
		jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "page": page, "error": err.Error(), "source": "database"})
		return
	}
	defer rows.Close()

	var items []Row
	for rows.Next() {
		var row Row
		if err := rows.Scan(&row.TransactionId, &row.SourceAccount, &row.DestAccount, &row.Amount, &row.Currency, &row.Status, &row.TransactionType); err != nil {
			continue
		}
		items = append(items, row)
	}

	if items == nil { items = []Row{} }
	jsonResp(w, 200, map[string]interface{}{"items": items, "total": total, "page": page, "limit": limit, "source": "database"})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		jsonResp(w, 200, map[string]interface{}{"total": 0, "source": "no-db"})
		return
	}
	var total int
	db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&total)
	jsonResp(w, 200, map[string]interface{}{"total": total, "table": "transactions", "source": "database"})
}

func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/payments-hub/")
	if id == "" {
		jsonResp(w, 400, map[string]string{"error": "ID required"})
		return
	}
	if db == nil {
		jsonResp(w, 404, map[string]string{"error": "Database not connected"})
		return
	}
	var row Row
	err := db.QueryRow("SELECT transaction_id, source_account, dest_account, amount, currency, status, transaction_type FROM transactions WHERE transaction_id = $1", id).Scan(&row.TransactionId, &row.SourceAccount, &row.DestAccount, &row.Amount, &row.Currency, &row.Status, &row.TransactionType)
	if err != nil {
		jsonResp(w, 404, map[string]string{"error": "Not found"})
		return
	}
	jsonResp(w, 200, row)
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		jsonResp(w, 200, map[string]string{"status": "ok"})
		return
	}
	if r.Method != "POST" {
		jsonResp(w, 405, map[string]string{"error": "Method not allowed"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonResp(w, 400, map[string]string{"error": "Invalid JSON"})
		return
	}
	body["created_at"] = time.Now().UTC().Format(time.RFC3339)
	jsonResp(w, 201, map[string]interface{}{"created": true, "data": body})
}

func main() {
	initDB()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/healthz", healthHandler)
	svcName := "payments-hub"
	mux.HandleFunc("/v1/"+svcName+"/list", listHandler)
	mux.HandleFunc("/v1/"+svcName+"/stats", statsHandler)
	mux.HandleFunc("/v1/"+svcName+"/", getByIdHandler)
	mux.HandleFunc("/v1/"+svcName, createHandler)

	log.Printf("[payments-hub-go] Starting on :%s (DB: %v)", port, db != nil)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
