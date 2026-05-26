package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type EmailProvider string

const (
	EmailProviderResend   EmailProvider = "resend"
	EmailProviderSendGrid EmailProvider = "sendgrid"
	EmailProviderSES      EmailProvider = "ses"
)

type EmailConfig struct {
	Provider       EmailProvider
	ResendAPIKey   string
	SendGridAPIKey string
	SESRegion      string
	SESAccessKey   string
	SESSecretKey   string
	FromEmail      string
	FromName       string
}

type EmailMessage struct {
	To          string            `json:"to"`
	Subject     string            `json:"subject"`
	HTML        string            `json:"html"`
	Text        string            `json:"text,omitempty"`
	ReplyTo     string            `json:"replyTo,omitempty"`
	Attachments []EmailAttachment `json:"attachments,omitempty"`
}

type EmailAttachment struct {
	Filename    string `json:"filename"`
	Content     string `json:"content"`
	ContentType string `json:"contentType"`
}

type EmailResult struct {
	Success   bool   `json:"success"`
	MessageID string `json:"messageId,omitempty"`
	Error     string `json:"error,omitempty"`
}

type EmailService struct {
	mu         sync.RWMutex
	config     *EmailConfig
	httpClient *http.Client
	devMode    bool
	storageDir string
}

func NewEmailService(config *EmailConfig) *EmailService {
	devMode := os.Getenv("NODE_ENV") != "production" && os.Getenv("GO_ENV") != "production"

	return &EmailService{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		devMode:    devMode,
		storageDir: filepath.Join(".", "storage", "emails"),
	}
}

func (s *EmailService) SendEmail(msg *EmailMessage) *EmailResult {
	if s.devMode {
		return s.sendDevModeEmail(msg)
	}

	switch s.config.Provider {
	case EmailProviderResend:
		return s.sendResendEmail(msg)
	case EmailProviderSendGrid:
		return s.sendSendGridEmail(msg)
	default:
		return s.sendDevModeEmail(msg)
	}
}

func (s *EmailService) sendResendEmail(msg *EmailMessage) *EmailResult {
	if s.config.ResendAPIKey == "" {
		return &EmailResult{
			Success: false,
			Error:   "Resend API key not configured",
		}
	}

	payload := map[string]interface{}{
		"from":    fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail),
		"to":      msg.To,
		"subject": msg.Subject,
		"html":    msg.HTML,
	}

	if msg.Text != "" {
		payload["text"] = msg.Text
	}

	if msg.ReplyTo != "" {
		payload["reply_to"] = msg.ReplyTo
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	if err != nil {
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("Authorization", "Bearer "+s.config.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to send email: %v", err),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("Resend error: %s", string(body)),
		}
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	messageID := ""
	if id, ok := result["id"].(string); ok {
		messageID = id
	}

	return &EmailResult{
		Success:   true,
		MessageID: messageID,
	}
}

func (s *EmailService) sendSendGridEmail(msg *EmailMessage) *EmailResult {
	if s.config.SendGridAPIKey == "" {
		return &EmailResult{
			Success: false,
			Error:   "SendGrid API key not configured",
		}
	}

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{
				"to": []map[string]string{
					{"email": msg.To},
				},
			},
		},
		"from": map[string]string{
			"email": s.config.FromEmail,
			"name":  s.config.FromName,
		},
		"subject": msg.Subject,
		"content": []map[string]string{
			{
				"type":  "text/html",
				"value": msg.HTML,
			},
		},
	}

	if msg.Text != "" {
		content := payload["content"].([]map[string]string)
		payload["content"] = append([]map[string]string{
			{
				"type":  "text/plain",
				"value": msg.Text,
			},
		}, content...)
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", "https://api.sendgrid.com/v3/mail/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("Authorization", "Bearer "+s.config.SendGridAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to send email: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return &EmailResult{
			Success: false,
			Error:   fmt.Sprintf("SendGrid error: %s", string(body)),
		}
	}

	messageID := resp.Header.Get("X-Message-Id")

	return &EmailResult{
		Success:   true,
		MessageID: messageID,
	}
}

