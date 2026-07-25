package session

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const sessionTTL = 5 * time.Minute // USSD sessions expire after 5 minutes of inactivity

type Session struct {
	ID          string    `json:"id"`
	PhoneNumber string    `json:"phone_number"`
	ServiceCode string    `json:"service_code"`
	CurrentMenu string    `json:"current_menu"`
	MenuStack   []string  `json:"menu_stack"`
	Data        map[string]string `json:"data"`
	State       string    `json:"state"` // active, completed, timeout
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Manager struct {
	redis  *redis.Client
	logger *zap.Logger
}

func NewManager(redisAddr string, logger *zap.Logger) *Manager {
	rdb := redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		PoolSize:     50,
		MinIdleConns: 10,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	return &Manager{redis: rdb, logger: logger}
}

func (m *Manager) GetOrCreate(ctx context.Context, sessionID, phoneNumber, serviceCode string) (*Session, error) {
	key := fmt.Sprintf("ussd:session:%s", sessionID)

	data, err := m.redis.Get(ctx, key).Bytes()
	if err == nil {
		var sess Session
		if err := json.Unmarshal(data, &sess); err == nil {
			return &sess, nil
		}
	}

	// Create new session
	sess := &Session{
		ID:          sessionID,
		PhoneNumber: phoneNumber,
		ServiceCode: serviceCode,
		CurrentMenu: "main",
		MenuStack:   []string{},
		Data:        make(map[string]string),
		State:       "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := m.Save(ctx, sess); err != nil {
		return nil, err
	}

	// Track active session count
	m.redis.Incr(ctx, "ussd:active_sessions")
	m.redis.Expire(ctx, "ussd:active_sessions", 24*time.Hour)

	return sess, nil
}

func (m *Manager) Save(ctx context.Context, sess *Session) error {
	sess.UpdatedAt = time.Now()
	data, err := json.Marshal(sess)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("ussd:session:%s", sess.ID)
	return m.redis.Set(ctx, key, data, sessionTTL).Err()
}

func (m *Manager) Navigate(sess *Session, targetMenu string) {
	sess.MenuStack = append(sess.MenuStack, sess.CurrentMenu)
	sess.CurrentMenu = targetMenu
}

func (m *Manager) GoBack(sess *Session) {
	if len(sess.MenuStack) > 0 {
		sess.CurrentMenu = sess.MenuStack[len(sess.MenuStack)-1]
		sess.MenuStack = sess.MenuStack[:len(sess.MenuStack)-1]
	} else {
		sess.CurrentMenu = "main"
	}
}

func (m *Manager) End(ctx context.Context, sess *Session) {
	sess.State = "completed"
	m.Save(ctx, sess)
	m.redis.Decr(ctx, "ussd:active_sessions")
}

func (m *Manager) GetActiveCount(ctx context.Context) int64 {
	val, _ := m.redis.Get(ctx, "ussd:active_sessions").Int64()
	return val
}
