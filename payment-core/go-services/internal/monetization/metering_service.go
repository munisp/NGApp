package monetization

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"sync"
	"time"
)

type UsageEventType string

const (
	EventAPICall           UsageEventType = "api_call"
	EventPayoutBank        UsageEventType = "payout_bank"
	EventPayoutMobileMoney UsageEventType = "payout_mobile_money"
	EventPayoutAgent       UsageEventType = "payout_agent"
	EventBillPayment       UsageEventType = "bill_payment"
	EventKYCVerification   UsageEventType = "kyc_verification"
	EventRateQuote         UsageEventType = "rate_quote"
	EventRateLock          UsageEventType = "rate_lock"
	EventCryptoReceive     UsageEventType = "crypto_receive"
	EventCryptoSend        UsageEventType = "crypto_send"
	EventWebhookDelivery   UsageEventType = "webhook_delivery"
	EventReportGeneration  UsageEventType = "report_generation"
	EventDataExport        UsageEventType = "data_export"
)

type UsageOutcome string

const (
	OutcomeSuccess UsageOutcome = "success"
	OutcomeFailed  UsageOutcome = "failed"
	OutcomePending UsageOutcome = "pending"
)

type UsageEvent struct {
	ID             string                 `json:"id"`
	OrganizationID string                 `json:"organizationId"`
	Environment    Environment            `json:"environment"`
	EventType      UsageEventType         `json:"eventType"`
	Outcome        UsageOutcome           `json:"outcome"`
	RequestID      string                 `json:"requestId"`
	CorrelationID  string                 `json:"correlationId,omitempty"`
	Amount         float64                `json:"amount,omitempty"`
	Currency       string                 `json:"currency,omitempty"`
	Corridor       string                 `json:"corridor,omitempty"`
	Provider       string                 `json:"provider,omitempty"`
	LatencyMs      int64                  `json:"latencyMs,omitempty"`
	BytesIn        int64                  `json:"bytesIn,omitempty"`
	BytesOut       int64                  `json:"bytesOut,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type UsageAggregate struct {
	OrganizationID string         `json:"organizationId"`
	Period         string         `json:"period"`
	StartDate      time.Time      `json:"startDate"`
	EndDate        time.Time      `json:"endDate"`
	EventType      UsageEventType `json:"eventType"`
	TotalCount     int64          `json:"totalCount"`
	SuccessCount   int64          `json:"successCount"`
	FailedCount    int64          `json:"failedCount"`
	TotalAmount    float64        `json:"totalAmount"`
	TotalLatencyMs int64          `json:"totalLatencyMs"`
	AvgLatencyMs   float64        `json:"avgLatencyMs"`
	TotalBytesIn   int64          `json:"totalBytesIn"`
	TotalBytesOut  int64          `json:"totalBytesOut"`
}

type BillingLineItem struct {
	Description   string         `json:"description"`
	EventType     UsageEventType `json:"eventType"`
	Quantity      int64          `json:"quantity"`
	UnitPrice     float64        `json:"unitPrice"`
	Amount        float64        `json:"amount"`
	IncludedUnits int64          `json:"includedUnits"`
	BillableUnits int64          `json:"billableUnits"`
}

type Invoice struct {
	ID             string            `json:"id"`
	OrganizationID string            `json:"organizationId"`
	PlanID         string            `json:"planId"`
	PeriodStart    time.Time         `json:"periodStart"`
	PeriodEnd      time.Time         `json:"periodEnd"`
	PlatformFee    float64           `json:"platformFee"`
	UsageCharges   float64           `json:"usageCharges"`
	TotalAmount    float64           `json:"totalAmount"`
	Currency       string            `json:"currency"`
	Status         string            `json:"status"`
	LineItems      []BillingLineItem `json:"lineItems"`
	CreatedAt      time.Time         `json:"createdAt"`
	DueDate        time.Time         `json:"dueDate"`
	PaidAt         *time.Time        `json:"paidAt,omitempty"`
}

type QuotaStatus struct {
	OrganizationID    string    `json:"organizationId"`
	PlanID            string    `json:"planId"`
	Period            string    `json:"period"`
	DailyUsed         float64   `json:"dailyUsed"`
	DailyLimit        float64   `json:"dailyLimit"`
	DailyRemaining    float64   `json:"dailyRemaining"`
	MonthlyUsed       float64   `json:"monthlyUsed"`
	MonthlyLimit      float64   `json:"monthlyLimit"`
	MonthlyRemaining  float64   `json:"monthlyRemaining"`
	TransactionsUsed  int64     `json:"transactionsUsed"`
	TransactionsLimit int64     `json:"transactionsLimit"`
	LastUpdated       time.Time `json:"lastUpdated"`
}

type RateLimitStatus struct {
	OrganizationID     string    `json:"organizationId"`
	RequestsThisSecond int       `json:"requestsThisSecond"`
	RequestsThisMinute int       `json:"requestsThisMinute"`
	RequestsThisHour   int       `json:"requestsThisHour"`
	RequestsToday      int       `json:"requestsToday"`
	LimitPerSecond     int       `json:"limitPerSecond"`
	LimitPerMinute     int       `json:"limitPerMinute"`
	LimitPerHour       int       `json:"limitPerHour"`
	LimitPerDay        int       `json:"limitPerDay"`
	IsLimited          bool      `json:"isLimited"`
	ResetAt            time.Time `json:"resetAt"`
}

type EventPricing struct {
	EventType      UsageEventType `json:"eventType"`
	BaseFee        float64        `json:"baseFee"`
	PercentageFee  float64        `json:"percentageFee"`
	MinFee         float64        `json:"minFee"`
	MaxFee         float64        `json:"maxFee"`
	IncludedInPlan bool           `json:"includedInPlan"`
}

type MeteringService struct {
	mu             sync.RWMutex
	events         []*UsageEvent
	aggregates     map[string]*UsageAggregate
	invoices       map[string]*Invoice
	quotaTracking  map[string]*QuotaStatus
	rateLimitState map[string]*rateLimitWindow
	eventPricing   map[UsageEventType]*EventPricing
	tokenService   *APITokenService
}

type rateLimitWindow struct {
	secondCount int
	minuteCount int
	hourCount   int
	dayCount    int
	secondReset time.Time
	minuteReset time.Time
	hourReset   time.Time
	dayReset    time.Time
}

func NewMeteringService(tokenService *APITokenService) *MeteringService {
	s := &MeteringService{
		events:         make([]*UsageEvent, 0),
		aggregates:     make(map[string]*UsageAggregate),
		invoices:       make(map[string]*Invoice),
		quotaTracking:  make(map[string]*QuotaStatus),
		rateLimitState: make(map[string]*rateLimitWindow),
		eventPricing:   make(map[UsageEventType]*EventPricing),
		tokenService:   tokenService,
	}
	s.initializeDefaultPricing()
	return s
}

func (s *MeteringService) initializeDefaultPricing() {
	s.eventPricing[EventAPICall] = &EventPricing{
		EventType:      EventAPICall,
		BaseFee:        0,
		PercentageFee:  0,
		IncludedInPlan: true,
	}
	s.eventPricing[EventPayoutBank] = &EventPricing{
		EventType:      EventPayoutBank,
		BaseFee:        25,
		PercentageFee:  0.001,
		MinFee:         25,
		MaxFee:         5000,
		IncludedInPlan: false,
	}
	s.eventPricing[EventPayoutMobileMoney] = &EventPricing{
		EventType:      EventPayoutMobileMoney,
		BaseFee:        15,
		PercentageFee:  0.0015,
		MinFee:         15,
		MaxFee:         3000,
		IncludedInPlan: false,
	}
	s.eventPricing[EventPayoutAgent] = &EventPricing{
		EventType:      EventPayoutAgent,
		BaseFee:        50,
		PercentageFee:  0.002,
		MinFee:         50,
		MaxFee:         10000,
		IncludedInPlan: false,
	}
	s.eventPricing[EventBillPayment] = &EventPricing{
		EventType:      EventBillPayment,
		BaseFee:        10,
		PercentageFee:  0,
		MinFee:         10,
		MaxFee:         100,
		IncludedInPlan: false,
	}
	s.eventPricing[EventKYCVerification] = &EventPricing{
		EventType:      EventKYCVerification,
		BaseFee:        100,
		PercentageFee:  0,
		MinFee:         100,
		MaxFee:         100,
		IncludedInPlan: false,
	}
	s.eventPricing[EventRateQuote] = &EventPricing{
		EventType:      EventRateQuote,
		BaseFee:        0,
		PercentageFee:  0,
		IncludedInPlan: true,
	}
	s.eventPricing[EventRateLock] = &EventPricing{
		EventType:      EventRateLock,
		BaseFee:        50,
		PercentageFee:  0,
		MinFee:         50,
		MaxFee:         50,
		IncludedInPlan: false,
	}
	s.eventPricing[EventCryptoReceive] = &EventPricing{
		EventType:      EventCryptoReceive,
		BaseFee:        0,
		PercentageFee:  0.01,
		MinFee:         100,
		MaxFee:         50000,
		IncludedInPlan: false,
	}
	s.eventPricing[EventCryptoSend] = &EventPricing{
		EventType:      EventCryptoSend,
		BaseFee:        0,
		PercentageFee:  0.005,
		MinFee:         50,
		MaxFee:         25000,
		IncludedInPlan: false,
	}
	s.eventPricing[EventWebhookDelivery] = &EventPricing{
		EventType:      EventWebhookDelivery,
		BaseFee:        0.10,
		PercentageFee:  0,
		MinFee:         0.10,
		MaxFee:         0.10,
		IncludedInPlan: true,
	}
	s.eventPricing[EventReportGeneration] = &EventPricing{
		EventType:      EventReportGeneration,
		BaseFee:        10,
		PercentageFee:  0,
		MinFee:         10,
		MaxFee:         10,
		IncludedInPlan: false,
	}
	s.eventPricing[EventDataExport] = &EventPricing{
		EventType:      EventDataExport,
		BaseFee:        50,
		PercentageFee:  0,
		MinFee:         50,
		MaxFee:         50,
		IncludedInPlan: false,
	}
}

func (s *MeteringService) RecordEvent(event *UsageEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if event.ID == "" {
		event.ID = s.generateID("evt")
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	s.events = append(s.events, event)

	if len(s.events) > 1000000 {
		s.events = s.events[100000:]
	}

	s.updateAggregates(event)
	s.updateQuota(event)

	return nil
}

func (s *MeteringService) updateAggregates(event *UsageEvent) {
	now := event.Timestamp
	dayKey := fmt.Sprintf("%s:%s:%s", event.OrganizationID, event.EventType, now.Format("2006-01-02"))

	agg, exists := s.aggregates[dayKey]
	if !exists {
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		agg = &UsageAggregate{
			OrganizationID: event.OrganizationID,
			Period:         "daily",
			StartDate:      startOfDay,
			EndDate:        startOfDay.Add(24 * time.Hour),
			EventType:      event.EventType,
		}
		s.aggregates[dayKey] = agg
	}

	agg.TotalCount++
	if event.Outcome == OutcomeSuccess {
		agg.SuccessCount++
	} else if event.Outcome == OutcomeFailed {
		agg.FailedCount++
	}
	agg.TotalAmount += event.Amount
	agg.TotalLatencyMs += event.LatencyMs
	if agg.TotalCount > 0 {
		agg.AvgLatencyMs = float64(agg.TotalLatencyMs) / float64(agg.TotalCount)
	}
	agg.TotalBytesIn += event.BytesIn
	agg.TotalBytesOut += event.BytesOut
}

func (s *MeteringService) updateQuota(event *UsageEvent) {
	if event.Environment == EnvSandbox {
		return
	}

	quota, exists := s.quotaTracking[event.OrganizationID]
	if !exists {
		org := s.tokenService.GetOrganization(event.OrganizationID)
		if org == nil {
			return
		}
		plan := s.tokenService.GetPlan(org.PlanID)
		if plan == nil {
			return
		}
		quota = &QuotaStatus{
			OrganizationID:    event.OrganizationID,
			PlanID:            org.PlanID,
			Period:            time.Now().Format("2006-01"),
			DailyLimit:        plan.DailyLimit,
			MonthlyLimit:      plan.MonthlyLimit,
			TransactionsLimit: int64(plan.IncludedTxns),
			LastUpdated:       time.Now(),
		}
		s.quotaTracking[event.OrganizationID] = quota
	}

	if event.Outcome == OutcomeSuccess {
		quota.DailyUsed += event.Amount
		quota.MonthlyUsed += event.Amount
		quota.TransactionsUsed++
		quota.DailyRemaining = quota.DailyLimit - quota.DailyUsed
		quota.MonthlyRemaining = quota.MonthlyLimit - quota.MonthlyUsed
		quota.LastUpdated = time.Now()
	}
}

func (s *MeteringService) CheckRateLimit(orgID string, limits *RateLimitConfig) *RateLimitStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	window, exists := s.rateLimitState[orgID]
	if !exists {
		window = &rateLimitWindow{
			secondReset: now.Add(time.Second),
			minuteReset: now.Add(time.Minute),
			hourReset:   now.Add(time.Hour),
			dayReset:    now.Add(24 * time.Hour),
		}
		s.rateLimitState[orgID] = window
	}

	if now.After(window.secondReset) {
		window.secondCount = 0
		window.secondReset = now.Add(time.Second)
	}
	if now.After(window.minuteReset) {
		window.minuteCount = 0
		window.minuteReset = now.Add(time.Minute)
	}
	if now.After(window.hourReset) {
		window.hourCount = 0
		window.hourReset = now.Add(time.Hour)
	}
	if now.After(window.dayReset) {
		window.dayCount = 0
		window.dayReset = now.Add(24 * time.Hour)
	}

	isLimited := window.secondCount >= limits.RequestsPerSecond ||
		window.minuteCount >= limits.RequestsPerMinute ||
		window.hourCount >= limits.RequestsPerHour ||
		window.dayCount >= limits.RequestsPerDay

	if !isLimited {
		window.secondCount++
		window.minuteCount++
		window.hourCount++
		window.dayCount++
	}

	return &RateLimitStatus{
		OrganizationID:     orgID,
		RequestsThisSecond: window.secondCount,
		RequestsThisMinute: window.minuteCount,
		RequestsThisHour:   window.hourCount,
		RequestsToday:      window.dayCount,
		LimitPerSecond:     limits.RequestsPerSecond,
		LimitPerMinute:     limits.RequestsPerMinute,
		LimitPerHour:       limits.RequestsPerHour,
		LimitPerDay:        limits.RequestsPerDay,
		IsLimited:          isLimited,
		ResetAt:            window.secondReset,
	}
}

func (s *MeteringService) CheckQuota(orgID string) (*QuotaStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	quota, exists := s.quotaTracking[orgID]
	if !exists {
		org := s.tokenService.GetOrganization(orgID)
		if org == nil {
			return nil, fmt.Errorf("organization not found: %s", orgID)
		}
		plan := s.tokenService.GetPlan(org.PlanID)
		if plan == nil {
			return nil, fmt.Errorf("plan not found for organization")
		}
		return &QuotaStatus{
			OrganizationID:    orgID,
			PlanID:            org.PlanID,
			Period:            time.Now().Format("2006-01"),
			DailyLimit:        plan.DailyLimit,
			MonthlyLimit:      plan.MonthlyLimit,
			DailyRemaining:    plan.DailyLimit,
			MonthlyRemaining:  plan.MonthlyLimit,
			TransactionsLimit: int64(plan.IncludedTxns),
			LastUpdated:       time.Now(),
		}, nil
	}
	return quota, nil
}

func (s *MeteringService) GetUsageAggregates(orgID string, startDate, endDate time.Time) []*UsageAggregate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*UsageAggregate
	for _, agg := range s.aggregates {
		if agg.OrganizationID == orgID &&
			!agg.StartDate.Before(startDate) &&
			!agg.EndDate.After(endDate) {
			results = append(results, agg)
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].StartDate.Before(results[j].StartDate)
	})

	return results
}

func (s *MeteringService) GenerateInvoice(orgID string, periodStart, periodEnd time.Time) (*Invoice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	org := s.tokenService.GetOrganization(orgID)
	if org == nil {
		return nil, fmt.Errorf("organization not found: %s", orgID)
	}

	plan := s.tokenService.GetPlan(org.PlanID)
	if plan == nil {
		return nil, fmt.Errorf("plan not found for organization")
	}

	aggregates := make(map[UsageEventType]*UsageAggregate)
	for _, agg := range s.aggregates {
		if agg.OrganizationID == orgID &&
			!agg.StartDate.Before(periodStart) &&
			agg.EndDate.Before(periodEnd.Add(24*time.Hour)) {
			existing, exists := aggregates[agg.EventType]
			if !exists {
				aggregates[agg.EventType] = &UsageAggregate{
					OrganizationID: orgID,
					EventType:      agg.EventType,
					StartDate:      periodStart,
					EndDate:        periodEnd,
				}
				existing = aggregates[agg.EventType]
			}
			existing.TotalCount += agg.TotalCount
			existing.SuccessCount += agg.SuccessCount
			existing.FailedCount += agg.FailedCount
			existing.TotalAmount += agg.TotalAmount
		}
	}

	var lineItems []BillingLineItem
	var usageCharges float64

	for eventType, agg := range aggregates {
		pricing := s.eventPricing[eventType]
		if pricing == nil || pricing.IncludedInPlan {
			continue
		}

		var fee float64
		if pricing.PercentageFee > 0 {
			fee = agg.TotalAmount * pricing.PercentageFee
		} else {
			fee = float64(agg.SuccessCount) * pricing.BaseFee
		}

		if fee < pricing.MinFee*float64(agg.SuccessCount) {
			fee = pricing.MinFee * float64(agg.SuccessCount)
		}
		if pricing.MaxFee > 0 && fee > pricing.MaxFee*float64(agg.SuccessCount) {
			fee = pricing.MaxFee * float64(agg.SuccessCount)
		}

		lineItems = append(lineItems, BillingLineItem{
			Description:   fmt.Sprintf("%s transactions", eventType),
			EventType:     eventType,
			Quantity:      agg.SuccessCount,
			UnitPrice:     pricing.BaseFee,
			Amount:        fee,
			IncludedUnits: 0,
			BillableUnits: agg.SuccessCount,
		})

		usageCharges += fee
	}

	invoice := &Invoice{
		ID:             s.generateID("inv"),
		OrganizationID: orgID,
		PlanID:         org.PlanID,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		PlatformFee:    plan.MonthlyFee,
		UsageCharges:   usageCharges,
		TotalAmount:    plan.MonthlyFee + usageCharges,
		Currency:       "NGN",
		Status:         "pending",
		LineItems:      lineItems,
		CreatedAt:      time.Now(),
		DueDate:        periodEnd.Add(15 * 24 * time.Hour),
	}

	s.invoices[invoice.ID] = invoice
	return invoice, nil
}

func (s *MeteringService) GetInvoice(invoiceID string) *Invoice {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.invoices[invoiceID]
}

func (s *MeteringService) ListInvoices(orgID string) []*Invoice {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var invoices []*Invoice
	for _, inv := range s.invoices {
		if inv.OrganizationID == orgID {
			invoices = append(invoices, inv)
		}
	}

	sort.Slice(invoices, func(i, j int) bool {
		return invoices[i].PeriodStart.After(invoices[j].PeriodStart)
	})

	return invoices
}

func (s *MeteringService) MarkInvoicePaid(invoiceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	invoice, exists := s.invoices[invoiceID]
	if !exists {
		return fmt.Errorf("invoice not found: %s", invoiceID)
	}

	invoice.Status = "paid"
	now := time.Now()
	invoice.PaidAt = &now
	return nil
}

func (s *MeteringService) GetRecentEvents(orgID string, limit int) []*UsageEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var events []*UsageEvent
	for i := len(s.events) - 1; i >= 0 && len(events) < limit; i-- {
		if s.events[i].OrganizationID == orgID {
			events = append(events, s.events[i])
		}
	}
	return events
}

func (s *MeteringService) CalculateFee(eventType UsageEventType, amount float64) float64 {
	pricing := s.eventPricing[eventType]
	if pricing == nil {
		return 0
	}

	var fee float64
	if pricing.PercentageFee > 0 {
		fee = amount * pricing.PercentageFee
	} else {
		fee = pricing.BaseFee
	}

	if fee < pricing.MinFee {
		fee = pricing.MinFee
	}
	if pricing.MaxFee > 0 && fee > pricing.MaxFee {
		fee = pricing.MaxFee
	}

	return fee
}

func (s *MeteringService) generateID(prefix string) string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(bytes))
}
