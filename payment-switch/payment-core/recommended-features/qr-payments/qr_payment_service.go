package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/skip2/go-qrcode"
)

// QRPaymentRequest represents a request to generate a QR code for payment
type QRPaymentRequest struct {
	MerchantID      string  `json:"merchant_id"`
	MerchantName    string  `json:"merchant_name"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	TransactionNote string  `json:"transaction_note"`
	ExpiryMinutes   int     `json:"expiry_minutes"`
}

// QRPaymentResponse represents the response containing the QR code
type QRPaymentResponse struct {
	QRCodeID     string    `json:"qr_code_id"`
	QRCodeData   string    `json:"qr_code_data"`
	QRCodeImage  string    `json:"qr_code_image"` // Base64 encoded PNG
	ExpiresAt    time.Time `json:"expires_at"`
	PaymentURL   string    `json:"payment_url"`
	DeepLinkURL  string    `json:"deep_link_url"`
}

// QRPaymentData represents the data encoded in the QR code
type QRPaymentData struct {
	Version         string    `json:"version"`
	QRCodeID        string    `json:"qr_code_id"`
	MerchantID      string    `json:"merchant_id"`
	MerchantName    string    `json:"merchant_name"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	TransactionNote string    `json:"transaction_note"`
	Timestamp       time.Time `json:"timestamp"`
	ExpiresAt       time.Time `json:"expires_at"`
	Signature       string    `json:"signature"`
}

// PaymentConfirmation represents a payment made via QR code
type PaymentConfirmation struct {
	QRCodeID      string    `json:"qr_code_id"`
	PayerID       string    `json:"payer_id"`
	PayerName     string    `json:"payer_name"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	TransactionID string    `json:"transaction_id"`
	Timestamp     time.Time `json:"timestamp"`
	Status        string    `json:"status"`
}

// QRPaymentService handles QR code payment operations
type QRPaymentService struct {
	secretKey string
}

// NewQRPaymentService creates a new QR payment service
func NewQRPaymentService(secretKey string) *QRPaymentService {
	return &QRPaymentService{
		secretKey: secretKey,
	}
}

// GenerateQRCode generates a QR code for payment
func (s *QRPaymentService) GenerateQRCode(w http.ResponseWriter, r *http.Request) {
	var req QRPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.MerchantID == "" || req.Amount <= 0 || req.Currency == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Set default expiry if not provided
	if req.ExpiryMinutes == 0 {
		req.ExpiryMinutes = 15
	}

	// Generate QR code ID
	qrCodeID := uuid.New().String()
	now := time.Now()
	expiresAt := now.Add(time.Duration(req.ExpiryMinutes) * time.Minute)

	// Create QR payment data
	qrData := QRPaymentData{
		Version:         "1.0",
		QRCodeID:        qrCodeID,
		MerchantID:      req.MerchantID,
		MerchantName:    req.MerchantName,
		Amount:          req.Amount,
		Currency:        req.Currency,
		TransactionNote: req.TransactionNote,
		Timestamp:       now,
		ExpiresAt:       expiresAt,
	}

	// Sign the QR data
	qrData.Signature = s.signQRData(qrData)

	// Encode QR data to JSON
	qrDataJSON, err := json.Marshal(qrData)
	if err != nil {
		http.Error(w, "Failed to encode QR data", http.StatusInternalServerError)
		return
	}

	// Generate QR code image
	qrCode, err := qrcode.Encode(string(qrDataJSON), qrcode.Medium, 256)
	if err != nil {
		http.Error(w, "Failed to generate QR code", http.StatusInternalServerError)
		return
	}

	// Encode QR code image to base64
	qrCodeBase64 := base64.StdEncoding.EncodeToString(qrCode)

	// Create payment URL and deep link
	paymentURL := fmt.Sprintf("https://payment.example.com/qr/%s", qrCodeID)
	deepLinkURL := fmt.Sprintf("paymentapp://qr/%s", qrCodeID)

	// Create response
	response := QRPaymentResponse{
		QRCodeID:    qrCodeID,
		QRCodeData:  string(qrDataJSON),
		QRCodeImage: qrCodeBase64,
		ExpiresAt:   expiresAt,
		PaymentURL:  paymentURL,
		DeepLinkURL: deepLinkURL,
	}

	// Store QR code in Redis/database (implementation omitted for brevity)
	// s.storeQRCode(qrCodeID, qrData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// VerifyQRCode verifies and retrieves QR code data
func (s *QRPaymentService) VerifyQRCode(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	qrCodeID := vars["qr_code_id"]

	// Retrieve QR code from Redis/database (implementation omitted)
	// qrData, err := s.retrieveQRCode(qrCodeID)

	// For demonstration, we'll parse from request body
	var qrData QRPaymentData
	if err := json.NewDecoder(r.Body).Decode(&qrData); err != nil {
		http.Error(w, "Invalid QR data", http.StatusBadRequest)
		return
	}

	// Verify signature
	if !s.verifyQRSignature(qrData) {
		http.Error(w, "Invalid QR code signature", http.StatusUnauthorized)
		return
	}

	// Check expiry
	if time.Now().After(qrData.ExpiresAt) {
		http.Error(w, "QR code has expired", http.StatusGone)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(qrData)
}

// ProcessPayment processes a payment made via QR code
func (s *QRPaymentService) ProcessPayment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QRCodeData string  `json:"qr_code_data"`
		PayerID    string  `json:"payer_id"`
		PayerName  string  `json:"payer_name"`
		PIN        string  `json:"pin"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Parse QR code data
	var qrData QRPaymentData
	if err := json.Unmarshal([]byte(req.QRCodeData), &qrData); err != nil {
		http.Error(w, "Invalid QR data", http.StatusBadRequest)
		return
	}

	// Verify signature
	if !s.verifyQRSignature(qrData) {
		http.Error(w, "Invalid QR code signature", http.StatusUnauthorized)
		return
	}

	// Check expiry
	if time.Now().After(qrData.ExpiresAt) {
		http.Error(w, "QR code has expired", http.StatusGone)
		return
	}

	// Verify PIN (implementation omitted)
	// if !s.verifyPIN(req.PayerID, req.PIN) {
	//     http.Error(w, "Invalid PIN", http.StatusUnauthorized)
	//     return
	// }

	// Process payment through core payment switch
	transactionID := uuid.New().String()
	
	// Call ledger service to debit payer and credit merchant
	// s.processLedgerTransaction(req.PayerID, qrData.MerchantID, qrData.Amount)

	// Create payment confirmation
	confirmation := PaymentConfirmation{
		QRCodeID:      qrData.QRCodeID,
		PayerID:       req.PayerID,
		PayerName:     req.PayerName,
		Amount:        qrData.Amount,
		Currency:      qrData.Currency,
		TransactionID: transactionID,
		Timestamp:     time.Now(),
		Status:        "SUCCESS",
	}

	// Send notification to merchant
	// s.notifyMerchant(qrData.MerchantID, confirmation)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(confirmation)
}

