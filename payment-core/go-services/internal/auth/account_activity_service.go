package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type LoginHistory struct {
	ID                int64      `json:"id"`
	UserID            int64      `json:"userId"`
	Success           bool       `json:"success"`
	UserAgent         string     `json:"userAgent"`
	DeviceFingerprint string     `json:"deviceFingerprint,omitempty"`
	DeviceName        string     `json:"deviceName,omitempty"`
	IPAddress         string     `json:"ipAddress"`
	Country           string     `json:"country,omitempty"`
	City              string     `json:"city,omitempty"`
	Region            string     `json:"region,omitempty"`
	Latitude          string     `json:"latitude,omitempty"`
	Longitude         string     `json:"longitude,omitempty"`
	IsTrustedDevice   bool       `json:"isTrustedDevice"`
	IsSuspicious      bool       `json:"isSuspicious"`
	RequiresTwoFactor bool       `json:"requiresTwoFactor"`
	TwoFactorCompleted bool      `json:"twoFactorCompleted"`
	SessionID         string     `json:"sessionId,omitempty"`
	SessionActive     bool       `json:"sessionActive"`
	SessionEndedAt    *time.Time `json:"sessionEndedAt,omitempty"`
	FailureReason     string     `json:"failureReason,omitempty"`
	LoginAt           time.Time  `json:"loginAt"`
}

type LogLoginAttemptParams struct {
	UserID             int64  `json:"userId"`
	Success            bool   `json:"success"`
	UserAgent          string `json:"userAgent"`
	IPAddress          string `json:"ipAddress"`
	DeviceFingerprint  string `json:"deviceFingerprint,omitempty"`
	DeviceName         string `json:"deviceName,omitempty"`
	IsTrustedDevice    bool   `json:"isTrustedDevice"`
	RequiresTwoFactor  bool   `json:"requiresTwoFactor"`
	TwoFactorCompleted bool   `json:"twoFactorCompleted"`
	SessionID          string `json:"sessionId,omitempty"`
	FailureReason      string `json:"failureReason,omitempty"`
}

type LogLoginResult struct {
	Success bool   `json:"success"`
	LoginID int64  `json:"loginId,omitempty"`
	Error   string `json:"error,omitempty"`
}

type GetLoginHistoryParams struct {
	UserID      int64      `json:"userId"`
	Limit       int        `json:"limit,omitempty"`
	Offset      int        `json:"offset,omitempty"`
	SuccessOnly bool       `json:"successOnly,omitempty"`
	Since       *time.Time `json:"since,omitempty"`
}

type EndSessionResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type EndAllSessionsResult struct {
	Success bool   `json:"success"`
	Count   int    `json:"count,omitempty"`
	Error   string `json:"error,omitempty"`
}

type GeolocationProvider interface {
	GetGeolocation(ipAddress string) (*GeolocationData, error)
}

type GeolocationData struct {
	IP        string `json:"ip"`
	Country   string `json:"country"`
	City      string `json:"city"`
	Region    string `json:"region"`
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
}

type AccountActivityService struct {
	mu          sync.RWMutex
	db          *sql.DB
	loginHistory map[int64]*LoginHistory
	idCounter   int64
	geoProvider GeolocationProvider
}

func NewAccountActivityService(db *sql.DB, geoProvider GeolocationProvider) *AccountActivityService {
	return &AccountActivityService{
		db:           db,
		loginHistory: make(map[int64]*LoginHistory),
		idCounter:    1,
		geoProvider:  geoProvider,
	}
}

func (s *AccountActivityService) LogLoginAttempt(params *LogLoginAttemptParams) *LogLoginResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	var geoData *GeolocationData
	if s.geoProvider != nil {
		geoData, _ = s.geoProvider.GetGeolocation(params.IPAddress)
	}

	login := &LoginHistory{
		ID:                 s.idCounter,
		UserID:             params.UserID,
		Success:            params.Success,
		UserAgent:          params.UserAgent,
		DeviceFingerprint:  params.DeviceFingerprint,
		DeviceName:         params.DeviceName,
		IPAddress:          params.IPAddress,
		IsTrustedDevice:    params.IsTrustedDevice,
		IsSuspicious:       false,
		RequiresTwoFactor:  params.RequiresTwoFactor,
		TwoFactorCompleted: params.TwoFactorCompleted,
		SessionID:          params.SessionID,
		SessionActive:      params.Success,
		FailureReason:      params.FailureReason,
		LoginAt:            time.Now(),
	}

	if geoData != nil {
		login.Country = geoData.Country
		login.City = geoData.City
		login.Region = geoData.Region
		login.Latitude = geoData.Latitude
		login.Longitude = geoData.Longitude
	}

	s.idCounter++
	s.loginHistory[login.ID] = login

	return &LogLoginResult{
		Success: true,
		LoginID: login.ID,
	}
}

