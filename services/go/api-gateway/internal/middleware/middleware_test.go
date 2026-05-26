// Package middleware — unit tests for API gateway middleware.
// Tests cover: CORS headers, JWT extraction, Chain composition, rate limiter.
// Run: go test ./internal/middleware/... -v
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// ── CORS middleware tests ─────────────────────────────────────────────────────

func TestCORS_AddsAccessControlHeaders(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := CORS()(handler)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/wells", nil)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want *", resp.Header.Get("Access-Control-Allow-Origin"))
	}
	if resp.Header.Get("Access-Control-Allow-Methods") == "" {
		t.Error("Access-Control-Allow-Methods should not be empty")
	}
}

func TestCORS_OptionsReturns204(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := CORS()(handler)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/wells", nil)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("OPTIONS status = %d, want 204", resp.StatusCode)
	}
}

func TestCORS_ExposesRequestIDHeader(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := CORS()(handler)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alarms", nil)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()
	expose := resp.Header.Get("Access-Control-Expose-Headers")
	if expose == "" {
		t.Error("Access-Control-Expose-Headers should not be empty")
	}
}

// ── JWT middleware tests ──────────────────────────────────────────────────────

func TestJWT_MissingAuthHeader(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := JWT(nil)(handler)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/wells", nil)
	// No Authorization header
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("missing auth header status = %d, want 401", resp.StatusCode)
	}
}

func TestJWT_InvalidAuthFormat(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := JWT(nil)(handler)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/wells", nil)
	req.Header.Set("Authorization", "InvalidFormat token123")
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()
	// Should still return 401 since "InvalidFormat" is not "Bearer"
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("invalid auth format status = %d, want 401", resp.StatusCode)
	}
}

// ── Chain composition tests ───────────────────────────────────────────────────

func TestChain_AppliesMiddlewareInOrder(t *testing.T) {
	order := []string{}

	m1 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "m1-before")
			next.ServeHTTP(w, r)
			order = append(order, "m1-after")
		})
	}
	m2 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "m2-before")
			next.ServeHTTP(w, r)
			order = append(order, "m2-after")
		})
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "handler")
		w.WriteHeader(http.StatusOK)
	})

	chained := Chain(handler, m1, m2)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	chained.ServeHTTP(w, req)

	// Chain applies in reverse, so m1 is outermost: m1 → m2 → handler
	expected := []string{"m1-before", "m2-before", "handler", "m2-after", "m1-after"}
	if len(order) != len(expected) {
		t.Fatalf("chain order length = %d, want %d: got %v", len(order), len(expected), order)
	}
	for i, v := range expected {
		if order[i] != v {
			t.Errorf("chain order[%d] = %s, want %s", i, order[i], v)
		}
	}
}

func TestChain_NoMiddleware(t *testing.T) {
	called := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	chained := Chain(handler)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	chained.ServeHTTP(w, req)

	if !called {
		t.Error("handler should be called with no middleware")
	}
}
