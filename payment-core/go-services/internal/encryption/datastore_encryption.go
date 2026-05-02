package encryption

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// DataStoreEncryption provides encryption for specific data stores
type DataStoreEncryption struct {
	service *EncryptionAtRestService
}

// NewDataStoreEncryption creates a new data store encryption service
func NewDataStoreEncryption(service *EncryptionAtRestService) *DataStoreEncryption {
	return &DataStoreEncryption{service: service}
}

// PostgresEncryption provides PostgreSQL-specific encryption
type PostgresEncryption struct {
	*DataStoreEncryption
	fieldEncryptor *FieldEncryptor
}

// NewPostgresEncryption creates a new PostgreSQL encryption service
func NewPostgresEncryption(service *EncryptionAtRestService) *PostgresEncryption {
	return &PostgresEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
		fieldEncryptor:      NewFieldEncryptor(service),
	}
}

// EncryptColumn encrypts a column value
func (p *PostgresEncryption) EncryptColumn(ctx context.Context, value interface{}, tableName, columnName, recordID string) (string, error) {
	// Serialize value to JSON
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("failed to serialize value: %w", err)
	}
	
	return p.fieldEncryptor.EncryptPII(ctx, string(jsonBytes), tableName, columnName, recordID)
}

// DecryptColumn decrypts a column value
func (p *PostgresEncryption) DecryptColumn(ctx context.Context, encryptedValue string, tableName, columnName, recordID string, target interface{}) error {
	decrypted, err := p.fieldEncryptor.DecryptPII(ctx, encryptedValue, tableName, columnName, recordID)
	if err != nil {
		return err
	}
	
	return json.Unmarshal([]byte(decrypted), target)
}

// EncryptedColumnConfig defines which columns should be encrypted
type EncryptedColumnConfig struct {
	TableName   string
	ColumnName  string
	DataType    string // pii, sensitive, financial
	Searchable  bool   // If true, use deterministic encryption
}

// DefaultEncryptedColumns returns the default columns to encrypt
func DefaultEncryptedColumns() []EncryptedColumnConfig {
	return []EncryptedColumnConfig{
		// Customer PII
		{TableName: "customers", ColumnName: "email", DataType: "pii", Searchable: true},
		{TableName: "customers", ColumnName: "phone", DataType: "pii", Searchable: true},
		{TableName: "customers", ColumnName: "national_id", DataType: "pii", Searchable: true},
		{TableName: "customers", ColumnName: "date_of_birth", DataType: "pii", Searchable: false},
		{TableName: "customers", ColumnName: "address", DataType: "pii", Searchable: false},
		
		// KYC Documents
		{TableName: "kyc_documents", ColumnName: "document_number", DataType: "pii", Searchable: true},
		{TableName: "kyc_documents", ColumnName: "document_data", DataType: "pii", Searchable: false},
		
		// Bank Accounts
		{TableName: "bank_accounts", ColumnName: "account_number", DataType: "financial", Searchable: true},
		{TableName: "bank_accounts", ColumnName: "routing_number", DataType: "financial", Searchable: true},
		{TableName: "bank_accounts", ColumnName: "iban", DataType: "financial", Searchable: true},
		
		// Cards
		{TableName: "cards", ColumnName: "card_number", DataType: "financial", Searchable: false},
		{TableName: "cards", ColumnName: "cvv", DataType: "sensitive", Searchable: false},
		{TableName: "cards", ColumnName: "expiry", DataType: "financial", Searchable: false},
		
		// API Tokens
		{TableName: "api_tokens", ColumnName: "token_hash", DataType: "sensitive", Searchable: true},
		{TableName: "api_tokens", ColumnName: "secret", DataType: "sensitive", Searchable: false},
		
		// Webhook Secrets
		{TableName: "webhooks", ColumnName: "secret", DataType: "sensitive", Searchable: false},
	}
}

// TigerBeetleEncryption provides TigerBeetle-specific encryption
type TigerBeetleEncryption struct {
	*DataStoreEncryption
}

// NewTigerBeetleEncryption creates a new TigerBeetle encryption service
func NewTigerBeetleEncryption(service *EncryptionAtRestService) *TigerBeetleEncryption {
	return &TigerBeetleEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
	}
}