func (s *EmailService) sendDevModeEmail(msg *EmailMessage) *EmailResult {
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("EMAIL SENT (Local Development Mode)")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("To: %s\n", msg.To)
	fmt.Printf("Subject: %s\n", msg.Subject)
	fmt.Println(strings.Repeat("-", 80))
	if msg.Text != "" {
		fmt.Println(msg.Text)
	} else {
		fmt.Println("No plain text version")
	}
	fmt.Println(strings.Repeat("=", 80))

	os.MkdirAll(s.storageDir, 0755)

	timestamp := time.Now().Format("2006-01-02T15-04-05")
	filename := fmt.Sprintf("email-%s.html", timestamp)
	filepath := filepath.Join(s.storageDir, filename)

	content := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>%s</title>
</head>
<body>
  <div style="font-family: monospace; padding: 20px; background: #f5f5f5;">
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
      <h2>Email Preview (Local Development)</h2>
      <p><strong>To:</strong> %s</p>
      <p><strong>Subject:</strong> %s</p>
      <hr>
      %s
    </div>
  </div>
</body>
</html>`, msg.Subject, msg.To, msg.Subject, msg.HTML)

	os.WriteFile(filepath, []byte(content), 0644)

	return &EmailResult{
		Success:   true,
		MessageID: fmt.Sprintf("dev-%d", time.Now().UnixNano()),
	}
}

func (s *EmailService) SendRecoveryCodeEmail(to, recoveryCode string, expiresInHours int) *EmailResult {
	html := s.generateRecoveryCodeHTML(recoveryCode, expiresInHours)
	text := s.generateRecoveryCodeText(recoveryCode, expiresInHours)

	return s.SendEmail(&EmailMessage{
		To:      to,
		Subject: "Your Account Recovery Code",
		HTML:    html,
		Text:    text,
	})
}

func (s *EmailService) generateRecoveryCodeHTML(recoveryCode string, expiresInHours int) string {
	tmpl := `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Recovery Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9fafb;
      border-radius: 8px;
      padding: 32px;
      margin: 20px 0;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      color: #1f2937;
      font-size: 24px;
      margin: 0 0 8px 0;
    }
    .code-box {
      background-color: #fff;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 4px;
      color: #2563eb;
      font-family: 'Courier New', monospace;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .warning-title {
      font-weight: bold;
      color: #92400e;
      margin: 0 0 8px 0;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Account Recovery</h1>
      <p>You requested to recover access to your account</p>
    </div>

    <p>Hello,</p>
    
    <p>We received a request to recover your account. Use the code below to complete the recovery process:</p>

    <div class="code-box">
      <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">Your Recovery Code</div>
      <div class="code">{{.RecoveryCode}}</div>
    </div>

    <p style="text-align: center;">
      <strong>This code expires in {{.ExpiresInHours}} hours.</strong>
    </p>

    <div class="warning">
      <div class="warning-title">Security Notice</div>
      <p style="margin: 0; color: #92400e;">
        If you didn't request this recovery code, please ignore this email and ensure your account is secure.
        Never share this code with anyone.
      </p>
    </div>

    <p>To complete the recovery process:</p>
    <ol>
      <li>Return to the recovery page</li>
      <li>Enter the code above</li>
      <li>Follow the instructions to reset your 2FA</li>
    </ol>

    <div class="footer">
      <p>This is an automated message, please do not reply to this email.</p>
      <p>If you need assistance, please contact our support team.</p>
    </div>
  </div>
</body>
</html>`

	t, _ := template.New("recovery").Parse(tmpl)
	var buf bytes.Buffer
	t.Execute(&buf, map[string]interface{}{
		"RecoveryCode":   recoveryCode,
		"ExpiresInHours": expiresInHours,
	})

	return buf.String()
}

func (s *EmailService) generateRecoveryCodeText(recoveryCode string, expiresInHours int) string {
	return fmt.Sprintf(`Account Recovery Code

You requested to recover access to your account.

Your Recovery Code: %s

This code expires in %d hours.

To complete the recovery process:
1. Return to the recovery page
2. Enter the code above
3. Follow the instructions to reset your 2FA

SECURITY NOTICE:
If you didn't request this recovery code, please ignore this email and ensure your account is secure.
Never share this code with anyone.

---
This is an automated message, please do not reply to this email.
If you need assistance, please contact our support team.`, recoveryCode, expiresInHours)
}

func (s *EmailService) SendWelcomeEmail(to, userName string) *EmailResult {
	html := fmt.Sprintf(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1>Welcome to Our Platform!</h1>
<p>Hello %s,</p>
<p>Thank you for joining us. We're excited to have you on board.</p>
<p>Get started by exploring our features and setting up your account.</p>
<p>Best regards,<br>The Team</p>
</div>`, userName)

	return s.SendEmail(&EmailMessage{
		To:      to,
		Subject: "Welcome to Our Platform!",
		HTML:    html,
		Text:    fmt.Sprintf("Welcome %s! Thank you for joining us.", userName),
	})
}

func (s *EmailService) SendTransactionReceipt(to string, amount float64, currency, transactionID, transactionType string, timestamp time.Time) *EmailResult {
	html := fmt.Sprintf(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1>Transaction Receipt</h1>
<p>Your %s has been processed successfully.</p>
<table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
<tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Transaction ID:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">%s</td></tr>
<tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">%.2f %s</td></tr>
<tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Type:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">%s</td></tr>
<tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">%s</td></tr>
</table>
<p>If you have any questions, please contact our support team.</p>
</div>`, transactionType, transactionID, amount, currency, transactionType, timestamp.Format("January 2, 2006 3:04 PM"))

	return s.SendEmail(&EmailMessage{
		To:      to,
		Subject: fmt.Sprintf("Transaction Receipt - %s", transactionID),
		HTML:    html,
	})
}

func (s *EmailService) SendSecurityAlert(to, alertType, description string, timestamp time.Time) *EmailResult {
	html := fmt.Sprintf(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #dc2626;">Security Alert</h1>
<p>We detected unusual activity on your account:</p>
<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
<p><strong>Alert Type:</strong> %s</p>
<p><strong>Description:</strong> %s</p>
<p><strong>Time:</strong> %s</p>
</div>
<p>If this was you, you can ignore this message. If not, please secure your account immediately by:</p>
<ol>
<li>Changing your password</li>
<li>Reviewing recent activity</li>
<li>Enabling two-factor authentication</li>
</ol>
<p>Contact support if you need assistance.</p>
</div>`, alertType, description, timestamp.Format("January 2, 2006 3:04 PM"))

	return s.SendEmail(&EmailMessage{
		To:      to,
		Subject: "Security Alert - Action Required",
		HTML:    html,
	})
}

func (s *EmailService) SetDevMode(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.devMode = enabled
}

func (s *EmailService) IsDevMode() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.devMode
}
