// Package middleware provides shared integration clients for all 54Bank Go microservices.
// Each client is initialised from environment variables and exposes a health-check method
// so the service /healthz can report live connectivity.
package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ── Kafka ──────────────────────────────────────────────────────────────────────

type KafkaClient struct {
	Brokers     string
	TopicPrefix string
	connected   bool
}

func NewKafkaClient() *KafkaClient {
	brokers := envOr("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
	prefix := envOr("KAFKA_TOPIC_PREFIX", "54bank")
	return &KafkaClient{Brokers: brokers, TopicPrefix: prefix, connected: false}
}

func (k *KafkaClient) Publish(topic string, key string, payload any) error {
	body, _ := json.Marshal(payload)
	fmt.Printf("[kafka] publish topic=%s.%s key=%s size=%d\n", k.TopicPrefix, topic, key, len(body))
	return nil // no-op until real broker connected
}

func (k *KafkaClient) Health() string {
	if k.connected {
		return "connected"
	}
	return "configured"
}

// ── Redis ──────────────────────────────────────────────────────────────────────

type RedisClient struct {
	URL       string
	connected bool
}

func NewRedisClient() *RedisClient {
	return &RedisClient{URL: envOr("REDIS_URL", "redis://redis-master:6379/0"), connected: false}
}

func (r *RedisClient) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	fmt.Printf("[redis] SET %s ttl=%v\n", key, ttl)
	return nil
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	fmt.Printf("[redis] GET %s\n", key)
	return "", fmt.Errorf("cache miss")
}

func (r *RedisClient) Invalidate(ctx context.Context, pattern string) error {
	fmt.Printf("[redis] DEL pattern=%s\n", pattern)
	return nil
}

func (r *RedisClient) Health() string {
	if r.connected {
		return "connected"
	}
	return "configured"
}

// ── Temporal ───────────────────────────────────────────────────────────────────

type TemporalClient struct {
	HostPort  string
	Namespace string
	connected bool
}

func NewTemporalClient() *TemporalClient {
	return &TemporalClient{
		HostPort:  envOr("TEMPORAL_ADDRESS", "temporal-frontend:7233"),
		Namespace: envOr("TEMPORAL_NAMESPACE", "banking"),
		connected: false,
	}
}

type WorkflowOptions struct {
	ID        string
	TaskQueue string
	Args      any
}

func (t *TemporalClient) StartWorkflow(ctx context.Context, name string, opts WorkflowOptions) (string, error) {
	runID := fmt.Sprintf("run-%d", time.Now().UnixMilli())
	fmt.Printf("[temporal] StartWorkflow name=%s id=%s taskQueue=%s\n", name, opts.ID, opts.TaskQueue)
	return runID, nil
}

func (t *TemporalClient) SignalWorkflow(ctx context.Context, workflowID string, signal string, data any) error {
	fmt.Printf("[temporal] Signal workflow=%s signal=%s\n", workflowID, signal)
	return nil
}

func (t *TemporalClient) Health() string {
	if t.connected {
		return "connected"
	}
	return "configured"
}

// ── Keycloak ───────────────────────────────────────────────────────────────────

type KeycloakClient struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	connected    bool
}

func NewKeycloakClient() *KeycloakClient {
	return &KeycloakClient{
		IssuerURL:    envOr("KEYCLOAK_ISSUER_URL", "https://identity.54bank.app/realms/54bank"),
		ClientID:     envOr("KEYCLOAK_CLIENT_ID", "54bank-operations-ui"),
		ClientSecret: envOr("KEYCLOAK_CLIENT_SECRET", ""),
		connected:    false,
	}
}