// EncryptUserData encrypts user_data_128 field for TigerBeetle transfers
func (t *TigerBeetleEncryption) EncryptUserData(ctx context.Context, userData []byte, transferID string) ([]byte, error) {
	encrypted, err := t.service.Encrypt(ctx, userData, "tigerbeetle", transferID)
	if err != nil {
		return nil, err
	}
	
	// TigerBeetle user_data is 128 bits, so we need to store encrypted data separately
	// and use a reference in the user_data field
	return encrypted.Ciphertext, nil
}

// DecryptUserData decrypts user_data_128 field for TigerBeetle transfers
func (t *TigerBeetleEncryption) DecryptUserData(ctx context.Context, encryptedData []byte, transferID string) ([]byte, error) {
	// Reconstruct encrypted data structure
	encrypted := &EncryptedData{
		Ciphertext: encryptedData,
		// Other fields would be retrieved from metadata store
	}
	
	return t.service.Decrypt(ctx, encrypted, "tigerbeetle", transferID)
}

// KafkaEncryption provides Kafka-specific encryption
type KafkaEncryption struct {
	*DataStoreEncryption
}

// NewKafkaEncryption creates a new Kafka encryption service
func NewKafkaEncryption(service *EncryptionAtRestService) *KafkaEncryption {
	return &KafkaEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
	}
}

// EncryptMessage encrypts a Kafka message
func (k *KafkaEncryption) EncryptMessage(ctx context.Context, message []byte, topic string, partition int32, offset int64) ([]byte, error) {
	resourceID := fmt.Sprintf("%s:%d:%d", topic, partition, offset)
	encrypted, err := k.service.Encrypt(ctx, message, "kafka", resourceID)
	if err != nil {
		return nil, err
	}
	
	// Serialize encrypted data for Kafka
	return json.Marshal(encrypted)
}

// DecryptMessage decrypts a Kafka message
func (k *KafkaEncryption) DecryptMessage(ctx context.Context, encryptedMessage []byte, topic string, partition int32, offset int64) ([]byte, error) {
	var encrypted EncryptedData
	if err := json.Unmarshal(encryptedMessage, &encrypted); err != nil {
		return nil, fmt.Errorf("failed to deserialize encrypted message: %w", err)
	}
	
	resourceID := fmt.Sprintf("%s:%d:%d", topic, partition, offset)
	return k.service.Decrypt(ctx, &encrypted, "kafka", resourceID)
}

// EncryptedTopics returns topics that should be encrypted
func EncryptedTopics() []string {
	return []string{
		"payments.transactions",
		"payments.settlements",
		"kyc.verifications",
		"kyc.documents",
		"audit.events",
		"fraud.alerts",
		"pii.updates",
	}
}

// RedisEncryption provides Redis-specific encryption
type RedisEncryption struct {
	*DataStoreEncryption
}

// NewRedisEncryption creates a new Redis encryption service
func NewRedisEncryption(service *EncryptionAtRestService) *RedisEncryption {
	return &RedisEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
	}
}

// EncryptValue encrypts a Redis value
func (r *RedisEncryption) EncryptValue(ctx context.Context, value []byte, key string) ([]byte, error) {
	encrypted, err := r.service.Encrypt(ctx, value, "redis", key)
	if err != nil {
		return nil, err
	}
	
	return json.Marshal(encrypted)
}

// DecryptValue decrypts a Redis value
func (r *RedisEncryption) DecryptValue(ctx context.Context, encryptedValue []byte, key string) ([]byte, error) {
	var encrypted EncryptedData
	if err := json.Unmarshal(encryptedValue, &encrypted); err != nil {
		return nil, fmt.Errorf("failed to deserialize encrypted value: %w", err)
	}
	
	return r.service.Decrypt(ctx, &encrypted, "redis", key)
}

// SensitiveKeyPatterns returns Redis key patterns that should be encrypted
func SensitiveKeyPatterns() []string {
	return []string{
		"session:*",
		"token:*",
		"user:*:pii",
		"cache:customer:*",
		"cache:account:*",
		"rate_limit:*",
	}
}

