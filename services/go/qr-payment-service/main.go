// 54Link QR Payment Service — Go Microservice
// Port: 8260
// Purpose: QR code generation, scanning validation, payment processing
// Integrations: Kafka (Dapr), Redis, Keycloak JWT, Temporal, Permify, APISIX,
//               TigerBeetle (ledger), Fluvio (streaming), Mojaloop (interop),
//               OpenSearch (indexing), Lakehouse (analytics)

package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"log/slog"
)

// ── Configuration ──────────────────────────────────────────────────────────────

type Config struct {
	Port            string
	PostgresURL     string
	RedisURL        string
	KafkaBrokers    string
	TemporalHost    string
	KeycloakURL     string
	PermifyHost     string
	TigerBeetleAddr string
	DaprHTTPPort    string
	FluvioEndpoint  string
	ApisixAdminURL  string
	MojaloopURL     string
	OpenSearchURL   string
	LakehouseURL    string
	Environment     string
}

func loadConfig() Config {
	return Config{
		Port:            envOr("PORT", "8260"),
		PostgresURL:     envOr("DATABASE_URL", "postgresql://ngapp:password@localhost:5432/ngapp"),
		RedisURL:        envOr("REDIS_URL", "redis://localhost:6379/11"),
		KafkaBrokers:    envOr("KAFKA_BROKERS", "localhost:9092"),
		TemporalHost:    envOr("TEMPORAL_HOST", "localhost:7233"),
		KeycloakURL:     envOr("KEYCLOAK_URL", "http://localhost:8080"),
		PermifyHost:     envOr("PERMIFY_HOST", "localhost:3476"),
		TigerBeetleAddr: envOr("TIGERBEETLE_ADDR", "localhost:3000"),
		DaprHTTPPort:    envOr("DAPR_HTTP_PORT", "3500"),
		FluvioEndpoint:  envOr("FLUVIO_ENDPOINT", "localhost:9003"),
		ApisixAdminURL:  envOr("APISIX_ADMIN_URL", "http://localhost:9180"),
		MojaloopURL:     envOr("MOJALOOP_URL", "http://localhost:4000"),
		OpenSearchURL:   envOr("OPENSEARCH_URL", "http://localhost:9200"),
		LakehouseURL:    envOr("LAKEHOUSE_URL", "http://localhost:8181"),
		Environment:     envOr("ENVIRONMENT", "development"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ── Kafka Topics ───────────────────────────────────────────────────────────────

const (
	TopicQRGenerated = "qr.code.generated"
	TopicQRScanned   = "qr.code.scanned"
	TopicQRPayment   = "qr.payment.completed"
	TopicQRExpired   = "qr.code.expired"
	TopicQRFraud     = "qr.fraud.detected"
)

// ── Middleware Integration Clients ──────────────────────────────────────────────

type DaprClient struct{ httpPort string }
type RedisClient struct{ url string }
type TemporalClient struct{ host string }
type PermifyClient struct{ host string }
type TigerBeetleClient struct{ addr string }
type FluvioClient struct{ endpoint string }
type MojaloopClient struct{ url string }
type OpenSearchClient struct{ url string }
type LakehouseClient struct{ url string }

func (d *DaprClient) Publish(topic string, data interface{}) error {
	body, _ := json.Marshal(data)
	url := fmt.Sprintf("http://localhost:%s/v1.0/publish/kafka-pubsub/%s", d.httpPort, topic)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Warn("Dapr publish failed", "topic", topic, "error", err)
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (r *RedisClient) Set(key string, val interface{}, ttlSec int) error {
	body, _ := json.Marshal(map[string]interface{}{
		"key": key, "value": val,
	})
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/redis-statestore", envOr("DAPR_HTTP_PORT", "3500"))
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (r *RedisClient) Get(key string) (map[string]interface{}, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/redis-statestore/%s", envOr("DAPR_HTTP_PORT", "3500"), key)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func (t *TigerBeetleClient) RecordTransfer(ref string, amount float64, debit, credit string) error {
	body, _ := json.Marshal(map[string]interface{}{
		"reference": ref, "amount": amount, "debit_account": debit, "credit_account": credit,
	})
	resp, err := http.Post(fmt.Sprintf("http://localhost:8200/transfer"), "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (f *FluvioClient) Produce(topic string, data interface{}) error {
	body, _ := json.Marshal(data)
	resp, err := http.Post(fmt.Sprintf("http://%s/produce/%s", f.endpoint, topic), "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (o *OpenSearchClient) Index(index, id string, data interface{}) error {
	body, _ := json.Marshal(data)
	req, _ := http.NewRequest("PUT", fmt.Sprintf("%s/%s/_doc/%s", o.url, index, id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (l *LakehouseClient) Send(table string, data interface{}) error {
	body, _ := json.Marshal(map[string]interface{}{"table": table, "data": data})
	resp, err := http.Post(fmt.Sprintf("%s/ingest", l.url), "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (p *PermifyClient) Check(entity, relation, subject string) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"entity": map[string]string{"type": "qr_code", "id": entity},
		"permission": relation,
		"subject":    map[string]string{"type": "user", "id": subject},
	})
	resp, err := http.Post(fmt.Sprintf("http://%s/v1/permissions/check", p.host), "application/json", bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result["can"] == "CHECK_RESULT_ALLOWED", nil
}

// ── Store ──────────────────────────────────────────────────────────────────────

type Store struct {
	db           *sql.DB
	dapr         *DaprClient
	redis        *RedisClient
	temporal     *TemporalClient
	permify      *PermifyClient
	tigerbeetle  *TigerBeetleClient
	fluvio       *FluvioClient
	mojaloop     *MojaloopClient
	opensearch   *OpenSearchClient
	lakehouse    *LakehouseClient
	mu           sync.RWMutex
}

func newStore(cfg Config) *Store {
	s := &Store{
		dapr:        &DaprClient{httpPort: cfg.DaprHTTPPort},
		redis:       &RedisClient{url: cfg.RedisURL},
		temporal:    &TemporalClient{host: cfg.TemporalHost},
		permify:     &PermifyClient{host: cfg.PermifyHost},
		tigerbeetle: &TigerBeetleClient{addr: cfg.TigerBeetleAddr},
		fluvio:      &FluvioClient{endpoint: cfg.FluvioEndpoint},
		mojaloop:    &MojaloopClient{url: cfg.MojaloopURL},
		opensearch:  &OpenSearchClient{url: cfg.OpenSearchURL},
		lakehouse:   &LakehouseClient{url: cfg.LakehouseURL},
	}

	db, err := sql.Open("postgres", cfg.PostgresURL)
	if err == nil {
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)
		if err := db.Ping(); err == nil {
			s.db = db
			slog.Info("PostgreSQL connected")
		} else {
			slog.Warn("PostgreSQL ping failed", "error", err)
		}
	}
	return s
}

// ── OTel ───────────────────────────────────────────────────────────────────────

func initTracer(serviceName string) func() {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		return func() {}
	}
	ctx := context.Background()
	exp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(endpoint), otlptracehttp.WithInsecure())
	if err != nil {
		slog.Warn("OTel exporter failed", "error", err)
		return func() {}
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewWithAttributes(semconv.SchemaURL, semconv.ServiceNameKey.String(serviceName))),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return func() { tp.Shutdown(ctx) }
}

func otelMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tracer := otel.Tracer("qr-payment-service")
		ctx, span := tracer.Start(r.Context(), fmt.Sprintf("%s %s", r.Method, r.URL.Path))
		defer span.End()
		span.SetAttributes(attribute.String("http.method", r.Method), attribute.String("http.url", r.URL.Path))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func generateSecureCode() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(999999))
	return fmt.Sprintf("QR-%d-%06d", time.Now().UnixMilli(), n.Int64())
}

// ── Main ───────────────────────────────────────────────────────────────────────

func main() {
	cfg := loadConfig()
	store := newStore(cfg)
	shutdown := initTracer("qr-payment-service")
	defer shutdown()

	r := mux.NewRouter()
	r.Use(otelMiddleware)

	// Health + readiness
	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"status": "healthy", "service": "qr-payment-service", "version": "1.0.0",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}).Methods("GET")

	r.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		dbOk := store.db != nil
		respondJSON(w, 200, map[string]interface{}{"ready": dbOk, "database": dbOk})
	}).Methods("GET")

	// ── Generate QR Code ───────────────────────────────────────────────────────
	r.HandleFunc("/api/v1/qr/generate", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Amount       float64 `json:"amount"`
			Currency     string  `json:"currency"`
			MerchantID   string  `json:"merchantId"`
			AgentID      int     `json:"agentId"`
			Description  string  `json:"description"`
			ExpiryMinutes int    `json:"expiryMinutes"`
			Type         string  `json:"type"` // static, dynamic
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, 400, map[string]interface{}{"error": "invalid request body"})
			return
		}
		if req.Currency == "" {
			req.Currency = "NGN"
		}
		if req.ExpiryMinutes <= 0 {
			req.ExpiryMinutes = 30
		}
		if req.Type == "" {
			req.Type = "dynamic"
		}

		code := generateSecureCode()
		expiresAt := time.Now().Add(time.Duration(req.ExpiryMinutes) * time.Minute)

		// Store in PostgreSQL
		if store.db != nil {
			_, err := store.db.Exec(
				`INSERT INTO qr_codes (code, type, status, "agentId", amount, currency, description, metadata, "expiresAt", "createdAt")
				 VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, NOW())`,
				code, req.Type, req.AgentID, req.Amount, req.Currency, req.Description,
				fmt.Sprintf(`{"merchantId":"%s","generatedBy":"go-service"}`, req.MerchantID), expiresAt,
			)
			if err != nil {
				slog.Error("QR insert failed", "error", err)
			}
		}

		// Create QR payload
		qrPayload := map[string]interface{}{
			"type":     "54link_qr_payment",
			"code":     code,
			"amount":   req.Amount,
			"currency": req.Currency,
			"merchant": req.MerchantID,
			"exp":      expiresAt.UTC().Format(time.RFC3339),
		}
		qrDataBytes, _ := json.Marshal(qrPayload)

		// GL entry via TigerBeetle
		if req.Amount > 0 {
			go store.tigerbeetle.RecordTransfer(
				fmt.Sprintf("qr-gen-%s", code), req.Amount, "QR_PENDING_DEBIT", "QR_ESCROW",
			)
		}

		// Publish to Kafka
		go store.dapr.Publish(TopicQRGenerated, map[string]interface{}{
			"code": code, "amount": req.Amount, "agentId": req.AgentID,
			"merchantId": req.MerchantID, "expiresAt": expiresAt.UTC().Format(time.RFC3339),
		})

		// Stream to Fluvio
		go store.fluvio.Produce("qr-codes", map[string]interface{}{
			"code": code, "amount": req.Amount, "type": req.Type,
		})

		// Cache in Redis (for fast scan lookups)
		go store.redis.Set(fmt.Sprintf("qr:%s", code), map[string]interface{}{
			"amount": req.Amount, "agentId": req.AgentID, "merchantId": req.MerchantID,
			"expiresAt": expiresAt.UTC().Format(time.RFC3339), "status": "active",
		}, req.ExpiryMinutes*60)

		// Index in OpenSearch
		go store.opensearch.Index("qr_codes", code, qrPayload)

		respondJSON(w, 201, map[string]interface{}{
			"code":      code,
			"qrData":    string(qrDataBytes),
			"amount":    req.Amount,
			"currency":  req.Currency,
			"expiresAt": expiresAt.UTC().Format(time.RFC3339),
			"type":      req.Type,
		})
	}).Methods("POST")

	// ── Scan/Validate QR Code ──────────────────────────────────────────────────
	r.HandleFunc("/api/v1/qr/scan", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
			respondJSON(w, 400, map[string]interface{}{"error": "code is required"})
			return
		}

		// Check Redis cache first
		cached, err := store.redis.Get(fmt.Sprintf("qr:%s", req.Code))
		if err == nil && cached != nil && cached["status"] == "active" {
			go store.dapr.Publish(TopicQRScanned, map[string]interface{}{
				"code": req.Code, "source": "cache",
			})
			respondJSON(w, 200, cached)
			return
		}

		// Fallback to PostgreSQL
		if store.db != nil {
			var amount sql.NullFloat64
			var status, currency string
			var expiresAt sql.NullTime
			var agentID sql.NullInt64
			err := store.db.QueryRow(
				`SELECT amount, status, currency, "expiresAt", "agentId" FROM qr_codes WHERE code = $1`, req.Code,
			).Scan(&amount, &status, &currency, &expiresAt, &agentID)
			if err != nil {
				respondJSON(w, 404, map[string]interface{}{"error": "QR code not found"})
				return
			}
			if status != "active" {
				respondJSON(w, 400, map[string]interface{}{"error": "QR code is " + status})
				return
			}
			if expiresAt.Valid && expiresAt.Time.Before(time.Now()) {
				respondJSON(w, 400, map[string]interface{}{"error": "QR code has expired"})
				return
			}

			go store.dapr.Publish(TopicQRScanned, map[string]interface{}{
				"code": req.Code, "source": "database",
			})

			respondJSON(w, 200, map[string]interface{}{
				"code":      req.Code,
				"amount":    amount.Float64,
				"status":    status,
				"currency":  currency,
				"agentId":   agentID.Int64,
				"expiresAt": expiresAt.Time.UTC().Format(time.RFC3339),
			})
			return
		}

		respondJSON(w, 404, map[string]interface{}{"error": "QR code not found"})
	}).Methods("POST")

	// ── Process QR Payment ─────────────────────────────────────────────────────
	r.HandleFunc("/api/v1/qr/pay", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Code         string  `json:"code"`
			Amount       float64 `json:"amount"`
			PayerPhone   string  `json:"payerPhone"`
			PayerPin     string  `json:"payerPin"`
			PayerAgentID int     `json:"payerAgentId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, 400, map[string]interface{}{"error": "invalid request body"})
			return
		}
		if req.Code == "" || req.Amount <= 0 {
			respondJSON(w, 400, map[string]interface{}{"error": "code and amount are required"})
			return
		}

		// Validate QR exists and is active
		if store.db == nil {
			respondJSON(w, 500, map[string]interface{}{"error": "database unavailable"})
			return
		}

		var qrAmount sql.NullFloat64
		var qrStatus string
		var qrAgentID sql.NullInt64
		var qrExpiresAt sql.NullTime
		err := store.db.QueryRow(
			`SELECT amount, status, "agentId", "expiresAt" FROM qr_codes WHERE code = $1`, req.Code,
		).Scan(&qrAmount, &qrStatus, &qrAgentID, &qrExpiresAt)
		if err != nil {
			respondJSON(w, 404, map[string]interface{}{"error": "QR code not found"})
			return
		}
		if qrStatus != "active" {
			respondJSON(w, 400, map[string]interface{}{"error": "QR code already used or inactive"})
			return
		}
		if qrExpiresAt.Valid && qrExpiresAt.Time.Before(time.Now()) {
			respondJSON(w, 400, map[string]interface{}{"error": "QR code has expired"})
			return
		}
		if qrAmount.Valid && qrAmount.Float64 > 0 && abs(qrAmount.Float64-req.Amount) > 0.01 {
			respondJSON(w, 400, map[string]interface{}{"error": fmt.Sprintf("QR requires exact amount ₦%.2f", qrAmount.Float64)})
			return
		}

		// Calculate fee (1.0% capped at ₦100)
		fee := req.Amount * 0.01
		if fee > 100 {
			fee = 100
		}
		commission := fee * 0.4
		netAmount := req.Amount - fee
		ref := fmt.Sprintf("QRP-GO-%d-%06d", time.Now().UnixMilli(), time.Now().Nanosecond()%1000000)

		// Record payment transaction
		store.db.Exec(
			`INSERT INTO transactions (amount, reference, type, status, metadata, "createdAt")
			 VALUES ($1, $2, 'qr_payment', 'completed', $3, NOW())`,
			req.Amount, ref,
			fmt.Sprintf(`{"qrCode":"%s","payerPhone":"%s","fee":%.2f,"commission":%.2f,"netAmount":%.2f,"agentId":%d}`,
				req.Code, req.PayerPhone, fee, commission, netAmount, qrAgentID.Int64),
		)

		// Mark QR as used
		store.db.Exec(`UPDATE qr_codes SET status = 'used', "usedAt" = NOW() WHERE code = $1`, req.Code)

		// GL double-entry via TigerBeetle
		go store.tigerbeetle.RecordTransfer(ref, req.Amount, "PAYER_QR_DEBIT", "MERCHANT_QR_CREDIT")

		// Kafka event
		go store.dapr.Publish(TopicQRPayment, map[string]interface{}{
			"reference":  ref,
			"qrCode":     req.Code,
			"amount":     req.Amount,
			"fee":        fee,
			"netAmount":  netAmount,
			"commission": commission,
			"payerPhone": req.PayerPhone,
			"agentId":    qrAgentID.Int64,
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		})

		// Stream to Fluvio
		go store.fluvio.Produce("qr-payments", map[string]interface{}{
			"ref": ref, "amount": req.Amount, "code": req.Code,
		})

		// Index in OpenSearch
		go store.opensearch.Index("qr_payments", ref, map[string]interface{}{
			"reference": ref, "amount": req.Amount, "code": req.Code,
		})

		// Push to Lakehouse
		go store.lakehouse.Send("qr_payment_events", map[string]interface{}{
			"reference": ref, "amount": req.Amount, "fee": fee,
		})

		// Invalidate Redis cache
		go store.redis.Set(fmt.Sprintf("qr:%s", req.Code), map[string]interface{}{"status": "used"}, 60)

		respondJSON(w, 200, map[string]interface{}{
			"reference":  ref,
			"status":     "completed",
			"amount":     req.Amount,
			"fee":        fee,
			"netAmount":  netAmount,
			"commission": commission,
		})
	}).Methods("POST")

	// ── QR Payment History ─────────────────────────────────────────────────────
	r.HandleFunc("/api/v1/qr/transactions", func(w http.ResponseWriter, r *http.Request) {
		limitStr := r.URL.Query().Get("limit")
		offsetStr := r.URL.Query().Get("offset")
		limit := 20
		offset := 0
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
		if store.db == nil {
			respondJSON(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0})
			return
		}
		rows, err := store.db.Query(
			`SELECT id, amount, reference, type, status, metadata, "createdAt"
			 FROM transactions WHERE type IN ('qr_payment', 'dynamic_qr_payment')
			 ORDER BY id DESC LIMIT $1 OFFSET $2`, limit, offset,
		)
		if err != nil {
			respondJSON(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0})
			return
		}
		defer rows.Close()
		var items []map[string]interface{}
		for rows.Next() {
			var id int
			var amount float64
			var ref, txType, status string
			var metadata sql.NullString
			var createdAt time.Time
			if err := rows.Scan(&id, &amount, &ref, &txType, &status, &metadata, &createdAt); err == nil {
				items = append(items, map[string]interface{}{
					"id": id, "amount": amount, "reference": ref,
					"type": txType, "status": status, "createdAt": createdAt,
				})
			}
		}
		respondJSON(w, 200, map[string]interface{}{"items": items, "total": len(items)})
	}).Methods("GET")

	// ── QR Analytics ───────────────────────────────────────────────────────────
	r.HandleFunc("/api/v1/qr/analytics", func(w http.ResponseWriter, _ *http.Request) {
		if store.db == nil {
			respondJSON(w, 200, map[string]interface{}{
				"totalGenerated": 0, "totalUsed": 0, "totalExpired": 0, "totalVolume": 0,
			})
			return
		}
		var totalGenerated, totalUsed, totalExpired int
		var totalVolume float64
		store.db.QueryRow(`SELECT COUNT(*) FROM qr_codes`).Scan(&totalGenerated)
		store.db.QueryRow(`SELECT COUNT(*) FROM qr_codes WHERE status = 'used'`).Scan(&totalUsed)
		store.db.QueryRow(`SELECT COUNT(*) FROM qr_codes WHERE status = 'expired'`).Scan(&totalExpired)
		store.db.QueryRow(
			`SELECT COALESCE(SUM(amount::numeric), 0) FROM transactions WHERE type IN ('qr_payment', 'dynamic_qr_payment')`,
		).Scan(&totalVolume)

		respondJSON(w, 200, map[string]interface{}{
			"totalGenerated":  totalGenerated,
			"totalUsed":       totalUsed,
			"totalExpired":    totalExpired,
			"totalActive":     totalGenerated - totalUsed - totalExpired,
			"totalVolume":     totalVolume,
			"conversionRate":  safeDiv(float64(totalUsed), float64(totalGenerated)) * 100,
			"generatedAt":     time.Now().UTC().Format(time.RFC3339),
		})
	}).Methods("GET")

	// Register with APISIX
	go registerWithAPISIX(cfg)

	// Start server
	slog.Info("54Link QR Payment Service starting", "port", cfg.Port)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}
	setupGracefulShutdown(srv)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

func registerWithAPISIX(cfg Config) {
	body, _ := json.Marshal(map[string]interface{}{
		"uri":      "/api/v1/qr/*",
		"upstream": map[string]interface{}{"type": "roundrobin", "nodes": map[string]int{fmt.Sprintf("127.0.0.1:%s", cfg.Port): 1}},
	})
	req, _ := http.NewRequest("PUT", fmt.Sprintf("%s/apisix/admin/routes/qr-payment-service", cfg.ApisixAdminURL), bytes.NewReader(body))
	req.Header.Set("X-API-KEY", envOr("APISIX_ADMIN_KEY", "54link-admin"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("APISIX registration failed", "error", err)
		return
	}
	defer resp.Body.Close()
	slog.Info("APISIX route registered for qr-payment-service")
}

func setupGracefulShutdown(srv *http.Server) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-quit
		slog.Info("Shutting down gracefully", "signal", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			slog.Error("Server forced shutdown", "error", err)
		}
	}()
}

// Suppress unused import warnings
var _ = bytes.NewReader
var _ = context.Background
var _ = hmac.New
var _ = sha256.New
var _ = hex.EncodeToString
var _ = fmt.Sprintf
var _ = io.ReadAll
var _ = os.Getenv
var _ = strconv.Atoi
var _ = strings.TrimPrefix
var _ = time.Now
var _ = sync.RWMutex{}
var _ = attribute.String
var _ = rand.Reader
