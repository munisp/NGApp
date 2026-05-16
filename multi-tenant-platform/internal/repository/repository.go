package repository

import (
	"fmt"
	"multi-tenant-platform/internal/models"
	"sync"
	"time"
)

type TenantRepository struct {
	mu      sync.RWMutex
	tenants map[string]*models.Tenant
	users   map[string][]models.TenantUser
	usage   []models.UsageRecord
}

func NewTenantRepository() *TenantRepository {
	repo := &TenantRepository{
		tenants: make(map[string]*models.Tenant),
		users:   make(map[string][]models.TenantUser),
	}
	repo.seedTenants()
	return repo
}

func (r *TenantRepository) seedTenants() {
	tenants := []models.Tenant{
		{ID: "TNT-001", Name: "AXA Mansard Nigeria", Slug: "axa-mansard", Plan: "enterprise", Status: "active", Country: "NG", Currency: "NGN", MaxUsers: 500, MaxPolicies: 100000, CurrentUsers: 120, CurrentPolicies: 45000, StorageUsedMB: 8500, StorageLimitMB: 50000, Features: []string{"claims", "underwriting", "reinsurance", "analytics", "api"}, CreatedAt: time.Now().AddDate(-2, 0, 0)},
		{ID: "TNT-002", Name: "Leadway Assurance", Slug: "leadway", Plan: "professional", Status: "active", Country: "NG", Currency: "NGN", MaxUsers: 200, MaxPolicies: 50000, CurrentUsers: 85, CurrentPolicies: 22000, StorageUsedMB: 4200, StorageLimitMB: 25000, Features: []string{"claims", "underwriting", "analytics"}, CreatedAt: time.Now().AddDate(-1, -6, 0)},
		{ID: "TNT-003", Name: "Jubilee Insurance Kenya", Slug: "jubilee-ke", Plan: "enterprise", Status: "active", Country: "KE", Currency: "KES", MaxUsers: 300, MaxPolicies: 75000, CurrentUsers: 95, CurrentPolicies: 38000, StorageUsedMB: 6100, StorageLimitMB: 50000, Features: []string{"claims", "underwriting", "reinsurance", "analytics", "api", "takaful"}, CreatedAt: time.Now().AddDate(-1, 0, 0)},
	}
	for i := range tenants {
		r.tenants[tenants[i].ID] = &tenants[i]
	}
}

func (r *TenantRepository) Create(t *models.Tenant) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tenants[t.ID] = t
	return nil
}

func (r *TenantRepository) GetByID(id string) (*models.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tenants[id]
	if !ok { return nil, fmt.Errorf("tenant %s not found", id) }
	return t, nil
}

func (r *TenantRepository) GetBySlug(slug string) (*models.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, t := range r.tenants {
		if t.Slug == slug { return t, nil }
	}
	return nil, fmt.Errorf("tenant with slug %s not found", slug)
}

func (r *TenantRepository) List(plan, status string) []models.Tenant {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Tenant
	for _, t := range r.tenants {
		if plan != "" && t.Plan != plan { continue }
		if status != "" && t.Status != status { continue }
		result = append(result, *t)
	}
	return result
}

func (r *TenantRepository) Update(t *models.Tenant) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tenants[t.ID] = t
}

func (r *TenantRepository) AddUser(u models.TenantUser) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[u.TenantID] = append(r.users[u.TenantID], u)
	if t, ok := r.tenants[u.TenantID]; ok { t.CurrentUsers++ }
}

func (r *TenantRepository) GetUsers(tenantID string) []models.TenantUser {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.users[tenantID]
}

func (r *TenantRepository) RecordUsage(u models.UsageRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.usage = append(r.usage, u)
}

func (r *TenantRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	active := 0; totalPolicies := 0; totalUsers := 0
	for _, t := range r.tenants {
		if t.Status == "active" { active++ }
		totalPolicies += t.CurrentPolicies
		totalUsers += t.CurrentUsers
	}
	return map[string]interface{}{
		"total_tenants": len(r.tenants), "active_tenants": active,
		"total_policies": totalPolicies, "total_users": totalUsers,
	}
}
