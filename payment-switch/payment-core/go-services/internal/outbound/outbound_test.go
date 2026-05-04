package outbound

import (
	"context"
	"testing"
)

func TestCorridorRoutingEngine(t *testing.T) {
	engine := NewCorridorRoutingEngine()

	corridors := engine.GetCorridors()
	if len(corridors) < 13 {
		t.Errorf("expected at least 13 corridors, got %d", len(corridors))
	}

	providers := engine.GetProviders()
	if len(providers) < 7 {
		t.Errorf("expected at least 7 providers, got %d", len(providers))
	}

	// Test routing a standard West Africa transfer
	result, err := engine.Route(context.Background(), &RouteRequest{
		CorridorID: "NG-GH",
		AmountUSD:  500,
		SenderTier: "growth",
		Urgency:    "standard",
		PayoutType: "bank_account",
	})
	if err != nil {
		t.Fatalf("routing failed: %v", err)
	}
	if result.ProviderID == "" {
		t.Error("expected a provider to be selected")
	}
	if result.Score <= 0 {
		t.Error("expected positive score")
	}
}

func TestCorridorRoutingValidation(t *testing.T) {
	engine := NewCorridorRoutingEngine()

	// Test invalid corridor
	_, err := engine.Route(context.Background(), &RouteRequest{
		CorridorID: "XX-YY",
		AmountUSD:  500,
	})
	if err == nil {
		t.Error("expected error for invalid corridor")
	}

	// Test amount exceeding max
	_, err = engine.Route(context.Background(), &RouteRequest{
		CorridorID: "NG-GH",
		AmountUSD:  999999,
	})
	if err == nil {
		t.Error("expected error for amount exceeding max")
	}
}

func TestSanctionsScreening(t *testing.T) {
	svc := NewSanctionsScreeningService()

	// Test clear screening
	result, err := svc.Screen(context.Background(), &ScreeningRequest{
		TransferID:         "TRF-001",
		SenderName:         "John Doe",
		BeneficiaryName:    "Jane Smith",
		BeneficiaryCountry: "GH",
		CorridorID:         "NG-GH",
		AmountUSD:          500,
	})
	if err != nil {
		t.Fatalf("screening failed: %v", err)
	}
	if result.Status != "clear" {
		t.Errorf("expected clear status, got %s", result.Status)
	}
	if result.Decision != "allow" {
		t.Errorf("expected allow decision, got %s", result.Decision)
	}
	if len(result.ListsChecked) < 7 {
		t.Errorf("expected at least 7 lists checked, got %d", len(result.ListsChecked))
	}

	// Test sanctioned country
	result, err = svc.Screen(context.Background(), &ScreeningRequest{
		TransferID:         "TRF-002",
		SenderName:         "Test User",
		BeneficiaryName:    "Recipient",
		BeneficiaryCountry: "KP", // North Korea
		CorridorID:         "NG-KP",
		AmountUSD:          1000,
	})
	if err != nil {
		t.Fatalf("screening failed: %v", err)
	}
	if result.Decision != "block" {
		t.Errorf("expected block decision for sanctioned country, got %s", result.Decision)
	}
}

func TestTieredBilling(t *testing.T) {
	svc := NewTieredBillingService()

	tiers := svc.GetTiers()
	if len(tiers) != 4 {
		t.Errorf("expected 4 tiers, got %d", len(tiers))
	}

	// Calculate fees for a growth-tier participant
	result, err := svc.CalculateFees(context.Background(), &BillingRequest{
		TransferID:      "TRF-003",
		ParticipantID:   "fintech_001",
		TierID:          "growth",
		CorridorID:      "NG-GH",
		AmountUSD:       1000,
		MonthlyTxnCount: 5000,
	})
	if err != nil {
		t.Fatalf("fee calculation failed: %v", err)
	}
	if result.BaseSwitchFee != 0.15 {
		t.Errorf("expected base fee 0.15, got %.2f", result.BaseSwitchFee)
	}
	if result.CorridorFee != 0.30 {
		t.Errorf("expected corridor fee 0.30, got %.2f", result.CorridorFee)
	}
	if result.NetFee <= 0 {
		t.Error("expected positive net fee")
	}
	if len(result.TigerBeetlePostings) != 4 {
		t.Errorf("expected 4 ledger postings, got %d", len(result.TigerBeetlePostings))
	}
}

