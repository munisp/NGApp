//go:build ignore

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb // pb "github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/proto"
)

const (
	bankingServiceAddr = "localhost:8080"
	crmServiceAddr     = "localhost:8081"
	apiGatewayAddr     = "localhost:9080"
	keycloakAddr       = "localhost:8090"
)

var (
	bankingClient pb.BankingEventServiceClient
	crmClient     pb.CRMProfileServiceClient
	authToken     string
)

func TestMain(m *testing.M) {
	// Setup
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Connect to Banking Service
	bankingConn, err := grpc.DialContext(ctx, bankingServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		fmt.Printf("Failed to connect to Banking Service: %v\n", err)
		os.Exit(1)
	}
	defer bankingConn.Close()
	bankingClient = pb.NewBankingEventServiceClient(bankingConn)

	// Connect to CRM Service
	crmConn, err := grpc.DialContext(ctx, crmServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		fmt.Printf("Failed to connect to CRM Service: %v\n", err)
		os.Exit(1)
	}
	defer crmConn.Close()
	crmClient = pb.NewCRMProfileServiceClient(crmConn)

	// Get auth token
	authToken = getAuthToken()

	// Run tests
	exitCode := m.Run()

	// Teardown
	os.Exit(exitCode)
}

func getAuthToken() string {
	// Get auth token from Keycloak
	tokenURL := fmt.Sprintf("http://%s/auth/realms/banking/protocol/openid-connect/token", keycloakAddr)
	
	req, err := http.NewRequest("POST", tokenURL, nil)
	if err != nil {
		fmt.Printf("Failed to create token request: %v\n", err)
		os.Exit(1)
	}
	
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth("integration-test-client", "integration-test-secret")
	
	q := req.URL.Query()
	q.Add("grant_type", "client_credentials")
	q.Add("scope", "banking-crm-api")
	req.URL.RawQuery = q.Encode()
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to get auth token: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Failed to get auth token: %s\n", resp.Status)
		os.Exit(1)
	}
	
	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		fmt.Printf("Failed to decode token response: %v\n", err)
		os.Exit(1)
	}
	
	return tokenResp.AccessToken
}

func TestCustomerProfileSync(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// Create a test customer in Banking Service
	customerID := fmt.Sprintf("test-customer-%d", time.Now().Unix())
	
	createReq := &pb.CreateCustomerRequest{
		Customer: &pb.Customer{
			Id:        customerID,
			FirstName: "John",
			LastName:  "Doe",
			Email:     fmt.Sprintf("john.doe.%d@example.com", time.Now().Unix()),
			Phone:     "+2341234567890",
			Address: &pb.Address{
				Street:  "123 Main St",
				City:    "Lagos",
				State:   "Lagos",
				Country: "Nigeria",
				ZipCode: "100001",
			},
			DateOfBirth:    "1990-01-01",
			IdType:         "NATIONAL_ID",
			IdNumber:       fmt.Sprintf("NIN%d", time.Now().Unix()),
			AccountNumbers: []string{fmt.Sprintf("ACC%d", time.Now().Unix())},
		},
	}
	
	// Create customer in Banking Service
	createResp, err := bankingClient.CreateCustomer(ctx, createReq)
	require.NoError(t, err)
	assert.NotNil(t, createResp)
	assert.Equal(t, customerID, createResp.Customer.Id)
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Verify customer was synced to CRM Service
	getReq := &pb.GetCustomerRequest{
		Id: customerID,
	}
	
	getResp, err := crmClient.GetCustomer(ctx, getReq)
	require.NoError(t, err)
	assert.NotNil(t, getResp)
	assert.Equal(t, customerID, getResp.Customer.Id)
	assert.Equal(t, createReq.Customer.FirstName, getResp.Customer.FirstName)
	assert.Equal(t, createReq.Customer.LastName, getResp.Customer.LastName)
	assert.Equal(t, createReq.Customer.Email, getResp.Customer.Email)
	
	// Update customer in CRM Service
	updateReq := &pb.UpdateCustomerRequest{
		Customer: &pb.Customer{
			Id:        customerID,
			FirstName: "John",
			LastName:  "Smith", // Changed last name
			Email:     getResp.Customer.Email,
			Phone:     getResp.Customer.Phone,
			Address:   getResp.Customer.Address,
		},
	}
	
	updateResp, err := crmClient.UpdateCustomer(ctx, updateReq)
	require.NoError(t, err)
	assert.NotNil(t, updateResp)
	assert.Equal(t, "Smith", updateResp.Customer.LastName)
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Verify customer was synced back to Banking Service
	getBankingReq := &pb.GetCustomerRequest{
		Id: customerID,
	}
	
	getBankingResp, err := bankingClient.GetCustomer(ctx, getBankingReq)
	require.NoError(t, err)
	assert.NotNil(t, getBankingResp)
	assert.Equal(t, customerID, getBankingResp.Customer.Id)
	assert.Equal(t, "Smith", getBankingResp.Customer.LastName) // Verify last name was updated
}

