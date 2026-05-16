package service

import (
	"fmt"
	"instant-payout-service/internal/models"
	"instant-payout-service/internal/repository"
	"math"
	"strings"
	"time"
)

type PayoutService struct {
	repo *repository.PayoutRepository
}

func NewPayoutService(repo *repository.PayoutRepository) *PayoutService {
	return &PayoutService{repo: repo}
}

type InitiateRequest struct {
	ClaimID      string  `json:"claim_id"`
	PolicyID     string  `json:"policy_id"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Channel      string  `json:"channel"`
	AccountRef   string  `json:"account_ref"`
	Recipient    string  `json:"recipient_name"`
	Provider     string  `json:"provider,omitempty"`
	Reason       string  `json:"reason"`
}

func (s *PayoutService) InitiatePayout(req InitiateRequest) (*models.Payout, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}
	if req.AccountRef == "" {
		return nil, fmt.Errorf("account_ref is required")
	}
	if req.Recipient == "" {
		return nil, fmt.Errorf("recipient_name is required")
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	channel := models.PayoutChannel(req.Channel)
	if channel == "" {
		channel = models.ChannelBankTransfer
	}

	cfg := s.repo.GetChannelConfig(channel, req.Provider)
	if cfg == nil {
		return nil, fmt.Errorf("channel %s (provider: %s) not available", channel, req.Provider)
	}
	if req.Amount < cfg.MinAmount {
		return nil, fmt.Errorf("amount %.2f below minimum %.2f for %s", req.Amount, cfg.MinAmount, channel)
	}
	if req.Amount > cfg.MaxAmount {
		return nil, fmt.Errorf("amount %.2f exceeds maximum %.2f for %s", req.Amount, cfg.MaxAmount, channel)
	}

	currencyValid := false
	for _, c := range cfg.Currencies {
		if strings.EqualFold(c, req.Currency) {
			currencyValid = true
			break
		}
	}
	if !currencyValid {
		return nil, fmt.Errorf("currency %s not supported for channel %s", req.Currency, channel)
	}

	fee := math.Round((req.Amount*cfg.FeePercent/100+cfg.FeeFlat)*100) / 100
	net := req.Amount - fee

	payout := &models.Payout{
		ID:            fmt.Sprintf("PYT-%d", time.Now().UnixNano()%10000000),
		ClaimID:       req.ClaimID,
		PolicyID:      req.PolicyID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Channel:       channel,
		Status:        models.PayoutProcessing,
		RecipientName: req.Recipient,
		AccountRef:    req.AccountRef,
		Provider:      cfg.Provider,
		Reason:        req.Reason,
		Reference:     fmt.Sprintf("NGA-PYT-%d", time.Now().UnixNano()%10000000),
		FeeAmount:     fee,
		NetAmount:     net,
		EstimatedTime: cfg.EstimatedTime,
		MaxRetries:    3,
		CreatedAt:     time.Now(),
	}

	if err := s.repo.Create(payout); err != nil {
		return nil, err
	}

	go s.processPayoutAsync(payout.ID)

	return payout, nil
}

func (s *PayoutService) processPayoutAsync(payoutID string) {
	time.Sleep(2 * time.Second)
	p, err := s.repo.GetByID(payoutID)
	if err != nil {
		return
	}

	passed := s.runFraudChecks(p)
	if !passed {
		s.repo.UpdateStatus(payoutID, models.PayoutFailed, "Failed fraud/AML screening")
		return
	}

	s.repo.UpdateStatus(payoutID, models.PayoutCompleted,
		fmt.Sprintf("Disbursed %s %.2f to %s via %s/%s", p.Currency, p.NetAmount, p.RecipientName, p.Channel, p.Provider))
}

func (s *PayoutService) runFraudChecks(p *models.Payout) bool {
	if p.Amount > 10000000 {
		return false
	}
	if p.Currency == "NGN" && p.Amount > 5000000 && p.Channel == models.ChannelMobileMoney {
		return false
	}
	return true
}

func (s *PayoutService) GetPayout(id string) (*models.Payout, error) {
	return s.repo.GetByID(id)
}

func (s *PayoutService) ListPayouts(status string, limit int) []models.Payout {
	return s.repo.List(status, limit)
}

func (s *PayoutService) InitiateBatch(requests []InitiateRequest) (*models.BatchPayout, error) {
	if len(requests) == 0 {
		return nil, fmt.Errorf("batch must contain at least one payout")
	}
	if len(requests) > 500 {
		return nil, fmt.Errorf("batch size exceeds maximum of 500")
	}

	batch := &models.BatchPayout{
		ID:        fmt.Sprintf("BATCH-%d", time.Now().UnixNano()%10000000),
		Status:    models.PayoutProcessing,
		CreatedAt: time.Now(),
	}

	for _, req := range requests {
		p, err := s.InitiatePayout(req)
		if err != nil {
			batch.FailCount++
			continue
		}
		p.BatchID = batch.ID
		batch.Payouts = append(batch.Payouts, *p)
		batch.TotalAmount += p.Amount
		batch.SuccessCount++
	}

	if len(requests) > 0 {
		batch.Currency = requests[0].Currency
	}
	if batch.FailCount == len(requests) {
		batch.Status = models.PayoutFailed
	} else {
		batch.Status = models.PayoutCompleted
	}

	s.repo.CreateBatch(batch)
	return batch, nil
}

func (s *PayoutService) GetBatch(id string) (*models.BatchPayout, error) {
	return s.repo.GetBatch(id)
}

func (s *PayoutService) GetChannels() []models.ChannelConfig {
	return s.repo.GetChannels()
}

func (s *PayoutService) GetLedger(payoutID string) []models.PayoutLedgerEntry {
	return s.repo.GetLedger(payoutID)
}

func (s *PayoutService) GetStats() map[string]interface{} {
	return s.repo.GetStats()
}
