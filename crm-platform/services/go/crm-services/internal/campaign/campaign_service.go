package campaign

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CampaignStatus represents the lifecycle state of a campaign
type CampaignStatus string

const (
	CampaignStatusDraft     CampaignStatus = "draft"
	CampaignStatusScheduled CampaignStatus = "scheduled"
	CampaignStatusActive    CampaignStatus = "active"
	CampaignStatusPaused    CampaignStatus = "paused"
	CampaignStatusCompleted CampaignStatus = "completed"
	CampaignStatusCancelled CampaignStatus = "cancelled"
)

// CampaignType defines the kind of campaign
type CampaignType string

const (
	CampaignTypeUpsell       CampaignType = "upsell"
	CampaignTypeCrossSell    CampaignType = "cross_sell"
	CampaignTypeRetention    CampaignType = "retention"
	CampaignTypeOnboarding   CampaignType = "onboarding"
	CampaignTypePromotion    CampaignType = "promotion"
	CampaignTypeReactivation CampaignType = "reactivation"
	CampaignTypeCompliance   CampaignType = "compliance"
)

// ChannelType defines outbound channels
type ChannelType string

const (
	ChannelSMS      ChannelType = "sms"
	ChannelWhatsApp ChannelType = "whatsapp"
	ChannelTelegram ChannelType = "telegram"
	ChannelVoice    ChannelType = "voice"
	ChannelEmail    ChannelType = "email"
	ChannelUSSD     ChannelType = "ussd"
)

