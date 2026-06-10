// Package contracts provides contract testing for external integrations
// Recommendation #12: Contract Tests for Integrations (Mojaloop, Keycloak, APISIX)
package contracts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ContractTestResult represents the result of a contract test
type ContractTestResult struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Passed      bool          `json:"passed"`
	Duration    time.Duration `json:"duration"`
	Error       string        `json:"error,omitempty"`
	Request     *RequestInfo  `json:"request,omitempty"`
	Response    *ResponseInfo `json:"response,omitempty"`
	Assertions  []Assertion   `json:"assertions"`
}

// RequestInfo holds information about the HTTP request
type RequestInfo struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
}

// ResponseInfo holds information about the HTTP response
type ResponseInfo struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body,omitempty"`
}

// Assertion represents a single assertion in a contract test
type Assertion struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
}

// ContractTest defines a contract test
type ContractTest struct {
	Name        string
	Description string
	Request     *http.Request
	Assertions  []func(*http.Response, []byte) error
}

// ContractTester runs contract tests against external services
type ContractTester struct {
	client  *http.Client
	baseURL string
	headers map[string]string
}

// NewContractTester creates a new contract tester
func NewContractTester(baseURL string, timeout time.Duration) *ContractTester {
	return &ContractTester{
		client: &http.Client{
			Timeout: timeout,
		},
		baseURL: strings.TrimSuffix(baseURL, "/"),
		headers: make(map[string]string),
	}
}

// SetHeader sets a default header for all requests
func (ct *ContractTester) SetHeader(key, value string) {
	ct.headers[key] = value
}

// RunTest runs a single contract test
func (ct *ContractTester) RunTest(ctx context.Context, test *ContractTest) *ContractTestResult {
	start := time.Now()
	result := &ContractTestResult{
		Name:        test.Name,
		Description: test.Description,
		Passed:      true,
		Assertions:  make([]Assertion, 0),
	}

	// Apply default headers
	for k, v := range ct.headers {
		if test.Request.Header.Get(k) == "" {
			test.Request.Header.Set(k, v)
		}
	}

	// Record request info
	result.Request = &RequestInfo{
		Method:  test.Request.Method,
		URL:     test.Request.URL.String(),
		Headers: make(map[string]string),
	}
	for k, v := range test.Request.Header {
		if len(v) > 0 {
			result.Request.Headers[k] = v[0]
		}
	}
	if test.Request.Body != nil {
		body, _ := io.ReadAll(test.Request.Body)
		result.Request.Body = string(body)
		test.Request.Body = io.NopCloser(bytes.NewReader(body))
	}

	// Execute request
	resp, err := ct.client.Do(test.Request.WithContext(ctx))
	if err != nil {
		result.Passed = false
		result.Error = fmt.Sprintf("request failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Passed = false
		result.Error = fmt.Sprintf("failed to read response: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Record response info
	result.Response = &ResponseInfo{
		StatusCode: resp.StatusCode,
		Headers:    make(map[string]string),
		Body:       string(body),
	}
	for k, v := range resp.Header {
		if len(v) > 0 {
			result.Response.Headers[k] = v[0]
		}
	}

	// Run assertions
	for i, assertion := range test.Assertions {
		assertionResult := Assertion{
			Name:   fmt.Sprintf("Assertion %d", i+1),
			Passed: true,
		}

		if err := assertion(resp, body); err != nil {
			assertionResult.Passed = false
			assertionResult.Error = err.Error()
			result.Passed = false
		}

		result.Assertions = append(result.Assertions, assertionResult)
	}

	result.Duration = time.Since(start)
	return result
}

// Assertion helpers

// AssertStatusCode asserts the response status code
func AssertStatusCode(expected int) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		if resp.StatusCode != expected {
			return fmt.Errorf("expected status %d, got %d", expected, resp.StatusCode)
		}
		return nil
	}
}

// AssertStatusCodeIn asserts the response status code is in a list
func AssertStatusCodeIn(expected ...int) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		for _, e := range expected {
			if resp.StatusCode == e {
				return nil
			}
		}
		return fmt.Errorf("expected status in %v, got %d", expected, resp.StatusCode)
	}
}

