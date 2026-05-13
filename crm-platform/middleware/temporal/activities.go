package temporal

import (
	"context"
	"fmt"
	"time"
)

// Data types for workflow I/O
type ValidationResult struct {
	Valid   bool
	Errors  []string
}

type KYCResult struct {
	Status    string // approved, pending, rejected
	RiskLevel string
	CheckedAt time.Time
}

type CampaignInput struct {
	TenantID   string
	CampaignID string
	Channels   []string // email, sms, whatsapp, push
	AudienceID string
}

type TradeInput struct {
	TenantID     string
	TradeID      string
	Commodity    string
	Quantity     float64
	Price        float64
	BuyerID      string
	SellerID     string
}

// Activities — each runs as an independent unit of work

func ValidateCustomerActivity(ctx context.Context, input CustomerOnboardingInput) (ValidationResult, error) {
	result := ValidationResult{Valid: true}
	if input.Email == "" && input.Phone == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "email or phone required")
	}
	if input.FullName == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "full name required")
	}
	return result, nil
}

func RunKYCCheckActivity(ctx context.Context, input CustomerOnboardingInput) (KYCResult, error) {
	// In production: call Permify for authorization, external KYC provider
	return KYCResult{
		Status:    "approved",
		RiskLevel: "low",
		CheckedAt: time.Now(),
	}, nil
}

func CreateCustomerRecordActivity(ctx context.Context, input CustomerOnboardingInput) (string, error) {
	// In production: call CRM core service via Dapr/direct
	return fmt.Sprintf("cust_%s_%d", input.TenantID, time.Now().UnixMilli()), nil
}

func SendWelcomeNotificationActivity(ctx context.Context, input CustomerOnboardingInput) error {
	// In production: call notification service
	return nil
}

func EmitOnboardingEventActivity(ctx context.Context, input CustomerOnboardingInput) error {
	// In production: publish to Kafka topic
	return nil
}

func ResolveAudienceActivity(ctx context.Context, input CampaignInput) ([]string, error) {
	return []string{"cust_001", "cust_002", "cust_003"}, nil
}

func GenerateContentActivity(ctx context.Context, input CampaignInput, audience []string) (map[string]string, error) {
	contents := make(map[string]string)
	for _, ch := range input.Channels {
		contents[ch] = fmt.Sprintf("Campaign %s content for %s", input.CampaignID, ch)
	}
	return contents, nil
}

func SendChannelMessageActivity(ctx context.Context, channel, content string, audience []string) error {
	return nil
}

func RecordCampaignAnalyticsActivity(ctx context.Context, input CampaignInput) error {
	return nil
}

func ValidateTradeActivity(ctx context.Context, input TradeInput) error { return nil }
func MatchTradeActivity(ctx context.Context, input TradeInput) error { return nil }
func ClearTradeActivity(ctx context.Context, input TradeInput) error { return nil }
func SettleTradeActivity(ctx context.Context, input TradeInput) error { return nil }
func ConfirmSettlementActivity(ctx context.Context, input TradeInput) error { return nil }
