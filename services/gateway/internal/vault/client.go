package vault

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
)

// Client wraps HashiCorp Vault for centralized secrets management.
// Supports KV v2, Transit (encryption-as-a-service), and PKI engines.
// Falls back to environment variables when Vault is unreachable.
type Client struct {
	addr         string
	token        string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc
	// In-memory secret cache for fallback
	cache map[string]string
	// Transit key name for envelope encryption
	transitKey string
}

// SecretEntry represents a Vault KV v2 secret
type SecretEntry struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
}

// TransitEncryptResponse holds Vault Transit encrypt response
type TransitEncryptResponse struct {
	Ciphertext string `json:"ciphertext"`
}

// TransitDecryptResponse holds Vault Transit decrypt response
type TransitDecryptResponse struct {
	Plaintext string `json:"plaintext"`
}

// PKICertificate holds a generated TLS certificate
type PKICertificate struct {
	Certificate string `json:"certificate"`
	PrivateKey  string `json:"private_key"`
	CAChain     string `json:"ca_chain"`
	Serial      string `json:"serial_number"`
	Expiration  int64  `json:"expiration"`
}

// AuditEntry represents a Vault audit log entry
type AuditEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Path      string    `json:"path"`
	Operation string    `json:"operation"`
	ClientIP  string    `json:"client_ip"`
	UserID    string    `json:"user_id"`
}

func getEnvOrDefault(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// NewClient creates a Vault client with automatic connection and fallback
func NewClient(addr, token string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		addr:       addr,
		token:      token,
		cache:      make(map[string]string),
		httpClient: &http.Client{Timeout: 5 * time.Second},
		transitKey: "nexcom-exchange",
		ctx:        ctx,
		cancel:     cancel,
	}
	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name: "vault", MaxRequests: 3, Interval: 30 * time.Second, Timeout: 10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool { return counts.ConsecutiveFailures >= 5 },
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Vault] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	// Seed fallback cache from environment variables
	c.seedFromEnv()
	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *Client) seedFromEnv() {
	envSecrets := map[string]string{
		"database/postgres/url":   getEnvOrDefault("DATABASE_URL", "postgres://nexcom:nexcom@localhost:5432/nexcom?sslmode=disable"),
		"database/redis/url":      getEnvOrDefault("REDIS_URL", "redis://localhost:6379"),
		"kafka/brokers":           getEnvOrDefault("KAFKA_BROKERS", "localhost:9092"),
		"keycloak/client-secret":  getEnvOrDefault("KEYCLOAK_CLIENT_SECRET", "changeme-use-vault"),
		"apisix/admin-key":        getEnvOrDefault("APISIX_ADMIN_KEY", "nexcom-admin-key-changeme"),
		"oanda/api-key":           getEnvOrDefault("OANDA_API_KEY", ""),
		"polygon/api-key":         getEnvOrDefault("POLYGON_API_KEY", ""),
		"iex/api-key":             getEnvOrDefault("IEX_API_KEY", ""),
		"blockchain/rpc-url":      getEnvOrDefault("BLOCKCHAIN_RPC_URL", "http://localhost:8545"),
		"ipfs/api-url":            getEnvOrDefault("IPFS_API_URL", "http://localhost:5001"),
		"jwt/signing-key":         getEnvOrDefault("JWT_SIGNING_KEY", "nexcom-jwt-signing-key-changeme"),
		"hmac/api-signing-secret": getEnvOrDefault("HMAC_API_SIGNING_SECRET", "nexcom-hmac-secret-changeme"),
		"encryption/master-key":   getEnvOrDefault("ENCRYPTION_MASTER_KEY", "nexcom-master-key-changeme-32b!"),
	}
	c.mu.Lock()
	for k, v := range envSecrets {
		c.cache[k] = v
	}
	c.mu.Unlock()
}

