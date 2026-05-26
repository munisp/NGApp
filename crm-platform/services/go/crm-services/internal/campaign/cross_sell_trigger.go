package campaign

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CrossSellOpportunity represents a detected cross-sell opportunity
type CrossSellOpportunity struct {
	CustomerID       string  `json:"customer_id"`
	CustomerName     string  `json:"customer_name"`
	SourceSystem     string  `json:"source_system"` // core_banking, agent_banking, remittance
	CurrentProducts  []string `json:"current_products"`
	RecommendedProduct string `json:"recommended_product"`
	Confidence       float64 `json:"confidence"`
	EstimatedRevenue float64 `json:"estimated_revenue"`
	PreferredChannel string  `json:"preferred_channel"`
	Region           string  `json:"region"`
	Segment          string  `json:"segment"`
}

// CrossSellTriggerService monitors cross-sell opportunities and auto-creates campaigns
type CrossSellTriggerService struct {
	db              *gorm.DB
	redisClient     *redis.Client
	logger          *zap.SugaredLogger
	campaignService *CampaignService
}

// NewCrossSellTriggerService creates a new cross-sell trigger service
func NewCrossSellTriggerService(
	db *gorm.DB,
	redisClient *redis.Client,
	logger *zap.SugaredLogger,
	campaignService *CampaignService,
) *CrossSellTriggerService {
	return &CrossSellTriggerService{
		db:              db,
		redisClient:     redisClient,
		logger:          logger,
		campaignService: campaignService,
	}
}

// EvaluateAndTrigger scans for cross-sell opportunities and creates campaigns
func (s *CrossSellTriggerService) EvaluateAndTrigger(ctx context.Context) (int, error) {
	opportunities, err := s.detectOpportunities(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to detect opportunities: %w", err)
	}

	if len(opportunities) == 0 {
		s.logger.Info("No cross-sell opportunities detected")
		return 0, nil
	}

	// Group opportunities by recommended product + source system
	groups := s.groupOpportunities(opportunities)
	campaignsCreated := 0

	for key, group := range groups {
		if len(group) < 10 {
			s.logger.Debugf("Skipping group %s: only %d customers (minimum 10)", key, len(group))
			continue
		}

		campaign, err := s.createCampaignFromOpportunities(ctx, group)
		if err != nil {
			s.logger.Errorf("Failed to create campaign for group %s: %v", key, err)
			continue
		}

		s.logger.Infof("Created cross-sell campaign: %s (%s) with %d recipients",
			campaign.Name, campaign.ID, len(group))
		campaignsCreated++
	}

	return campaignsCreated, nil
}