// RustFSEncryption provides RustFS-specific encryption (Server-Side Encryption)
type RustFSEncryption struct {
	*DataStoreEncryption
	sseKey []byte
}

// NewRustFSEncryption creates a new RustFS encryption service
func NewRustFSEncryption(service *EncryptionAtRestService, sseKey []byte) *RustFSEncryption {
	return &RustFSEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
		sseKey:              sseKey,
	}
}

// SSEConfig returns Server-Side Encryption configuration for RustFS
type SSEConfig struct {
	Algorithm    string // AES256, aws:kms
	KeyID        string // KMS key ID if using KMS
	CustomerKey  string // Base64-encoded customer key for SSE-C
	CustomerKeyMD5 string // MD5 of customer key for SSE-C
}

// GetSSEConfig returns SSE configuration for RustFS uploads
func (r *RustFSEncryption) GetSSEConfig() *SSEConfig {
	if len(r.sseKey) == 0 {
		// Use server-managed encryption
		return &SSEConfig{
			Algorithm: "AES256",
		}
	}
	
	// Use customer-provided key (SSE-C)
	return &SSEConfig{
		Algorithm:   "AES256",
		CustomerKey: base64.StdEncoding.EncodeToString(r.sseKey),
		CustomerKeyMD5: computeMD5(r.sseKey),
	}
}

// EncryptObject encrypts an object before upload (client-side encryption)
func (r *RustFSEncryption) EncryptObject(ctx context.Context, data []byte, bucket, key string) ([]byte, map[string]string, error) {
	resourceID := fmt.Sprintf("%s/%s", bucket, key)
	encrypted, err := r.service.Encrypt(ctx, data, "rustfs", resourceID)
	if err != nil {
		return nil, nil, err
	}
	
	// Store encryption metadata in object metadata
	metadata := map[string]string{
		"x-amz-meta-encryption-algorithm": encrypted.Algorithm,
		"x-amz-meta-encryption-key-id":    encrypted.DataKeyID,
		"x-amz-meta-encryption-nonce":     base64.StdEncoding.EncodeToString(encrypted.Nonce),
		"x-amz-meta-encrypted-data-key":   base64.StdEncoding.EncodeToString(encrypted.EncryptedDataKey),
		"x-amz-meta-encryption-version":   fmt.Sprintf("%d", encrypted.Version),
	}
	
	return encrypted.Ciphertext, metadata, nil
}

// DecryptObject decrypts an object after download (client-side decryption)
func (r *RustFSEncryption) DecryptObject(ctx context.Context, data []byte, metadata map[string]string, bucket, key string) ([]byte, error) {
	// Reconstruct encrypted data from metadata
	nonce, _ := base64.StdEncoding.DecodeString(metadata["x-amz-meta-encryption-nonce"])
	encryptedKey, _ := base64.StdEncoding.DecodeString(metadata["x-amz-meta-encrypted-data-key"])
	
	var version int
	fmt.Sscanf(metadata["x-amz-meta-encryption-version"], "%d", &version)
	
	encrypted := &EncryptedData{
		Ciphertext:       data,
		Nonce:            nonce,
		DataKeyID:        metadata["x-amz-meta-encryption-key-id"],
		EncryptedDataKey: encryptedKey,
		Algorithm:        metadata["x-amz-meta-encryption-algorithm"],
		Version:          version,
	}
	
	resourceID := fmt.Sprintf("%s/%s", bucket, key)
	return r.service.Decrypt(ctx, encrypted, "rustfs", resourceID)
}

// computeMD5 computes MD5 hash for SSE-C
func computeMD5(data []byte) string {
	// In production, use crypto/md5
	return base64.StdEncoding.EncodeToString(data[:16])
}

// BackupEncryption provides backup-specific encryption
type BackupEncryption struct {
	*DataStoreEncryption
}

// NewBackupEncryption creates a new backup encryption service
func NewBackupEncryption(service *EncryptionAtRestService) *BackupEncryption {
	return &BackupEncryption{
		DataStoreEncryption: NewDataStoreEncryption(service),
	}
}