// Campaign represents a marketing or communication campaign
type Campaign struct {
	ID              string         `json:"id" gorm:"primaryKey"`
	Name            string         `json:"name" gorm:"not null;index"`
	Description     string         `json:"description"`
	Type            CampaignType   `json:"type" gorm:"not null;index"`
	Status          CampaignStatus `json:"status" gorm:"not null;index;default:draft"`
	Channels        string         `json:"channels" gorm:"type:text"` // JSON array of ChannelType
	TargetAudience  string         `json:"target_audience" gorm:"type:text"` // JSON SegmentFilter
	MessageTemplate string         `json:"message_template" gorm:"type:text"`
	ABVariants      string         `json:"ab_variants" gorm:"type:text"` // JSON array of variants
	Budget          float64        `json:"budget"`
	SpentAmount     float64        `json:"spent_amount"`
	ScheduledAt     *time.Time     `json:"scheduled_at"`
	StartedAt       *time.Time     `json:"started_at"`
	CompletedAt     *time.Time     `json:"completed_at"`
	CreatedBy       string         `json:"created_by" gorm:"not null"`
	Priority        int            `json:"priority" gorm:"default:5"`
	Tags            string         `json:"tags" gorm:"type:text"` // JSON array of strings
	Metadata        string         `json:"metadata" gorm:"type:text"` // JSON
	RateLimit       int            `json:"rate_limit" gorm:"default:100"` // messages per second
	RetryPolicy     string         `json:"retry_policy" gorm:"type:text"` // JSON RetryPolicy
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// CampaignRecipient tracks individual recipient delivery
type CampaignRecipient struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	CampaignID    string     `json:"campaign_id" gorm:"not null;index"`
	CustomerID    string     `json:"customer_id" gorm:"not null;index"`
	Channel       ChannelType `json:"channel" gorm:"not null"`
	Recipient     string     `json:"recipient" gorm:"not null"` // phone/email/chatID
	Variant       string     `json:"variant"` // A/B variant identifier
	Status        string     `json:"status" gorm:"not null;default:pending;index"` // pending, sent, delivered, read, clicked, failed, opted_out
	SentAt        *time.Time `json:"sent_at"`
	DeliveredAt   *time.Time `json:"delivered_at"`
	ReadAt        *time.Time `json:"read_at"`
	ClickedAt     *time.Time `json:"clicked_at"`
	FailReason    string     `json:"fail_reason"`
	RetryCount    int        `json:"retry_count" gorm:"default:0"`
	MessageID     string     `json:"message_id"` // provider message ID
	ResponseData  string     `json:"response_data" gorm:"type:text"` // JSON
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// CampaignConsentRecord tracks customer opt-in/opt-out
type CampaignConsentRecord struct {
	ID          string      `json:"id" gorm:"primaryKey"`
	CustomerID  string      `json:"customer_id" gorm:"not null;uniqueIndex:idx_consent_customer_channel"`
	Channel     ChannelType `json:"channel" gorm:"not null;uniqueIndex:idx_consent_customer_channel"`
	Consented   bool        `json:"consented" gorm:"not null;default:true"`
	ConsentedAt *time.Time  `json:"consented_at"`
	RevokedAt   *time.Time  `json:"revoked_at"`
	Source      string      `json:"source"` // how consent was obtained: "registration", "settings", "sms_reply"
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// SegmentFilter defines audience targeting criteria
type SegmentFilter struct {
	Sources         []string  `json:"sources,omitempty"`         // core_banking, agent_banking, remittance
	Segments        []string  `json:"segments,omitempty"`        // premium, standard, basic
	Regions         []string  `json:"regions,omitempty"`
	MinBalance      *float64  `json:"min_balance,omitempty"`
	MaxBalance      *float64  `json:"max_balance,omitempty"`
	HasProduct      []string  `json:"has_product,omitempty"`     // savings, current, loan
	MissingProduct  []string  `json:"missing_product,omitempty"` // products they don't have (for cross-sell)
	MinTransactions *int      `json:"min_transactions,omitempty"`
	LastActiveAfter *time.Time `json:"last_active_after,omitempty"`
	AgentIDs        []string  `json:"agent_ids,omitempty"`
	CorridorCodes   []string  `json:"corridor_codes,omitempty"`  // GBP_NGN, USD_NGN for remittance
	ExcludeIDs      []string  `json:"exclude_ids,omitempty"`
	CustomQuery     string    `json:"custom_query,omitempty"`
}

// ABVariant defines an A/B test variant
type ABVariant struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	MessageTemplate string  `json:"message_template"`
	Weight          float64 `json:"weight"` // 0.0 - 1.0 distribution
}

// RetryPolicy defines retry behavior for failed sends
type RetryPolicy struct {
	MaxRetries    int           `json:"max_retries"`
	RetryInterval time.Duration `json:"retry_interval"`
	BackoffFactor float64       `json:"backoff_factor"`
}

// CampaignStats aggregated campaign statistics
type CampaignStats struct {
	CampaignID    string  `json:"campaign_id"`
	TotalRecipients int   `json:"total_recipients"`
	Sent          int     `json:"sent"`
	Delivered     int     `json:"delivered"`
	Read          int     `json:"read"`
	Clicked       int     `json:"clicked"`
	Failed        int     `json:"failed"`
	OptedOut      int     `json:"opted_out"`
	DeliveryRate  float64 `json:"delivery_rate"`
	OpenRate      float64 `json:"open_rate"`
	ClickRate     float64 `json:"click_rate"`
	ConversionRate float64 `json:"conversion_rate"`
}

// CampaignService manages campaign lifecycle
type CampaignService struct {
	db          *gorm.DB
	redisClient *redis.Client
	logger      *zap.SugaredLogger
	mu          sync.RWMutex
	scheduler   *CampaignScheduler
}

// NewCampaignService creates a new campaign service
func NewCampaignService(
	db *gorm.DB,
	redisClient *redis.Client,
	logger *zap.SugaredLogger,
) *CampaignService {
	svc := &CampaignService{
		db:          db,
		redisClient: redisClient,
		logger:      logger,
	}
	svc.scheduler = NewCampaignScheduler(svc)
	return svc
}

// AutoMigrate creates database tables
func (s *CampaignService) AutoMigrate() error {
	return s.db.AutoMigrate(
		&Campaign{},
		&CampaignRecipient{},
		&CampaignConsentRecord{},
	)
}

// CreateCampaign creates a new campaign in draft status
func (s *CampaignService) CreateCampaign(ctx context.Context, campaign *Campaign) error {
	campaign.ID = uuid.New().String()
	campaign.Status = CampaignStatusDraft
	campaign.CreatedAt = time.Now()
	campaign.UpdatedAt = time.Now()

	result := s.db.Create(campaign)
	if result.Error != nil {
		return fmt.Errorf("failed to create campaign: %w", result.Error)
	}

	s.logger.Infof("Campaign created: %s (%s)", campaign.Name, campaign.ID)
	s.publishEvent("campaign.created", campaign)
	return nil
}

// GetCampaign retrieves a campaign by ID
func (s *CampaignService) GetCampaign(ctx context.Context, campaignID string) (*Campaign, error) {
	var campaign Campaign
	result := s.db.First(&campaign, "id = ?", campaignID)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("campaign not found: %s", campaignID)
		}
		return nil, fmt.Errorf("failed to get campaign: %w", result.Error)
	}
	return &campaign, nil
}