// detectOpportunities queries the unified customer database for cross-sell potential
func (s *CrossSellTriggerService) detectOpportunities(ctx context.Context) ([]CrossSellOpportunity, error) {
	var opportunities []CrossSellOpportunity

	// Agent banking customers without savings accounts
	var agentCustomers []struct {
		ID       string  `gorm:"column:id"`
		Name     string  `gorm:"column:name"`
		Phone    string  `gorm:"column:phone"`
		Region   string  `gorm:"column:region"`
		Segment  string  `gorm:"column:segment"`
		Balance  float64 `gorm:"column:balance"`
	}

	s.db.Table("customers").
		Where("source = ? AND id NOT IN (SELECT customer_id FROM customer_products WHERE product_type = ?)",
			"agent_banking", "savings_account").
		Where("balance > ?", 50000).
		Find(&agentCustomers)

	for _, c := range agentCustomers {
		confidence := 0.65
		if c.Balance > 200000 {
			confidence = 0.82
		}
		opportunities = append(opportunities, CrossSellOpportunity{
			CustomerID:         c.ID,
			CustomerName:       c.Name,
			SourceSystem:       "agent_banking",
			CurrentProducts:    []string{"mobile_wallet"},
			RecommendedProduct: "savings_account",
			Confidence:         confidence,
			EstimatedRevenue:   15000,
			PreferredChannel:   "sms",
			Region:             c.Region,
			Segment:            c.Segment,
		})
	}

	// Remittance customers without FX accounts
	var remitCustomers []struct {
		ID             string  `gorm:"column:id"`
		Name           string  `gorm:"column:name"`
		TransferCount  int     `gorm:"column:transfer_count"`
		TotalVolume    float64 `gorm:"column:total_volume"`
		Region         string  `gorm:"column:region"`
		Segment        string  `gorm:"column:segment"`
	}

	s.db.Table("customers").
		Where("source = ? AND id NOT IN (SELECT customer_id FROM customer_products WHERE product_type = ?)",
			"remittance", "forex_account").
		Where("transfer_count >= ?", 3).
		Find(&remitCustomers)

	for _, c := range remitCustomers {
		confidence := 0.55
		if c.TransferCount >= 5 {
			confidence = 0.78
		}
		if c.TotalVolume > 5000000 {
			confidence += 0.1
		}
		if confidence > 0.95 {
			confidence = 0.95
		}
		opportunities = append(opportunities, CrossSellOpportunity{
			CustomerID:         c.ID,
			CustomerName:       c.Name,
			SourceSystem:       "remittance",
			CurrentProducts:    []string{"remittance"},
			RecommendedProduct: "forex_account",
			Confidence:         confidence,
			EstimatedRevenue:   20000,
			PreferredChannel:   "whatsapp",
			Region:             c.Region,
			Segment:            c.Segment,
		})
	}

	// Core banking premium customers without insurance
	var premiumCustomers []struct {
		ID      string  `gorm:"column:id"`
		Name    string  `gorm:"column:name"`
		Balance float64 `gorm:"column:balance"`
		Region  string  `gorm:"column:region"`
		Segment string  `gorm:"column:segment"`
	}

	s.db.Table("customers").
		Where("source = ? AND segment = ? AND id NOT IN (SELECT customer_id FROM customer_products WHERE product_type = ?)",
			"core_banking", "premium", "insurance").
		Where("balance > ?", 1000000).
		Find(&premiumCustomers)

	for _, c := range premiumCustomers {
		confidence := 0.70
		if c.Balance > 5000000 {
			confidence = 0.85
		}
		opportunities = append(opportunities, CrossSellOpportunity{
			CustomerID:         c.ID,
			CustomerName:       c.Name,
			SourceSystem:       "core_banking",
			CurrentProducts:    []string{"savings_account", "current_account"},
			RecommendedProduct: "insurance",
			Confidence:         confidence,
			EstimatedRevenue:   8000,
			PreferredChannel:   "whatsapp",
			Region:             c.Region,
			Segment:            c.Segment,
		})
	}

	s.logger.Infof("Detected %d cross-sell opportunities", len(opportunities))
	return opportunities, nil
}

// groupOpportunities groups by product + source for campaign creation
func (s *CrossSellTriggerService) groupOpportunities(opportunities []CrossSellOpportunity) map[string][]CrossSellOpportunity {
	groups := make(map[string][]CrossSellOpportunity)
	for _, opp := range opportunities {
		key := fmt.Sprintf("%s:%s", opp.SourceSystem, opp.RecommendedProduct)
		groups[key] = append(groups[key], opp)
	}
	return groups
}

