// Package mojaloop implements Mojaloop protocol components including ILP
package mojaloop

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	// ILPFulfillmentLength is the length of an ILP fulfillment in bytes
	ILPFulfillmentLength = 32
	// ILPConditionLength is the length of an ILP condition in bytes
	ILPConditionLength = 32
	// ILPPacketTypePrepare is the type byte for ILP Prepare packets
	ILPPacketTypePrepare = 12
)

// ILPPacket represents an ILP Prepare packet
type ILPPacket struct {
	PacketType         uint8
	Amount             uint64
	Expiry             time.Time
	ExecutionCondition []byte
	Destination        string
	Data               []byte
}

// ToBytes serializes the ILP packet to bytes
func (p *ILPPacket) ToBytes() []byte {
	destinationBytes := []byte(p.Destination)
	packet := make([]byte, 0, 256)

	// Packet type
	packet = append(packet, p.PacketType)

	// Amount (8 bytes, big-endian)
	amountBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(amountBytes, p.Amount)
	packet = append(packet, amountBytes...)

	// Expiry timestamp
	expiryStr := p.Expiry.UTC().Format("2006-01-02T15:04:05.000") + "Z"
	expiryBytes := []byte(expiryStr)
	packet = append(packet, byte(len(expiryBytes)))
	packet = append(packet, expiryBytes...)

	// Execution condition (32 bytes)
	packet = append(packet, p.ExecutionCondition...)

	// Destination
	packet = append(packet, byte(len(destinationBytes)))
	packet = append(packet, destinationBytes...)

	// Data with length prefix
	if len(p.Data) < 128 {
		packet = append(packet, byte(len(p.Data)))
	} else {
		lengthBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(lengthBytes, uint16(len(p.Data)))
		packet = append(packet, 0x82)
		packet = append(packet, lengthBytes...)
	}
	packet = append(packet, p.Data...)

	return packet
}

// ToBase64 serializes and encodes the packet as URL-safe base64
func (p *ILPPacket) ToBase64() string {
	return base64.RawURLEncoding.EncodeToString(p.ToBytes())
}

// KeyProvider defines the interface for key management systems
type KeyProvider interface {
	GetKey(keyID string) ([]byte, error)
	RotateKey(keyID string) error
}

// EnvKeyProvider provides keys from environment variables (for development)
type EnvKeyProvider struct{}

func (p *EnvKeyProvider) GetKey(keyID string) ([]byte, error) {
	envVar := fmt.Sprintf("ILP_SECRET_KEY_%s", strings.ToUpper(keyID))
	if key := os.Getenv(envVar); key != "" {
		return hex.DecodeString(key)
	}
	// Fallback to default key
	if key := os.Getenv("ILP_SECRET_KEY"); key != "" {
		return hex.DecodeString(key)
	}
	return nil, errors.New("no key found in environment")
}

func (p *EnvKeyProvider) RotateKey(keyID string) error {
	return errors.New("key rotation not supported for environment provider")
}

// VaultKeyProvider provides keys from HashiCorp Vault (for production)
type VaultKeyProvider struct {
	vaultAddr  string
	vaultToken string
	mountPath  string
}

func NewVaultKeyProvider() *VaultKeyProvider {
	return &VaultKeyProvider{
		vaultAddr:  os.Getenv("VAULT_ADDR"),
		vaultToken: os.Getenv("VAULT_TOKEN"),
		mountPath:  os.Getenv("VAULT_ILP_MOUNT_PATH"),
	}
}

func (p *VaultKeyProvider) GetKey(keyID string) ([]byte, error) {
	if p.vaultAddr == "" {
		return nil, errors.New("VAULT_ADDR not configured")
	}
	// In production, this would make an HTTP call to Vault
	// For now, we return an error to force proper configuration
	return nil, fmt.Errorf("vault key retrieval not implemented - configure VAULT_ADDR, VAULT_TOKEN, and VAULT_ILP_MOUNT_PATH")
}

func (p *VaultKeyProvider) RotateKey(keyID string) error {
	return errors.New("vault key rotation requires manual intervention")
}

// AWSKMSKeyProvider provides keys from AWS KMS (for production)
type AWSKMSKeyProvider struct {
	region string
	keyARN string
}

