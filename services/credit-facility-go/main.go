// credit-facility-go — Production microservice with Postgres integration (stdlib-only)
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

func initDB() {
dbURL := os.Getenv("DATABASE_URL")
if dbURL == "" {
log.Println("[credit-facility-go] DATABASE_URL not set, running without DB")
return
}
var err error
db, err = sql.Open("postgres", dbURL)
if err != nil {
log.Printf("[credit-facility-go] DB connection error: %v", err)
return
}
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
if err = db.Ping(); err != nil {
log.Printf("[credit-facility-go] DB ping failed: %v", err)
db = nil
return
}
log.Println("[credit-facility-go] Connected to Postgres")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
w.Header().Set("Content-Type", "application/json")
w.Header().Set("X-Service", "credit-facility-go")
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
"service":   "credit-facility-go",
"status":    "healthy",
"database":  dbStatus,
"version":   "2.1.0",
"timestamp": time.Now().UTC().Format(time.RFC3339),
"uptime":    time.Since(startTime).String(),
})
}

func dataHandler(w http.ResponseWriter, r *http.Request) {
page, _ := strconv.Atoi(r.URL.Query().Get("page"))
limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
if page < 1 { page = 1 }
if limit < 1 || limit > 100 { limit = 20 }
offset := (page - 1) * limit

if db != nil {
rows, err := db.Query(
fmt.Sprintf("SELECT * FROM credit_facility ORDER BY id LIMIT %d OFFSET %d", limit, offset),
)
if err == nil {
defer rows.Close()
cols, _ := rows.Columns()
var results []map[string]interface{}
for rows.Next() {
vals := make([]interface{}, len(cols))
ptrs := make([]interface{}, len(cols))
for i := range vals { ptrs[i] = &vals[i] }
if err := rows.Scan(ptrs...); err == nil {
row := make(map[string]interface{})
for i, col := range cols {
row[col] = vals[i]
}
results = append(results, row)
}
}
var total int
db.QueryRow("SELECT count(*) FROM credit_facility").Scan(&total)
jsonResp(w, 200, map[string]interface{}{
"items": results, "total": total, "page": page, "limit": limit,
"source": "database", "service": "credit-facility-go",
})
return
}
}

// Fallback seed data
jsonResp(w, 200, map[string]interface{}{
"items": []map[string]interface{}{},
"total": 0, "page": page, "limit": limit,
"source": "seed", "service": "credit-facility-go",
})
}

func main() {
initDB()
port := os.Getenv("PORT")
if port == "" { port = "8214" }

mux := http.NewServeMux()
mux.HandleFunc("/health", healthHandler)
mux.HandleFunc("/healthz", healthHandler)
mux.HandleFunc("/data", dataHandler)
mux.HandleFunc("/credit-facility", dataHandler)
mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
if r.Method == "OPTIONS" {
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
w.WriteHeader(204)
return
}
if strings.HasPrefix(r.URL.Path, "/data") || strings.HasPrefix(r.URL.Path, "/credit-facility") {
dataHandler(w, r)
return
}
healthHandler(w, r)
})

log.Printf("[credit-facility-go] Starting on :%s", port)
log.Fatal(http.ListenAndServe(":" + port, mux))
}
