// Package security implements security hardening for PayGate
package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
)

// SecurityHardeningService provides comprehensive security hardening
type SecurityHardeningService struct {
	// Content Security Policy
	csp *ContentSecurityPolicy

	// HTTP Security Headers
	headers *SecurityHeaders

	// Input Validation
	validator *InputValidator

	// Encryption Service
	encryption *EncryptionService

	// Session Manager
	sessions *SecureSessionManager

	// Rate Limiter
	rateLimiter *RateLimiter

	// Configuration
	config SecurityHardeningConfig
}

// SecurityHardeningConfig configures security hardening
type SecurityHardeningConfig struct {
	// CSP
	CSPEnabled    bool
	CSPReportOnly bool
	CSPReportURI  string

	// HSTS
	HSTSEnabled           bool
	HSTSMaxAge            int
	HSTSIncludeSubdomains bool
	HSTSPreload           bool

	// Sessions
	SessionTimeout  time.Duration
	SessionSecure   bool
	SessionHTTPOnly bool
	SessionSameSite string

	// Encryption
	EncryptionKey []byte

	// Rate Limiting
	RateLimitEnabled  bool
	RateLimitRequests int
	RateLimitWindow   time.Duration
}

// DefaultSecurityHardeningConfig returns secure defaults
func DefaultSecurityHardeningConfig() SecurityHardeningConfig {
	return SecurityHardeningConfig{
		CSPEnabled:            true,
		CSPReportOnly:         false,
		HSTSEnabled:           true,
		HSTSMaxAge:            31536000, // 1 year
		HSTSIncludeSubdomains: true,
		HSTSPreload:           true,
		SessionTimeout:        30 * time.Minute,
		SessionSecure:         true,
		SessionHTTPOnly:       true,
		SessionSameSite:       "Strict",
		RateLimitEnabled:      true,
		RateLimitRequests:     100,
		RateLimitWindow:       time.Minute,
	}
}

// NewSecurityHardeningService creates a new security hardening service
func NewSecurityHardeningService(config SecurityHardeningConfig) (*SecurityHardeningService, error) {
	var encService *EncryptionService
	var err error

	if len(config.EncryptionKey) > 0 {
		encService, err = NewEncryptionService(config.EncryptionKey)
		if err != nil {
			return nil, fmt.Errorf("failed to create encryption service: %w", err)
		}
	}

	return &SecurityHardeningService{
		csp:         NewContentSecurityPolicy(),
		headers:     NewSecurityHeaders(config),
		validator:   NewInputValidator(),
		encryption:  encService,
		sessions:    NewSecureSessionManager(config),
		rateLimiter: NewRateLimiter(config.RateLimitRequests, config.RateLimitWindow),
		config:      config,
	}, nil
}

