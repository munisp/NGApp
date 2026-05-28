// Package oracle provides a client for Oracle ERP Cloud REST API integration.
// Spec: §13 — Oracle ERP: purchase orders, assets, invoices, financial reconciliation
package oracle

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is the Oracle ERP Cloud REST API client.
type Client struct {
	baseURL      string
	clientID     string
	clientSecret string
	httpClient   *http.Client
	accessToken  string
	tokenExpiry  time.Time
}

// NewClient creates a new Oracle ERP Cloud client.
func NewClient(baseURL, clientID, clientSecret string) *Client {
	return &Client{
		baseURL:      strings.TrimRight(baseURL, "/"),
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// PurchaseOrder represents an Oracle ERP purchase order.
type PurchaseOrder struct {
	POID         string    `json:"poId"`
	PONumber     string    `json:"poNumber"`
	Supplier     string    `json:"supplier"`
	Status       string    `json:"status"`
	OrderDate    time.Time `json:"orderDate"`
	TotalAmount  float64   `json:"totalAmount"`
	Currency     string    `json:"currency"`
	Description  string    `json:"description"`
	CostCenter   string    `json:"costCenter"`
	WellID       string    `json:"wellId"`
}

// Asset represents an Oracle ERP fixed asset.
type Asset struct {
	AssetID       string    `json:"assetId"`
	AssetNumber   string    `json:"assetNumber"`
	Description   string    `json:"description"`
	Category      string    `json:"category"`
	Location      string    `json:"location"`
	AcquisitionDate time.Time `json:"acquisitionDate"`
	OriginalCost  float64   `json:"originalCost"`
	BookValue     float64   `json:"bookValue"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	WellID        string    `json:"wellId"`
}

// Invoice represents an Oracle ERP supplier invoice.
type Invoice struct {
	InvoiceID     string    `json:"invoiceId"`
	InvoiceNumber string    `json:"invoiceNumber"`
	Supplier      string    `json:"supplier"`
	InvoiceDate   time.Time `json:"invoiceDate"`
	DueDate       time.Time `json:"dueDate"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	Description   string    `json:"description"`
	POReference   string    `json:"poReference"`
}

// ReconcileRequest represents a financial reconciliation request.
type ReconcileRequest struct {
	Period     string `json:"period"`     // YYYY-MM
	CostCenter string `json:"costCenter"`
	WellID     string `json:"wellId"`
}

// ReconcileResult represents the result of a financial reconciliation.
type ReconcileResult struct {
	Period          string    `json:"period"`
	CostCenter      string    `json:"costCenter"`
	TotalExpenses   float64   `json:"totalExpenses"`
	TotalRevenue    float64   `json:"totalRevenue"`
	NetPosition     float64   `json:"netPosition"`
	Currency        string    `json:"currency"`
	Discrepancies   int       `json:"discrepancies"`
	ReconciledAt    time.Time `json:"reconciledAt"`
	Status          string    `json:"status"`
}

// ─── API Methods ──────────────────────────────────────────────────────────────

// GetPurchaseOrders retrieves purchase orders filtered by status.
func (c *Client) GetPurchaseOrders(ctx context.Context, status string) ([]PurchaseOrder, error) {
	if c.baseURL == "" {
		return c.mockPurchaseOrders(status), nil
	}

	path := "/fscmRestApi/resources/11.13.18.05/purchaseOrders"
	if status != "" {
		path += fmt.Sprintf("?q=Status=%s", status)
	}

	body, err := c.get(ctx, path)
	if err != nil {
		return nil, err
	}

	var result struct {
		Items []PurchaseOrder `json:"items"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("Oracle parse error: %w", err)
	}
	return result.Items, nil
}

// GetAssets retrieves fixed assets by category.
func (c *Client) GetAssets(ctx context.Context, category string) ([]Asset, error) {
	if c.baseURL == "" {
		return c.mockAssets(category), nil
	}

	path := "/fscmRestApi/resources/11.13.18.05/fixedAssets"
	if category != "" {
		path += fmt.Sprintf("?q=AssetCategory=%s", category)
	}

	body, err := c.get(ctx, path)
	if err != nil {
		return nil, err
	}

	var result struct {
		Items []Asset `json:"items"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("Oracle parse error: %w", err)
	}
	return result.Items, nil
}

// GetInvoices retrieves supplier invoices for a date range.
func (c *Client) GetInvoices(ctx context.Context, from, to string) ([]Invoice, error) {
	if c.baseURL == "" {
		return c.mockInvoices(), nil
	}

	path := fmt.Sprintf(
		"/fscmRestApi/resources/11.13.18.05/supplierInvoices?q=InvoiceDate>=%s;InvoiceDate<=%s",
		from, to,
	)

	body, err := c.get(ctx, path)
	if err != nil {
		return nil, err
	}

	var result struct {
		Items []Invoice `json:"items"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("Oracle parse error: %w", err)
	}
	return result.Items, nil
}

// Reconcile performs financial reconciliation for a period and cost center.
func (c *Client) Reconcile(ctx context.Context, req ReconcileRequest) (*ReconcileResult, error) {
	if c.baseURL == "" {
		return &ReconcileResult{
			Period:        req.Period,
			CostCenter:    req.CostCenter,
			TotalExpenses: 1_245_800.00,
			TotalRevenue:  3_892_400.00,
			NetPosition:   2_646_600.00,
			Currency:      "USD",
			Discrepancies: 0,
			ReconciledAt:  time.Now(),
			Status:        "RECONCILED",
		}, nil
	}

	path := "/fscmRestApi/resources/11.13.18.05/financialReconciliation"
	payload, _ := json.Marshal(map[string]string{
		"Period":     req.Period,
		"CostCenter": req.CostCenter,
		"WellId":     req.WellID,
	})

	body, err := c.post(ctx, path, payload)
	if err != nil {
		return nil, err
	}

	var result ReconcileResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("Oracle parse error: %w", err)
	}
	return &result, nil
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

func (c *Client) ensureToken(ctx context.Context) error {
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		return nil
	}

	tokenURL := c.baseURL + "/oauth/token"
	payload := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s",
		c.clientID, c.clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL,
		strings.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("Oracle token request failed: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return fmt.Errorf("Oracle token parse error: %w", err)
	}

	c.accessToken = tokenResp.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)
	return nil
}

func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	if err := c.ensureToken(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Oracle request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Oracle HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

func (c *Client) post(ctx context.Context, path string, payload []byte) ([]byte, error) {
	if err := c.ensureToken(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path,
		strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Oracle POST failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Oracle HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ─── Mock data ────────────────────────────────────────────────────────────────

func (c *Client) mockPurchaseOrders(status string) []PurchaseOrder {
	orders := []PurchaseOrder{
		{POID: "PO-2025-001", PONumber: "4500012345", Supplier: "Baker Hughes", Status: "APPROVED",
			OrderDate: time.Now().Add(-72 * time.Hour), TotalAmount: 245000.00, Currency: "USD",
			Description: "ESP pump assembly and installation", CostCenter: "CC-PROD-001", WellID: "W-001"},
		{POID: "PO-2025-002", PONumber: "4500012346", Supplier: "Halliburton", Status: "PENDING",
			OrderDate: time.Now().Add(-24 * time.Hour), TotalAmount: 89500.00, Currency: "USD",
			Description: "Well stimulation chemicals", CostCenter: "CC-DRILL-001", WellID: "W-004"},
	}
	if status != "" {
		filtered := make([]PurchaseOrder, 0)
		for _, o := range orders {
			if o.Status == status {
				filtered = append(filtered, o)
			}
		}
		return filtered
	}
	return orders
}

func (c *Client) mockAssets(category string) []Asset {
	return []Asset{
		{AssetID: "AST-001", AssetNumber: "FA-10001", Description: "ESP Pump W-001", Category: "PRODUCTION_EQUIPMENT",
			Location: "Well W-001", AcquisitionDate: time.Now().Add(-365 * 24 * time.Hour),
			OriginalCost: 125000.00, BookValue: 87500.00, Currency: "USD", Status: "IN_SERVICE", WellID: "W-001"},
		{AssetID: "AST-002", AssetNumber: "FA-10002", Description: "Wellhead Christmas Tree W-002", Category: "WELLHEAD_EQUIPMENT",
			Location: "Well W-002", AcquisitionDate: time.Now().Add(-730 * 24 * time.Hour),
			OriginalCost: 85000.00, BookValue: 51000.00, Currency: "USD", Status: "IN_SERVICE", WellID: "W-002"},
	}
}

func (c *Client) mockInvoices() []Invoice {
	return []Invoice{
		{InvoiceID: "INV-001", InvoiceNumber: "BH-2025-4521", Supplier: "Baker Hughes",
			InvoiceDate: time.Now().Add(-7 * 24 * time.Hour), DueDate: time.Now().Add(23 * 24 * time.Hour),
			Amount: 245000.00, Currency: "USD", Status: "PENDING_APPROVAL",
			Description: "ESP pump assembly", POReference: "4500012345"},
		{InvoiceID: "INV-002", InvoiceNumber: "SLB-2025-8834", Supplier: "SLB",
			InvoiceDate: time.Now().Add(-14 * 24 * time.Hour), DueDate: time.Now().Add(16 * 24 * time.Hour),
			Amount: 67800.00, Currency: "USD", Status: "APPROVED",
			Description: "Wireline logging services", POReference: "4500012340"},
	}
}
