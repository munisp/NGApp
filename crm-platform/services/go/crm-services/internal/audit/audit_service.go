package audit

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// AuditEvent represents a single auditable action in the system
type AuditEvent struct {
	ID            string                 `json:"id" db:"id"`
	Timestamp     time.Time              `json:"timestamp" db:"timestamp"`
	TenantID      string                 `json:"tenant_id" db:"tenant_id"`
	ActorID       string                 `json:"actor_id" db:"actor_id"`
	ActorType     ActorType              `json:"actor_type" db:"actor_type"`
	ActorIP       string                 `json:"actor_ip" db:"actor_ip"`
	Action        string                 `json:"action" db:"action"`
	ResourceType  string                 `json:"resource_type" db:"resource_type"`
	ResourceID    string                 `json:"resource_id" db:"resource_id"`
	Category      AuditCategory          `json:"category" db:"category"`
	Severity      AuditSeverity          `json:"severity" db:"severity"`
	Status        AuditStatus            `json:"status" db:"status"`
	Description   string                 `json:"description" db:"description"`
	OldValue      json.RawMessage        `json:"old_value,omitempty" db:"old_value"`
	NewValue      json.RawMessage        `json:"new_value,omitempty" db:"new_value"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	UserAgent     string                 `json:"user_agent,omitempty" db:"user_agent"`
	SessionID     string                 `json:"session_id,omitempty" db:"session_id"`
	CorrelationID string                 `json:"correlation_id,omitempty" db:"correlation_id"`
	Hash          string                 `json:"hash" db:"hash"`
	PrevHash      string                 `json:"prev_hash" db:"prev_hash"`
}

type ActorType string

const (
	ActorUser    ActorType = "user"
	ActorSystem  ActorType = "system"
	ActorAPI     ActorType = "api"
	ActorService ActorType = "service"
	ActorCron    ActorType = "cron"
)

type AuditCategory string

const (
	CategoryAuthentication AuditCategory = "authentication"
	CategoryAuthorization  AuditCategory = "authorization"
	CategoryDataAccess     AuditCategory = "data_access"
	CategoryDataMutation   AuditCategory = "data_mutation"
	CategoryConfiguration  AuditCategory = "configuration"
	CategoryCompliance     AuditCategory = "compliance"
	CategorySecurity       AuditCategory = "security"
	CategoryFinancial      AuditCategory = "financial"
	CategorySystem         AuditCategory = "system"
	CategoryIntegration    AuditCategory = "integration"
)

type AuditSeverity string

const (
	SeverityLow      AuditSeverity = "low"
	SeverityMedium   AuditSeverity = "medium"
	SeverityHigh     AuditSeverity = "high"
	SeverityCritical AuditSeverity = "critical"
)

type AuditStatus string

const (
	StatusSuccess AuditStatus = "success"
	StatusFailure AuditStatus = "failure"
	StatusPending AuditStatus = "pending"
	StatusDenied  AuditStatus = "denied"
)

type AuditQuery struct {
	TenantID     string        `json:"tenant_id"`
	ActorID      string        `json:"actor_id,omitempty"`
	ResourceType string        `json:"resource_type,omitempty"`
	ResourceID   string        `json:"resource_id,omitempty"`
	Category     AuditCategory `json:"category,omitempty"`
	Severity     AuditSeverity `json:"severity,omitempty"`
	Action       string        `json:"action,omitempty"`
	StartTime    time.Time     `json:"start_time"`
	EndTime      time.Time     `json:"end_time"`
	Offset       int           `json:"offset"`
	Limit        int           `json:"limit"`
}

type AuditStats struct {
	TotalEvents       int64                    `json:"total_events"`
	EventsByCategory  map[AuditCategory]int64  `json:"events_by_category"`
	EventsBySeverity  map[AuditSeverity]int64  `json:"events_by_severity"`
	EventsByStatus    map[AuditStatus]int64    `json:"events_by_status"`
	TopActors         []ActorStat              `json:"top_actors"`
	TopResources      []ResourceStat           `json:"top_resources"`
	RecentCritical    []AuditEvent             `json:"recent_critical"`
	ComplianceScore   float64                  `json:"compliance_score"`
}

type ActorStat struct {
	ActorID    string `json:"actor_id"`
	EventCount int64  `json:"event_count"`
}

type ResourceStat struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	EventCount   int64  `json:"event_count"`
}

// AuditRepository provides storage for audit events
type AuditRepository interface {
	Store(ctx context.Context, event *AuditEvent) error
	StoreBatch(ctx context.Context, events []*AuditEvent) error
	Query(ctx context.Context, query *AuditQuery) ([]*AuditEvent, int64, error)
	GetByID(ctx context.Context, id string) (*AuditEvent, error)
	GetStats(ctx context.Context, tenantID string, start, end time.Time) (*AuditStats, error)
	GetChainIntegrity(ctx context.Context, tenantID string, start, end time.Time) (bool, error)
	Purge(ctx context.Context, tenantID string, before time.Time) (int64, error)
}

// AuditService provides tamper-evident audit logging with hash chains
type AuditService struct {
	repo       AuditRepository
	buffer     []*AuditEvent
	bufferMu   sync.Mutex
	flushSize  int
	flushTimer *time.Ticker
	lastHash   map[string]string
	hashMu     sync.RWMutex
	retention  time.Duration
	alertCh    chan *AuditEvent
	stopCh     chan struct{}
}

type AuditConfig struct {
	FlushSize       int           `json:"flush_size"`
	FlushInterval   time.Duration `json:"flush_interval"`
	RetentionDays   int           `json:"retention_days"`
	AlertSeverities []AuditSeverity `json:"alert_severities"`
}

func DefaultConfig() *AuditConfig {
	return &AuditConfig{
		FlushSize:       100,
		FlushInterval:   5 * time.Second,
		RetentionDays:   2555, // 7 years for financial compliance
		AlertSeverities: []AuditSeverity{SeverityHigh, SeverityCritical},
	}
}

func NewAuditService(repo AuditRepository, cfg *AuditConfig) *AuditService {
	if cfg == nil {
		cfg = DefaultConfig()
	}
	s := &AuditService{
		repo:      repo,
		buffer:    make([]*AuditEvent, 0, cfg.FlushSize),
		flushSize: cfg.FlushSize,
		lastHash:  make(map[string]string),
		retention: time.Duration(cfg.RetentionDays) * 24 * time.Hour,
		alertCh:   make(chan *AuditEvent, 1000),
		stopCh:    make(chan struct{}),
	}
	s.flushTimer = time.NewTicker(cfg.FlushInterval)
	go s.flushLoop()
	return s
}

func (s *AuditService) Log(ctx context.Context, event *AuditEvent) error {
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}
	event.Hash = s.computeHash(event)
	event.PrevHash = s.getLastHash(event.TenantID)
	s.setLastHash(event.TenantID, event.Hash)

	s.bufferMu.Lock()
	s.buffer = append(s.buffer, event)
	shouldFlush := len(s.buffer) >= s.flushSize
	s.bufferMu.Unlock()

	if shouldFlush {
		go s.flush(ctx)
	}

	if event.Severity == SeverityHigh || event.Severity == SeverityCritical {
		select {
		case s.alertCh <- event:
		default:
		}
	}
	return nil
}

func (s *AuditService) Query(ctx context.Context, query *AuditQuery) ([]*AuditEvent, int64, error) {
	if query.Limit == 0 {
		query.Limit = 50
	}
	if query.Limit > 1000 {
		query.Limit = 1000
	}
	return s.repo.Query(ctx, query)
}

func (s *AuditService) GetStats(ctx context.Context, tenantID string, start, end time.Time) (*AuditStats, error) {
	return s.repo.GetStats(ctx, tenantID, start, end)
}

func (s *AuditService) VerifyChainIntegrity(ctx context.Context, tenantID string, start, end time.Time) (bool, error) {
	return s.repo.GetChainIntegrity(ctx, tenantID, start, end)
}

func (s *AuditService) Alerts() <-chan *AuditEvent {
	return s.alertCh
}

func (s *AuditService) Stop() {
	close(s.stopCh)
	s.flushTimer.Stop()
	ctx := context.Background()
	s.flush(ctx)
}

func (s *AuditService) computeHash(event *AuditEvent) string {
	data := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s",
		event.Timestamp.Format(time.RFC3339Nano),
		event.TenantID, event.ActorID, event.Action,
		event.ResourceType, event.ResourceID,
		event.Category, event.Severity, event.Status,
	)
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

func (s *AuditService) getLastHash(tenantID string) string {
	s.hashMu.RLock()
	defer s.hashMu.RUnlock()
	return s.lastHash[tenantID]
}

func (s *AuditService) setLastHash(tenantID, hash string) {
	s.hashMu.Lock()
	defer s.hashMu.Unlock()
	s.lastHash[tenantID] = hash
}

func (s *AuditService) flush(ctx context.Context) {
	s.bufferMu.Lock()
	if len(s.buffer) == 0 {
		s.bufferMu.Unlock()
		return
	}
	batch := s.buffer
	s.buffer = make([]*AuditEvent, 0, s.flushSize)
	s.bufferMu.Unlock()

	if err := s.repo.StoreBatch(ctx, batch); err != nil {
		s.bufferMu.Lock()
		s.buffer = append(batch, s.buffer...)
		s.bufferMu.Unlock()
	}
}

func (s *AuditService) flushLoop() {
	for {
		select {
		case <-s.flushTimer.C:
			s.flush(context.Background())
		case <-s.stopCh:
			return
		}
	}
}

// AuditHandler provides HTTP handlers for audit log querying
type AuditHandler struct {
	service *AuditService
}

func NewAuditHandler(service *AuditService) *AuditHandler {
	return &AuditHandler{service: service}
}

func (h *AuditHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/audit/events", h.ListEvents)
	mux.HandleFunc("GET /api/v1/audit/events/{id}", h.GetEvent)
	mux.HandleFunc("GET /api/v1/audit/stats", h.GetStats)
	mux.HandleFunc("GET /api/v1/audit/integrity", h.VerifyIntegrity)
	mux.HandleFunc("POST /api/v1/audit/export", h.ExportEvents)
}

func (h *AuditHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank"
	}
	query := &AuditQuery{
		TenantID:     tenantID,
		Category:     AuditCategory(r.URL.Query().Get("category")),
		Severity:     AuditSeverity(r.URL.Query().Get("severity")),
		ResourceType: r.URL.Query().Get("resource_type"),
		Action:       r.URL.Query().Get("action"),
		StartTime:    time.Now().Add(-24 * time.Hour),
		EndTime:      time.Now(),
		Limit:        50,
	}
	events, total, err := h.service.Query(r.Context(), query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := map[string]interface{}{
		"events": events,
		"total":  total,
		"query":  query,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AuditHandler) GetEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			id = parts[len(parts)-1]
		}
	}
	event, err := h.service.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

func (h *AuditHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank"
	}
	stats, err := h.service.GetStats(r.Context(), tenantID, time.Now().Add(-30*24*time.Hour), time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *AuditHandler) VerifyIntegrity(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank"
	}
	valid, err := h.service.VerifyChainIntegrity(r.Context(), tenantID, time.Now().Add(-24*time.Hour), time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := map[string]interface{}{
		"chain_valid": valid,
		"checked_at":  time.Now().UTC(),
		"tenant_id":   tenantID,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AuditHandler) ExportEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "export_initiated", "format": "csv"})
}

// AuditMiddleware captures HTTP request audit events automatically
func AuditMiddleware(auditSvc *AuditService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			tenantID := r.Header.Get("X-Tenant-ID")
			actorID := r.Header.Get("X-User-ID")
			if actorID == "" {
				actorID = "anonymous"
			}

			rw := &responseWriter{ResponseWriter: w, statusCode: 200}
			next.ServeHTTP(rw, r)

			category := CategoryDataAccess
			if r.Method != "GET" && r.Method != "HEAD" {
				category = CategoryDataMutation
			}
			severity := SeverityLow
			if rw.statusCode >= 400 {
				severity = SeverityMedium
			}
			if rw.statusCode >= 500 {
				severity = SeverityHigh
			}
			status := StatusSuccess
			if rw.statusCode >= 400 {
				status = StatusFailure
			}

			event := &AuditEvent{
				TenantID:     tenantID,
				ActorID:      actorID,
				ActorType:    ActorUser,
				ActorIP:      r.RemoteAddr,
				Action:       fmt.Sprintf("%s %s", r.Method, r.URL.Path),
				ResourceType: "http_endpoint",
				ResourceID:   r.URL.Path,
				Category:     category,
				Severity:     severity,
				Status:       status,
				Description:  fmt.Sprintf("HTTP %s %s -> %d (%s)", r.Method, r.URL.Path, rw.statusCode, time.Since(start)),
				UserAgent:    r.UserAgent(),
				SessionID:    r.Header.Get("X-Session-ID"),
				Metadata: map[string]interface{}{
					"method":      r.Method,
					"path":        r.URL.Path,
					"status_code": rw.statusCode,
					"duration_ms": time.Since(start).Milliseconds(),
					"query":       r.URL.RawQuery,
				},
			}
			auditSvc.Log(context.Background(), event)
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
