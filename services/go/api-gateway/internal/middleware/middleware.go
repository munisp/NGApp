// Package middleware provides HTTP middleware for the API Gateway.
// Implements: CORS, JWT auth, rate limiting, request ID, structured logging.
package middleware

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/og-rmm/api-gateway/internal/auth"
)

type contextKey string

const (
	ClaimsKey    contextKey = "claims"
	RequestIDKey contextKey = "request_id"
)

// Verifier is the interface for JWT verification.
type Verifier interface {
	Verify(ctx context.Context, token string) (*auth.Claims, error)
}

// Chain applies middleware in reverse order (last applied = outermost).
func Chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// CORS adds permissive CORS headers suitable for the operator dashboard.
func CORS() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID, X-Tenant-ID")
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID, X-RateLimit-Remaining")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// JWT validates Bearer tokens and injects Claims into context.
func JWT(v Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeError(w, http.StatusUnauthorized, "missing Authorization header")
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				writeError(w, http.StatusUnauthorized, "invalid Authorization format; expected 'Bearer <token>'")
				return
			}
			claims, err := v.Verify(r.Context(), parts[1])
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token: "+err.Error())
				return
			}
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// rateLimiter is a simple token-bucket rate limiter per IP.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	limit   int
	window  time.Duration
}

type bucket struct {
	count    int
	resetAt  time.Time
}

// RateLimit limits requests to `limit` per `window` per remote IP.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := &rateLimiter{
		buckets: make(map[string]*bucket),
		limit:   limit,
		window:  window,
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := realIP(r)
			rl.mu.Lock()
			b, ok := rl.buckets[ip]
			if !ok || time.Now().After(b.resetAt) {
				b = &bucket{count: 0, resetAt: time.Now().Add(window)}
				rl.buckets[ip] = b
			}
			b.count++
			remaining := rl.limit - b.count
			rl.mu.Unlock()

			w.Header().Set("X-RateLimit-Limit", intToStr(rl.limit))
			w.Header().Set("X-RateLimit-Remaining", intToStr(max(0, remaining)))

			if remaining < 0 {
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequestID injects a unique request ID into the context and response header.
func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get("X-Request-ID")
			if id == "" {
				id = generateID()
			}
			w.Header().Set("X-Request-ID", id)
			ctx := context.WithValue(r.Context(), RequestIDKey, id)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Logger logs each request with structured fields.
func Logger() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rw, r)
			slog.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rw.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"ip", realIP(r),
				"request_id", r.Context().Value(RequestIDKey),
			)
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":  msg,
		"code":   code,
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

func intToStr(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

var idCounter uint64
var idMu sync.Mutex

func generateID() string {
	idMu.Lock()
	idCounter++
	v := idCounter
	idMu.Unlock()
	return "req-" + intToStr(int(v))
}
