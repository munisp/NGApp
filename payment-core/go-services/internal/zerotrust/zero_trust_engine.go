// Package zerotrust implements Zero Trust Architecture for PayGate
package zerotrust

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ZeroTrustEngine implements Zero Trust security model
type ZeroTrustEngine struct {
	// Policy Decision Point
	pdp *PolicyDecisionPoint

	// Device Trust Scorer
	deviceTrust *DeviceTrustScorer

	// Session Manager
	sessions *SessionManager

	// Identity Verifier
	identity *IdentityVerifier

	// Micro-segmentation rules
	segmentation *MicroSegmentation

	// Continuous validation
	validator *ContinuousValidator

	// Audit logger
	auditLog AuditLogger

	// Configuration
	config ZeroTrustConfig

	mu sync.RWMutex
}

// ZeroTrustConfig configures the Zero Trust engine
type ZeroTrustConfig struct {
	// Identity verification
	RequireMFA     bool
	MFAGracePeriod time.Duration
	TokenMaxAge    time.Duration
	SessionTimeout time.Duration

	// Device trust
	MinDeviceTrustScore      float64
	RequireDeviceAttestation bool

	// Access control
	DefaultDeny          bool
	RequireJustification bool

	// Continuous validation
	RevalidationInterval time.Duration
	AnomalyThreshold     float64
}

// DefaultZeroTrustConfig returns secure defaults
func DefaultZeroTrustConfig() ZeroTrustConfig {
	return ZeroTrustConfig{
		RequireMFA:               true,
		MFAGracePeriod:           5 * time.Minute,
		TokenMaxAge:              15 * time.Minute,
		SessionTimeout:           30 * time.Minute,
		MinDeviceTrustScore:      0.7,
		RequireDeviceAttestation: false,
		DefaultDeny:              true,
		RequireJustification:     false,
		RevalidationInterval:     5 * time.Minute,
		AnomalyThreshold:         0.8,
	}
}

// AccessRequest represents a request for resource access
type AccessRequest struct {
	RequestID     string        `json:"request_id"`
	Subject       Subject       `json:"subject"`
	Resource      Resource      `json:"resource"`
	Action        string        `json:"action"`
	Context       AccessContext `json:"context"`
	Timestamp     time.Time     `json:"timestamp"`
	Justification string        `json:"justification,omitempty"`
}

// Subject represents the entity requesting access
type Subject struct {
	ID          string            `json:"id"`
	Type        string            `json:"type"` // user, service, device
	Email       string            `json:"email,omitempty"`
	Roles       []string          `json:"roles"`
	Groups      []string          `json:"groups"`
	Attributes  map[string]string `json:"attributes"`
	AuthMethod  string            `json:"auth_method"`
	AuthTime    time.Time         `json:"auth_time"`
	MFAVerified bool              `json:"mfa_verified"`
	SessionID   string            `json:"session_id"`
}

// Resource represents the resource being accessed
type Resource struct {
	Type        string            `json:"type"`
	ID          string            `json:"id"`
	Owner       string            `json:"owner"`
	Namespace   string            `json:"namespace"`
	Attributes  map[string]string `json:"attributes"`
	Sensitivity string            `json:"sensitivity"` // public, internal, confidential, restricted
}

// AccessContext provides contextual information for access decisions
type AccessContext struct {
	IPAddress   string            `json:"ip_address"`
	UserAgent   string            `json:"user_agent"`
	DeviceID    string            `json:"device_id"`
	DeviceType  string            `json:"device_type"`
	GeoLocation GeoLocation       `json:"geo_location"`
	NetworkZone string            `json:"network_zone"`
	RiskSignals []RiskSignal      `json:"risk_signals"`
	Headers     map[string]string `json:"headers"`
}