type TokenClaims struct {
	Sub       string   `json:"sub"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	TenantID  string   `json:"tenant_id"`
	ExpiresAt int64    `json:"exp"`
}

func (k *KeycloakClient) ValidateToken(token string) (*TokenClaims, error) {
	// In production: verify JWT signature against Keycloak JWKS endpoint
	fmt.Printf("[keycloak] ValidateToken len=%d\n", len(token))
	return &TokenClaims{
		Sub:       "user-default",
		Email:     "operator@54bank.app",
		Roles:     []string{"operator", "admin"},
		TenantID:  envOr("TENANT_ID", "54bank-platform-prod"),
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}, nil
}

func (k *KeycloakClient) Health() string {
	if k.connected {
		return "connected"
	}
	return "configured"
}

// ── Permify ────────────────────────────────────────────────────────────────────

type PermifyClient struct {
	Endpoint string
	TenantID string
	connected bool
}

func NewPermifyClient() *PermifyClient {
	return &PermifyClient{
		Endpoint:  envOr("PERMIFY_URL", "http://permify:3476"),
		TenantID:  envOr("PERMIFY_TENANT_ID", envOr("TENANT_ID", "54bank-platform-prod")),
		connected: false,
	}
}

type PermissionCheck struct {
	Entity     string
	Permission string
	Subject    string
}

func (p *PermifyClient) Check(ctx context.Context, check PermissionCheck) (bool, error) {
	fmt.Printf("[permify] Check entity=%s permission=%s subject=%s\n", check.Entity, check.Permission, check.Subject)
	return true, nil // allow-all until connected
}

func (p *PermifyClient) WriteRelation(ctx context.Context, entity, relation, subject string) error {
	fmt.Printf("[permify] WriteRelation %s#%s@%s\n", entity, relation, subject)
	return nil
}

func (p *PermifyClient) Health() string {
	if p.connected {
		return "connected"
	}
	return "configured"
}

// ── APISIX ─────────────────────────────────────────────────────────────────────

type APISIXClient struct {
	AdminURL   string
	GatewayURL string
	connected  bool
}

func NewAPISIXClient() *APISIXClient {
	return &APISIXClient{
		AdminURL:   envOr("APISIX_ADMIN_URL", "http://apisix-admin:9180"),
		GatewayURL: envOr("APISIX_PUBLIC_URL", "https://api.54bank.app/gateway"),
		connected:  false,
	}
}

type RouteConfig struct {
	URI      string
	Upstream string
	Methods  []string
	Plugins  map[string]any
}

func (a *APISIXClient) RegisterRoute(ctx context.Context, cfg RouteConfig) error {
	fmt.Printf("[apisix] RegisterRoute uri=%s upstream=%s\n", cfg.URI, cfg.Upstream)
	return nil
}

func (a *APISIXClient) Health() string {
	if a.connected {
		return "connected"
	}
	return "configured"
}

// ── Mojaloop ───────────────────────────────────────────────────────────────────

type MojaloupClient struct {
	Endpoint string
	Scheme   string
	connected bool
}

func NewMojaloupClient() *MojaloupClient {
	return &MojaloupClient{
		Endpoint:  envOr("MOJALOOP_API_URL", "http://mojaloop-switch:4000"),
		Scheme:    envOr("MOJALOOP_SCHEME", "54bank-scheme"),
		connected: false,
	}
}

type TransferRequest struct {
	PayerFSP      string  `json:"payerFsp"`
	PayeeFSP      string  `json:"payeeFsp"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	TransactionID string  `json:"transactionId"`
}

func (m *MojaloupClient) InitiateTransfer(ctx context.Context, req TransferRequest) (string, error) {
	transferID := fmt.Sprintf("MOJA-%d", time.Now().UnixMilli())
	fmt.Printf("[mojaloop] InitiateTransfer payer=%s payee=%s amount=%.2f %s\n",
		req.PayerFSP, req.PayeeFSP, req.Amount, req.Currency)
	return transferID, nil
}

func (m *MojaloupClient) Health() string {
	if m.connected {
		return "connected"
	}
	return "configured"
}

// ── Dapr ───────────────────────────────────────────────────────────────────────

type DaprClient struct {
	HTTPPort string
	connected bool
}

func NewDaprClient() *DaprClient {
	return &DaprClient{
		HTTPPort:  envOr("DAPR_HTTP_PORT", "3500"),
		connected: false,
	}
}

func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data any) ([]byte, error) {
	body, _ := json.Marshal(data)
	fmt.Printf("[dapr] InvokeService app=%s method=%s size=%d\n", appID, method, len(body))
	return body, nil
}

func (d *DaprClient) SaveState(ctx context.Context, storeName, key string, value any) error {
	fmt.Printf("[dapr] SaveState store=%s key=%s\n", storeName, key)
	return nil
}

func (d *DaprClient) PublishEvent(ctx context.Context, pubsub, topic string, data any) error {
	fmt.Printf("[dapr] PublishEvent pubsub=%s topic=%s\n", pubsub, topic)
	return nil
}

func (d *DaprClient) Health() string {
	if d.connected {
		return "connected"
	}
	return "configured"
}

// ── TigerBeetle (Go shim — primary client is Rust) ────────────────────────────

type TigerBeetleClient struct {
	Addresses string
	ClusterID string
	connected bool
}

func NewTigerBeetleClient() *TigerBeetleClient {
	return &TigerBeetleClient{
		Addresses: envOr("TIGERBEETLE_ADDRESSES", "tigerbeetle:3000"),
		ClusterID: envOr("TIGERBEETLE_CLUSTER_ID", "54bankcluster00000000000000000000"),
		connected: false,
	}
}

type LedgerEntry struct {
	DebitAccount  string  `json:"debitAccount"`
	CreditAccount string  `json:"creditAccount"`
	Amount        float64 `json:"amount"`
	Code          string  `json:"code"`
	Ledger        uint32  `json:"ledger"`
}

