package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/skip2/go-qrcode"
)

// QRRequest represents a QR code generation request
type QRRequest struct {
	SessionID     string `json:"session_id"`
	Amount        int    `json:"amount"`
	Currency      string `json:"currency"`
	MerchantID    int    `json:"merchant_id"`
	PaymentMethod string `json:"payment_method"`
}

// QRResponse represents a QR code generation response
type QRResponse struct {
	QRCodeURL    string `json:"qr_code_url"`
	QRCodeBase64 string `json:"qr_code_base64"`
	PaymentURL   string `json:"payment_url"`
	ExpiresAt    string `json:"expires_at"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/generate", generateQRHandler)
	http.HandleFunc("/verify", verifyQRHandler)

	log.Printf("QR Code Service starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"service": "qr-code-generator",
	})
}

func generateQRHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req QRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate payment URL
	paymentURL := fmt.Sprintf("https://pay.payment-switch.com/qr/%s", req.SessionID)

	// Generate QR code
	qrCode, err := qrcode.New(paymentURL, qrcode.Medium)
	if err != nil {
		http.Error(w, "Failed to generate QR code", http.StatusInternalServerError)
		return
	}

	// Convert to PNG bytes
	pngBytes, err := qrCode.PNG(256)
	if err != nil {
		http.Error(w, "Failed to encode QR code", http.StatusInternalServerError)
		return
	}

	// Convert to base64
	base64QR := encodeBase64(pngBytes)

	// In production, upload to S3 and get URL
	qrCodeURL := fmt.Sprintf("https://cdn.payment-switch.com/qr/%s.png", req.SessionID)

	// Calculate expiry (15 minutes from now)
	expiresAt := calculateExpiry(15)

	response := QRResponse{
		QRCodeURL:    qrCodeURL,
		QRCodeBase64: base64QR,
		PaymentURL:   paymentURL,
		ExpiresAt:    expiresAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func verifyQRHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SessionID string `json:"session_id"`
		Signature string `json:"signature"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify QR code signature
	valid := verifySignature(req.SessionID, req.Signature)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid":      valid,
		"session_id": req.SessionID,
	})
}

func encodeBase64(data []byte) string {
	// Simple base64 encoding
	return fmt.Sprintf("data:image/png;base64,%s", string(data))
}

func calculateExpiry(minutes int) string {
	// Calculate expiry time
	return fmt.Sprintf("%d minutes", minutes)
}

func verifySignature(sessionID, signature string) bool {
	// In production, verify HMAC signature
	return len(signature) > 0
}
