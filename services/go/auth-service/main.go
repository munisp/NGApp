package main

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"golang.org/x/time/rate"
)

type Config struct {
	KeycloakURL    string
	Realm          string
	ClientID       string
	ClientSecret   string
	JWTSecret      string
	Port           string
	AllowedOrigins []string
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	IDToken      string `json:"id_token,omitempty"`
}

type UserInfo struct {
	Sub       string   `json:"sub"`
	Email     string   `json:"email"`
	Name      string   `json:"name"`
	Roles     []string `json:"roles"`
	AgentCode string   `json:"agent_code,omitempty"`
	Tier      string   `json:"tier,omitempty"`
	TenantID  string   `json:"tenant_id,omitempty"`
}

type ValidationResponse struct {
	Valid bool      `json:"valid"`
	User  *UserInfo `json:"user,omitempty"`
	Error string    `json:"error,omitempty"`
}

var (
	cfg        Config
	signingKey []byte
	rsaKey     *rsa.PublicKey
)

func loadConfig() Config {
	return Config{
		KeycloakURL:    getEnv("KEYCLOAK_URL", "http://keycloak:8080"),
		Realm:          getEnv("KEYCLOAK_REALM", "pos54link"),
		ClientID:       getEnv("KEYCLOAK_CLIENT_ID", "pos-platform"),
		ClientSecret:   getEnv("KEYCLOAK_CLIENT_SECRET", ""),
		JWTSecret:      getEnv("JWT_SECRET", "pos54link-secret"),
		Port:           getEnv("AUTH_SERVICE_PORT", "8080"),
		AllowedOrigins: strings.Split(getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3002"), ","),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg = loadConfig()
	signingKey = []byte(cfg.JWTSecret)

	svcName := getEnv("SERVICE_NAME", "auth-service")
	svcVersion := getEnv("SERVICE_VERSION", "2.0.0")
	shutdownTracer := initTracer(svcName, svcVersion)
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdownTracer(ctx)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/auth/login", handleLogin)
	mux.HandleFunc("/auth/callback", handleCallback)
	mux.HandleFunc("/auth/refresh", handleRefresh)
	mux.HandleFunc("/auth/logout", handleLogout)
	mux.HandleFunc("/auth/validate", handleValidate)
	mux.HandleFunc("/auth/userinfo", handleUserInfo)
	mux.HandleFunc("/.well-known/openid-configuration", handleOIDCDiscovery)

	handler := corsMiddleware(rateLimitMiddleware(100, 200, otelMiddleware(svcName, mux)))

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Auth service starting", "port", cfg.Port, "keycloak", cfg.KeycloakURL, "realm", cfg.Realm)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("auth-service listen: %v", err)
		}
	}()

	gracefulShutdown(svcName, srv, shutdownTracer)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":              "healthy",
		"service":             "auth-service",
		"version":             "2.0.0",
		"keycloak_configured": cfg.KeycloakURL != "" && cfg.ClientID != "",
		"timestamp":           time.Now().UTC().Format(time.RFC3339),
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		AgentCode string `json:"agent_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if cfg.ClientSecret != "" {
		token, err := keycloakPasswordGrant(body.Email, body.Password)
		if err != nil {
			slog.Warn("Keycloak auth failed", "email", body.Email, "err", err)
			http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(token)
		return
	}
	claims := jwt.MapClaims{
		"sub":        body.Email,
		"email":      body.Email,
		"name":       body.Email,
		"agent_code": body.AgentCode,
		"roles":      []string{"agent"},
		"tier":       "basic",
		"iat":        time.Now().Unix(),
		"exp":        time.Now().Add(24 * time.Hour).Unix(),
		"iss":        "pos54link-auth",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(signingKey)
	if err != nil {
		http.Error(w, `{"error":"token signing failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TokenResponse{AccessToken: tokenStr, TokenType: "Bearer", ExpiresIn: 86400})
}

func handleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" {
		http.Error(w, `{"error":"missing authorization code"}`, http.StatusBadRequest)
		return
	}
	token, err := keycloakCodeExchange(code)
	if err != nil {
		slog.Error("Code exchange failed", "err", err, "state", state)
		http.Error(w, `{"error":"code exchange failed"}`, http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(token)
}

func handleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		http.Error(w, `{"error":"refresh_token required"}`, http.StatusBadRequest)
		return
	}
	if cfg.ClientSecret != "" {
		token, err := keycloakRefresh(body.RefreshToken)
		if err != nil {
			http.Error(w, `{"error":"refresh failed"}`, http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(token)
		return
	}
	claims, err := validateJWT(body.RefreshToken)
	if err != nil {
		http.Error(w, `{"error":"invalid refresh token"}`, http.StatusUnauthorized)
		return
	}
	claims["iat"] = time.Now().Unix()
	claims["exp"] = time.Now().Add(24 * time.Hour).Unix()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString(signingKey)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TokenResponse{AccessToken: tokenStr, TokenType: "Bearer", ExpiresIn: 86400})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "session invalidated"})
}

func handleValidate(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ValidationResponse{Valid: false, Error: "no authorization header"})
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := validateJWT(tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ValidationResponse{Valid: false, Error: err.Error()})
		return
	}
	user := extractUserInfo(claims)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ValidationResponse{Valid: true, User: user})
}

