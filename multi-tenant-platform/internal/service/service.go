package service

import (
	"fmt"
	"multi-tenant-platform/internal/models"
	"multi-tenant-platform/internal/repository"
	"strings"
	"time"
)

type TenantService struct { repo *repository.TenantRepository }
func NewTenantService(repo *repository.TenantRepository) *TenantService { return &TenantService{repo: repo} }

type CreateTenantRequest struct {
	Name    string `json:"name"`
	Country string `json:"country"`
	Plan    string `json:"plan"`
}

var planLimits = map[string]struct{ users, policies, storageMB int; features []string }{
	"starter":      {10, 1000, 1000, []string{"claims", "policies"}},
	"professional": {200, 50000, 25000, []string{"claims", "underwriting", "analytics"}},
	"enterprise":   {500, 100000, 50000, []string{"claims", "underwriting", "reinsurance", "analytics", "api", "takaful"}},
}

func (s *TenantService) CreateTenant(req CreateTenantRequest) (*models.Tenant, error) {
	if req.Name == "" { return nil, fmt.Errorf("name is required") }
	limits, ok := planLimits[req.Plan]
	if !ok { return nil, fmt.Errorf("invalid plan: %s (use starter, professional, enterprise)", req.Plan) }

	slug := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
	currencyMap := map[string]string{"NG": "NGN", "KE": "KES", "GH": "GHS", "ZA": "ZAR", "EG": "EGP"}
	currency := currencyMap[req.Country]
	if currency == "" { currency = "USD" }

	tenant := &models.Tenant{
		ID: fmt.Sprintf("TNT-%d", time.Now().UnixNano()%10000000),
		Name: req.Name, Slug: slug, Plan: req.Plan, Status: "active",
		Country: req.Country, Currency: currency,
		MaxUsers: limits.users, MaxPolicies: limits.policies,
		StorageLimitMB: limits.storageMB, Features: limits.features,
		CreatedAt: time.Now(),
	}
	if err := s.repo.Create(tenant); err != nil { return nil, err }
	return tenant, nil
}

func (s *TenantService) GetTenant(id string) (*models.Tenant, error) { return s.repo.GetByID(id) }
func (s *TenantService) GetTenantBySlug(slug string) (*models.Tenant, error) { return s.repo.GetBySlug(slug) }
func (s *TenantService) ListTenants(plan, status string) []models.Tenant { return s.repo.List(plan, status) }

type AddUserRequest struct {
	TenantID string `json:"tenant_id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

func (s *TenantService) AddUser(req AddUserRequest) (*models.TenantUser, error) {
	tenant, err := s.repo.GetByID(req.TenantID)
	if err != nil { return nil, err }
	if tenant.CurrentUsers >= tenant.MaxUsers {
		return nil, fmt.Errorf("tenant %s has reached user limit (%d)", req.TenantID, tenant.MaxUsers)
	}
	user := models.TenantUser{
		ID: fmt.Sprintf("TU-%d", time.Now().UnixNano()%10000000),
		TenantID: req.TenantID, Email: req.Email, Name: req.Name,
		Role: req.Role, Status: "active", JoinedAt: time.Now(),
	}
	s.repo.AddUser(user)
	return &user, nil
}

func (s *TenantService) GetUsers(tenantID string) []models.TenantUser { return s.repo.GetUsers(tenantID) }
func (s *TenantService) GetStats() map[string]interface{} { return s.repo.GetStats() }