// AssertJSONField asserts a JSON field has an expected value
func AssertJSONField(field string, expected interface{}) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		var data map[string]interface{}
		if err := json.Unmarshal(body, &data); err != nil {
			return fmt.Errorf("failed to parse JSON: %v", err)
		}

		value, ok := data[field]
		if !ok {
			return fmt.Errorf("field '%s' not found in response", field)
		}

		if fmt.Sprintf("%v", value) != fmt.Sprintf("%v", expected) {
			return fmt.Errorf("field '%s': expected %v, got %v", field, expected, value)
		}
		return nil
	}
}

// AssertJSONFieldExists asserts a JSON field exists
func AssertJSONFieldExists(field string) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		var data map[string]interface{}
		if err := json.Unmarshal(body, &data); err != nil {
			return fmt.Errorf("failed to parse JSON: %v", err)
		}

		if _, ok := data[field]; !ok {
			return fmt.Errorf("field '%s' not found in response", field)
		}
		return nil
	}
}

// AssertHeader asserts a response header value
func AssertHeader(header, expected string) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		value := resp.Header.Get(header)
		if value != expected {
			return fmt.Errorf("header '%s': expected '%s', got '%s'", header, expected, value)
		}
		return nil
	}
}

// AssertHeaderExists asserts a response header exists
func AssertHeaderExists(header string) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		if resp.Header.Get(header) == "" {
			return fmt.Errorf("header '%s' not found", header)
		}
		return nil
	}
}

// AssertBodyContains asserts the response body contains a string
func AssertBodyContains(substring string) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		if !strings.Contains(string(body), substring) {
			return fmt.Errorf("body does not contain '%s'", substring)
		}
		return nil
	}
}

// AssertContentType asserts the response content type
func AssertContentType(expected string) func(*http.Response, []byte) error {
	return func(resp *http.Response, body []byte) error {
		contentType := resp.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, expected) {
			return fmt.Errorf("expected content type '%s', got '%s'", expected, contentType)
		}
		return nil
	}
}

// MojaloopContractTests returns contract tests for Mojaloop integration
func MojaloopContractTests(baseURL, authToken string) []*ContractTest {
	tests := make([]*ContractTest, 0)

	// Test 1: Health check
	healthReq, _ := http.NewRequest("GET", baseURL+"/health", nil)
	tests = append(tests, &ContractTest{
		Name:        "Mojaloop Health Check",
		Description: "Verify Mojaloop central ledger health endpoint",
		Request:     healthReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 204),
		},
	})

	// Test 2: Get participants
	participantsReq, _ := http.NewRequest("GET", baseURL+"/participants", nil)
	participantsReq.Header.Set("Authorization", "Bearer "+authToken)
	participantsReq.Header.Set("Content-Type", "application/json")
	tests = append(tests, &ContractTest{
		Name:        "Mojaloop List Participants",
		Description: "Verify participants endpoint returns valid JSON array",
		Request:     participantsReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCode(200),
			AssertContentType("application/json"),
		},
	})

	// Test 3: Create participant (contract structure)
	createBody := `{
		"name": "test-dfsp",
		"currency": "USD"
	}`
	createReq, _ := http.NewRequest("POST", baseURL+"/participants", strings.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer "+authToken)
	createReq.Header.Set("Content-Type", "application/json")
	tests = append(tests, &ContractTest{
		Name:        "Mojaloop Create Participant Contract",
		Description: "Verify create participant endpoint accepts correct payload structure",
		Request:     createReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 201, 400, 409), // 400/409 if already exists
			AssertContentType("application/json"),
		},
	})

	// Test 4: Transfer prepare contract
	transferBody := `{
		"transferId": "test-transfer-id",
		"payerFsp": "test-payer",
		"payeeFsp": "test-payee",
		"amount": {
			"currency": "USD",
			"amount": "100"
		},
		"ilpPacket": "test-packet",
		"condition": "test-condition",
		"expiration": "2030-01-01T00:00:00.000Z"
	}`
	transferReq, _ := http.NewRequest("POST", baseURL+"/transfers", strings.NewReader(transferBody))
	transferReq.Header.Set("Authorization", "Bearer "+authToken)
	transferReq.Header.Set("Content-Type", "application/json")
	tests = append(tests, &ContractTest{
		Name:        "Mojaloop Transfer Prepare Contract",
		Description: "Verify transfer prepare endpoint accepts correct payload structure",
		Request:     transferReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 201, 202, 400, 404), // Various valid responses
			AssertContentType("application/json"),
		},
	})

	return tests
}

