package notifications

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
	"sync"
	"time"
)

type DeviceInfo struct {
	UserAgent  string `json:"userAgent"`
	IPAddress  string `json:"ipAddress"`
	DeviceName string `json:"deviceName,omitempty"`
	Browser    string `json:"browser,omitempty"`
	OS         string `json:"os,omitempty"`
	Location   string `json:"location,omitempty"`
}

type LoginNotificationParams struct {
	UserID       int64      `json:"userId"`
	DeviceInfo   DeviceInfo `json:"deviceInfo"`
	IsNewDevice  bool       `json:"isNewDevice"`
	IsSuspicious bool       `json:"isSuspicious"`
}

type LoginNotificationResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type UserInfo struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Phone string `json:"phone,omitempty"`
}

type LoginNotificationService struct {
	mu                 sync.RWMutex
	emailService       *EmailService
	smsService         *SMSService
	preferencesService *NotificationPreferencesService
	frontendURL        string
}

func NewLoginNotificationService(emailService *EmailService, smsService *SMSService, prefsService *NotificationPreferencesService) *LoginNotificationService {
	return &LoginNotificationService{
		emailService:       emailService,
		smsService:         smsService,
		preferencesService: prefsService,
		frontendURL:        "https://app.example.com",
	}
}

func (s *LoginNotificationService) SetFrontendURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.frontendURL = url
}

func (s *LoginNotificationService) SendLoginNotification(params LoginNotificationParams, user *UserInfo) *LoginNotificationResult {
	if user == nil {
		return &LoginNotificationResult{
			Success: false,
			Error:   "User not found",
		}
	}

	prefs := s.preferencesService.GetPreferences(params.UserID)

	wantsNewDeviceAlerts := params.IsNewDevice && prefs.NewDeviceAlerts
	wantsSuspiciousAlerts := params.IsSuspicious && prefs.SuspiciousActivityAlerts
	wantsLoginAlerts := prefs.LoginAlerts

	if !wantsNewDeviceAlerts && !wantsSuspiciousAlerts && !wantsLoginAlerts {
		return &LoginNotificationResult{Success: true}
	}

	if !prefs.EmailNotifications {
		return &LoginNotificationResult{Success: true}
	}

	if user.Email != "" {
		result := s.sendLoginNotificationEmail(user.Email, user.Name, params.DeviceInfo, params.IsNewDevice, params.IsSuspicious, time.Now())
		if !result.Success {
			return &LoginNotificationResult{
				Success: false,
				Error:   result.Error,
			}
		}
	}

	if prefs.SMSNotifications && user.Phone != "" && params.IsSuspicious {
		s.sendLoginNotificationSMS(user.Phone, params.DeviceInfo, params.IsSuspicious, time.Now())
	}

	return &LoginNotificationResult{Success: true}
}

func (s *LoginNotificationService) sendLoginNotificationEmail(to, userName string, deviceInfo DeviceInfo, isNewDevice, isSuspicious bool, timestamp time.Time) *EmailResult {
	subject := "New Device Login Alert"
	if isSuspicious {
		subject = "Suspicious Login Detected"
	}

	html := s.generateLoginEmailHTML(userName, deviceInfo, isNewDevice, isSuspicious, timestamp)
	text := s.generateLoginEmailText(userName, deviceInfo, isNewDevice, isSuspicious, timestamp)

	return s.emailService.SendEmail(&EmailMessage{
		To:      to,
		Subject: subject,
		HTML:    html,
		Text:    text,
	})
}