func NewAWSKMSKeyProvider() *AWSKMSKeyProvider {
	return &AWSKMSKeyProvider{
		region: os.Getenv("AWS_REGION"),
		keyARN: os.Getenv("AWS_KMS_ILP_KEY_ARN"),
	}
}

func (p *AWSKMSKeyProvider) GetKey(keyID string) ([]byte, error) {
	if p.keyARN == "" {
		return nil, errors.New("AWS_KMS_ILP_KEY_ARN not configured")
	}
	// In production, this would use AWS SDK to retrieve/generate data key
	return nil, fmt.Errorf("AWS KMS key retrieval not implemented - configure AWS_REGION and AWS_KMS_ILP_KEY_ARN")
}

func (p *AWSKMSKeyProvider) RotateKey(keyID string) error {
	return errors.New("AWS KMS key rotation is automatic")
}

// ILPCryptoService handles cryptographic operations for ILP
// FIXED: Now requires explicit key configuration - no more zero key fallback
type ILPCryptoService struct {
	secretKey   []byte
	keyProvider KeyProvider
	keyID       string
	mu          sync.RWMutex
	initialized bool
}

// ILPCryptoConfig holds configuration for the crypto service
type ILPCryptoConfig struct {
	// KeySource: "env", "vault", "aws-kms", or "direct"
	KeySource string
	// DirectKey: hex-encoded key (only for KeySource="direct")
	DirectKey string
	// KeyID: identifier for the key in the key provider
	KeyID string
	// AllowDevelopmentMode: if true, allows insecure random key generation
	AllowDevelopmentMode bool
}

// NewILPCryptoService creates a new ILP crypto service with proper key management
// FIXED: No longer falls back to zero key - requires explicit configuration
func NewILPCryptoService(secretKey string) *ILPCryptoService {
	service := &ILPCryptoService{
		keyID: "default",
	}

	// Determine key source from environment
	keySource := os.Getenv("ILP_KEY_SOURCE")
	if keySource == "" {
		keySource = "env" // Default to environment variables
	}

	var key []byte
	var err error

	switch keySource {
	case "direct":
		if secretKey != "" {
			key = []byte(secretKey)
		} else {
			panic("ILP_KEY_SOURCE=direct requires a secret key to be provided")
		}

	case "env":
		provider := &EnvKeyProvider{}
		key, err = provider.GetKey("default")
		if err != nil {
			// Check if development mode is allowed
			if os.Getenv("ILP_ALLOW_DEV_MODE") == "true" {
				fmt.Println("WARNING: ILP running in development mode with random key - NOT FOR PRODUCTION")
				key = make([]byte, 32)
				if _, err := rand.Read(key); err != nil {
					panic(fmt.Sprintf("failed to generate random key: %v", err))
				}
			} else {
				panic(fmt.Sprintf("ILP key not configured: %v. Set ILP_SECRET_KEY (hex-encoded) or ILP_ALLOW_DEV_MODE=true for development", err))
			}
		}
		service.keyProvider = provider

	case "vault":
		provider := NewVaultKeyProvider()
		key, err = provider.GetKey("default")
		if err != nil {
			panic(fmt.Sprintf("failed to get ILP key from Vault: %v", err))
		}
		service.keyProvider = provider

	case "aws-kms":
		provider := NewAWSKMSKeyProvider()
		key, err = provider.GetKey("default")
		if err != nil {
			panic(fmt.Sprintf("failed to get ILP key from AWS KMS: %v", err))
		}
		service.keyProvider = provider

	default:
		panic(fmt.Sprintf("unknown ILP_KEY_SOURCE: %s (valid: direct, env, vault, aws-kms)", keySource))
	}

	// Validate key length
	if len(key) < 32 {
		panic(fmt.Sprintf("ILP secret key must be at least 32 bytes, got %d", len(key)))
	}

	service.secretKey = key
	service.initialized = true
	return service
}

