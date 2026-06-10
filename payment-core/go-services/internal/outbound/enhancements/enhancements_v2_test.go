package enhancements

import (
	"context"
	"testing"
	"time"
)

// --- Batch Processing Tests ---

func TestBatchProcessorSubmitAndProcess(t *testing.T) {
	bp := NewBatchProcessor(5000)
	items := []BatchTransferItem{
		{BeneficiaryName: "Kwame Asante", BeneficiaryAcct: "GH001", CorridorID: "NG-GH", AmountNGN: 2500000, Purpose: "family"},
		{BeneficiaryName: "John Smith", BeneficiaryAcct: "GB002", CorridorID: "NG-GB", AmountNGN: 15000000, Purpose: "education"},
		{BeneficiaryName: "", BeneficiaryAcct: "XX", CorridorID: "NG-US", AmountNGN: 500000, Purpose: "test"}, // invalid
	}

	batch, err := bp.SubmitBatch(context.Background(), "PAYAPP-001", items)
	if err != nil {
		t.Fatalf("SubmitBatch failed: %v", err)
	}
	if batch.TotalItems != 3 {
		t.Errorf("expected 3 items, got %d", batch.TotalItems)
	}
	if batch.FailedCount != 1 {
		t.Errorf("expected 1 failed (invalid), got %d", batch.FailedCount)
	}

	processed, err := bp.ProcessBatch(context.Background(), batch.BatchID)
	if err != nil {
		t.Fatalf("ProcessBatch failed: %v", err)
	}
	if processed.SuccessCount != 2 {
		t.Errorf("expected 2 successful, got %d", processed.SuccessCount)
	}
	if processed.Status != BatchPartial {
		t.Errorf("expected partial_success, got %s", processed.Status)
	}
}

func TestBatchProcessorEmpty(t *testing.T) {
	bp := NewBatchProcessor(100)
	_, err := bp.SubmitBatch(context.Background(), "TEST", []BatchTransferItem{})
	if err == nil {
		t.Fatal("expected error for empty batch")
	}
}

func TestBatchProcessorMaxSize(t *testing.T) {
	bp := NewBatchProcessor(2)
	items := make([]BatchTransferItem, 3)
	for i := range items {
		items[i] = BatchTransferItem{BeneficiaryName: "Test", CorridorID: "NG-GH", AmountNGN: 1000}
	}
	_, err := bp.SubmitBatch(context.Background(), "TEST", items)
	if err == nil {
		t.Fatal("expected error for oversized batch")
	}
}

// --- Dual Approval Tests ---

func TestDualApprovalWorkflow(t *testing.T) {
	engine := NewDualApprovalEngine()

	// Create a high-value transfer approval
	req, err := engine.CreateRequest(ApprovalTransferHighValue, "operator-1", "Transfer ₦500M to NG-GB", map[string]string{"corridor": "NG-GB"}, 500_000_000)
	if err != nil {
		t.Fatalf("CreateRequest failed: %v", err)
	}
	if req.RequiredApprovals != 2 {
		t.Errorf("expected 2 required approvals, got %d", req.RequiredApprovals)
	}

	// First approval
	req, err = engine.SubmitDecision(req.RequestID, "admin-1", "admin", true, "approved")
	if err != nil {
		t.Fatalf("First approval failed: %v", err)
	}
	if req.Status != ApprovalPending {
		t.Errorf("expected still pending after 1 approval, got %s", req.Status)
	}

	// Second approval
	req, err = engine.SubmitDecision(req.RequestID, "admin-2", "admin", true, "confirmed")
	if err != nil {
		t.Fatalf("Second approval failed: %v", err)
	}
	if req.Status != ApprovalApproved {
		t.Errorf("expected approved after 2 approvals, got %s", req.Status)
	}
}

func TestDualApprovalSelfApproveBlocked(t *testing.T) {
	engine := NewDualApprovalEngine()
	req, _ := engine.CreateRequest(ApprovalTierUpgrade, "operator-1", "Upgrade tier", nil, 0)
	_, err := engine.SubmitDecision(req.RequestID, "operator-1", "admin", true, "self")
	if err == nil {
		t.Fatal("expected error: cannot approve own request")
	}
}

func TestDualApprovalRejection(t *testing.T) {
	engine := NewDualApprovalEngine()
	req, _ := engine.CreateRequest(ApprovalRailConfig, "operator-1", "Change SWIFT config", nil, 0)
	req, _ = engine.SubmitDecision(req.RequestID, "admin-1", "admin", false, "rejected: risky change")
	if req.Status != ApprovalRejected {
		t.Errorf("expected rejected, got %s", req.Status)
	}
}

// --- Immutable Audit Trail Tests ---

func TestAuditTrailAppendAndVerify(t *testing.T) {
	trail := NewImmutableAuditTrail()

	trail.Append(AuditTransferCreated, "user-1", "participant", "transfer", "NOR-001", map[string]string{"amount": "5000000"})
	trail.Append(AuditTransferApproved, "admin-1", "admin", "transfer", "NOR-001", map[string]string{"approver": "admin-1"})
	trail.Append(AuditRailStatusChanged, "admin-2", "admin", "rail", "SWIFT", map[string]string{"status": "degraded"})

	if trail.Count() != 3 {
		t.Errorf("expected 3 entries, got %d", trail.Count())
	}

	valid, count, err := trail.VerifyChain()
	if !valid || err != nil {
		t.Fatalf("chain verification failed at %d: %v", count, err)
	}
}