func (s *LoginNotificationService) generateLoginEmailHTML(userName string, deviceInfo DeviceInfo, isNewDevice, isSuspicious bool, timestamp time.Time) string {
	tmpl := `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{if .IsSuspicious}}Suspicious Login Detected{{else}}New Device Login Alert{{end}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="background-color: #f5f5f5; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="background: {{if .IsSuspicious}}linear-gradient(135deg, #ef4444 0%, #dc2626 100%){{else}}linear-gradient(135deg, #3b82f6 0%, #2563eb 100%){{end}}; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
          {{if .IsSuspicious}}Suspicious Login Detected{{else}}New Device Login{{end}}
        </h1>
      </div>

      <div style="padding: 32px 24px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          Hi {{.UserName}},
        </p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          {{if .IsSuspicious}}We detected a login to your account that looks suspicious. If this wasn't you, please secure your account immediately.{{else}}We detected a login to your account from a new device. If this was you, you can ignore this message.{{end}}
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
            Login Details
          </h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">
                {{.Timestamp}}
              </td>
            </tr>
            {{if .Browser}}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Browser:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">
                {{.Browser}}
              </td>
            </tr>
            {{end}}
            {{if .OS}}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Operating System:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">
                {{.OS}}
              </td>
            </tr>
            {{end}}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">IP Address:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">
                {{.IPAddress}}
              </td>
            </tr>
            {{if .Location}}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">
                {{.Location}}
              </td>
            </tr>
            {{end}}
          </table>
        </div>

        {{if .IsSuspicious}}
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">
            If you don't recognize this activity, please:
          </p>
          <ul style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 12px 0 0 0; padding-left: 20px;">
            <li>Change your password immediately</li>
            <li>Review your account activity</li>
            <li>Enable two-factor authentication if not already enabled</li>
            <li>Contact support if you need assistance</li>
          </ul>
        </div>
        {{else}}
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0;">
            This is a security notification to keep you informed about account activity. If this was you, no action is needed.
          </p>
        </div>
        {{end}}

        <div style="text-align: center; margin-top: 32px;">
          {{if .IsSuspicious}}
          <a href="{{.FrontendURL}}/settings/security" 
             style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Secure My Account
          </a>
          {{else}}
          <a href="{{.FrontendURL}}/settings/trusted-devices" 
             style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Manage Devices
          </a>
          {{end}}
        </div>
      </div>

      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
          This is an automated security notification. Please do not reply to this email.
        </p>
        <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
          Payment Switch Platform. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`

	t, _ := template.New("login").Parse(tmpl)
	var buf bytes.Buffer

	s.mu.RLock()
	frontendURL := s.frontendURL
	s.mu.RUnlock()

	t.Execute(&buf, map[string]interface{}{
		"UserName":     userName,
		"IsSuspicious": isSuspicious,
		"IsNewDevice":  isNewDevice,
		"Timestamp":    timestamp.Format("Jan 2, 2006 3:04 PM"),
		"Browser":      deviceInfo.Browser,
		"OS":           deviceInfo.OS,
		"IPAddress":    deviceInfo.IPAddress,
		"Location":     deviceInfo.Location,
		"FrontendURL":  frontendURL,
	})

	return buf.String()
}

func (s *LoginNotificationService) generateLoginEmailText(userName string, deviceInfo DeviceInfo, isNewDevice, isSuspicious bool, timestamp time.Time) string {
	var sb strings.Builder

	if isSuspicious {
		sb.WriteString("Suspicious Login Detected\n\n")
	} else {
		sb.WriteString("New Device Login Alert\n\n")
	}

	sb.WriteString(fmt.Sprintf("Hi %s,\n\n", userName))

	if isSuspicious {
		sb.WriteString("We detected a login to your account that looks suspicious. If this wasn't you, please secure your account immediately.\n\n")
	} else {
		sb.WriteString("We detected a login to your account from a new device. If this was you, you can ignore this message.\n\n")
	}

	sb.WriteString("Login Details:\n")
	sb.WriteString(fmt.Sprintf("- Time: %s\n", timestamp.Format("Jan 2, 2006 3:04 PM")))
	if deviceInfo.Browser != "" {
		sb.WriteString(fmt.Sprintf("- Browser: %s\n", deviceInfo.Browser))
	}
	if deviceInfo.OS != "" {
		sb.WriteString(fmt.Sprintf("- Operating System: %s\n", deviceInfo.OS))
	}
	sb.WriteString(fmt.Sprintf("- IP Address: %s\n", deviceInfo.IPAddress))
	if deviceInfo.Location != "" {
		sb.WriteString(fmt.Sprintf("- Location: %s\n", deviceInfo.Location))
	}

	sb.WriteString("\n")

	if isSuspicious {
		sb.WriteString("If you don't recognize this activity, please:\n")
		sb.WriteString("- Change your password immediately\n")
		sb.WriteString("- Review your account activity\n")
		sb.WriteString("- Enable two-factor authentication if not already enabled\n")
		sb.WriteString("- Contact support if you need assistance\n")
	} else {
		sb.WriteString("This is a security notification to keep you informed about account activity. If this was you, no action is needed.\n")
	}

	sb.WriteString("\n---\nThis is an automated security notification.\nPayment Switch Platform\n")

	return sb.String()
}