// ListCampaigns lists campaigns with optional filters
func (s *CampaignService) ListCampaigns(ctx context.Context, status *CampaignStatus, campaignType *CampaignType, limit, offset int) ([]Campaign, int64, error) {
	var campaigns []Campaign
	var total int64

	query := s.db.Model(&Campaign{})

	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if campaignType != nil {
		query = query.Where("type = ?", *campaignType)
	}

	query.Count(&total)

	result := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&campaigns)
	if result.Error != nil {
		return nil, 0, fmt.Errorf("failed to list campaigns: %w", result.Error)
	}

	return campaigns, total, nil
}

// UpdateCampaign updates a campaign (only allowed in draft/paused status)
func (s *CampaignService) UpdateCampaign(ctx context.Context, campaignID string, updates map[string]interface{}) error {
	campaign, err := s.GetCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	if campaign.Status != CampaignStatusDraft && campaign.Status != CampaignStatusPaused {
		return fmt.Errorf("campaign can only be updated in draft or paused status, current: %s", campaign.Status)
	}

	updates["updated_at"] = time.Now()
	result := s.db.Model(&Campaign{}).Where("id = ?", campaignID).Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("failed to update campaign: %w", result.Error)
	}

	s.logger.Infof("Campaign updated: %s", campaignID)
	return nil
}

// ScheduleCampaign schedules a campaign for future execution
func (s *CampaignService) ScheduleCampaign(ctx context.Context, campaignID string, scheduledAt time.Time) error {
	campaign, err := s.GetCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	if campaign.Status != CampaignStatusDraft {
		return fmt.Errorf("only draft campaigns can be scheduled, current: %s", campaign.Status)
	}

	if scheduledAt.Before(time.Now()) {
		return fmt.Errorf("scheduled time must be in the future")
	}

	result := s.db.Model(&Campaign{}).Where("id = ?", campaignID).Updates(map[string]interface{}{
		"status":       CampaignStatusScheduled,
		"scheduled_at": scheduledAt,
		"updated_at":   time.Now(),
	})
	if result.Error != nil {
		return fmt.Errorf("failed to schedule campaign: %w", result.Error)
	}

	s.scheduler.Schedule(campaignID, scheduledAt)
	s.publishEvent("campaign.scheduled", campaign)
	s.logger.Infof("Campaign scheduled: %s for %s", campaignID, scheduledAt.Format(time.RFC3339))
	return nil
}

