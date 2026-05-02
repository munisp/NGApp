// Package onboarding provides notification services for onboarding workflows
package onboarding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// EmailNotification represents an email notification
type EmailNotification struct {
	ID          string                 `json:"id"`
	To          string                 `json:"to"`
	CC          []string               `json:"cc,omitempty"`
	BCC         []string               `json:"bcc,omitempty"`
	Subject     string                 `json:"subject"`
	Body        string                 `json:"body"`
	HTMLBody    string                 `json:"html_body,omitempty"`
	TemplateID  string                 `json:"template_id,omitempty"`
	TemplateData map[string]interface{} `json:"template_data,omitempty"`
	Status      string                 `json:"status"` // PENDING, SENT, FAILED, BOUNCED
	SentAt      *time.Time             `json:"sent_at,omitempty"`
	Error       string                 `json:"error,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	CaseID      string                 `json:"case_id,omitempty"`
	EventType   string                 `json:"event_type,omitempty"`
}

// SMSNotification represents an SMS notification
type SMSNotification struct {
	ID        string     `json:"id"`
	To        string     `json:"to"`
	Message   string     `json:"message"`
	Status    string     `json:"status"` // PENDING, SENT, DELIVERED, FAILED
	SentAt    *time.Time `json:"sent_at,omitempty"`
	Error     string     `json:"error,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	CaseID    string     `json:"case_id,omitempty"`
	EventType string     `json:"event_type,omitempty"`
}

// PushNotification represents a push notification
type PushNotification struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Status    string                 `json:"status"` // PENDING, SENT, DELIVERED, FAILED
	SentAt    *time.Time             `json:"sent_at,omitempty"`
	Error     string                 `json:"error,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	CaseID    string                 `json:"case_id,omitempty"`
	EventType string                 `json:"event_type,omitempty"`
}

// NotificationPreferences represents user notification preferences
type NotificationPreferences struct {
	UserID              string   `json:"user_id"`
	Email               string   `json:"email"`
	Phone               string   `json:"phone,omitempty"`
	EmailEnabled        bool     `json:"email_enabled"`
	SMSEnabled          bool     `json:"sms_enabled"`
	PushEnabled         bool     `json:"push_enabled"`
	EnabledEventTypes   []string `json:"enabled_event_types"`
	DisabledEventTypes  []string `json:"disabled_event_types"`
	DigestFrequency     string   `json:"digest_frequency"` // IMMEDIATE, DAILY, WEEKLY
	QuietHoursStart     string   `json:"quiet_hours_start,omitempty"`
	QuietHoursEnd       string   `json:"quiet_hours_end,omitempty"`
	Language            string   `json:"language"`
	Timezone            string   `json:"timezone"`
}

// NotificationTemplate represents an email/SMS template
type NotificationTemplate struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"` // EMAIL, SMS
	Subject     string            `json:"subject,omitempty"`
	Body        string            `json:"body"`
	HTMLBody    string            `json:"html_body,omitempty"`
	Variables   []string          `json:"variables"`
	Language    string            `json:"language"`
	EventType   string            `json:"event_type"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// OnboardingNotificationService handles all onboarding notifications
type OnboardingNotificationService struct {
	emailQueue      []*EmailNotification
	emailQueueMu    sync.Mutex
	smsQueue        []*SMSNotification
	smsQueueMu      sync.Mutex
	pushQueue       []*PushNotification
	pushQueueMu     sync.Mutex
	preferences     map[string]*NotificationPreferences
	preferencesMu   sync.RWMutex
	templates       map[string]*NotificationTemplate
	templatesMu     sync.RWMutex
	sentEmails      map[string]*EmailNotification
	sentEmailsMu    sync.RWMutex
	smtpHost        string
	smtpPort        int
	smtpUser        string
	smtpPassword    string
	smsProvider     string
	smsAPIKey       string
	pushProvider    string
	pushAPIKey      string
}

// NewOnboardingNotificationService creates a new notification service
func NewOnboardingNotificationService() *OnboardingNotificationService {
	svc := &OnboardingNotificationService{
		emailQueue:  []*EmailNotification{},
		smsQueue:    []*SMSNotification{},
		pushQueue:   []*PushNotification{},
		preferences: make(map[string]*NotificationPreferences),
		templates:   make(map[string]*NotificationTemplate),
		sentEmails:  make(map[string]*EmailNotification),
	}
	svc.registerDefaultTemplates()
	return svc
}

// registerDefaultTemplates registers default notification templates
func (s *OnboardingNotificationService) registerDefaultTemplates() {
	templates := []NotificationTemplate{
		{
			ID:        "application_submitted",
			Name:      "Application Submitted",
			Type:      "EMAIL",
			Subject:   "Your Application Has Been Submitted - {{.CaseID}}",
			EventType: "APPLICATION_SUBMITTED",
			Language:  "en",
			IsActive:  true,
			Body: `Dear {{.ContactName}},