func TestTransactionEventSync(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// Create a test transaction in Banking Service
	transactionID := fmt.Sprintf("test-transaction-%d", time.Now().Unix())
	customerID := fmt.Sprintf("test-customer-%d", time.Now().Unix())
	
	// First create a customer
	createCustomerReq := &pb.CreateCustomerRequest{
		Customer: &pb.Customer{
			Id:        customerID,
			FirstName: "Jane",
			LastName:  "Doe",
			Email:     fmt.Sprintf("jane.doe.%d@example.com", time.Now().Unix()),
			Phone:     "+2341234567891",
		},
	}
	
	_, err := bankingClient.CreateCustomer(ctx, createCustomerReq)
	require.NoError(t, err)
	
	// Wait for event propagation
	time.Sleep(2 * time.Second)
	
	// Create a transaction
	createTransactionReq := &pb.CreateTransactionRequest{
		Transaction: &pb.Transaction{
			Id:          transactionID,
			CustomerId:  customerID,
			Amount:      1000.50,
			Currency:    "NGN",
			Type:        "DEPOSIT",
			Status:      "COMPLETED",
			Description: "Test deposit",
			Timestamp:   time.Now().Unix(),
			Channel:     "MOBILE",
			Reference:   fmt.Sprintf("REF%d", time.Now().Unix()),
		},
	}
	
	createTransactionResp, err := bankingClient.CreateTransaction(ctx, createTransactionReq)
	require.NoError(t, err)
	assert.NotNil(t, createTransactionResp)
	assert.Equal(t, transactionID, createTransactionResp.Transaction.Id)
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Verify transaction was synced to CRM Service
	getTransactionReq := &pb.GetTransactionRequest{
		Id: transactionID,
	}
	
	getTransactionResp, err := crmClient.GetTransaction(ctx, getTransactionReq)
	require.NoError(t, err)
	assert.NotNil(t, getTransactionResp)
	assert.Equal(t, transactionID, getTransactionResp.Transaction.Id)
	assert.Equal(t, customerID, getTransactionResp.Transaction.CustomerId)
	assert.Equal(t, createTransactionReq.Transaction.Amount, getTransactionResp.Transaction.Amount)
	assert.Equal(t, createTransactionReq.Transaction.Type, getTransactionResp.Transaction.Type)
	
	// Verify customer activity was updated in CRM
	getCustomerActivityReq := &pb.GetCustomerActivityRequest{
		CustomerId: customerID,
	}
	
	getCustomerActivityResp, err := crmClient.GetCustomerActivity(ctx, getCustomerActivityReq)
	require.NoError(t, err)
	assert.NotNil(t, getCustomerActivityResp)
	assert.GreaterOrEqual(t, len(getCustomerActivityResp.Activities), 1)
	
	// Find our transaction in the activities
	var found bool
	for _, activity := range getCustomerActivityResp.Activities {
		if activity.TransactionId == transactionID {
			found = true
			assert.Equal(t, "DEPOSIT", activity.Type)
			assert.Equal(t, 1000.50, activity.Amount)
			break
		}
	}
	assert.True(t, found, "Transaction activity not found in customer activities")
}

