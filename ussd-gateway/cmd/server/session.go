package main

import (
	"sync"
	"time"
)

// SessionStore manages USSD sessions with TTL
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	ttl      time.Duration
}

// NewSessionStore creates a new session store with 5-minute TTL
func NewSessionStore() *SessionStore {
	s := &SessionStore{
		sessions: make(map[string]*Session),
		ttl:      5 * time.Minute,
	}
	go s.cleanup()
	return s
}

// GetOrCreate retrieves an existing session or creates a new one
func (s *SessionStore) GetOrCreate(sessionID, phoneNumber string) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	if sess, ok := s.sessions[sessionID]; ok {
		sess.LastActive = time.Now()
		return sess
	}

	sess := &Session{
		ID:          sessionID,
		PhoneNumber: phoneNumber,
		State:       "main",
		Data:        make(map[string]string),
		CreatedAt:   time.Now(),
		LastActive:  time.Now(),
	}
	s.sessions[sessionID] = sess
	return sess
}

// Delete removes a session
func (s *SessionStore) Delete(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

func (s *SessionStore) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for id, sess := range s.sessions {
			if now.Sub(sess.LastActive) > s.ttl {
				delete(s.sessions, id)
			}
		}
		s.mu.Unlock()
	}
}
