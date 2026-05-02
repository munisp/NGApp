package notifications

import (
	"database/sql"
	"sync"
	"time"
)

type NotificationPreferences struct {
	ID                       int64     `json:"id"`
	UserID                   int64     `json:"userId"`
	EmailNotifications       bool      `json:"emailNotifications"`
	SMSNotifications         bool      `json:"smsNotifications"`
	NewDeviceAlerts          bool      `json:"newDeviceAlerts"`
	SuspiciousActivityAlerts bool      `json:"suspiciousActivityAlerts"`
	LoginAlerts              bool      `json:"loginAlerts"`
	PasswordChangeAlerts     bool      `json:"passwordChangeAlerts"`
	TwoFactorChangeAlerts    bool      `json:"twoFactorChangeAlerts"`
	TransactionAlerts        bool      `json:"transactionAlerts"`
	MarketingEmails          bool      `json:"marketingEmails"`
	QuietHoursEnabled        bool      `json:"quietHoursEnabled"`
	QuietHoursStart          string    `json:"quietHoursStart,omitempty"`
	QuietHoursEnd            string    `json:"quietHoursEnd,omitempty"`
	CreatedAt                time.Time `json:"createdAt"`
	UpdatedAt                time.Time `json:"updatedAt"`
}

type UpdatePreferencesParams struct {
	EmailNotifications       *bool   `json:"emailNotifications,omitempty"`
	SMSNotifications         *bool   `json:"smsNotifications,omitempty"`
	NewDeviceAlerts          *bool   `json:"newDeviceAlerts,omitempty"`
	SuspiciousActivityAlerts *bool   `json:"suspiciousActivityAlerts,omitempty"`
	LoginAlerts              *bool   `json:"loginAlerts,omitempty"`
	PasswordChangeAlerts     *bool   `json:"passwordChangeAlerts,omitempty"`
	TwoFactorChangeAlerts    *bool   `json:"twoFactorChangeAlerts,omitempty"`
	TransactionAlerts        *bool   `json:"transactionAlerts,omitempty"`
	MarketingEmails          *bool   `json:"marketingEmails,omitempty"`
	QuietHoursEnabled        *bool   `json:"quietHoursEnabled,omitempty"`
	QuietHoursStart          *string `json:"quietHoursStart,omitempty"`
	QuietHoursEnd            *string `json:"quietHoursEnd,omitempty"`
}

type PreferencesResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type NotificationType string

const (
	NotificationTypeNewDevice           NotificationType = "newDevice"
	NotificationTypeSuspiciousActivity  NotificationType = "suspiciousActivity"
	NotificationTypeLogin               NotificationType = "login"
	NotificationTypePasswordChange      NotificationType = "passwordChange"
	NotificationTypeTwoFactorChange     NotificationType = "twoFactorChange"
	NotificationTypeTransaction         NotificationType = "transaction"
)

type NotificationChannel string

const (
	NotificationChannelEmail NotificationChannel = "email"
	NotificationChannelSMS   NotificationChannel = "sms"
	NotificationChannelPush  NotificationChannel = "push"
)

type NotificationPreferencesService struct {
	mu          sync.RWMutex
	db          *sql.DB
	preferences map[int64]*NotificationPreferences
	idCounter   int64
}

func NewNotificationPreferencesService(db *sql.DB) *NotificationPreferencesService {
	return &NotificationPreferencesService{
		db:          db,
		preferences: make(map[int64]*NotificationPreferences),
		idCounter:   1,
	}
}

func (s *NotificationPreferencesService) GetPreferences(userID int64) *NotificationPreferences {
	s.mu.Lock()
	defer s.mu.Unlock()

	if prefs, exists := s.preferences[userID]; exists {
		return prefs
	}

	now := time.Now()
	defaultPrefs := &NotificationPreferences{
		ID:                       s.idCounter,
		UserID:                   userID,
		EmailNotifications:       true,
		SMSNotifications:         false,
		NewDeviceAlerts:          true,
		SuspiciousActivityAlerts: true,
		LoginAlerts:              false,
		PasswordChangeAlerts:     true,
		TwoFactorChangeAlerts:    true,
		TransactionAlerts:        true,
		MarketingEmails:          false,
		QuietHoursEnabled:        false,
		CreatedAt:                now,
		UpdatedAt:                now,
	}

	s.idCounter++
	s.preferences[userID] = defaultPrefs

	return defaultPrefs
}

func (s *NotificationPreferencesService) UpdatePreferences(userID int64, updates *UpdatePreferencesParams) *PreferencesResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	prefs, exists := s.preferences[userID]
	if !exists {
		s.mu.Unlock()
		prefs = s.GetPreferences(userID)
		s.mu.Lock()
	}

	if updates.EmailNotifications != nil {
		prefs.EmailNotifications = *updates.EmailNotifications
	}
	if updates.SMSNotifications != nil {
		prefs.SMSNotifications = *updates.SMSNotifications
	}
	if updates.NewDeviceAlerts != nil {
		prefs.NewDeviceAlerts = *updates.NewDeviceAlerts
	}
	if updates.SuspiciousActivityAlerts != nil {
		prefs.SuspiciousActivityAlerts = *updates.SuspiciousActivityAlerts
	}
	if updates.LoginAlerts != nil {
		prefs.LoginAlerts = *updates.LoginAlerts
	}
	if updates.PasswordChangeAlerts != nil {
		prefs.PasswordChangeAlerts = *updates.PasswordChangeAlerts
	}
	if updates.TwoFactorChangeAlerts != nil {
		prefs.TwoFactorChangeAlerts = *updates.TwoFactorChangeAlerts
	}
	if updates.TransactionAlerts != nil {
		prefs.TransactionAlerts = *updates.TransactionAlerts
	}
	if updates.MarketingEmails != nil {
		prefs.MarketingEmails = *updates.MarketingEmails
	}
	if updates.QuietHoursEnabled != nil {
		prefs.QuietHoursEnabled = *updates.QuietHoursEnabled
	}
	if updates.QuietHoursStart != nil {
		prefs.QuietHoursStart = *updates.QuietHoursStart
	}
	if updates.QuietHoursEnd != nil {
		prefs.QuietHoursEnd = *updates.QuietHoursEnd
	}

	prefs.UpdatedAt = time.Now()

	return &PreferencesResult{Success: true}
}