func TestFraudAlertSync(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// Create a test fraud alert in Banking Service
	alertID := fmt.Sprintf("test-alert-%d", time.Now().Unix())
	customerID := fmt.Sprintf("test-customer-%d", time.Now().Unix())
	
	// First create a customer
	createCustomerReq := &pb.CreateCustomerRequest{
		Customer: &pb.Customer{
			Id:        customerID,
			FirstName: "Alice",
			LastName:  "Smith",
			Email:     fmt.Sprintf("alice.smith.%d@example.com", time.Now().Unix()),
			Phone:     "+2341234567892",
		},
	}
	
	_, err := bankingClient.CreateCustomer(ctx, createCustomerReq)
	require.NoError(t, err)
	
	// Wait for event propagation
	time.Sleep(2 * time.Second)
	
	// Create a fraud alert
	createAlertReq := &pb.CreateFraudAlertRequest{
		Alert: &pb.FraudAlert{
			Id:          alertID,
			CustomerId:  customerID,
			Type:        "SUSPICIOUS_TRANSACTION",
			Severity:    "HIGH",
			Description: "Unusual transaction pattern detected",
			Timestamp:   time.Now().Unix(),
			Status:      "OPEN",
			Source:      "AI_DETECTION",
			RelatedTransactionIds: []string{
				fmt.Sprintf("tx-%d", time.Now().Unix()),
			},
		},
	}
	
	createAlertResp, err := bankingClient.CreateFraudAlert(ctx, createAlertReq)
	require.NoError(t, err)
	assert.NotNil(t, createAlertResp)
	assert.Equal(t, alertID, createAlertResp.Alert.Id)
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Verify fraud alert was synced to CRM Service
	getAlertReq := &pb.GetFraudAlertRequest{
		Id: alertID,
	}
	
	getAlertResp, err := crmClient.GetFraudAlert(ctx, getAlertReq)
	require.NoError(t, err)
	assert.NotNil(t, getAlertResp)
	assert.Equal(t, alertID, getAlertResp.Alert.Id)
	assert.Equal(t, customerID, getAlertResp.Alert.CustomerId)
	assert.Equal(t, createAlertReq.Alert.Type, getAlertResp.Alert.Type)
	assert.Equal(t, createAlertReq.Alert.Severity, getAlertResp.Alert.Severity)
	
	// Update fraud alert status in CRM
	updateAlertReq := &pb.UpdateFraudAlertRequest{
		Alert: &pb.FraudAlert{
			Id:     alertID,
			Status: "RESOLVED",
			Resolution: &pb.FraudAlertResolution{
				ResolutionType: "FALSE_POSITIVE",
				Notes:          "Customer confirmed transaction was legitimate",
				ResolvedBy:     "test-user",
				ResolvedAt:     time.Now().Unix(),
			},
		},
	}
	
	updateAlertResp, err := crmClient.UpdateFraudAlert(ctx, updateAlertReq)
	require.NoError(t, err)
	assert.NotNil(t, updateAlertResp)
	assert.Equal(t, "RESOLVED", updateAlertResp.Alert.Status)
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Verify fraud alert status was synced back to Banking Service
	getBankingAlertReq := &pb.GetFraudAlertRequest{
		Id: alertID,
	}
	
	getBankingAlertResp, err := bankingClient.GetFraudAlert(ctx, getBankingAlertReq)
	require.NoError(t, err)
	assert.NotNil(t, getBankingAlertResp)
	assert.Equal(t, alertID, getBankingAlertResp.Alert.Id)
	assert.Equal(t, "RESOLVED", getBankingAlertResp.Alert.Status)
	assert.NotNil(t, getBankingAlertResp.Alert.Resolution)
	assert.Equal(t, "FALSE_POSITIVE", getBankingAlertResp.Alert.Resolution.ResolutionType)
}

func TestAPIGatewayIntegration(t *testing.T) {
	// Test API Gateway integration with Banking and CRM services
	customerID := fmt.Sprintf("test-customer-%d", time.Now().Unix())
	
	// Create customer through API Gateway
	createCustomerURL := fmt.Sprintf("http://%s/api/v1/banking/customers", apiGatewayAddr)
	
	createCustomerPayload := map[string]interface{}{
		"id":         customerID,
		"first_name": "Robert",
		"last_name":  "Johnson",
		"email":      fmt.Sprintf("robert.johnson.%d@example.com", time.Now().Unix()),
		"phone":      "+2341234567893",
		"address": map[string]interface{}{
			"street":   "456 Oak St",
			"city":     "Abuja",
			"state":    "FCT",
			"country":  "Nigeria",
			"zip_code": "900001",
		},
	}
	
	createCustomerBody, err := json.Marshal(createCustomerPayload)
	require.NoError(t, err)
	
	req, err := http.NewRequest("POST", createCustomerURL, nil)
	require.NoError(t, err)
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", authToken))
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	
	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	
	var createResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&createResp)
	require.NoError(t, err)
	
	customer, ok := createResp["customer"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, customerID, customer["id"])
	
	// Wait for event propagation
	time.Sleep(5 * time.Second)
	
	// Get customer from CRM through API Gateway
	getCRMCustomerURL := fmt.Sprintf("http://%s/api/v1/crm/customers/%s", apiGatewayAddr, customerID)
	
	req, err = http.NewRequest("GET", getCRMCustomerURL, nil)
	require.NoError(t, err)
	
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", authToken))
	
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	
	var getResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&getResp)
	require.NoError(t, err)
	
	crmCustomer, ok := getResp["customer"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, customerID, crmCustomer["id"])
	assert.Equal(t, "Robert", crmCustomer["first_name"])
	assert.Equal(t, "Johnson", crmCustomer["last_name"])
}