// LaunchCampaign starts a campaign immediately
func (s *CampaignService) LaunchCampaign(ctx context.Context, campaignID string) error {
	campaign, err := s.GetCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	if campaign.Status != CampaignStatusDraft && campaign.Status != CampaignStatusScheduled {
		return fmt.Errorf("only draft or scheduled campaigns can be launched, current: %s", campaign.Status)
	}

	now := time.Now()
	result := s.db.Model(&Campaign{}).Where("id = ?", campaignID).Updates(map[string]interface{}{
		"status":     CampaignStatusActive,
		"started_at": now,
		"updated_at": now,
	})
	if result.Error != nil {
		return fmt.Errorf("failed to launch campaign: %w", result.Error)
	}

	s.publishEvent("campaign.launched", campaign)
	s.logger.Infof("Campaign launched: %s", campaignID)
	return nil
}

// PauseCampaign pauses an active campaign
func (s *CampaignService) PauseCampaign(ctx context.Context, campaignID string) error {
	result := s.db.Model(&Campaign{}).Where("id = ? AND status = ?", campaignID, CampaignStatusActive).Updates(map[string]interface{}{
		"status":     CampaignStatusPaused,
		"updated_at": time.Now(),
	})
	if result.Error != nil {
		return fmt.Errorf("failed to pause campaign: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("campaign not found or not active: %s", campaignID)
	}
	s.logger.Infof("Campaign paused: %s", campaignID)
	return nil
}

// CompleteCampaign marks a campaign as completed
func (s *CampaignService) CompleteCampaign(ctx context.Context, campaignID string) error {
	now := time.Now()
	result := s.db.Model(&Campaign{}).Where("id = ? AND status = ?", campaignID, CampaignStatusActive).Updates(map[string]interface{}{
		"status":       CampaignStatusCompleted,
		"completed_at": now,
		"updated_at":   now,
	})
	if result.Error != nil {
		return fmt.Errorf("failed to complete campaign: %w", result.Error)
	}
	s.logger.Infof("Campaign completed: %s", campaignID)
	return nil
}

// GetCampaignStats returns aggregated stats for a campaign
func (s *CampaignService) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	stats := &CampaignStats{CampaignID: campaignID}

	var total int64
	s.db.Model(&CampaignRecipient{}).Where("campaign_id = ?", campaignID).Count(&total)
	stats.TotalRecipients = int(total)

	statusCounts := make(map[string]int64)
	rows, err := s.db.Model(&CampaignRecipient{}).
		Select("status, count(*) as count").
		Where("campaign_id = ?", campaignID).
		Group("status").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to get campaign stats: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err == nil {
			statusCounts[status] = count
		}
	}

	stats.Sent = int(statusCounts["sent"] + statusCounts["delivered"] + statusCounts["read"] + statusCounts["clicked"])
	stats.Delivered = int(statusCounts["delivered"] + statusCounts["read"] + statusCounts["clicked"])
	stats.Read = int(statusCounts["read"] + statusCounts["clicked"])
	stats.Clicked = int(statusCounts["clicked"])
	stats.Failed = int(statusCounts["failed"])
	stats.OptedOut = int(statusCounts["opted_out"])

	if stats.TotalRecipients > 0 {
		stats.DeliveryRate = float64(stats.Delivered) / float64(stats.TotalRecipients) * 100
		stats.OpenRate = float64(stats.Read) / float64(stats.TotalRecipients) * 100
		stats.ClickRate = float64(stats.Clicked) / float64(stats.TotalRecipients) * 100
	}

	return stats, nil
}

// CheckConsent checks if a customer has consented to a channel
func (s *CampaignService) CheckConsent(ctx context.Context, customerID string, channel ChannelType) (bool, error) {
	var consent CampaignConsentRecord
	result := s.db.Where("customer_id = ? AND channel = ?", customerID, channel).First(&consent)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return false, nil // no record means no consent
		}
		return false, fmt.Errorf("failed to check consent: %w", result.Error)
	}
	return consent.Consented, nil
}

