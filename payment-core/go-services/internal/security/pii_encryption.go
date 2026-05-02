// Package security provides security hardening for KYC/KYB and fraud detection
// Priority 1: PII Field-Level Encryption, Access Control, Evidence Security
package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"sync"
	"time"
)

// =============================================================================
// Priority 1.1: PII Field-Level Encryption with HSM Integration
// =============================================================================

// PIIEncryptionService provides field-level encryption for PII data
type PIIEncryptionService struct {
	hsm             HSMProvider
	keyCache        map[string]*CachedKey
	mu              sync.RWMutex
	db              *sql.DB
	keyRotationDays int
	auditLogger     EncryptionAuditLogger
}

// HSMProvider interface for Hardware Security Module integration
type HSMProvider interface {
	GenerateDataKey(ctx context.Context, keyID string) (*DataKey, error)
	DecryptDataKey(ctx context.Context, encryptedKey []byte) ([]byte, error)
	RotateKey(ctx context.Context, keyID string) (*DataKey, error)
	GetKeyMetadata(ctx context.Context, keyID string) (*KeyMetadata, error)
}

// DataKey represents an encryption key from HSM
type DataKey struct {
	KeyID          string    `json:"key_id"`
	PlaintextKey   []byte    `json:"-"` // Never persisted
	EncryptedKey   []byte    `json:"encrypted_key"`
	Algorithm      string    `json:"algorithm"`
	CreatedAt      time.Time `json:"created_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	Version        int       `json:"version"`
}

// KeyMetadata contains key metadata without the actual key
type KeyMetadata struct {
	KeyID       string    `json:"key_id"`
	Algorithm   string    `json:"algorithm"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	Version     int       `json:"version"`
	Status      string    `json:"status"` // ACTIVE, ROTATING, RETIRED
	UsageCount  int64     `json:"usage_count"`
}

// CachedKey represents a cached decrypted key
type CachedKey struct {
	Key       []byte
	ExpiresAt time.Time
}

// EncryptionAuditLogger logs encryption operations
type EncryptionAuditLogger interface {
	LogEncryption(ctx context.Context, event *EncryptionAuditEvent) error
	LogDecryption(ctx context.Context, event *EncryptionAuditEvent) error
	LogKeyRotation(ctx context.Context, event *KeyRotationEvent) error
}

// EncryptionAuditEvent represents an encryption/decryption audit event
type EncryptionAuditEvent struct {
	EventID       string    `json:"event_id"`
	Operation     string    `json:"operation"` // ENCRYPT, DECRYPT
	KeyID         string    `json:"key_id"`
	KeyVersion    int       `json:"key_version"`
	DataType      string    `json:"data_type"` // KYC_PII, KYB_PII, EVIDENCE
	RecordID      string    `json:"record_id"`
	UserID        string    `json:"user_id"`
	Reason        string    `json:"reason"`
	IPAddress     string    `json:"ip_address"`
	Timestamp     time.Time `json:"timestamp"`
	Success       bool      `json:"success"`
	ErrorMessage  string    `json:"error_message,omitempty"`
}

// KeyRotationEvent represents a key rotation audit event
type KeyRotationEvent struct {
	EventID       string    `json:"event_id"`
	OldKeyID      string    `json:"old_key_id"`
	OldKeyVersion int       `json:"old_key_version"`
	NewKeyID      string    `json:"new_key_id"`
	NewKeyVersion int       `json:"new_key_version"`
	Reason        string    `json:"reason"`
	InitiatedBy   string    `json:"initiated_by"`
	Timestamp     time.Time `json:"timestamp"`
	RecordsReEncrypted int64 `json:"records_re_encrypted"`
}

// PIIField represents a field that contains PII
type PIIField struct {
	FieldName     string `json:"field_name"`
	DataType      string `json:"data_type"`
	Sensitivity   string `json:"sensitivity"` // HIGH, MEDIUM, LOW
	RetentionDays int    `json:"retention_days"`
	MaskPattern   string `json:"mask_pattern"`
}

// EncryptedPII represents encrypted PII data
type EncryptedPII struct {
	Ciphertext    string `json:"ciphertext"`
	KeyID         string `json:"key_id"`
	KeyVersion    int    `json:"key_version"`
	Algorithm     string `json:"algorithm"`
	Nonce         string `json:"nonce"`
	EncryptedAt   time.Time `json:"encrypted_at"`
	DataType      string `json:"data_type"`
}

// NewPIIEncryptionService creates a new PII encryption service
func NewPIIEncryptionService(hsm HSMProvider, db *sql.DB, auditLogger EncryptionAuditLogger) *PIIEncryptionService {
	return &PIIEncryptionService{
		hsm:             hsm,
		keyCache:        make(map[string]*CachedKey),
		db:              db,
		keyRotationDays: 90, // Rotate keys every 90 days
		auditLogger:     auditLogger,
	}
}

