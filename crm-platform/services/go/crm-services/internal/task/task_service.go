package task

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// Task Management Service — workflow tasks, approvals, escalations,
// SLA tracking, and team assignment for CRM operations

type Task struct {
	ID           string        `json:"id" db:"id"`
	TenantID     string        `json:"tenant_id" db:"tenant_id"`
	Title        string        `json:"title" db:"title"`
	Description  string        `json:"description" db:"description"`
	Type         TaskType      `json:"type" db:"type"`
	Priority     TaskPriority  `json:"priority" db:"priority"`
	Status       TaskStatus    `json:"status" db:"status"`
	AssigneeID   string        `json:"assignee_id" db:"assignee_id"`
	AssigneeName string        `json:"assignee_name" db:"assignee_name"`
	ReporterID   string        `json:"reporter_id" db:"reporter_id"`
	DueDate      *time.Time    `json:"due_date,omitempty" db:"due_date"`
	CompletedAt  *time.Time    `json:"completed_at,omitempty" db:"completed_at"`
	SLADeadline  *time.Time    `json:"sla_deadline,omitempty" db:"sla_deadline"`
	SLABreached  bool          `json:"sla_breached" db:"sla_breached"`
	RelatedType  string        `json:"related_type,omitempty" db:"related_type"`
	RelatedID    string        `json:"related_id,omitempty" db:"related_id"`
	Tags         []string      `json:"tags"`
	Comments     []TaskComment `json:"comments,omitempty"`
	CreatedAt    time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at" db:"updated_at"`
}

type TaskType string

const (
	TypeKYCReview      TaskType = "kyc_review"
	TypeApproval       TaskType = "approval"
	TypeFollowUp       TaskType = "follow_up"
	TypeEscalation     TaskType = "escalation"
	TypeOnboarding     TaskType = "onboarding"
	TypeCompliance     TaskType = "compliance"
	TypeDispute        TaskType = "dispute"
	TypeMaintenance    TaskType = "maintenance"
	TypeCampaign       TaskType = "campaign"
	TypeGeneral        TaskType = "general"
)

type TaskPriority string

const (
	PriorityCritical TaskPriority = "critical"
	PriorityHigh     TaskPriority = "high"
	PriorityMedium   TaskPriority = "medium"
	PriorityLow      TaskPriority = "low"
)

type TaskStatus string

const (
	StatusOpen       TaskStatus = "open"
	StatusInProgress TaskStatus = "in_progress"
	StatusBlocked    TaskStatus = "blocked"
	StatusReview     TaskStatus = "review"
	StatusDone       TaskStatus = "done"
	StatusCancelled  TaskStatus = "cancelled"
)

