package outbound

import (
	"context"
	"testing"
)

// =============================================================================
// PAYMENT RAIL REGISTRY TESTS
// =============================================================================

func TestNewPaymentRailRegistry(t *testing.T) {
	registry := NewPaymentRailRegistry()

	// Verify all 9 rails are registered
	statuses := registry.GetAllRailStatuses()
	if len(statuses) != 9 {
		t.Errorf("expected 9 rails registered, got %d", len(statuses))
	}

	// Verify all 13 corridors have routes
	routes := registry.GetAllCorridorRoutes()
	if len(routes) != 13 {
		t.Errorf("expected 13 corridor routes, got %d", len(routes))
	}
}

func TestCorridorRailMapping(t *testing.T) {
	registry := NewPaymentRailRegistry()

	tests := []struct {
		corridorID   string
		expectedRail RailType
	}{
		// African corridors → PAPSS primary
		{"NG-GH", RailPAPSS},
		{"NG-KE", RailPAPSS},
		{"NG-ZA", RailPAPSS},
		{"NG-SN", RailPAPSS},
		{"NG-CI", RailPAPSS},
		{"NG-CM", RailPAPSS},
		// OECD corridors → SWIFT primary
		{"NG-GB", RailSWIFT},
		{"NG-US", RailSWIFT},
		{"NG-CA", RailSWIFT},
		{"NG-AE", RailSWIFT},
		{"NG-TR", RailSWIFT},
		// Destination-specific rails
		{"NG-CN", RailCIPS},
		{"NG-IN", RailUPI},
	}

	for _, tt := range tests {
		rail, err := registry.GetRailForCorridor(tt.corridorID)
		if err != nil {
			t.Errorf("corridor %s: unexpected error: %v", tt.corridorID, err)
			continue
		}
		if rail.RailType() != tt.expectedRail {
			t.Errorf("corridor %s: expected rail %s, got %s", tt.corridorID, tt.expectedRail, rail.RailType())
		}
	}
}

func TestCorridorFeeCalculation(t *testing.T) {
	registry := NewPaymentRailRegistry()

	tests := []struct {
		corridorID  string
		principal   float64
		expectedMin float64 // minimum expected fee
		expectedMax float64 // maximum expected fee
	}{
		// NG-GB SWIFT: $1000 × 0.001 + $0.25 = $1.25
		{"NG-GB", 1000.0, 1.20, 1.30},
		// NG-GH PAPSS: $1000 × 0.0005 + $0.10 = $0.60
		{"NG-GH", 1000.0, 0.55, 0.65},
		// NG-IN UPI: $1000 × 0.0004 + $0.05 = $0.45
		{"NG-IN", 1000.0, 0.40, 0.50},
		// NG-CN CIPS: $1000 × 0.0008 + $0.20 = $1.00
		{"NG-CN", 1000.0, 0.95, 1.05},
	}

	for _, tt := range tests {
		fee, railType, err := registry.CalculateCorridorFee(tt.corridorID, tt.principal)
		if err != nil {
			t.Errorf("corridor %s: unexpected error: %v", tt.corridorID, err)
			continue
		}
		if fee < tt.expectedMin || fee > tt.expectedMax {
			t.Errorf("corridor %s: fee $%.2f outside expected range [$%.2f, $%.2f]", tt.corridorID, fee, tt.expectedMin, tt.expectedMax)
		}
		if railType == "" {
			t.Errorf("corridor %s: rail type should not be empty", tt.corridorID)
		}
	}
}

func TestRailFallback(t *testing.T) {
	registry := NewPaymentRailRegistry()

	// Mark PAPSS as down
	registry.UpdateRailStatus(RailPAPSS, "down", 0, 0, "PAPSS maintenance")

	// NG-GH should fall back to Mobile Money
	rail, railType, err := registry.SelectRailWithFallback("NG-GH")
	if err != nil {
		t.Fatalf("expected fallback rail, got error: %v", err)
	}
	if railType != RailMobileMoney {
		t.Errorf("expected fallback to MOBILE_MONEY, got %s", railType)
	}
	if rail == nil {
		t.Error("rail adapter should not be nil")
	}
}

func TestRailFallbackAllDown(t *testing.T) {
	registry := NewPaymentRailRegistry()

	// Mark all rails for NG-GH as down
	registry.UpdateRailStatus(RailPAPSS, "down", 0, 0, "down")
	registry.UpdateRailStatus(RailMobileMoney, "down", 0, 0, "down")
	registry.UpdateRailStatus(RailMojaloop, "down", 0, 0, "down")

	_, _, err := registry.SelectRailWithFallback("NG-GH")
	if err == nil {
		t.Error("expected error when all rails down, got nil")
	}
}

