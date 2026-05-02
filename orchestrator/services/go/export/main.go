package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/xuri/excelize/v2"
)

// ExportRequest represents an export request
type ExportRequest struct {
	Type       string                 `json:"type"`        // transactions, refunds, settlements, etc.
	Format     string                 `json:"format"`      // csv, excel
	StartDate  string                 `json:"start_date"`
	EndDate    string                 `json:"end_date"`
	MerchantID int                    `json:"merchant_id,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
}

// ExportResponse represents an export response
type ExportResponse struct {
	FileURL   string `json:"file_url"`
	FileName  string `json:"file_name"`
	RowCount  int    `json:"row_count"`
	ExpiresAt string `json:"expires_at"`
}

var db *sql.DB

func main() {
	// Initialize database connection
	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		db, err = sql.Open("mysql", dbURL)
		if err != nil {
			log.Printf("Failed to connect to database: %v", err)
		} else {
			defer db.Close()
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/export", exportHandler)
	http.HandleFunc("/download", downloadHandler)

	log.Printf("Export Service starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "export-service",
	})
}

func exportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Type == "" || req.Format == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Query data based on type
	data, err := queryData(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query data: %v", err), http.StatusInternalServerError)
		return
	}

	// Generate file based on format
	var fileName string
	var filePath string

	switch req.Format {
	case "csv":
		fileName, filePath, err = generateCSV(req.Type, data)
	case "excel", "xlsx":
		fileName, filePath, err = generateExcel(req.Type, data)
	default:
		http.Error(w, "Unsupported format", http.StatusBadRequest)
		return
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate file: %v", err), http.StatusInternalServerError)
		return
	}

	// In production, upload to S3 and get URL
	fileURL := fmt.Sprintf("https://cdn.payment-switch.com/exports/%s", fileName)

	// Calculate expiry (24 hours from now)
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)

	response := ExportResponse{
		FileURL:   fileURL,
		FileName:  fileName,
		RowCount:  len(data),
		ExpiresAt: expiresAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Query().Get("file")
	if fileName == "" {
		http.Error(w, "Missing file parameter", http.StatusBadRequest)
		return
	}

	// In production, fetch from S3
	// For now, serve from local filesystem
	http.ServeFile(w, r, "/tmp/exports/"+fileName)
}

func queryData(req ExportRequest) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	var query string
	var args []interface{}

	switch req.Type {
	case "transactions":
		query = `SELECT transaction_id, amount, currency, status, created_at, updated_at, 
				 payer_id, payee_id, transaction_type, channel 
				 FROM transactions WHERE created_at BETWEEN ? AND ?`
		args = append(args, req.StartDate, req.EndDate)
		if req.MerchantID > 0 {
			query += " AND merchant_id = ?"
			args = append(args, req.MerchantID)
		}
	case "refunds":
		query = `SELECT refund_id, original_transaction_id, amount, currency, status, 
				 reason, created_at, processed_at 
				 FROM refunds WHERE created_at BETWEEN ? AND ?`
		args = append(args, req.StartDate, req.EndDate)
		if req.MerchantID > 0 {
			query += " AND merchant_id = ?"
			args = append(args, req.MerchantID)
		}
	case "settlements":
		query = `SELECT settlement_id, batch_id, total_amount, currency, status, 
				 transaction_count, created_at, settled_at 
				 FROM settlements WHERE created_at BETWEEN ? AND ?`
		args = append(args, req.StartDate, req.EndDate)
		if req.MerchantID > 0 {
			query += " AND merchant_id = ?"
			args = append(args, req.MerchantID)
		}
	case "accounts":
		query = `SELECT account_id, account_type, currency, balance, status, 
				 created_at, updated_at 
				 FROM accounts WHERE 1=1`
		if req.MerchantID > 0 {
			query += " AND merchant_id = ?"
			args = append(args, req.MerchantID)
		}
	default:
		return nil, fmt.Errorf("unsupported export type: %s", req.Type)
	}

	// Apply additional filters
	if req.Filters != nil {
		if status, ok := req.Filters["status"].(string); ok && status != "" {
			query += " AND status = ?"
			args = append(args, status)
		}
		if currency, ok := req.Filters["currency"].(string); ok && currency != "" {
			query += " AND currency = ?"
			args = append(args, currency)
		}
	}

	query += " ORDER BY created_at DESC LIMIT 10000"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query failed: %v", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %v", err)
	}

	var results []map[string]interface{}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %v", err)
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %v", err)
	}

	return results, nil
}

func generateCSV(dataType string, data []map[string]interface{}) (string, string, error) {
	if len(data) == 0 {
		return "", "", fmt.Errorf("no data to export")
	}

	// Create file
	fileName := fmt.Sprintf("%s_export_%s.csv", dataType, time.Now().Format("20060102_150405"))
	filePath := "/tmp/exports/" + fileName

	// Ensure directory exists
	os.MkdirAll("/tmp/exports", 0755)

	file, err := os.Create(filePath)
	if err != nil {
		return "", "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	var headers []string
	for key := range data[0] {
		headers = append(headers, key)
	}
	writer.Write(headers)

	// Write data
	for _, row := range data {
		var values []string
		for _, header := range headers {
			values = append(values, fmt.Sprintf("%v", row[header]))
		}
		writer.Write(values)
	}

	return fileName, filePath, nil
}

func generateExcel(dataType string, data []map[string]interface{}) (string, string, error) {
	if len(data) == 0 {
		return "", "", fmt.Errorf("no data to export")
	}

	// Create Excel file
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"
	f.SetSheetName("Sheet1", sheetName)

	// Write header
	var headers []string
	col := 1
	for key := range data[0] {
		headers = append(headers, key)
		cell, _ := excelize.CoordinatesToCellName(col, 1)
		f.SetCellValue(sheetName, cell, key)
		col++
	}

	// Write data
	for rowIdx, row := range data {
		for colIdx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheetName, cell, row[header])
		}
	}

	// Save file
	fileName := fmt.Sprintf("%s_export_%s.xlsx", dataType, time.Now().Format("20060102_150405"))
	filePath := "/tmp/exports/" + fileName

	os.MkdirAll("/tmp/exports", 0755)

	if err := f.SaveAs(filePath); err != nil {
		return "", "", err
	}

	return fileName, filePath, nil
}
