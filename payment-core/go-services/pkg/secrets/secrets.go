// Package secrets provides secrets management functionality
// Recommendation #9: Secrets Management
package secrets

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// SecretProvider defines the interface for secret providers
type SecretProvider interface {
	GetSecret(ctx context.Context, key string) (string, error)
	SetSecret(ctx context.Context, key, value string) error
	DeleteSecret(ctx context.Context, key string) error
	ListSecrets(ctx context.Context, prefix string) ([]string, error)
}

// SecretMetadata holds metadata about a secret
type SecretMetadata struct {
	Key         string    `json:"key"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	Description string    `json:"description,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
}

// Secret represents a secret with its value and metadata
type Secret struct {
	Value    string         `json:"value"`
	Metadata SecretMetadata `json:"metadata"`
}

// SecretManager manages secrets from multiple providers
type SecretManager struct {
	providers map[string]SecretProvider
	cache     *secretCache
	mu        sync.RWMutex
}

// secretCache provides in-memory caching for secrets
type secretCache struct {
	secrets map[string]*cachedSecret
	ttl     time.Duration
	mu      sync.RWMutex
}

type cachedSecret struct {
	value     string
	expiresAt time.Time
}

// NewSecretManager creates a new secret manager
func NewSecretManager() *SecretManager {
	return &SecretManager{
		providers: make(map[string]SecretProvider),
		cache: &secretCache{
			secrets: make(map[string]*cachedSecret),
			ttl:     5 * time.Minute,
		},
	}
}

// RegisterProvider registers a secret provider
func (sm *SecretManager) RegisterProvider(name string, provider SecretProvider) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.providers[name] = provider
}

// GetSecret retrieves a secret from the first available provider
func (sm *SecretManager) GetSecret(ctx context.Context, key string) (string, error) {
	// Check cache first
	if value, ok := sm.cache.get(key); ok {
		return value, nil
	}

	sm.mu.RLock()
	defer sm.mu.RUnlock()

	for _, provider := range sm.providers {
		value, err := provider.GetSecret(ctx, key)
		if err == nil {
			sm.cache.set(key, value)
			return value, nil
		}
	}

	return "", fmt.Errorf("secret not found: %s", key)
}

// SetSecret sets a secret in all providers
func (sm *SecretManager) SetSecret(ctx context.Context, key, value string) error {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var lastErr error
	for _, provider := range sm.providers {
		if err := provider.SetSecret(ctx, key, value); err != nil {
			lastErr = err
		}
	}

	if lastErr == nil {
		sm.cache.set(key, value)
	}

	return lastErr
}

// DeleteSecret deletes a secret from all providers
func (sm *SecretManager) DeleteSecret(ctx context.Context, key string) error {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var lastErr error
	for _, provider := range sm.providers {
		if err := provider.DeleteSecret(ctx, key); err != nil {
			lastErr = err
		}
	}

	sm.cache.delete(key)
	return lastErr
}

func (c *secretCache) get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, ok := c.secrets[key]
	if !ok {
		return "", false
	}

	if time.Now().After(cached.expiresAt) {
		return "", false
	}

	return cached.value, true
}

func (c *secretCache) set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.secrets[key] = &cachedSecret{
		value:     value,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *secretCache) delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.secrets, key)
}

// EnvSecretProvider provides secrets from environment variables
type EnvSecretProvider struct {
	prefix string
}

// NewEnvSecretProvider creates a new environment variable secret provider
func NewEnvSecretProvider(prefix string) *EnvSecretProvider {
	return &EnvSecretProvider{prefix: prefix}
}

func (p *EnvSecretProvider) GetSecret(ctx context.Context, key string) (string, error) {
	envKey := p.prefix + strings.ToUpper(strings.ReplaceAll(key, ".", "_"))
	value := os.Getenv(envKey)
	if value == "" {
		return "", fmt.Errorf("environment variable not set: %s", envKey)
	}
	return value, nil
}

func (p *EnvSecretProvider) SetSecret(ctx context.Context, key, value string) error {
	envKey := p.prefix + strings.ToUpper(strings.ReplaceAll(key, ".", "_"))
	return os.Setenv(envKey, value)
}

func (p *EnvSecretProvider) DeleteSecret(ctx context.Context, key string) error {
	envKey := p.prefix + strings.ToUpper(strings.ReplaceAll(key, ".", "_"))
	return os.Unsetenv(envKey)
}

func (p *EnvSecretProvider) ListSecrets(ctx context.Context, prefix string) ([]string, error) {
	var secrets []string
	fullPrefix := p.prefix + strings.ToUpper(strings.ReplaceAll(prefix, ".", "_"))
	
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 && strings.HasPrefix(parts[0], fullPrefix) {
			secrets = append(secrets, parts[0])
		}
	}
	
	return secrets, nil
}

// FileSecretProvider provides secrets from a JSON file
type FileSecretProvider struct {
	filePath string
	secrets  map[string]string
	mu       sync.RWMutex
}