func (c *Client) connect() {
	log.Printf("[Vault] Connecting to %s", c.addr)

	req, err := http.NewRequest("GET", c.addr+"/v1/sys/health", nil)
	if err != nil {
		log.Printf("[Vault] WARN: Failed to create request: %v -- fallback mode", err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	req.Header.Set("X-Vault-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[Vault] WARN: Cannot reach %s: %v -- fallback mode (env var secrets)", c.addr, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	resp.Body.Close()

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Vault] Connected (HTTP %d)", resp.StatusCode)

	// Bootstrap Transit engine and PKI on connection
	c.bootstrapTransit()
	c.bootstrapPKI()
}

func (c *Client) reconnectLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			fb := c.fallbackMode
			c.mu.RUnlock()
			if fb {
				log.Printf("[Vault] Attempting reconnection to %s...", c.addr)
				c.connect()
			}
		}
	}
}

// bootstrapTransit enables Transit secrets engine and creates the exchange encryption key
func (c *Client) bootstrapTransit() {
	// Enable transit engine
	c.vaultRequest("POST", "/v1/sys/mounts/transit", map[string]interface{}{
		"type": "transit",
	})
	// Create encryption key for the exchange
	c.vaultRequest("POST", fmt.Sprintf("/v1/transit/keys/%s", c.transitKey), map[string]interface{}{
		"type":                   "aes256-gcm96",
		"derived":                false,
		"exportable":             false,
		"allow_plaintext_backup": false,
		"min_decryption_version": 1,
		"min_encryption_version": 1,
	})
	log.Printf("[Vault] Transit engine bootstrapped (key: %s)", c.transitKey)
}

// bootstrapPKI enables PKI engine for mTLS certificate generation
func (c *Client) bootstrapPKI() {
	// Enable PKI engine
	c.vaultRequest("POST", "/v1/sys/mounts/pki", map[string]interface{}{
		"type": "pki",
		"config": map[string]interface{}{
			"max_lease_ttl": "87600h", // 10 years for root CA
		},
	})
	// Generate root CA
	c.vaultRequest("POST", "/v1/pki/root/generate/internal", map[string]interface{}{
		"common_name":  "NEXCOM Exchange Root CA",
		"issuer_name":  "nexcom-root",
		"ttl":          "87600h",
		"key_type":     "rsa",
		"key_bits":     4096,
		"organization": "NEXCOM Exchange",
		"country":      "NG",
	})
	// Create role for service certificates
	c.vaultRequest("POST", "/v1/pki/roles/nexcom-service", map[string]interface{}{
		"allowed_domains":  []string{"nexcom.exchange", "nexcom.svc.cluster.local"},
		"allow_subdomains": true,
		"max_ttl":          "720h", // 30 days
		"key_type":         "rsa",
		"key_bits":         2048,
		"require_cn":       true,
	})
	log.Printf("[Vault] PKI engine bootstrapped (root CA + service role)")
}

// GetSecret retrieves a secret from Vault KV v2 or fallback cache
func (c *Client) GetSecret(path string) (string, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, err := c.vaultRequest("GET", fmt.Sprintf("/v1/secret/data/%s", path), nil)
		if err == nil {
			var result struct {
				Data struct {
					Data map[string]interface{} `json:"data"`
				} `json:"data"`
			}
			if json.Unmarshal(body, &result) == nil {
				if val, ok := result.Data.Data["value"].(string); ok {
					// Update cache
					c.mu.Lock()
					c.cache[path] = val
					c.mu.Unlock()
					return val, nil
				}
			}
		}
	}

	// Fallback to cache
	c.mu.RLock()
	val, ok := c.cache[path]
	c.mu.RUnlock()
	if ok {
		return val, nil
	}
	return "", fmt.Errorf("secret not found: %s", path)
}

// PutSecret stores a secret in Vault KV v2
func (c *Client) PutSecret(path, value string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		_, err := c.vaultRequest("POST", fmt.Sprintf("/v1/secret/data/%s", path), map[string]interface{}{
			"data": map[string]interface{}{"value": value},
		})
		if err == nil {
			c.mu.Lock()
			c.cache[path] = value
			c.mu.Unlock()
			return nil
		}
	}

	// Fallback: store in cache
	c.mu.Lock()
	c.cache[path] = value
	c.mu.Unlock()
	return nil
}

