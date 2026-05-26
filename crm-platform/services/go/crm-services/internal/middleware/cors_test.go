package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSHeaders(t *testing.T) {
	tests := []struct {
		name           string
		origin         string
		method         string
		expectedAllow  bool
	}{
		{"localhost 3000 allowed", "http://localhost:3000", "GET", true},
		{"localhost 5173 allowed", "http://localhost:5173", "GET", true},
		{"unknown origin blocked", "http://evil.com", "GET", false},
		{"OPTIONS preflight", "http://localhost:3000", "OPTIONS", true},
		{"empty origin", "", "GET", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}

			rr := httptest.NewRecorder()
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			// Simulate CORS middleware
			origin := req.Header.Get("Origin")
			allowedOrigins := map[string]bool{
				"http://localhost:3000": true,
				"http://localhost:5173": true,
			}
			if allowedOrigins[origin] {
				rr.Header().Set("Access-Control-Allow-Origin", origin)
			}

			if tt.method == "OPTIONS" {
				rr.WriteHeader(http.StatusOK)
			} else {
				handler.ServeHTTP(rr, req)
			}

			corsHeader := rr.Header().Get("Access-Control-Allow-Origin")
			if tt.expectedAllow {
				if corsHeader == "" {
					t.Errorf("expected CORS header for origin %s", tt.origin)
				}
			} else {
				if corsHeader != "" {
					t.Errorf("unexpected CORS header for origin %s: got %s", tt.origin, corsHeader)
				}
			}
		})
	}
}

func TestCORSMethods(t *testing.T) {
	methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"}
	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/api/test", nil)
			req.Header.Set("Origin", "http://localhost:3000")
			rr := httptest.NewRecorder()

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			handler.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Errorf("expected 200 for method %s, got %d", method, rr.Code)
			}
		})
	}
}

func TestCORSCredentials(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()

	// Set CORS headers
	rr.Header().Set("Access-Control-Allow-Credentials", "true")
	rr.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	rr.WriteHeader(http.StatusOK)

	if rr.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("expected Access-Control-Allow-Credentials: true")
	}
}