func (s *NotificationPreferencesService) ResetPreferences(userID int64) *PreferencesResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	prefs, exists := s.preferences[userID]
	if !exists {
		return &PreferencesResult{
			Success: false,
			Error:   "Preferences not found",
		}
	}

	now := time.Now()
	prefs.EmailNotifications = true
	prefs.SMSNotifications = false
	prefs.NewDeviceAlerts = true
	prefs.SuspiciousActivityAlerts = true
	prefs.LoginAlerts = false
	prefs.PasswordChangeAlerts = true
	prefs.TwoFactorChangeAlerts = true
	prefs.TransactionAlerts = true
	prefs.MarketingEmails = false
	prefs.QuietHoursEnabled = false
	prefs.QuietHoursStart = ""
	prefs.QuietHoursEnd = ""
	prefs.UpdatedAt = now

	return &PreferencesResult{Success: true}
}

func (s *NotificationPreferencesService) ShouldSendNotification(userID int64, notificationType NotificationType, channel NotificationChannel) bool {
	prefs := s.GetPreferences(userID)
	if prefs == nil {
		return notificationType == NotificationTypeSuspiciousActivity || notificationType == NotificationTypePasswordChange
	}

	switch channel {
	case NotificationChannelEmail:
		if !prefs.EmailNotifications {
			return false
		}
	case NotificationChannelSMS:
		if !prefs.SMSNotifications {
			return false
		}
	}

	if prefs.QuietHoursEnabled && s.isQuietHours(prefs) {
		if notificationType != NotificationTypeSuspiciousActivity {
			return false
		}
	}

	switch notificationType {
	case NotificationTypeNewDevice:
		return prefs.NewDeviceAlerts
	case NotificationTypeSuspiciousActivity:
		return prefs.SuspiciousActivityAlerts
	case NotificationTypeLogin:
		return prefs.LoginAlerts
	case NotificationTypePasswordChange:
		return prefs.PasswordChangeAlerts
	case NotificationTypeTwoFactorChange:
		return prefs.TwoFactorChangeAlerts
	case NotificationTypeTransaction:
		return prefs.TransactionAlerts
	default:
		return false
	}
}

func (s *NotificationPreferencesService) isQuietHours(prefs *NotificationPreferences) bool {
	if !prefs.QuietHoursEnabled || prefs.QuietHoursStart == "" || prefs.QuietHoursEnd == "" {
		return false
	}

	now := time.Now()
	currentTime := now.Format("15:04")

	if prefs.QuietHoursStart <= prefs.QuietHoursEnd {
		return currentTime >= prefs.QuietHoursStart && currentTime <= prefs.QuietHoursEnd
	}

	return currentTime >= prefs.QuietHoursStart || currentTime <= prefs.QuietHoursEnd
}

func (s *NotificationPreferencesService) GetAllPreferences() map[int64]*NotificationPreferences {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[int64]*NotificationPreferences)
	for k, v := range s.preferences {
		result[k] = v
	}
	return result
}

func (s *NotificationPreferencesService) DeletePreferences(userID int64) *PreferencesResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.preferences[userID]; !exists {
		return &PreferencesResult{
			Success: false,
			Error:   "Preferences not found",
		}
	}

	delete(s.preferences, userID)
	return &PreferencesResult{Success: true}
}

func (s *NotificationPreferencesService) EnableAllAlerts(userID int64) *PreferencesResult {
	return s.UpdatePreferences(userID, &UpdatePreferencesParams{
		NewDeviceAlerts:          boolPtr(true),
		SuspiciousActivityAlerts: boolPtr(true),
		LoginAlerts:              boolPtr(true),
		PasswordChangeAlerts:     boolPtr(true),
		TwoFactorChangeAlerts:    boolPtr(true),
		TransactionAlerts:        boolPtr(true),
	})
}

func (s *NotificationPreferencesService) DisableAllAlerts(userID int64) *PreferencesResult {
	return s.UpdatePreferences(userID, &UpdatePreferencesParams{
		NewDeviceAlerts:          boolPtr(false),
		SuspiciousActivityAlerts: boolPtr(false),
		LoginAlerts:              boolPtr(false),
		PasswordChangeAlerts:     boolPtr(false),
		TwoFactorChangeAlerts:    boolPtr(false),
		TransactionAlerts:        boolPtr(false),
	})
}

func (s *NotificationPreferencesService) SetQuietHours(userID int64, enabled bool, start, end string) *PreferencesResult {
	return s.UpdatePreferences(userID, &UpdatePreferencesParams{
		QuietHoursEnabled: boolPtr(enabled),
		QuietHoursStart:   &start,
		QuietHoursEnd:     &end,
	})
}

func boolPtr(b bool) *bool {
	return &b
}
