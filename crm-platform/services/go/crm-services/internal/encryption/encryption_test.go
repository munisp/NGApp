package encryption

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultEncryptionConfig(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	assert.NotNil(t, cfg)
}

func TestNewEncryptionService(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	svc, err := NewEncryptionService(cfg)
	require.NoError(t, err)
	assert.NotNil(t, svc)
}

func TestEncryptDecrypt(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	svc, err := NewEncryptionService(cfg)
	require.NoError(t, err)

	plaintext := []byte("sensitive customer data")
	encrypted, err := svc.Encrypt(context.Background(), plaintext)
	require.NoError(t, err)
	assert.NotNil(t, encrypted)
	assert.NotEmpty(t, encrypted.Ciphertext)

	decrypted, err := svc.Decrypt(context.Background(), encrypted)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

func TestEncrypt_DifferentPlaintexts(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	svc, err := NewEncryptionService(cfg)
	require.NoError(t, err)

	enc1, err := svc.Encrypt(context.Background(), []byte("data1"))
	require.NoError(t, err)

	enc2, err := svc.Encrypt(context.Background(), []byte("data2"))
	require.NoError(t, err)

	// Different plaintexts should produce different ciphertexts
	assert.NotEqual(t, enc1.Ciphertext, enc2.Ciphertext)
}

func TestEncrypt_EmptyPlaintext(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	svc, err := NewEncryptionService(cfg)
	require.NoError(t, err)

	encrypted, err := svc.Encrypt(context.Background(), []byte(""))
	require.NoError(t, err)
	assert.NotNil(t, encrypted)

	decrypted, err := svc.Decrypt(context.Background(), encrypted)
	require.NoError(t, err)
	assert.Empty(t, decrypted)
}

func TestListKeys(t *testing.T) {
	cfg := DefaultEncryptionConfig()
	svc, err := NewEncryptionService(cfg)
	require.NoError(t, err)

	keys := svc.ListKeys()
	assert.NotNil(t, keys)
}

func TestDefaultPIIFields(t *testing.T) {
	fields := defaultPIIFields()
	assert.NotEmpty(t, fields)
	assert.Contains(t, fields, "customer")
}
