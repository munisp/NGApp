package tenant

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	TenantContextKey contextKey = "tenant"
	TenantIDHeader   string     = "X-Tenant-ID"
)

// ResolutionStrategy defines how tenant is resolved from a request
type ResolutionStrategy int

const (
	// ResolveFromHeader extracts tenant from X-Tenant-ID header
	ResolveFromHeader ResolutionStrategy = iota
	// ResolveFromSubdomain extracts tenant slug from subdomain (e.g., acme-bank.crm.example.com)
	ResolveFromSubdomain
	// ResolveFromJWT extracts tenant from JWT claims
	ResolveFromJWT
	// ResolveFromPath extracts tenant from URL path prefix (e.g., /t/acme-bank/...)
	ResolveFromPath
)

// Middleware resolves the current tenant from the request and injects it into context
type Middleware struct {
	service    *TenantService
	strategies []ResolutionStrategy
	defaultID  string
}

// NewMiddleware creates tenant resolution middleware
func NewMiddleware(service *TenantService, defaultID string, strategies ...ResolutionStrategy) *Middleware {
	if len(strategies) == 0 {
		strategies = []ResolutionStrategy{ResolveFromHeader, ResolveFromSubdomain}
	}
	return &Middleware{
		service:    service,
		strategies: strategies,
		defaultID:  defaultID,
	}
}

// Handler wraps an HTTP handler with tenant resolution
func (m *Middleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := m.resolve(r)
		if tenantID == "" {
			tenantID = m.defaultID
		}

		tenant, err := m.service.GetTenant(r.Context(), tenantID)
		if err != nil {
			http.Error(w, "tenant not found", http.StatusNotFound)
			return
		}

		if tenant.Status == StatusSuspended {
			http.Error(w, "tenant suspended", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), TenantContextKey, tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// resolve tries each strategy in order and returns the first match
func (m *Middleware) resolve(r *http.Request) string {
	for _, strategy := range m.strategies {
		switch strategy {
		case ResolveFromHeader:
			if id := r.Header.Get(TenantIDHeader); id != "" {
				return id
			}
		case ResolveFromSubdomain:
			if id := m.resolveSubdomain(r); id != "" {
				return id
			}
		case ResolveFromJWT:
			if id := m.resolveJWT(r); id != "" {
				return id
			}
		case ResolveFromPath:
			if id := m.resolvePath(r); id != "" {
				return id
			}
		}
	}
	return ""
}

func (m *Middleware) resolveSubdomain(r *http.Request) string {
	host := r.Host
	parts := strings.Split(host, ".")
	if len(parts) >= 3 {
		slug := parts[0]
		tenant, err := m.service.GetTenantBySlug(r.Context(), slug)
		if err == nil {
			return tenant.ID
		}
	}
	return ""
}

func (m *Middleware) resolveJWT(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	// In production: decode JWT, extract tenant_id claim from Keycloak token
	// For now, the tenant_id is passed via header by APISIX after JWT validation
	return ""
}

func (m *Middleware) resolvePath(r *http.Request) string {
	// Matches /t/{tenant-slug}/...
	if strings.HasPrefix(r.URL.Path, "/t/") {
		parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/t/"), "/", 2)
		if len(parts) > 0 {
			tenant, err := m.service.GetTenantBySlug(r.Context(), parts[0])
			if err == nil {
				return tenant.ID
			}
		}
	}
	return ""
}

// FromContext extracts the tenant from the request context
func FromContext(ctx context.Context) *Tenant {
	tenant, _ := ctx.Value(TenantContextKey).(*Tenant)
	return tenant
}

// ProductGuard middleware checks that the tenant has access to a specific product
func ProductGuard(product Product) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenant := FromContext(r.Context())
			if tenant == nil {
				http.Error(w, "no tenant in context", http.StatusUnauthorized)
				return
			}

			if !tenant.Products[product] {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error":"product_not_enabled","product":"` + string(product) + `","tenant":"` + tenant.ID + `"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
