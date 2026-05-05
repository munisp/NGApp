package sdk

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// OpenAPISpec represents the platform's OpenAPI 3.0 specification
type OpenAPISpec struct {
	OpenAPI string                 `json:"openapi"`
	Info    APIInfo                `json:"info"`
	Servers []APIServer            `json:"servers"`
	Paths   map[string]PathItem    `json:"paths"`
	Components map[string]interface{} `json:"components,omitempty"`
}

type APIInfo struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
	Contact     struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		URL   string `json:"url"`
	} `json:"contact"`
	License struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"license"`
}

type APIServer struct {
	URL         string `json:"url"`
	Description string `json:"description"`
}

type PathItem struct {
	Get    *Operation `json:"get,omitempty"`
	Post   *Operation `json:"post,omitempty"`
	Put    *Operation `json:"put,omitempty"`
	Delete *Operation `json:"delete,omitempty"`
	Patch  *Operation `json:"patch,omitempty"`
}

type Operation struct {
	Summary     string              `json:"summary"`
	Description string              `json:"description"`
	OperationID string              `json:"operationId"`
	Tags        []string            `json:"tags"`
	Parameters  []Parameter         `json:"parameters,omitempty"`
	RequestBody *RequestBody        `json:"requestBody,omitempty"`
	Responses   map[string]Response `json:"responses"`
	Security    []map[string][]string `json:"security,omitempty"`
}

type Parameter struct {
	Name        string      `json:"name"`
	In          string      `json:"in"`
	Description string      `json:"description"`
	Required    bool        `json:"required"`
	Schema      SchemaRef   `json:"schema"`
}

type RequestBody struct {
	Description string                 `json:"description"`
	Required    bool                   `json:"required"`
	Content     map[string]MediaType   `json:"content"`
}

type MediaType struct {
	Schema SchemaRef `json:"schema"`
}

type SchemaRef struct {
	Type       string                `json:"type,omitempty"`
	Format     string                `json:"format,omitempty"`
	Ref        string                `json:"$ref,omitempty"`
	Properties map[string]SchemaRef  `json:"properties,omitempty"`
	Items      *SchemaRef            `json:"items,omitempty"`
	Required   []string              `json:"required,omitempty"`
	Enum       []string              `json:"enum,omitempty"`
}

type Response struct {
	Description string               `json:"description"`
	Content     map[string]MediaType `json:"content,omitempty"`
}

// SDKLanguage represents supported SDK languages
type SDKLanguage string

const (
	SDKPython     SDKLanguage = "python"
	SDKJavaScript SDKLanguage = "javascript"
	SDKGo         SDKLanguage = "go"
	SDKJava       SDKLanguage = "java"
	SDKRuby       SDKLanguage = "ruby"
)

// SDKDownload represents a generated SDK package
type SDKDownload struct {
	Language    SDKLanguage `json:"language"`
	Version     string      `json:"version"`
	PackageName string      `json:"package_name"`
	Size        string      `json:"size"`
	GeneratedAt time.Time   `json:"generated_at"`
	DownloadURL string      `json:"download_url"`
	InstallCmd  string      `json:"install_command"`
	Checksum    string      `json:"checksum"`
}

// SDKService manages OpenAPI spec generation and SDK distribution
type SDKService struct {
	spec     *OpenAPISpec
	sdks     map[SDKLanguage]*SDKDownload
	baseURL  string
}

// NewSDKService creates a new SDK service with the platform's API specification
func NewSDKService(baseURL string) *SDKService {
	svc := &SDKService{
		baseURL: baseURL,
		sdks:    make(map[SDKLanguage]*SDKDownload),
	}
	svc.buildSpec()
	svc.generateSDKs()
	return svc
}

func (s *SDKService) buildSpec() {
	s.spec = &OpenAPISpec{
		OpenAPI: "3.0.3",
		Info: APIInfo{
			Title:       "Enterprise Banking CRM API",
			Description: "Multi-tenant banking CRM platform API for core banking, agent banking, remittance, and payments integration. Supports per-tenant product entitlements, data isolation, and role-based access control via Permify.",
			Version:     "2.1.0",
		},
		Servers: []APIServer{
			{URL: "https://api.banking-crm.example.com/v1", Description: "Production"},
			{URL: "https://sandbox.banking-crm.example.com/v1", Description: "Sandbox"},
			{URL: "http://localhost:9080/v1", Description: "Local Development"},
		},
		Paths: s.buildPaths(),
		Components: map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"bearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
					"description":  "JWT token obtained from Keycloak OIDC endpoint",
				},
				"apiKeyAuth": map[string]interface{}{
					"type": "apiKey",
					"in":   "header",
					"name": "X-API-Key",
					"description": "API key issued via the self-service portal",
				},
				"tenantHeader": map[string]interface{}{
					"type": "apiKey",
					"in":   "header",
					"name": "X-Tenant-ID",
					"description": "Tenant identifier for multi-tenant isolation",
				},
			},
			"schemas": s.buildSchemas(),
		},
	}
	s.spec.Info.Contact.Name = "Platform Engineering"
	s.spec.Info.Contact.Email = "api-support@banking-crm.example.com"
	s.spec.Info.Contact.URL = "https://docs.banking-crm.example.com"
	s.spec.Info.License.Name = "Proprietary"
}

func (s *SDKService) buildPaths() map[string]PathItem {
	tenantHeader := Parameter{
		Name: "X-Tenant-ID", In: "header", Description: "Tenant identifier",
		Required: true, Schema: SchemaRef{Type: "string"},
	}
	paths := map[string]PathItem{
		"/customers": {
			Get: &Operation{
				Summary: "List customers", OperationID: "listCustomers",
				Tags: []string{"Customers"}, Parameters: []Parameter{
					tenantHeader,
					{Name: "page", In: "query", Description: "Page number", Schema: SchemaRef{Type: "integer"}},
					{Name: "limit", In: "query", Description: "Items per page", Schema: SchemaRef{Type: "integer"}},
					{Name: "source", In: "query", Description: "Filter by source system", Schema: SchemaRef{Type: "string", Enum: []string{"core-banking", "agent-banking", "remittance"}}},
					{Name: "segment", In: "query", Description: "Customer segment", Schema: SchemaRef{Type: "string"}},
				},
				Responses: map[string]Response{
					"200": {Description: "Customer list", Content: map[string]MediaType{"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CustomerList"}}}},
					"401": {Description: "Unauthorized"},
					"403": {Description: "Product not enabled for tenant"},
					"429": {Description: "Rate limit exceeded"},
				},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
			Post: &Operation{
				Summary: "Create customer", OperationID: "createCustomer",
				Tags: []string{"Customers"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CreateCustomerRequest"}},
					},
				},
				Responses: map[string]Response{
					"201": {Description: "Customer created", Content: map[string]MediaType{"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/Customer"}}}},
					"400": {Description: "Validation error"},
					"409": {Description: "Duplicate customer"},
				},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/customers/{customerId}": {
			Get: &Operation{
				Summary: "Get customer by ID", OperationID: "getCustomer",
				Tags: []string{"Customers"}, Parameters: []Parameter{
					tenantHeader,
					{Name: "customerId", In: "path", Required: true, Schema: SchemaRef{Type: "string"}},
				},
				Responses: map[string]Response{
					"200": {Description: "Customer details", Content: map[string]MediaType{"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/Customer"}}}},
					"404": {Description: "Customer not found"},
				},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
			Put: &Operation{
				Summary: "Update customer", OperationID: "updateCustomer",
				Tags: []string{"Customers"}, Parameters: []Parameter{
					tenantHeader,
					{Name: "customerId", In: "path", Required: true, Schema: SchemaRef{Type: "string"}},
				},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/UpdateCustomerRequest"}},
					},
				},
				Responses: map[string]Response{"200": {Description: "Customer updated"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/tenants": {
			Get: &Operation{
				Summary: "List tenants", OperationID: "listTenants",
				Tags: []string{"Tenants"},
				Responses: map[string]Response{
					"200": {Description: "Tenant list", Content: map[string]MediaType{"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/TenantList"}}}},
				},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/tenants/{tenantId}/products": {
			Get: &Operation{
				Summary: "Get tenant product entitlements", OperationID: "getTenantProducts",
				Tags: []string{"Tenants"}, Parameters: []Parameter{
					{Name: "tenantId", In: "path", Required: true, Schema: SchemaRef{Type: "string"}},
				},
				Responses: map[string]Response{
					"200": {Description: "Product entitlements"},
				},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
			Put: &Operation{
				Summary: "Update tenant products", OperationID: "updateTenantProducts",
				Tags: []string{"Tenants"}, Parameters: []Parameter{
					{Name: "tenantId", In: "path", Required: true, Schema: SchemaRef{Type: "string"}},
				},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/UpdateProductsRequest"}},
					},
				},
				Responses: map[string]Response{"200": {Description: "Products updated"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/banking/accounts": {
			Get: &Operation{
				Summary: "List accounts", OperationID: "listAccounts",
				Tags: []string{"Core Banking"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Account list"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/banking/transactions": {
			Get: &Operation{
				Summary: "List transactions", OperationID: "listTransactions",
				Tags: []string{"Core Banking"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Transaction list"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
			Post: &Operation{
				Summary: "Create transaction", OperationID: "createTransaction",
				Tags: []string{"Core Banking"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CreateTransactionRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "Transaction created"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/agents": {
			Get: &Operation{
				Summary: "List agents", OperationID: "listAgents",
				Tags: []string{"Agent Banking"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Agent list"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/agents/{agentId}/transactions": {
			Post: &Operation{
				Summary: "Process agent transaction", OperationID: "processAgentTransaction",
				Tags: []string{"Agent Banking"}, Parameters: []Parameter{
					tenantHeader,
					{Name: "agentId", In: "path", Required: true, Schema: SchemaRef{Type: "string"}},
				},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/AgentTransactionRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "Transaction processed"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/remittance/corridors": {
			Get: &Operation{
				Summary: "List remittance corridors", OperationID: "listCorridors",
				Tags: []string{"Remittance"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Corridor list"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/remittance/transfers": {
			Post: &Operation{
				Summary: "Initiate remittance transfer", OperationID: "initiateTransfer",
				Tags: []string{"Remittance"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/TransferRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "Transfer initiated"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/campaigns": {
			Get: &Operation{
				Summary: "List campaigns", OperationID: "listCampaigns",
				Tags: []string{"Campaigns"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Campaign list"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
			Post: &Operation{
				Summary: "Create campaign", OperationID: "createCampaign",
				Tags: []string{"Campaigns"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CreateCampaignRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "Campaign created"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/analytics/dashboard": {
			Get: &Operation{
				Summary: "Get dashboard metrics", OperationID: "getDashboardMetrics",
				Tags: []string{"Analytics"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Dashboard metrics"}},
				Security: []map[string][]string{{"bearerAuth": {}}, {"apiKeyAuth": {}}},
			},
		},
		"/webhooks": {
			Get: &Operation{
				Summary: "List webhook subscriptions", OperationID: "listWebhooks",
				Tags: []string{"Webhooks"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "Webhook list"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
			Post: &Operation{
				Summary: "Create webhook subscription", OperationID: "createWebhook",
				Tags: []string{"Webhooks"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CreateWebhookRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "Webhook created"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
		"/api-keys": {
			Get: &Operation{
				Summary: "List API keys", OperationID: "listAPIKeys",
				Tags: []string{"API Keys"}, Parameters: []Parameter{tenantHeader},
				Responses: map[string]Response{"200": {Description: "API key list"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
			Post: &Operation{
				Summary: "Create API key", OperationID: "createAPIKey",
				Tags: []string{"API Keys"}, Parameters: []Parameter{tenantHeader},
				RequestBody: &RequestBody{
					Required: true, Content: map[string]MediaType{
						"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/CreateAPIKeyRequest"}},
					},
				},
				Responses: map[string]Response{"201": {Description: "API key created"}},
				Security: []map[string][]string{{"bearerAuth": {}}},
			},
		},
	}
	return paths
}

func (s *SDKService) buildSchemas() map[string]interface{} {
	return map[string]interface{}{
		"Customer": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":          map[string]string{"type": "string"},
				"tenant_id":   map[string]string{"type": "string"},
				"name":        map[string]string{"type": "string"},
				"email":       map[string]interface{}{"type": "string", "format": "email"},
				"phone":       map[string]string{"type": "string"},
				"source":      map[string]interface{}{"type": "string", "enum": []string{"core-banking", "agent-banking", "remittance"}},
				"segment":     map[string]string{"type": "string"},
				"status":      map[string]string{"type": "string"},
				"created_at":  map[string]interface{}{"type": "string", "format": "date-time"},
				"updated_at":  map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"Tenant": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":                map[string]string{"type": "string"},
				"name":              map[string]string{"type": "string"},
				"slug":              map[string]string{"type": "string"},
				"status":            map[string]interface{}{"type": "string", "enum": []string{"active", "suspended", "trial", "pending"}},
				"subscription_tier": map[string]interface{}{"type": "string", "enum": []string{"trial", "growth", "enterprise"}},
				"products":          map[string]interface{}{"type": "object", "additionalProperties": map[string]string{"type": "boolean"}},
			},
		},
	}
}

func (s *SDKService) generateSDKs() {
	now := time.Now()
	s.sdks[SDKPython] = &SDKDownload{
		Language: SDKPython, Version: "2.1.0", PackageName: "banking-crm-sdk",
		Size: "245 KB", GeneratedAt: now, Checksum: "sha256:a1b2c3d4e5f6",
		DownloadURL: "/api/sdk/download/python",
		InstallCmd:  "pip install banking-crm-sdk",
	}
	s.sdks[SDKJavaScript] = &SDKDownload{
		Language: SDKJavaScript, Version: "2.1.0", PackageName: "@banking-crm/sdk",
		Size: "189 KB", GeneratedAt: now, Checksum: "sha256:f6e5d4c3b2a1",
		DownloadURL: "/api/sdk/download/javascript",
		InstallCmd:  "npm install @banking-crm/sdk",
	}
	s.sdks[SDKGo] = &SDKDownload{
		Language: SDKGo, Version: "2.1.0", PackageName: "github.com/banking-crm/sdk-go",
		Size: "312 KB", GeneratedAt: now, Checksum: "sha256:1a2b3c4d5e6f",
		DownloadURL: "/api/sdk/download/go",
		InstallCmd:  "go get github.com/banking-crm/sdk-go@v2.1.0",
	}
	s.sdks[SDKJava] = &SDKDownload{
		Language: SDKJava, Version: "2.1.0", PackageName: "com.banking-crm:sdk",
		Size: "428 KB", GeneratedAt: now, Checksum: "sha256:6f5e4d3c2b1a",
		DownloadURL: "/api/sdk/download/java",
		InstallCmd:  `implementation 'com.banking-crm:sdk:2.1.0'`,
	}
	s.sdks[SDKRuby] = &SDKDownload{
		Language: SDKRuby, Version: "2.1.0", PackageName: "banking_crm_sdk",
		Size: "178 KB", GeneratedAt: now, Checksum: "sha256:b1c2d3e4f5a6",
		DownloadURL: "/api/sdk/download/ruby",
		InstallCmd:  "gem install banking_crm_sdk",
	}
}

// GeneratePythonSnippet generates a Python code example for a given endpoint
func (s *SDKService) GeneratePythonSnippet(endpoint, method string) string {
	return fmt.Sprintf(`from banking_crm_sdk import BankingCRMClient

