package document

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// Document Management Service — file storage, versioning, approval workflows,
// digital signatures, and compliance document tracking

type Document struct {
	ID            string            `json:"id" db:"id"`
	TenantID      string            `json:"tenant_id" db:"tenant_id"`
	Title         string            `json:"title" db:"title"`
	Description   string            `json:"description" db:"description"`
	Category      DocumentCategory  `json:"category" db:"category"`
	MimeType      string            `json:"mime_type" db:"mime_type"`
	SizeBytes     int64             `json:"size_bytes" db:"size_bytes"`
	StoragePath   string            `json:"storage_path" db:"storage_path"`
	Version       int               `json:"version" db:"version"`
	Status        DocumentStatus    `json:"status" db:"status"`
	Tags          []string          `json:"tags"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	UploadedBy    string            `json:"uploaded_by" db:"uploaded_by"`
	ApprovedBy    string            `json:"approved_by,omitempty" db:"approved_by"`
	CustomerID    string            `json:"customer_id,omitempty" db:"customer_id"`
	ExpiresAt     *time.Time        `json:"expires_at,omitempty" db:"expires_at"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
	Checksum      string            `json:"checksum" db:"checksum"`
	Encrypted     bool              `json:"encrypted" db:"encrypted"`
	RetentionDays int               `json:"retention_days" db:"retention_days"`
}

type DocumentCategory string

const (
	CategoryKYC           DocumentCategory = "kyc"
	CategoryContract      DocumentCategory = "contract"
	CategoryCompliance    DocumentCategory = "compliance"
	CategoryFinancial     DocumentCategory = "financial"
	CategoryOperational   DocumentCategory = "operational"
	CategoryLegal         DocumentCategory = "legal"
	CategoryOnboarding    DocumentCategory = "onboarding"
	CategoryAudit         DocumentCategory = "audit"
	CategoryCampaign      DocumentCategory = "campaign"
	CategoryReport        DocumentCategory = "report"
)

type DocumentStatus string

const (
	StatusDraft     DocumentStatus = "draft"
	StatusPending   DocumentStatus = "pending_approval"
	StatusApproved  DocumentStatus = "approved"
	StatusRejected  DocumentStatus = "rejected"
	StatusArchived  DocumentStatus = "archived"
	StatusExpired   DocumentStatus = "expired"
)

type DocumentVersion struct {
	ID          string    `json:"id"`
	DocumentID  string    `json:"document_id"`
	Version     int       `json:"version"`
	StoragePath string    `json:"storage_path"`
	SizeBytes   int64     `json:"size_bytes"`
	Checksum    string    `json:"checksum"`
	ChangedBy   string    `json:"changed_by"`
	ChangeNote  string    `json:"change_note"`
	CreatedAt   time.Time `json:"created_at"`
}

type ApprovalWorkflow struct {
	ID         string    `json:"id"`
	DocumentID string    `json:"document_id"`
	Approvers  []string  `json:"approvers"`
	Status     string    `json:"status"`
	CurrentStep int      `json:"current_step"`
	CreatedAt  time.Time `json:"created_at"`
}

type DocumentRepository interface {
	Create(ctx context.Context, doc *Document) error
	Update(ctx context.Context, doc *Document) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*Document, error)
	List(ctx context.Context, tenantID string, category DocumentCategory, offset, limit int) ([]*Document, int64, error)
	Search(ctx context.Context, tenantID, query string) ([]*Document, error)
	GetVersions(ctx context.Context, documentID string) ([]*DocumentVersion, error)
	GetByCustomer(ctx context.Context, tenantID, customerID string) ([]*Document, error)
	GetExpiring(ctx context.Context, tenantID string, before time.Time) ([]*Document, error)
}

type DocumentService struct {
	repo DocumentRepository
}

func NewDocumentService(repo DocumentRepository) *DocumentService {
	return &DocumentService{repo: repo}
}

func (s *DocumentService) Create(ctx context.Context, doc *Document) error {
	doc.ID = uuid.New().String()
	doc.CreatedAt = time.Now().UTC()
	doc.UpdatedAt = doc.CreatedAt
	doc.Version = 1
	if doc.Status == "" {
		doc.Status = StatusDraft
	}
	if doc.RetentionDays == 0 {
		doc.RetentionDays = retentionByCategory(doc.Category)
	}
	return s.repo.Create(ctx, doc)
}

func (s *DocumentService) Update(ctx context.Context, doc *Document) error {
	doc.UpdatedAt = time.Now().UTC()
	doc.Version++
	return s.repo.Update(ctx, doc)
}

func (s *DocumentService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *DocumentService) GetByID(ctx context.Context, id string) (*Document, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *DocumentService) List(ctx context.Context, tenantID string, category DocumentCategory, offset, limit int) ([]*Document, int64, error) {
	return s.repo.List(ctx, tenantID, category, offset, limit)
}

func (s *DocumentService) Search(ctx context.Context, tenantID, query string) ([]*Document, error) {
	return s.repo.Search(ctx, tenantID, query)
}

func (s *DocumentService) GetByCustomer(ctx context.Context, tenantID, customerID string) ([]*Document, error) {
	return s.repo.GetByCustomer(ctx, tenantID, customerID)
}

