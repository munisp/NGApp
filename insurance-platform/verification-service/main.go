package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

var db *sql.DB

// Config holds external API configurations
type Config struct {
	NIMCBaseURL      string
	NIMCAPIKey       string
	NIMCSecretKey    string
	CACBaseURL       string
	CACAPIKey        string
	CACSecretKey     string
	NIBSSBaseURL     string
	NIBSSAPIKey      string
	NIBSSSecretKey   string
	DocVerifyBaseURL string
	DocVerifyAPIKey  string
	LivenessBaseURL  string
	LivenessAPIKey   string
	LivenessPartnerID string
}

var config Config

type Verification struct {
	ID               string     `json:"id"`
	CustomerID       string     `json:"customer_id"`
	VerificationType string     `json:"verification_type"`
	Status           string     `json:"status"`
	RequestData      string     `json:"request_data"`
	ResponseData     string     `json:"response_data"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	CompletedAt      *time.Time `json:"completed_at"`
}

// NIMCVerifyResponse represents NIMC API response
type NIMCVerifyResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    struct {
		NIN        string  `json:"nin"`
		FirstName  string  `json:"firstname"`
		LastName   string  `json:"surname"`
		DOB        string  `json:"birthdate"`
		Gender     string  `json:"gender"`
		Phone      string  `json:"telephoneno"`
		Photo      string  `json:"photo"`
		MatchScore float64 `json:"match_score"`
		Verified   bool    `json:"verified"`
	} `json:"data"`
}

// CACVerifyResponse represents CAC API response
type CACVerifyResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    struct {
		RCNumber    string `json:"rc_number"`
		CompanyName string `json:"company_name"`
		CompanyType string `json:"company_type"`
		RegDate     string `json:"registration_date"`
		Address     string `json:"address"`
		State       string `json:"state"`
		Status      string `json:"status"`
		Verified    bool   `json:"verified"`
	} `json:"data"`
}

// NIBSSBVNResponse represents NIBSS BVN API response
type NIBSSBVNResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    struct {
		BVN        string  `json:"bvn"`
		FirstName  string  `json:"first_name"`
		LastName   string  `json:"last_name"`
		DOB        string  `json:"date_of_birth"`
		Phone      string  `json:"phone_number"`
		Gender     string  `json:"gender"`
		Photo      string  `json:"base64_image"`
		MatchScore float64 `json:"match_score"`
		Verified   bool    `json:"verified"`
	} `json:"data"`
}

// DocVerifyResponse represents document verification response
type DocVerifyResponse struct {
	JobID      string  `json:"job_id"`
	Status     string  `json:"status"`
	ResultCode string  `json:"result_code"`
	ResultText string  `json:"result_text"`
	Confidence float64 `json:"confidence"`
	DocInfo    struct {
		DocType    string `json:"document_type"`
		IDNumber   string `json:"id_number"`
		FullName   string `json:"full_name"`
		DOB        string `json:"dob"`
		Expiration string `json:"expiration_date"`
		Country    string `json:"country"`
	} `json:"document_info"`
}

// LivenessResponse represents liveness detection response
type LivenessResponse struct {
	JobID         string  `json:"job_id"`
	Status        string  `json:"status"`
	ResultCode    string  `json:"result_code"`
	LivenessScore float64 `json:"liveness_score"`
	IsLive        bool    `json:"is_live"`
	Confidence    float64 `json:"confidence"`
}

func loadConfig() {
	config = Config{
		NIMCBaseURL:       getEnv("NIMC_BASE_URL", "https://api.nimc.gov.ng/v1"),
		NIMCAPIKey:        getEnv("NIMC_API_KEY", ""),
		NIMCSecretKey:     getEnv("NIMC_SECRET_KEY", ""),
		CACBaseURL:        getEnv("CAC_BASE_URL", "https://api.cac.gov.ng/v1"),
		CACAPIKey:         getEnv("CAC_API_KEY", ""),
		CACSecretKey:      getEnv("CAC_SECRET_KEY", ""),
		NIBSSBaseURL:      getEnv("NIBSS_BASE_URL", "https://api.nibss-plc.com.ng/bvn/v2"),
		NIBSSAPIKey:       getEnv("NIBSS_API_KEY", ""),
		NIBSSSecretKey:    getEnv("NIBSS_SECRET_KEY", ""),
		DocVerifyBaseURL:  getEnv("DOC_VERIFY_BASE_URL", "https://api.smileidentity.com/v1"),
		DocVerifyAPIKey:   getEnv("DOC_VERIFY_API_KEY", ""),
		LivenessBaseURL:   getEnv("LIVENESS_BASE_URL", "https://api.smileidentity.com/v1"),
		LivenessAPIKey:    getEnv("LIVENESS_API_KEY", ""),
		LivenessPartnerID: getEnv("LIVENESS_PARTNER_ID", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func generateHMACSignature(secretKey, data string) string {
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func main() {
	loadConfig()

	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	if err := runMigrations(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	router := gin.Default()
	router.GET("/health", healthCheck)
	router.GET("/ready", readinessCheck)

	v1 := router.Group("/api/v1")
	{
		verify := v1.Group("/verify")
		{
			verify.POST("/nin", verifyNIN)
			verify.POST("/cac", verifyCAC)
			verify.POST("/bvn", verifyBVN)
			verify.POST("/document", verifyDocument)
			verify.POST("/liveness", verifyLiveness)
			verify.GET("/:id", getVerification)
			verify.GET("/:id/status", getVerificationStatus)
			verify.POST("/bulk", bulkVerify)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Verification Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

func runMigrations() error {
	query := `
		CREATE TABLE IF NOT EXISTS verifications (
			id UUID PRIMARY KEY,
			customer_id VARCHAR(255) NOT NULL,
			verification_type VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			request_data JSONB,
			response_data JSONB,
			error_message TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			completed_at TIMESTAMP WITH TIME ZONE,
			CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'verified', 'failed', 'expired'))
		);
		CREATE INDEX IF NOT EXISTS idx_verifications_customer_id ON verifications(customer_id);
		CREATE INDEX IF NOT EXISTS idx_verifications_type ON verifications(verification_type);
		CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
	`
	_, err := db.Exec(query)
	return err
}

func readinessCheck(c *gin.Context) {
	if err := db.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not ready", "error": "database connection failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "verification-service",
		"timestamp": time.Now().Unix(),
	})
}

func verifyNIN(c *gin.Context) {
	var request struct {
		CustomerID  string `json:"customer_id" binding:"required"`
		NIN         string `json:"nin" binding:"required"`
		FirstName   string `json:"first_name" binding:"required"`
		LastName    string `json:"last_name" binding:"required"`
		DateOfBirth string `json:"date_of_birth" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verification := Verification{
		ID:               uuid.New().String(),
		CustomerID:       request.CustomerID,
		VerificationType: "nin",
		Status:           "processing",
		CreatedAt:        time.Now(),
	}

	requestData, _ := json.Marshal(map[string]string{
		"nin": request.NIN, "first_name": request.FirstName,
		"last_name": request.LastName, "dob": request.DateOfBirth,
	})
	verification.RequestData = string(requestData)

	if err := saveVerification(&verification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification"})
		return
	}

	nimcResp, err := callNIMCAPI(request.NIN, request.FirstName, request.LastName, request.DateOfBirth)
	if err != nil {
		verification.Status = "failed"
		verification.ErrorMessage = err.Error()
		updateVerification(&verification)
		c.JSON(http.StatusOK, verification)
		return
	}

	responseData, _ := json.Marshal(nimcResp)
	verification.ResponseData = string(responseData)

	if nimcResp.Data.Verified {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		verification.ErrorMessage = "NIN verification failed: data mismatch"
	}

	now := time.Now()
	verification.CompletedAt = &now
	updateVerification(&verification)
	c.JSON(http.StatusOK, verification)
}