func TestUnknownCorridorError(t *testing.T) {
	registry := NewPaymentRailRegistry()

	_, err := registry.GetRailForCorridor("NG-XX")
	if err == nil {
		t.Error("expected error for unknown corridor")
	}

	_, _, err = registry.CalculateCorridorFee("NG-XX", 1000)
	if err == nil {
		t.Error("expected error for unknown corridor fee")
	}
}

// =============================================================================
// INDIVIDUAL RAIL ADAPTER TESTS
// =============================================================================

func TestSWIFTAdapter(t *testing.T) {
	adapter := &SWIFTAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailSWIFT {
		t.Errorf("expected SWIFT rail type")
	}
	if adapter.MessageFormat() != "MT103/ISO20022" {
		t.Errorf("expected MT103/ISO20022 format, got %s", adapter.MessageFormat())
	}
	if !adapter.SupportsTracking() {
		t.Error("SWIFT gpi should support tracking")
	}

	// Test validation — missing bank code
	err := adapter.ValidateDestination(ctx, &PayoutRequest{BeneficiaryAcct: "GB12345678"})
	if err == nil {
		t.Error("expected validation error for missing SWIFT code")
	}

	// Test execution
	req := &PayoutRequest{
		TransferID:      "TXN-12345678-TEST",
		BeneficiaryBank: "BARCGB22",
		BeneficiaryAcct: "GB82WEST12345698765432",
		Amount:          5000,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("SWIFT execute failed: %v", err)
	}
	if resp.Status != "processing" {
		t.Errorf("expected processing, got %s", resp.Status)
	}
	if resp.ProviderFee < 15 {
		t.Errorf("SWIFT fee should be at least $15, got $%.2f", resp.ProviderFee)
	}
}

func TestPAPSSAdapter(t *testing.T) {
	adapter := &PAPSSAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailPAPSS {
		t.Errorf("expected PAPSS rail type")
	}
	if adapter.SettlementCurrency() != "LOCAL" {
		t.Errorf("PAPSS settles in local currency, got %s", adapter.SettlementCurrency())
	}
	if adapter.MaxSettlementTime().Minutes() > 5 {
		t.Error("PAPSS should settle in under 5 minutes")
	}

	// Test execution with mobile number
	req := &PayoutRequest{
		TransferID:       "TXN-PAPSS001-TEST",
		BeneficiaryPhone: "+233241234567",
		Amount:           200,
		SourceCurrency:   "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("PAPSS execute failed: %v", err)
	}
	if resp.ProviderFee > 1.0 {
		t.Errorf("PAPSS fee should be low-cost, got $%.2f", resp.ProviderFee)
	}
}

func TestCIPSAdapter(t *testing.T) {
	adapter := &CIPSAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailCIPS {
		t.Errorf("expected CIPS rail type")
	}
	if adapter.SettlementCurrency() != "CNY" {
		t.Errorf("CIPS settles in CNY, got %s", adapter.SettlementCurrency())
	}

	// Test validation — missing CNAPS code
	err := adapter.ValidateDestination(ctx, &PayoutRequest{
		BeneficiaryAcct: "1234567890",
		BeneficiaryName: "张三",
	})
	if err == nil {
		t.Error("expected validation error for missing CNAPS code")
	}

	// Test full execution
	req := &PayoutRequest{
		TransferID:      "TXN-CIPS0001-TEST",
		BeneficiaryBank: "BKCHCNBJ",
		BeneficiaryAcct: "6222600000000001",
		BeneficiaryName: "张三",
		Amount:          10000,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("CIPS execute failed: %v", err)
	}
	if resp.Status != "processing" {
		t.Errorf("expected processing, got %s", resp.Status)
	}
}

func TestUPIAdapter(t *testing.T) {
	adapter := &UPIAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailUPI {
		t.Errorf("expected UPI rail type")
	}
	if adapter.SettlementCurrency() != "INR" {
		t.Errorf("UPI settles in INR, got %s", adapter.SettlementCurrency())
	}
	if adapter.MaxSettlementTime().Seconds() > 60 {
		t.Error("UPI should settle within 60 seconds")
	}

	// Test execution with VPA
	req := &PayoutRequest{
		TransferID:      "TXN-UPI00001-TEST",
		BeneficiaryAcct: "user@upi",
		Amount:          500,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("UPI execute failed: %v", err)
	}
	if resp.Status != "completed" {
		t.Errorf("UPI should complete instantly, got %s", resp.Status)
	}
	if resp.ProviderFee > 0.50 {
		t.Errorf("UPI fee should be near-zero, got $%.2f", resp.ProviderFee)
	}
}

