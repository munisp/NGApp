package repository

import (
	"fmt"
	"sync"
	"time"
	"ussd-gateway/internal/models"
)

type USSDRepository struct {
	mu       sync.RWMutex
	sessions map[string]*models.Session
}

func NewUSSDRepository() *USSDRepository {
	return &USSDRepository{
		sessions: make(map[string]*models.Session),
	}
}

func (r *USSDRepository) CreateSession(s *models.Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[s.SessionID] = s
	return nil
}

func (r *USSDRepository) GetSession(id string) (*models.Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.sessions[id]
	if !ok {
		return nil, fmt.Errorf("session %s not found", id)
	}
	return s, nil
}

func (r *USSDRepository) UpdateSession(s *models.Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[s.SessionID] = s
	return nil
}

func (r *USSDRepository) ListSessions(limit int) []models.Session {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Session
	for _, s := range r.sessions {
		result = append(result, *s)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

func (r *USSDRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	total := len(r.sessions)
	active := 0
	for _, s := range r.sessions {
		if s.Status == "active" {
			active++
		}
	}
	return map[string]interface{}{
		"total_sessions": total,
		"active":         active,
		"completed":      total - active,
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	}
}
