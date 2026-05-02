package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)


const (
	NotificationTypePaymentConfirmation NotificationType = "payment_confirmation"
	NotificationTypePaymentFailed       NotificationType = "payment_failed"
	NotificationTypeRefundProcessed     NotificationType = "refund_processed"
	NotificationTypeTransactionUpdate   NotificationType = "transaction_update"
	NotificationTypeSecurityAlert       NotificationType = "security_alert"
	NotificationTypePromotion           NotificationType = "promotion"
	NotificationTypeReminder            NotificationType = "reminder"
	NotificationTypeKYCApproved         NotificationType = "kyc_approved"
	NotificationTypeKYCRejected         NotificationType = "kyc_rejected"
	NotificationTypeRemittanceCompleted NotificationType = "remittance_completed"
	NotificationTypeRemittanceFailed    NotificationType = "remittance_failed"
	NotificationTypeTechnicalOnboarding NotificationType = "technical_onboarding_submission"
)

type DeliveryChannel string

const (
	ChannelSMS    DeliveryChannel = "sms"
	ChannelEmail  DeliveryChannel = "email"
	ChannelPush   DeliveryChannel = "push"
	ChannelInApp  DeliveryChannel = "in_app"
)

type NotificationStatus string

const (
	StatusPending   NotificationStatus = "pending"
	StatusSent      NotificationStatus = "sent"
	StatusDelivered NotificationStatus = "delivered"
	StatusFailed    NotificationStatus = "failed"
	StatusRead      NotificationStatus = "read"
)

type Notification struct {
	ID          string                 `json:"id"`
	UserID      int64                  `json:"userId"`
	Type        NotificationType       `json:"type"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Link        string                 `json:"link,omitempty"`
	Channel     DeliveryChannel        `json:"channel"`
	Status      NotificationStatus     `json:"status"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	IsRead      bool                   `json:"isRead"`
	CreatedAt   time.Time              `json:"createdAt"`
	SentAt      *time.Time             `json:"sentAt,omitempty"`
	DeliveredAt *time.Time             `json:"deliveredAt,omitempty"`
	ReadAt      *time.Time             `json:"readAt,omitempty"`
}


type ChannelPrefs struct {
	EmailEnabled bool `json:"emailEnabled"`
	SMSEnabled   bool `json:"smsEnabled"`
	PushEnabled  bool `json:"pushEnabled"`
	InAppEnabled bool `json:"inAppEnabled"`
}

type QuietHours struct {
	Enabled   bool   `json:"enabled"`
	StartHour int    `json:"startHour"`
	EndHour   int    `json:"endHour"`
}

// SMSProvider represents the SMS provider type
type SMSProvider string

const (
	SMSProviderTwilio   SMSProvider = "twilio"
	SMSProviderNexmo    SMSProvider = "nexmo"
	SMSProviderAfricasTalking SMSProvider = "africastalking"
)

type SMSSender interface {
	SendSMS(to, message string) error
}

type EmailSender interface {
	SendEmail(to, subject, body string) error
}

type PushProvider interface {
	SendPush(deviceToken, title, body string, data map[string]interface{}) error
}

type TwilioSMSProvider struct {
	accountSID string
	authToken  string
	fromNumber string
	httpClient *http.Client
}

