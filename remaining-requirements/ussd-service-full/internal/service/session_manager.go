package service

import (
	"sync"
	"time"
)

type SessionState struct {
	PhoneNumber string
	CurrentNode string
	Data        map[string]string
	StartedAt   time.Time
	LastInput   time.Time
	StepCount   int
}

type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*SessionState
	timeout  time.Duration
}

func NewSessionManager(timeout time.Duration) *SessionManager {
	sm := &SessionManager{sessions: make(map[string]*SessionState), timeout: timeout}
	go sm.cleanupLoop()
	return sm
}

func (sm *SessionManager) GetOrCreate(sessionID, phone string) *SessionState {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if s, ok := sm.sessions[sessionID]; ok {
		s.LastInput = time.Now()
		s.StepCount++
		return s
	}
	s := &SessionState{PhoneNumber: phone, CurrentNode: "main", Data: make(map[string]string), StartedAt: time.Now(), LastInput: time.Now(), StepCount: 1}
	sm.sessions[sessionID] = s
	return s
}

func (sm *SessionManager) Remove(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, sessionID)
}

func (sm *SessionManager) ActiveCount() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return len(sm.sessions)
}

func (sm *SessionManager) cleanupLoop() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		sm.mu.Lock()
		now := time.Now()
		for id, s := range sm.sessions {
			if now.Sub(s.LastInput) > sm.timeout { delete(sm.sessions, id) }
		}
		sm.mu.Unlock()
	}
}
