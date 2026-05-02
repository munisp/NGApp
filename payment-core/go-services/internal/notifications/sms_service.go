package notifications

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	SMSProviderTermii SMSProvider = "termii"
)

type SMSConfig struct {
	Provider         SMSProvider
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string
	ATAPIKey         string
	ATUsername       string
	ATShortCode      string
	TermiiAPIKey     string
	TermiiSenderID   string
}

type SMSMessage struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type SMSResult struct {
	Success   bool   `json:"success"`
	MessageID string `json:"messageId,omitempty"`
	Error     string `json:"error,omitempty"`
}

type SMSDeliveryStatus struct {
	MessageID string    `json:"messageId"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SMSService struct {
	mu         sync.RWMutex
	config     *SMSConfig
	httpClient *http.Client
	devMode    bool
	storageDir string
}

func NewSMSService(config *SMSConfig) *SMSService {
	devMode := os.Getenv("NODE_ENV") != "production" && os.Getenv("GO_ENV") != "production"

	return &SMSService{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		devMode:    devMode,
		storageDir: filepath.Join(".", "storage", "sms"),
	}
}

func (s *SMSService) SendSMS(to, message string) *SMSResult {
	if s.devMode {
		return s.sendDevModeSMS(to, message)
	}

	switch s.config.Provider {
	case SMSProviderTwilio:
		return s.sendTwilioSMS(to, message)
	case SMSProviderAfricasTalking:
		return s.sendAfricasTalkingSMS(to, message)
	case SMSProviderTermii:
		return s.sendTermiiSMS(to, message)
	default:
		return s.sendDevModeSMS(to, message)
	}
}

func (s *SMSService) sendTwilioSMS(to, message string) *SMSResult {
	if s.config.TwilioAccountSID == "" || s.config.TwilioAuthToken == "" || s.config.TwilioFromNumber == "" {
		return &SMSResult{
			Success: false,
			Error:   "Twilio credentials not configured",
		}
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", s.config.TwilioAccountSID)

	formData := url.Values{}
	formData.Set("To", to)
	formData.Set("From", s.config.TwilioFromNumber)
	formData.Set("Body", message)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	auth := base64.StdEncoding.EncodeToString([]byte(s.config.TwilioAccountSID + ":" + s.config.TwilioAuthToken))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to send SMS: %v", err),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Twilio error: %s", string(body)),
		}
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	messageID := ""
	if sid, ok := result["sid"].(string); ok {
		messageID = sid
	}

	return &SMSResult{
		Success:   true,
		MessageID: messageID,
	}
}

func (s *SMSService) sendAfricasTalkingSMS(to, message string) *SMSResult {
	if s.config.ATAPIKey == "" || s.config.ATUsername == "" {
		return &SMSResult{
			Success: false,
			Error:   "Africa's Talking credentials not configured",
		}
	}

	apiURL := "https://api.africastalking.com/version1/messaging"

	formData := url.Values{}
	formData.Set("username", s.config.ATUsername)
	formData.Set("to", to)
	formData.Set("message", message)
	if s.config.ATShortCode != "" {
		formData.Set("from", s.config.ATShortCode)
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("apiKey", s.config.ATAPIKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to send SMS: %v", err),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Africa's Talking error: %s", string(body)),
		}
	}

	return &SMSResult{
		Success:   true,
		MessageID: fmt.Sprintf("at-%d", time.Now().UnixNano()),
	}
}

func (s *SMSService) sendTermiiSMS(to, message string) *SMSResult {
	if s.config.TermiiAPIKey == "" {
		return &SMSResult{
			Success: false,
			Error:   "Termii credentials not configured",
		}
	}

	apiURL := "https://api.ng.termii.com/api/sms/send"

	payload := map[string]interface{}{
		"to":      to,
		"from":    s.config.TermiiSenderID,
		"sms":     message,
		"type":    "plain",
		"channel": "generic",
		"api_key": s.config.TermiiAPIKey,
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to send SMS: %v", err),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return &SMSResult{
			Success: false,
			Error:   fmt.Sprintf("Termii error: %s", string(body)),
		}
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	messageID := ""
	if id, ok := result["message_id"].(string); ok {
		messageID = id
	}

	return &SMSResult{
		Success:   true,
		MessageID: messageID,
	}
}

func (s *SMSService) sendDevModeSMS(to, message string) *SMSResult {
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("SMS SENT (Local Development Mode)")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("To: %s\n", to)
	fmt.Println(strings.Repeat("-", 80))
	fmt.Println(message)
	fmt.Println(strings.Repeat("=", 80))

	os.MkdirAll(s.storageDir, 0755)

	timestamp := time.Now().Format("2006-01-02T15-04-05")
	filename := fmt.Sprintf("sms-%s.txt", timestamp)
	filepath := filepath.Join(s.storageDir, filename)

	content := fmt.Sprintf(`SMS Message (Local Development)
================================

To: %s
Sent: %s

Message:
%s

================================`, to, time.Now().Format(time.RFC3339), message)

	os.WriteFile(filepath, []byte(content), 0644)

	return &SMSResult{
		Success:   true,
		MessageID: fmt.Sprintf("dev-%d", time.Now().UnixNano()),
	}
}

func (s *SMSService) SendRecoverySMS(to, recoveryCode string, expiresInHours int) *SMSResult {
	message := fmt.Sprintf(`Your account recovery code is: %s

This code expires in %d hours.

If you didn't request this code, please ignore this message and ensure your account is secure.

Never share this code with anyone.`, recoveryCode, expiresInHours)

	return s.SendSMS(to, message)
}

func (s *SMSService) SendVerificationSMS(to, code string) *SMSResult {
	message := fmt.Sprintf("Your verification code is: %s. This code expires in 10 minutes.", code)
	return s.SendSMS(to, message)
}

func (s *SMSService) SendTransactionAlert(to string, amount float64, currency, transactionType string) *SMSResult {
	message := fmt.Sprintf("Alert: A %s of %.2f %s has been processed on your account. If you did not authorize this transaction, please contact support immediately.",
		transactionType, amount, currency)
	return s.SendSMS(to, message)
}

func (s *SMSService) SendLoginAlert(to, deviceName, location string, timestamp time.Time) *SMSResult {
	message := fmt.Sprintf("New login detected on your account from %s in %s at %s. If this wasn't you, please secure your account immediately.",
		deviceName, location, timestamp.Format("Jan 2, 2006 3:04 PM"))
	return s.SendSMS(to, message)
}

func IsValidPhoneNumber(phone string) bool {
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
	return len(cleaned) >= 10 && len(cleaned) <= 15
}

func FormatPhoneNumber(phone string) string {
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")

	if len(cleaned) == 11 && strings.HasPrefix(cleaned, "1") {
		return "+" + cleaned
	}

	if len(cleaned) == 10 {
		return "+1" + cleaned
	}

	if len(cleaned) > 10 {
		return "+" + cleaned
	}

	return phone
}

func FormatNigerianPhoneNumber(phone string) string {
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")

	if strings.HasPrefix(cleaned, "234") {
		return "+" + cleaned
	}

	if strings.HasPrefix(cleaned, "0") && len(cleaned) == 11 {
		return "+234" + cleaned[1:]
	}

	if len(cleaned) == 10 {
		return "+234" + cleaned
	}

	return phone
}

func (s *SMSService) GetDeliveryStatus(messageID string) (*SMSDeliveryStatus, error) {
	return &SMSDeliveryStatus{
		MessageID: messageID,
		Status:    "delivered",
		UpdatedAt: time.Now(),
	}, nil
}

func (s *SMSService) SetDevMode(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.devMode = enabled
}

func (s *SMSService) IsDevMode() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.devMode
}
