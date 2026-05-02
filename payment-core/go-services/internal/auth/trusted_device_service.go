package auth

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

const TrustDurationDays = 30

type TrustedDevice struct {
	ID                int64     `json:"id"`
	UserID            int64     `json:"userId"`
	DeviceFingerprint string    `json:"deviceFingerprint"`
	DeviceName        string    `json:"deviceName"`
	UserAgent         string    `json:"userAgent"`
	IPAddress         string    `json:"ipAddress,omitempty"`
	IsActive          bool      `json:"isActive"`
	CreatedAt         time.Time `json:"createdAt"`
	LastUsedAt        time.Time `json:"lastUsedAt"`
	ExpiresAt         time.Time `json:"expiresAt"`
}

type TrustDeviceParams struct {
	UserID            int64
	DeviceFingerprint string
	UserAgent         string
	IPAddress         string
	DeviceName        string
}

type TrustDeviceResult struct {
	Success  bool   `json:"success"`
	DeviceID int64  `json:"deviceId,omitempty"`
	Error    string `json:"error,omitempty"`
}

type VerifyDeviceResult struct {
	Trusted  bool  `json:"trusted"`
	DeviceID int64 `json:"deviceId,omitempty"`
}

type RevokeAllResult struct {
	Success bool   `json:"success"`
	Count   int    `json:"count"`
	Error   string `json:"error,omitempty"`
}

type TrustedDeviceService struct {
	mu        sync.RWMutex
	db        *sql.DB
	devices   map[int64][]*TrustedDevice
	idCounter int64
}

func NewTrustedDeviceService(db *sql.DB) *TrustedDeviceService {
	return &TrustedDeviceService{
		db:        db,
		devices:   make(map[int64][]*TrustedDevice),
		idCounter: 1,
	}
}

func GenerateDeviceFingerprint(userAgent string, additionalData map[string]interface{}) string {
	data := map[string]interface{}{
		"userAgent": userAgent,
	}

	for k, v := range additionalData {
		data[k] = v
	}

	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

func ExtractDeviceName(userAgent string) string {
	ua := strings.ToLower(userAgent)

	switch {
	case strings.Contains(ua, "iphone"):
		return "iPhone"
	case strings.Contains(ua, "ipad"):
		return "iPad"
	case strings.Contains(ua, "android"):
		return "Android Device"
	case strings.Contains(ua, "mac"):
		return "Mac"
	case strings.Contains(ua, "windows"):
		return "Windows PC"
	case strings.Contains(ua, "linux"):
		return "Linux PC"
	case strings.Contains(ua, "chrome"):
		return "Chrome Browser"
	case strings.Contains(ua, "firefox"):
		return "Firefox Browser"
	case strings.Contains(ua, "safari"):
		return "Safari Browser"
	case strings.Contains(ua, "edge"):
		return "Edge Browser"
	default:
		return "Unknown Device"
	}
}

func (s *TrustedDeviceService) TrustDevice(params TrustDeviceParams) *TrustDeviceResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	userDevices := s.devices[params.UserID]
	for _, device := range userDevices {
		if device.DeviceFingerprint == params.DeviceFingerprint &&
			device.IsActive &&
			time.Now().Before(device.ExpiresAt) {
			device.LastUsedAt = time.Now()
			return &TrustDeviceResult{
				Success:  true,
				DeviceID: device.ID,
			}
		}
	}

	deviceName := params.DeviceName
	if deviceName == "" {
		deviceName = ExtractDeviceName(params.UserAgent)
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, TrustDurationDays)

	newDevice := &TrustedDevice{
		ID:                s.idCounter,
		UserID:            params.UserID,
		DeviceFingerprint: params.DeviceFingerprint,
		DeviceName:        deviceName,
		UserAgent:         params.UserAgent,
		IPAddress:         params.IPAddress,
		IsActive:          true,
		CreatedAt:         now,
		LastUsedAt:        now,
		ExpiresAt:         expiresAt,
	}

	s.idCounter++
	s.devices[params.UserID] = append(s.devices[params.UserID], newDevice)

	return &TrustDeviceResult{
		Success:  true,
		DeviceID: newDevice.ID,
	}
}