// UpdateConsent updates or creates a consent record
func (s *CampaignService) UpdateConsent(ctx context.Context, customerID string, channel ChannelType, consented bool, source string) error {
	now := time.Now()
	consent := CampaignConsentRecord{
		CustomerID: customerID,
		Channel:    channel,
		Consented:  consented,
		Source:     source,
		UpdatedAt:  now,
	}

	if consented {
		consent.ConsentedAt = &now
	} else {
		consent.RevokedAt = &now
	}

	result := s.db.Where("customer_id = ? AND channel = ?", customerID, channel).
		Assign(consent).
		FirstOrCreate(&consent)
	if result.Error != nil {
		return fmt.Errorf("failed to update consent: %w", result.Error)
	}

	s.publishEvent("consent.updated", map[string]interface{}{
		"customer_id": customerID,
		"channel":     channel,
		"consented":   consented,
	})

	return nil
}

// BuildRecipientList resolves the audience segment and creates recipient records
func (s *CampaignService) BuildRecipientList(ctx context.Context, campaignID string) (int, error) {
	campaign, err := s.GetCampaign(ctx, campaignID)
	if err != nil {
		return 0, err
	}

	var filter SegmentFilter
	if err := json.Unmarshal([]byte(campaign.TargetAudience), &filter); err != nil {
		return 0, fmt.Errorf("failed to parse target audience filter: %w", err)
	}

	var channels []ChannelType
	if err := json.Unmarshal([]byte(campaign.Channels), &channels); err != nil {
		return 0, fmt.Errorf("failed to parse channels: %w", err)
	}

	var variants []ABVariant
	if campaign.ABVariants != "" {
		if err := json.Unmarshal([]byte(campaign.ABVariants), &variants); err != nil {
			s.logger.Warnf("Failed to parse A/B variants, using default: %v", err)
		}
	}

	// Query matching customers (simplified — in production this joins with banking data)
	customers, err := s.resolveAudience(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("failed to resolve audience: %w", err)
	}

	created := 0
	for _, customer := range customers {
		for _, channel := range channels {
			// Check consent
			consented, err := s.CheckConsent(ctx, customer.ID, channel)
			if err != nil {
				s.logger.Warnf("Failed to check consent for %s/%s: %v", customer.ID, channel, err)
				continue
			}
			if !consented {
				continue
			}

			contactInfo := s.getContactForChannel(customer, channel)
			if contactInfo == "" {
				continue
			}

			variant := ""
			if len(variants) > 0 {
				variant = s.assignVariant(variants, created)
			}

			recipient := CampaignRecipient{
				ID:         uuid.New().String(),
				CampaignID: campaignID,
				CustomerID: customer.ID,
				Channel:    channel,
				Recipient:  contactInfo,
				Variant:    variant,
				Status:     "pending",
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			}

			if result := s.db.Create(&recipient); result.Error != nil {
				s.logger.Warnf("Failed to create recipient record: %v", result.Error)
				continue
			}
			created++
		}
	}

	s.logger.Infof("Built recipient list for campaign %s: %d recipients", campaignID, created)
	return created, nil
}