// Middleware returns HTTP middleware for security hardening
func (s *SecurityHardeningService) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Apply security headers
		s.headers.Apply(w)

		// Apply CSP
		if s.config.CSPEnabled {
			s.csp.Apply(w, s.config.CSPReportOnly)
		}

		// Rate limiting
		if s.config.RateLimitEnabled {
			clientIP := getClientIP(r)
			if !s.rateLimiter.Allow(clientIP) {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// ============================================================================
// Content Security Policy (CSP)
// ============================================================================

// ContentSecurityPolicy manages CSP headers
type ContentSecurityPolicy struct {
	directives map[string][]string
	mu         sync.RWMutex
}

// NewContentSecurityPolicy creates a new CSP manager with secure defaults
func NewContentSecurityPolicy() *ContentSecurityPolicy {
	csp := &ContentSecurityPolicy{
		directives: make(map[string][]string),
	}

	// Set secure defaults
	csp.directives["default-src"] = []string{"'self'"}
	csp.directives["script-src"] = []string{"'self'", "'strict-dynamic'"}
	csp.directives["style-src"] = []string{"'self'", "'unsafe-inline'"} // Required for many UI frameworks
	csp.directives["img-src"] = []string{"'self'", "data:", "https:"}
	csp.directives["font-src"] = []string{"'self'", "https://fonts.gstatic.com"}
	csp.directives["connect-src"] = []string{"'self'"}
	csp.directives["frame-ancestors"] = []string{"'none'"}
	csp.directives["form-action"] = []string{"'self'"}
	csp.directives["base-uri"] = []string{"'self'"}
	csp.directives["object-src"] = []string{"'none'"}
	csp.directives["upgrade-insecure-requests"] = []string{}

	return csp
}

// SetDirective sets a CSP directive
func (c *ContentSecurityPolicy) SetDirective(directive string, values []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.directives[directive] = values
}

// AddSource adds a source to a directive
func (c *ContentSecurityPolicy) AddSource(directive, source string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.directives[directive] = append(c.directives[directive], source)
}

// Build builds the CSP header value
func (c *ContentSecurityPolicy) Build() string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var parts []string
	for directive, values := range c.directives {
		if len(values) == 0 {
			parts = append(parts, directive)
		} else {
			parts = append(parts, directive+" "+strings.Join(values, " "))
		}
	}

	return strings.Join(parts, "; ")
}

// Apply applies CSP header to response
func (c *ContentSecurityPolicy) Apply(w http.ResponseWriter, reportOnly bool) {
	header := "Content-Security-Policy"
	if reportOnly {
		header = "Content-Security-Policy-Report-Only"
	}
	w.Header().Set(header, c.Build())
}

// ============================================================================
// Security Headers
// ============================================================================

// SecurityHeaders manages HTTP security headers
type SecurityHeaders struct {
	config SecurityHardeningConfig
}

// NewSecurityHeaders creates a new security headers manager
func NewSecurityHeaders(config SecurityHardeningConfig) *SecurityHeaders {
	return &SecurityHeaders{config: config}
}

// Apply applies security headers to response
func (h *SecurityHeaders) Apply(w http.ResponseWriter) {
	// HSTS
	if h.config.HSTSEnabled {
		hsts := fmt.Sprintf("max-age=%d", h.config.HSTSMaxAge)
		if h.config.HSTSIncludeSubdomains {
			hsts += "; includeSubDomains"
		}
		if h.config.HSTSPreload {
			hsts += "; preload"
		}
		w.Header().Set("Strict-Transport-Security", hsts)
	}

	// X-Frame-Options (defense in depth with CSP frame-ancestors)
	w.Header().Set("X-Frame-Options", "DENY")

	// X-Content-Type-Options
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// X-XSS-Protection (legacy, but still useful for older browsers)
	w.Header().Set("X-XSS-Protection", "1; mode=block")

	// Referrer-Policy
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

	// Permissions-Policy (formerly Feature-Policy)
	w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self)")

	// Cache-Control for sensitive pages
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	// Cross-Origin policies
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
	w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
}

// ============================================================================
// Input Validation
// ============================================================================

// InputValidator provides comprehensive input validation
type InputValidator struct {
	patterns map[string]*regexp.Regexp
}

// ValidationResult represents validation result
type ValidationResult struct {
	Valid  bool
	Errors []ValidationError
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
	Code    string
}