func (s *AccountActivityService) GetLoginHistory(params *GetLoginHistoryParams) []*LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*LoginHistory

	for _, login := range s.loginHistory {
		if login.UserID != params.UserID {
			continue
		}

		if params.SuccessOnly && !login.Success {
			continue
		}

		if params.Since != nil && login.LoginAt.Before(*params.Since) {
			continue
		}

		results = append(results, login)
	}

	if params.Offset > 0 && params.Offset < len(results) {
		results = results[params.Offset:]
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	if len(results) > limit {
		results = results[:limit]
	}

	return results
}

func (s *AccountActivityService) GetActiveSessions(userID int64) []*LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var sessions []*LoginHistory

	for _, login := range s.loginHistory {
		if login.UserID == userID && login.Success && login.SessionActive {
			sessions = append(sessions, login)
		}
	}

	return sessions
}

func (s *AccountActivityService) EndSession(userID int64, sessionID string) *EndSessionResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, login := range s.loginHistory {
		if login.UserID == userID && login.SessionID == sessionID {
			login.SessionActive = false
			now := time.Now()
			login.SessionEndedAt = &now
			return &EndSessionResult{Success: true}
		}
	}

	return &EndSessionResult{
		Success: false,
		Error:   "Session not found",
	}
}

func (s *AccountActivityService) EndAllSessions(userID int64, exceptSessionID string) *EndAllSessionsResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	now := time.Now()

	for _, login := range s.loginHistory {
		if login.UserID == userID && login.SessionActive {
			if exceptSessionID != "" && login.SessionID == exceptSessionID {
				continue
			}
			login.SessionActive = false
			login.SessionEndedAt = &now
			count++
		}
	}

	return &EndAllSessionsResult{
		Success: true,
		Count:   count,
	}
}

func (s *AccountActivityService) MarkLoginAsSuspicious(loginID int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	login, exists := s.loginHistory[loginID]
	if !exists {
		return false
	}

	login.IsSuspicious = true
	return true
}

func (s *AccountActivityService) GetLastSuccessfulLogin(userID int64) *LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var lastLogin *LoginHistory

	for _, login := range s.loginHistory {
		if login.UserID == userID && login.Success {
			if lastLogin == nil || login.LoginAt.After(lastLogin.LoginAt) {
				lastLogin = login
			}
		}
	}

	return lastLogin
}

func GenerateSessionID() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return "sess_" + hex.EncodeToString(bytes)
}

func (s *AccountActivityService) GetLoginByID(loginID int64) (*LoginHistory, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	login, exists := s.loginHistory[loginID]
	if !exists {
		return nil, fmt.Errorf("login not found")
	}
	return login, nil
}

func (s *AccountActivityService) GetFailedLoginAttempts(userID int64, since time.Time) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, login := range s.loginHistory {
		if login.UserID == userID && !login.Success && login.LoginAt.After(since) {
			count++
		}
	}
	return count
}

func (s *AccountActivityService) GetLoginsByIPAddress(ipAddress string, limit int) []*LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*LoginHistory

	for _, login := range s.loginHistory {
		if login.IPAddress == ipAddress {
			results = append(results, login)
		}
	}

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results
}

func (s *AccountActivityService) GetLoginsByCountry(country string, limit int) []*LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*LoginHistory

	for _, login := range s.loginHistory {
		if login.Country == country {
			results = append(results, login)
		}
	}

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results
}

func (s *AccountActivityService) GetSuspiciousLogins(userID int64) []*LoginHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*LoginHistory

	for _, login := range s.loginHistory {
		if login.UserID == userID && login.IsSuspicious {
			results = append(results, login)
		}
	}

	return results
}
