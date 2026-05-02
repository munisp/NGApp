package banking

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

type BankAccount struct {
	AccountNumber string `json:"accountNumber"`
	AccountName   string `json:"accountName"`
	BankCode      string `json:"bankCode"`
	BankName      string `json:"bankName"`
	BVN           string `json:"bvn,omitempty"`
	Currency      string `json:"currency"`
}

type BankTransferRequest struct {
	FromAccount string  `json:"fromAccount"`
	ToAccount   string  `json:"toAccount"`
	ToBankCode  string  `json:"toBankCode"`
	Amount      float64 `json:"amount"`
	Narration   string  `json:"narration"`
	Reference   string  `json:"reference"`
}

type BankTransferResponse struct {
	SessionID       string    `json:"sessionId"`
	Reference       string    `json:"reference"`
	ResponseCode    string    `json:"responseCode"`
	ResponseMessage string    `json:"responseMessage"`
	Amount          float64   `json:"amount"`
	TransactionDate time.Time `json:"transactionDate"`
}

type TransferStatus string

const (
	TransferStatusPending    TransferStatus = "pending"
	TransferStatusProcessing TransferStatus = "processing"
	TransferStatusCompleted  TransferStatus = "completed"
	TransferStatusFailed     TransferStatus = "failed"
	TransferStatusReversed   TransferStatus = "reversed"
)

type BankTransferStatus struct {
	Reference       string         `json:"reference"`
	Status          TransferStatus `json:"status"`
	ResponseCode    string         `json:"responseCode"`
	ResponseMessage string         `json:"responseMessage"`
	Amount          float64        `json:"amount,omitempty"`
	CompletedAt     *time.Time     `json:"completedAt,omitempty"`
}

type BVNVerificationResult struct {
	BVN         string  `json:"bvn"`
	FirstName   string  `json:"firstName"`
	LastName    string  `json:"lastName"`
	DateOfBirth string  `json:"dateOfBirth"`
	PhoneNumber string  `json:"phoneNumber"`
	Verified    bool    `json:"verified"`
	MatchScore  float64 `json:"matchScore,omitempty"`
}

type NigerianBank struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	ShortName string `json:"shortName"`
}

type NIBSSService struct {
	mu              sync.RWMutex
	apiURL          string
	apiKey          string
	institutionCode string
	httpClient      *http.Client
	banks           []NigerianBank
}

