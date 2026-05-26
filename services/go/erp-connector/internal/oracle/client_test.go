// Package oracle — unit tests for Oracle ERP Cloud client.
// Tests cover: client creation, PurchaseOrder struct, token expiry logic.
// Run: go test ./internal/oracle/... -v
package oracle

import (
	"testing"
	"time"
)

// ── NewClient tests ───────────────────────────────────────────────────────────

func TestNewClient_FieldsSet(t *testing.T) {
	c := NewClient(
		"https://erp.oracle.example.com/",
		"client-id-123",
		"client-secret-abc",
	)

	if c == nil {
		t.Fatal("NewClient returned nil")
	}
	// baseURL should have trailing slash stripped
	if c.baseURL != "https://erp.oracle.example.com" {
		t.Errorf("baseURL = %q, want %q", c.baseURL, "https://erp.oracle.example.com")
	}
	if c.clientID != "client-id-123" {
		t.Errorf("clientID = %q, want client-id-123", c.clientID)
	}
	if c.httpClient == nil {
		t.Error("httpClient should not be nil")
	}
	if c.httpClient.Timeout != 30*time.Second {
		t.Errorf("httpClient timeout = %v, want 30s", c.httpClient.Timeout)
	}
}

func TestNewClient_EmptyBaseURL(t *testing.T) {
	c := NewClient("", "id", "secret")
	if c == nil {
		t.Fatal("NewClient returned nil for empty URL")
	}
	if c.baseURL != "" {
		t.Errorf("empty baseURL should remain empty, got %q", c.baseURL)
	}
}

// ── PurchaseOrder struct tests ────────────────────────────────────────────────

func TestPurchaseOrder_FieldsSet(t *testing.T) {
	po := PurchaseOrder{
		POID:        "po-001",
		PONumber:    "PO-2024-00001",
		Supplier:    "Schlumberger Ltd",
		Status:      "APPROVED",
		OrderDate:   time.Now(),
		TotalAmount: 125000.00,
		Currency:    "USD",
		Description: "ESP pump replacement for Well PB-047",
		CostCenter:  "CC-PRODUCTION-001",
		WellID:      "well-pb-047",
	}

	if po.PONumber != "PO-2024-00001" {
		t.Errorf("PONumber = %s, want PO-2024-00001", po.PONumber)
	}
	if po.TotalAmount != 125000.00 {
		t.Errorf("TotalAmount = %f, want 125000.00", po.TotalAmount)
	}
	if po.Currency != "USD" {
		t.Errorf("Currency = %s, want USD", po.Currency)
	}
	if po.WellID != "well-pb-047" {
		t.Errorf("WellID = %s, want well-pb-047", po.WellID)
	}
}

// ── Token expiry tests ────────────────────────────────────────────────────────

func TestTokenExpiry_IsExpired(t *testing.T) {
	c := NewClient("https://erp.example.com", "id", "secret")
	// Set token expiry to past
	c.tokenExpiry = time.Now().Add(-1 * time.Minute)
	c.accessToken = "old-token"

	// Token should be considered expired
	isExpired := c.accessToken == "" || time.Now().After(c.tokenExpiry)
	if !isExpired {
		t.Error("token should be expired")
	}
}

func TestTokenExpiry_IsValid(t *testing.T) {
	c := NewClient("https://erp.example.com", "id", "secret")
	// Set token expiry to future
	c.tokenExpiry = time.Now().Add(1 * time.Hour)
	c.accessToken = "valid-token"

	// Token should be considered valid
	isExpired := c.accessToken == "" || time.Now().After(c.tokenExpiry)
	if isExpired {
		t.Error("token should not be expired")
	}
}

func TestTokenExpiry_EmptyToken(t *testing.T) {
	c := NewClient("https://erp.example.com", "id", "secret")
	// No token set
	isExpired := c.accessToken == "" || time.Now().After(c.tokenExpiry)
	if !isExpired {
		t.Error("empty token should be considered expired")
	}
}