// CustomerRecord simplified customer for audience resolution
type CustomerRecord struct {
	ID          string `json:"id"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	TelegramID  string `json:"telegram_id"`
	WhatsAppID  string `json:"whatsapp_id"`
	Segment     string `json:"segment"`
	Region      string `json:"region"`
	Source      string `json:"source"`
}

// resolveAudience queries customers matching the segment filter
func (s *CampaignService) resolveAudience(ctx context.Context, filter SegmentFilter) ([]CustomerRecord, error) {
	// In production this would query the unified customer database
	// with joins across core banking, agent banking, and remittance sources
	// For now we query a simplified customer table
	var customers []CustomerRecord

	query := s.db.Table("customers").Select("id, phone, email, telegram_id, whatsapp_id, segment, region, source")

	if len(filter.Sources) > 0 {
		query = query.Where("source IN ?", filter.Sources)
	}
	if len(filter.Segments) > 0 {
		query = query.Where("segment IN ?", filter.Segments)
	}
	if len(filter.Regions) > 0 {
		query = query.Where("region IN ?", filter.Regions)
	}
	if filter.MinBalance != nil {
		query = query.Where("balance >= ?", *filter.MinBalance)
	}
	if filter.MaxBalance != nil {
		query = query.Where("balance <= ?", *filter.MaxBalance)
	}
	if len(filter.ExcludeIDs) > 0 {
		query = query.Where("id NOT IN ?", filter.ExcludeIDs)
	}

	result := query.Find(&customers)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to query customers: %w", result.Error)
	}

	return customers, nil
}

// getContactForChannel returns the appropriate contact info for a channel
func (s *CampaignService) getContactForChannel(customer CustomerRecord, channel ChannelType) string {
	switch channel {
	case ChannelSMS, ChannelVoice, ChannelUSSD:
		return customer.Phone
	case ChannelWhatsApp:
		if customer.WhatsAppID != "" {
			return customer.WhatsAppID
		}
		return customer.Phone
	case ChannelTelegram:
		return customer.TelegramID
	case ChannelEmail:
		return customer.Email
	default:
		return ""
	}
}

// assignVariant assigns an A/B variant based on weighted distribution
func (s *CampaignService) assignVariant(variants []ABVariant, index int) string {
	if len(variants) == 0 {
		return ""
	}

	cumulative := 0.0
	threshold := float64(index%100) / 100.0
	for _, v := range variants {
		cumulative += v.Weight
		if threshold < cumulative {
			return v.ID
		}
	}

	return variants[len(variants)-1].ID
}

// publishEvent publishes a campaign event to Redis
func (s *CampaignService) publishEvent(eventType string, data interface{}) {
	payload, err := json.Marshal(map[string]interface{}{
		"type":      eventType,
		"data":      data,
		"timestamp": time.Now().Unix(),
	})
	if err != nil {
		s.logger.Warnf("Failed to marshal event: %v", err)
		return
	}

	if err := s.redisClient.Publish(context.Background(), "campaign.events", payload).Err(); err != nil {
		s.logger.Warnf("Failed to publish campaign event: %v", err)
	}
}

// CampaignScheduler manages scheduled campaign launches
type CampaignScheduler struct {
	service  *CampaignService
	timers   map[string]*time.Timer
	mu       sync.Mutex
	stopChan chan struct{}
}

// NewCampaignScheduler creates a new campaign scheduler
func NewCampaignScheduler(service *CampaignService) *CampaignScheduler {
	return &CampaignScheduler{
		service:  service,
		timers:   make(map[string]*time.Timer),
		stopChan: make(chan struct{}),
	}
}

// Schedule schedules a campaign to launch at a specific time
func (cs *CampaignScheduler) Schedule(campaignID string, at time.Time) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if existing, ok := cs.timers[campaignID]; ok {
		existing.Stop()
	}

	duration := time.Until(at)
	if duration < 0 {
		duration = 0
	}

	cs.timers[campaignID] = time.AfterFunc(duration, func() {
		ctx := context.Background()
		if err := cs.service.LaunchCampaign(ctx, campaignID); err != nil {
			cs.service.logger.Errorf("Failed to auto-launch campaign %s: %v", campaignID, err)
		}
	})

	cs.service.logger.Infof("Campaign %s scheduled for auto-launch in %s", campaignID, duration)
}

// Cancel cancels a scheduled campaign launch
func (cs *CampaignScheduler) Cancel(campaignID string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if timer, ok := cs.timers[campaignID]; ok {
		timer.Stop()
		delete(cs.timers, campaignID)
	}
}

// Stop stops the scheduler and cancels all timers
func (cs *CampaignScheduler) Stop() {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	for id, timer := range cs.timers {
		timer.Stop()
		delete(cs.timers, id)
	}
	close(cs.stopChan)
}