func NewNIBSSService() *NIBSSService {
	apiURL := os.Getenv("NIBSS_API_URL")
	if apiURL == "" {
		apiURL = "https://api.nibss-plc.com.ng"
	}

	service := &NIBSSService{
		apiURL:          apiURL,
		apiKey:          os.Getenv("NIBSS_API_KEY"),
		institutionCode: os.Getenv("NIBSS_INSTITUTION_CODE"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		banks: initializeNigerianBanks(),
	}

	return service
}

func initializeNigerianBanks() []NigerianBank {
	return []NigerianBank{
		{Code: "044", Name: "Access Bank Plc", ShortName: "Access Bank"},
		{Code: "063", Name: "Access Bank (Diamond) Plc", ShortName: "Diamond Bank"},
		{Code: "050", Name: "Ecobank Nigeria Plc", ShortName: "Ecobank"},
		{Code: "070", Name: "Fidelity Bank Plc", ShortName: "Fidelity Bank"},
		{Code: "011", Name: "First Bank of Nigeria Limited", ShortName: "First Bank"},
		{Code: "214", Name: "First City Monument Bank Plc", ShortName: "FCMB"},
		{Code: "058", Name: "Guaranty Trust Bank Plc", ShortName: "GTBank"},
		{Code: "030", Name: "Heritage Banking Company Ltd", ShortName: "Heritage Bank"},
		{Code: "301", Name: "Jaiz Bank Plc", ShortName: "Jaiz Bank"},
		{Code: "082", Name: "Keystone Bank Limited", ShortName: "Keystone Bank"},
		{Code: "526", Name: "Parallex Bank Ltd", ShortName: "Parallex Bank"},
		{Code: "076", Name: "Polaris Bank Limited", ShortName: "Polaris Bank"},
		{Code: "101", Name: "Providus Bank", ShortName: "Providus Bank"},
		{Code: "221", Name: "Stanbic IBTC Bank Plc", ShortName: "Stanbic IBTC"},
		{Code: "068", Name: "Standard Chartered Bank Nigeria Ltd", ShortName: "Standard Chartered"},
		{Code: "232", Name: "Sterling Bank Plc", ShortName: "Sterling Bank"},
		{Code: "100", Name: "Suntrust Bank Nigeria Limited", ShortName: "Suntrust Bank"},
		{Code: "032", Name: "Union Bank of Nigeria Plc", ShortName: "Union Bank"},
		{Code: "033", Name: "United Bank For Africa Plc", ShortName: "UBA"},
		{Code: "215", Name: "Unity Bank Plc", ShortName: "Unity Bank"},
		{Code: "035", Name: "Wema Bank Plc", ShortName: "Wema Bank"},
		{Code: "057", Name: "Zenith Bank Plc", ShortName: "Zenith Bank"},
		{Code: "304", Name: "Globus Bank Limited", ShortName: "Globus Bank"},
		{Code: "090175", Name: "Rubies MFB", ShortName: "Rubies MFB"},
		{Code: "090267", Name: "Kuda Bank", ShortName: "Kuda"},
	}
}

func (s *NIBSSService) VerifyBankAccount(accountNumber, bankCode string) (*BankAccount, error) {
	requestID := generateUUID()

	reqBody := map[string]interface{}{
		"requestId":       requestID,
		"accountNumber":   accountNumber,
		"bankCode":        bankCode,
		"institutionCode": s.institutionCode,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/nameenquiry", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIBSS API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NIBSS verification error: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	responseCode, _ := data["responseCode"].(string)
	if responseCode != "00" {
		responseMessage, _ := data["responseMessage"].(string)
		return nil, fmt.Errorf("account verification failed: %s", responseMessage)
	}

	accountName, _ := data["accountName"].(string)
	bvn, _ := data["bvn"].(string)

	return &BankAccount{
		AccountNumber: accountNumber,
		AccountName:   accountName,
		BankCode:      bankCode,
		BankName:      s.GetBankName(bankCode),
		BVN:           bvn,
		Currency:      "NGN",
	}, nil
}

func (s *NIBSSService) InitiateTransfer(req *BankTransferRequest) (*BankTransferResponse, error) {
	sessionID := generateUUID()

	reqBody := map[string]interface{}{
		"sessionId":        sessionID,
		"fromAccount":      req.FromAccount,
		"toAccount":        req.ToAccount,
		"toBankCode":       req.ToBankCode,
		"amount":           req.Amount,
		"narration":        req.Narration,
		"paymentReference": req.Reference,
		"institutionCode":  s.institutionCode,
		"channelCode":      "7",
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.apiURL+"/nip/fundstransfer", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("NIBSS API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NIBSS transfer error: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	respSessionID, _ := data["sessionId"].(string)
	if respSessionID == "" {
		respSessionID = sessionID
	}

	responseCode, _ := data["responseCode"].(string)
	responseMessage, _ := data["responseMessage"].(string)
	transactionDateStr, _ := data["transactionDate"].(string)

	transactionDate := time.Now()
	if transactionDateStr != "" {
		if parsed, err := time.Parse(time.RFC3339, transactionDateStr); err == nil {
			transactionDate = parsed
		}
	}

	return &BankTransferResponse{
		SessionID:       respSessionID,
		Reference:       req.Reference,
		ResponseCode:    responseCode,
		ResponseMessage: responseMessage,
		Amount:          req.Amount,
		TransactionDate: transactionDate,
	}, nil
}

func (s *NIBSSService) GetTransferStatus(reference, sessionID string) (*BankTransferStatus, error) {
	reqBody := map[string]interface{}{
		"sessionId":        sessionID,
		"paymentReference": reference,
		"institutionCode":  s.institutionCode,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/nip/transactionstatus", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIBSS API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get transfer status: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	responseCode, _ := data["responseCode"].(string)
	responseMessage, _ := data["responseMessage"].(string)
	amount, _ := data["amount"].(float64)

	var status TransferStatus
	switch responseCode {
	case "00":
		status = TransferStatusCompleted
	case "09":
		status = TransferStatusProcessing
	case "51":
		status = TransferStatusFailed
	case "56":
		status = TransferStatusReversed
	default:
		status = TransferStatusPending
	}

	result := &BankTransferStatus{
		Reference:       reference,
		Status:          status,
		ResponseCode:    responseCode,
		ResponseMessage: responseMessage,
		Amount:          amount,
	}

	if status == TransferStatusCompleted {
		now := time.Now()
		result.CompletedAt = &now
	}

	return result, nil
}

func (s *NIBSSService) VerifyBVN(bvn, firstName, lastName, dateOfBirth string) (*BVNVerificationResult, error) {
	requestID := generateUUID()

	reqBody := map[string]interface{}{
		"requestId":       requestID,
		"bvn":             bvn,
		"firstName":       firstName,
		"lastName":        lastName,
		"dateOfBirth":     dateOfBirth,
		"institutionCode": s.institutionCode,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/bvnverification", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIBSS API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("BVN verification error: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	responseCode, _ := data["responseCode"].(string)
	if responseCode != "00" {
		responseMessage, _ := data["responseMessage"].(string)
		return nil, fmt.Errorf("BVN verification failed: %s", responseMessage)
	}

	respFirstName, _ := data["firstName"].(string)
	respLastName, _ := data["lastName"].(string)
	respDOB, _ := data["dateOfBirth"].(string)
	phoneNumber, _ := data["phoneNumber"].(string)

	var matchScore float64
	if firstName != "" || lastName != "" || dateOfBirth != "" {
		matches := 0
		total := 0

		if firstName != "" {
			total++
			if strings.EqualFold(respFirstName, firstName) {
				matches++
			}
		}
		if lastName != "" {
			total++
			if strings.EqualFold(respLastName, lastName) {
				matches++
			}
		}
		if dateOfBirth != "" {
			total++
			if respDOB == dateOfBirth {
				matches++
			}
		}

		if total > 0 {
			matchScore = float64(matches) / float64(total) * 100
		}
	}

	return &BVNVerificationResult{
		BVN:         bvn,
		FirstName:   respFirstName,
		LastName:    respLastName,
		DateOfBirth: respDOB,
		PhoneNumber: phoneNumber,
		Verified:    responseCode == "00",
		MatchScore:  matchScore,
	}, nil
}

func (s *NIBSSService) GetNigerianBanks() []NigerianBank {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.banks
}

func (s *NIBSSService) GetBankName(code string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, bank := range s.banks {
		if bank.Code == code {
			return bank.Name
		}
	}
	return "Unknown Bank"
}

func (s *NIBSSService) GetBankCode(name string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	nameLower := strings.ToLower(name)
	for _, bank := range s.banks {
		if strings.Contains(strings.ToLower(bank.Name), nameLower) ||
			strings.Contains(strings.ToLower(bank.ShortName), nameLower) {
			return bank.Code
		}
	}
	return ""
}

func ValidateAccountNumber(accountNumber string) bool {
	matched, _ := regexp.MatchString(`^\d{10}$`, accountNumber)
	return matched
}

func ValidateBVN(bvn string) bool {
	matched, _ := regexp.MatchString(`^\d{11}$`, bvn)
	return matched
}

func GenerateTransferReference(prefix string) string {
	if prefix == "" {
		prefix = "REM"
	}
	timestamp := time.Now().UnixMilli()
	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	random := strings.ToUpper(hex.EncodeToString(randomBytes))
	return fmt.Sprintf("%s%X%s", prefix, timestamp, random)
}

func CalculateTransferFee(amount float64) float64 {
	if amount <= 5000 {
		return 10
	} else if amount <= 50000 {
		return 25
	}
	return 50
}

func ValidateTransferAmount(amount float64) (bool, string) {
	const minAmount = 100
	const maxAmount = 10000000

	if amount < minAmount {
		return false, fmt.Sprintf("Minimum transfer amount is NGN %s", formatCurrency(minAmount))
	}
	if amount > maxAmount {
		return false, fmt.Sprintf("Maximum transfer amount is NGN %s", formatCurrency(maxAmount))
	}
	return true, ""
}

func FormatAmountForNIBSS(amountInNaira float64) int64 {
	return int64(amountInNaira * 100)
}

func ParseAmountFromNIBSS(amountInKobo int64) float64 {
	return float64(amountInKobo) / 100
}

func (s *NIBSSService) RetryTransfer(req *BankTransferRequest, maxRetries int) (*BankTransferResponse, error) {
	if maxRetries <= 0 {
		maxRetries = 3
	}

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		resp, err := s.InitiateTransfer(req)
		if err == nil {
			return resp, nil
		}

		lastErr = err

		if strings.Contains(err.Error(), "invalid") {
			return nil, err
		}

		if attempt < maxRetries {
			delay := time.Duration(1<<uint(attempt)) * time.Second
			time.Sleep(delay)
		}
	}

	return nil, lastErr
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func formatCurrency(amount float64) string {
	return fmt.Sprintf("%.2f", amount)
}
