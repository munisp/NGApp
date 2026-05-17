package erpnext

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client represents an ERPNext API client
type Client struct {
	baseURL    string
	apiKey     string
	apiSecret  string
	httpClient *http.Client
}

// NewClient creates a new ERPNext API client
func NewClient(baseURL, apiKey, apiSecret string) *Client {
	return &Client{
		baseURL:   baseURL,
		apiKey:    apiKey,
		apiSecret: apiSecret,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// JournalEntry represents an ERPNext Journal Entry
type JournalEntry struct {
	DocType         string                `json:"doctype"`
	Title           string                `json:"title"`
	VoucherType     string                `json:"voucher_type"`
	PostingDate     string                `json:"posting_date"`
	Company         string                `json:"company"`
	UserRemark      string                `json:"user_remark"`
	Accounts        []JournalEntryAccount `json:"accounts"`
	ChequeNo        string                `json:"cheque_no,omitempty"`
	ChequeDate      string                `json:"cheque_date,omitempty"`
	ReferenceNumber string                `json:"reference_number,omitempty"`
}

// JournalEntryAccount represents an account line in a journal entry
type JournalEntryAccount struct {
	Account      string  `json:"account"`
	DebitInAccountCurrency  float64 `json:"debit_in_account_currency,omitempty"`
	CreditInAccountCurrency float64 `json:"credit_in_account_currency,omitempty"`
	CostCenter   string  `json:"cost_center,omitempty"`
	Project      string  `json:"project,omitempty"`
	ReferenceType string `json:"reference_type,omitempty"`
	ReferenceName string `json:"reference_name,omitempty"`
}

// Customer represents an ERPNext Customer
type Customer struct {
	DocType       string `json:"doctype"`
	CustomerName  string `json:"customer_name"`
	CustomerType  string `json:"customer_type"`
	CustomerGroup string `json:"customer_group"`
	Territory     string `json:"territory"`
	EmailID       string `json:"email_id,omitempty"`
	MobileNo      string `json:"mobile_no,omitempty"`
	TaxID         string `json:"tax_id,omitempty"`
}

// Employee represents an ERPNext Employee
type Employee struct {
	DocType       string `json:"doctype"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name,omitempty"`
	Company       string `json:"company"`
	DateOfJoining string `json:"date_of_joining"`
	Gender        string `json:"gender"`
	Status        string `json:"status"`
	EmployeeNumber string `json:"employee_number,omitempty"`
	CellNumber    string `json:"cell_number,omitempty"`
	PersonalEmail string `json:"personal_email,omitempty"`
}

// PaymentEntry represents an ERPNext Payment Entry
type PaymentEntry struct {
	DocType         string                 `json:"doctype"`
	PaymentType     string                 `json:"payment_type"`
	PostingDate     string                 `json:"posting_date"`
	Company         string                 `json:"company"`
	Mode            string                 `json:"mode_of_payment"`
	Party           string                 `json:"party,omitempty"`
	PartyType       string                 `json:"party_type,omitempty"`
	PaidFrom        string                 `json:"paid_from"`
	PaidTo          string                 `json:"paid_to"`
	PaidAmount      float64                `json:"paid_amount"`
	ReceivedAmount  float64                `json:"received_amount"`
	ReferenceNo     string                 `json:"reference_no,omitempty"`
	ReferenceDate   string                 `json:"reference_date,omitempty"`
	References      []PaymentEntryReference `json:"references,omitempty"`
}

// PaymentEntryReference represents a reference in a payment entry
type PaymentEntryReference struct {
	ReferenceDoctype string  `json:"reference_doctype"`
	ReferenceName    string  `json:"reference_name"`
	AllocatedAmount  float64 `json:"allocated_amount"`
}

// File represents an ERPNext File
type File struct {
	DocType        string `json:"doctype"`
	FileName       string `json:"file_name"`
	FileURL        string `json:"file_url,omitempty"`
	IsPrivate      int    `json:"is_private"`
	AttachedToDoctype string `json:"attached_to_doctype,omitempty"`
	AttachedToName    string `json:"attached_to_name,omitempty"`
	Content        string `json:"content,omitempty"` // Base64 encoded
}

// APIResponse represents a generic ERPNext API response
type APIResponse struct {
	Data    json.RawMessage `json:"data,omitempty"`
	Message interface{}     `json:"message,omitempty"`
	Exc     string          `json:"exc,omitempty"`
}

// CreateJournalEntry creates a new journal entry in ERPNext
func (c *Client) CreateJournalEntry(ctx context.Context, entry *JournalEntry) (string, error) {
	entry.DocType = "Journal Entry"
	
	data := map[string]interface{}{
		"data": entry,
	}
	
	resp, err := c.post(ctx, "/api/resource/Journal Entry", data)
	if err != nil {
		return "", fmt.Errorf("failed to create journal entry: %w", err)
	}
	
	var result struct {
		Data struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	
	return result.Data.Name, nil
}

// SubmitJournalEntry submits a journal entry (changes status from Draft to Submitted)
func (c *Client) SubmitJournalEntry(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("/api/resource/Journal Entry/%s", url.PathEscape(name))
	
	data := map[string]interface{}{
		"docstatus": 1, // 1 = Submitted
	}
	
	_, err := c.put(ctx, endpoint, data)
	if err != nil {
		return fmt.Errorf("failed to submit journal entry: %w", err)
	}
	
	return nil
}

// CreateCustomer creates a new customer in ERPNext
func (c *Client) CreateCustomer(ctx context.Context, customer *Customer) (string, error) {
	customer.DocType = "Customer"
	
	data := map[string]interface{}{
		"data": customer,
	}
	
	resp, err := c.post(ctx, "/api/resource/Customer", data)
	if err != nil {
		return "", fmt.Errorf("failed to create customer: %w", err)
	}
	
	var result struct {
		Data struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	
	return result.Data.Name, nil
}

// UpdateCustomer updates an existing customer in ERPNext
func (c *Client) UpdateCustomer(ctx context.Context, name string, customer *Customer) error {
	endpoint := fmt.Sprintf("/api/resource/Customer/%s", url.PathEscape(name))
	
	data := map[string]interface{}{
		"data": customer,
	}
	
	_, err := c.put(ctx, endpoint, data)
	if err != nil {
		return fmt.Errorf("failed to update customer: %w", err)
	}
	
	return nil
}

// GetCustomer retrieves a customer from ERPNext
func (c *Client) GetCustomer(ctx context.Context, name string) (*Customer, error) {
	endpoint := fmt.Sprintf("/api/resource/Customer/%s", url.PathEscape(name))
	
	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}
	
	var result struct {
		Data Customer `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	return &result.Data, nil
}

// CreateEmployee creates a new employee in ERPNext
func (c *Client) CreateEmployee(ctx context.Context, employee *Employee) (string, error) {
	employee.DocType = "Employee"
	
	data := map[string]interface{}{
		"data": employee,
	}
	
	resp, err := c.post(ctx, "/api/resource/Employee", data)
	if err != nil {
		return "", fmt.Errorf("failed to create employee: %w", err)
	}
	
	var result struct {
		Data struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	
	return result.Data.Name, nil
}

// CreatePaymentEntry creates a new payment entry in ERPNext
func (c *Client) CreatePaymentEntry(ctx context.Context, payment *PaymentEntry) (string, error) {
	payment.DocType = "Payment Entry"
	
	data := map[string]interface{}{
		"data": payment,
	}
	
	resp, err := c.post(ctx, "/api/resource/Payment Entry", data)
	if err != nil {
		return "", fmt.Errorf("failed to create payment entry: %w", err)
	}
	
	var result struct {
		Data struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	
	return result.Data.Name, nil
}

// SubmitPaymentEntry submits a payment entry
func (c *Client) SubmitPaymentEntry(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("/api/resource/Payment Entry/%s", url.PathEscape(name))
	
	data := map[string]interface{}{
		"docstatus": 1, // 1 = Submitted
	}
	
	_, err := c.put(ctx, endpoint, data)
	if err != nil {
		return fmt.Errorf("failed to submit payment entry: %w", err)
	}
	
	return nil
}

// UploadFile uploads a file to ERPNext
func (c *Client) UploadFile(ctx context.Context, file *File) (string, error) {
	file.DocType = "File"
	
	data := map[string]interface{}{
		"data": file,
	}
	
	resp, err := c.post(ctx, "/api/resource/File", data)
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}
	
	var result struct {
		Data struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	
	return result.Data.Name, nil
}

// Get performs a GET request to ERPNext API (public method)
func (c *Client) Get(ctx context.Context, endpoint string) ([]byte, error) {
	return c.get(ctx, endpoint)
}

// get performs a GET request to ERPNext API
func (c *Client) get(ctx context.Context, endpoint string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	
	c.setAuthHeaders(req)
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ERPNext API error: %s (status %d)", string(body), resp.StatusCode)
	}
	
	return body, nil
}

// post performs a POST request to ERPNext API
func (c *Client) post(ctx context.Context, endpoint string, data interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ERPNext API error: %s (status %d)", string(body), resp.StatusCode)
	}
	
	return body, nil
}

// put performs a PUT request to ERPNext API
func (c *Client) put(ctx context.Context, endpoint string, data interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "PUT", c.baseURL+endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ERPNext API error: %s (status %d)", string(body), resp.StatusCode)
	}
	
	return body, nil
}

// setAuthHeaders sets the authentication headers for ERPNext API requests
func (c *Client) setAuthHeaders(req *http.Request) {
	token := fmt.Sprintf("%s:%s", c.apiKey, c.apiSecret)
	req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
}