type TaskComment struct {
	ID        string    `json:"id"`
	AuthorID  string    `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type TaskStats struct {
	TotalTasks    int64            `json:"total_tasks"`
	ByStatus      map[string]int64 `json:"by_status"`
	ByPriority    map[string]int64 `json:"by_priority"`
	ByType        map[string]int64 `json:"by_type"`
	Overdue       int64            `json:"overdue"`
	SLABreached   int64            `json:"sla_breached"`
	CompletedToday int64           `json:"completed_today"`
	AvgResolutionHours float64    `json:"avg_resolution_hours"`
}

type TaskRepository interface {
	Create(ctx context.Context, task *Task) error
	Update(ctx context.Context, task *Task) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*Task, error)
	List(ctx context.Context, tenantID string, status TaskStatus, offset, limit int) ([]*Task, int64, error)
	GetByAssignee(ctx context.Context, tenantID, assigneeID string) ([]*Task, error)
	GetStats(ctx context.Context, tenantID string) (*TaskStats, error)
	GetOverdue(ctx context.Context, tenantID string) ([]*Task, error)
}

type TaskService struct {
	repo TaskRepository
}

func NewTaskService(repo TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(ctx context.Context, task *Task) error {
	task.ID = uuid.New().String()
	task.CreatedAt = time.Now().UTC()
	task.UpdatedAt = task.CreatedAt
	if task.Status == "" {
		task.Status = StatusOpen
	}
	if task.SLADeadline == nil {
		sla := slaByType(task.Type)
		deadline := task.CreatedAt.Add(sla)
		task.SLADeadline = &deadline
	}
	return s.repo.Create(ctx, task)
}

func (s *TaskService) Update(ctx context.Context, task *Task) error {
	task.UpdatedAt = time.Now().UTC()
	if task.Status == StatusDone && task.CompletedAt == nil {
		now := time.Now().UTC()
		task.CompletedAt = &now
	}
	if task.SLADeadline != nil && time.Now().After(*task.SLADeadline) && task.Status != StatusDone {
		task.SLABreached = true
	}
	return s.repo.Update(ctx, task)
}

func slaByType(t TaskType) time.Duration {
	switch t {
	case TypeKYCReview:
		return 24 * time.Hour
	case TypeApproval:
		return 4 * time.Hour
	case TypeEscalation:
		return 2 * time.Hour
	case TypeDispute:
		return 48 * time.Hour
	case TypeCompliance:
		return 72 * time.Hour
	default:
		return 24 * time.Hour
	}
}

// HTTP Handler
type TaskHandler struct {
	service *TaskService
}

func NewTaskHandler(service *TaskService) *TaskHandler {
	return &TaskHandler{service: service}
}

func (h *TaskHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/tasks", h.List)
	mux.HandleFunc("POST /api/v1/tasks", h.Create)
	mux.HandleFunc("GET /api/v1/tasks/{id}", h.Get)
	mux.HandleFunc("PUT /api/v1/tasks/{id}", h.Update)
	mux.HandleFunc("DELETE /api/v1/tasks/{id}", h.Delete)
	mux.HandleFunc("GET /api/v1/tasks/stats", h.GetStats)
	mux.HandleFunc("GET /api/v1/tasks/my", h.GetMyTasks)
	mux.HandleFunc("POST /api/v1/tasks/{id}/comment", h.AddComment)
	mux.HandleFunc("POST /api/v1/tasks/{id}/assign", h.Assign)
	mux.HandleFunc("POST /api/v1/tasks/{id}/complete", h.Complete)
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	status := TaskStatus(r.URL.Query().Get("status"))
	tasks, total, err := h.service.repo.List(r.Context(), tenantID, status, 0, 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"tasks": tasks, "total": total})
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var task Task
	json.NewDecoder(r.Body).Decode(&task)
	if task.TenantID == "" { task.TenantID = r.Header.Get("X-Tenant-ID") }
	h.service.Create(r.Context(), &task)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(task)
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.service.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var task Task
	json.NewDecoder(r.Body).Decode(&task)
	task.ID = id
	h.service.Update(r.Context(), &task)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.service.repo.Delete(r.Context(), id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	stats, err := h.service.repo.GetStats(r.Context(), tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *TaskHandler) GetMyTasks(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" { tenantID = "tenant-acme-bank" }
	userID := r.Header.Get("X-User-ID")
	tasks, err := h.service.repo.GetByAssignee(r.Context(), tenantID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func (h *TaskHandler) AddComment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "comment_added"})
}

func (h *TaskHandler) Assign(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "assigned"})
}

func (h *TaskHandler) Complete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.service.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	task.Status = StatusDone
	now := time.Now().UTC()
	task.CompletedAt = &now
	h.service.Update(r.Context(), task)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func SeedTasks() []*Task {
	now := time.Now().UTC()
	due := now.Add(24 * time.Hour)
	sla := now.Add(4 * time.Hour)
	return []*Task{
		{ID: "task-001", TenantID: "tenant-acme-bank", Title: "Review KYC for Adebayo Okonkwo", Type: TypeKYCReview, Priority: PriorityHigh, Status: StatusOpen, AssigneeID: "user-001", AssigneeName: "Compliance Officer", DueDate: &due, SLADeadline: &sla, CreatedAt: now, UpdatedAt: now},
		{ID: "task-002", TenantID: "tenant-acme-bank", Title: "Approve Agent Onboarding - Lagos Zone", Type: TypeApproval, Priority: PriorityMedium, Status: StatusInProgress, AssigneeID: "user-002", AssigneeName: "Operations Manager", DueDate: &due, CreatedAt: now, UpdatedAt: now},
		{ID: "task-003", TenantID: "tenant-acme-bank", Title: "Resolve disputed transaction TXN-4521", Type: TypeDispute, Priority: PriorityCritical, Status: StatusOpen, AssigneeID: "user-003", AssigneeName: "Dispute Handler", DueDate: &due, CreatedAt: now, UpdatedAt: now},
		{ID: "task-004", TenantID: "tenant-acme-bank", Title: "Monthly compliance report filing", Type: TypeCompliance, Priority: PriorityMedium, Status: StatusReview, AssigneeID: "user-001", AssigneeName: "Compliance Officer", DueDate: &due, CreatedAt: now, UpdatedAt: now},
		{ID: "task-005", TenantID: "tenant-acme-bank", Title: "Campaign review - Q2 Cross-sell", Type: TypeCampaign, Priority: PriorityLow, Status: StatusOpen, AssigneeID: "user-004", AssigneeName: "Marketing Lead", DueDate: &due, CreatedAt: now, UpdatedAt: now},
		{ID: "task-006", TenantID: "tenant-nextgen-mfb", Title: "Complete technical onboarding", Type: TypeOnboarding, Priority: PriorityHigh, Status: StatusInProgress, AssigneeID: "user-005", AssigneeName: "Technical Lead", DueDate: &due, CreatedAt: now, UpdatedAt: now},
	}
}