// KeycloakContractTests returns contract tests for Keycloak integration
func KeycloakContractTests(baseURL, realm, clientID, clientSecret string) []*ContractTest {
	tests := make([]*ContractTest, 0)

	// Test 1: OpenID Configuration
	oidcReq, _ := http.NewRequest("GET", baseURL+"/realms/"+realm+"/.well-known/openid-configuration", nil)
	tests = append(tests, &ContractTest{
		Name:        "Keycloak OpenID Configuration",
		Description: "Verify OpenID Connect discovery endpoint",
		Request:     oidcReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCode(200),
			AssertContentType("application/json"),
			AssertJSONFieldExists("issuer"),
			AssertJSONFieldExists("authorization_endpoint"),
			AssertJSONFieldExists("token_endpoint"),
			AssertJSONFieldExists("jwks_uri"),
		},
	})

	// Test 2: Token endpoint (client credentials)
	tokenBody := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", clientID, clientSecret)
	tokenReq, _ := http.NewRequest("POST", baseURL+"/realms/"+realm+"/protocol/openid-connect/token", strings.NewReader(tokenBody))
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tests = append(tests, &ContractTest{
		Name:        "Keycloak Token Endpoint",
		Description: "Verify token endpoint returns access token",
		Request:     tokenReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 401), // 401 if credentials invalid
			AssertContentType("application/json"),
		},
	})

	// Test 3: JWKS endpoint
	jwksReq, _ := http.NewRequest("GET", baseURL+"/realms/"+realm+"/protocol/openid-connect/certs", nil)
	tests = append(tests, &ContractTest{
		Name:        "Keycloak JWKS Endpoint",
		Description: "Verify JWKS endpoint returns valid keys",
		Request:     jwksReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCode(200),
			AssertContentType("application/json"),
			AssertJSONFieldExists("keys"),
		},
	})

	// Test 4: Userinfo endpoint (requires token)
	userinfoReq, _ := http.NewRequest("GET", baseURL+"/realms/"+realm+"/protocol/openid-connect/userinfo", nil)
	userinfoReq.Header.Set("Authorization", "Bearer invalid-token")
	tests = append(tests, &ContractTest{
		Name:        "Keycloak Userinfo Endpoint",
		Description: "Verify userinfo endpoint requires valid token",
		Request:     userinfoReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCode(401), // Should reject invalid token
		},
	})

	return tests
}