// createCampaignFromOpportunities builds a campaign for a group of opportunities
func (s *CrossSellTriggerService) createCampaignFromOpportunities(
	ctx context.Context,
	opportunities []CrossSellOpportunity,
) (*Campaign, error) {
	if len(opportunities) == 0 {
		return nil, fmt.Errorf("no opportunities provided")
	}

	first := opportunities[0]

	// Determine channels based on preferred channels in opportunities
	channelCounts := make(map[string]int)
	for _, opp := range opportunities {
		channelCounts[opp.PreferredChannel]++
	}
	var channels []ChannelType
	for ch := range channelCounts {
		channels = append(channels, ChannelType(ch))
	}

	channelsJSON, _ := json.Marshal(channels)

	// Build audience filter
	customerIDs := make([]string, len(opportunities))
	for i, opp := range opportunities {
		customerIDs[i] = opp.CustomerID
	}
	filter := SegmentFilter{
		Sources: []string{first.SourceSystem},
	}
	filterJSON, _ := json.Marshal(filter)

	// Calculate estimated revenue
	totalRevenue := 0.0
	avgConfidence := 0.0
	for _, opp := range opportunities {
		totalRevenue += opp.EstimatedRevenue * opp.Confidence
		avgConfidence += opp.Confidence
	}
	avgConfidence /= float64(len(opportunities))

	campaignName := fmt.Sprintf("Auto: %s → %s (%d customers)",
		formatSource(first.SourceSystem),
		formatProduct(first.RecommendedProduct),
		len(opportunities))

	template := s.generateMessageTemplate(first.RecommendedProduct)

	campaign := &Campaign{
		ID:              uuid.New().String(),
		Name:            campaignName,
		Description:     fmt.Sprintf("Auto-generated cross-sell campaign targeting %d %s customers for %s. Average confidence: %.0f%%", len(opportunities), first.SourceSystem, first.RecommendedProduct, avgConfidence*100),
		Type:            CampaignTypeCrossSell,
		Status:          CampaignStatusDraft,
		Channels:        string(channelsJSON),
		TargetAudience:  string(filterJSON),
		MessageTemplate: template,
		Budget:          float64(len(opportunities)) * 50, // ₦50 per message estimate
		Priority:        5,
		RateLimit:       100,
		CreatedBy:       "cross-sell-engine",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	result := s.db.Create(campaign)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create campaign: %w", result.Error)
	}

	// Publish event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"type":         "campaign.auto_created",
		"campaign_id":  campaign.ID,
		"campaign_name": campaign.Name,
		"recipients":   len(opportunities),
		"product":      first.RecommendedProduct,
		"source":       first.SourceSystem,
		"avg_confidence": avgConfidence,
		"est_revenue":  totalRevenue,
		"timestamp":    time.Now().Unix(),
	})
	s.redisClient.Publish(ctx, "campaign.events", eventPayload)

	return campaign, nil
}

// generateMessageTemplate creates a channel-appropriate message template
func (s *CrossSellTriggerService) generateMessageTemplate(product string) string {
	templates := map[string]string{
		"savings_account": "Hi {{.CustomerName}}, open a savings account today and earn up to 12% interest on your balance. Zero opening fees for the first month. Reply YES or visit your nearest branch.",
		"forex_account":   "Dear {{.CustomerName}}, get better exchange rates and zero transfer fees for 3 months with our new FX account. Perfect for your regular transfers. Tap to apply.",
		"insurance":       "Dear {{.CustomerName}}, protect your savings with micro-insurance from just ₦500/month. Coverage up to ₦5M. Reply INFO for details.",
		"personal_loan":   "Good news {{.CustomerName}}! You're pre-approved for up to ₦{{.LoanAmount}}. No collateral needed. Low interest rates. Reply APPLY to get started.",
		"mobile_wallet":   "Hi {{.CustomerName}}, upgrade to our mobile wallet for instant transfers, bill payments, and airtime purchases. Download the app today.",
		"investment_fund": "Dear {{.CustomerName}}, grow your wealth with our managed investment fund. Returns up to 18% annually. Minimum investment ₦50,000. Reply INVEST.",
		"business_loan":   "Dear {{.CustomerName}}, expand your business with a loan up to ₦{{.LoanAmount}}. Flexible repayment terms. Reply APPLY to check your eligibility.",
	}

	if tmpl, ok := templates[product]; ok {
		return tmpl
	}
	return "Hi {{.CustomerName}}, we have a special offer just for you. Reply INFO to learn more."
}

func formatSource(source string) string {
	names := map[string]string{
		"core_banking":  "Core Banking",
		"agent_banking": "Agent Banking",
		"remittance":    "Remittance",
	}
	if name, ok := names[source]; ok {
		return name
	}
	return source
}

func formatProduct(product string) string {
	names := map[string]string{
		"savings_account": "Savings Account",
		"forex_account":   "FX Account",
		"insurance":       "Insurance",
		"personal_loan":   "Personal Loan",
		"mobile_wallet":   "Mobile Wallet",
		"investment_fund": "Investment Fund",
		"business_loan":   "Business Loan",
	}
	if name, ok := names[product]; ok {
		return name
	}
	return product
}