func (s *DocumentService) GetExpiring(ctx context.Context, tenantID string, daysAhead int) ([]*Document, error) {
	before := time.Now().Add(time.Duration(daysAhead) * 24 * time.Hour)
	return s.repo.GetExpiring(ctx, tenantID, before)
}

func retentionByCategory(cat DocumentCategory) int {
	switch cat {
	case CategoryKYC:
		return 2555 // 7 years
	case CategoryFinancial:
		return 2555
	case CategoryCompliance:
		return 3650 // 10 years
	case CategoryContract:
		return 3650
	case CategoryAudit:
		return 2555
	default:
		return 1095 // 3 years
	}
}

// HTTP Handler
type DocumentHandler struct {
	service *DocumentService
}

func NewDocumentHandler(service *DocumentService) *DocumentHandler {
	return &DocumentHandler{service: service}
}

func (h *DocumentHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/documents", h.List)
	mux.HandleFunc("POST /api/v1/documents", h.Create)
	mux.HandleFunc("GET /api/v1/documents/{id}", h.Get)
	mux.HandleFunc("PUT /api/v1/documents/{id}", h.Update)
	mux.HandleFunc("DELETE /api/v1/documents/{id}", h.Delete)
	mux.HandleFunc("GET /api/v1/documents/search", h.Search)
	mux.HandleFunc("GET /api/v1/documents/customer/{id}", h.GetByCustomer)
	mux.HandleFunc("GET /api/v1/documents/expiring", h.GetExpiring)
	mux.HandleFunc("POST /api/v1/documents/{id}/approve", h.Approve)
	mux.HandleFunc("POST /api/v1/documents/{id}/reject", h.Reject)
}

func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	category := DocumentCategory(r.URL.Query().Get("category"))
	docs, total, err := h.service.List(r.Context(), tenantID, category, 0, 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"documents": docs, "total": total})
}

func (h *DocumentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var doc Document
	json.NewDecoder(r.Body).Decode(&doc)
	if doc.TenantID == "" { doc.TenantID = r.Header.Get("X-Tenant-ID") }
	if err := h.service.Create(r.Context(), &doc); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var doc Document
	json.NewDecoder(r.Body).Decode(&doc)
	doc.ID = id
	if err := h.service.Update(r.Context(), &doc); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.service.Delete(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *DocumentHandler) Search(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	query := r.URL.Query().Get("q")
	docs, err := h.service.Search(r.Context(), tenantID, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

func (h *DocumentHandler) GetByCustomer(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	customerID := r.PathValue("id")
	docs, err := h.service.GetByCustomer(r.Context(), tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

func (h *DocumentHandler) GetExpiring(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	docs, err := h.service.GetExpiring(r.Context(), tenantID, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

func (h *DocumentHandler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	doc.Status = StatusApproved
	doc.ApprovedBy = r.Header.Get("X-User-ID")
	h.service.Update(r.Context(), doc)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func (h *DocumentHandler) Reject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	doc.Status = StatusRejected
	h.service.Update(r.Context(), doc)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func SeedDocuments() []*Document {
	now := time.Now().UTC()
	exp := now.Add(365 * 24 * time.Hour)
	return []*Document{
		{ID: "doc-001", TenantID: "tenant-acme-bank", Title: "KYC Policy v3.2", Category: CategoryKYC, Status: StatusApproved, Version: 3, SizeBytes: 245000, MimeType: "application/pdf", UploadedBy: "compliance@acmebank.ng", CreatedAt: now, UpdatedAt: now, ExpiresAt: &exp, RetentionDays: 2555},
		{ID: "doc-002", TenantID: "tenant-acme-bank", Title: "Q1 2025 Audit Report", Category: CategoryAudit, Status: StatusApproved, Version: 1, SizeBytes: 1250000, MimeType: "application/pdf", UploadedBy: "auditor@acmebank.ng", CreatedAt: now, UpdatedAt: now, RetentionDays: 2555},
		{ID: "doc-003", TenantID: "tenant-acme-bank", Title: "Agent Agreement Template", Category: CategoryContract, Status: StatusApproved, Version: 5, SizeBytes: 89000, MimeType: "application/docx", UploadedBy: "legal@acmebank.ng", CreatedAt: now, UpdatedAt: now, RetentionDays: 3650},
		{ID: "doc-004", TenantID: "tenant-acme-bank", Title: "NDPR Compliance Certificate", Category: CategoryCompliance, Status: StatusApproved, Version: 1, SizeBytes: 56000, MimeType: "application/pdf", UploadedBy: "dpo@acmebank.ng", CreatedAt: now, UpdatedAt: now, ExpiresAt: &exp, RetentionDays: 3650},
		{ID: "doc-005", TenantID: "tenant-acme-bank", Title: "Monthly Transaction Report", Category: CategoryFinancial, Status: StatusDraft, Version: 1, SizeBytes: 340000, MimeType: "application/xlsx", UploadedBy: "finance@acmebank.ng", CreatedAt: now, UpdatedAt: now, RetentionDays: 2555},
		{ID: "doc-006", TenantID: "tenant-nextgen-mfb", Title: "Onboarding Checklist", Category: CategoryOnboarding, Status: StatusPending, Version: 1, SizeBytes: 23000, MimeType: "application/pdf", UploadedBy: "ops@nextgenmfb.ng", CreatedAt: now, UpdatedAt: now, RetentionDays: 1095},
	}
}
