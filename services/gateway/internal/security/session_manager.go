package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// SessionManager provides session binding and token rotation.
// Each session is bound to a device fingerprint (IP + User-Agent hash) to prevent
// session hijacking. Tokens are rotated on each use with a grace period.
//
// Storage: Redis-backed with in-memory fallback. When Redis is available, sessions
// persist across restarts and work across multiple gateway replicas.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session // in-memory fallback + local cache
	maxAge   time.Duration
	store    *Store // Redis-backed persistent store (optional)
}

// Session represents an active user session
type Session struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	DeviceHash    string    `json:"device_hash"`
	CreatedAt     time.Time `json:"created_at"`
	LastActivity  time.Time `json:"last_activity"`
	ExpiresAt     time.Time `json:"expires_at"`
	RotatedFrom   string    `json:"rotated_from,omitempty"`
	RotationGrace time.Time `json:"rotation_grace,omitempty"`
	IP            string    `json:"ip"`
	UserAgent     string    `json:"user_agent"`
	MFAVerified   bool      `json:"mfa_verified"`
	RiskScore     float64   `json:"risk_score"`
	Revoked       bool      `json:"revoked"`
}

// NewSessionManager creates a session manager (in-memory only)
func NewSessionManager() *SessionManager {
	return NewSessionManagerWithStore(nil)
}

// NewSessionManagerWithStore creates a session manager backed by Redis
func NewSessionManagerWithStore(store *Store) *SessionManager {
	sm := &SessionManager{
		sessions: make(map[string]*Session),
		maxAge:   30 * time.Minute, // 30-minute session idle timeout
		store:    store,
	}
	go sm.cleanupLoop()
	return sm
}

// CreateSession creates a new device-bound session
func (sm *SessionManager) CreateSession(userID, ip, userAgent string, mfaVerified bool) *Session {
	sessionID := generateSessionID()
	deviceHash := computeDeviceHash(ip, userAgent)

	session := &Session{
		ID:           sessionID,
		UserID:       userID,
		DeviceHash:   deviceHash,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(sm.maxAge),
		IP:           ip,
		UserAgent:    userAgent,
		MFAVerified:  mfaVerified,
		RiskScore:    0.0,
	}

	sm.mu.Lock()
	sm.sessions[sessionID] = session
	sm.mu.Unlock()

	// Persist to Redis for cross-replica durability
	if sm.store != nil {
		sm.store.SetSession(session)
	}

	return session
}

// ValidateSession checks if a session is valid and device-bound
func (sm *SessionManager) ValidateSession(sessionID, ip, userAgent string) (*Session, error) {
	sm.mu.RLock()
	session, ok := sm.sessions[sessionID]
	sm.mu.RUnlock()

	// Try Redis if not in local cache
	if !ok && sm.store != nil {
		var err error
		session, err = sm.store.GetSession(sessionID)
		if err == nil && session != nil {
			ok = true
			sm.mu.Lock()
			sm.sessions[sessionID] = session
			sm.mu.Unlock()
		}
	}

	if !ok {
		return nil, fmt.Errorf("session not found")
	}

	if session.Revoked {
		return nil, fmt.Errorf("session has been revoked")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	// Check device binding
	currentDeviceHash := computeDeviceHash(ip, userAgent)
	if currentDeviceHash != session.DeviceHash {
		// Device mismatch — possible session hijacking
		session.RiskScore += 50.0
		if session.RiskScore >= 100.0 {
			session.Revoked = true
			if sm.store != nil {
				sm.store.SetSession(session)
			}
			return nil, fmt.Errorf("session revoked: device mismatch (possible hijacking)")
		}
		// Allow with elevated risk (e.g., IP changed within same session)
	}

	// Update last activity and extend expiration
	sm.mu.Lock()
	session.LastActivity = time.Now()
	session.ExpiresAt = time.Now().Add(sm.maxAge)
	sm.mu.Unlock()

	if sm.store != nil {
		sm.store.SetSession(session)
	}

	return session, nil
}

// RotateSession creates a new session ID while keeping the old one valid briefly
func (sm *SessionManager) RotateSession(oldSessionID string) (*Session, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	oldSession, ok := sm.sessions[oldSessionID]
	if !ok {
		return nil, fmt.Errorf("session not found")
	}

	// Create new session with same properties
	newID := generateSessionID()
	newSession := &Session{
		ID:           newID,
		UserID:       oldSession.UserID,
		DeviceHash:   oldSession.DeviceHash,
		CreatedAt:    oldSession.CreatedAt,
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(sm.maxAge),
		IP:           oldSession.IP,
		UserAgent:    oldSession.UserAgent,
		MFAVerified:  oldSession.MFAVerified,
		RiskScore:    oldSession.RiskScore,
		RotatedFrom:  oldSessionID,
	}

	// Keep old session valid for 30 seconds (grace period for in-flight requests)
	oldSession.ExpiresAt = time.Now().Add(30 * time.Second)
	oldSession.RotationGrace = time.Now().Add(30 * time.Second)

	sm.sessions[newID] = newSession

	// Persist both to Redis
	if sm.store != nil {
		sm.store.SetSession(oldSession)
		sm.store.SetSession(newSession)
	}

	return newSession, nil
}

// RevokeSession immediately invalidates a session
func (sm *SessionManager) RevokeSession(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if session, ok := sm.sessions[sessionID]; ok {
		session.Revoked = true
		if sm.store != nil {
			sm.store.DeleteSession(sessionID, session.UserID)
		}
	}
}

// RevokeUserSessions revokes all sessions for a user
func (sm *SessionManager) RevokeUserSessions(userID string) int {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	count := 0
	for _, session := range sm.sessions {
		if session.UserID == userID && !session.Revoked {
			session.Revoked = true
			if sm.store != nil {
				sm.store.DeleteSession(session.ID, userID)
			}
			count++
		}
	}
	return count
}

// GetUserSessions returns all active sessions for a user
func (sm *SessionManager) GetUserSessions(userID string) []*Session {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	var sessions []*Session
	for _, s := range sm.sessions {
		if s.UserID == userID && !s.Revoked && time.Now().Before(s.ExpiresAt) {
			sessions = append(sessions, s)
		}
	}
	return sessions
}

// ActiveCount returns the number of active sessions
func (sm *SessionManager) ActiveCount() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	count := 0
	for _, s := range sm.sessions {
		if !s.Revoked && time.Now().Before(s.ExpiresAt) {
			count++
		}
	}
	return count
}

// Middleware returns Gin middleware for session validation
func (sm *SessionManager) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.GetHeader("X-Session-ID")
		if sessionID == "" {
			// No session header — allow (auth middleware handles authentication)
			c.Next()
			return
		}

		session, err := sm.ValidateSession(sessionID, c.ClientIP(), c.GetHeader("User-Agent"))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid session: " + err.Error(),
				"code":    "INVALID_SESSION",
			})
			c.Abort()
			return
		}

		c.Set("session", session)
		c.Set("session_risk_score", session.RiskScore)
		c.Next()
	}
}

func (sm *SessionManager) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		sm.mu.Lock()
		for id, s := range sm.sessions {
			if s.Revoked || time.Now().After(s.ExpiresAt) {
				delete(sm.sessions, id)
			}
		}
		sm.mu.Unlock()
	}
}

func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func computeDeviceHash(ip, userAgent string) string {
	h := sha256.Sum256([]byte(ip + "|" + userAgent))
	return hex.EncodeToString(h[:])
}
