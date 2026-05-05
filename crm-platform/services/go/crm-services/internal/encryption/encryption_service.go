package encryption

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Encryption-at-rest service with AES-256-GCM, key rotation, envelope encryption,
// field-level encryption for PII, and HSM integration interface

type EncryptionConfig struct {
	MasterKeyID       string        `json:"master_key_id"`
	MasterKeyHex      string        `json:"-"` // Never logged
	KeyRotationPeriod time.Duration `json:"key_rotation_period"`
	Algorithm         string        `json:"algorithm"`
	HSMEnabled        bool          `json:"hsm_enabled"`
	HSMEndpoint       string        `json:"hsm_endpoint"`
}

func DefaultEncryptionConfig() *EncryptionConfig {
	key := make([]byte, 32)
	rand.Read(key)
	return &EncryptionConfig{
		MasterKeyID:       "mk-" + uuid.New().String()[:8],
		MasterKeyHex:      hex.EncodeToString(key),
		KeyRotationPeriod: 90 * 24 * time.Hour,
		Algorithm:         "AES-256-GCM",
		HSMEnabled:        false,
	}
}

type KeyMetadata struct {
	ID        string    `json:"id"`
	Algorithm string    `json:"algorithm"`
	Version   int       `json:"version"`
	Status    string    `json:"status"` // active, rotated, destroyed
	CreatedAt time.Time `json:"created_at"`
	RotatedAt time.Time `json:"rotated_at,omitempty"`
	ExpiresAt time.Time `json:"expires_at"`
}