// NewILPCryptoServiceWithConfig creates a crypto service with explicit configuration
func NewILPCryptoServiceWithConfig(config *ILPCryptoConfig) (*ILPCryptoService, error) {
	service := &ILPCryptoService{
		keyID: config.KeyID,
	}

	if config.KeyID == "" {
		service.keyID = "default"
	}

	var key []byte
	var err error

	switch config.KeySource {
	case "direct":
		key, err = hex.DecodeString(config.DirectKey)
		if err != nil {
			return nil, fmt.Errorf("invalid hex-encoded direct key: %w", err)
		}

	case "env":
		provider := &EnvKeyProvider{}
		key, err = provider.GetKey(service.keyID)
		if err != nil && config.AllowDevelopmentMode {
			key = make([]byte, 32)
			if _, err := rand.Read(key); err != nil {
				return nil, fmt.Errorf("failed to generate random key: %w", err)
			}
		} else if err != nil {
			return nil, fmt.Errorf("failed to get key from environment: %w", err)
		}
		service.keyProvider = provider

	case "vault":
		provider := NewVaultKeyProvider()
		key, err = provider.GetKey(service.keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get key from Vault: %w", err)
		}
		service.keyProvider = provider

	case "aws-kms":
		provider := NewAWSKMSKeyProvider()
		key, err = provider.GetKey(service.keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to get key from AWS KMS: %w", err)
		}
		service.keyProvider = provider

	default:
		return nil, fmt.Errorf("unknown key source: %s", config.KeySource)
	}

	if len(key) < 32 {
		return nil, fmt.Errorf("key must be at least 32 bytes, got %d", len(key))
	}

	service.secretKey = key
	service.initialized = true
	return service, nil
}

// IsInitialized returns whether the crypto service is properly initialized
func (s *ILPCryptoService) IsInitialized() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.initialized
}

// GenerateFulfillment generates a cryptographically secure fulfillment for a transfer
func (s *ILPCryptoService) GenerateFulfillment(transferID string, amount int64, payerFSP, payeeFSP string) []byte {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data := fmt.Sprintf("%s:%d:%s:%s", transferID, amount, payerFSP, payeeFSP)
	h := hmac.New(sha256.New, s.secretKey)
	h.Write([]byte(data))
	return h.Sum(nil)
}

// GenerateCondition generates a condition from a fulfillment (SHA-256 hash)
func (s *ILPCryptoService) GenerateCondition(fulfillment []byte) []byte {
	hash := sha256.Sum256(fulfillment)
	return hash[:]
}

// GenerateFulfillmentAndCondition generates both fulfillment and condition for a transfer
func (s *ILPCryptoService) GenerateFulfillmentAndCondition(transferID string, amount int64, payerFSP, payeeFSP string) ([]byte, []byte) {
	fulfillment := s.GenerateFulfillment(transferID, amount, payerFSP, payeeFSP)
	condition := s.GenerateCondition(fulfillment)
	return fulfillment, condition
}

// VerifyFulfillment verifies that a fulfillment matches a condition
func (s *ILPCryptoService) VerifyFulfillment(fulfillment, condition []byte) bool {
	computedCondition := s.GenerateCondition(fulfillment)
	return hmac.Equal(computedCondition, condition)
}

// FulfillmentToBase64 encodes a fulfillment as URL-safe base64
func (s *ILPCryptoService) FulfillmentToBase64(fulfillment []byte) string {
	return base64.RawURLEncoding.EncodeToString(fulfillment)
}

// ConditionToBase64 encodes a condition as URL-safe base64
func (s *ILPCryptoService) ConditionToBase64(condition []byte) string {
	return base64.RawURLEncoding.EncodeToString(condition)
}

// Base64ToBytes decodes a URL-safe base64 string to bytes
func (s *ILPCryptoService) Base64ToBytes(b64String string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(b64String)
}

// ILPPacketBuilder builds ILP Prepare packets
type ILPPacketBuilder struct {
	crypto *ILPCryptoService
}

// NewILPPacketBuilder creates a new ILP packet builder
func NewILPPacketBuilder(crypto *ILPCryptoService) *ILPPacketBuilder {
	return &ILPPacketBuilder{crypto: crypto}
}

// TransactionData represents the data embedded in an ILP packet
type TransactionData struct {
	TransactionID   string     `json:"transactionId"`
	TransactionType string     `json:"transactionType"`
	Amount          AmountData `json:"amount"`
	Payer           PartyData  `json:"payer"`
	Payee           PayeeData  `json:"payee"`
}

// AmountData represents amount information
type AmountData struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

// PartyData represents payer information
type PartyData struct {
	FspID string `json:"fspId"`
}