// GeoLocation represents geographic location
type GeoLocation struct {
	Country   string  `json:"country"`
	Region    string  `json:"region"`
	City      string  `json:"city"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// RiskSignal represents a risk indicator
type RiskSignal struct {
	Type       string    `json:"type"`
	Severity   string    `json:"severity"`
	Score      float64   `json:"score"`
	Details    string    `json:"details"`
	DetectedAt time.Time `json:"detected_at"`
}

// AccessDecision represents the result of an access request evaluation
type AccessDecision struct {
	RequestID      string             `json:"request_id"`
	Decision       string             `json:"decision"` // allow, deny, step_up
	Reason         string             `json:"reason"`
	Conditions     []string           `json:"conditions,omitempty"`
	StepUpRequired *StepUpRequirement `json:"step_up_required,omitempty"`
	ValidUntil     time.Time          `json:"valid_until"`
	AuditID        string             `json:"audit_id"`
	PolicyMatched  string             `json:"policy_matched"`
	TrustScore     float64            `json:"trust_score"`
	RiskScore      float64            `json:"risk_score"`
}

// StepUpRequirement specifies additional authentication needed
type StepUpRequirement struct {
	Type      string        `json:"type"` // mfa, reauthenticate, approval
	Methods   []string      `json:"methods"`
	Reason    string        `json:"reason"`
	ExpiresIn time.Duration `json:"expires_in"`
}

// AuditLogger interface for audit logging
type AuditLogger interface {
	LogAccessDecision(ctx context.Context, request *AccessRequest, decision *AccessDecision) error
}

// NewZeroTrustEngine creates a new Zero Trust engine
func NewZeroTrustEngine(config ZeroTrustConfig, auditLog AuditLogger) *ZeroTrustEngine {
	return &ZeroTrustEngine{
		pdp:          NewPolicyDecisionPoint(),
		deviceTrust:  NewDeviceTrustScorer(),
		sessions:     NewSessionManager(config.SessionTimeout),
		identity:     NewIdentityVerifier(config),
		segmentation: NewMicroSegmentation(),
		validator:    NewContinuousValidator(config.RevalidationInterval),
		auditLog:     auditLog,
		config:       config,
	}
}

// Evaluate evaluates an access request and returns a decision
func (e *ZeroTrustEngine) Evaluate(ctx context.Context, request *AccessRequest) (*AccessDecision, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Step 1: Verify identity
	identityResult, err := e.identity.Verify(ctx, &request.Subject)
	if err != nil {
		return e.denyAccess(request, "identity_verification_failed", err.Error())
	}
	if !identityResult.Valid {
		return e.denyAccess(request, "identity_invalid", identityResult.Reason)
	}

	// Step 2: Check MFA if required
	if e.config.RequireMFA && !request.Subject.MFAVerified {
		if time.Since(request.Subject.AuthTime) > e.config.MFAGracePeriod {
			return e.stepUpRequired(request, "mfa_required", []string{"totp", "webauthn", "sms"})
		}
	}

	// Step 3: Evaluate device trust
	deviceScore := e.deviceTrust.Score(ctx, &request.Context)
	if deviceScore < e.config.MinDeviceTrustScore {
		return e.denyAccess(request, "device_trust_insufficient",
			fmt.Sprintf("device trust score %.2f below threshold %.2f", deviceScore, e.config.MinDeviceTrustScore))
	}

	// Step 4: Check micro-segmentation rules
	segmentAllowed := e.segmentation.IsAllowed(request.Context.NetworkZone, request.Resource.Namespace)
	if !segmentAllowed {
		return e.denyAccess(request, "network_segment_denied",
			fmt.Sprintf("access from %s to %s not allowed", request.Context.NetworkZone, request.Resource.Namespace))
	}

	// Step 5: Evaluate access policy
	policyDecision := e.pdp.Evaluate(ctx, request)
	if policyDecision.Decision == "deny" {
		return e.denyAccess(request, policyDecision.PolicyID, policyDecision.Reason)
	}

	// Step 6: Calculate risk score
	riskScore := e.calculateRiskScore(request, deviceScore)
	if riskScore > e.config.AnomalyThreshold {
		return e.stepUpRequired(request, "high_risk_detected", []string{"reauthenticate", "approval"})
	}

	// Step 7: Check continuous validation
	if !e.validator.IsValid(request.Subject.SessionID) {
		return e.stepUpRequired(request, "session_revalidation_required", []string{"reauthenticate"})
	}

	// Access granted
	decision := &AccessDecision{
		RequestID:     request.RequestID,
		Decision:      "allow",
		Reason:        "all_checks_passed",
		ValidUntil:    time.Now().Add(e.config.TokenMaxAge),
		PolicyMatched: policyDecision.PolicyID,
		TrustScore:    deviceScore,
		RiskScore:     riskScore,
	}

	// Log the decision
	if e.auditLog != nil {
		decision.AuditID = e.generateAuditID(request)
		_ = e.auditLog.LogAccessDecision(ctx, request, decision)
	}

	return decision, nil
}

// denyAccess creates a deny decision
func (e *ZeroTrustEngine) denyAccess(request *AccessRequest, reason, details string) (*AccessDecision, error) {
	decision := &AccessDecision{
		RequestID:  request.RequestID,
		Decision:   "deny",
		Reason:     fmt.Sprintf("%s: %s", reason, details),
		ValidUntil: time.Now(),
		TrustScore: 0,
		RiskScore:  1.0,
	}

	if e.auditLog != nil {
		decision.AuditID = e.generateAuditID(request)
		_ = e.auditLog.LogAccessDecision(context.Background(), request, decision)
	}

	return decision, nil
}

// stepUpRequired creates a step-up authentication decision
func (e *ZeroTrustEngine) stepUpRequired(request *AccessRequest, reason string, methods []string) (*AccessDecision, error) {
	decision := &AccessDecision{
		RequestID: request.RequestID,
		Decision:  "step_up",
		Reason:    reason,
		StepUpRequired: &StepUpRequirement{
			Type:      "mfa",
			Methods:   methods,
			Reason:    reason,
			ExpiresIn: 5 * time.Minute,
		},
		ValidUntil: time.Now(),
	}

	if e.auditLog != nil {
		decision.AuditID = e.generateAuditID(request)
		_ = e.auditLog.LogAccessDecision(context.Background(), request, decision)
	}

	return decision, nil
}

// calculateRiskScore calculates overall risk score
func (e *ZeroTrustEngine) calculateRiskScore(request *AccessRequest, deviceScore float64) float64 {
	var riskScore float64

	// Base risk from device trust (inverse)
	riskScore += (1 - deviceScore) * 0.3

	// Risk from authentication age
	authAge := time.Since(request.Subject.AuthTime)
	if authAge > time.Hour {
		riskScore += 0.2
	} else if authAge > 30*time.Minute {
		riskScore += 0.1
	}

	// Risk from resource sensitivity
	switch request.Resource.Sensitivity {
	case "restricted":
		riskScore += 0.2
	case "confidential":
		riskScore += 0.1
	}

	// Risk from context signals
	for _, signal := range request.Context.RiskSignals {
		riskScore += signal.Score * 0.1
	}

	// Cap at 1.0
	if riskScore > 1.0 {
		riskScore = 1.0
	}

	return riskScore
}

// generateAuditID generates a unique audit ID
func (e *ZeroTrustEngine) generateAuditID(request *AccessRequest) string {
	data := fmt.Sprintf("%s:%s:%s:%d", request.RequestID, request.Subject.ID, request.Resource.ID, time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:16])
}

// Middleware returns HTTP middleware for Zero Trust enforcement
func (e *ZeroTrustEngine) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract access request from HTTP request
		request := e.extractAccessRequest(r)

		// Evaluate access
		decision, err := e.Evaluate(r.Context(), request)
		if err != nil {
			http.Error(w, "Access evaluation failed", http.StatusInternalServerError)
			return
		}

		// Handle decision
		switch decision.Decision {
		case "allow":
			// Add decision context to request
			ctx := context.WithValue(r.Context(), "zero_trust_decision", decision)
			next.ServeHTTP(w, r.WithContext(ctx))
		case "deny":
			w.Header().Set("X-ZeroTrust-Reason", decision.Reason)
			http.Error(w, "Access denied", http.StatusForbidden)
		case "step_up":
			w.Header().Set("X-ZeroTrust-StepUp", decision.StepUpRequired.Type)
			w.Header().Set("X-ZeroTrust-Methods", strings.Join(decision.StepUpRequired.Methods, ","))
			http.Error(w, "Step-up authentication required", http.StatusUnauthorized)
		}
	})
}

// extractAccessRequest extracts access request from HTTP request
func (e *ZeroTrustEngine) extractAccessRequest(r *http.Request) *AccessRequest {
	// Extract subject from JWT/session
	subject := e.extractSubject(r)

	// Extract resource from path
	resource := e.extractResource(r)

	// Extract context
	ctx := e.extractContext(r)

	return &AccessRequest{
		RequestID: r.Header.Get("X-Request-ID"),
		Subject:   subject,
		Resource:  resource,
		Action:    r.Method,
		Context:   ctx,
		Timestamp: time.Now(),
	}
}

// extractSubject extracts subject from request
func (e *ZeroTrustEngine) extractSubject(r *http.Request) Subject {
	// In production, this would parse JWT claims
	return Subject{
		ID:          r.Header.Get("X-User-ID"),
		Type:        "user",
		Email:       r.Header.Get("X-User-Email"),
		Roles:       strings.Split(r.Header.Get("X-User-Roles"), ","),
		Groups:      strings.Split(r.Header.Get("X-User-Groups"), ","),
		AuthMethod:  r.Header.Get("X-Auth-Method"),
		MFAVerified: r.Header.Get("X-MFA-Verified") == "true",
		SessionID:   r.Header.Get("X-Session-ID"),
	}
}

// extractResource extracts resource from request
func (e *ZeroTrustEngine) extractResource(r *http.Request) Resource {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	resourceType := "unknown"
	resourceID := ""

	if len(parts) >= 2 {
		resourceType = parts[0]
		resourceID = parts[1]
	}

	return Resource{
		Type:        resourceType,
		ID:          resourceID,
		Namespace:   r.Header.Get("X-Namespace"),
		Sensitivity: r.Header.Get("X-Resource-Sensitivity"),
	}
}

// extractContext extracts context from request
func (e *ZeroTrustEngine) extractContext(r *http.Request) AccessContext {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)

	return AccessContext{
		IPAddress:   ip,
		UserAgent:   r.UserAgent(),
		DeviceID:    r.Header.Get("X-Device-ID"),
		DeviceType:  r.Header.Get("X-Device-Type"),
		NetworkZone: r.Header.Get("X-Network-Zone"),
		Headers:     extractHeaders(r),
	}
}

// extractHeaders extracts relevant headers
func extractHeaders(r *http.Request) map[string]string {
	headers := make(map[string]string)
	for _, key := range []string{"X-Forwarded-For", "X-Real-IP", "X-Request-ID", "X-Correlation-ID"} {
		if val := r.Header.Get(key); val != "" {
			headers[key] = val
		}
	}
	return headers
}

// PolicyDecisionPoint evaluates access policies
type PolicyDecisionPoint struct {
	policies []AccessPolicy
	mu       sync.RWMutex
}

// AccessPolicy represents an access control policy
type AccessPolicy struct {
	ID         string
	Name       string
	Priority   int
	Subjects   []string // subject patterns
	Resources  []string // resource patterns
	Actions    []string
	Effect     string // allow, deny
	Conditions []PolicyCondition
}

// PolicyCondition represents a policy condition
type PolicyCondition struct {
	Type     string // time, ip, attribute
	Operator string
	Value    string
}

// PolicyResult represents policy evaluation result
type PolicyResult struct {
	Decision string
	PolicyID string
	Reason   string
}

// NewPolicyDecisionPoint creates a new PDP
func NewPolicyDecisionPoint() *PolicyDecisionPoint {
	return &PolicyDecisionPoint{
		policies: []AccessPolicy{
			// Default deny policy
			{
				ID:       "default-deny",
				Name:     "Default Deny",
				Priority: 1000,
				Effect:   "deny",
			},
		},
	}
}

// Evaluate evaluates policies for an access request
func (p *PolicyDecisionPoint) Evaluate(ctx context.Context, request *AccessRequest) PolicyResult {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Evaluate policies in priority order
	for _, policy := range p.policies {
		if p.matchesPolicy(&policy, request) {
			return PolicyResult{
				Decision: policy.Effect,
				PolicyID: policy.ID,
				Reason:   fmt.Sprintf("matched policy: %s", policy.Name),
			}
		}
	}

	return PolicyResult{
		Decision: "deny",
		PolicyID: "default-deny",
		Reason:   "no matching policy",
	}
}

// matchesPolicy checks if request matches policy
func (p *PolicyDecisionPoint) matchesPolicy(policy *AccessPolicy, request *AccessRequest) bool {
	// Check subjects
	if len(policy.Subjects) > 0 {
		matched := false
		for _, pattern := range policy.Subjects {
			if matchPattern(pattern, request.Subject.ID) ||
				containsRole(request.Subject.Roles, pattern) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check resources
	if len(policy.Resources) > 0 {
		matched := false
		for _, pattern := range policy.Resources {
			if matchPattern(pattern, request.Resource.Type+"/"+request.Resource.ID) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check actions
	if len(policy.Actions) > 0 {
		matched := false
		for _, action := range policy.Actions {
			if action == "*" || action == request.Action {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

// AddPolicy adds a new policy
func (p *PolicyDecisionPoint) AddPolicy(policy AccessPolicy) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.policies = append(p.policies, policy)
}

// matchPattern matches a pattern against a value
func matchPattern(pattern, value string) bool {
	if pattern == "*" {
		return true
	}
	if strings.HasSuffix(pattern, "*") {
		return strings.HasPrefix(value, strings.TrimSuffix(pattern, "*"))
	}
	return pattern == value
}

// containsRole checks if roles contain a pattern
func containsRole(roles []string, pattern string) bool {
	for _, role := range roles {
		if matchPattern(pattern, role) {
			return true
		}
	}
	return false
}

// DeviceTrustScorer scores device trust
type DeviceTrustScorer struct {
	knownDevices map[string]float64
	mu           sync.RWMutex
}

// NewDeviceTrustScorer creates a new device trust scorer
func NewDeviceTrustScorer() *DeviceTrustScorer {
	return &DeviceTrustScorer{
		knownDevices: make(map[string]float64),
	}
}

// Score calculates device trust score
func (d *DeviceTrustScorer) Score(ctx context.Context, accessCtx *AccessContext) float64 {
	var score float64 = 0.5 // Base score

	// Check if device is known
	d.mu.RLock()
	if knownScore, ok := d.knownDevices[accessCtx.DeviceID]; ok {
		score = knownScore
	}
	d.mu.RUnlock()

	// Adjust based on device type
	switch accessCtx.DeviceType {
	case "managed":
		score += 0.3
	case "byod":
		score += 0.1
	case "unknown":
		score -= 0.2
	}

	// Adjust based on network zone
	switch accessCtx.NetworkZone {
	case "corporate":
		score += 0.2
	case "vpn":
		score += 0.1
	case "public":
		score -= 0.1
	}

	// Cap score
	if score > 1.0 {
		score = 1.0
	}
	if score < 0 {
		score = 0
	}

	return score
}

// RegisterDevice registers a known device
func (d *DeviceTrustScorer) RegisterDevice(deviceID string, trustScore float64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.knownDevices[deviceID] = trustScore
}

// SessionManager manages user sessions
type SessionManager struct {
	sessions map[string]*Session
	timeout  time.Duration
	mu       sync.RWMutex
}

// Session represents a user session
type Session struct {
	ID           string
	SubjectID    string
	CreatedAt    time.Time
	LastActivity time.Time
	MFAVerified  bool
	DeviceID     string
	IPAddress    string
}

// NewSessionManager creates a new session manager
func NewSessionManager(timeout time.Duration) *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
		timeout:  timeout,
	}
}

// CreateSession creates a new session
func (s *SessionManager) CreateSession(subjectID, deviceID, ipAddress string) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	session := &Session{
		ID:           generateSessionID(),
		SubjectID:    subjectID,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		DeviceID:     deviceID,
		IPAddress:    ipAddress,
	}

	s.sessions[session.ID] = session
	return session
}

// GetSession retrieves a session
func (s *SessionManager) GetSession(sessionID string) *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessions[sessionID]
}

// UpdateActivity updates session activity
func (s *SessionManager) UpdateActivity(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if session, ok := s.sessions[sessionID]; ok {
		session.LastActivity = time.Now()
	}
}

// IsValid checks if session is valid
func (s *SessionManager) IsValid(sessionID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return false
	}

	return time.Since(session.LastActivity) < s.timeout
}

// generateSessionID generates a unique session ID
func generateSessionID() string {
	data := fmt.Sprintf("%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// IdentityVerifier verifies subject identity
type IdentityVerifier struct {
	config ZeroTrustConfig
}

// IdentityResult represents identity verification result
type IdentityResult struct {
	Valid  bool
	Reason string
}

// NewIdentityVerifier creates a new identity verifier
func NewIdentityVerifier(config ZeroTrustConfig) *IdentityVerifier {
	return &IdentityVerifier{config: config}
}

// Verify verifies subject identity
func (v *IdentityVerifier) Verify(ctx context.Context, subject *Subject) (*IdentityResult, error) {
	// Check subject ID
	if subject.ID == "" {
		return &IdentityResult{Valid: false, Reason: "missing subject ID"}, nil
	}

	// Check authentication time
	if time.Since(subject.AuthTime) > v.config.TokenMaxAge {
		return &IdentityResult{Valid: false, Reason: "authentication expired"}, nil
	}

	// Check session
	if subject.SessionID == "" {
		return &IdentityResult{Valid: false, Reason: "missing session"}, nil
	}

	return &IdentityResult{Valid: true}, nil
}

// MicroSegmentation manages network micro-segmentation
type MicroSegmentation struct {
	rules map[string][]string // source zone -> allowed destination zones
	mu    sync.RWMutex
}

// NewMicroSegmentation creates a new micro-segmentation manager
func NewMicroSegmentation() *MicroSegmentation {
	return &MicroSegmentation{
		rules: map[string][]string{
			"public":    {"dmz"},
			"dmz":       {"internal"},
			"internal":  {"internal", "data"},
			"corporate": {"internal", "data", "admin"},
			"admin":     {"*"},
		},
	}
}

// IsAllowed checks if access between zones is allowed
func (m *MicroSegmentation) IsAllowed(sourceZone, destNamespace string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	allowedZones, ok := m.rules[sourceZone]
	if !ok {
		return false
	}

	for _, zone := range allowedZones {
		if zone == "*" || zone == destNamespace {
			return true
		}
	}

	return false
}

// AddRule adds a segmentation rule
func (m *MicroSegmentation) AddRule(sourceZone string, destZones []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules[sourceZone] = destZones
}

// ContinuousValidator performs continuous session validation
type ContinuousValidator struct {
	interval    time.Duration
	validations map[string]time.Time
	mu          sync.RWMutex
}

// NewContinuousValidator creates a new continuous validator
func NewContinuousValidator(interval time.Duration) *ContinuousValidator {
	return &ContinuousValidator{
		interval:    interval,
		validations: make(map[string]time.Time),
	}
}

// Validate marks a session as validated
func (v *ContinuousValidator) Validate(sessionID string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.validations[sessionID] = time.Now()
}

// IsValid checks if session validation is current
func (v *ContinuousValidator) IsValid(sessionID string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()

	lastValidation, ok := v.validations[sessionID]
	if !ok {
		return true // First access, allow
	}

	return time.Since(lastValidation) < v.interval
}