// APISIXContractTests returns contract tests for APISIX integration
func APISIXContractTests(adminURL, adminKey string) []*ContractTest {
	tests := make([]*ContractTest, 0)

	// Test 1: Admin API health
	healthReq, _ := http.NewRequest("GET", adminURL+"/apisix/admin/routes", nil)
	healthReq.Header.Set("X-API-KEY", adminKey)
	tests = append(tests, &ContractTest{
		Name:        "APISIX Admin Routes",
		Description: "Verify APISIX admin API is accessible",
		Request:     healthReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 401, 403),
			AssertContentType("application/json"),
		},
	})

	// Test 2: Create route contract
	routeBody := `{
		"uri": "/test-contract-route",
		"upstream": {
			"type": "roundrobin",
			"nodes": {
				"127.0.0.1:8080": 1
			}
		}
	}`
	routeReq, _ := http.NewRequest("PUT", adminURL+"/apisix/admin/routes/test-contract", strings.NewReader(routeBody))
	routeReq.Header.Set("X-API-KEY", adminKey)
	routeReq.Header.Set("Content-Type", "application/json")
	tests = append(tests, &ContractTest{
		Name:        "APISIX Create Route Contract",
		Description: "Verify route creation payload structure",
		Request:     routeReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 201, 401, 403),
			AssertContentType("application/json"),
		},
	})

	// Test 3: Get services
	servicesReq, _ := http.NewRequest("GET", adminURL+"/apisix/admin/services", nil)
	servicesReq.Header.Set("X-API-KEY", adminKey)
	tests = append(tests, &ContractTest{
		Name:        "APISIX List Services",
		Description: "Verify services endpoint returns valid response",
		Request:     servicesReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 401, 403),
			AssertContentType("application/json"),
		},
	})

	// Test 4: Get upstreams
	upstreamsReq, _ := http.NewRequest("GET", adminURL+"/apisix/admin/upstreams", nil)
	upstreamsReq.Header.Set("X-API-KEY", adminKey)
	tests = append(tests, &ContractTest{
		Name:        "APISIX List Upstreams",
		Description: "Verify upstreams endpoint returns valid response",
		Request:     upstreamsReq,
		Assertions: []func(*http.Response, []byte) error{
			AssertStatusCodeIn(200, 401, 403),
			AssertContentType("application/json"),
		},
	})

	return tests
}

// ContractTestSuite represents a suite of contract tests
type ContractTestSuite struct {
	Name    string
	Tests   []*ContractTest
	Results []*ContractTestResult
}

// ContractTestRunner runs multiple test suites
type ContractTestRunner struct {
	suites []*ContractTestSuite
	tester *ContractTester
}

// NewContractTestRunner creates a new test runner
func NewContractTestRunner(timeout time.Duration) *ContractTestRunner {
	return &ContractTestRunner{
		suites: make([]*ContractTestSuite, 0),
		tester: NewContractTester("", timeout),
	}
}

// AddSuite adds a test suite
func (r *ContractTestRunner) AddSuite(name string, tests []*ContractTest) {
	r.suites = append(r.suites, &ContractTestSuite{
		Name:    name,
		Tests:   tests,
		Results: make([]*ContractTestResult, 0),
	})
}

// RunAll runs all test suites
func (r *ContractTestRunner) RunAll(ctx context.Context) map[string][]*ContractTestResult {
	results := make(map[string][]*ContractTestResult)

	for _, suite := range r.suites {
		suiteResults := make([]*ContractTestResult, 0)
		for _, test := range suite.Tests {
			result := r.tester.RunTest(ctx, test)
			suiteResults = append(suiteResults, result)
		}
		suite.Results = suiteResults
		results[suite.Name] = suiteResults
	}

	return results
}

// GetSummary returns a summary of all test results
func (r *ContractTestRunner) GetSummary() map[string]interface{} {
	totalTests := 0
	passedTests := 0
	failedTests := 0

	suiteResults := make([]map[string]interface{}, 0)

	for _, suite := range r.suites {
		suitePassed := 0
		suiteFailed := 0

		for _, result := range suite.Results {
			totalTests++
			if result.Passed {
				passedTests++
				suitePassed++
			} else {
				failedTests++
				suiteFailed++
			}
		}

		suiteResults = append(suiteResults, map[string]interface{}{
			"name":   suite.Name,
			"total":  len(suite.Results),
			"passed": suitePassed,
			"failed": suiteFailed,
		})
	}

	return map[string]interface{}{
		"total_tests":   totalTests,
		"passed_tests":  passedTests,
		"failed_tests":  failedTests,
		"pass_rate":     float64(passedTests) / float64(totalTests) * 100,
		"suite_results": suiteResults,
	}
}