func TestTieredBillingInvoice(t *testing.T) {
	svc := NewTieredBillingService()

	invoice, err := svc.GenerateMonthlyInvoice(
		context.Background(),
		"fintech_001", "growth",
		45000, 6750, 2100, 1500, 500, 8850,
	)
	if err != nil {
		t.Fatalf("invoice generation failed: %v", err)
	}
	if invoice.SubscriptionFee != 500 {
		t.Errorf("expected subscription fee 500, got %.2f", invoice.SubscriptionFee)
	}
	if invoice.Status != "draft" {
		t.Errorf("expected draft status, got %s", invoice.Status)
	}
	if len(invoice.LineItems) < 4 {
		t.Errorf("expected at least 4 line items, got %d", len(invoice.LineItems))
	}
}

func TestProviderAdapterFramework(t *testing.T) {
	framework := NewProviderAdapterFramework()

	adapters := framework.GetAdapters()
	if len(adapters) < 7 {
		t.Errorf("expected at least 7 adapters, got %d", len(adapters))
	}

	// Execute via Flutterwave
	resp, err := framework.Execute(context.Background(), "flutterwave", &PayoutRequest{
		TransferID:      "TRF-004-XX",
		CorridorID:      "NG-GH",
		Amount:          50000,
		SourceCurrency:  "NGN",
		DestCurrency:    "GHS",
		BeneficiaryName: "Test Recipient",
		IdempotencyKey:  "idem-001",
	})
	if err != nil {
		t.Fatalf("provider execution failed: %v", err)
	}
	if resp.Status == "" {
		t.Error("expected non-empty status")
	}
	if resp.ProviderRef == "" {
		t.Error("expected non-empty provider ref")
	}

	// Test invalid provider
	_, err = framework.Execute(context.Background(), "nonexistent", &PayoutRequest{})
	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestRemittanceWorkflow(t *testing.T) {
	workflow := NewRemittanceWorkflow()

	state, err := workflow.Execute(context.Background(), &CreateRemittanceRequest{
		TransferID:     "TRF-005-ABCDEF",
		IdempotencyKey: "idem-005",
		QuoteID:        "qte-005",
		Sender: SenderInfo{
			ParticipantID: "fintech_001",
			TierID:        "growth",
			Name:          "Chinedu Okafor",
			BVN:           "12345678901",
			NIN:           "98765432101",
			KYCHash:       "abc123hash",
		},
		Beneficiary: BeneficiaryInfo{
			Name:    "Kwame Asante",
			Country: "GH",
			Bank:    "Ecobank Ghana",
			Account: "0012345678",
		},
		Amount: AmountInfo{
			SourceAmount:   750000,
			SourceCurrency: "NGN",
			DestAmount:     3750,
			DestCurrency:   "GHS",
			ExchangeRate:   200.0,
			AmountUSD:      500,
		},
		CorridorID: "NG-GH",
		Purpose:    "family_support",
	})
	if err != nil {
		t.Fatalf("workflow execution failed: %v", err)
	}
	if state.Status != StatusCompleted {
		t.Errorf("expected completed status, got %s (reason: %s)", state.Status, state.FailureReason)
	}
	if state.Compliance == nil {
		t.Error("expected compliance result")
	}
	if state.Billing == nil {
		t.Error("expected billing result")
	}
	if state.Routing == nil {
		t.Error("expected routing result")
	}
	if state.Payout == nil {
		t.Error("expected payout result")
	}
	if len(state.Events) < 5 {
		t.Errorf("expected at least 5 events, got %d", len(state.Events))
	}
}

func TestRemittanceWorkflowSanctionedCountry(t *testing.T) {
	workflow := NewRemittanceWorkflow()

	_, err := workflow.Execute(context.Background(), &CreateRemittanceRequest{
		TransferID:     "TRF-006-BLOCKED",
		IdempotencyKey: "idem-006",
		Sender: SenderInfo{
			ParticipantID: "fintech_001",
			TierID:        "starter",
			Name:          "Test Sender",
		},
		Beneficiary: BeneficiaryInfo{
			Name:    "North Korea Recipient",
			Country: "KP",
		},
		Amount: AmountInfo{AmountUSD: 500, SourceCurrency: "NGN", DestCurrency: "KPW"},
		CorridorID: "NG-GH", // Using valid corridor but sanctioned beneficiary country
	})
	if err == nil {
		t.Error("expected error for sanctioned country")
	}
}
