package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type RecoveryMethod string

const (
	RecoveryMethodEmail RecoveryMethod = "email"
	RecoveryMethodSMS   RecoveryMethod = "sms"
	RecoveryMethodAdmin RecoveryMethod = "admin"
)

type RecoveryStatus string

const (
	RecoveryStatusPending   RecoveryStatus = "pending"
	RecoveryStatusApproved  RecoveryStatus = "approved"
	RecoveryStatusCompleted RecoveryStatus = "completed"
	RecoveryStatusRejected  RecoveryStatus = "rejected"
	RecoveryStatusExpired   RecoveryStatus = "expired"
)

type AccountRecoveryRequest struct {
	ID             int64          `json:"id"`
	UserID         int64          `json:"userId"`
	RecoveryMethod RecoveryMethod `json:"recoveryMethod"`
	RecoveryCode   string         `json:"recoveryCode,omitempty"`
	Status         RecoveryStatus `json:"status"`
	ExpiresAt      time.Time      `json:"expiresAt"`
	RequestedAt    time.Time      `json:"requestedAt"`
	CompletedAt    *time.Time     `json:"completedAt,omitempty"`
	ReviewedBy     *int64         `json:"reviewedBy,omitempty"`
	ReviewedAt     *time.Time     `json:"reviewedAt,omitempty"`
	ReviewNotes    string         `json:"reviewNotes,omitempty"`
	IPAddress      string         `json:"ipAddress,omitempty"`
	UserAgent      string         `json:"userAgent,omitempty"`
}

type RecoveryAuditLog struct {
	ID          int64     `json:"id"`
	RequestID   int64     `json:"requestId"`
	UserID      int64     `json:"userId"`
	Action      string    `json:"action"`
	PerformedBy *int64    `json:"performedBy,omitempty"`
	IPAddress   string    `json:"ipAddress,omitempty"`
	UserAgent   string    `json:"userAgent,omitempty"`
	Details     string    `json:"details,omitempty"`
	PerformedAt time.Time `json:"performedAt"`
}

type InitiateRecoveryParams struct {
	UserID         int64          `json:"userId"`
	RecoveryMethod RecoveryMethod `json:"recoveryMethod"`
	PhoneNumber    string         `json:"phoneNumber,omitempty"`
	IPAddress      string         `json:"ipAddress,omitempty"`
	UserAgent      string         `json:"userAgent,omitempty"`
}

type InitiateRecoveryResult struct {
	Success      bool   `json:"success"`
	RequestID    int64  `json:"requestId,omitempty"`
	RecoveryCode string `json:"recoveryCode,omitempty"`
	Error        string `json:"error,omitempty"`
}

type VerifyRecoveryCodeParams struct {
	UserID       int64  `json:"userId"`
	RecoveryCode string `json:"recoveryCode"`
	IPAddress    string `json:"ipAddress,omitempty"`
	UserAgent    string `json:"userAgent,omitempty"`
}

type VerifyRecoveryCodeResult struct {
	Success   bool   `json:"success"`
	RequestID int64  `json:"requestId,omitempty"`
	Error     string `json:"error,omitempty"`
}

type RecoveryRateLimitResult struct {
	Allowed           bool `json:"allowed"`
	RemainingRequests int  `json:"remainingRequests"`
}

type EmailSender interface {
	SendRecoveryCodeEmail(to, recoveryCode string, expiresInHours int) error
}

type SMSSender interface {
	SendRecoverySMS(to, recoveryCode string, expiresInHours int) error
}

const (
	RecoveryCodeExpirationHours = 24
	MaxRecoveryRequestsPerDay   = 3
)

type AccountRecoveryService struct {
	mu          sync.RWMutex
	db          *sql.DB
	requests    map[int64]*AccountRecoveryRequest
	auditLogs   []*RecoveryAuditLog
	idCounter   int64
	emailSender EmailSender
	smsSender   SMSSender
}

