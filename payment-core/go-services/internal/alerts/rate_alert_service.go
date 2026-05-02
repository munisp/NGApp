package alerts

import (
	"database/sql"
	"fmt"
	"math"
	"sync"
	"time"
)

type AlertCondition string

const (
	ConditionAbove AlertCondition = "above"
	ConditionBelow AlertCondition = "below"
	ConditionExact AlertCondition = "exact"
)

type AlertStatus string

const (
	StatusActive    AlertStatus = "active"
	StatusTriggered AlertStatus = "triggered"
	StatusExpired   AlertStatus = "expired"
	StatusCancelled AlertStatus = "cancelled"
)

type RateAlert struct {
	ID                int64          `json:"id"`
	UserID            int64          `json:"userId"`
	FromCurrency      string         `json:"fromCurrency"`
	ToCurrency        string         `json:"toCurrency"`
	TargetRate        float64        `json:"targetRate"`
	Condition         AlertCondition `json:"condition"`
	NotifyEmail       bool           `json:"notifyEmail"`
	NotifySMS         bool           `json:"notifySms"`
	NotifyPush        bool           `json:"notifyPush"`
	NotificationEmail string         `json:"notificationEmail,omitempty"`
	NotificationPhone string         `json:"notificationPhone,omitempty"`
	ExpiresAt         *time.Time     `json:"expiresAt,omitempty"`
	IsActive          bool           `json:"isActive"`
	Status            AlertStatus    `json:"status"`
	TriggeredAt       *time.Time     `json:"triggeredAt,omitempty"`
	TriggeredRate     float64        `json:"triggeredRate,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
}

type RateAlertWithProgress struct {
	RateAlert
	CurrentRate        float64 `json:"currentRate,omitempty"`
	ProgressPercentage int     `json:"progressPercentage,omitempty"`
	DistanceFromTarget float64 `json:"distanceFromTarget,omitempty"`
}

type RateAlertHistory struct {
	ID                 int64          `json:"id"`
	AlertID            int64          `json:"alertId"`
	UserID             int64          `json:"userId"`
	FromCurrency       string         `json:"fromCurrency"`
	ToCurrency         string         `json:"toCurrency"`
	TargetRate         float64        `json:"targetRate"`
	TriggeredRate      float64        `json:"triggeredRate"`
	Condition          AlertCondition `json:"condition"`
	NotificationsSent  []string       `json:"notificationsSent"`
	NotificationStatus string         `json:"notificationStatus"`
	TriggeredAt        time.Time      `json:"triggeredAt"`
}

type CreateRateAlertParams struct {
	UserID       int64          `json:"userId"`
	FromCurrency string         `json:"fromCurrency"`
	ToCurrency   string         `json:"toCurrency"`
	TargetRate   float64        `json:"targetRate"`
	Condition    AlertCondition `json:"condition"`
	NotifyEmail  bool           `json:"notifyEmail"`
	NotifySMS    bool           `json:"notifySms"`
	NotifyPush   bool           `json:"notifyPush"`
	ExpiresAt    *time.Time     `json:"expiresAt,omitempty"`
}

type RateAlertAnalytics struct {
	TotalAlerts       int                    `json:"totalAlerts"`
	ActiveAlerts      int                    `json:"activeAlerts"`
	TriggeredAlerts   int                    `json:"triggeredAlerts"`
	ExpiredAlerts     int                    `json:"expiredAlerts"`
	CancelledAlerts   int                    `json:"cancelledAlerts"`
	AvgTimeToTrigger  float64                `json:"avgTimeToTrigger"`
	ConditionCounts   map[string]int         `json:"conditionCounts"`
	TopCurrencyPairs  []CurrencyPairCount    `json:"topCurrencyPairs"`
	TopTargetRates    []TargetRateCount      `json:"topTargetRates"`
}

type CurrencyPairCount struct {
	Pair  string `json:"pair"`
	Count int    `json:"count"`
}

type TargetRateCount struct {
	Rate  float64 `json:"rate"`
	Count int     `json:"count"`
}

type ExchangeRateProvider interface {
	GetExchangeRate(fromCurrency, toCurrency string, amount float64) (float64, error)
}

type NotificationSender interface {
	SendEmail(to, subject, body string) error
	SendSMS(to, message string) error
	SendPush(userID int64, title, body string) error
}

type RateAlertService struct {
	mu           sync.RWMutex
	db           *sql.DB
	alerts       map[int64]*RateAlert
	history      []*RateAlertHistory
	idCounter    int64
	rateProvider ExchangeRateProvider
	notifier     NotificationSender
}

func NewRateAlertService(db *sql.DB, rateProvider ExchangeRateProvider, notifier NotificationSender) *RateAlertService {
	return &RateAlertService{
		db:           db,
		alerts:       make(map[int64]*RateAlert),
		history:      make([]*RateAlertHistory, 0),
		idCounter:    1,
		rateProvider: rateProvider,
		notifier:     notifier,
	}
}

func (s *RateAlertService) CreateRateAlert(params CreateRateAlertParams) (*RateAlert, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	alert := &RateAlert{
		ID:           s.idCounter,
		UserID:       params.UserID,
		FromCurrency: params.FromCurrency,
		ToCurrency:   params.ToCurrency,
		TargetRate:   params.TargetRate,
		Condition:    params.Condition,
		NotifyEmail:  params.NotifyEmail,
		NotifySMS:    params.NotifySMS,
		NotifyPush:   params.NotifyPush,
		ExpiresAt:    params.ExpiresAt,
		IsActive:     true,
		Status:       StatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	s.idCounter++
	s.alerts[alert.ID] = alert

	return alert, nil
}

func (s *RateAlertService) GetUserRateAlerts(userID int64) ([]*RateAlertWithProgress, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var alerts []*RateAlertWithProgress
	for _, alert := range s.alerts {
		if alert.UserID == userID && alert.IsActive {
			alertWithProgress := &RateAlertWithProgress{
				RateAlert: *alert,
			}

			if s.rateProvider != nil {
				currentRate, err := s.rateProvider.GetExchangeRate(alert.FromCurrency, alert.ToCurrency, 1)
				if err == nil {
					alertWithProgress.CurrentRate = currentRate
					alertWithProgress.ProgressPercentage, alertWithProgress.DistanceFromTarget = s.calculateProgress(alert, currentRate)
				}
			}

			alerts = append(alerts, alertWithProgress)
		}
	}

	return alerts, nil
}

func (s *RateAlertService) calculateProgress(alert *RateAlert, currentRate float64) (int, float64) {
	var progressPercentage int
	var distanceFromTarget float64

	switch alert.Condition {
	case ConditionAbove:
		progressPercentage = int(math.Min(100, (currentRate/alert.TargetRate)*100))
		distanceFromTarget = alert.TargetRate - currentRate
	case ConditionBelow:
		progressPercentage = int(math.Min(100, (alert.TargetRate/currentRate)*100))
		distanceFromTarget = currentRate - alert.TargetRate
	case ConditionExact:
		diff := math.Abs(currentRate - alert.TargetRate)
		progressPercentage = int(math.Max(0, 100-(diff/alert.TargetRate)*100))
		distanceFromTarget = currentRate - alert.TargetRate
	}

	return progressPercentage, distanceFromTarget
}

func (s *RateAlertService) UpdateRateAlert(alertID, userID int64, targetRate *float64, condition *AlertCondition, notifyEmail, notifySMS, notifyPush *bool, expiresAt *time.Time) (*RateAlert, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	alert, exists := s.alerts[alertID]
	if !exists || alert.UserID != userID {
		return nil, fmt.Errorf("alert not found")
	}

	if targetRate != nil {
		alert.TargetRate = *targetRate
	}
	if condition != nil {
		alert.Condition = *condition
	}
	if notifyEmail != nil {
		alert.NotifyEmail = *notifyEmail
	}
	if notifySMS != nil {
		alert.NotifySMS = *notifySMS
	}
	if notifyPush != nil {
		alert.NotifyPush = *notifyPush
	}
	if expiresAt != nil {
		alert.ExpiresAt = expiresAt
	}

	alert.UpdatedAt = time.Now()

	return alert, nil
}

func (s *RateAlertService) DeleteRateAlert(alertID, userID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	alert, exists := s.alerts[alertID]
	if !exists || alert.UserID != userID {
		return fmt.Errorf("alert not found")
	}

	alert.IsActive = false
	alert.Status = StatusCancelled
	alert.UpdatedAt = time.Now()

	return nil
}

func (s *RateAlertService) GetRateAlertHistory(userID int64, limit int) ([]*RateAlertHistory, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var userHistory []*RateAlertHistory
	for _, h := range s.history {
		if h.UserID == userID {
			userHistory = append(userHistory, h)
		}
	}

	if limit > 0 && len(userHistory) > limit {
		return userHistory[:limit], nil
	}

	return userHistory, nil
}

func (s *RateAlertService) CheckAndTriggerAlerts() (checked, triggered int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	for _, alert := range s.alerts {
		if !alert.IsActive || alert.Status != StatusActive {
			continue
		}

		if alert.ExpiresAt != nil && now.After(*alert.ExpiresAt) {
			alert.Status = StatusExpired
			alert.IsActive = false
			alert.UpdatedAt = now
			continue
		}

		checked++

		if s.rateProvider == nil {
			continue
		}

		currentRate, err := s.rateProvider.GetExchangeRate(alert.FromCurrency, alert.ToCurrency, 1)
		if err != nil {
			continue
		}

		shouldTrigger := false
		switch alert.Condition {
		case ConditionAbove:
			shouldTrigger = currentRate >= alert.TargetRate
		case ConditionBelow:
			shouldTrigger = currentRate <= alert.TargetRate
		case ConditionExact:
			tolerance := alert.TargetRate * 0.005
			shouldTrigger = math.Abs(currentRate-alert.TargetRate) <= tolerance
		}

		if shouldTrigger {
			s.triggerAlert(alert, currentRate)
			triggered++
		}
	}

	return checked, triggered
}

func (s *RateAlertService) triggerAlert(alert *RateAlert, triggeredRate float64) {
	now := time.Now()
	var notificationsSent []string

	if alert.NotifyEmail && s.notifier != nil {
		subject := fmt.Sprintf("Rate Alert: %s/%s %s %f", alert.FromCurrency, alert.ToCurrency, alert.Condition, alert.TargetRate)
		body := fmt.Sprintf("Your rate alert has been triggered. %s/%s is now %f.", alert.FromCurrency, alert.ToCurrency, triggeredRate)
		if err := s.notifier.SendEmail(alert.NotificationEmail, subject, body); err == nil {
			notificationsSent = append(notificationsSent, "email")
		}
	}

	if alert.NotifySMS && s.notifier != nil {
		message := fmt.Sprintf("Rate Alert: %s/%s is now %f. Your target of %f has been reached!", alert.FromCurrency, alert.ToCurrency, triggeredRate, alert.TargetRate)
		if err := s.notifier.SendSMS(alert.NotificationPhone, message); err == nil {
			notificationsSent = append(notificationsSent, "sms")
		}
	}

	if alert.NotifyPush && s.notifier != nil {
		title := "Rate Alert Triggered!"
		body := fmt.Sprintf("%s/%s is now %f", alert.FromCurrency, alert.ToCurrency, triggeredRate)
		if err := s.notifier.SendPush(alert.UserID, title, body); err == nil {
			notificationsSent = append(notificationsSent, "push")
		}
	}

	alert.Status = StatusTriggered
	alert.IsActive = false
	alert.TriggeredAt = &now
	alert.TriggeredRate = triggeredRate
	alert.UpdatedAt = now

	historyEntry := &RateAlertHistory{
		ID:                 int64(len(s.history) + 1),
		AlertID:            alert.ID,
		UserID:             alert.UserID,
		FromCurrency:       alert.FromCurrency,
		ToCurrency:         alert.ToCurrency,
		TargetRate:         alert.TargetRate,
		TriggeredRate:      triggeredRate,
		Condition:          alert.Condition,
		NotificationsSent:  notificationsSent,
		NotificationStatus: "sent",
		TriggeredAt:        now,
	}

	s.history = append(s.history, historyEntry)
}

func (s *RateAlertService) GetRateAlertAnalytics(userID int64) (*RateAlertAnalytics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	analytics := &RateAlertAnalytics{
		ConditionCounts:  make(map[string]int),
		TopCurrencyPairs: make([]CurrencyPairCount, 0),
		TopTargetRates:   make([]TargetRateCount, 0),
	}

	pairCounts := make(map[string]int)
	var totalTriggerTime float64
	var triggerCount int

	for _, alert := range s.alerts {
		if alert.UserID != userID {
			continue
		}

		analytics.TotalAlerts++

		switch alert.Status {
		case StatusActive:
			analytics.ActiveAlerts++
		case StatusTriggered:
			analytics.TriggeredAlerts++
			if alert.TriggeredAt != nil {
				triggerTime := alert.TriggeredAt.Sub(alert.CreatedAt).Hours()
				totalTriggerTime += triggerTime
				triggerCount++
			}
		case StatusExpired:
			analytics.ExpiredAlerts++
		case StatusCancelled:
			analytics.CancelledAlerts++
		}

		analytics.ConditionCounts[string(alert.Condition)]++

		pair := fmt.Sprintf("%s/%s", alert.FromCurrency, alert.ToCurrency)
		pairCounts[pair]++
	}

	if triggerCount > 0 {
		analytics.AvgTimeToTrigger = totalTriggerTime / float64(triggerCount)
	}

	for pair, count := range pairCounts {
		analytics.TopCurrencyPairs = append(analytics.TopCurrencyPairs, CurrencyPairCount{
			Pair:  pair,
			Count: count,
		})
	}

	return analytics, nil
}

func (s *RateAlertService) GetAlert(alertID int64) (*RateAlert, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	alert, exists := s.alerts[alertID]
	if !exists {
		return nil, fmt.Errorf("alert not found")
	}
	return alert, nil
}

func (s *RateAlertService) GetActiveAlertsCount(userID int64) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, alert := range s.alerts {
		if alert.UserID == userID && alert.IsActive && alert.Status == StatusActive {
			count++
		}
	}
	return count
}