type EncryptedData struct {
	KeyID      string `json:"key_id"`
	Algorithm  string `json:"algorithm"`
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"ciphertext"`
	HMAC       string `json:"hmac"`
	Version    int    `json:"version"`
}

type PIIField struct {
	FieldName  string `json:"field_name"`
	FieldType  string `json:"field_type"` // ssn, phone, email, name, address, account_number, bvn
	Encrypted  bool   `json:"encrypted"`
	Searchable bool   `json:"searchable"` // Uses deterministic encryption for search
}

// HSMProvider interface for hardware security module integration
type HSMProvider interface {
	GenerateKey(ctx context.Context, algorithm string, keySize int) (keyID string, err error)
	Encrypt(ctx context.Context, keyID string, plaintext []byte) ([]byte, error)
	Decrypt(ctx context.Context, keyID string, ciphertext []byte) ([]byte, error)
	Sign(ctx context.Context, keyID string, data []byte) ([]byte, error)
	Verify(ctx context.Context, keyID string, data, signature []byte) (bool, error)
	RotateKey(ctx context.Context, keyID string) (newKeyID string, err error)
	DestroyKey(ctx context.Context, keyID string) error
}

type EncryptionService struct {
	config    *EncryptionConfig
	masterKey []byte
	dataKeys  map[string][]byte
	keyMeta   map[string]*KeyMetadata
	mu        sync.RWMutex
	hsm       HSMProvider
	piiFields map[string][]PIIField
}

func NewEncryptionService(config *EncryptionConfig) (*EncryptionService, error) {
	if config == nil {
		config = DefaultEncryptionConfig()
	}
	masterKey, err := hex.DecodeString(config.MasterKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid master key: %w", err)
	}
	svc := &EncryptionService{
		config:    config,
		masterKey: masterKey,
		dataKeys:  make(map[string][]byte),
		keyMeta:   make(map[string]*KeyMetadata),
		piiFields: defaultPIIFields(),
	}
	svc.generateDataKey("default")
	return svc, nil
}

func (s *EncryptionService) Encrypt(ctx context.Context, plaintext []byte) (*EncryptedData, error) {
	return s.EncryptWithKey(ctx, "default", plaintext)
}

func (s *EncryptionService) EncryptWithKey(ctx context.Context, keyID string, plaintext []byte) (*EncryptedData, error) {
	s.mu.RLock()
	key, exists := s.dataKeys[keyID]
	meta := s.keyMeta[keyID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("key %s not found", keyID)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher creation failed: %w", err)
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("GCM creation failed: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("nonce generation failed: %w", err)
	}

	ciphertext := aesGCM.Seal(nil, nonce, plaintext, nil)

	mac := hmac.New(sha512.New, s.masterKey)
	mac.Write(ciphertext)
	macSum := mac.Sum(nil)

	return &EncryptedData{
		KeyID:      keyID,
		Algorithm:  "AES-256-GCM",
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		HMAC:       hex.EncodeToString(macSum),
		Version:    meta.Version,
	}, nil
}

func (s *EncryptionService) Decrypt(ctx context.Context, data *EncryptedData) ([]byte, error) {
	s.mu.RLock()
	key, exists := s.dataKeys[data.KeyID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("key %s not found", data.KeyID)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(data.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("ciphertext decode failed: %w", err)
	}

	// Verify HMAC
	mac := hmac.New(sha512.New, s.masterKey)
	mac.Write(ciphertext)
	expectedMAC := mac.Sum(nil)
	actualMAC, _ := hex.DecodeString(data.HMAC)
	if !hmac.Equal(expectedMAC, actualMAC) {
		return nil, fmt.Errorf("HMAC verification failed: data may have been tampered with")
	}

	nonce, err := base64.StdEncoding.DecodeString(data.Nonce)
	if err != nil {
		return nil, fmt.Errorf("nonce decode failed: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher creation failed: %w", err)
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("GCM creation failed: %w", err)
	}

	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}
	return plaintext, nil
}

func (s *EncryptionService) EncryptPII(ctx context.Context, resourceType string, data map[string]interface{}) (map[string]interface{}, error) {
	fields, ok := s.piiFields[resourceType]
	if !ok {
		return data, nil
	}
	result := make(map[string]interface{})
	for k, v := range data {
		result[k] = v
	}
	for _, field := range fields {
		if val, ok := data[field.FieldName]; ok && val != nil {
			plaintext := []byte(fmt.Sprintf("%v", val))
			if field.Searchable {
				hash := sha256.Sum256(append(s.masterKey, plaintext...))
				result[field.FieldName+"_hash"] = hex.EncodeToString(hash[:])
			}
			encrypted, err := s.Encrypt(ctx, plaintext)
			if err != nil {
				return nil, fmt.Errorf("encrypt PII field %s: %w", field.FieldName, err)
			}
			encJSON, _ := json.Marshal(encrypted)
			result[field.FieldName] = string(encJSON)
			result[field.FieldName+"_encrypted"] = true
		}
	}
	return result, nil
}

func (s *EncryptionService) DecryptPII(ctx context.Context, resourceType string, data map[string]interface{}) (map[string]interface{}, error) {
	fields, ok := s.piiFields[resourceType]
	if !ok {
		return data, nil
	}
	result := make(map[string]interface{})
	for k, v := range data {
		result[k] = v
	}
	for _, field := range fields {
		if val, ok := data[field.FieldName]; ok {
			if str, ok := val.(string); ok && strings.HasPrefix(str, "{\"key_id\"") {
				var enc EncryptedData
				if err := json.Unmarshal([]byte(str), &enc); err == nil {
					plaintext, err := s.Decrypt(ctx, &enc)
					if err != nil {
						return nil, fmt.Errorf("decrypt PII field %s: %w", field.FieldName, err)
					}
					result[field.FieldName] = string(plaintext)
					delete(result, field.FieldName+"_encrypted")
					delete(result, field.FieldName+"_hash")
				}
			}
		}
	}
	return result, nil
}

func (s *EncryptionService) RotateKey(ctx context.Context, keyID string) (*KeyMetadata, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldMeta, exists := s.keyMeta[keyID]
	if !exists {
		return nil, fmt.Errorf("key %s not found", keyID)
	}

	oldMeta.Status = "rotated"
	oldMeta.RotatedAt = time.Now().UTC()

	newKeyID := keyID + "-v" + fmt.Sprintf("%d", oldMeta.Version+1)
	newKey := make([]byte, 32)
	rand.Read(newKey)

	newMeta := &KeyMetadata{
		ID:        newKeyID,
		Algorithm: "AES-256-GCM",
		Version:   oldMeta.Version + 1,
		Status:    "active",
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().Add(s.config.KeyRotationPeriod),
	}

	s.dataKeys[newKeyID] = newKey
	s.keyMeta[newKeyID] = newMeta
	return newMeta, nil
}

func (s *EncryptionService) generateDataKey(keyID string) {
	key := make([]byte, 32)
	rand.Read(key)
	s.dataKeys[keyID] = key
	s.keyMeta[keyID] = &KeyMetadata{
		ID:        keyID,
		Algorithm: "AES-256-GCM",
		Version:   1,
		Status:    "active",
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().Add(s.config.KeyRotationPeriod),
	}
}

func (s *EncryptionService) ListKeys() []*KeyMetadata {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var keys []*KeyMetadata
	for _, meta := range s.keyMeta {
		keys = append(keys, meta)
	}
	return keys
}

func defaultPIIFields() map[string][]PIIField {
	return map[string][]PIIField{
		"customer": {
			{FieldName: "bvn", FieldType: "bvn", Encrypted: true, Searchable: true},
			{FieldName: "nin", FieldType: "nin", Encrypted: true, Searchable: true},
			{FieldName: "phone", FieldType: "phone", Encrypted: true, Searchable: true},
			{FieldName: "email", FieldType: "email", Encrypted: true, Searchable: true},
			{FieldName: "date_of_birth", FieldType: "date", Encrypted: true},
			{FieldName: "address", FieldType: "address", Encrypted: true},
			{FieldName: "next_of_kin", FieldType: "name", Encrypted: true},
			{FieldName: "account_number", FieldType: "account_number", Encrypted: true, Searchable: true},
		},
		"agent": {
			{FieldName: "bvn", FieldType: "bvn", Encrypted: true, Searchable: true},
			{FieldName: "phone", FieldType: "phone", Encrypted: true, Searchable: true},
			{FieldName: "address", FieldType: "address", Encrypted: true},
		},
		"transaction": {
			{FieldName: "sender_account", FieldType: "account_number", Encrypted: true},
			{FieldName: "receiver_account", FieldType: "account_number", Encrypted: true},
			{FieldName: "narration", FieldType: "text", Encrypted: true},
		},
	}
}

// HTTP Handlers
type EncryptionHandler struct {
	service *EncryptionService
}

func NewEncryptionHandler(service *EncryptionService) *EncryptionHandler {
	return &EncryptionHandler{service: service}
}

func (h *EncryptionHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/security/encrypt", h.Encrypt)
	mux.HandleFunc("POST /api/v1/security/decrypt", h.Decrypt)
	mux.HandleFunc("GET /api/v1/security/keys", h.ListKeys)
	mux.HandleFunc("POST /api/v1/security/keys/rotate", h.RotateKey)
	mux.HandleFunc("POST /api/v1/security/pii/encrypt", h.EncryptPII)
	mux.HandleFunc("POST /api/v1/security/pii/decrypt", h.DecryptPII)
}

func (h *EncryptionHandler) Encrypt(w http.ResponseWriter, r *http.Request) {
	var req struct{ Plaintext string `json:"plaintext"` }
	json.NewDecoder(r.Body).Decode(&req)
	enc, err := h.service.Encrypt(r.Context(), []byte(req.Plaintext))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(enc)
}

func (h *EncryptionHandler) Decrypt(w http.ResponseWriter, r *http.Request) {
	var data EncryptedData
	json.NewDecoder(r.Body).Decode(&data)
	plaintext, err := h.service.Decrypt(r.Context(), &data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"plaintext": string(plaintext)})
}

func (h *EncryptionHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.service.ListKeys())
}

func (h *EncryptionHandler) RotateKey(w http.ResponseWriter, r *http.Request) {
	var req struct{ KeyID string `json:"key_id"` }
	json.NewDecoder(r.Body).Decode(&req)
	if req.KeyID == "" {
		req.KeyID = "default"
	}
	meta, err := h.service.RotateKey(r.Context(), req.KeyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meta)
}

func (h *EncryptionHandler) EncryptPII(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResourceType string                 `json:"resource_type"`
		Data         map[string]interface{} `json:"data"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	encrypted, err := h.service.EncryptPII(r.Context(), req.ResourceType, req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(encrypted)
}

func (h *EncryptionHandler) DecryptPII(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResourceType string                 `json:"resource_type"`
		Data         map[string]interface{} `json:"data"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	decrypted, err := h.service.DecryptPII(r.Context(), req.ResourceType, req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decrypted)
}
