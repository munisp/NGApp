// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"sync"
	"time"
)

// PIIGovernance provides PII protection for lakehouse data
type PIIGovernance struct {
	encryptionKey []byte
	maskingSalt   string
	config        *PIIConfig
}

// PIIConfig holds configuration for PII governance
type PIIConfig struct {
	EncryptionKey     string        // Base64-encoded 32-byte key
	MaskingSalt       string        // Salt for consistent masking
	RetentionPeriod   time.Duration // How long to retain PII
	EnableEncryption  bool
	EnableMasking     bool
	EnableAuditLog    bool
}

// DefaultPIIConfig returns default configuration
func DefaultPIIConfig() *PIIConfig {
	return &PIIConfig{
		EncryptionKey:    getEnvOrDefault("PII_ENCRYPTION_KEY", ""),
		MaskingSalt:      getEnvOrDefault("PII_MASKING_SALT", "default-salt-change-in-production"),
		RetentionPeriod:  365 * 24 * time.Hour, // 1 year default
		EnableEncryption: true,
		EnableMasking:    true,
		EnableAuditLog:   true,
	}
}

// NewPIIGovernance creates a new PII governance instance
func NewPIIGovernance(config *PIIConfig) (*PIIGovernance, error) {
	var encryptionKey []byte
	if config.EncryptionKey != "" {
		var err error
		encryptionKey, err = base64.StdEncoding.DecodeString(config.EncryptionKey)
		if err != nil {
			return nil, fmt.Errorf("invalid encryption key: %w", err)
		}
		if len(encryptionKey) != 32 {
			return nil, fmt.Errorf("encryption key must be 32 bytes")
		}
	} else {
		// Generate a random key if not provided (for development only)
		encryptionKey = make([]byte, 32)
		rand.Read(encryptionKey)
	}

	return &PIIGovernance{
		encryptionKey: encryptionKey,
		maskingSalt:   config.MaskingSalt,
		config:        config,
	}, nil
}

// PIIField represents a field that may contain PII
type PIIField struct {
	Name       string
	Type       PIIType
	Sensitivity PIISensitivity
}

// PIIType represents the type of PII
type PIIType string

const (
	PIITypeName         PIIType = "name"
	PIITypeEmail        PIIType = "email"
	PIITypePhone        PIIType = "phone"
	PIITypeAddress      PIIType = "address"
	PIITypeIDNumber     PIIType = "id_number"
	PIITypeBankAccount  PIIType = "bank_account"
	PIITypeDateOfBirth  PIIType = "date_of_birth"
	PIITypeFinancial    PIIType = "financial"
	PIITypeBiometric    PIIType = "biometric"
)

// PIISensitivity represents the sensitivity level
type PIISensitivity string

const (
	PIISensitivityLow      PIISensitivity = "low"
	PIISensitivityMedium   PIISensitivity = "medium"
	PIISensitivityHigh     PIISensitivity = "high"
	PIISensitivityCritical PIISensitivity = "critical"
)

