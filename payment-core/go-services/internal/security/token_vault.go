package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

type TokenDataType string

const (
	TokenTypePAN           TokenDataType = "pan"
	TokenTypeCVV           TokenDataType = "cvv"
	TokenTypePIN           TokenDataType = "pin"
	TokenTypeAccountNumber TokenDataType = "account_number"
	TokenTypeBVN           TokenDataType = "bvn"
	TokenTypeNIN           TokenDataType = "nin"
	TokenTypePII           TokenDataType = "pii"
	TokenTypeBiometric     TokenDataType = "biometric"
)

type TokenizedData struct {
	Token     string            `json:"token"`
	DataType  TokenDataType     `json:"data_type"`
	CreatedAt time.Time         `json:"created_at"`
	ExpiresAt *time.Time        `json:"expires_at,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type storedToken struct {
	EncryptedData string
	DataType      TokenDataType
	Metadata      map[string]string
	CreatedAt     time.Time
	ExpiresAt     *time.Time
}

type VaultKeyMetadata struct {
	KeyID     string     `json:"key_id"`
	Version   int        `json:"version"`
	Algorithm string     `json:"algorithm"`
	CreatedAt time.Time  `json:"created_at"`
	RotatedAt *time.Time `json:"rotated_at,omitempty"`
	Status    string     `json:"status"`
}

type keyData struct {
	Key      []byte
	Metadata VaultKeyMetadata
}

type AuditEntry struct {
	Timestamp time.Time     `json:"timestamp"`
	Operation string        `json:"operation"`
	TokenID   string        `json:"token_id,omitempty"`
	KeyID     string        `json:"key_id,omitempty"`
	DataType  TokenDataType `json:"data_type,omitempty"`
	Success   bool          `json:"success"`
	Error     string        `json:"error,omitempty"`
	Purpose   string        `json:"purpose,omitempty"`
}

type TokenVault struct {
	mu               sync.RWMutex
	tokenStore       map[string]*storedToken
	keyStore         map[string]*keyData
	auditLog         []AuditEntry
	currentDataKeyID string
	masterKeyID      string
}

func NewTokenVault() (*TokenVault, error) {
	tv := &TokenVault{
		tokenStore:       make(map[string]*storedToken),
		keyStore:         make(map[string]*keyData),
		auditLog:         make([]AuditEntry, 0),
		masterKeyID:      "master-key-v1",
		currentDataKeyID: "data-key-v1",
	}

	if err := tv.initializeKeys(); err != nil {
		return nil, fmt.Errorf("failed to initialize keys: %w", err)
	}

	return tv, nil
}

func (tv *TokenVault) initializeKeys() error {
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		return err
	}
	tv.keyStore[tv.masterKeyID] = &keyData{
		Key: masterKey,
		Metadata: VaultKeyMetadata{
			KeyID:     tv.masterKeyID,
			Version:   1,
			Algorithm: "AES-256-GCM",
			CreatedAt: time.Now(),
			Status:    "active",
		},
	}

	dataKey := make([]byte, 32)
	if _, err := rand.Read(dataKey); err != nil {
		return err
	}
	tv.keyStore[tv.currentDataKeyID] = &keyData{
		Key: dataKey,
		Metadata: VaultKeyMetadata{
			KeyID:     tv.currentDataKeyID,
			Version:   1,
			Algorithm: "AES-256-GCM",
			CreatedAt: time.Now(),
			Status:    "active",
		},
	}

	return nil
}

func (tv *TokenVault) getDataKey() ([]byte, error) {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	kd, ok := tv.keyStore[tv.currentDataKeyID]
	if !ok {
		return nil, errors.New("data encryption key not found")
	}
	return kd.Key, nil
}

func (tv *TokenVault) encrypt(plaintext string) (string, error) {
	key, err := tv.getDataKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (tv *TokenVault) decrypt(encryptedData string) (string, error) {
	key, err := tv.getDataKey()
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (tv *TokenVault) generateToken(dataType TokenDataType) string {
	prefix := tv.getTokenPrefix(dataType)
	randomBytes := make([]byte, 16)
	rand.Read(randomBytes)
	randomPart := hex.EncodeToString(randomBytes)

	hash := sha256.Sum256([]byte(randomPart))
	checksum := hex.EncodeToString(hash[:])[:4]

	return fmt.Sprintf("%s_%s%s", prefix, randomPart, checksum)
}

func (tv *TokenVault) getTokenPrefix(dataType TokenDataType) string {
	prefixes := map[TokenDataType]string{
		TokenTypePAN:           "tok_pan",
		TokenTypeCVV:           "tok_cvv",
		TokenTypePIN:           "tok_pin",
		TokenTypeAccountNumber: "tok_acc",
		TokenTypeBVN:           "tok_bvn",
		TokenTypeNIN:           "tok_nin",
		TokenTypePII:           "tok_pii",
		TokenTypeBiometric:     "tok_bio",
	}
	if p, ok := prefixes[dataType]; ok {
		return p
	}
	return "tok_unk"
}

type TokenizeOptions struct {
	ExpiresInSeconds int
	Metadata         map[string]string
}

func (tv *TokenVault) Tokenize(sensitiveData string, dataType TokenDataType, opts *TokenizeOptions) (*TokenizedData, error) {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	token := tv.generateToken(dataType)
	encryptedData, err := tv.encrypt(sensitiveData)
	if err != nil {
		tv.logTokenOperation("tokenize", token, dataType, false, err.Error(), "")
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	stored := &storedToken{
		EncryptedData: encryptedData,
		DataType:      dataType,
		CreatedAt:     time.Now(),
	}

	if opts != nil {
		stored.Metadata = opts.Metadata
		if opts.ExpiresInSeconds > 0 {
			expiresAt := time.Now().Add(time.Duration(opts.ExpiresInSeconds) * time.Second)
			stored.ExpiresAt = &expiresAt
		}
	}

	tv.tokenStore[token] = stored
	tv.logTokenOperation("tokenize", token, dataType, true, "", "")

	result := &TokenizedData{
		Token:     token,
		DataType:  dataType,
		CreatedAt: stored.CreatedAt,
		ExpiresAt: stored.ExpiresAt,
	}
	if opts != nil {
		result.Metadata = opts.Metadata
	}

	return result, nil
}

type DetokenizeResult struct {
	Success bool
	Data    string
	Error   string
}

func (tv *TokenVault) Detokenize(token, purpose string) *DetokenizeResult {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	stored, ok := tv.tokenStore[token]
	if !ok {
		tv.logTokenOperation("detokenize", token, "", false, "token not found", purpose)
		return &DetokenizeResult{Success: false, Error: "token not found"}
	}

	if stored.ExpiresAt != nil && stored.ExpiresAt.Before(time.Now()) {
		delete(tv.tokenStore, token)
		tv.logTokenOperation("detokenize", token, stored.DataType, false, "token expired", purpose)
		return &DetokenizeResult{Success: false, Error: "token expired"}
	}

	decrypted, err := tv.decrypt(stored.EncryptedData)
	if err != nil {
		tv.logTokenOperation("detokenize", token, stored.DataType, false, err.Error(), purpose)
		return &DetokenizeResult{Success: false, Error: "decryption failed"}
	}

	tv.logTokenOperation("detokenize", token, stored.DataType, true, "", purpose)
	return &DetokenizeResult{Success: true, Data: decrypted}
}

func (tv *TokenVault) DeleteToken(token string) bool {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	_, existed := tv.tokenStore[token]
	delete(tv.tokenStore, token)
	tv.logTokenOperation("delete", token, "", existed, "", "")
	return existed
}

func (tv *TokenVault) RotateDataKey() (*VaultKeyMetadata, error) {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	oldKeyID := tv.currentDataKeyID
	oldKey, ok := tv.keyStore[oldKeyID]
	if ok {
		oldKey.Metadata.Status = "pending_rotation"
	}

	newVersion := 1
	if oldKey != nil {
		newVersion = oldKey.Metadata.Version + 1
	}

	newKeyID := fmt.Sprintf("data-key-v%d", newVersion)
	newKey := make([]byte, 32)
	if _, err := rand.Read(newKey); err != nil {
		return nil, err
	}

	tv.keyStore[newKeyID] = &keyData{
		Key: newKey,
		Metadata: VaultKeyMetadata{
			KeyID:     newKeyID,
			Version:   newVersion,
			Algorithm: "AES-256-GCM",
			CreatedAt: time.Now(),
			Status:    "active",
		},
	}

	tv.currentDataKeyID = newKeyID

	if oldKey != nil {
		oldKey.Metadata.Status = "retired"
		now := time.Now()
		oldKey.Metadata.RotatedAt = &now
	}

	tv.logKeyOperation("rotate", newKeyID, newVersion)
	return &tv.keyStore[newKeyID].Metadata, nil
}

func (tv *TokenVault) GetKeyMetadata(keyID string) *VaultKeyMetadata {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	if keyID == "" {
		keyID = tv.currentDataKeyID
	}

	if kd, ok := tv.keyStore[keyID]; ok {
		return &kd.Metadata
	}
	return nil
}

func (tv *TokenVault) ListKeys() []VaultKeyMetadata {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	keys := make([]VaultKeyMetadata, 0, len(tv.keyStore))
	for _, kd := range tv.keyStore {
		keys = append(keys, kd.Metadata)
	}
	return keys
}

func (tv *TokenVault) logTokenOperation(operation, token string, dataType TokenDataType, success bool, errMsg, purpose string) {
	truncatedToken := token
	if len(token) > 20 {
		truncatedToken = token[:20] + "..."
	}

	entry := AuditEntry{
		Timestamp: time.Now(),
		Operation: operation,
		TokenID:   truncatedToken,
		DataType:  dataType,
		Success:   success,
		Error:     errMsg,
		Purpose:   purpose,
	}

	tv.auditLog = append(tv.auditLog, entry)

	if len(tv.auditLog) > 10000 {
		tv.auditLog = tv.auditLog[len(tv.auditLog)-10000:]
	}
}

func (tv *TokenVault) logKeyOperation(operation, keyID string, version int) {
	entry := AuditEntry{
		Timestamp: time.Now(),
		Operation: fmt.Sprintf("key_%s", operation),
		KeyID:     keyID,
		Success:   true,
	}
	tv.auditLog = append(tv.auditLog, entry)
}

func (tv *TokenVault) GetAuditLog(limit int) []AuditEntry {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	if limit <= 0 || limit > len(tv.auditLog) {
		limit = len(tv.auditLog)
	}

	start := len(tv.auditLog) - limit
	if start < 0 {
		start = 0
	}

	result := make([]AuditEntry, limit)
	copy(result, tv.auditLog[start:])
	return result
}

func MaskPAN(pan string) string {
	if len(pan) < 13 {
		return "****"
	}
	return pan[:6] + strings.Repeat("*", len(pan)-10) + pan[len(pan)-4:]
}

func MaskAccountNumber(accountNumber string) string {
	if len(accountNumber) < 6 {
		return "****"
	}
	return strings.Repeat("*", len(accountNumber)-4) + accountNumber[len(accountNumber)-4:]
}

func MaskBVN(bvn string) string {
	if len(bvn) != 11 {
		return "***********"
	}
	return bvn[:3] + "*****" + bvn[8:]
}

func GenerateHMAC(data string, key []byte) string {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func VerifyHMAC(data, signature string, key []byte) bool {
	expected := GenerateHMAC(data, key)
	return hmac.Equal([]byte(expected), []byte(signature))
}
