package versioning

import (
	"fmt"
	"time"
)

type APIVersion struct {
	Version      string
	Status       string // "current", "deprecated", "sunset"
	ReleasedAt   time.Time
	DeprecatedAt *time.Time
	SunsetAt     *time.Time
	Changes      []string
}

type EndpointRoute struct {
	Method  string
	Path    string
	Version string
	Handler string
	RateLimit int
	Auth    string // "bearer", "api_key", "mTLS"
}

type APIVersionManager struct {
	versions []APIVersion
	routes   []EndpointRoute
}

func NewAPIVersionManager() *APIVersionManager {
	m := &APIVersionManager{}
	m.initVersions()
	m.initRoutes()
	return m
}

func (m *APIVersionManager) initVersions() {
	m.versions = []APIVersion{
		{Version: "v1", Status: "current", ReleasedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			Changes: []string{"Initial API release", "NIP, NEFT, NDD endpoints", "Basic auth and rate limiting"}},
		{Version: "v2", Status: "current", ReleasedAt: time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC),
			Changes: []string{"ISO 20022 message support", "Multi-currency transfers", "Webhook callbacks",
				"Enhanced fraud scoring response", "Batch operations API"}},
	}
}

func (m *APIVersionManager) initRoutes() {
	m.routes = []EndpointRoute{
		// V1 routes
		{Method: "POST", Path: "/api/v1/transfers", Version: "v1", Handler: "CreateTransfer", RateLimit: 5000, Auth: "bearer"},
		{Method: "GET", Path: "/api/v1/transfers/:id", Version: "v1", Handler: "GetTransfer", RateLimit: 10000, Auth: "bearer"},
		{Method: "POST", Path: "/api/v1/neft/batches", Version: "v1", Handler: "SubmitBatch", RateLimit: 500, Auth: "bearer"},
		{Method: "POST", Path: "/api/v1/identity/bvn", Version: "v1", Handler: "VerifyBVN", RateLimit: 10000, Auth: "bearer"},
		{Method: "POST", Path: "/api/v1/identity/name-enquiry", Version: "v1", Handler: "NameEnquiry", RateLimit: 10000, Auth: "bearer"},
		// V2 routes (additions)
		{Method: "POST", Path: "/api/v2/transfers", Version: "v2", Handler: "CreateTransferV2", RateLimit: 5000, Auth: "bearer"},
		{Method: "POST", Path: "/api/v2/transfers/batch", Version: "v2", Handler: "BatchTransfer", RateLimit: 200, Auth: "mTLS"},
		{Method: "POST", Path: "/api/v2/iso20022/pain.001", Version: "v2", Handler: "ISO20022Payment", RateLimit: 1000, Auth: "mTLS"},
		{Method: "POST", Path: "/api/v2/webhooks/register", Version: "v2", Handler: "RegisterWebhook", RateLimit: 100, Auth: "bearer"},
		{Method: "POST", Path: "/api/v2/fraud/score", Version: "v2", Handler: "FraudScore", RateLimit: 5000, Auth: "mTLS"},
		// Health and management
		{Method: "GET", Path: "/health", Version: "all", Handler: "HealthCheck", RateLimit: 100000, Auth: "none"},
		{Method: "GET", Path: "/api/versions", Version: "all", Handler: "ListVersions", RateLimit: 1000, Auth: "none"},
	}
}

func (m *APIVersionManager) GetVersions() []APIVersion {
	return m.versions
}

func (m *APIVersionManager) GetRoutes(version string) []EndpointRoute {
	var routes []EndpointRoute
	for _, r := range m.routes {
		if r.Version == version || r.Version == "all" {
			routes = append(routes, r)
		}
	}
	return routes
}

func (m *APIVersionManager) GetAllRoutes() []EndpointRoute {
	return m.routes
}

func (m *APIVersionManager) IsVersionSupported(version string) bool {
	for _, v := range m.versions {
		if v.Version == version && v.Status != "sunset" {
			return true
		}
	}
	return false
}

func (m *APIVersionManager) GetDeprecationNotice(version string) (string, bool) {
	for _, v := range m.versions {
		if v.Version == version && v.Status == "deprecated" {
			return fmt.Sprintf("API %s is deprecated. Please migrate to the latest version by %s",
				version, v.SunsetAt), true
		}
	}
	return "", false
}
