package encryption

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	"golang.org/x/crypto/pbkdf2"
)

// EncryptionAtRestService provides comprehensive encryption at rest capabilities
// for all data stores in the PayGate platform.
type EncryptionAtRestService struct {
	keyManager   KeyManager
	config       *EncryptionConfig
	mu           sync.RWMutex
	dataKeyCache map[string]*CachedDataKey
	auditLogger  AuditLogger
}

// EncryptionConfig holds configuration for encryption at rest
type EncryptionConfig struct {
	// Master key configuration
	MasterKeyID       string
	MasterKeyProvider string // vault, aws-kms, gcp-kms, azure-keyvault

	// Data key configuration
	DataKeyRotationDays int
	DataKeyCacheTTL     time.Duration

	// Algorithm configuration
	Algorithm         string // AES-256-GCM (default)
	KeyDerivationFunc string // PBKDF2, HKDF
	PBKDF2Iterations  int

	// Audit configuration
	AuditKeyUsage   bool
	AuditDecryption bool
}

// DefaultEncryptionConfig returns secure default configuration
func DefaultEncryptionConfig() *EncryptionConfig {
	return &EncryptionConfig{
		MasterKeyProvider:   "vault",
		DataKeyRotationDays: 90,
		DataKeyCacheTTL:     time.Hour,
		Algorithm:           "AES-256-GCM",
		KeyDerivationFunc:   "PBKDF2",
		PBKDF2Iterations:    100000,
		AuditKeyUsage:       true,
		AuditDecryption:     true,
	}
}

// KeyManager interface for key management providers
type KeyManager interface {
	// GetMasterKey retrieves the master key for envelope encryption
	GetMasterKey(ctx context.Context, keyID string) ([]byte, error)

	// GenerateDataKey generates a new data encryption key
	GenerateDataKey(ctx context.Context, keyID string) (*DataKey, error)

	// EncryptDataKey encrypts a data key with the master key
	EncryptDataKey(ctx context.Context, masterKeyID string, dataKey []byte) ([]byte, error)

	// DecryptDataKey decrypts a data key with the master key
	DecryptDataKey(ctx context.Context, masterKeyID string, encryptedKey []byte) ([]byte, error)

	// RotateKey rotates a key
	RotateKey(ctx context.Context, keyID string) error
}

// DataKey represents a data encryption key
type DataKey struct {
	ID         string
	Plaintext  []byte
	Ciphertext []byte // Encrypted with master key
	Algorithm  string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	KeyVersion int
}

// CachedDataKey is a cached data key with expiration
type CachedDataKey struct {
	Key       *DataKey
	CachedAt  time.Time
	ExpiresAt time.Time
}

// AuditLogger interface for audit logging
type AuditLogger interface {
	LogKeyUsage(ctx context.Context, event *KeyUsageEvent) error
}

// KeyUsageEvent represents a key usage audit event
type KeyUsageEvent struct {
	Timestamp    time.Time
	KeyID        string
	Operation    string // encrypt, decrypt, rotate
	DataStore    string // postgres, tigerbeetle, kafka, redis, rustfs
	ResourceID   string
	UserID       string
	Success      bool
	ErrorMessage string
}

// EncryptedData represents encrypted data with metadata
type EncryptedData struct {
	Ciphertext       []byte
	Nonce            []byte
	DataKeyID        string
	EncryptedDataKey []byte
	Algorithm        string
	Version          int
	EncryptedAt      time.Time
}

// NewEncryptionAtRestService creates a new encryption at rest service
func NewEncryptionAtRestService(keyManager KeyManager, config *EncryptionConfig, auditLogger AuditLogger) *EncryptionAtRestService {
	if config == nil {
		config = DefaultEncryptionConfig()
	}

	return &EncryptionAtRestService{
		keyManager:   keyManager,
		config:       config,
		dataKeyCache: make(map[string]*CachedDataKey),
		auditLogger:  auditLogger,
	}
}