func TestAuditTrailQuery(t *testing.T) {
	trail := NewImmutableAuditTrail()
	trail.Append(AuditTransferCreated, "user-1", "participant", "transfer", "T1", nil)
	trail.Append(AuditConfigChanged, "admin-1", "admin", "config", "C1", nil)
	trail.Append(AuditTransferCreated, "user-2", "participant", "transfer", "T2", nil)

	results := trail.Query(AuditTransferCreated, "", "", time.Time{}, 0)
	if len(results) != 2 {
		t.Errorf("expected 2 transfer entries, got %d", len(results))
	}
}

// --- Multi-Currency Netting Tests ---

func TestNettingEngine(t *testing.T) {
	ne := NewNettingEngine()
	ne.AddFlow("NGN", "GHS", 16_000_000)  // ₦16M → GHS
	ne.AddFlow("NGN", "GBP", 50_000_000)  // ₦50M → GBP
	ne.AddFlow("GBP", "NGN", 30_000_000)  // £30M → NGN (reverse flow)

	result := ne.ExecuteNetting()
	if result.GrossTotalUSD <= 0 {
		t.Error("gross total should be positive")
	}
	if result.SavingsPercent < 0 {
		t.Error("savings should not be negative")
	}
	if result.PairsNetted == 0 {
		t.Error("should have netted at least one pair")
	}
}

// --- FX Rate Lock Tests ---

func TestFXRateLockLifecycle(t *testing.T) {
	svc := NewFXRateLockService()

	lock, err := svc.LockRate("PAYAPP", "NG-GB", "NGN", "GBP", 1960.0, 50, 10_000_000, 60)
	if err != nil {
		t.Fatalf("LockRate failed: %v", err)
	}
	if lock.Status != RateLockActive {
		t.Errorf("expected active, got %s", lock.Status)
	}

	used, err := svc.UseLock(lock.LockID, "NOR-001")
	if err != nil {
		t.Fatalf("UseLock failed: %v", err)
	}
	if used.Status != RateLockUsed {
		t.Errorf("expected used, got %s", used.Status)
	}

	// Cannot use again
	_, err = svc.UseLock(lock.LockID, "NOR-002")
	if err == nil {
		t.Fatal("expected error: lock already used")
	}
}

func TestFXRateLockTTLExceeded(t *testing.T) {
	svc := NewFXRateLockService()
	_, err := svc.LockRate("PAYAPP", "NG-GB", "NGN", "GBP", 1960.0, 50, 10_000_000, 999)
	if err == nil {
		t.Fatal("expected error: TTL exceeds maximum")
	}
}

// --- IP Allowlist Tests ---

func TestIPAllowlist(t *testing.T) {
	svc := NewIPAllowlistService()
	svc.SetEnforcement("PAYAPP", true)

	_, err := svc.AddEntry("PAYAPP", "10.0.0.0/24", "Office network", "admin-1")
	if err != nil {
		t.Fatalf("AddEntry failed: %v", err)
	}

	allowed, _ := svc.CheckIP("PAYAPP", "10.0.0.55")
	if !allowed {
		t.Error("10.0.0.55 should be allowed")
	}

	allowed, reason := svc.CheckIP("PAYAPP", "192.168.1.1")
	if allowed {
		t.Error("192.168.1.1 should be blocked")
	}
	if reason != "not_in_allowlist" {
		t.Errorf("expected not_in_allowlist, got %s", reason)
	}
}

func TestIPAllowlistDisabled(t *testing.T) {
	svc := NewIPAllowlistService()
	// Enforcement disabled by default
	allowed, _ := svc.CheckIP("PAYAPP", "1.2.3.4")
	if !allowed {
		t.Error("should allow any IP when enforcement disabled")
	}
}

// --- Rate Limiter Tests ---

func TestRateLimiter(t *testing.T) {
	svc := NewRateLimiterService()
	key, err := svc.RegisterKey("PAYAPP", APIKeyStarter)
	if err != nil {
		t.Fatalf("RegisterKey failed: %v", err)
	}

	// Should allow first request
	allowed, reason, _ := svc.CheckRateLimit(key.KeyID)
	if !allowed {
		t.Errorf("first request should be allowed, got: %s", reason)
	}

	// Should allow up to limit
	for i := 0; i < 28; i++ {
		svc.CheckRateLimit(key.KeyID)
	}

	// 30th request should still be within per-min limit (starter = 30/min)
	allowed, _, _ = svc.CheckRateLimit(key.KeyID)
	if !allowed {
		t.Error("30th request should be allowed (limit is 30/min)")
	}

	// 31st should be blocked
	allowed, reason, _ = svc.CheckRateLimit(key.KeyID)
	if allowed {
		t.Error("31st request should be rate-limited")
	}
	if reason != "rate_limit_exceeded" {
		t.Errorf("expected rate_limit_exceeded, got %s", reason)
	}
}
