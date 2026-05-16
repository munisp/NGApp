package service

import (
	"fmt"
	"notification-service/internal/models"
	"notification-service/internal/repository"
	"strings"
	"time"
)

type NotificationService struct {
	repo *repository.NotificationRepository
}

func NewNotificationService(repo *repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

type SendRequest struct {
	RecipientID string            `json:"recipient_id"`
	Type        string            `json:"type"`
	Subject     string            `json:"subject,omitempty"`
	Body        string            `json:"body"`
	Priority    string            `json:"priority,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	TemplateID  string            `json:"template_id,omitempty"`
	Vars        map[string]string `json:"template_vars,omitempty"`
}

func (s *NotificationService) Send(req SendRequest) (*models.Notification, error) {
	if req.RecipientID == "" {
		return nil, fmt.Errorf("recipient_id is required")
	}

	pref := s.repo.GetPreference(req.RecipientID)
	nType := models.NotificationType(req.Type)
	switch nType {
	case models.TypeSMS:
		if !pref.SMS { return nil, fmt.Errorf("recipient has opted out of SMS") }
	case models.TypeEmail:
		if !pref.Email { return nil, fmt.Errorf("recipient has opted out of email") }
	case models.TypeWhatsApp:
		if !pref.WhatsApp { return nil, fmt.Errorf("recipient has opted out of WhatsApp") }
	}

	body := req.Body
	if req.TemplateID != "" && req.Vars != nil {
		templates := s.repo.GetTemplates("")
		for _, t := range templates {
			if t.ID == req.TemplateID {
				body = t.Body
				for k, v := range req.Vars {
					body = strings.ReplaceAll(body, "{{"+k+"}}", v)
				}
				if req.Subject == "" { req.Subject = t.Subject }
				break
			}
		}
	}
	if body == "" {
		return nil, fmt.Errorf("notification body is empty")
	}

	priority := req.Priority
	if priority == "" { priority = "normal" }

	notif := &models.Notification{
		ID:          fmt.Sprintf("NOT-%d", time.Now().UnixNano()%10000000),
		RecipientID: req.RecipientID,
		Type:        nType,
		Subject:     req.Subject,
		Body:        body,
		Status:      "queued",
		Priority:    priority,
		Metadata:    req.Metadata,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.Create(notif); err != nil {
		return nil, err
	}

	go s.processAsync(notif.ID)

	return notif, nil
}

func (s *NotificationService) processAsync(id string) {
	time.Sleep(1 * time.Second)
	s.repo.UpdateStatus(id, "sent")
}

type BulkRequest struct {
	RecipientIDs []string `json:"recipient_ids"`
	Type         string   `json:"type"`
	Subject      string   `json:"subject,omitempty"`
	Body         string   `json:"body"`
	Priority     string   `json:"priority,omitempty"`
}

func (s *NotificationService) SendBulk(req BulkRequest) (int, int, error) {
	if len(req.RecipientIDs) == 0 {
		return 0, 0, fmt.Errorf("no recipients specified")
	}
	success, fail := 0, 0
	for _, rid := range req.RecipientIDs {
		_, err := s.Send(SendRequest{
			RecipientID: rid, Type: req.Type, Subject: req.Subject,
			Body: req.Body, Priority: req.Priority,
		})
		if err != nil { fail++ } else { success++ }
	}
	return success, fail, nil
}

func (s *NotificationService) MarkRead(id string) error {
	_, err := s.repo.GetByID(id)
	if err != nil { return err }
	s.repo.UpdateStatus(id, "read")
	return nil
}

func (s *NotificationService) Get(id string) (*models.Notification, error) { return s.repo.GetByID(id) }
func (s *NotificationService) List(recipientID, status string, limit int) []models.Notification { return s.repo.List(recipientID, status, limit) }
func (s *NotificationService) GetTemplates(category string) []models.NotificationTemplate { return s.repo.GetTemplates(category) }
func (s *NotificationService) GetPreference(id string) *models.NotificationPreference { return s.repo.GetPreference(id) }
func (s *NotificationService) SetPreference(p *models.NotificationPreference) { s.repo.SetPreference(p) }
func (s *NotificationService) GetStats() map[string]interface{} { return s.repo.GetStats() }