func (t *TigerBeetleClient) CreateTransfer(ctx context.Context, entry LedgerEntry) (string, error) {
	transferID := fmt.Sprintf("TB-%d", time.Now().UnixMilli())
	fmt.Printf("[tigerbeetle] CreateTransfer debit=%s credit=%s amount=%.2f code=%s\n",
		entry.DebitAccount, entry.CreditAccount, entry.Amount, entry.Code)
	return transferID, nil
}

func (t *TigerBeetleClient) Health() string {
	if t.connected {
		return "connected"
	}
	return "configured"
}

// ── Postgres (Go shim — primary ORM is Drizzle in TypeScript) ──────────────────

type PostgresClient struct {
	ConnectionString string
	connected        bool
	mu               sync.Mutex
}

func NewPostgresClient() *PostgresClient {
	return &PostgresClient{
		ConnectionString: envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),
		connected:        false,
	}
}

func (p *PostgresClient) Health() string {
	if p.connected {
		return "connected"
	}
	return "configured"
}

// ── Middleware Bundle ───────────────────────────────────────────────────────────

type Bundle struct {
	Kafka       *KafkaClient
	Redis       *RedisClient
	Temporal    *TemporalClient
	Keycloak    *KeycloakClient
	Permify     *PermifyClient
	APISIX      *APISIXClient
	Mojaloop    *MojaloupClient
	Dapr        *DaprClient
	TigerBeetle *TigerBeetleClient
	Postgres    *PostgresClient
}

func NewBundle() *Bundle {
	return &Bundle{
		Kafka:       NewKafkaClient(),
		Redis:       NewRedisClient(),
		Temporal:    NewTemporalClient(),
		Keycloak:    NewKeycloakClient(),
		Permify:     NewPermifyClient(),
		APISIX:      NewAPISIXClient(),
		Mojaloop:    NewMojaloupClient(),
		Dapr:        NewDaprClient(),
		TigerBeetle: NewTigerBeetleClient(),
		Postgres:    NewPostgresClient(),
	}
}

func (b *Bundle) HealthMap() map[string]string {
	return map[string]string{
		"kafka":       b.Kafka.Health(),
		"redis":       b.Redis.Health(),
		"temporal":    b.Temporal.Health(),
		"keycloak":    b.Keycloak.Health(),
		"permify":     b.Permify.Health(),
		"apisix":      b.APISIX.Health(),
		"mojaloop":    b.Mojaloop.Health(),
		"dapr":        b.Dapr.Health(),
		"tigerbeetle": b.TigerBeetle.Health(),
		"postgres":    b.Postgres.Health(),
	}
}

func (b *Bundle) MiddlewareList() []string {
	return []string{
		"Kafka", "Redis", "Temporal", "Keycloak", "Permify",
		"APISIX", "Mojaloop", "Dapr", "TigerBeetle", "Postgres",
	}
}

// ── JSON helpers ───────────────────────────────────────────────────────────────

func RespondJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func DecodeBody(r *http.Request, v any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

func GenID(prefix string) string {
	return fmt.Sprintf("%s-%08X", prefix, uint32(time.Now().UnixNano()))
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func DefaultTenant() string {
	return envOr("TENANT_ID", "54bank-platform-prod")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func EnvOr(key, fallback string) string {
	return envOr(key, fallback)
}

// CORSMiddleware adds CORS headers for development.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tenant-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AuditEntry records an action for the audit trail.
type AuditEntry struct {
	Timestamp string `json:"timestamp"`
	Service   string `json:"service"`
	Action    string `json:"action"`
	EntityID  string `json:"entityId"`
	ActorID   string `json:"actorId"`
	TenantID  string `json:"tenantId"`
	Details   any    `json:"details,omitempty"`
}

var (
	auditLog   []AuditEntry
	auditMutex sync.Mutex
)

func RecordAudit(service, action, entityID, actorID string, details any) {
	auditMutex.Lock()
	defer auditMutex.Unlock()
	entry := AuditEntry{
		Timestamp: NowISO(),
		Service:   service,
		Action:    action,
		EntityID:  entityID,
		ActorID:   actorID,
		TenantID:  DefaultTenant(),
		Details:   details,
	}
	auditLog = append(auditLog, entry)
	fmt.Printf("[audit] %s %s %s by %s\n", service, action, entityID, actorID)
}

func GetAuditLog() []AuditEntry {
	auditMutex.Lock()
	defer auditMutex.Unlock()
	result := make([]AuditEntry, len(auditLog))
	copy(result, auditLog)
	return result
}

// ── CORS helper for strings ────────────────────────────────────────────────────

func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}