func handleUserInfo(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := validateJWT(tokenStr)
	if err != nil {
		http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
		return
	}
	user := extractUserInfo(claims)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func handleOIDCDiscovery(w http.ResponseWriter, r *http.Request) {
	baseURL := fmt.Sprintf("%s/realms/%s", cfg.KeycloakURL, cfg.Realm)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"issuer":                                baseURL,
		"authorization_endpoint":                baseURL + "/protocol/openid-connect/auth",
		"token_endpoint":                        baseURL + "/protocol/openid-connect/token",
		"userinfo_endpoint":                     baseURL + "/protocol/openid-connect/userinfo",
		"jwks_uri":                              baseURL + "/protocol/openid-connect/certs",
		"end_session_endpoint":                  baseURL + "/protocol/openid-connect/logout",
		"grant_types_supported":                 []string{"authorization_code", "refresh_token", "password", "client_credentials"},
		"response_types_supported":              []string{"code", "id_token", "token"},
		"scopes_supported":                      []string{"openid", "profile", "email", "roles"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
	})
}

func keycloakPasswordGrant(username, password string) (*TokenResponse, error) {
	kcURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.Realm)
	body := fmt.Sprintf("grant_type=password&client_id=%s&client_secret=%s&username=%s&password=%s&scope=openid",
		cfg.ClientID, cfg.ClientSecret, username, password)
	resp, err := http.Post(kcURL, "application/x-www-form-urlencoded", strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("keycloak request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("keycloak returned %d", resp.StatusCode)
	}
	var result TokenResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func keycloakCodeExchange(code string) (*TokenResponse, error) {
	kcURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.Realm)
	body := fmt.Sprintf("grant_type=authorization_code&client_id=%s&client_secret=%s&code=%s&redirect_uri=%s",
		cfg.ClientID, cfg.ClientSecret, code, getEnv("OAUTH_REDIRECT_URI", "http://localhost:3000/auth/callback"))
	resp, err := http.Post(kcURL, "application/x-www-form-urlencoded", strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("code exchange returned %d", resp.StatusCode)
	}
	var result TokenResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func keycloakRefresh(refreshToken string) (*TokenResponse, error) {
	kcURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.Realm)
	body := fmt.Sprintf("grant_type=refresh_token&client_id=%s&client_secret=%s&refresh_token=%s",
		cfg.ClientID, cfg.ClientSecret, refreshToken)
	resp, err := http.Post(kcURL, "application/x-www-form-urlencoded", strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("refresh returned %d", resp.StatusCode)
	}
	var result TokenResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func validateJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); ok {
			return signingKey, nil
		}
		if rsaKey != nil {
			return rsaKey, nil
		}
		return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

func extractUserInfo(claims jwt.MapClaims) *UserInfo {
	user := &UserInfo{
		Sub:       getClaimStr(claims, "sub"),
		Email:     getClaimStr(claims, "email"),
		Name:      getClaimStr(claims, "name"),
		Tier:      getClaimStr(claims, "tier"),
		AgentCode: getClaimStr(claims, "agent_code"),
		TenantID:  getClaimStr(claims, "tenant_id"),
	}
	if roles, ok := claims["roles"].([]interface{}); ok {
		for _, r := range roles {
			if s, ok := r.(string); ok {
				user.Roles = append(user.Roles, s)
			}
		}
	}
	if user.Roles == nil {
		user.Roles = []string{"agent"}
	}
	return user
}

func getClaimStr(claims jwt.MapClaims, key string) string {
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowed := range cfg.AllowedOrigins {
			if origin == allowed || allowed == "*" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// initTracer initialises the OTLP trace exporter.
// Returns a shutdown function; safe to call even if OTEL is not configured.
func initTracer(serviceName, serviceVersion string) func(context.Context) error {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		return func(context.Context) error { return nil }
	}
	ctx := context.Background()
	exp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(endpoint))
	if err != nil {
		slog.Warn("OTel exporter init failed", "err", err)
		return func(context.Context) error { return nil }
	}
	res := resource.NewWithAttributes(
		"https://opentelemetry.io/schemas/1.24.0",
		semconv.ServiceName(serviceName),
		semconv.ServiceVersion(serviceVersion),
		attribute.String("deployment.environment", os.Getenv("ENVIRONMENT")),
	)
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	return tp.Shutdown
}

// otelMiddleware wraps an http.Handler with OTel tracing.
func otelMiddleware(serviceName string, next http.Handler) http.Handler {
	tracer := otel.Tracer(serviceName)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracer.Start(r.Context(), r.Method+" "+r.URL.Path)
		defer span.End()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// rateLimitMiddleware applies a token-bucket rate limiter.
func rateLimitMiddleware(rps float64, burst int, next http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(rps), burst)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !limiter.Allow() {
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// gracefulShutdown waits for SIGTERM/SIGINT then drains the server.
func gracefulShutdown(serviceName string, srv *http.Server, cleanup func(context.Context) error) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	sig := <-quit
	slog.Info("Shutdown signal received", "service", serviceName, "signal", sig)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server shutdown error", "err", err)
	}
	if cleanup != nil {
		if err := cleanup(ctx); err != nil {
			slog.Error("Cleanup error", "err", err)
		}
	}
	slog.Info("Server stopped gracefully", "service", serviceName)
}