func NewTwilioSMSProvider() *TwilioSMSProvider {
	return &TwilioSMSProvider{
		accountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		authToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		fromNumber: os.Getenv("TWILIO_FROM_NUMBER"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *TwilioSMSProvider) SendSMS(to, message string) error {
	url := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", p.accountSID)

	data := fmt.Sprintf("To=%s&From=%s&Body=%s", to, p.fromNumber, message)
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(p.accountSID, p.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("SMS send failed: %s", string(body))
	}

	return nil
}

type AfricasTalkingSMSProvider struct {
	apiKey     string
	username   string
	shortCode  string
	httpClient *http.Client
}

func NewAfricasTalkingSMSProvider() *AfricasTalkingSMSProvider {
	return &AfricasTalkingSMSProvider{
		apiKey:     os.Getenv("AT_API_KEY"),
		username:   os.Getenv("AT_USERNAME"),
		shortCode:  os.Getenv("AT_SHORT_CODE"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *AfricasTalkingSMSProvider) SendSMS(to, message string) error {
	url := "https://api.africastalking.com/version1/messaging"

	data := fmt.Sprintf("username=%s&to=%s&message=%s", p.username, to, message)
	if p.shortCode != "" {
		data += fmt.Sprintf("&from=%s", p.shortCode)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBufferString(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apiKey", p.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("SMS send failed: %s", string(body))
	}

	return nil
}

type SendGridEmailSender struct {
	apiKey     string
	fromEmail  string
	fromName   string
	httpClient *http.Client
}

func NewSendGridEmailSender() *SendGridEmailSender {
	return &SendGridEmailSender{
		apiKey:     os.Getenv("SENDGRID_API_KEY"),
		fromEmail:  os.Getenv("SENDGRID_FROM_EMAIL"),
		fromName:   os.Getenv("SENDGRID_FROM_NAME"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *SendGridEmailSender) SendEmail(to, subject, body string) error {
	url := "https://api.sendgrid.com/v3/mail/send"

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{
				"to": []map[string]string{
					{"email": to},
				},
			},
		},
		"from": map[string]string{
			"email": p.fromEmail,
			"name":  p.fromName,
		},
		"subject": subject,
		"content": []map[string]string{
			{
				"type":  "text/html",
				"value": body,
			},
		},
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email send failed: %s", string(body))
	}

	return nil
}

type FCMPushProvider struct {
	serverKey  string
	httpClient *http.Client
}

func NewFCMPushProvider() *FCMPushProvider {
	return &FCMPushProvider{
		serverKey:  os.Getenv("FCM_SERVER_KEY"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *FCMPushProvider) SendPush(deviceToken, title, body string, data map[string]interface{}) error {
	url := "https://fcm.googleapis.com/fcm/send"

	payload := map[string]interface{}{
		"to": deviceToken,
		"notification": map[string]string{
			"title": title,
			"body":  body,
		},
		"data": data,
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "key="+p.serverKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send push: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("push send failed: %s", string(respBody))
	}

	return nil
}

type NotificationService struct {
	mu            sync.RWMutex
	notifications map[string]*Notification
	preferences   map[int64]*NotificationPreferences
	smsProvider   SMSSender
	emailProvider EmailSender
	pushProvider  PushProvider
	idCounter     int64
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		notifications: make(map[string]*Notification),
		preferences:   make(map[int64]*NotificationPreferences),
		smsProvider:   NewTwilioSMSProvider(),
		emailProvider: NewSendGridEmailSender(),
		pushProvider:  NewFCMPushProvider(),
	}
}

func (s *NotificationService) SetSMSProvider(provider SMSSender) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.smsProvider = provider
}

func (s *NotificationService) SetEmailSender(provider EmailSender) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.emailProvider = provider
}

func (s *NotificationService) SetPushProvider(provider PushProvider) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pushProvider = provider
}

func (s *NotificationService) CreateNotification(userID int64, notifType NotificationType, title, message, link string, metadata map[string]interface{}) (*Notification, error) {
	s.mu.Lock()
	s.idCounter++
	id := fmt.Sprintf("notif_%d_%d", time.Now().UnixMilli(), s.idCounter)
	s.mu.Unlock()

	notification := &Notification{
		ID:        id,
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Message:   message,
		Link:      link,
		Channel:   ChannelInApp,
		Status:    StatusPending,
		Metadata:  metadata,
		IsRead:    false,
		CreatedAt: time.Now(),
	}

	s.mu.Lock()
	s.notifications[id] = notification
	s.mu.Unlock()

	return notification, nil
}

func (s *NotificationService) SendSMS(to, message string) error {
	s.mu.RLock()
	provider := s.smsProvider
	s.mu.RUnlock()

	if provider == nil {
		return fmt.Errorf("SMS provider not configured")
	}

	return provider.SendSMS(to, message)
}

func (s *NotificationService) SendEmail(to, subject, body string) error {
	s.mu.RLock()
	provider := s.emailProvider
	s.mu.RUnlock()

	if provider == nil {
		return fmt.Errorf("email provider not configured")
	}

	return provider.SendEmail(to, subject, body)
}

func (s *NotificationService) SendPush(deviceToken, title, body string, data map[string]interface{}) error {
	s.mu.RLock()
	provider := s.pushProvider
	s.mu.RUnlock()

	if provider == nil {
		return fmt.Errorf("push provider not configured")
	}

	return provider.SendPush(deviceToken, title, body, data)
}

func (s *NotificationService) GetUnreadNotifications(userID int64) []*Notification {
	s.mu.RLock()
	defer s.mu.RUnlock()

	notifications := make([]*Notification, 0)
	for _, n := range s.notifications {
		if n.UserID == userID && !n.IsRead {
			notifications = append(notifications, n)
		}
	}

	return notifications
}

func (s *NotificationService) GetUserNotifications(userID int64, limit, offset int) []*Notification {
	s.mu.RLock()
	defer s.mu.RUnlock()

	allNotifications := make([]*Notification, 0)
	for _, n := range s.notifications {
		if n.UserID == userID {
			allNotifications = append(allNotifications, n)
		}
	}

	if offset >= len(allNotifications) {
		return []*Notification{}
	}

	end := offset + limit
	if end > len(allNotifications) {
		end = len(allNotifications)
	}

	return allNotifications[offset:end]
}

func (s *NotificationService) MarkAsRead(notificationID string, userID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	notification, ok := s.notifications[notificationID]
	if !ok {
		return fmt.Errorf("notification not found")
	}

	if notification.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	notification.IsRead = true
	now := time.Now()
	notification.ReadAt = &now
	notification.Status = StatusRead

	return nil
}

func (s *NotificationService) MarkAllAsRead(userID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for _, n := range s.notifications {
		if n.UserID == userID && !n.IsRead {
			n.IsRead = true
			n.ReadAt = &now
			n.Status = StatusRead
		}
	}

	return nil
}

func (s *NotificationService) GetUnreadCount(userID int64) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, n := range s.notifications {
		if n.UserID == userID && !n.IsRead {
			count++
		}
	}

	return count
}

func (s *NotificationService) SetUserPreferences(userID int64, prefs *NotificationPreferences) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	prefs.UserID = userID
	prefs.UpdatedAt = time.Now()
	s.preferences[userID] = prefs

	return nil
}

func (s *NotificationService) GetUserPreferences(userID int64) *NotificationPreferences {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prefs, ok := s.preferences[userID]
	if !ok {
		now := time.Now()
		return &NotificationPreferences{
			UserID:               userID,
			EmailNotifications:   true,
			SMSNotifications:     false,
			TransactionAlerts:    true,
			QuietHoursEnabled:    false,
			CreatedAt:            now,
			UpdatedAt:            now,
		}
	}

	return prefs
}

func (s *NotificationService) ShouldSendNotification(userID int64, notifType NotificationType, channel DeliveryChannel) bool {
	prefs := s.GetUserPreferences(userID)

	// Check quiet hours
	if prefs.QuietHoursEnabled && prefs.QuietHoursStart != "" && prefs.QuietHoursEnd != "" {
		now := time.Now()
		currentTime := now.Format("15:04")
		if prefs.QuietHoursStart <= prefs.QuietHoursEnd {
			if currentTime >= prefs.QuietHoursStart && currentTime <= prefs.QuietHoursEnd {
				return false
			}
		} else {
			if currentTime >= prefs.QuietHoursStart || currentTime <= prefs.QuietHoursEnd {
				return false
			}
		}
	}

	// Check channel preferences
	switch channel {
	case ChannelEmail:
		return prefs.EmailNotifications
	case ChannelSMS:
		return prefs.SMSNotifications
	case ChannelPush:
		return true // Default to true for push
	case ChannelInApp:
		return true // Always allow in-app notifications
	default:
		return true
	}
}

func (s *NotificationService) SendPaymentConfirmation(userID int64, phone, email string, amount float64, currency, reference string) error {
	message := fmt.Sprintf("Payment of %s %.2f confirmed. Reference: %s", currency, amount, reference)

	if s.ShouldSendNotification(userID, NotificationTypePaymentConfirmation, ChannelSMS) && phone != "" {
		if err := s.SendSMS(phone, message); err != nil {
			return err
		}
	}

	if s.ShouldSendNotification(userID, NotificationTypePaymentConfirmation, ChannelEmail) && email != "" {
		subject := "Payment Confirmation"
		body := fmt.Sprintf("<h1>Payment Confirmed</h1><p>%s</p>", message)
		if err := s.SendEmail(email, subject, body); err != nil {
			return err
		}
	}

	_, err := s.CreateNotification(userID, NotificationTypePaymentConfirmation, "Payment Confirmed", message, "", map[string]interface{}{
		"amount":    amount,
		"currency":  currency,
		"reference": reference,
	})

	return err
}

func (s *NotificationService) SendRemittanceCompleted(userID int64, phone, email string, amount float64, currency, reference string) error {
	message := fmt.Sprintf("Your remittance of %s %.2f has been completed. Reference: %s", currency, amount, reference)

	if s.ShouldSendNotification(userID, NotificationTypeRemittanceCompleted, ChannelSMS) && phone != "" {
		if err := s.SendSMS(phone, message); err != nil {
			return err
		}
	}

	if s.ShouldSendNotification(userID, NotificationTypeRemittanceCompleted, ChannelEmail) && email != "" {
		subject := "Remittance Completed"
		body := fmt.Sprintf("<h1>Remittance Completed</h1><p>%s</p>", message)
		if err := s.SendEmail(email, subject, body); err != nil {
			return err
		}
	}

	_, err := s.CreateNotification(userID, NotificationTypeRemittanceCompleted, "Remittance Completed", message, "", map[string]interface{}{
		"amount":    amount,
		"currency":  currency,
		"reference": reference,
	})

	return err
}

func (s *NotificationService) SendSecurityAlert(userID int64, phone, email, alertType, description string) error {
	message := fmt.Sprintf("Security Alert: %s - %s", alertType, description)

	if phone != "" {
		if err := s.SendSMS(phone, message); err != nil {
			return err
		}
	}

	if email != "" {
		subject := "Security Alert"
		body := fmt.Sprintf("<h1>Security Alert</h1><p><strong>%s</strong></p><p>%s</p>", alertType, description)
		if err := s.SendEmail(email, subject, body); err != nil {
			return err
		}
	}

	_, err := s.CreateNotification(userID, NotificationTypeSecurityAlert, "Security Alert", message, "", map[string]interface{}{
		"alertType":   alertType,
		"description": description,
	})

	return err
}

func (s *NotificationService) NotifyAdminsOfNewSubmission(applicationID int64, organizationName string, adminUserIDs []int64) error {
	title := "New Technical Onboarding Submission"
	message := fmt.Sprintf("%s has submitted their technical onboarding for review.", organizationName)
	link := "/admin/technical-onboarding"

	for _, adminID := range adminUserIDs {
		if s.ShouldSendNotification(adminID, NotificationTypeTechnicalOnboarding, ChannelInApp) {
			_, err := s.CreateNotification(adminID, NotificationTypeTechnicalOnboarding, title, message, link, map[string]interface{}{
				"applicationId":    applicationID,
				"organizationName": organizationName,
			})
			if err != nil {
				return err
			}
		}
	}

	return nil
}