// EncryptPII encrypts PII data with field-level encryption
func (s *PIIEncryptionService) EncryptPII(ctx context.Context, data []byte, dataType, recordID, userID, reason string) (*EncryptedPII, error) {
	// Get or generate data key
	keyID := fmt.Sprintf("pii_%s", dataType)
	dataKey, err := s.getOrCreateDataKey(ctx, keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get data key: %w", err)
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(dataKey.PlaintextKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt data
	ciphertext := gcm.Seal(nil, nonce, data, nil)

	result := &EncryptedPII{
		Ciphertext:  base64.StdEncoding.EncodeToString(ciphertext),
		KeyID:       dataKey.KeyID,
		KeyVersion:  dataKey.Version,
		Algorithm:   "AES-256-GCM",
		Nonce:       base64.StdEncoding.EncodeToString(nonce),
		EncryptedAt: time.Now().UTC(),
		DataType:    dataType,
	}

	// Log encryption event
	if s.auditLogger != nil {
		s.auditLogger.LogEncryption(ctx, &EncryptionAuditEvent{
			EventID:    fmt.Sprintf("enc_%d", time.Now().UnixNano()),
			Operation:  "ENCRYPT",
			KeyID:      dataKey.KeyID,
			KeyVersion: dataKey.Version,
			DataType:   dataType,
			RecordID:   recordID,
			UserID:     userID,
			Reason:     reason,
			Timestamp:  time.Now().UTC(),
			Success:    true,
		})
	}

	return result, nil
}

// DecryptPII decrypts PII data with audit logging
func (s *PIIEncryptionService) DecryptPII(ctx context.Context, encrypted *EncryptedPII, recordID, userID, reason string) ([]byte, error) {
	// Get cached key or decrypt from HSM
	key, err := s.getCachedKey(ctx, encrypted.KeyID)
	if err != nil {
		// Log failed decryption attempt
		if s.auditLogger != nil {
			s.auditLogger.LogDecryption(ctx, &EncryptionAuditEvent{
				EventID:      fmt.Sprintf("dec_%d", time.Now().UnixNano()),
				Operation:    "DECRYPT",
				KeyID:        encrypted.KeyID,
				KeyVersion:   encrypted.KeyVersion,
				DataType:     encrypted.DataType,
				RecordID:     recordID,
				UserID:       userID,
				Reason:       reason,
				Timestamp:    time.Now().UTC(),
				Success:      false,
				ErrorMessage: err.Error(),
			})
		}
		return nil, fmt.Errorf("failed to get decryption key: %w", err)
	}

	// Decode ciphertext and nonce
	ciphertext, err := base64.StdEncoding.DecodeString(encrypted.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(encrypted.Nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	// Log successful decryption
	if s.auditLogger != nil {
		s.auditLogger.LogDecryption(ctx, &EncryptionAuditEvent{
			EventID:    fmt.Sprintf("dec_%d", time.Now().UnixNano()),
			Operation:  "DECRYPT",
			KeyID:      encrypted.KeyID,
			KeyVersion: encrypted.KeyVersion,
			DataType:   encrypted.DataType,
			RecordID:   recordID,
			UserID:     userID,
			Reason:     reason,
			Timestamp:  time.Now().UTC(),
			Success:    true,
		})
	}

	return plaintext, nil
}

// RotateKey rotates the encryption key for a data type
func (s *PIIEncryptionService) RotateKey(ctx context.Context, keyID, initiatedBy, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Get current key metadata
	oldMetadata, err := s.hsm.GetKeyMetadata(ctx, keyID)
	if err != nil {
		return fmt.Errorf("failed to get current key metadata: %w", err)
	}

	// Generate new key
	newKey, err := s.hsm.RotateKey(ctx, keyID)
	if err != nil {
		return fmt.Errorf("failed to rotate key: %w", err)
	}

	// Update cache
	s.keyCache[keyID] = &CachedKey{
		Key:       newKey.PlaintextKey,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	// Log rotation event
	if s.auditLogger != nil {
		s.auditLogger.LogKeyRotation(ctx, &KeyRotationEvent{
			EventID:       fmt.Sprintf("rot_%d", time.Now().UnixNano()),
			OldKeyID:      oldMetadata.KeyID,
			OldKeyVersion: oldMetadata.Version,
			NewKeyID:      newKey.KeyID,
			NewKeyVersion: newKey.Version,
			Reason:        reason,
			InitiatedBy:   initiatedBy,
			Timestamp:     time.Now().UTC(),
		})
	}

	return nil
}

func (s *PIIEncryptionService) getOrCreateDataKey(ctx context.Context, keyID string) (*DataKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check cache first
	if cached, ok := s.keyCache[keyID]; ok && time.Now().Before(cached.ExpiresAt) {
		return &DataKey{
			KeyID:        keyID,
			PlaintextKey: cached.Key,
		}, nil
	}

	// Generate new key from HSM
	dataKey, err := s.hsm.GenerateDataKey(ctx, keyID)
	if err != nil {
		return nil, err
	}

	// Cache the key
	s.keyCache[keyID] = &CachedKey{
		Key:       dataKey.PlaintextKey,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	return dataKey, nil
}

func (s *PIIEncryptionService) getCachedKey(ctx context.Context, keyID string) ([]byte, error) {
	s.mu.RLock()
	cached, ok := s.keyCache[keyID]
	s.mu.RUnlock()

	if ok && time.Now().Before(cached.ExpiresAt) {
		return cached.Key, nil
	}

	// Need to fetch from HSM - get encrypted key from DB and decrypt
	// This is a simplified version - in production, you'd store encrypted keys
	s.mu.Lock()
	defer s.mu.Unlock()

	dataKey, err := s.hsm.GenerateDataKey(ctx, keyID)
	if err != nil {
		return nil, err
	}

	s.keyCache[keyID] = &CachedKey{
		Key:       dataKey.PlaintextKey,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	return dataKey.PlaintextKey, nil
}

// MaskPII masks PII data for display
func MaskPII(data, dataType string) string {
	if len(data) == 0 {
		return ""
	}

	switch dataType {
	case "email":
		// Show first 2 chars and domain
		atIdx := -1
		for i, c := range data {
			if c == '@' {
				atIdx = i
				break
			}
		}
		if atIdx > 2 {
			return data[:2] + "***" + data[atIdx:]
		}
		return "***" + data[atIdx:]

	case "phone":
		// Show last 4 digits
		if len(data) > 4 {
			return "***" + data[len(data)-4:]
		}
		return "****"

	case "id_number":
		// Show first 2 and last 2
		if len(data) > 4 {
			return data[:2] + "***" + data[len(data)-2:]
		}
		return "****"

	case "name":
		// Show first initial
		if len(data) > 0 {
			return string(data[0]) + "***"
		}
		return "***"

	default:
		// Default: show first and last char
		if len(data) > 2 {
			return string(data[0]) + "***" + string(data[len(data)-1])
		}
		return "***"
	}
}

// =============================================================================
// Priority 1.2: Evidence Upload Security
// =============================================================================

// EvidenceSecurityService provides security for evidence uploads
type EvidenceSecurityService struct {
	virusScanner    VirusScanner
	allowedTypes    map[string]bool
	maxFileSize     int64
	tamperDetector  TamperDetector
	storageProvider SecureStorageProvider
}

// VirusScanner interface for virus scanning
type VirusScanner interface {
	Scan(ctx context.Context, data []byte, filename string) (*ScanResult, error)
}

// ScanResult represents virus scan result
type ScanResult struct {
	Clean       bool      `json:"clean"`
	ThreatName  string    `json:"threat_name,omitempty"`
	ThreatType  string    `json:"threat_type,omitempty"`
	ScannedAt   time.Time `json:"scanned_at"`
	ScannerName string    `json:"scanner_name"`
}

// TamperDetector interface for tamper detection
type TamperDetector interface {
	DetectTampering(ctx context.Context, data []byte, fileType string) (*TamperResult, error)
}

// TamperResult represents tamper detection result
type TamperResult struct {
	Tampered      bool     `json:"tampered"`
	Confidence    float64  `json:"confidence"`
	Indicators    []string `json:"indicators"`
	OriginalHash  string   `json:"original_hash"`
	MetadataHash  string   `json:"metadata_hash"`
}

// SecureStorageProvider interface for secure storage
type SecureStorageProvider interface {
	Store(ctx context.Context, data []byte, metadata *StorageMetadata) (string, error)
	Retrieve(ctx context.Context, storageID string) ([]byte, *StorageMetadata, error)
	Delete(ctx context.Context, storageID string) error
}

// StorageMetadata contains metadata for stored evidence
type StorageMetadata struct {
	StorageID     string    `json:"storage_id"`
	OriginalName  string    `json:"original_name"`
	ContentType   string    `json:"content_type"`
	Size          int64     `json:"size"`
	Hash          string    `json:"hash"`
	UploadedBy    string    `json:"uploaded_by"`
	UploadedAt    time.Time `json:"uploaded_at"`
	RetentionDays int       `json:"retention_days"`
	Encrypted     bool      `json:"encrypted"`
}

// EvidenceValidationResult represents validation result
type EvidenceValidationResult struct {
	Valid           bool         `json:"valid"`
	Errors          []string     `json:"errors"`
	Warnings        []string     `json:"warnings"`
	ScanResult      *ScanResult  `json:"scan_result"`
	TamperResult    *TamperResult `json:"tamper_result"`
	SanitizedData   []byte       `json:"-"`
	ContentType     string       `json:"content_type"`
	DetectedType    string       `json:"detected_type"`
}

// NewEvidenceSecurityService creates a new evidence security service
func NewEvidenceSecurityService(scanner VirusScanner, tamper TamperDetector, storage SecureStorageProvider) *EvidenceSecurityService {
	return &EvidenceSecurityService{
		virusScanner:   scanner,
		tamperDetector: tamper,
		storageProvider: storage,
		maxFileSize:    10 * 1024 * 1024, // 10MB default
		allowedTypes: map[string]bool{
			"application/pdf":  true,
			"image/jpeg":       true,
			"image/png":        true,
			"image/gif":        true,
			"image/webp":       true,
		},
	}
}

// ValidateAndSanitize validates and sanitizes uploaded evidence
func (s *EvidenceSecurityService) ValidateAndSanitize(ctx context.Context, data []byte, filename, contentType string) (*EvidenceValidationResult, error) {
	result := &EvidenceValidationResult{
		Valid:    true,
		Errors:   make([]string, 0),
		Warnings: make([]string, 0),
	}

	// Check file size
	if int64(len(data)) > s.maxFileSize {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("file size %d exceeds maximum %d", len(data), s.maxFileSize))
		return result, nil
	}

	// Detect actual content type (magic bytes)
	detectedType := detectContentType(data)
	result.DetectedType = detectedType

	// Verify content type matches
	if contentType != detectedType {
		result.Warnings = append(result.Warnings, fmt.Sprintf("declared type %s differs from detected type %s", contentType, detectedType))
	}

	// Check if type is allowed
	if !s.allowedTypes[detectedType] {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("file type %s is not allowed", detectedType))
		return result, nil
	}

	// Virus scan
	if s.virusScanner != nil {
		scanResult, err := s.virusScanner.Scan(ctx, data, filename)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("virus scan failed: %v", err))
			return result, nil
		}
		result.ScanResult = scanResult
		if !scanResult.Clean {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("malware detected: %s", scanResult.ThreatName))
			return result, nil
		}
	}

	// Tamper detection
	if s.tamperDetector != nil {
		tamperResult, err := s.tamperDetector.DetectTampering(ctx, data, detectedType)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("tamper detection failed: %v", err))
		} else {
			result.TamperResult = tamperResult
			if tamperResult.Tampered {
				result.Warnings = append(result.Warnings, fmt.Sprintf("potential tampering detected: %v", tamperResult.Indicators))
			}
		}
	}

	// Sanitize based on type
	sanitized, err := s.sanitizeContent(data, detectedType)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("sanitization failed: %v", err))
		return result, nil
	}
	result.SanitizedData = sanitized
	result.ContentType = detectedType

	return result, nil
}