// PayeeData represents payee information
type PayeeData struct {
	FspID      string `json:"fspId"`
	Identifier string `json:"identifier"`
}

// ILPResult contains the result of building an ILP packet
type ILPResult struct {
	ILPPacket   string `json:"ilpPacket"`
	Condition   string `json:"condition"`
	Fulfillment string `json:"fulfillment"`
	Expiration  string `json:"expiration"`
}

// BuildPreparePacket builds a complete ILP Prepare packet with fulfillment and condition
func (b *ILPPacketBuilder) BuildPreparePacket(
	transferID string,
	amount int64,
	currency string,
	payerFSP string,
	payeeFSP string,
	payeeIdentifier string,
	expirySeconds int,
	transactionType string,
) (*ILPResult, error) {
	if expirySeconds == 0 {
		expirySeconds = 30
	}
	if transactionType == "" {
		transactionType = "TRANSFER"
	}

	// Generate fulfillment and condition
	fulfillment, condition := b.crypto.GenerateFulfillmentAndCondition(
		transferID, amount, payerFSP, payeeFSP,
	)

	// Build destination
	destination := fmt.Sprintf("g.%s.%s", payeeFSP, payeeIdentifier)

	// Build transaction data
	txData := TransactionData{
		TransactionID:   transferID,
		TransactionType: transactionType,
		Amount: AmountData{
			Currency: currency,
			Amount:   fmt.Sprintf("%.2f", float64(amount)/100),
		},
		Payer: PartyData{FspID: payerFSP},
		Payee: PayeeData{FspID: payeeFSP, Identifier: payeeIdentifier},
	}

	txDataBytes, err := json.Marshal(txData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal transaction data: %w", err)
	}

	// Build expiry
	expiry := time.Now().UTC().Add(time.Duration(expirySeconds) * time.Second)

	// Build packet
	packet := &ILPPacket{
		PacketType:         ILPPacketTypePrepare,
		Amount:             uint64(amount),
		Expiry:             expiry,
		ExecutionCondition: condition,
		Destination:        destination,
		Data:               txDataBytes,
	}

	return &ILPResult{
		ILPPacket:   packet.ToBase64(),
		Condition:   b.crypto.ConditionToBase64(condition),
		Fulfillment: b.crypto.FulfillmentToBase64(fulfillment),
		Expiration:  expiry.Format("2006-01-02T15:04:05.000") + "Z",
	}, nil
}

// Singleton instances
var (
	defaultCryptoService *ILPCryptoService
	defaultPacketBuilder *ILPPacketBuilder
	once                 sync.Once
)

// GetILPCryptoService returns the singleton ILP crypto service
func GetILPCryptoService() *ILPCryptoService {
	once.Do(func() {
		defaultCryptoService = NewILPCryptoService("")
		defaultPacketBuilder = NewILPPacketBuilder(defaultCryptoService)
	})
	return defaultCryptoService
}

// GetILPPacketBuilder returns the singleton ILP packet builder
func GetILPPacketBuilder() *ILPPacketBuilder {
	GetILPCryptoService() // Ensure initialization
	return defaultPacketBuilder
}

// GenerateTransferILP generates ILP packet, condition, and fulfillment for a transfer
func GenerateTransferILP(
	transferID string,
	amount int64,
	currency string,
	payerFSP string,
	payeeFSP string,
	payeeIdentifier string,
) (*ILPResult, error) {
	builder := GetILPPacketBuilder()
	return builder.BuildPreparePacket(
		transferID,
		amount,
		currency,
		payerFSP,
		payeeFSP,
		payeeIdentifier,
		30,
		"TRANSFER",
	)
}

// VerifyTransferFulfillment verifies that a fulfillment matches a condition
func VerifyTransferFulfillment(fulfillmentB64, conditionB64 string) (bool, error) {
	crypto := GetILPCryptoService()

	fulfillment, err := crypto.Base64ToBytes(fulfillmentB64)
	if err != nil {
		return false, fmt.Errorf("failed to decode fulfillment: %w", err)
	}

	condition, err := crypto.Base64ToBytes(conditionB64)
	if err != nil {
		return false, fmt.Errorf("failed to decode condition: %w", err)
	}

	return crypto.VerifyFulfillment(fulfillment, condition), nil
}