// NewInputValidator creates a new input validator
func NewInputValidator() *InputValidator {
	return &InputValidator{
		patterns: map[string]*regexp.Regexp{
			"email":        regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`),
			"phone":        regexp.MustCompile(`^\+?[1-9]\d{1,14}$`),
			"uuid":         regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`),
			"alphanumeric": regexp.MustCompile(`^[a-zA-Z0-9]+$`),
			"numeric":      regexp.MustCompile(`^[0-9]+$`),
			"alpha":        regexp.MustCompile(`^[a-zA-Z]+$`),
			"iban":         regexp.MustCompile(`^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$`),
			"swift":        regexp.MustCompile(`^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$`),
			"card_number":  regexp.MustCompile(`^[0-9]{13,19}$`),
			"cvv":          regexp.MustCompile(`^[0-9]{3,4}$`),
			"ip_address":   regexp.MustCompile(`^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`),
			"url":          regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`),
		},
	}
}

// ValidateEmail validates an email address
func (v *InputValidator) ValidateEmail(email string) bool {
	return v.patterns["email"].MatchString(email)
}

// ValidatePhone validates a phone number (E.164 format)
func (v *InputValidator) ValidatePhone(phone string) bool {
	return v.patterns["phone"].MatchString(phone)
}

// ValidateUUID validates a UUID
func (v *InputValidator) ValidateUUID(uuid string) bool {
	return v.patterns["uuid"].MatchString(strings.ToLower(uuid))
}

// ValidateIBAN validates an IBAN
func (v *InputValidator) ValidateIBAN(iban string) bool {
	// Remove spaces and convert to uppercase
	iban = strings.ToUpper(strings.ReplaceAll(iban, " ", ""))
	return v.patterns["iban"].MatchString(iban)
}

// ValidateSWIFT validates a SWIFT/BIC code
func (v *InputValidator) ValidateSWIFT(swift string) bool {
	return v.patterns["swift"].MatchString(strings.ToUpper(swift))
}

// ValidateCardNumber validates a card number (basic format check + Luhn)
func (v *InputValidator) ValidateCardNumber(cardNumber string) bool {
	// Remove spaces and dashes
	cardNumber = strings.ReplaceAll(strings.ReplaceAll(cardNumber, " ", ""), "-", "")

	if !v.patterns["card_number"].MatchString(cardNumber) {
		return false
	}

	// Luhn algorithm
	return v.luhnCheck(cardNumber)
}

// luhnCheck performs Luhn algorithm validation
func (v *InputValidator) luhnCheck(number string) bool {
	var sum int
	alt := false

	for i := len(number) - 1; i >= 0; i-- {
		n := int(number[i] - '0')
		if alt {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}
		sum += n
		alt = !alt
	}

	return sum%10 == 0
}

// ValidateAmount validates a monetary amount
func (v *InputValidator) ValidateAmount(amount string) bool {
	// Allow digits with optional decimal point and up to 2 decimal places
	pattern := regexp.MustCompile(`^[0-9]+(\.[0-9]{1,2})?$`)
	return pattern.MatchString(amount)
}

// SanitizeString sanitizes a string by removing potentially dangerous characters
func (v *InputValidator) SanitizeString(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// Remove control characters except newlines and tabs
	var result strings.Builder
	for _, r := range input {
		if r == '\n' || r == '\t' || !unicode.IsControl(r) {
			result.WriteRune(r)
		}
	}

	return result.String()
}

// SanitizeHTML escapes HTML special characters
func (v *InputValidator) SanitizeHTML(input string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&#39;",
	)
	return replacer.Replace(input)
}

// ValidatePassword validates password strength
func (v *InputValidator) ValidatePassword(password string) *ValidationResult {
	result := &ValidationResult{Valid: true}

	if len(password) < 12 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must be at least 12 characters",
			Code:    "PASSWORD_TOO_SHORT",
		})
	}

	if len(password) > 128 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must be at most 128 characters",
			Code:    "PASSWORD_TOO_LONG",
		})
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}

	if !hasUpper {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must contain at least one uppercase letter",
			Code:    "PASSWORD_NO_UPPERCASE",
		})
	}

	if !hasLower {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must contain at least one lowercase letter",
			Code:    "PASSWORD_NO_LOWERCASE",
		})
	}

	if !hasDigit {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must contain at least one digit",
			Code:    "PASSWORD_NO_DIGIT",
		})
	}

	if !hasSpecial {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "password",
			Message: "Password must contain at least one special character",
			Code:    "PASSWORD_NO_SPECIAL",
		})
	}

	return result
}

// ============================================================================
// Encryption Service
// ============================================================================

// EncryptionService provides encryption at rest
type EncryptionService struct {
	key    []byte
	cipher cipher.AEAD
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(key []byte) (*EncryptionService, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes (256 bits)")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return &EncryptionService{
		key:    key,
		cipher: gcm,
	}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM
func (e *EncryptionService) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, e.cipher.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := e.cipher.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// Decrypt decrypts ciphertext using AES-256-GCM
func (e *EncryptionService) Decrypt(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < e.cipher.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:e.cipher.NonceSize()]
	ciphertext = ciphertext[e.cipher.NonceSize():]

	plaintext, err := e.cipher.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// EncryptString encrypts a string and returns base64-encoded ciphertext
func (e *EncryptionService) EncryptString(plaintext string) (string, error) {
	ciphertext, err := e.Encrypt([]byte(plaintext))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts base64-encoded ciphertext and returns plaintext string
func (e *EncryptionService) DecryptString(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	plaintext, err := e.Decrypt(data)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// HashPassword hashes a password using SHA-256 (use Argon2id in production)
func (e *EncryptionService) HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// ============================================================================
// Secure Session Manager
// ============================================================================

// SecureSessionManager manages secure sessions
type SecureSessionManager struct {
	sessions map[string]*SecureSession
	config   SecurityHardeningConfig
	mu       sync.RWMutex
}

// SecureSession represents a secure session
type SecureSession struct {
	ID           string
	UserID       string
	CreatedAt    time.Time
	ExpiresAt    time.Time
	LastActivity time.Time
	IPAddress    string
	UserAgent    string
	Data         map[string]interface{}
	Revoked      bool
}

// NewSecureSessionManager creates a new secure session manager
func NewSecureSessionManager(config SecurityHardeningConfig) *SecureSessionManager {
	return &SecureSessionManager{
		sessions: make(map[string]*SecureSession),
		config:   config,
	}
}

// CreateSession creates a new secure session
func (m *SecureSessionManager) CreateSession(userID, ipAddress, userAgent string) (*SecureSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sessionID, err := generateSecureSessionID()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	session := &SecureSession{
		ID:           sessionID,
		UserID:       userID,
		CreatedAt:    now,
		ExpiresAt:    now.Add(m.config.SessionTimeout),
		LastActivity: now,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Data:         make(map[string]interface{}),
	}

	m.sessions[sessionID] = session
	return session, nil
}

// GetSession retrieves a session by ID
func (m *SecureSessionManager) GetSession(sessionID string) (*SecureSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, ok := m.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found")
	}

	if session.Revoked {
		return nil, fmt.Errorf("session revoked")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	return session, nil
}

// ValidateSession validates a session
func (m *SecureSessionManager) ValidateSession(sessionID, ipAddress, userAgent string) (*SecureSession, error) {
	session, err := m.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	// Validate IP address (optional - can be disabled for mobile users)
	// if session.IPAddress != ipAddress {
	// 	return nil, fmt.Errorf("IP address mismatch")
	// }

	// Update last activity
	m.mu.Lock()
	session.LastActivity = time.Now()
	session.ExpiresAt = time.Now().Add(m.config.SessionTimeout)
	m.mu.Unlock()

	return session, nil
}

// RevokeSession revokes a session
func (m *SecureSessionManager) RevokeSession(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[sessionID]
	if !ok {
		return fmt.Errorf("session not found")
	}

	session.Revoked = true
	return nil
}

// RevokeUserSessions revokes all sessions for a user
func (m *SecureSessionManager) RevokeUserSessions(userID string) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	count := 0
	for _, session := range m.sessions {
		if session.UserID == userID && !session.Revoked {
			session.Revoked = true
			count++
		}
	}
	return count
}

// CleanupExpiredSessions removes expired sessions
func (m *SecureSessionManager) CleanupExpiredSessions() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	count := 0
	now := time.Now()
	for id, session := range m.sessions {
		if now.After(session.ExpiresAt) || session.Revoked {
			delete(m.sessions, id)
			count++
		}
	}
	return count
}

// SetSessionCookie sets a secure session cookie
func (m *SecureSessionManager) SetSessionCookie(w http.ResponseWriter, session *SecureSession) {
	cookie := &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		Expires:  session.ExpiresAt,
		Secure:   m.config.SessionSecure,
		HttpOnly: m.config.SessionHTTPOnly,
		SameSite: parseSameSite(m.config.SessionSameSite),
	}
	http.SetCookie(w, cookie)
}

// ClearSessionCookie clears the session cookie
func (m *SecureSessionManager) ClearSessionCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Secure:   m.config.SessionSecure,
		HttpOnly: m.config.SessionHTTPOnly,
		SameSite: parseSameSite(m.config.SessionSameSite),
	}
	http.SetCookie(w, cookie)
}

// generateSecureSessionID generates a cryptographically secure session ID
func generateSecureSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// parseSameSite parses SameSite string to http.SameSite
func parseSameSite(s string) http.SameSite {
	switch strings.ToLower(s) {
	case "strict":
		return http.SameSiteStrictMode
	case "lax":
		return http.SameSiteLaxMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteStrictMode
	}
}

// ============================================================================
// Rate Limiter
// ============================================================================

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
	buckets map[string]*tokenBucket
	limit   int
	window  time.Duration
	mu      sync.RWMutex
}

// tokenBucket represents a token bucket for rate limiting
type tokenBucket struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*tokenBucket),
		limit:   limit,
		window:  window,
	}
}

// Allow checks if a request is allowed
func (r *RateLimiter) Allow(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	bucket, ok := r.buckets[key]
	if !ok {
		bucket = &tokenBucket{
			tokens:    r.limit,
			lastReset: time.Now(),
		}
		r.buckets[key] = bucket
	}

	// Reset bucket if window has passed
	if time.Since(bucket.lastReset) > r.window {
		bucket.tokens = r.limit
		bucket.lastReset = time.Now()
	}

	if bucket.tokens > 0 {
		bucket.tokens--
		return true
	}

	return false
}

// Remaining returns remaining tokens for a key
func (r *RateLimiter) Remaining(key string) int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	bucket, ok := r.buckets[key]
	if !ok {
		return r.limit
	}

	if time.Since(bucket.lastReset) > r.window {
		return r.limit
	}

	return bucket.tokens
}

// Reset resets the rate limit for a key
func (r *RateLimiter) Reset(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.buckets, key)
}

// ============================================================================
// CSRF Protection
// ============================================================================

// CSRFProtection provides CSRF token management
type CSRFProtection struct {
	tokens map[string]*csrfToken
	mu     sync.RWMutex
}

// csrfToken represents a CSRF token
type csrfToken struct {
	token     string
	sessionID string
	createdAt time.Time
	expiresAt time.Time
}

// NewCSRFProtection creates a new CSRF protection manager
func NewCSRFProtection() *CSRFProtection {
	return &CSRFProtection{
		tokens: make(map[string]*csrfToken),
	}
}

// GenerateToken generates a new CSRF token for a session
func (c *CSRFProtection) GenerateToken(sessionID string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	token := hex.EncodeToString(bytes)
	c.tokens[token] = &csrfToken{
		token:     token,
		sessionID: sessionID,
		createdAt: time.Now(),
		expiresAt: time.Now().Add(time.Hour),
	}

	return token, nil
}

// ValidateToken validates a CSRF token
func (c *CSRFProtection) ValidateToken(token, sessionID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	t, ok := c.tokens[token]
	if !ok {
		return false
	}

	if t.sessionID != sessionID {
		return false
	}

	if time.Now().After(t.expiresAt) {
		return false
	}

	return true
}

// InvalidateToken invalidates a CSRF token
func (c *CSRFProtection) InvalidateToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.tokens, token)
}

// Middleware returns CSRF protection middleware
func (c *CSRFProtection) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip safe methods
		if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		// Get session ID from cookie
		sessionCookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Session required", http.StatusUnauthorized)
			return
		}

		// Get CSRF token from header or form
		token := r.Header.Get("X-CSRF-Token")
		if token == "" {
			token = r.FormValue("csrf_token")
		}

		if !c.ValidateToken(token, sessionCookie.Value) {
			http.Error(w, "Invalid CSRF token", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

// getClientIP extracts client IP from request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}