func TestSEPAAdapter(t *testing.T) {
	adapter := &SEPAAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailSEPA {
		t.Errorf("expected SEPA rail type")
	}
	if adapter.MessageFormat() != "ISO20022/pain.001" {
		t.Errorf("SEPA uses pain.001, got %s", adapter.MessageFormat())
	}

	// Test validation — IBAN too short
	err := adapter.ValidateDestination(ctx, &PayoutRequest{BeneficiaryAcct: "DE12"})
	if err == nil {
		t.Error("expected validation error for short IBAN")
	}

	// Test with valid IBAN
	req := &PayoutRequest{
		TransferID:      "TXN-SEPA0001-TEST",
		BeneficiaryAcct: "DE89370400440532013000",
		Amount:          1500,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("SEPA execute failed: %v", err)
	}
	if resp.Status != "completed" {
		t.Errorf("SEPA Instant should complete immediately, got %s", resp.Status)
	}
}

func TestMobileMoneyRailAdapter(t *testing.T) {
	adapter := &MobileMoneyRailAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailMobileMoney {
		t.Errorf("expected MOBILE_MONEY rail type")
	}

	// Test validation — missing phone
	err := adapter.ValidateDestination(ctx, &PayoutRequest{BeneficiaryAcct: "123"})
	if err == nil {
		t.Error("expected validation error for missing phone")
	}

	// Test execution
	req := &PayoutRequest{
		TransferID:       "TXN-MOMO0001-TEST",
		BeneficiaryPhone: "+233241234567",
		Amount:           100,
		SourceCurrency:   "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("Mobile Money execute failed: %v", err)
	}
	if resp.ProviderFee > 1.0 {
		t.Errorf("Mobile money should be low-cost, got $%.2f", resp.ProviderFee)
	}
}

func TestACHAdapter(t *testing.T) {
	adapter := &ACHAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailACH {
		t.Errorf("expected ACH rail type")
	}
	if adapter.SupportsTracking() {
		t.Error("ACH does not support real-time tracking")
	}

	req := &PayoutRequest{
		TransferID:      "TXN-ACH00001-TEST",
		BeneficiaryBank: "021000021",
		BeneficiaryAcct: "1234567890",
		Amount:          2000,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("ACH execute failed: %v", err)
	}
	if resp.Status != "processing" {
		t.Errorf("ACH should be processing, got %s", resp.Status)
	}
}

func TestFasterPaymentsAdapter(t *testing.T) {
	adapter := &FasterPaymentsAdapter{}
	ctx := context.Background()

	if adapter.RailType() != RailFasterPay {
		t.Errorf("expected FASTER_PAY rail type")
	}

	req := &PayoutRequest{
		TransferID:      "TXN-FPS00001-TEST",
		BeneficiaryBank: "123456",
		BeneficiaryAcct: "12345678",
		Amount:          500,
		SourceCurrency:  "NGN",
	}
	resp, err := adapter.Execute(ctx, req)
	if err != nil {
		t.Fatalf("Faster Payments execute failed: %v", err)
	}
	if resp.Status != "completed" {
		t.Errorf("FPS should complete instantly, got %s", resp.Status)
	}
}

// =============================================================================
// MOJALOOP HUB ROUTER TESTS
// =============================================================================

func TestMojaloopHubRouter(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)

	// Verify 8 DFSPs registered
	dfsps := hub.GetRegisteredDFSPs()
	if len(dfsps) < 8 {
		t.Errorf("expected at least 8 DFSPs, got %d", len(dfsps))
	}
}

func TestMojaloopPartyLookup(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)
	ctx := context.Background()

	// Lookup IBAN party in NG-GB corridor (should find SWIFT or SEPA DFSP — both support IBAN)
	result, err := hub.PartyLookup(ctx, "NG-GB", "IBAN", "GB82WEST12345698765432")
	if err != nil {
		t.Fatalf("party lookup failed: %v", err)
	}
	if result.DFSPID != "dfsp-swift" && result.DFSPID != "dfsp-sepa" {
		t.Errorf("expected dfsp-swift or dfsp-sepa for IBAN lookup, got %s", result.DFSPID)
	}

	// Lookup MSISDN party in NG-GH corridor (should find PAPSS or Mobile Money)
	result, err = hub.PartyLookup(ctx, "NG-GH", "MSISDN", "+233241234567")
	if err != nil {
		t.Fatalf("party lookup failed: %v", err)
	}
	if result.DFSPID == "" {
		t.Error("expected a DFSP for GH MSISDN lookup")
	}
}

