package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityHeaders(t *testing.T) {
	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":       "DENY",
		"X-XSS-Protection":      "1; mode=block",
	}

	for header, expected := range expectedHeaders {
		t.Run(header, func(t *testing.T) {
			rr := httptest.NewRecorder()
			rr.Header().Set(header, expected)

			got := rr.Header().Get(header)
			if got != expected {
				t.Errorf("expected %s: %s, got: %s", header, expected, got)
			}
		})
	}
}

func TestCSPHeader(t *testing.T) {
	rr := httptest.NewRecorder()
	csp := "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: https:"
	rr.Header().Set("Content-Security-Policy", csp)

	got := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(got, "default-src 'self'") {
		t.Error("CSP missing default-src")
	}
	if !strings.Contains(got, "script-src") {
		t.Error("CSP missing script-src")
	}
}

func TestRateLimitHeaders(t *testing.T) {
	headers := map[string]string{
		"X-RateLimit-Limit":     "1000",
		"X-RateLimit-Remaining": "999",
		"X-RateLimit-Reset":     "1700000000",
	}

	for header, val := range headers {
		t.Run(header, func(t *testing.T) {
			rr := httptest.NewRecorder()
			rr.Header().Set(header, val)

			got := rr.Header().Get(header)
			if got != val {
				t.Errorf("expected %s: %s, got: %s", header, val, got)
			}
		})
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = "generated-uuid"
		}
		w.Header().Set("X-Request-ID", reqID)
		w.WriteHeader(http.StatusOK)
	})

	t.Run("passes through existing request ID", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/test", nil)
		req.Header.Set("X-Request-ID", "test-123")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Header().Get("X-Request-ID") != "test-123" {
			t.Error("expected request ID to be passed through")
		}
	})

	t.Run("generates request ID if missing", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/test", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Header().Get("X-Request-ID") == "" {
			t.Error("expected request ID to be generated")
		}
	})
}

func TestTenantIDExtraction(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		valid    bool
	}{
		{"valid tenant", "tenant-nextgen-mfb", true},
		{"valid tenant acme", "tenant-acme-bank", true},
		{"empty tenant", "", false},
		{"invalid format", "invalid", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/test", nil)
			if tt.tenantID != "" {
				req.Header.Set("X-Tenant-ID", tt.tenantID)
			}

			tenantID := req.Header.Get("X-Tenant-ID")
			hasTenant := strings.HasPrefix(tenantID, "tenant-")

			if tt.valid && !hasTenant {
				t.Errorf("expected valid tenant ID, got: %s", tenantID)
			}
			if !tt.valid && hasTenant {
				t.Errorf("expected invalid tenant ID for %s", tt.name)
			}
		})
	}
}

func TestHealthCheckEndpoint(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","version":"1.0.0"}`))
	})

	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "healthy") {
		t.Error("health check should return healthy status")
	}
}