func NewAccountRecoveryService(db *sql.DB, emailSender EmailSender, smsSender SMSSender) *AccountRecoveryService {
	return &AccountRecoveryService{
		db:          db,
		requests:    make(map[int64]*AccountRecoveryRequest),
		auditLogs:   make([]*RecoveryAuditLog, 0),
		idCounter:   1,
		emailSender: emailSender,
		smsSender:   smsSender,
	}
}

func GenerateRecoveryCode() string {
	chars := "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	segments := 3
	segmentLength := 4

	code := ""
	for i := 0; i < segments; i++ {
		if i > 0 {
			code += "-"
		}
		for j := 0; j < segmentLength; j++ {
			b := make([]byte, 1)
			rand.Read(b)
			code += string(chars[int(b[0])%len(chars)])
		}
	}
	return code
}

func hashRecoveryCode(code string) string {
	h := sha256.New()
	h.Write([]byte(code))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *AccountRecoveryService) CheckRecoveryRateLimit(userID int64) *RecoveryRateLimitResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	oneDayAgo := time.Now().Add(-24 * time.Hour)
	count := 0

	for _, req := range s.requests {
		if req.UserID == userID && req.RequestedAt.After(oneDayAgo) {
			count++
		}
	}

	allowed := count < MaxRecoveryRequestsPerDay
	remaining := MaxRecoveryRequestsPerDay - count
	if remaining < 0 {
		remaining = 0
	}

	return &RecoveryRateLimitResult{
		Allowed:           allowed,
		RemainingRequests: remaining,
	}
}

func (s *AccountRecoveryService) InitiateRecovery(params *InitiateRecoveryParams) *InitiateRecoveryResult {
	rateLimit := s.CheckRecoveryRateLimit(params.UserID)
	if !rateLimit.Allowed {
		return &InitiateRecoveryResult{
			Success: false,
			Error:   fmt.Sprintf("Too many recovery requests. Please try again later. (%d requests remaining)", rateLimit.RemainingRequests),
		}
	}

	recoveryCode := GenerateRecoveryCode()
	hashedCode := hashRecoveryCode(recoveryCode)

	expiresAt := time.Now().Add(RecoveryCodeExpirationHours * time.Hour)

	s.mu.Lock()
	request := &AccountRecoveryRequest{
		ID:             s.idCounter,
		UserID:         params.UserID,
		RecoveryMethod: params.RecoveryMethod,
		RecoveryCode:   hashedCode,
		Status:         RecoveryStatusPending,
		ExpiresAt:      expiresAt,
		RequestedAt:    time.Now(),
		IPAddress:      params.IPAddress,
		UserAgent:      params.UserAgent,
	}
	s.idCounter++
	s.requests[request.ID] = request
	s.mu.Unlock()

	s.logRecoveryAction(request.ID, params.UserID, "request_initiated", nil, params.IPAddress, params.UserAgent, fmt.Sprintf(`{"recoveryMethod":"%s"}`, params.RecoveryMethod))

	if params.RecoveryMethod == RecoveryMethodAdmin {
		return &InitiateRecoveryResult{
			Success:   true,
			RequestID: request.ID,
		}
	}

	return &InitiateRecoveryResult{
		Success:      true,
		RequestID:    request.ID,
		RecoveryCode: recoveryCode,
	}
}

func (s *AccountRecoveryService) VerifyRecoveryCode(params *VerifyRecoveryCodeParams) *VerifyRecoveryCodeResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	hashedCode := hashRecoveryCode(params.RecoveryCode)
	now := time.Now()

	for _, req := range s.requests {
		if req.UserID == params.UserID && req.Status == RecoveryStatusPending && req.ExpiresAt.After(now) {
			if req.RecoveryCode == hashedCode {
				req.Status = RecoveryStatusApproved

				s.logRecoveryAction(req.ID, params.UserID, "code_verified", nil, params.IPAddress, params.UserAgent, "")

				return &VerifyRecoveryCodeResult{
					Success:   true,
					RequestID: req.ID,
				}
			}
		}
	}

	s.logRecoveryAction(0, params.UserID, "code_failed", nil, params.IPAddress, params.UserAgent, `{"reason":"Invalid code"}`)

	return &VerifyRecoveryCodeResult{
		Success: false,
		Error:   "Invalid recovery code",
	}
}