client = BankingCRMClient(
    base_url="https://api.banking-crm.example.com/v1",
    api_key="your-api-key",
    tenant_id="tenant-acme-bank"
)

# %s %s
response = client.%s()
print(response.json())`, strings.ToUpper(method), endpoint, operationFromPath(endpoint, method))
}

// GenerateJSSnippet generates a JavaScript code example
func (s *SDKService) GenerateJSSnippet(endpoint, method string) string {
	return fmt.Sprintf(`import { BankingCRMClient } from '@banking-crm/sdk';

const client = new BankingCRMClient({
  baseUrl: 'https://api.banking-crm.example.com/v1',
  apiKey: 'your-api-key',
  tenantId: 'tenant-acme-bank',
});

// %s %s
const response = await client.%s();
console.log(response);`, strings.ToUpper(method), endpoint, operationFromPath(endpoint, method))
}

// GenerateGoSnippet generates a Go code example
func (s *SDKService) GenerateGoSnippet(endpoint, method string) string {
	return fmt.Sprintf(`package main

import (
    "fmt"
    sdk "github.com/banking-crm/sdk-go"
)

func main() {
    client := sdk.NewClient(
        sdk.WithBaseURL("https://api.banking-crm.example.com/v1"),
        sdk.WithAPIKey("your-api-key"),
        sdk.WithTenantID("tenant-acme-bank"),
    )

    // %s %s
    resp, err := client.%s(ctx)
    if err != nil {
        panic(err)
    }
    fmt.Println(resp)
}`, strings.ToUpper(method), endpoint, strings.Title(operationFromPath(endpoint, method)))
}

func operationFromPath(path, method string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return "request"
	}
	resource := parts[len(parts)-1]
	switch method {
	case "get":
		return "list_" + resource
	case "post":
		return "create_" + resource
	case "put":
		return "update_" + resource
	case "delete":
		return "delete_" + resource
	default:
		return resource
	}
}

// RegisterHTTPHandlers registers SDK API endpoints
func (s *SDKService) RegisterHTTPHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/sdk/spec", s.handleGetSpec)
	mux.HandleFunc("/api/sdk/downloads", s.handleListSDKs)
	mux.HandleFunc("/api/sdk/snippet", s.handleGetSnippet)
}

func (s *SDKService) handleGetSpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.spec)
}

func (s *SDKService) handleListSDKs(w http.ResponseWriter, r *http.Request) {
	sdkList := make([]*SDKDownload, 0, len(s.sdks))
	for _, sdk := range s.sdks {
		sdkList = append(sdkList, sdk)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sdkList)
}

func (s *SDKService) handleGetSnippet(w http.ResponseWriter, r *http.Request) {
	lang := r.URL.Query().Get("language")
	endpoint := r.URL.Query().Get("endpoint")
	method := r.URL.Query().Get("method")
	if endpoint == "" {
		endpoint = "/customers"
	}
	if method == "" {
		method = "get"
	}

	var snippet string
	switch SDKLanguage(lang) {
	case SDKPython:
		snippet = s.GeneratePythonSnippet(endpoint, method)
	case SDKJavaScript:
		snippet = s.GenerateJSSnippet(endpoint, method)
	case SDKGo:
		snippet = s.GenerateGoSnippet(endpoint, method)
	default:
		snippet = s.GeneratePythonSnippet(endpoint, method)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"snippet": snippet, "language": lang})
}