// KnownPIIFields defines known PII fields and their types
var KnownPIIFields = map[string]PIIField{
	"name":              {Name: "name", Type: PIITypeName, Sensitivity: PIISensitivityMedium},
	"first_name":        {Name: "first_name", Type: PIITypeName, Sensitivity: PIISensitivityMedium},
	"last_name":         {Name: "last_name", Type: PIITypeName, Sensitivity: PIISensitivityMedium},
	"full_name":         {Name: "full_name", Type: PIITypeName, Sensitivity: PIISensitivityMedium},
	"email":             {Name: "email", Type: PIITypeEmail, Sensitivity: PIISensitivityMedium},
	"email_address":     {Name: "email_address", Type: PIITypeEmail, Sensitivity: PIISensitivityMedium},
	"phone":             {Name: "phone", Type: PIITypePhone, Sensitivity: PIISensitivityMedium},
	"phone_number":      {Name: "phone_number", Type: PIITypePhone, Sensitivity: PIISensitivityMedium},
	"mobile":            {Name: "mobile", Type: PIITypePhone, Sensitivity: PIISensitivityMedium},
	"address":           {Name: "address", Type: PIITypeAddress, Sensitivity: PIISensitivityMedium},
	"street_address":    {Name: "street_address", Type: PIITypeAddress, Sensitivity: PIISensitivityMedium},
	"ssn":               {Name: "ssn", Type: PIITypeIDNumber, Sensitivity: PIISensitivityCritical},
	"social_security":   {Name: "social_security", Type: PIITypeIDNumber, Sensitivity: PIISensitivityCritical},
	"national_id":       {Name: "national_id", Type: PIITypeIDNumber, Sensitivity: PIISensitivityCritical},
	"bvn":               {Name: "bvn", Type: PIITypeIDNumber, Sensitivity: PIISensitivityCritical},
	"nin":               {Name: "nin", Type: PIITypeIDNumber, Sensitivity: PIISensitivityCritical},
	"passport_number":   {Name: "passport_number", Type: PIITypeIDNumber, Sensitivity: PIISensitivityHigh},
	"drivers_license":   {Name: "drivers_license", Type: PIITypeIDNumber, Sensitivity: PIISensitivityHigh},
	"bank_account":      {Name: "bank_account", Type: PIITypeBankAccount, Sensitivity: PIISensitivityHigh},
	"account_number":    {Name: "account_number", Type: PIITypeBankAccount, Sensitivity: PIISensitivityHigh},
	"iban":              {Name: "iban", Type: PIITypeBankAccount, Sensitivity: PIISensitivityHigh},
	"date_of_birth":     {Name: "date_of_birth", Type: PIITypeDateOfBirth, Sensitivity: PIISensitivityMedium},
	"dob":               {Name: "dob", Type: PIITypeDateOfBirth, Sensitivity: PIISensitivityMedium},
	"birth_date":        {Name: "birth_date", Type: PIITypeDateOfBirth, Sensitivity: PIISensitivityMedium},
	"salary":            {Name: "salary", Type: PIITypeFinancial, Sensitivity: PIISensitivityHigh},
	"income":            {Name: "income", Type: PIITypeFinancial, Sensitivity: PIISensitivityHigh},
	"fingerprint":       {Name: "fingerprint", Type: PIITypeBiometric, Sensitivity: PIISensitivityCritical},
	"face_data":         {Name: "face_data", Type: PIITypeBiometric, Sensitivity: PIISensitivityCritical},
	"biometric":         {Name: "biometric", Type: PIITypeBiometric, Sensitivity: PIISensitivityCritical},
}