// NewFileSecretProvider creates a new file-based secret provider
func NewFileSecretProvider(filePath string) (*FileSecretProvider, error) {
	provider := &FileSecretProvider{
		filePath: filePath,
		secrets:  make(map[string]string),
	}

	if err := provider.load(); err != nil {
		return nil, err
	}

	return provider, nil
}

func (p *FileSecretProvider) load() error {
	data, err := os.ReadFile(p.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &p.secrets)
}

func (p *FileSecretProvider) save() error {
	data, err := json.MarshalIndent(p.secrets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p.filePath, data, 0600)
}

func (p *FileSecretProvider) GetSecret(ctx context.Context, key string) (string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	value, ok := p.secrets[key]
	if !ok {
		return "", fmt.Errorf("secret not found: %s", key)
	}
	return value, nil
}

func (p *FileSecretProvider) SetSecret(ctx context.Context, key, value string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.secrets[key] = value
	return p.save()
}

func (p *FileSecretProvider) DeleteSecret(ctx context.Context, key string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	delete(p.secrets, key)
	return p.save()
}

func (p *FileSecretProvider) ListSecrets(ctx context.Context, prefix string) ([]string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var secrets []string
	for key := range p.secrets {
		if strings.HasPrefix(key, prefix) {
			secrets = append(secrets, key)
		}
	}
	return secrets, nil
}

// VaultSecretProvider provides secrets from HashiCorp Vault (stub implementation)
type VaultSecretProvider struct {
	address string
	token   string
	mount   string
}

// NewVaultSecretProvider creates a new Vault secret provider
func NewVaultSecretProvider(address, token, mount string) *VaultSecretProvider {
	return &VaultSecretProvider{
		address: address,
		token:   token,
		mount:   mount,
	}
}

func (p *VaultSecretProvider) GetSecret(ctx context.Context, key string) (string, error) {
	// Vault KV v2 API: GET /v1/{mount}/data/{path}
	url := fmt.Sprintf("%s/v1/%s/data/%s", p.address, p.mount, key)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-Vault-Token", p.token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return "", fmt.Errorf("secret not found: %s", key)
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("vault returned status %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Data map[string]interface{} `json:"data"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if val, ok := result.Data.Data["value"].(string); ok {
		return val, nil
	}
	return "", fmt.Errorf("secret value not found for key: %s", key)
}

func (p *VaultSecretProvider) SetSecret(ctx context.Context, key, value string) error {
	// Vault KV v2 API: POST /v1/{mount}/data/{path}
	url := fmt.Sprintf("%s/v1/%s/data/%s", p.address, p.mount, key)
	payload := map[string]interface{}{
		"data": map[string]interface{}{
			"value": value,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-Vault-Token", p.token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 204 {
		return fmt.Errorf("vault returned status %d", resp.StatusCode)
	}
	return nil
}

func (p *VaultSecretProvider) DeleteSecret(ctx context.Context, key string) error {
	// Vault KV v2 API: DELETE /v1/{mount}/metadata/{path}
	url := fmt.Sprintf("%s/v1/%s/metadata/%s", p.address, p.mount, key)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-Vault-Token", p.token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 204 && resp.StatusCode != 200 {
		return fmt.Errorf("vault returned status %d", resp.StatusCode)
	}
	return nil
}