func callNIMCAPI(nin, firstName, lastName, dob string) (*NIMCVerifyResponse, error) {
	if config.NIMCAPIKey == "" {
		return nil, fmt.Errorf("NIMC API key not configured")
	}

	payload := map[string]string{"nin": nin, "first_name": firstName, "last_name": lastName, "dob": dob}
	payloadBytes, _ := json.Marshal(payload)

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signatureData := fmt.Sprintf("%s%s%s", config.NIMCAPIKey, timestamp, string(payloadBytes))
	signature := generateHMACSignature(config.NIMCSecretKey, signatureData)

	req, err := http.NewRequest("POST", config.NIMCBaseURL+"/verify/nin", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", config.NIMCAPIKey)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var nimcResp NIMCVerifyResponse
	if err := json.Unmarshal(body, &nimcResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &nimcResp, nil
}

func verifyCAC(c *gin.Context) {
	var request struct {
		CustomerID  string `json:"customer_id" binding:"required"`
		RCNumber    string `json:"rc_number" binding:"required"`
		CompanyName string `json:"company_name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verification := Verification{
		ID:               uuid.New().String(),
		CustomerID:       request.CustomerID,
		VerificationType: "cac",
		Status:           "processing",
		CreatedAt:        time.Now(),
	}

	requestData, _ := json.Marshal(map[string]string{"rc_number": request.RCNumber, "company_name": request.CompanyName})
	verification.RequestData = string(requestData)

	if err := saveVerification(&verification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification"})
		return
	}

	cacResp, err := callCACAPI(request.RCNumber, request.CompanyName)
	if err != nil {
		verification.Status = "failed"
		verification.ErrorMessage = err.Error()
		updateVerification(&verification)
		c.JSON(http.StatusOK, verification)
		return
	}

	responseData, _ := json.Marshal(cacResp)
	verification.ResponseData = string(responseData)

	if cacResp.Data.Verified && strings.EqualFold(cacResp.Data.Status, "active") {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		verification.ErrorMessage = "CAC verification failed: company not found or inactive"
	}

	now := time.Now()
	verification.CompletedAt = &now
	updateVerification(&verification)
	c.JSON(http.StatusOK, verification)
}

func callCACAPI(rcNumber, companyName string) (*CACVerifyResponse, error) {
	if config.CACAPIKey == "" {
		return nil, fmt.Errorf("CAC API key not configured")
	}

	payload := map[string]string{"rc_number": rcNumber, "company_name": companyName}
	payloadBytes, _ := json.Marshal(payload)

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signatureData := fmt.Sprintf("%s%s%s", config.CACAPIKey, timestamp, string(payloadBytes))
	signature := generateHMACSignature(config.CACSecretKey, signatureData)

	req, err := http.NewRequest("POST", config.CACBaseURL+"/verify/company", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", config.CACAPIKey)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var cacResp CACVerifyResponse
	if err := json.Unmarshal(body, &cacResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &cacResp, nil
}

func verifyBVN(c *gin.Context) {
	var request struct {
		CustomerID  string `json:"customer_id" binding:"required"`
		BVN         string `json:"bvn" binding:"required"`
		FirstName   string `json:"first_name" binding:"required"`
		LastName    string `json:"last_name" binding:"required"`
		DateOfBirth string `json:"date_of_birth" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verification := Verification{
		ID:               uuid.New().String(),
		CustomerID:       request.CustomerID,
		VerificationType: "bvn",
		Status:           "processing",
		CreatedAt:        time.Now(),
	}

	requestData, _ := json.Marshal(map[string]string{
		"bvn": request.BVN, "first_name": request.FirstName,
		"last_name": request.LastName, "dob": request.DateOfBirth,
	})
	verification.RequestData = string(requestData)

	if err := saveVerification(&verification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification"})
		return
	}

	bvnResp, err := callNIBSSBVNAPI(request.BVN, request.FirstName, request.LastName, request.DateOfBirth)
	if err != nil {
		verification.Status = "failed"
		verification.ErrorMessage = err.Error()
		updateVerification(&verification)
		c.JSON(http.StatusOK, verification)
		return
	}

	responseData, _ := json.Marshal(bvnResp)
	verification.ResponseData = string(responseData)

	if bvnResp.Data.Verified && bvnResp.Data.MatchScore >= 0.8 {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		verification.ErrorMessage = fmt.Sprintf("BVN verification failed: match score %.2f below threshold", bvnResp.Data.MatchScore)
	}

	now := time.Now()
	verification.CompletedAt = &now
	updateVerification(&verification)
	c.JSON(http.StatusOK, verification)
}

func callNIBSSBVNAPI(bvn, firstName, lastName, dob string) (*NIBSSBVNResponse, error) {
	if config.NIBSSAPIKey == "" {
		return nil, fmt.Errorf("NIBSS API key not configured")
	}

	payload := map[string]string{"bvn": bvn, "first_name": firstName, "last_name": lastName, "dob": dob}
	payloadBytes, _ := json.Marshal(payload)

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signatureData := fmt.Sprintf("%s%s%s", config.NIBSSAPIKey, timestamp, string(payloadBytes))
	signature := generateHMACSignature(config.NIBSSSecretKey, signatureData)

	req, err := http.NewRequest("POST", config.NIBSSBaseURL+"/verify", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.NIBSSAPIKey)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var bvnResp NIBSSBVNResponse
	if err := json.Unmarshal(body, &bvnResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &bvnResp, nil
}

func verifyDocument(c *gin.Context) {
	var request struct {
		CustomerID   string `json:"customer_id" binding:"required"`
		DocumentType string `json:"document_type" binding:"required"`
		DocumentURL  string `json:"document_url" binding:"required"`
		SelfieURL    string `json:"selfie_url"`
		Country      string `json:"country"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Country == "" {
		request.Country = "NG"
	}

	verification := Verification{
		ID:               uuid.New().String(),
		CustomerID:       request.CustomerID,
		VerificationType: "document",
		Status:           "processing",
		CreatedAt:        time.Now(),
	}

	requestData, _ := json.Marshal(map[string]string{
		"document_type": request.DocumentType, "document_url": request.DocumentURL,
		"selfie_url": request.SelfieURL, "country": request.Country,
	})
	verification.RequestData = string(requestData)

	if err := saveVerification(&verification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification"})
		return
	}

	docResp, err := callDocVerifyAPI(request.DocumentType, request.DocumentURL, request.SelfieURL, request.Country)
	if err != nil {
		verification.Status = "failed"
		verification.ErrorMessage = err.Error()
		updateVerification(&verification)
		c.JSON(http.StatusOK, verification)
		return
	}

	responseData, _ := json.Marshal(docResp)
	verification.ResponseData = string(responseData)

	if docResp.ResultCode == "0810" || docResp.ResultCode == "0820" {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		verification.ErrorMessage = fmt.Sprintf("Document verification failed: %s", docResp.ResultText)
	}

	now := time.Now()
	verification.CompletedAt = &now
	updateVerification(&verification)
	c.JSON(http.StatusOK, verification)
}

func callDocVerifyAPI(documentType, documentURL, selfieURL, country string) (*DocVerifyResponse, error) {
	if config.DocVerifyAPIKey == "" {
		return nil, fmt.Errorf("Document verification API key not configured")
	}

	jobType := 6
	if selfieURL != "" {
		jobType = 1
	}

	payload := map[string]interface{}{
		"partner_id": config.LivenessPartnerID,
		"job_type":   jobType,
		"country":    country,
		"id_type":    documentType,
		"images": []map[string]interface{}{
			{"image_type_id": 3, "image": documentURL},
		},
		"return_job_status": true,
	}

	if selfieURL != "" {
		payload["images"] = append(payload["images"].([]map[string]interface{}), map[string]interface{}{
			"image_type_id": 0, "image": selfieURL,
		})
	}

	payloadBytes, _ := json.Marshal(payload)

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	signatureData := fmt.Sprintf("%s%s%s", config.LivenessPartnerID, timestamp, config.DocVerifyAPIKey)
	h := sha256.New()
	h.Write([]byte(signatureData))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	req, err := http.NewRequest("POST", config.DocVerifyBaseURL+"/upload", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("SmileID-Partner-ID", config.LivenessPartnerID)
	req.Header.Set("SmileID-Timestamp", timestamp)
	req.Header.Set("SmileID-Signature", signature)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var docResp DocVerifyResponse
	if err := json.Unmarshal(body, &docResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &docResp, nil
}

func verifyLiveness(c *gin.Context) {
	var request struct {
		CustomerID string `json:"customer_id" binding:"required"`
		ImageURL   string `json:"image_url" binding:"required"`
		VideoURL   string `json:"video_url"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verification := Verification{
		ID:               uuid.New().String(),
		CustomerID:       request.CustomerID,
		VerificationType: "liveness",
		Status:           "processing",
		CreatedAt:        time.Now(),
	}

	requestData, _ := json.Marshal(map[string]string{"image_url": request.ImageURL, "video_url": request.VideoURL})
	verification.RequestData = string(requestData)

	if err := saveVerification(&verification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification"})
		return
	}

	livenessResp, err := callLivenessAPI(request.ImageURL, request.VideoURL)
	if err != nil {
		verification.Status = "failed"
		verification.ErrorMessage = err.Error()
		updateVerification(&verification)
		c.JSON(http.StatusOK, verification)
		return
	}

	responseData, _ := json.Marshal(livenessResp)
	verification.ResponseData = string(responseData)

	if livenessResp.IsLive && livenessResp.LivenessScore >= 0.85 {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		verification.ErrorMessage = fmt.Sprintf("Liveness check failed: score %.2f, is_live=%v", livenessResp.LivenessScore, livenessResp.IsLive)
	}

	now := time.Now()
	verification.CompletedAt = &now
	updateVerification(&verification)
	c.JSON(http.StatusOK, verification)
}

func callLivenessAPI(imageURL, videoURL string) (*LivenessResponse, error) {
	if config.LivenessAPIKey == "" {
		return nil, fmt.Errorf("Liveness API key not configured")
	}

	images := []map[string]interface{}{{"image_type_id": 0, "image": imageURL}}
	if videoURL != "" {
		images = append(images, map[string]interface{}{"image_type_id": 4, "image": videoURL})
	}

	payload := map[string]interface{}{
		"partner_id":        config.LivenessPartnerID,
		"job_type":          4,
		"images":            images,
		"return_job_status": true,
	}

	payloadBytes, _ := json.Marshal(payload)

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	signatureData := fmt.Sprintf("%s%s%s", config.LivenessPartnerID, timestamp, config.LivenessAPIKey)
	h := sha256.New()
	h.Write([]byte(signatureData))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	req, err := http.NewRequest("POST", config.LivenessBaseURL+"/upload", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("SmileID-Partner-ID", config.LivenessPartnerID)
	req.Header.Set("SmileID-Timestamp", timestamp)
	req.Header.Set("SmileID-Signature", signature)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var livenessResp LivenessResponse
	if err := json.Unmarshal(body, &livenessResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &livenessResp, nil
}

func getVerification(c *gin.Context) {
	id := c.Param("id")

	var verification Verification
	var completedAt sql.NullTime
	var errorMessage sql.NullString

	query := `SELECT id, customer_id, verification_type, status, request_data, response_data, error_message, created_at, completed_at 
			  FROM verifications WHERE id = $1`
	err := db.QueryRow(query, id).Scan(
		&verification.ID, &verification.CustomerID, &verification.VerificationType,
		&verification.Status, &verification.RequestData, &verification.ResponseData,
		&errorMessage, &verification.CreatedAt, &completedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Verification not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch verification"})
		return
	}

	if completedAt.Valid {
		verification.CompletedAt = &completedAt.Time
	}
	if errorMessage.Valid {
		verification.ErrorMessage = errorMessage.String
	}

	c.JSON(http.StatusOK, verification)
}

func getVerificationStatus(c *gin.Context) {
	id := c.Param("id")

	var status string
	query := "SELECT status FROM verifications WHERE id = $1"
	err := db.QueryRow(query, id).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Verification not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch verification status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": id, "status": status})
}

func bulkVerify(c *gin.Context) {
	var request struct {
		CustomerID    string `json:"customer_id" binding:"required"`
		Verifications []struct {
			Type string                 `json:"type" binding:"required"`
			Data map[string]interface{} `json:"data" binding:"required"`
		} `json:"verifications" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results := make([]gin.H, len(request.Verifications))
	for i, v := range request.Verifications {
		verificationID := uuid.New().String()
		results[i] = gin.H{"id": verificationID, "type": v.Type, "status": "queued"}
	}

	c.JSON(http.StatusAccepted, gin.H{
		"customer_id":   request.CustomerID,
		"verifications": results,
		"message":       "Bulk verification queued for processing",
	})
}

func saveVerification(v *Verification) error {
	query := `
		INSERT INTO verifications (id, customer_id, verification_type, status, request_data, response_data, error_message, created_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := db.Exec(query, v.ID, v.CustomerID, v.VerificationType, v.Status, v.RequestData, v.ResponseData, v.ErrorMessage, v.CreatedAt, v.CompletedAt)
	return err
}

func updateVerification(v *Verification) error {
	query := `
		UPDATE verifications 
		SET status = $1, response_data = $2, error_message = $3, completed_at = $4
		WHERE id = $5
	`
	_, err := db.Exec(query, v.Status, v.ResponseData, v.ErrorMessage, v.CompletedAt, v.ID)
	return err
}