func (s *TrustedDeviceService) VerifyTrustedDevice(userID int64, deviceFingerprint string) *VerifyDeviceResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	userDevices := s.devices[userID]
	for _, device := range userDevices {
		if device.DeviceFingerprint == deviceFingerprint &&
			device.IsActive &&
			time.Now().Before(device.ExpiresAt) {
			device.LastUsedAt = time.Now()
			return &VerifyDeviceResult{
				Trusted:  true,
				DeviceID: device.ID,
			}
		}
	}

	return &VerifyDeviceResult{
		Trusted: false,
	}
}

func (s *TrustedDeviceService) GetUserTrustedDevices(userID int64) []*TrustedDevice {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var activeDevices []*TrustedDevice
	for _, device := range s.devices[userID] {
		if device.IsActive {
			activeDevices = append(activeDevices, device)
		}
	}

	return activeDevices
}

func (s *TrustedDeviceService) RevokeTrustedDevice(userID, deviceID int64) *TrustDeviceResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	userDevices := s.devices[userID]
	for _, device := range userDevices {
		if device.ID == deviceID && device.UserID == userID {
			device.IsActive = false
			return &TrustDeviceResult{
				Success: true,
			}
		}
	}

	return &TrustDeviceResult{
		Success: false,
		Error:   "Device not found",
	}
}

func (s *TrustedDeviceService) RevokeAllTrustedDevices(userID int64) *RevokeAllResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	for _, device := range s.devices[userID] {
		if device.IsActive {
			device.IsActive = false
			count++
		}
	}

	return &RevokeAllResult{
		Success: true,
		Count:   count,
	}
}

func (s *TrustedDeviceService) CleanupExpiredDevices() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	count := 0

	for userID, devices := range s.devices {
		for _, device := range devices {
			if device.IsActive && now.After(device.ExpiresAt) {
				device.IsActive = false
				count++
			}
		}
		_ = userID
	}

	return count
}

func (s *TrustedDeviceService) GetDeviceByID(userID, deviceID int64) (*TrustedDevice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, device := range s.devices[userID] {
		if device.ID == deviceID {
			return device, nil
		}
	}

	return nil, fmt.Errorf("device not found")
}

func (s *TrustedDeviceService) UpdateDeviceName(userID, deviceID int64, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, device := range s.devices[userID] {
		if device.ID == deviceID && device.UserID == userID {
			device.DeviceName = newName
			return nil
		}
	}

	return fmt.Errorf("device not found")
}

func (s *TrustedDeviceService) ExtendDeviceTrust(userID, deviceID int64, additionalDays int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, device := range s.devices[userID] {
		if device.ID == deviceID && device.UserID == userID && device.IsActive {
			device.ExpiresAt = device.ExpiresAt.AddDate(0, 0, additionalDays)
			return nil
		}
	}

	return fmt.Errorf("device not found or not active")
}

func (s *TrustedDeviceService) GetActiveDeviceCount(userID int64) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, device := range s.devices[userID] {
		if device.IsActive && time.Now().Before(device.ExpiresAt) {
			count++
		}
	}

	return count
}

func (s *TrustedDeviceService) IsDeviceTrusted(userID int64, fingerprint string) bool {
	result := s.VerifyTrustedDevice(userID, fingerprint)
	return result.Trusted
}

func (s *TrustedDeviceService) GetRecentlyUsedDevices(userID int64, limit int) []*TrustedDevice {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var activeDevices []*TrustedDevice
	for _, device := range s.devices[userID] {
		if device.IsActive {
			activeDevices = append(activeDevices, device)
		}
	}

	for i := 0; i < len(activeDevices)-1; i++ {
		for j := i + 1; j < len(activeDevices); j++ {
			if activeDevices[j].LastUsedAt.After(activeDevices[i].LastUsedAt) {
				activeDevices[i], activeDevices[j] = activeDevices[j], activeDevices[i]
			}
		}
	}

	if limit > 0 && len(activeDevices) > limit {
		return activeDevices[:limit]
	}

	return activeDevices
}
