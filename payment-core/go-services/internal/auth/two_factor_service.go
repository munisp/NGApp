package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type TwoFactorSetupResult struct {
	Secret         string   `json:"secret"`
	QRCodeURL      string   `json:"qrCodeUrl"`
	BackupCodes    []string `json:"backupCodes"`
	ManualEntryKey string   `json:"manualEntryKey"`
	OTPAuthURL     string   `json:"otpAuthUrl"`
}

type TwoFactorVerificationResult struct {
	IsValid bool   `json:"isValid"`
	Message string `json:"message"`
}

type BackupCodeVerificationResult struct {
	IsValid        bool     `json:"isValid"`
	RemainingCodes []string `json:"remainingCodes"`
}

type SMSTwoFactorOptions struct {
	PhoneNumber string `json:"phoneNumber"`
	Provider    string `json:"provider"`
}

type SMSVerificationResult struct {
	Success   bool      `json:"success"`
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type TwoFactorAttempt struct {
	UserID      int64
	Attempts    int
	LastAttempt time.Time
	LockedUntil *time.Time
}

type RateLimitResult struct {
	Allowed           bool       `json:"allowed"`
	RemainingAttempts int        `json:"remainingAttempts"`
	LockedUntil       *time.Time `json:"lockedUntil,omitempty"`
}

type TwoFactorService struct {
	mu           sync.RWMutex
	appName      string
	issuer       string
	secretLength int
	window       int
	attempts     map[int64]*TwoFactorAttempt
	smsService   SMSService
	httpClient   *http.Client
}

func NewTwoFactorService(appName, issuer string) *TwoFactorService {
	return &TwoFactorService{
		appName:      appName,
		issuer:       issuer,
		secretLength: 32,
		window:       2,
		attempts:     make(map[int64]*TwoFactorAttempt),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *TwoFactorService) SetSMSService(smsService SMSService) {
	s.smsService = smsService
}

func (s *TwoFactorService) GenerateTwoFactorSecret(userEmail string) (*TwoFactorSetupResult, error) {
	secret := make([]byte, s.secretLength)
	if _, err := rand.Read(secret); err != nil {
		return nil, fmt.Errorf("failed to generate secret: %w", err)
	}

	base32Secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret)

	otpAuthURL := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		url.QueryEscape(s.appName),
		url.QueryEscape(userEmail),
		base32Secret,
		url.QueryEscape(s.issuer),
	)

	backupCodes := s.GenerateBackupCodes(10)

	return &TwoFactorSetupResult{
		Secret:         base32Secret,
		QRCodeURL:      s.generateQRCodeURL(otpAuthURL),
		BackupCodes:    backupCodes,
		ManualEntryKey: base32Secret,
		OTPAuthURL:     otpAuthURL,
	}, nil
}

func (s *TwoFactorService) generateQRCodeURL(data string) string {
	return fmt.Sprintf("https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=%s",
		url.QueryEscape(data))
}

func (s *TwoFactorService) VerifyTwoFactorToken(token, secret string) *TwoFactorVerificationResult {
	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return &TwoFactorVerificationResult{
			IsValid: false,
			Message: "Invalid secret format",
		}
	}

	currentTime := time.Now().Unix() / 30

	for i := -s.window; i <= s.window; i++ {
		expectedToken := s.generateTOTP(secretBytes, currentTime+int64(i))
		if token == expectedToken {
			return &TwoFactorVerificationResult{
				IsValid: true,
				Message: "2FA token verified successfully",
			}
		}
	}

	return &TwoFactorVerificationResult{
		IsValid: false,
		Message: "Invalid 2FA token",
	}
}

func (s *TwoFactorService) generateTOTP(secret []byte, counter int64) string {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))

	h := hmac.New(sha1.New, secret)
	h.Write(buf)
	hash := h.Sum(nil)

	offset := hash[len(hash)-1] & 0x0f
	code := binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7fffffff
	code = code % 1000000

	return fmt.Sprintf("%06d", code)
}

func (s *TwoFactorService) GenerateBackupCodes(count int) []string {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		codeBytes := make([]byte, 4)
		rand.Read(codeBytes)
		codes[i] = strings.ToUpper(hex.EncodeToString(codeBytes))
	}
	return codes
}

func (s *TwoFactorService) HashBackupCodes(codes []string) []string {
	hashedCodes := make([]string, len(codes))
	for i, code := range codes {
		hashedCodes[i] = s.hashBackupCode(code)
	}
	return hashedCodes
}

func (s *TwoFactorService) hashBackupCode(code string) string {
	hash := sha256.Sum256([]byte(strings.ToUpper(code)))
	return hex.EncodeToString(hash[:])
}

func (s *TwoFactorService) VerifyBackupCode(code string, hashedBackupCodes []string) *BackupCodeVerificationResult {
	hashedCode := s.hashBackupCode(code)

	for i, storedHash := range hashedBackupCodes {
		if hashedCode == storedHash {
			remainingCodes := make([]string, 0, len(hashedBackupCodes)-1)
			remainingCodes = append(remainingCodes, hashedBackupCodes[:i]...)
			remainingCodes = append(remainingCodes, hashedBackupCodes[i+1:]...)

			return &BackupCodeVerificationResult{
				IsValid:        true,
				RemainingCodes: remainingCodes,
			}
		}
	}

	return &BackupCodeVerificationResult{
		IsValid:        false,
		RemainingCodes: hashedBackupCodes,
	}
}