func (s *AccountRecoveryService) CompleteRecovery(requestID, userID int64) *InitiateRecoveryResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.requests[requestID]
	if !exists || req.UserID != userID || req.Status != RecoveryStatusApproved {
		return &InitiateRecoveryResult{
			Success: false,
			Error:   "Recovery request not found or not approved",
		}
	}

	now := time.Now()
	req.Status = RecoveryStatusCompleted
	req.CompletedAt = &now

	s.logRecoveryAction(requestID, userID, "recovery_completed", nil, "", "", "")

	return &InitiateRecoveryResult{
		Success:   true,
		RequestID: requestID,
	}
}

func (s *AccountRecoveryService) ListPendingRecoveryRequests() []*AccountRecoveryRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var pending []*AccountRecoveryRequest
	for _, req := range s.requests {
		if req.Status == RecoveryStatusPending {
			pending = append(pending, req)
		}
	}
	return pending
}

func (s *AccountRecoveryService) ApproveRecoveryRequest(requestID, adminUserID int64, notes string) *InitiateRecoveryResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.requests[requestID]
	if !exists {
		return &InitiateRecoveryResult{
			Success: false,
			Error:   "Recovery request not found",
		}
	}

	now := time.Now()
	req.Status = RecoveryStatusApproved
	req.ReviewedBy = &adminUserID
	req.ReviewedAt = &now
	req.ReviewNotes = notes

	s.logRecoveryAction(requestID, req.UserID, "admin_approved", &adminUserID, "", "", fmt.Sprintf(`{"notes":"%s"}`, notes))

	return &InitiateRecoveryResult{
		Success:   true,
		RequestID: requestID,
	}
}

func (s *AccountRecoveryService) RejectRecoveryRequest(requestID, adminUserID int64, notes string) *InitiateRecoveryResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.requests[requestID]
	if !exists {
		return &InitiateRecoveryResult{
			Success: false,
			Error:   "Recovery request not found",
		}
	}

	now := time.Now()
	req.Status = RecoveryStatusRejected
	req.ReviewedBy = &adminUserID
	req.ReviewedAt = &now
	req.ReviewNotes = notes

	s.logRecoveryAction(requestID, req.UserID, "admin_rejected", &adminUserID, "", "", fmt.Sprintf(`{"notes":"%s"}`, notes))

	return &InitiateRecoveryResult{
		Success:   true,
		RequestID: requestID,
	}
}

func (s *AccountRecoveryService) CleanupExpiredRequests() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	count := 0

	for _, req := range s.requests {
		if req.Status == RecoveryStatusPending && now.After(req.ExpiresAt) {
			req.Status = RecoveryStatusExpired
			s.logRecoveryAction(req.ID, req.UserID, "request_expired", nil, "", "", "")
			count++
		}
	}

	return count
}

func (s *AccountRecoveryService) GetRecoveryRequest(requestID int64) (*AccountRecoveryRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	req, exists := s.requests[requestID]
	if !exists {
		return nil, fmt.Errorf("recovery request not found")
	}
	return req, nil
}

func (s *AccountRecoveryService) GetUserRecoveryRequests(userID int64) []*AccountRecoveryRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var requests []*AccountRecoveryRequest
	for _, req := range s.requests {
		if req.UserID == userID {
			requests = append(requests, req)
		}
	}
	return requests
}

func (s *AccountRecoveryService) logRecoveryAction(requestID, userID int64, action string, performedBy *int64, ipAddress, userAgent, details string) {
	s.auditLogs = append(s.auditLogs, &RecoveryAuditLog{
		ID:          int64(len(s.auditLogs) + 1),
		RequestID:   requestID,
		UserID:      userID,
		Action:      action,
		PerformedBy: performedBy,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		Details:     details,
		PerformedAt: time.Now(),
	})
}

func (s *AccountRecoveryService) GetAuditLogs(requestID int64) []*RecoveryAuditLog {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var logs []*RecoveryAuditLog
	for _, log := range s.auditLogs {
		if log.RequestID == requestID {
			logs = append(logs, log)
		}
	}
	return logs
}