func (s *LoginNotificationService) sendLoginNotificationSMS(to string, deviceInfo DeviceInfo, isSuspicious bool, timestamp time.Time) *SMSResult {
	var message string
	if isSuspicious {
		message = fmt.Sprintf("SECURITY ALERT: Suspicious login detected on your account from %s at %s. If this wasn't you, secure your account immediately.",
			deviceInfo.IPAddress, timestamp.Format("Jan 2, 3:04 PM"))
	} else {
		message = fmt.Sprintf("New login detected on your account from %s at %s. If this wasn't you, please secure your account.",
			deviceInfo.IPAddress, timestamp.Format("Jan 2, 3:04 PM"))
	}

	return s.smsService.SendSMS(to, message)
}

func ParseUserAgent(userAgent string) *DeviceInfo {
	info := &DeviceInfo{
		UserAgent: userAgent,
	}

	ua := strings.ToLower(userAgent)

	switch {
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg"):
		info.Browser = "Chrome"
	case strings.Contains(ua, "firefox"):
		info.Browser = "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		info.Browser = "Safari"
	case strings.Contains(ua, "edg"):
		info.Browser = "Edge"
	case strings.Contains(ua, "opera") || strings.Contains(ua, "opr"):
		info.Browser = "Opera"
	}

	switch {
	case strings.Contains(ua, "windows"):
		info.OS = "Windows"
	case strings.Contains(ua, "mac os x"):
		info.OS = "macOS"
	case strings.Contains(ua, "linux") && !strings.Contains(ua, "android"):
		info.OS = "Linux"
	case strings.Contains(ua, "android"):
		info.OS = "Android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad") || strings.Contains(ua, "ios"):
		info.OS = "iOS"
	}

	if info.Browser != "" && info.OS != "" {
		info.DeviceName = fmt.Sprintf("%s on %s", info.Browser, info.OS)
	} else {
		info.DeviceName = "Unknown Device"
	}

	return info
}

func IsSuspiciousLogin(userAgent, ipAddress, lastLoginIP, lastLoginUserAgent string, failedAttempts int) bool {
	if lastLoginUserAgent != "" && userAgent != lastLoginUserAgent {
		lastDevice := ParseUserAgent(lastLoginUserAgent)
		currentDevice := ParseUserAgent(userAgent)

		if lastDevice.OS != "" && currentDevice.OS != "" && lastDevice.OS != currentDevice.OS {
			return true
		}
	}

	if lastLoginIP != "" && ipAddress != lastLoginIP {
		lastIPParts := strings.Split(lastLoginIP, ".")
		currentIPParts := strings.Split(ipAddress, ".")

		if len(lastIPParts) >= 2 && len(currentIPParts) >= 2 {
			lastPrefix := lastIPParts[0] + "." + lastIPParts[1]
			currentPrefix := currentIPParts[0] + "." + currentIPParts[1]

			if lastPrefix != currentPrefix {
				return true
			}
		}
	}

	if failedAttempts >= 3 {
		return true
	}

	return false
}