Thank you for submitting your application to join the Payment Switch network.

Application Reference: {{.CaseID}}
Organization: {{.OrganizationName}}
Submitted: {{.SubmittedAt}}

What happens next:
1. Our team will review your application within 3-5 business days
2. You may be contacted for additional information or documents
3. Once approved, you will receive sandbox credentials for testing

You can track your application status at: {{.TrackingURL}}

If you have any questions, please contact our onboarding team at onboarding@paymentswitch.com

Best regards,
Payment Switch Onboarding Team`,
			HTMLBody: `<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.header{background:#0066cc;color:white;padding:20px;text-align:center}.content{padding:20px}.footer{background:#f5f5f5;padding:15px;text-align:center;font-size:12px}.btn{background:#0066cc;color:white;padding:10px 20px;text-decoration:none;border-radius:5px}</style></head>
<body>
<div class="header"><h1>Payment Switch</h1></div>
<div class="content">
<p>Dear {{.ContactName}},</p>
<p>Thank you for submitting your application to join the Payment Switch network.</p>
<table style="background:#f9f9f9;padding:15px;width:100%;margin:20px 0">
<tr><td><strong>Application Reference:</strong></td><td>{{.CaseID}}</td></tr>
<tr><td><strong>Organization:</strong></td><td>{{.OrganizationName}}</td></tr>
<tr><td><strong>Submitted:</strong></td><td>{{.SubmittedAt}}</td></tr>
</table>
<h3>What happens next:</h3>
<ol>
<li>Our team will review your application within 3-5 business days</li>
<li>You may be contacted for additional information or documents</li>
<li>Once approved, you will receive sandbox credentials for testing</li>
</ol>
<p style="text-align:center;margin:30px 0"><a href="{{.TrackingURL}}" class="btn">Track Your Application</a></p>
</div>
<div class="footer">Payment Switch Onboarding Team | onboarding@paymentswitch.com</div>
</body>
</html>`,
			Variables: []string{"ContactName", "CaseID", "OrganizationName", "SubmittedAt", "TrackingURL"},
		},
		{
			ID:        "status_changed",
			Name:      "Application Status Changed",
			Type:      "EMAIL",
			Subject:   "Application Status Update - {{.CaseID}}",
			EventType: "STATUS_CHANGED",
			Language:  "en",
			IsActive:  true,
			Body: `Dear {{.ContactName}},

Your application status has been updated.

Application Reference: {{.CaseID}}
Organization: {{.OrganizationName}}
Previous Status: {{.PreviousStatus}}
New Status: {{.NewStatus}}

{{.StatusDescription}}

{{if .PendingActions}}
Action Required:
{{range .PendingActions}}
- {{.Title}}: {{.Description}}
{{end}}
{{end}}

Track your application at: {{.TrackingURL}}

Best regards,
Payment Switch Onboarding Team`,
			Variables: []string{"ContactName", "CaseID", "OrganizationName", "PreviousStatus", "NewStatus", "StatusDescription", "PendingActions", "TrackingURL"},
		},
		{
			ID:        "document_request",
			Name:      "Document Request",
			Type:      "EMAIL",
			Subject:   "Document Required - {{.CaseID}}",
			EventType: "DOCUMENT_REQUEST",
			Language:  "en",
			IsActive:  true,
			Body: `Dear {{.ContactName}},

We require additional documentation for your application.

Application Reference: {{.CaseID}}
Organization: {{.OrganizationName}}

Required Documents:
{{range .RequiredDocuments}}
- {{.Name}}: {{.Description}}
{{end}}

Please upload the requested documents by {{.DueDate}}.

Upload documents at: {{.UploadURL}}

Best regards,
Payment Switch Onboarding Team`,
			Variables: []string{"ContactName", "CaseID", "OrganizationName", "RequiredDocuments", "DueDate", "UploadURL"},
		},
		{
			ID:        "kyc_invitation",
			Name:      "KYC Verification Invitation",
			Type:      "EMAIL",
			Subject:   "KYC Verification Required - {{.OrganizationName}}",
			EventType: "KYC_INVITATION",
			Language:  "en",
			IsActive:  true,
			Body: `Dear {{.PersonName}},

As part of the onboarding process for {{.OrganizationName}}, we need to verify your identity.

Your Role: {{.PersonRole}}
KYC Reference: {{.KYCCaseID}}

Please complete the verification process by clicking the link below:
{{.VerificationURL}}

This link will expire on {{.ExpiryDate}}.

What you will need:
- Valid government-issued ID (passport, national ID, or driver's license)
- Proof of address (utility bill or bank statement, less than 3 months old)
- A device with a camera for selfie verification

Best regards,
Payment Switch Compliance Team`,
			Variables: []string{"PersonName", "OrganizationName", "PersonRole", "KYCCaseID", "VerificationURL", "ExpiryDate"},
		},
		{
			ID:        "application_approved",
			Name:      "Application Approved",
			Type:      "EMAIL",
			Subject:   "Congratulations! Your Application Has Been Approved - {{.CaseID}}",
			EventType: "APPLICATION_APPROVED",
			Language:  "en",
			IsActive:  true,
			Body: `Dear {{.ContactName}},

Congratulations! Your application to join the Payment Switch network has been approved.

Application Reference: {{.CaseID}}
Organization: {{.OrganizationName}}
Participant ID: {{.ParticipantID}}

Your Sandbox Credentials:
- Client ID: {{.SandboxClientID}}
- API Key: {{.SandboxAPIKey}}
- Environment: {{.SandboxURL}}

Next Steps:
1. Review our API documentation at {{.DocsURL}}
2. Complete integration testing in the sandbox environment
3. Schedule your production certification test

Welcome to the Payment Switch network!

Best regards,
Payment Switch Onboarding Team`,
			Variables: []string{"ContactName", "CaseID", "OrganizationName", "ParticipantID", "SandboxClientID", "SandboxAPIKey", "SandboxURL", "DocsURL"},
		},
		{
			ID:        "sla_warning",
			Name:      "SLA Warning",
			Type:      "EMAIL",
			Subject:   "[URGENT] SLA Warning - {{.CaseID}}",
			EventType: "SLA_WARNING",
			Language:  "en",
			IsActive:  true,
			Body: `ATTENTION: SLA Warning

Case: {{.CaseID}}
Organization: {{.OrganizationName}}
Current Phase: {{.CurrentPhase}}
Days Remaining: {{.DaysRemaining}}
Target Completion: {{.TargetDate}}

Please take immediate action to prevent SLA breach.

View case: {{.CaseURL}}`,
			Variables: []string{"CaseID", "OrganizationName", "CurrentPhase", "DaysRemaining", "TargetDate", "CaseURL"},
		},
		{
			ID:        "sms_status_update",
			Name:      "SMS Status Update",
			Type:      "SMS",
			EventType: "STATUS_CHANGED",
			Language:  "en",
			IsActive:  true,
			Body:      "PaymentSwitch: Your application {{.CaseID}} status changed to {{.NewStatus}}. Track at {{.TrackingURL}}",
			Variables: []string{"CaseID", "NewStatus", "TrackingURL"},
		},
	}

	for _, tmpl := range templates {
		tmpl.CreatedAt = time.Now()
		tmpl.UpdatedAt = time.Now()
		s.templates[tmpl.ID] = &tmpl
	}
}

// SendEmail sends an email notification
func (s *OnboardingNotificationService) SendEmail(ctx context.Context, to, subject, body string) error {
	email := &EmailNotification{
		ID:        uuid.New().String(),
		To:        to,
		Subject:   subject,
		Body:      body,
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	s.emailQueueMu.Lock()
	s.emailQueue = append(s.emailQueue, email)
	s.emailQueueMu.Unlock()

	// In production, this would send via SMTP or email service (SendGrid, SES, etc.)
	// For now, mark as sent
	sentAt := time.Now()
	email.SentAt = &sentAt
	email.Status = "SENT"

	s.sentEmailsMu.Lock()
	s.sentEmails[email.ID] = email
	s.sentEmailsMu.Unlock()

	return nil
}

// SendSMS sends an SMS notification
func (s *OnboardingNotificationService) SendSMS(ctx context.Context, to, message string) error {
	sms := &SMSNotification{
		ID:        uuid.New().String(),
		To:        to,
		Message:   message,
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	s.smsQueueMu.Lock()
	s.smsQueue = append(s.smsQueue, sms)
	s.smsQueueMu.Unlock()

	// In production, this would send via SMS provider (Twilio, Africa's Talking, etc.)
	sentAt := time.Now()
	sms.SentAt = &sentAt
	sms.Status = "SENT"

	return nil
}

// SendPushNotification sends a push notification
func (s *OnboardingNotificationService) SendPushNotification(ctx context.Context, userID, title, message string) error {
	push := &PushNotification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Body:      message,
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	s.pushQueueMu.Lock()
	s.pushQueue = append(s.pushQueue, push)
	s.pushQueueMu.Unlock()

	// In production, this would send via FCM, APNS, etc.
	sentAt := time.Now()
	push.SentAt = &sentAt
	push.Status = "SENT"

	return nil
}

// SendTemplatedEmail sends an email using a template
func (s *OnboardingNotificationService) SendTemplatedEmail(ctx context.Context, templateID string, to string, data map[string]interface{}) error {
	s.templatesMu.RLock()
	tmpl, ok := s.templates[templateID]
	s.templatesMu.RUnlock()

	if !ok {
		return fmt.Errorf("template %s not found", templateID)
	}

	// Parse and execute subject template
	subjectTmpl, err := template.New("subject").Parse(tmpl.Subject)
	if err != nil {
		return fmt.Errorf("failed to parse subject template: %w", err)
	}
	var subjectBuf bytes.Buffer
	if err := subjectTmpl.Execute(&subjectBuf, data); err != nil {
		return fmt.Errorf("failed to execute subject template: %w", err)
	}

	// Parse and execute body template
	bodyTmpl, err := template.New("body").Parse(tmpl.Body)
	if err != nil {
		return fmt.Errorf("failed to parse body template: %w", err)
	}
	var bodyBuf bytes.Buffer
	if err := bodyTmpl.Execute(&bodyBuf, data); err != nil {
		return fmt.Errorf("failed to execute body template: %w", err)
	}

	email := &EmailNotification{
		ID:           uuid.New().String(),
		To:           to,
		Subject:      subjectBuf.String(),
		Body:         bodyBuf.String(),
		TemplateID:   templateID,
		TemplateData: data,
		Status:       "PENDING",
		CreatedAt:    time.Now(),
		EventType:    tmpl.EventType,
	}

	// Parse HTML body if available
	if tmpl.HTMLBody != "" {
		htmlTmpl, err := template.New("html").Parse(tmpl.HTMLBody)
		if err == nil {
			var htmlBuf bytes.Buffer
			if err := htmlTmpl.Execute(&htmlBuf, data); err == nil {
				email.HTMLBody = htmlBuf.String()
			}
		}
	}

	s.emailQueueMu.Lock()
	s.emailQueue = append(s.emailQueue, email)
	s.emailQueueMu.Unlock()

	// Send email
	sentAt := time.Now()
	email.SentAt = &sentAt
	email.Status = "SENT"

	s.sentEmailsMu.Lock()
	s.sentEmails[email.ID] = email
	s.sentEmailsMu.Unlock()

	return nil
}

// NotifyApplicationSubmitted sends notifications when an application is submitted
func (s *OnboardingNotificationService) NotifyApplicationSubmitted(ctx context.Context, caseID, organizationName, contactName, contactEmail string) error {
	data := map[string]interface{}{
		"CaseID":           caseID,
		"OrganizationName": organizationName,
		"ContactName":      contactName,
		"SubmittedAt":      time.Now().Format("January 2, 2006 at 3:04 PM"),
		"TrackingURL":      fmt.Sprintf("https://portal.paymentswitch.com/track/%s", caseID),
	}

	return s.SendTemplatedEmail(ctx, "application_submitted", contactEmail, data)
}

// NotifyStatusChanged sends notifications when application status changes
func (s *OnboardingNotificationService) NotifyStatusChanged(ctx context.Context, caseID, organizationName, contactName, contactEmail, previousStatus, newStatus, description string, pendingActions []PendingAction) error {
	data := map[string]interface{}{
		"CaseID":            caseID,
		"OrganizationName":  organizationName,
		"ContactName":       contactName,
		"PreviousStatus":    previousStatus,
		"NewStatus":         newStatus,
		"StatusDescription": description,
		"PendingActions":    pendingActions,
		"TrackingURL":       fmt.Sprintf("https://portal.paymentswitch.com/track/%s", caseID),
	}

	return s.SendTemplatedEmail(ctx, "status_changed", contactEmail, data)
}

// NotifyDocumentRequest sends notifications when documents are requested
func (s *OnboardingNotificationService) NotifyDocumentRequest(ctx context.Context, caseID, organizationName, contactName, contactEmail string, requiredDocs []map[string]string, dueDate time.Time) error {
	data := map[string]interface{}{
		"CaseID":            caseID,
		"OrganizationName":  organizationName,
		"ContactName":       contactName,
		"RequiredDocuments": requiredDocs,
		"DueDate":           dueDate.Format("January 2, 2006"),
		"UploadURL":         fmt.Sprintf("https://portal.paymentswitch.com/upload/%s", caseID),
	}

	return s.SendTemplatedEmail(ctx, "document_request", contactEmail, data)
}

// NotifyKYCInvitation sends KYC verification invitation
func (s *OnboardingNotificationService) NotifyKYCInvitation(ctx context.Context, personName, personEmail, personRole, organizationName, kycCaseID string, expiryDate time.Time) error {
	data := map[string]interface{}{
		"PersonName":       personName,
		"OrganizationName": organizationName,
		"PersonRole":       personRole,
		"KYCCaseID":        kycCaseID,
		"VerificationURL":  fmt.Sprintf("https://kyc.paymentswitch.com/verify/%s", kycCaseID),
		"ExpiryDate":       expiryDate.Format("January 2, 2006"),
	}

	return s.SendTemplatedEmail(ctx, "kyc_invitation", personEmail, data)
}

// NotifyApplicationApproved sends notifications when application is approved
func (s *OnboardingNotificationService) NotifyApplicationApproved(ctx context.Context, caseID, organizationName, contactName, contactEmail, participantID, sandboxClientID, sandboxAPIKey string) error {
	data := map[string]interface{}{
		"CaseID":           caseID,
		"OrganizationName": organizationName,
		"ContactName":      contactName,
		"ParticipantID":    participantID,
		"SandboxClientID":  sandboxClientID,
		"SandboxAPIKey":    sandboxAPIKey,
		"SandboxURL":       "https://sandbox.paymentswitch.com",
		"DocsURL":          "https://docs.paymentswitch.com",
	}

	return s.SendTemplatedEmail(ctx, "application_approved", contactEmail, data)
}

// NotifySLAWarning sends SLA warning notifications
func (s *OnboardingNotificationService) NotifySLAWarning(ctx context.Context, caseID, organizationName, currentPhase string, daysRemaining int, targetDate time.Time, reviewerEmail string) error {
	data := map[string]interface{}{
		"CaseID":           caseID,
		"OrganizationName": organizationName,
		"CurrentPhase":     currentPhase,
		"DaysRemaining":    daysRemaining,
		"TargetDate":       targetDate.Format("January 2, 2006"),
		"CaseURL":          fmt.Sprintf("https://admin.paymentswitch.com/onboarding/%s", caseID),
	}

	return s.SendTemplatedEmail(ctx, "sla_warning", reviewerEmail, data)
}

// SetPreferences sets notification preferences for a user
func (s *OnboardingNotificationService) SetPreferences(ctx context.Context, prefs *NotificationPreferences) error {
	s.preferencesMu.Lock()
	defer s.preferencesMu.Unlock()

	s.preferences[prefs.UserID] = prefs
	return nil
}

// GetPreferences gets notification preferences for a user
func (s *OnboardingNotificationService) GetPreferences(ctx context.Context, userID string) (*NotificationPreferences, error) {
	s.preferencesMu.RLock()
	defer s.preferencesMu.RUnlock()

	if prefs, ok := s.preferences[userID]; ok {
		return prefs, nil
	}

	// Return default preferences
	return &NotificationPreferences{
		UserID:            userID,
		EmailEnabled:      true,
		SMSEnabled:        false,
		PushEnabled:       true,
		DigestFrequency:   "IMMEDIATE",
		Language:          "en",
		Timezone:          "UTC",
		EnabledEventTypes: []string{"APPLICATION_SUBMITTED", "STATUS_CHANGED", "DOCUMENT_REQUEST", "APPLICATION_APPROVED"},
	}, nil
}

// HTTP Handlers

// HandleSendNotification handles sending notifications via HTTP
func (s *OnboardingNotificationService) HandleSendNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Type       string                 `json:"type"` // EMAIL, SMS, PUSH
		TemplateID string                 `json:"template_id,omitempty"`
		To         string                 `json:"to"`
		Subject    string                 `json:"subject,omitempty"`
		Body       string                 `json:"body,omitempty"`
		Data       map[string]interface{} `json:"data,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var err error
	switch req.Type {
	case "EMAIL":
		if req.TemplateID != "" {
			err = s.SendTemplatedEmail(r.Context(), req.TemplateID, req.To, req.Data)
		} else {
			err = s.SendEmail(r.Context(), req.To, req.Subject, req.Body)
		}
	case "SMS":
		err = s.SendSMS(r.Context(), req.To, req.Body)
	case "PUSH":
		err = s.SendPushNotification(r.Context(), req.To, req.Subject, req.Body)
	default:
		http.Error(w, "Invalid notification type", http.StatusBadRequest)
		return
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "sent"})
}

// HandleGetTemplates handles getting notification templates
func (s *OnboardingNotificationService) HandleGetTemplates(w http.ResponseWriter, r *http.Request) {
	s.templatesMu.RLock()
	defer s.templatesMu.RUnlock()

	templates := make([]*NotificationTemplate, 0, len(s.templates))
	for _, tmpl := range s.templates {
		templates = append(templates, tmpl)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}
