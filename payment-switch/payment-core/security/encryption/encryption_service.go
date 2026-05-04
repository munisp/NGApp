package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
)

type EncryptionAlgorithm string

const (
	AlgoAES256GCM    EncryptionAlgorithm = "AES-256-GCM"
	AlgoChaCha20Poly EncryptionAlgorithm = "CHACHA20-POLY1305"
)

type KeyScope string

const (
	ScopeDataAtRest    KeyScope = "DATA_AT_REST"
	ScopeDataInTransit KeyScope = "DATA_IN_TRANSIT"
	ScopeTokenization  KeyScope = "TOKENIZATION"
	ScopePII           KeyScope = "PII"
	ScopeCard          KeyScope = "CARD_DATA"
)

type EncryptionService struct {
	keys      map[KeyScope][]byte
	algorithm EncryptionAlgorithm
}

func NewEncryptionService(masterKey string) *EncryptionService {
	es := &EncryptionService{
		keys:      make(map[KeyScope][]byte),
		algorithm: AlgoAES256GCM,
	}

	scopes := []KeyScope{ScopeDataAtRest, ScopeDataInTransit, ScopeTokenization, ScopePII, ScopeCard}
	for _, scope := range scopes {
		es.keys[scope] = deriveKey(masterKey, string(scope))
	}
	return es
}

func (es *EncryptionService) Encrypt(plaintext []byte, scope KeyScope) ([]byte, error) {
	key, ok := es.keys[scope]
	if !ok {
		return nil, errors.New("invalid key scope")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (es *EncryptionService) Decrypt(ciphertext []byte, scope KeyScope) ([]byte, error) {
	key, ok := es.keys[scope]
	if !ok {
		return nil, errors.New("invalid key scope")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func (es *EncryptionService) TokenizePAN(pan string) string {
	hash := sha256.Sum256([]byte(pan))
	return "tok_" + hex.EncodeToString(hash[:16])
}

func (es *EncryptionService) TokenizeBVN(bvn string) string {
	hash := sha256.Sum256([]byte(bvn))
	return "bvn_" + hex.EncodeToString(hash[:16])
}

func deriveKey(masterKey, context string) []byte {
	h := sha256.New()
	h.Write([]byte(masterKey))
	h.Write([]byte(context))
	return h.Sum(nil)
}