// sanitizeContent sanitizes content based on type
func (s *EvidenceSecurityService) sanitizeContent(data []byte, contentType string) ([]byte, error) {
	switch contentType {
	case "application/pdf":
		return sanitizePDF(data)
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return sanitizeImage(data)
	default:
		return data, nil
	}
}

// sanitizePDF removes potentially dangerous content from PDFs
func sanitizePDF(data []byte) ([]byte, error) {
	// In production, use a PDF sanitization library
	// This is a placeholder that would:
	// 1. Remove JavaScript
	// 2. Remove embedded files
	// 3. Remove form actions
	// 4. Flatten forms
	// 5. Remove external links
	return data, nil
}

// sanitizeImage removes metadata and potentially dangerous content from images
func sanitizeImage(data []byte) ([]byte, error) {
	// In production, use an image processing library to:
	// 1. Strip EXIF metadata
	// 2. Re-encode the image
	// 3. Remove embedded data
	return data, nil
}

// detectContentType detects content type from magic bytes
func detectContentType(data []byte) string {
	if len(data) < 4 {
		return "application/octet-stream"
	}

	// PDF
	if len(data) >= 4 && string(data[:4]) == "%PDF" {
		return "application/pdf"
	}

	// JPEG
	if len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "image/jpeg"
	}

	// PNG
	if len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "image/png"
	}

	// GIF
	if len(data) >= 6 && string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a" {
		return "image/gif"
	}

	// WebP
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp"
	}

	return "application/octet-stream"
}