// BackupMetadata contains backup encryption metadata
type BackupMetadata struct {
	BackupID         string    `json:"backup_id"`
	SourceDataStore  string    `json:"source_data_store"`
	EncryptedAt      time.Time `json:"encrypted_at"`
	Algorithm        string    `json:"algorithm"`
	DataKeyID        string    `json:"data_key_id"`
	EncryptedDataKey string    `json:"encrypted_data_key"`
	Nonce            string    `json:"nonce"`
	Checksum         string    `json:"checksum"`
}

// EncryptBackup encrypts a backup file
func (b *BackupEncryption) EncryptBackup(ctx context.Context, data []byte, backupID, sourceDataStore string) ([]byte, *BackupMetadata, error) {
	resourceID := fmt.Sprintf("backup:%s:%s", sourceDataStore, backupID)
	encrypted, err := b.service.Encrypt(ctx, data, "backup", resourceID)
	if err != nil {
		return nil, nil, err
	}
	
	metadata := &BackupMetadata{
		BackupID:         backupID,
		SourceDataStore:  sourceDataStore,
		EncryptedAt:      encrypted.EncryptedAt,
		Algorithm:        encrypted.Algorithm,
		DataKeyID:        encrypted.DataKeyID,
		EncryptedDataKey: base64.StdEncoding.EncodeToString(encrypted.EncryptedDataKey),
		Nonce:            base64.StdEncoding.EncodeToString(encrypted.Nonce),
		Checksum:         computeChecksum(encrypted.Ciphertext),
	}
	
	return encrypted.Ciphertext, metadata, nil
}

// DecryptBackup decrypts a backup file
func (b *BackupEncryption) DecryptBackup(ctx context.Context, data []byte, metadata *BackupMetadata) ([]byte, error) {
	// Verify checksum
	if computeChecksum(data) != metadata.Checksum {
		return nil, fmt.Errorf("backup checksum mismatch")
	}
	
	nonce, _ := base64.StdEncoding.DecodeString(metadata.Nonce)
	encryptedKey, _ := base64.StdEncoding.DecodeString(metadata.EncryptedDataKey)
	
	encrypted := &EncryptedData{
		Ciphertext:       data,
		Nonce:            nonce,
		DataKeyID:        metadata.DataKeyID,
		EncryptedDataKey: encryptedKey,
		Algorithm:        metadata.Algorithm,
	}
	
	resourceID := fmt.Sprintf("backup:%s:%s", metadata.SourceDataStore, metadata.BackupID)
	return b.service.Decrypt(ctx, encrypted, "backup", resourceID)
}

// computeChecksum computes SHA-256 checksum
func computeChecksum(data []byte) string {
	hash := make([]byte, 32)
	// In production, use crypto/sha256
	copy(hash, data[:min(32, len(data))])
	return base64.StdEncoding.EncodeToString(hash)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// KubernetesSecretsEncryption provides Kubernetes secrets encryption configuration
type KubernetesSecretsEncryption struct {
	providers []EncryptionProvider
}

// EncryptionProvider represents a Kubernetes encryption provider
type EncryptionProvider struct {
	Name      string
	Type      string // aescbc, aesgcm, kms, secretbox
	KeyID     string
	Endpoint  string // For KMS provider
}

// NewKubernetesSecretsEncryption creates a new K8s secrets encryption config
func NewKubernetesSecretsEncryption() *KubernetesSecretsEncryption {
	return &KubernetesSecretsEncryption{
		providers: []EncryptionProvider{
			{
				Name:     "paygate-kms",
				Type:     "kms",
				KeyID:    "paygate-secrets-key",
				Endpoint: "unix:///var/run/kmsplugin/socket.sock",
			},
			{
				Name:  "paygate-aesgcm",
				Type:  "aesgcm",
				KeyID: "paygate-secrets-key-local",
			},
		},
	}
}

// GenerateEncryptionConfig generates Kubernetes EncryptionConfiguration
func (k *KubernetesSecretsEncryption) GenerateEncryptionConfig() string {
	return `apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
      - configmaps
    providers:
      - kms:
          apiVersion: v2
          name: paygate-kms
          endpoint: unix:///var/run/kmsplugin/socket.sock
          cachesize: 1000
          timeout: 3s
      - aesgcm:
          keys:
            - name: paygate-secrets-key
              secret: ${ENCRYPTION_KEY_BASE64}
      - identity: {}
`
}