// Encrypt encrypts a value using AES-GCM
func (p *PIIGovernance) Encrypt(plaintext string) (string, error) {
	if !p.config.EnableEncryption {
		return plaintext, nil
	}

	block, err := aes.NewCipher(p.encryptionKey)
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

// Decrypt decrypts a value using AES-GCM
func (p *PIIGovernance) Decrypt(ciphertext string) (string, error) {
	if !p.config.EnableEncryption {
		return ciphertext, nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(p.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// Mask masks a value based on its type
func (p *PIIGovernance) Mask(value string, piiType PIIType) string {
	if !p.config.EnableMasking || value == "" {
		return value
	}

	switch piiType {
	case PIITypeEmail:
		return p.maskEmail(value)
	case PIITypePhone:
		return p.maskPhone(value)
	case PIITypeName:
		return p.maskName(value)
	case PIITypeIDNumber:
		return p.maskIDNumber(value)
	case PIITypeBankAccount:
		return p.maskBankAccount(value)
	case PIITypeDateOfBirth:
		return p.maskDateOfBirth(value)
	case PIITypeBiometric:
		return "[BIOMETRIC_REDACTED]"
	default:
		return p.maskGeneric(value)
	}
}

func (p *PIIGovernance) maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return p.maskGeneric(email)
	}

	local := parts[0]
	domain := parts[1]

	if len(local) <= 2 {
		return "**@" + domain
	}

	return local[:1] + strings.Repeat("*", len(local)-2) + local[len(local)-1:] + "@" + domain
}

func (p *PIIGovernance) maskPhone(phone string) string {
	digits := regexp.MustCompile(`\d`).FindAllString(phone, -1)
	if len(digits) < 4 {
		return strings.Repeat("*", len(phone))
	}

	// Keep last 4 digits
	masked := strings.Repeat("*", len(digits)-4) + strings.Join(digits[len(digits)-4:], "")
	return masked
}

func (p *PIIGovernance) maskName(name string) string {
	parts := strings.Fields(name)
	var masked []string
	for _, part := range parts {
		if len(part) <= 1 {
			masked = append(masked, "*")
		} else {
			masked = append(masked, part[:1]+strings.Repeat("*", len(part)-1))
		}
	}
	return strings.Join(masked, " ")
}

func (p *PIIGovernance) maskIDNumber(id string) string {
	if len(id) <= 4 {
		return strings.Repeat("*", len(id))
	}
	return strings.Repeat("*", len(id)-4) + id[len(id)-4:]
}

func (p *PIIGovernance) maskBankAccount(account string) string {
	if len(account) <= 4 {
		return strings.Repeat("*", len(account))
	}
	return strings.Repeat("*", len(account)-4) + account[len(account)-4:]
}

func (p *PIIGovernance) maskDateOfBirth(dob string) string {
	// Keep only year
	if len(dob) >= 4 {
		return dob[:4] + "-**-**"
	}
	return "****-**-**"
}

func (p *PIIGovernance) maskGeneric(value string) string {
	if len(value) <= 2 {
		return strings.Repeat("*", len(value))
	}
	return value[:1] + strings.Repeat("*", len(value)-2) + value[len(value)-1:]
}

// Tokenize creates a consistent token for a value (for analytics without exposing PII)
func (p *PIIGovernance) Tokenize(value string) string {
	h := sha256.New()
	h.Write([]byte(p.maskingSalt))
	h.Write([]byte(value))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ProcessForLakehouse processes a record for lakehouse storage
// It masks/encrypts PII fields based on configuration
func (p *PIIGovernance) ProcessForLakehouse(record map[string]interface{}) map[string]interface{} {
	processed := make(map[string]interface{})

	for key, value := range record {
		lowerKey := strings.ToLower(key)

		// Check if this is a known PII field
		if piiField, ok := KnownPIIFields[lowerKey]; ok {
			strValue, isString := value.(string)
			if isString && strValue != "" {
				switch piiField.Sensitivity {
				case PIISensitivityCritical:
					// Critical: tokenize only (no reversible data)
					processed[key+"_token"] = p.Tokenize(strValue)
					processed[key] = "[REDACTED]"
				case PIISensitivityHigh:
					// High: encrypt and mask
					encrypted, _ := p.Encrypt(strValue)
					processed[key+"_encrypted"] = encrypted
					processed[key] = p.Mask(strValue, piiField.Type)
				case PIISensitivityMedium:
					// Medium: mask only
					processed[key] = p.Mask(strValue, piiField.Type)
				default:
					processed[key] = value
				}
			} else {
				processed[key] = value
			}
		} else {
			// Not a known PII field, pass through
			processed[key] = value
		}
	}

	// Add metadata
	processed["_pii_processed"] = true
	processed["_pii_processed_at"] = time.Now().UTC().Format(time.RFC3339)

	return processed
}

// PIIAccessControl manages access to PII data
type PIIAccessControl struct {
	roles map[string][]string // role -> allowed PII types
	mu    sync.RWMutex
}

// NewPIIAccessControl creates a new access control instance
func NewPIIAccessControl() *PIIAccessControl {
	return &PIIAccessControl{
		roles: map[string][]string{
			"admin":           {"name", "email", "phone", "address", "id_number", "bank_account", "date_of_birth", "financial"},
			"compliance":      {"name", "email", "phone", "address", "id_number", "bank_account", "date_of_birth"},
			"support":         {"name", "email", "phone"},
			"analyst":         {}, // No direct PII access, only tokenized/aggregated data
			"developer":       {}, // No PII access in non-production
		},
	}
}

// CanAccess checks if a role can access a specific PII type
func (ac *PIIAccessControl) CanAccess(role string, piiType PIIType) bool {
	ac.mu.RLock()
	defer ac.mu.RUnlock()

	allowedTypes, ok := ac.roles[role]
	if !ok {
		return false
	}

	for _, allowed := range allowedTypes {
		if allowed == string(piiType) {
			return true
		}
	}

	return false
}

// FilterRecord filters a record based on role permissions
func (ac *PIIAccessControl) FilterRecord(record map[string]interface{}, role string) map[string]interface{} {
	filtered := make(map[string]interface{})

	for key, value := range record {
		lowerKey := strings.ToLower(key)

		// Check if this is a known PII field
		if piiField, ok := KnownPIIFields[lowerKey]; ok {
			if ac.CanAccess(role, piiField.Type) {
				filtered[key] = value
			} else {
				filtered[key] = "[ACCESS_DENIED]"
			}
		} else {
			filtered[key] = value
		}
	}

	return filtered
}

// PIIRetentionPolicy manages data retention
type PIIRetentionPolicy struct {
	policies map[PIIType]time.Duration
}

// NewPIIRetentionPolicy creates a new retention policy
func NewPIIRetentionPolicy() *PIIRetentionPolicy {
	return &PIIRetentionPolicy{
		policies: map[PIIType]time.Duration{
			PIITypeName:        7 * 365 * 24 * time.Hour, // 7 years
			PIITypeEmail:       7 * 365 * 24 * time.Hour,
			PIITypePhone:       7 * 365 * 24 * time.Hour,
			PIITypeAddress:     7 * 365 * 24 * time.Hour,
			PIITypeIDNumber:    7 * 365 * 24 * time.Hour,
			PIITypeBankAccount: 7 * 365 * 24 * time.Hour,
			PIITypeDateOfBirth: 7 * 365 * 24 * time.Hour,
			PIITypeFinancial:   7 * 365 * 24 * time.Hour,
			PIITypeBiometric:   1 * 365 * 24 * time.Hour, // 1 year for biometric
		},
	}
}

// GetRetentionPeriod returns the retention period for a PII type
func (p *PIIRetentionPolicy) GetRetentionPeriod(piiType PIIType) time.Duration {
	if period, ok := p.policies[piiType]; ok {
		return period
	}
	return 7 * 365 * 24 * time.Hour // Default 7 years
}

// IsExpired checks if data has exceeded its retention period
func (p *PIIRetentionPolicy) IsExpired(piiType PIIType, createdAt time.Time) bool {
	return time.Since(createdAt) > p.GetRetentionPeriod(piiType)
}

// PIIDataSubjectRequest handles GDPR/CCPA data subject requests
type PIIDataSubjectRequest struct {
	store *TransferStore
}

// NewPIIDataSubjectRequest creates a new data subject request handler
func NewPIIDataSubjectRequest(store *TransferStore) *PIIDataSubjectRequest {
	return &PIIDataSubjectRequest{store: store}
}

// DataSubjectRequestType represents the type of request
type DataSubjectRequestType string

const (
	DSRTypeAccess    DataSubjectRequestType = "access"    // Right to access
	DSRTypeRectify   DataSubjectRequestType = "rectify"   // Right to rectification
	DSRTypeErase     DataSubjectRequestType = "erase"     // Right to erasure
	DSRTypePortable  DataSubjectRequestType = "portable"  // Right to portability
	DSRTypeRestrict  DataSubjectRequestType = "restrict"  // Right to restrict processing
)

// DataSubjectRequest represents a data subject request
type DataSubjectRequest struct {
	ID          string                 `json:"id"`
	Type        DataSubjectRequestType `json:"type"`
	SubjectID   string                 `json:"subject_id"`
	SubjectType string                 `json:"subject_type"` // e.g., "customer", "participant"
	RequestedAt time.Time              `json:"requested_at"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	Status      string                 `json:"status"`
	Result      interface{}            `json:"result,omitempty"`
}

// ProcessAccessRequest handles a data access request
func (d *PIIDataSubjectRequest) ProcessAccessRequest(ctx context.Context, subjectID, subjectType string) (*DataSubjectRequest, error) {
	request := &DataSubjectRequest{
		ID:          fmt.Sprintf("dsr-%d", time.Now().UnixNano()),
		Type:        DSRTypeAccess,
		SubjectID:   subjectID,
		SubjectType: subjectType,
		RequestedAt: time.Now().UTC(),
		Status:      "processing",
	}

	// Collect all data for the subject
	data := make(map[string]interface{})

	// Get transfers where subject is payer or payee
	query := `
		SELECT transfer_id, payer_fsp, payee_fsp, amount, currency, state, created_at
		FROM mojaloop_transfers
		WHERE payer_fsp = $1 OR payee_fsp = $1
		ORDER BY created_at DESC
		LIMIT 1000
	`

	rows, err := d.store.db.QueryContext(ctx, query, subjectID)
	if err != nil {
		request.Status = "failed"
		return request, err
	}
	defer rows.Close()

	var transfers []map[string]interface{}
	for rows.Next() {
		var t struct {
			TransferID string
			PayerFSP   string
			PayeeFSP   string
			Amount     int64
			Currency   string
			State      string
			CreatedAt  time.Time
		}
		rows.Scan(&t.TransferID, &t.PayerFSP, &t.PayeeFSP, &t.Amount, &t.Currency, &t.State, &t.CreatedAt)
		transfers = append(transfers, map[string]interface{}{
			"transfer_id": t.TransferID,
			"payer_fsp":   t.PayerFSP,
			"payee_fsp":   t.PayeeFSP,
			"amount":      t.Amount,
			"currency":    t.Currency,
			"state":       t.State,
			"created_at":  t.CreatedAt,
		})
	}

	data["transfers"] = transfers

	// Get participant info
	query = `SELECT fsp_id, name, currency, created_at FROM mojaloop_participants WHERE fsp_id = $1`
	var participant struct {
		FSPID     string
		Name      string
		Currency  string
		CreatedAt time.Time
	}
	err = d.store.db.QueryRowContext(ctx, query, subjectID).Scan(&participant.FSPID, &participant.Name, &participant.Currency, &participant.CreatedAt)
	if err == nil {
		data["participant"] = map[string]interface{}{
			"fsp_id":     participant.FSPID,
			"name":       participant.Name,
			"currency":   participant.Currency,
			"created_at": participant.CreatedAt,
		}
	}

	now := time.Now().UTC()
	request.CompletedAt = &now
	request.Status = "completed"
	request.Result = data

	return request, nil
}

// ProcessEraseRequest handles a data erasure request
func (d *PIIDataSubjectRequest) ProcessEraseRequest(ctx context.Context, subjectID, subjectType string) (*DataSubjectRequest, error) {
	request := &DataSubjectRequest{
		ID:          fmt.Sprintf("dsr-%d", time.Now().UnixNano()),
		Type:        DSRTypeErase,
		SubjectID:   subjectID,
		SubjectType: subjectType,
		RequestedAt: time.Now().UTC(),
		Status:      "processing",
	}

	// Note: We cannot delete financial transaction records due to regulatory requirements
	// Instead, we anonymize PII fields

	// Anonymize participant data
	query := `
		UPDATE mojaloop_participants
		SET name = '[ERASED]', updated_at = NOW()
		WHERE fsp_id = $1
	`
	_, err := d.store.db.ExecContext(ctx, query, subjectID)
	if err != nil {
		request.Status = "failed"
		return request, err
	}

	now := time.Now().UTC()
	request.CompletedAt = &now
	request.Status = "completed"
	request.Result = map[string]string{
		"message": "PII data has been anonymized. Transaction records retained for regulatory compliance.",
	}

	return request, nil
}

// Singleton PII governance
var (
	defaultPIIGovernance *PIIGovernance
	piiGovernanceOnce    sync.Once
)

// GetPIIGovernance returns the singleton PII governance instance
func GetPIIGovernance() *PIIGovernance {
	piiGovernanceOnce.Do(func() {
		config := DefaultPIIConfig()
		var err error
		defaultPIIGovernance, err = NewPIIGovernance(config)
		if err != nil {
			panic(fmt.Sprintf("Failed to initialize PII governance: %v", err))
		}
	})
	return defaultPIIGovernance
}

// LakehouseDataProcessor processes data for lakehouse ingestion
type LakehouseDataProcessor struct {
	pii          *PIIGovernance
	accessControl *PIIAccessControl
	retention    *PIIRetentionPolicy
}

// NewLakehouseDataProcessor creates a new lakehouse data processor
func NewLakehouseDataProcessor() *LakehouseDataProcessor {
	return &LakehouseDataProcessor{
		pii:           GetPIIGovernance(),
		accessControl: NewPIIAccessControl(),
		retention:     NewPIIRetentionPolicy(),
	}
}

// ProcessBatch processes a batch of records for lakehouse ingestion
func (p *LakehouseDataProcessor) ProcessBatch(records []map[string]interface{}) []map[string]interface{} {
	processed := make([]map[string]interface{}, len(records))
	for i, record := range records {
		processed[i] = p.pii.ProcessForLakehouse(record)
	}
	return processed
}

// ToJSON converts processed records to JSON for Kafka/Flink
func (p *LakehouseDataProcessor) ToJSON(records []map[string]interface{}) ([]byte, error) {
	return json.Marshal(records)
}