// Encrypt encrypts data using Vault Transit engine (envelope encryption)
func (c *Client) Encrypt(plaintext string) (string, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, err := c.vaultRequest("POST", fmt.Sprintf("/v1/transit/encrypt/%s", c.transitKey), map[string]interface{}{
			"plaintext": plaintext,
		})
		if err == nil {
			var result struct {
				Data TransitEncryptResponse `json:"data"`
			}
			if json.Unmarshal(body, &result) == nil && result.Data.Ciphertext != "" {
				return result.Data.Ciphertext, nil
			}
		}
	}

	// Fallback: use local AES-256-GCM encryption with master key from env
	return c.localEncrypt(plaintext)
}

// Decrypt decrypts data using Vault Transit engine
func (c *Client) Decrypt(ciphertext string) (string, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, err := c.vaultRequest("POST", fmt.Sprintf("/v1/transit/decrypt/%s", c.transitKey), map[string]interface{}{
			"ciphertext": ciphertext,
		})
		if err == nil {
			var result struct {
				Data TransitDecryptResponse `json:"data"`
			}
			if json.Unmarshal(body, &result) == nil && result.Data.Plaintext != "" {
				return result.Data.Plaintext, nil
			}
		}
	}

	// Fallback: decrypt with local AES-256-GCM
	if strings.HasPrefix(ciphertext, "vault:local:") {
		return c.localDecrypt(ciphertext)
	}
	// Legacy plaintext fallback (migration path)
	if strings.HasPrefix(ciphertext, "vault:fallback:") {
		return ciphertext[15:], nil
	}
	return ciphertext, nil
}

// IssueCertificate generates a TLS certificate via Vault PKI
func (c *Client) IssueCertificate(commonName string, ttl string) (*PKICertificate, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		body, err := c.vaultRequest("POST", "/v1/pki/issue/nexcom-service", map[string]interface{}{
			"common_name": commonName,
			"ttl":         ttl,
		})
		if err == nil {
			var result struct {
				Data PKICertificate `json:"data"`
			}
			if json.Unmarshal(body, &result) == nil {
				return &result.Data, nil
			}
		}
	}

	// Fallback: return placeholder cert info
	return &PKICertificate{
		Certificate: "--- FALLBACK SELF-SIGNED CERT ---",
		PrivateKey:  "--- FALLBACK KEY ---",
		CAChain:     "--- FALLBACK CA ---",
		Serial:      "fallback-0001",
		Expiration:  time.Now().Add(24 * time.Hour).Unix(),
	}, nil
}

// RotateTransitKey rotates the Transit encryption key
func (c *Client) RotateTransitKey() error {
	_, err := c.vaultRequest("POST", fmt.Sprintf("/v1/transit/keys/%s/rotate", c.transitKey), nil)
	return err
}

func (c *Client) vaultRequest(method, path string, payload interface{}) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, c.addr+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// localEncrypt encrypts plaintext using AES-256-GCM with the master key from env/cache.
// Used as fallback when Vault Transit is unreachable.
func (c *Client) localEncrypt(plaintext string) (string, error) {
	key := c.getMasterKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("local encrypt: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("local encrypt GCM: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("local encrypt nonce: %w", err)
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "vault:local:" + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// localDecrypt decrypts a "vault:local:" prefixed ciphertext using AES-256-GCM.
func (c *Client) localDecrypt(ciphertext string) (string, error) {
	encoded := ciphertext[len("vault:local:"):]
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("local decrypt base64: %w", err)
	}
	key := c.getMasterKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("local decrypt: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("local decrypt GCM: %w", err)
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("local decrypt: ciphertext too short")
	}
	nonce, ct := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("local decrypt: %w", err)
	}
	return string(plaintext), nil
}

// getMasterKey returns a 32-byte AES-256 key from the environment or cache.
func (c *Client) getMasterKey() []byte {
	c.mu.RLock()
	mk := c.cache["encryption/master-key"]
	c.mu.RUnlock()
	// Ensure exactly 32 bytes for AES-256
	key := make([]byte, 32)
	copy(key, []byte(mk))
	return key
}

// IsConnected returns whether Vault is connected
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// IsFallback returns whether running in fallback mode
func (c *Client) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

// Close shuts down the Vault client
func (c *Client) Close() {
	c.cancel()
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[Vault] Connection closed")
}