func TestMojaloopGetQuote(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)
	ctx := context.Background()

	// Quote for NG-GB ($1000 via SWIFT)
	quote, err := hub.GetQuote(ctx, "NG-GB", 1000.0, "USD")
	if err != nil {
		t.Fatalf("quote failed: %v", err)
	}
	if quote.RailType != RailSWIFT {
		t.Errorf("expected SWIFT rail for NG-GB, got %s", quote.RailType)
	}
	if quote.RailFee < 10 {
		t.Errorf("SWIFT rail fee should be >$10, got $%.2f", quote.RailFee)
	}
	if quote.PayerFee <= 0 {
		t.Error("corridor fee should be positive")
	}

	// Quote for NG-IN ($500 via UPI)
	quote, err = hub.GetQuote(ctx, "NG-IN", 500.0, "INR")
	if err != nil {
		t.Fatalf("quote failed: %v", err)
	}
	if quote.RailType != RailUPI {
		t.Errorf("expected UPI rail for NG-IN, got %s", quote.RailType)
	}
	if quote.RailFee > 1.0 {
		t.Errorf("UPI rail fee should be minimal, got $%.2f", quote.RailFee)
	}
}

func TestMojaloopExecuteTransfer(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)
	ctx := context.Background()

	// Execute transfer to Ghana via PAPSS
	req := &PayoutRequest{
		TransferID:       "TXN-HUB00001-TEST",
		CorridorID:       "NG-GH",
		Amount:           200,
		SourceCurrency:   "NGN",
		DestCurrency:     "GHS",
		BeneficiaryPhone: "+233241234567",
		BeneficiaryAcct:  "0241234567",
		BeneficiaryName:  "Kwame Asante",
		IdempotencyKey:   "idem-001",
	}

	resp, record, err := hub.ExecuteTransfer(ctx, req, "NG-GH")
	if err != nil {
		t.Fatalf("execute transfer failed: %v", err)
	}
	if record.RailUsed != RailPAPSS {
		t.Errorf("expected PAPSS rail for NG-GH, got %s", record.RailUsed)
	}
	if resp.ProviderRef == "" {
		t.Error("provider reference should not be empty")
	}
	if record.SwitchFee <= 0 {
		t.Error("switch fee should be positive")
	}

	// Verify transfer log
	log := hub.GetTransferLog()
	if len(log) != 1 {
		t.Errorf("expected 1 transfer in log, got %d", len(log))
	}
}

func TestMojaloopExecuteWithFallback(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)
	ctx := context.Background()

	// Mark PAPSS as down
	registry.UpdateRailStatus(RailPAPSS, "down", 0, 0, "maintenance")

	// Transfer should fall back to Mobile Money
	req := &PayoutRequest{
		TransferID:       "TXN-FALL0001-TEST",
		CorridorID:       "NG-GH",
		Amount:           100,
		SourceCurrency:   "NGN",
		DestCurrency:     "GHS",
		BeneficiaryPhone: "+233241234567",
		IdempotencyKey:   "idem-fallback",
	}

	_, record, err := hub.ExecuteTransfer(ctx, req, "NG-GH")
	if err != nil {
		t.Fatalf("fallback execute failed: %v", err)
	}
	if record.RailUsed != RailMobileMoney {
		t.Errorf("expected MOBILE_MONEY fallback, got %s", record.RailUsed)
	}
}

func TestGetRailsForCorridor(t *testing.T) {
	registry := NewPaymentRailRegistry()
	hub := NewMojaloopHubRouter(registry)

	// NG-GB should have SWIFT, SEPA, and Faster Payments as DFSPs
	rails := hub.GetRailsForCorridor("NG-GB")
	if len(rails) < 3 {
		t.Errorf("NG-GB should have at least 3 rail DFSPs, got %d", len(rails))
	}

	// NG-CN should have CIPS
	rails = hub.GetRailsForCorridor("NG-CN")
	hasCIPS := false
	for _, r := range rails {
		if r.RailType == RailCIPS {
			hasCIPS = true
		}
	}
	if !hasCIPS {
		t.Error("NG-CN should have CIPS DFSP")
	}
}

func TestCorridorToCurrency(t *testing.T) {
	tests := map[string]string{
		"NG-GH": "GHS", "NG-GB": "GBP", "NG-US": "USD", "NG-CA": "CAD",
		"NG-IN": "INR", "NG-CN": "CNY", "NG-AE": "AED", "NG-KE": "KES",
		"NG-ZA": "ZAR", "NG-SN": "XOF", "NG-CI": "XOF", "NG-CM": "XAF",
		"NG-TR": "TRY",
	}
	for corridor, expectedCurrency := range tests {
		if got := corridorToCurrency(corridor); got != expectedCurrency {
			t.Errorf("corridor %s: expected %s, got %s", corridor, expectedCurrency, got)
		}
	}
}
