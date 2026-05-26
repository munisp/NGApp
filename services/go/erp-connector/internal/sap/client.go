// Package sap provides a client for SAP S/4HANA OData API integration.
// Spec: §13 — SAP PM module: work orders, cost centers, GL postings, materials
package sap

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is the SAP S/4HANA OData API client.
type Client struct {
	baseURL    string
	username   string
	password   string
	sapClient  string
	httpClient *http.Client
}

// NewClient creates a new SAP OData client.
func NewClient(baseURL, username, password, sapClient string) *Client {
	return &Client{
		baseURL:   strings.TrimRight(baseURL, "/"),
		username:  username,
		password:  password,
		sapClient: sapClient,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// WorkOrder represents a SAP PM work order.
type WorkOrder struct {
	OrderID          string    `json:"orderId"`
	OrderType        string    `json:"orderType"`
	Description      string    `json:"description"`
	FunctionalLoc    string    `json:"functionalLocation"`
	Equipment        string    `json:"equipment"`
	Priority         string    `json:"priority"`
	Status           string    `json:"status"`
	PlannedStartDate time.Time `json:"plannedStartDate"`
	PlannedEndDate   time.Time `json:"plannedEndDate"`
	ActualStartDate  time.Time `json:"actualStartDate,omitempty"`
	ActualEndDate    time.Time `json:"actualEndDate,omitempty"`
	CostCenter       string    `json:"costCenter"`
	PlannedCost      float64   `json:"plannedCost"`
	ActualCost       float64   `json:"actualCost"`
	Currency         string    `json:"currency"`
	WellID           string    `json:"wellId"` // Custom field Z_WELL_ID
}

// CreateWorkOrderRequest represents a request to create a SAP PM work order.
type CreateWorkOrderRequest struct {
	WellID       string  `json:"wellId"`
	OrderType    string  `json:"orderType"` // PM01=Corrective, PM02=Preventive, PM03=Inspection
	Description  string  `json:"description"`
	Priority     string  `json:"priority"` // 1=Very High, 2=High, 3=Medium, 4=Low
	CostCenter   string  `json:"costCenter"`
	PlannedStart string  `json:"plannedStart"` // ISO 8601
	PlannedEnd   string  `json:"plannedEnd"`
	PlannedCost  float64 `json:"plannedCost"`
	Currency     string  `json:"currency"`
}

// CreateWorkOrderResult represents the result of creating a SAP work order.
type CreateWorkOrderResult struct {
	OrderID string `json:"orderId"`
	Message string `json:"message"`
}

// CostCenter represents a SAP cost center.
type CostCenter struct {
	CostCenterID   string `json:"costCenterId"`
	Description    string `json:"description"`
	ControllingArea string `json:"controllingArea"`
	CompanyCode    string `json:"companyCode"`
	ValidFrom      string `json:"validFrom"`
	ValidTo        string `json:"validTo"`
}

// GLPosting represents a SAP General Ledger posting.
type GLPosting struct {
	DocumentNumber string    `json:"documentNumber"`
	PostingDate    time.Time `json:"postingDate"`
	GLAccount      string    `json:"glAccount"`
	CostCenter     string    `json:"costCenter"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`
	Text           string    `json:"text"`
	Reference      string    `json:"reference"`
}

// Material represents a SAP material master record.
type Material struct {
	MaterialID   string  `json:"materialId"`
	Description  string  `json:"description"`
	MaterialType string  `json:"materialType"`
	BaseUnit     string  `json:"baseUnit"`
	Plant        string  `json:"plant"`
	StorageLoc   string  `json:"storageLocation"`
	StockQty     float64 `json:"stockQuantity"`
	UnitPrice    float64 `json:"unitPrice"`
	Currency     string  `json:"currency"`
}

// ─── API Methods ──────────────────────────────────────────────────────────────

// GetWorkOrders retrieves PM work orders, optionally filtered by well ID.
func (c *Client) GetWorkOrders(ctx context.Context, wellID string) ([]WorkOrder, error) {
	if c.baseURL == "" {
		return c.mockWorkOrders(wellID), nil
	}

	endpoint := "/sap/opu/odata/sap/API_MAINTENANCEORDER_SRV/MaintenanceOrderSet"
	params := url.Values{}
	params.Set("$format", "json")
	params.Set("$top", "100")
	if wellID != "" {
		params.Set("$filter", fmt.Sprintf("ZWellId eq '%s'", wellID))
	}

	body, err := c.get(ctx, endpoint+"?"+params.Encode())
	if err != nil {
		return nil, err
	}

	var result struct {
		D struct {
			Results []WorkOrder `json:"results"`
		} `json:"d"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("SAP parse error: %w", err)
	}
	return result.D.Results, nil
}

// CreateWorkOrder creates a new PM work order in SAP.
func (c *Client) CreateWorkOrder(ctx context.Context, req CreateWorkOrderRequest) (*CreateWorkOrderResult, error) {
	if c.baseURL == "" {
		return &CreateWorkOrderResult{
			OrderID: fmt.Sprintf("WO-%d", time.Now().Unix()),
			Message: "Work order created (simulated)",
		}, nil
	}

	endpoint := "/sap/opu/odata/sap/API_MAINTENANCEORDER_SRV/MaintenanceOrderSet"
	payload, _ := json.Marshal(map[string]interface{}{
		"OrderType":     req.OrderType,
		"OrderDesc":     req.Description,
		"Priority":      req.Priority,
		"CostCenter":    req.CostCenter,
		"ZWellId":       req.WellID,
		"PlannedStart":  req.PlannedStart,
		"PlannedEnd":    req.PlannedEnd,
		"PlannedCost":   req.PlannedCost,
		"Currency":      req.Currency,
	})

	body, err := c.post(ctx, endpoint, payload)
	if err != nil {
		return nil, err
	}

	var result struct {
		D struct {
			OrderID string `json:"OrderId"`
		} `json:"d"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("SAP parse error: %w", err)
	}
	return &CreateWorkOrderResult{OrderID: result.D.OrderID, Message: "Created"}, nil
}

// GetCostCenters retrieves SAP cost centers.
func (c *Client) GetCostCenters(ctx context.Context) ([]CostCenter, error) {
	if c.baseURL == "" {
		return c.mockCostCenters(), nil
	}
	endpoint := "/sap/opu/odata/sap/API_COSTCENTER_0001/A_CostCenter?$format=json"
	body, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	var result struct {
		D struct {
			Results []CostCenter `json:"results"`
		} `json:"d"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("SAP parse error: %w", err)
	}
	return result.D.Results, nil
}

// GetGLPostings retrieves GL postings for a date range.
func (c *Client) GetGLPostings(ctx context.Context, from, to string) ([]GLPosting, error) {
	if c.baseURL == "" {
		return c.mockGLPostings(), nil
	}
	endpoint := fmt.Sprintf(
		"/sap/opu/odata/sap/API_GLACCOUNTLINEITEM_SRV/A_GLAccountLineItem?$format=json&$filter=PostingDate ge datetime'%sT00:00:00' and PostingDate le datetime'%sT23:59:59'",
		from, to,
	)
	body, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	var result struct {
		D struct {
			Results []GLPosting `json:"results"`
		} `json:"d"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("SAP parse error: %w", err)
	}
	return result.D.Results, nil
}

// GetMaterials retrieves material master records for a plant.
func (c *Client) GetMaterials(ctx context.Context, plant string) ([]Material, error) {
	if c.baseURL == "" {
		return c.mockMaterials(), nil
	}
	endpoint := fmt.Sprintf(
		"/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$format=json&$filter=Plant eq '%s'",
		plant,
	)
	body, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	var result struct {
		D struct {
			Results []Material `json:"results"`
		} `json:"d"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("SAP parse error: %w", err)
	}
	return result.D.Results, nil
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("sap-client", c.sapClient)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SAP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("SAP HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

func (c *Client) post(ctx context.Context, path string, payload []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path,
		strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("sap-client", c.sapClient)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SAP POST failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("SAP HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ─── Mock data (used when SAP_BASE_URL is not configured) ─────────────────────

func (c *Client) mockWorkOrders(wellID string) []WorkOrder {
	now := time.Now()
	orders := []WorkOrder{
		{
			OrderID: "WO-4000123", OrderType: "PM02", Description: "Quarterly ESP inspection",
			FunctionalLoc: "WELL-W001", Equipment: "ESP-W001-01", Priority: "2",
			Status: "OPEN", PlannedStartDate: now.Add(48 * time.Hour),
			PlannedEndDate: now.Add(72 * time.Hour), CostCenter: "CC-PROD-001",
			PlannedCost: 12500.00, Currency: "USD", WellID: "W-001",
		},
		{
			OrderID: "WO-4000124", OrderType: "PM01", Description: "Wellhead pressure sensor replacement",
			FunctionalLoc: "WELL-W003", Equipment: "PRESS-W003-01", Priority: "1",
			Status: "IN_PROGRESS", PlannedStartDate: now.Add(-24 * time.Hour),
			PlannedEndDate: now.Add(24 * time.Hour), CostCenter: "CC-MAINT-001",
			PlannedCost: 4200.00, ActualCost: 3800.00, Currency: "USD", WellID: "W-003",
		},
	}
	if wellID != "" {
		filtered := make([]WorkOrder, 0)
		for _, o := range orders {
			if o.WellID == wellID {
				filtered = append(filtered, o)
			}
		}
		return filtered
	}
	return orders
}

func (c *Client) mockCostCenters() []CostCenter {
	return []CostCenter{
		{CostCenterID: "CC-PROD-001", Description: "Production Operations", ControllingArea: "1000", CompanyCode: "OG01"},
		{CostCenterID: "CC-MAINT-001", Description: "Maintenance & Integrity", ControllingArea: "1000", CompanyCode: "OG01"},
		{CostCenterID: "CC-DRILL-001", Description: "Drilling Operations", ControllingArea: "1000", CompanyCode: "OG01"},
		{CostCenterID: "CC-HSE-001", Description: "HSE & Compliance", ControllingArea: "1000", CompanyCode: "OG01"},
	}
}

func (c *Client) mockGLPostings() []GLPosting {
	return []GLPosting{
		{DocumentNumber: "GL-2025-001234", PostingDate: time.Now().Add(-24 * time.Hour), GLAccount: "4100000", CostCenter: "CC-PROD-001", Amount: 45230.00, Currency: "USD", Text: "Production chemicals"},
		{DocumentNumber: "GL-2025-001235", PostingDate: time.Now().Add(-48 * time.Hour), GLAccount: "4200000", CostCenter: "CC-MAINT-001", Amount: 12800.00, Currency: "USD", Text: "ESP replacement parts"},
	}
}

func (c *Client) mockMaterials() []Material {
	return []Material{
		{MaterialID: "MAT-10001234", Description: "Corrosion inhibitor 55gal drum", MaterialType: "ZCHE", BaseUnit: "EA", Plant: "OG01", StorageLoc: "WH01", StockQty: 48, UnitPrice: 285.00, Currency: "USD"},
		{MaterialID: "MAT-10001235", Description: "ESP pump stage assembly", MaterialType: "ZEQU", BaseUnit: "EA", Plant: "OG01", StorageLoc: "WH02", StockQty: 3, UnitPrice: 8500.00, Currency: "USD"},
	}
}