func (s *TwoFactorService) GenerateCurrentToken(secret string) (string, error) {
	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return "", fmt.Errorf("invalid secret format: %w", err)
	}

	currentTime := time.Now().Unix() / 30
	return s.generateTOTP(secretBytes, currentTime), nil
}

func (s *TwoFactorService) ValidateTwoFactorSetup(token, secret string) bool {
	result := s.VerifyTwoFactorToken(token, secret)
	return result.IsValid
}

func (s *TwoFactorService) FormatBackupCodes(codes []string) string {
	var formatted strings.Builder
	for i, code := range codes {
		if len(code) >= 4 {
			formattedCode := code[:4] + "-" + code[4:]
			formatted.WriteString(fmt.Sprintf("%d. %s\n", i+1, formattedCode))
		} else {
			formatted.WriteString(fmt.Sprintf("%d. %s\n", i+1, code))
		}
	}
	return formatted.String()
}

func (s *TwoFactorService) ShouldRegenerateBackupCodes(remainingCodes int, threshold int) bool {
	if threshold <= 0 {
		threshold = 3
	}
	return remainingCodes <= threshold
}

func (s *TwoFactorService) SendSMSVerificationCode(options SMSTwoFactorOptions) (*SMSVerificationResult, error) {
	codeBytes := make([]byte, 3)
	rand.Read(codeBytes)
	code := fmt.Sprintf("%06d", binary.BigEndian.Uint32(append([]byte{0}, codeBytes...))%1000000)

	expiresAt := time.Now().Add(10 * time.Minute)

	if s.smsService != nil {
		message := fmt.Sprintf("Your verification code is: %s. This code expires in 10 minutes.", code)
		err := s.smsService.SendSMS(context.Background(), options.PhoneNumber, message)
		if err != nil {
			return nil, fmt.Errorf("failed to send SMS: %w", err)
		}
	}

	return &SMSVerificationResult{
		Success:   true,
		Code:      code,
		ExpiresAt: expiresAt,
	}, nil
}

func (s *TwoFactorService) VerifySMSCode(providedCode, storedCode string, expiresAt time.Time) *TwoFactorVerificationResult {
	if time.Now().After(expiresAt) {
		return &TwoFactorVerificationResult{
			IsValid: false,
			Message: "Verification code has expired",
		}
	}

	if providedCode != storedCode {
		return &TwoFactorVerificationResult{
			IsValid: false,
			Message: "Invalid verification code",
		}
	}

	return &TwoFactorVerificationResult{
		IsValid: true,
		Message: "SMS code verified successfully",
	}
}

func (s *TwoFactorService) CheckRateLimit(userID int64) *RateLimitResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	attempt, exists := s.attempts[userID]

	if !exists {
		s.attempts[userID] = &TwoFactorAttempt{
			UserID:      userID,
			Attempts:    0,
			LastAttempt: now,
		}
		return &RateLimitResult{
			Allowed:           true,
			RemainingAttempts: 5,
		}
	}

	if attempt.LockedUntil != nil && now.Before(*attempt.LockedUntil) {
		return &RateLimitResult{
			Allowed:           false,
			RemainingAttempts: 0,
			LockedUntil:       attempt.LockedUntil,
		}
	}

	if now.Sub(attempt.LastAttempt) > 15*time.Minute {
		attempt.Attempts = 0
		attempt.LockedUntil = nil
	}

	if attempt.Attempts >= 5 {
		lockedUntil := now.Add(30 * time.Minute)
		attempt.LockedUntil = &lockedUntil
		return &RateLimitResult{
			Allowed:           false,
			RemainingAttempts: 0,
			LockedUntil:       &lockedUntil,
		}
	}

	return &RateLimitResult{
		Allowed:           true,
		RemainingAttempts: 5 - attempt.Attempts,
	}
}

func (s *TwoFactorService) RecordAttempt(userID int64, success bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	attempt, exists := s.attempts[userID]

	if !exists {
		attempts := 0
		if !success {
			attempts = 1
		}
		s.attempts[userID] = &TwoFactorAttempt{
			UserID:      userID,
			Attempts:    attempts,
			LastAttempt: now,
		}
		return
	}

	if success {
		attempt.Attempts = 0
		attempt.LockedUntil = nil
	} else {
		attempt.Attempts++
	}

	attempt.LastAttempt = now
}

func (s *TwoFactorService) CleanupRateLimits() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	fifteenMinutesAgo := now.Add(-15 * time.Minute)

	for userID, attempt := range s.attempts {
		if attempt.LastAttempt.Before(fifteenMinutesAgo) && attempt.LockedUntil == nil {
			delete(s.attempts, userID)
		}
	}
}

func (s *TwoFactorService) GetAttemptCount(userID int64) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if attempt, exists := s.attempts[userID]; exists {
		return attempt.Attempts
	}
	return 0
}

func (s *TwoFactorService) ResetAttempts(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.attempts, userID)
}