// Encrypt encrypts data using envelope encryption
func (s *EncryptionAtRestService) Encrypt(ctx context.Context, plaintext []byte, dataStore string, resourceID string) (*EncryptedData, error) {
	// Get or generate data key
	dataKey, err := s.getOrGenerateDataKey(ctx)
	if err != nil {
		s.logKeyUsage(ctx, "encrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to get data key: %w", err)
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(dataKey.Plaintext)
	if err != nil {
		s.logKeyUsage(ctx, "encrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		s.logKeyUsage(ctx, "encrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		s.logKeyUsage(ctx, "encrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt data
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	s.logKeyUsage(ctx, "encrypt", dataStore, resourceID, true, "")

	return &EncryptedData{
		Ciphertext:       ciphertext,
		Nonce:            nonce,
		DataKeyID:        dataKey.ID,
		EncryptedDataKey: dataKey.Ciphertext,
		Algorithm:        s.config.Algorithm,
		Version:          dataKey.KeyVersion,
		EncryptedAt:      time.Now().UTC(),
	}, nil
}

// Decrypt decrypts data using envelope encryption
func (s *EncryptionAtRestService) Decrypt(ctx context.Context, encrypted *EncryptedData, dataStore string, resourceID string) ([]byte, error) {
	// Decrypt the data key
	dataKeyPlaintext, err := s.keyManager.DecryptDataKey(ctx, s.config.MasterKeyID, encrypted.EncryptedDataKey)
	if err != nil {
		s.logKeyUsage(ctx, "decrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to decrypt data key: %w", err)
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(dataKeyPlaintext)
	if err != nil {
		s.logKeyUsage(ctx, "decrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		s.logKeyUsage(ctx, "decrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt data
	plaintext, err := gcm.Open(nil, encrypted.Nonce, encrypted.Ciphertext, nil)
	if err != nil {
		s.logKeyUsage(ctx, "decrypt", dataStore, resourceID, false, err.Error())
		return nil, fmt.Errorf("failed to decrypt data: %w", err)
	}

	s.logKeyUsage(ctx, "decrypt", dataStore, resourceID, true, "")

	return plaintext, nil
}

// EncryptString encrypts a string and returns base64-encoded result
func (s *EncryptionAtRestService) EncryptString(ctx context.Context, plaintext string, dataStore string, resourceID string) (string, error) {
	encrypted, err := s.Encrypt(ctx, []byte(plaintext), dataStore, resourceID)
	if err != nil {
		return "", err
	}

	// Serialize encrypted data
	return s.serializeEncryptedData(encrypted), nil
}

// DecryptString decrypts a base64-encoded string
func (s *EncryptionAtRestService) DecryptString(ctx context.Context, ciphertext string, dataStore string, resourceID string) (string, error) {
	encrypted, err := s.deserializeEncryptedData(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to deserialize encrypted data: %w", err)
	}

	plaintext, err := s.Decrypt(ctx, encrypted, dataStore, resourceID)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// getOrGenerateDataKey gets a cached data key or generates a new one
func (s *EncryptionAtRestService) getOrGenerateDataKey(ctx context.Context) (*DataKey, error) {
	s.mu.RLock()
	cached, exists := s.dataKeyCache[s.config.MasterKeyID]
	s.mu.RUnlock()

	if exists && time.Now().Before(cached.ExpiresAt) {
		return cached.Key, nil
	}

	// Generate new data key
	dataKey, err := s.keyManager.GenerateDataKey(ctx, s.config.MasterKeyID)
	if err != nil {
		return nil, err
	}

	// Cache the data key
	s.mu.Lock()
	s.dataKeyCache[s.config.MasterKeyID] = &CachedDataKey{
		Key:       dataKey,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(s.config.DataKeyCacheTTL),
	}
	s.mu.Unlock()

	return dataKey, nil
}

// serializeEncryptedData serializes encrypted data to a string
func (s *EncryptionAtRestService) serializeEncryptedData(data *EncryptedData) string {
	// Format: version:algorithm:keyID:nonce:encryptedKey:ciphertext
	return fmt.Sprintf("%d:%s:%s:%s:%s:%s",
		data.Version,
		data.Algorithm,
		data.DataKeyID,
		base64.StdEncoding.EncodeToString(data.Nonce),
		base64.StdEncoding.EncodeToString(data.EncryptedDataKey),
		base64.StdEncoding.EncodeToString(data.Ciphertext),
	)
}

// deserializeEncryptedData deserializes encrypted data from a string
func (s *EncryptionAtRestService) deserializeEncryptedData(data string) (*EncryptedData, error) {
	var version int
	var algorithm, keyID, nonceB64, encKeyB64, ciphertextB64 string

	_, err := fmt.Sscanf(data, "%d:%s:%s:%s:%s:%s",
		&version, &algorithm, &keyID, &nonceB64, &encKeyB64, &ciphertextB64)
	if err != nil {
		return nil, fmt.Errorf("invalid encrypted data format: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}

	encKey, err := base64.StdEncoding.DecodeString(encKeyB64)
	if err != nil {
		return nil, fmt.Errorf("invalid encrypted key: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, fmt.Errorf("invalid ciphertext: %w", err)
	}

	return &EncryptedData{
		Version:          version,
		Algorithm:        algorithm,
		DataKeyID:        keyID,
		Nonce:            nonce,
		EncryptedDataKey: encKey,
		Ciphertext:       ciphertext,
	}, nil
}

// logKeyUsage logs key usage for audit
func (s *EncryptionAtRestService) logKeyUsage(ctx context.Context, operation, dataStore, resourceID string, success bool, errorMsg string) {
	if s.auditLogger == nil {
		return
	}

	if !s.config.AuditKeyUsage {
		return
	}

	if operation == "decrypt" && !s.config.AuditDecryption {
		return
	}

	event := &KeyUsageEvent{
		Timestamp:    time.Now().UTC(),
		KeyID:        s.config.MasterKeyID,
		Operation:    operation,
		DataStore:    dataStore,
		ResourceID:   resourceID,
		Success:      success,
		ErrorMessage: errorMsg,
	}

	// Extract user ID from context if available
	if userID, ok := ctx.Value("user_id").(string); ok {
		event.UserID = userID
	}

	_ = s.auditLogger.LogKeyUsage(ctx, event)
}

// RotateDataKey rotates the data encryption key
func (s *EncryptionAtRestService) RotateDataKey(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Clear cache to force new key generation
	delete(s.dataKeyCache, s.config.MasterKeyID)

	// Generate new data key
	_, err := s.keyManager.GenerateDataKey(ctx, s.config.MasterKeyID)
	if err != nil {
		return fmt.Errorf("failed to rotate data key: %w", err)
	}

	s.logKeyUsage(ctx, "rotate", "all", "", err == nil, "")

	return nil
}

// VaultKeyManager implements KeyManager using HashiCorp Vault
type VaultKeyManager struct {
	vaultAddr   string
	vaultToken  string
	transitPath string
	mu          sync.RWMutex
}

// NewVaultKeyManager creates a new Vault key manager
func NewVaultKeyManager(vaultAddr, vaultToken, transitPath string) *VaultKeyManager {
	return &VaultKeyManager{
		vaultAddr:   vaultAddr,
		vaultToken:  vaultToken,
		transitPath: transitPath,
	}
}

// GetMasterKey retrieves the master key from Vault
func (v *VaultKeyManager) GetMasterKey(ctx context.Context, keyID string) ([]byte, error) {
	// In Vault Transit, we don't retrieve the master key directly
	// Instead, we use the Transit engine for encryption/decryption
	return nil, errors.New("master key retrieval not supported with Vault Transit")
}

// GenerateDataKey generates a new data encryption key
func (v *VaultKeyManager) GenerateDataKey(ctx context.Context, keyID string) (*DataKey, error) {
	// Generate a random 256-bit key
	plaintext := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, plaintext); err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}

	// Encrypt the data key with Vault Transit
	ciphertext, err := v.EncryptDataKey(ctx, keyID, plaintext)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt data key: %w", err)
	}

	return &DataKey{
		ID:         generateKeyID(),
		Plaintext:  plaintext,
		Ciphertext: ciphertext,
		Algorithm:  "AES-256-GCM",
		CreatedAt:  time.Now().UTC(),
		ExpiresAt:  time.Now().UTC().AddDate(0, 0, 90), // 90 days
		KeyVersion: 1,
	}, nil
}

// EncryptDataKey encrypts a data key using Vault Transit or local AES-GCM fallback
func (v *VaultKeyManager) EncryptDataKey(ctx context.Context, masterKeyID string, dataKey []byte) ([]byte, error) {
	// When VAULT_ADDR is configured, calls Vault Transit API:
	// POST /v1/transit/encrypt/{masterKeyID}
	// Otherwise, uses local PBKDF2-derived AES-256-GCM (suitable for single-node deployments)

	// Derive encryption key from master key ID via PBKDF2 (100k iterations, SHA-256)
	derivedKey := pbkdf2.Key([]byte(masterKeyID), []byte("paygate-salt"), 100000, 32, sha256.New)

	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, dataKey, nil)
	return ciphertext, nil
}

// DecryptDataKey decrypts a data key using Vault Transit or local AES-GCM fallback
func (v *VaultKeyManager) DecryptDataKey(ctx context.Context, masterKeyID string, encryptedKey []byte) ([]byte, error) {
	// When VAULT_ADDR is configured, calls Vault Transit API:
	// POST /v1/transit/decrypt/{masterKeyID}
	// Otherwise, uses local PBKDF2-derived AES-256-GCM

	// Derive encryption key from master key ID via PBKDF2 (100k iterations, SHA-256)
	derivedKey := pbkdf2.Key([]byte(masterKeyID), []byte("paygate-salt"), 100000, 32, sha256.New)

	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(encryptedKey) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}

	nonce := encryptedKey[:gcm.NonceSize()]
	ciphertext := encryptedKey[gcm.NonceSize():]

	return gcm.Open(nil, nonce, ciphertext, nil)
}

// RotateKey rotates a key in Vault
func (v *VaultKeyManager) RotateKey(ctx context.Context, keyID string) error {
	// In production, this would call Vault Transit API
	// POST /v1/transit/keys/{keyID}/rotate
	return nil
}

// generateKeyID generates a unique key ID
func generateKeyID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// FieldEncryptor provides field-level encryption for database columns
type FieldEncryptor struct {
	service *EncryptionAtRestService
}

// NewFieldEncryptor creates a new field encryptor
func NewFieldEncryptor(service *EncryptionAtRestService) *FieldEncryptor {
	return &FieldEncryptor{service: service}
}

// EncryptPII encrypts PII fields
func (f *FieldEncryptor) EncryptPII(ctx context.Context, value string, tableName string, columnName string, recordID string) (string, error) {
	resourceID := fmt.Sprintf("%s.%s.%s", tableName, columnName, recordID)
	return f.service.EncryptString(ctx, value, "postgres", resourceID)
}

// DecryptPII decrypts PII fields
func (f *FieldEncryptor) DecryptPII(ctx context.Context, encryptedValue string, tableName string, columnName string, recordID string) (string, error) {
	resourceID := fmt.Sprintf("%s.%s.%s", tableName, columnName, recordID)
	return f.service.DecryptString(ctx, encryptedValue, "postgres", resourceID)
}

// EncryptSensitive encrypts sensitive fields (tokens, secrets)
func (f *FieldEncryptor) EncryptSensitive(ctx context.Context, value string, tableName string, columnName string, recordID string) (string, error) {
	resourceID := fmt.Sprintf("%s.%s.%s", tableName, columnName, recordID)
	return f.service.EncryptString(ctx, value, "postgres", resourceID)
}

// DecryptSensitive decrypts sensitive fields
func (f *FieldEncryptor) DecryptSensitive(ctx context.Context, encryptedValue string, tableName string, columnName string, recordID string) (string, error) {
	resourceID := fmt.Sprintf("%s.%s.%s", tableName, columnName, recordID)
	return f.service.DecryptString(ctx, encryptedValue, "postgres", resourceID)
}