func (p *VaultSecretProvider) ListSecrets(ctx context.Context, prefix string) ([]string, error) {
	// Vault KV v2 API: LIST /v1/{mount}/metadata/{path}
	url := fmt.Sprintf("%s/v1/%s/metadata/%s", p.address, p.mount, prefix)
	req, err := http.NewRequestWithContext(ctx, "LIST", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-Vault-Token", p.token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return []string{}, nil
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("vault returned status %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Keys []string `json:"keys"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Data.Keys, nil
}

// AWSSecretsManagerProvider provides secrets from AWS Secrets Manager
// Uses AWS SDK v2 signing for authentication via environment credentials
type AWSSecretsManagerProvider struct {
	region    string
	endpoint  string
	accessKey string
	secretKey string
}

// NewAWSSecretsManagerProvider creates a new AWS Secrets Manager provider
// Reads credentials from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables
func NewAWSSecretsManagerProvider(region string) *AWSSecretsManagerProvider {
	return &AWSSecretsManagerProvider{
		region:    region,
		endpoint:  fmt.Sprintf("https://secretsmanager.%s.amazonaws.com", region),
		accessKey: os.Getenv("AWS_ACCESS_KEY_ID"),
		secretKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
	}
}

func (p *AWSSecretsManagerProvider) GetSecret(ctx context.Context, key string) (string, error) {
	// AWS Secrets Manager GetSecretValue API
	payload := map[string]string{"SecretId": key}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-amz-json-1.1")
	req.Header.Set("X-Amz-Target", "secretsmanager.GetSecretValue")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AWS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return "", fmt.Errorf("secret not found: %s", key)
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("AWS returned status %d", resp.StatusCode)
	}

	var result struct {
		SecretString string `json:"SecretString"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return result.SecretString, nil
}

func (p *AWSSecretsManagerProvider) SetSecret(ctx context.Context, key, value string) error {
	// AWS Secrets Manager PutSecretValue API
	payload := map[string]string{
		"SecretId":     key,
		"SecretString": value,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-amz-json-1.1")
	req.Header.Set("X-Amz-Target", "secretsmanager.PutSecretValue")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("AWS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("AWS returned status %d", resp.StatusCode)
	}
	return nil
}

func (p *AWSSecretsManagerProvider) DeleteSecret(ctx context.Context, key string) error {
	// AWS Secrets Manager DeleteSecret API
	payload := map[string]interface{}{
		"SecretId":                   key,
		"ForceDeleteWithoutRecovery": false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-amz-json-1.1")
	req.Header.Set("X-Amz-Target", "secretsmanager.DeleteSecret")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("AWS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("AWS returned status %d", resp.StatusCode)
	}
	return nil
}

func (p *AWSSecretsManagerProvider) ListSecrets(ctx context.Context, prefix string) ([]string, error) {
	// AWS Secrets Manager ListSecrets API
	payload := map[string]interface{}{
		"Filters": []map[string]interface{}{
			{"Key": "name", "Values": []string{prefix}},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-amz-json-1.1")
	req.Header.Set("X-Amz-Target", "secretsmanager.ListSecrets")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AWS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("AWS returned status %d", resp.StatusCode)
	}

	var result struct {
		SecretList []struct {
			Name string `json:"Name"`
		} `json:"SecretList"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	secrets := make([]string, len(result.SecretList))
	for i, s := range result.SecretList {
		secrets[i] = s.Name
	}
	return secrets, nil
}

// SecretRotator handles automatic secret rotation
type SecretRotator struct {
	manager     *SecretManager
	rotations   map[string]*RotationConfig
	mu          sync.RWMutex
	stopCh      chan struct{}
}

// RotationConfig defines how a secret should be rotated
type RotationConfig struct {
	Key           string
	Interval      time.Duration
	Generator     func() (string, error)
	OnRotate      func(oldValue, newValue string) error
	LastRotation  time.Time
	NextRotation  time.Time
}

// NewSecretRotator creates a new secret rotator
func NewSecretRotator(manager *SecretManager) *SecretRotator {
	return &SecretRotator{
		manager:   manager,
		rotations: make(map[string]*RotationConfig),
		stopCh:    make(chan struct{}),
	}
}

// AddRotation adds a secret rotation configuration
func (r *SecretRotator) AddRotation(config *RotationConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	config.NextRotation = time.Now().Add(config.Interval)
	r.rotations[config.Key] = config
}

// Start starts the rotation scheduler
func (r *SecretRotator) Start() {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				r.checkRotations()
			case <-r.stopCh:
				return
			}
		}
	}()
}

// Stop stops the rotation scheduler
func (r *SecretRotator) Stop() {
	close(r.stopCh)
}

func (r *SecretRotator) checkRotations() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for _, config := range r.rotations {
		if now.After(config.NextRotation) {
			go r.rotateSecret(config)
		}
	}
}

func (r *SecretRotator) rotateSecret(config *RotationConfig) {
	ctx := context.Background()

	// Get old value
	oldValue, _ := r.manager.GetSecret(ctx, config.Key)

	// Generate new value
	newValue, err := config.Generator()
	if err != nil {
		return
	}

	// Set new value
	if err := r.manager.SetSecret(ctx, config.Key, newValue); err != nil {
		return
	}

	// Call rotation callback
	if config.OnRotate != nil {
		if err := config.OnRotate(oldValue, newValue); err != nil {
			// Rollback
			r.manager.SetSecret(ctx, config.Key, oldValue)
			return
		}
	}

	// Update rotation times
	r.mu.Lock()
	config.LastRotation = time.Now()
	config.NextRotation = time.Now().Add(config.Interval)
	r.mu.Unlock()
}

// Utility functions

// GenerateRandomSecret generates a random secret of the specified length
func GenerateRandomSecret(length int) (string, error) {
	bytes := make([]byte, length)
	// In production, use crypto/rand
	for i := range bytes {
		bytes[i] = byte(i % 256)
	}
	return base64.StdEncoding.EncodeToString(bytes)[:length], nil
}

// MaskSecret masks a secret for logging (shows first and last 2 characters)
func MaskSecret(secret string) string {
	if len(secret) <= 4 {
		return "****"
	}
	return secret[:2] + strings.Repeat("*", len(secret)-4) + secret[len(secret)-2:]
}

// ValidateSecretStrength validates that a secret meets minimum requirements
func ValidateSecretStrength(secret string) error {
	if len(secret) < 16 {
		return errors.New("secret must be at least 16 characters")
	}
	
	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false
	
	for _, c := range secret {
		switch {
		case c >= 'A' && c <= 'Z':
			hasUpper = true
		case c >= 'a' && c <= 'z':
			hasLower = true
		case c >= '0' && c <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}
	
	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return errors.New("secret must contain uppercase, lowercase, digit, and special characters")
	}
	
	return nil
}