// =============================================================================
// Priority 1.3: Access Control & Audit
// =============================================================================

// AccessControlService provides least-privilege access control
type AccessControlService struct {
	db          *sql.DB
	auditLogger AccessAuditLogger
	permissions map[string]*Permission
	roles       map[string]*Role
	mu          sync.RWMutex
}

// Permission represents a permission
type Permission struct {
	PermissionID string   `json:"permission_id"`
	Name         string   `json:"name"`
	Resource     string   `json:"resource"`
	Actions      []string `json:"actions"` // READ, WRITE, DELETE, ADMIN
	Conditions   []string `json:"conditions"`
}

// Role represents a role with permissions
type Role struct {
	RoleID       string   `json:"role_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Permissions  []string `json:"permissions"`
	MaxDataLevel string   `json:"max_data_level"` // PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
}

// AccessRequest represents an access request
type AccessRequest struct {
	UserID       string `json:"user_id"`
	Resource     string `json:"resource"`
	Action       string `json:"action"`
	RecordID     string `json:"record_id"`
	Reason       string `json:"reason"`
	IPAddress    string `json:"ip_address"`
	SessionID    string `json:"session_id"`
}

// AccessDecision represents an access decision
type AccessDecision struct {
	Allowed      bool      `json:"allowed"`
	Reason       string    `json:"reason"`
	Permissions  []string  `json:"permissions"`
	Restrictions []string  `json:"restrictions"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// AccessAuditLogger logs access events
type AccessAuditLogger interface {
	LogAccessRequest(ctx context.Context, request *AccessRequest, decision *AccessDecision) error
	LogDataAccess(ctx context.Context, event *DataAccessEvent) error
}

// DataAccessEvent represents a data access event
type DataAccessEvent struct {
	EventID      string    `json:"event_id"`
	UserID       string    `json:"user_id"`
	Resource     string    `json:"resource"`
	RecordID     string    `json:"record_id"`
	Action       string    `json:"action"`
	DataLevel    string    `json:"data_level"`
	Reason       string    `json:"reason"`
	IPAddress    string    `json:"ip_address"`
	SessionID    string    `json:"session_id"`
	Timestamp    time.Time `json:"timestamp"`
	Success      bool      `json:"success"`
	DataReturned bool      `json:"data_returned"`
}

// NewAccessControlService creates a new access control service
func NewAccessControlService(db *sql.DB, auditLogger AccessAuditLogger) *AccessControlService {
	svc := &AccessControlService{
		db:          db,
		auditLogger: auditLogger,
		permissions: make(map[string]*Permission),
		roles:       make(map[string]*Role),
	}
	svc.initializeDefaultRoles()
	return svc
}

// initializeDefaultRoles sets up default roles and permissions
func (s *AccessControlService) initializeDefaultRoles() {
	// Define permissions
	s.permissions["kyc_read"] = &Permission{
		PermissionID: "kyc_read",
		Name:         "Read KYC Data",
		Resource:     "kyc",
		Actions:      []string{"READ"},
	}
	s.permissions["kyc_write"] = &Permission{
		PermissionID: "kyc_write",
		Name:         "Write KYC Data",
		Resource:     "kyc",
		Actions:      []string{"READ", "WRITE"},
	}
	s.permissions["kyc_review"] = &Permission{
		PermissionID: "kyc_review",
		Name:         "Review KYC Cases",
		Resource:     "kyc",
		Actions:      []string{"READ", "WRITE", "REVIEW"},
	}
	s.permissions["kyc_admin"] = &Permission{
		PermissionID: "kyc_admin",
		Name:         "Administer KYC",
		Resource:     "kyc",
		Actions:      []string{"READ", "WRITE", "REVIEW", "DELETE", "ADMIN"},
	}
	s.permissions["fraud_read"] = &Permission{
		PermissionID: "fraud_read",
		Name:         "Read Fraud Data",
		Resource:     "fraud",
		Actions:      []string{"READ"},
	}
	s.permissions["fraud_review"] = &Permission{
		PermissionID: "fraud_review",
		Name:         "Review Fraud Alerts",
		Resource:     "fraud",
		Actions:      []string{"READ", "WRITE", "REVIEW"},
	}
	s.permissions["pii_access"] = &Permission{
		PermissionID: "pii_access",
		Name:         "Access PII Data",
		Resource:     "pii",
		Actions:      []string{"READ"},
		Conditions:   []string{"reason_required", "audit_logged"},
	}

	// Define roles
	s.roles["kyc_analyst"] = &Role{
		RoleID:       "kyc_analyst",
		Name:         "KYC Analyst",
		Description:  "Can review and process KYC cases",
		Permissions:  []string{"kyc_read", "kyc_review"},
		MaxDataLevel: "CONFIDENTIAL",
	}
	s.roles["kyc_supervisor"] = &Role{
		RoleID:       "kyc_supervisor",
		Name:         "KYC Supervisor",
		Description:  "Can manage KYC team and escalations",
		Permissions:  []string{"kyc_read", "kyc_write", "kyc_review", "pii_access"},
		MaxDataLevel: "RESTRICTED",
	}
	s.roles["fraud_analyst"] = &Role{
		RoleID:       "fraud_analyst",
		Name:         "Fraud Analyst",
		Description:  "Can review and process fraud alerts",
		Permissions:  []string{"fraud_read", "fraud_review"},
		MaxDataLevel: "CONFIDENTIAL",
	}
	s.roles["compliance_officer"] = &Role{
		RoleID:       "compliance_officer",
		Name:         "Compliance Officer",
		Description:  "Full access for compliance purposes",
		Permissions:  []string{"kyc_read", "kyc_review", "fraud_read", "fraud_review", "pii_access"},
		MaxDataLevel: "RESTRICTED",
	}
}

// CheckAccess checks if a user has access to a resource
func (s *AccessControlService) CheckAccess(ctx context.Context, request *AccessRequest, userRoles []string) (*AccessDecision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	decision := &AccessDecision{
		Allowed:      false,
		Permissions:  make([]string, 0),
		Restrictions: make([]string, 0),
		ExpiresAt:    time.Now().Add(1 * time.Hour),
	}

	// Check each role
	for _, roleID := range userRoles {
		role, ok := s.roles[roleID]
		if !ok {
			continue
		}

		// Check permissions in role
		for _, permID := range role.Permissions {
			perm, ok := s.permissions[permID]
			if !ok {
				continue
			}

			// Check if permission matches resource and action
			if perm.Resource == request.Resource {
				for _, action := range perm.Actions {
					if action == request.Action || action == "ADMIN" {
						decision.Allowed = true
						decision.Permissions = append(decision.Permissions, permID)

						// Add conditions as restrictions
						decision.Restrictions = append(decision.Restrictions, perm.Conditions...)
					}
				}
			}
		}
	}

	// Check if reason is required
	for _, restriction := range decision.Restrictions {
		if restriction == "reason_required" && request.Reason == "" {
			decision.Allowed = false
			decision.Reason = "Access reason is required for this resource"
		}
	}

	if decision.Allowed {
		decision.Reason = "Access granted based on role permissions"
	} else if decision.Reason == "" {
		decision.Reason = "No matching permissions found"
	}

	// Log access request
	if s.auditLogger != nil {
		s.auditLogger.LogAccessRequest(ctx, request, decision)
	}

	return decision, nil
}

// =============================================================================
// Priority 1.4: Step-Up Auth Hardening
// =============================================================================

// HardenedStepUpAuth provides hardened step-up authentication
type HardenedStepUpAuth struct {
	db              *sql.DB
	challenges      map[string]*HardenedChallenge
	mu              sync.RWMutex
	deviceValidator DeviceValidator
	rateLimiter     StepUpRateLimiter
}

// HardenedChallenge represents a hardened step-up challenge
type HardenedChallenge struct {
	ChallengeID     string    `json:"challenge_id"`
	TransactionID   string    `json:"transaction_id"`
	AccountID       string    `json:"account_id"`
	Method          string    `json:"method"`
	Challenge       string    `json:"challenge"`
	ContextHash     string    `json:"context_hash"` // Hash of transaction context
	DeviceFingerprint string  `json:"device_fingerprint"`
	IPAddress       string    `json:"ip_address"`
	CreatedAt       time.Time `json:"created_at"`
	ExpiresAt       time.Time `json:"expires_at"`
	Attempts        int       `json:"attempts"`
	MaxAttempts     int       `json:"max_attempts"`
	Status          string    `json:"status"`
}

// TransactionContext represents transaction context for binding
type TransactionContext struct {
	TransactionID   string  `json:"transaction_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	PayeeAccount    string  `json:"payee_account"`
	PayeeName       string  `json:"payee_name"`
	DeviceID        string  `json:"device_id"`
	IPAddress       string  `json:"ip_address"`
	Timestamp       int64   `json:"timestamp"`
}

// DeviceValidator interface for device validation
type DeviceValidator interface {
	ValidateFingerprint(ctx context.Context, fingerprint string, accountID string) (*DeviceValidationResult, error)
	RegisterDevice(ctx context.Context, fingerprint string, accountID string, metadata map[string]string) error
}

// DeviceValidationResult represents device validation result
type DeviceValidationResult struct {
	Valid           bool      `json:"valid"`
	Known           bool      `json:"known"`
	TrustScore      float64   `json:"trust_score"`
	RiskIndicators  []string  `json:"risk_indicators"`
	LastSeen        time.Time `json:"last_seen"`
	RegistrationAge int       `json:"registration_age_days"`
}

// StepUpRateLimiter interface for rate limiting
type StepUpRateLimiter interface {
	CheckLimit(ctx context.Context, accountID string) (bool, int, error)
	RecordAttempt(ctx context.Context, accountID string, success bool) error
}

// NewHardenedStepUpAuth creates a new hardened step-up auth service
func NewHardenedStepUpAuth(db *sql.DB, deviceValidator DeviceValidator, rateLimiter StepUpRateLimiter) *HardenedStepUpAuth {
	return &HardenedStepUpAuth{
		db:              db,
		challenges:      make(map[string]*HardenedChallenge),
		deviceValidator: deviceValidator,
		rateLimiter:     rateLimiter,
	}
}

// CreateChallenge creates a context-bound step-up challenge
func (h *HardenedStepUpAuth) CreateChallenge(ctx context.Context, txContext *TransactionContext, accountID, method string) (*HardenedChallenge, error) {
	// Check rate limit
	if h.rateLimiter != nil {
		allowed, remaining, err := h.rateLimiter.CheckLimit(ctx, accountID)
		if err != nil {
			return nil, fmt.Errorf("rate limit check failed: %w", err)
		}
		if !allowed {
			return nil, fmt.Errorf("rate limit exceeded, %d attempts remaining", remaining)
		}
	}

	// Validate device if validator available
	if h.deviceValidator != nil {
		result, err := h.deviceValidator.ValidateFingerprint(ctx, txContext.DeviceID, accountID)
		if err != nil {
			return nil, fmt.Errorf("device validation failed: %w", err)
		}
		if !result.Valid {
			return nil, fmt.Errorf("device validation failed: %v", result.RiskIndicators)
		}
	}

	// Generate context hash (binds challenge to specific transaction)
	contextHash := h.generateContextHash(txContext)

	// Generate challenge
	challenge := &HardenedChallenge{
		ChallengeID:       fmt.Sprintf("stepup_%d", time.Now().UnixNano()),
		TransactionID:     txContext.TransactionID,
		AccountID:         accountID,
		Method:            method,
		Challenge:         generateOTP(),
		ContextHash:       contextHash,
		DeviceFingerprint: txContext.DeviceID,
		IPAddress:         txContext.IPAddress,
		CreatedAt:         time.Now().UTC(),
		ExpiresAt:         time.Now().Add(5 * time.Minute),
		MaxAttempts:       3,
		Status:            "PENDING",
	}

	h.mu.Lock()
	h.challenges[challenge.ChallengeID] = challenge
	h.mu.Unlock()

	return challenge, nil
}

// VerifyChallenge verifies a step-up challenge with context binding
func (h *HardenedStepUpAuth) VerifyChallenge(ctx context.Context, challengeID, response string, txContext *TransactionContext) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	challenge, ok := h.challenges[challengeID]
	if !ok {
		return false, fmt.Errorf("challenge not found")
	}

	// Check expiry
	if time.Now().After(challenge.ExpiresAt) {
		challenge.Status = "EXPIRED"
		return false, fmt.Errorf("challenge expired")
	}

	// Check attempts
	challenge.Attempts++
	if challenge.Attempts > challenge.MaxAttempts {
		challenge.Status = "LOCKED"
		if h.rateLimiter != nil {
			h.rateLimiter.RecordAttempt(ctx, challenge.AccountID, false)
		}
		return false, fmt.Errorf("max attempts exceeded")
	}

	// Verify context binding (prevent replay across transactions)
	currentContextHash := h.generateContextHash(txContext)
	if currentContextHash != challenge.ContextHash {
		challenge.Status = "CONTEXT_MISMATCH"
		return false, fmt.Errorf("transaction context mismatch - possible replay attack")
	}

	// Verify device fingerprint
	if txContext.DeviceID != challenge.DeviceFingerprint {
		challenge.Status = "DEVICE_MISMATCH"
		return false, fmt.Errorf("device fingerprint mismatch")
	}

	// Verify response
	if response != challenge.Challenge {
		if h.rateLimiter != nil {
			h.rateLimiter.RecordAttempt(ctx, challenge.AccountID, false)
		}
		return false, nil
	}

	// Success
	challenge.Status = "VERIFIED"
	delete(h.challenges, challengeID)

	if h.rateLimiter != nil {
		h.rateLimiter.RecordAttempt(ctx, challenge.AccountID, true)
	}

	return true, nil
}

// generateContextHash generates a hash of the transaction context
func (h *HardenedStepUpAuth) generateContextHash(txContext *TransactionContext) string {
	data := fmt.Sprintf("%s:%f:%s:%s:%s:%d",
		txContext.TransactionID,
		txContext.Amount,
		txContext.Currency,
		txContext.PayeeAccount,
		txContext.PayeeName,
		txContext.Timestamp,
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// generateOTP generates a 6-digit OTP
func generateOTP() string {
	b := make([]byte, 4)
	rand.Read(b)
	otp := int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])
	return fmt.Sprintf("%06d", otp%1000000)
}

// =============================================================================
// Database Schema
// =============================================================================

// SecuritySchema returns the database schema for security components
func SecuritySchema() string {
	return `
	-- Encryption keys metadata
	CREATE TABLE IF NOT EXISTS encryption_keys (
		key_id VARCHAR(128) PRIMARY KEY,
		algorithm VARCHAR(32) NOT NULL,
		encrypted_key BYTEA NOT NULL,
		version INTEGER NOT NULL,
		status VARCHAR(32) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		expires_at TIMESTAMP,
		rotated_at TIMESTAMP,
		usage_count BIGINT DEFAULT 0
	);

	-- Encryption audit log
	CREATE TABLE IF NOT EXISTS encryption_audit_log (
		event_id VARCHAR(128) PRIMARY KEY,
		operation VARCHAR(32) NOT NULL,
		key_id VARCHAR(128) NOT NULL,
		key_version INTEGER NOT NULL,
		data_type VARCHAR(64) NOT NULL,
		record_id VARCHAR(128),
		user_id VARCHAR(128),
		reason TEXT,
		ip_address VARCHAR(45),
		timestamp TIMESTAMP NOT NULL,
		success BOOLEAN NOT NULL,
		error_message TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_enc_audit_key ON encryption_audit_log(key_id);
	CREATE INDEX IF NOT EXISTS idx_enc_audit_user ON encryption_audit_log(user_id);
	CREATE INDEX IF NOT EXISTS idx_enc_audit_time ON encryption_audit_log(timestamp);

	-- Key rotation log
	CREATE TABLE IF NOT EXISTS key_rotation_log (
		event_id VARCHAR(128) PRIMARY KEY,
		old_key_id VARCHAR(128) NOT NULL,
		old_key_version INTEGER NOT NULL,
		new_key_id VARCHAR(128) NOT NULL,
		new_key_version INTEGER NOT NULL,
		reason TEXT,
		initiated_by VARCHAR(128),
		timestamp TIMESTAMP NOT NULL,
		records_re_encrypted BIGINT DEFAULT 0
	);

	-- Access control audit log
	CREATE TABLE IF NOT EXISTS access_audit_log (
		event_id VARCHAR(128) PRIMARY KEY,
		user_id VARCHAR(128) NOT NULL,
		resource VARCHAR(64) NOT NULL,
		record_id VARCHAR(128),
		action VARCHAR(32) NOT NULL,
		data_level VARCHAR(32),
		reason TEXT,
		ip_address VARCHAR(45),
		session_id VARCHAR(128),
		timestamp TIMESTAMP NOT NULL,
		allowed BOOLEAN NOT NULL,
		decision_reason TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_access_audit_user ON access_audit_log(user_id);
	CREATE INDEX IF NOT EXISTS idx_access_audit_resource ON access_audit_log(resource);
	CREATE INDEX IF NOT EXISTS idx_access_audit_time ON access_audit_log(timestamp);

	-- Step-up authentication challenges
	CREATE TABLE IF NOT EXISTS stepup_challenges (
		challenge_id VARCHAR(128) PRIMARY KEY,
		transaction_id VARCHAR(128) NOT NULL,
		account_id VARCHAR(128) NOT NULL,
		method VARCHAR(32) NOT NULL,
		context_hash VARCHAR(64) NOT NULL,
		device_fingerprint VARCHAR(256),
		ip_address VARCHAR(45),
		created_at TIMESTAMP NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		attempts INTEGER DEFAULT 0,
		max_attempts INTEGER DEFAULT 3,
		status VARCHAR(32) NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_stepup_account ON stepup_challenges(account_id);
	CREATE INDEX IF NOT EXISTS idx_stepup_transaction ON stepup_challenges(transaction_id);

	-- Device registry
	CREATE TABLE IF NOT EXISTS device_registry (
		device_id VARCHAR(256) PRIMARY KEY,
		account_id VARCHAR(128) NOT NULL,
		fingerprint_hash VARCHAR(64) NOT NULL,
		trust_score DECIMAL(5,4) DEFAULT 0.5,
		first_seen TIMESTAMP NOT NULL,
		last_seen TIMESTAMP NOT NULL,
		metadata JSONB,
		status VARCHAR(32) DEFAULT 'ACTIVE'
	);
	CREATE INDEX IF NOT EXISTS idx_device_account ON device_registry(account_id);
	`
}