// GetPaymentStatus retrieves the status of a QR code payment
func (s *QRPaymentService) GetPaymentStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	qrCodeID := vars["qr_code_id"]

	// Retrieve payment status from database (implementation omitted)
	// status, err := s.retrievePaymentStatus(qrCodeID)

	// For demonstration
	status := map[string]interface{}{
		"qr_code_id": qrCodeID,
		"status":     "PENDING",
		"message":    "Waiting for payment",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// signQRData signs the QR data using HMAC-SHA256
func (s *QRPaymentService) signQRData(data QRPaymentData) string {
	// Create signature payload
	payload := fmt.Sprintf("%s|%s|%s|%.2f|%s|%d",
		data.QRCodeID,
		data.MerchantID,
		data.Currency,
		data.Amount,
		data.Timestamp.Format(time.RFC3339),
		data.ExpiresAt.Unix(),
	)

	// Calculate HMAC-SHA256
	h := sha256.New()
	h.Write([]byte(payload + s.secretKey))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	return signature
}

// verifyQRSignature verifies the QR data signature
func (s *QRPaymentService) verifyQRSignature(data QRPaymentData) bool {
	expectedSignature := s.signQRData(data)
	return data.Signature == expectedSignature
}

func main() {
	// Initialize service
	service := NewQRPaymentService("your-secret-key-here")

	// Create router
	router := mux.NewRouter()

	// Register routes
	router.HandleFunc("/api/v1/qr/generate", service.GenerateQRCode).Methods("POST")
	router.HandleFunc("/api/v1/qr/verify/{qr_code_id}", service.VerifyQRCode).Methods("POST")
	router.HandleFunc("/api/v1/qr/payment", service.ProcessPayment).Methods("POST")
	router.HandleFunc("/api/v1/qr/status/{qr_code_id}", service.GetPaymentStatus).Methods("GET")

	// Start server
	log.Println("QR Payment Service starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}
