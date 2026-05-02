package mojaloop

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestFulfillmentGenerationIsDeterministic(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment1 := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	fulfillment2 := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")

	if !bytes.Equal(fulfillment1, fulfillment2) {
		t.Error("Same inputs should produce same fulfillment")
	}

	if len(fulfillment1) != ILPFulfillmentLength {
		t.Errorf("Fulfillment length should be %d, got %d", ILPFulfillmentLength, len(fulfillment1))
	}
}

func TestDifferentInputsProduceDifferentFulfillments(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment1 := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	fulfillment2 := crypto.GenerateFulfillment("tx-456", 10000, "bank-a", "bank-b")

	if bytes.Equal(fulfillment1, fulfillment2) {
		t.Error("Different inputs should produce different fulfillments")
	}
}

func TestConditionIsSHA256OfFulfillment(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	condition := crypto.GenerateCondition(fulfillment)

	expectedCondition := sha256.Sum256(fulfillment)

	if !bytes.Equal(condition, expectedCondition[:]) {
		t.Error("Condition should be SHA-256 hash of fulfillment")
	}

	if len(condition) != ILPConditionLength {
		t.Errorf("Condition length should be %d, got %d", ILPConditionLength, len(condition))
	}
}

func TestFulfillmentVerificationSucceedsForValidPair(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment, condition := crypto.GenerateFulfillmentAndCondition("tx-123", 10000, "bank-a", "bank-b")

	if !crypto.VerifyFulfillment(fulfillment, condition) {
		t.Error("Valid fulfillment should verify against its condition")
	}
}

func TestFulfillmentVerificationFailsForInvalidPair(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	_, condition := crypto.GenerateFulfillmentAndCondition("tx-123", 10000, "bank-a", "bank-b")
	wrongFulfillment := crypto.GenerateFulfillment("tx-456", 10000, "bank-a", "bank-b")

	if crypto.VerifyFulfillment(wrongFulfillment, condition) {
		t.Error("Invalid fulfillment should not verify against condition")
	}
}

func TestBase64EncodingRoundtrip(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	encoded := crypto.FulfillmentToBase64(fulfillment)
	decoded, err := crypto.Base64ToBytes(encoded)

	if err != nil {
		t.Errorf("Failed to decode base64: %v", err)
	}

	if !bytes.Equal(decoded, fulfillment) {
		t.Error("Base64 encoding should be reversible")
	}
}

func TestBuildPreparePacketReturnsAllFields(t *testing.T) {
	result, err := GenerateTransferILP(
		"tx-123",
		10000,
		"USD",
		"bank-a",
		"bank-b",
		"user-456",
	)

	if err != nil {
		t.Fatalf("Failed to generate transfer ILP: %v", err)
	}

	if result.ILPPacket == "" {
		t.Error("ILP packet should not be empty")
	}
	if result.Condition == "" {
		t.Error("Condition should not be empty")
	}
	if result.Fulfillment == "" {
		t.Error("Fulfillment should not be empty")
	}
	if result.Expiration == "" {
		t.Error("Expiration should not be empty")
	}
}

func TestILPPacketIsBase64Encoded(t *testing.T) {
	result, err := GenerateTransferILP(
		"tx-123",
		10000,
		"USD",
		"bank-a",
		"bank-b",
		"user-456",
	)

	if err != nil {
		t.Fatalf("Failed to generate transfer ILP: %v", err)
	}

	// Should not raise error when decoding
	_, err = base64.RawURLEncoding.DecodeString(result.ILPPacket)
	if err != nil {
		t.Errorf("ILP packet should be valid base64: %v", err)
	}
}

func TestConditionAndFulfillmentAreValidPair(t *testing.T) {
	result, err := GenerateTransferILP(
		"tx-123",
		10000,
		"USD",
		"bank-a",
		"bank-b",
		"user-456",
	)

	if err != nil {
		t.Fatalf("Failed to generate transfer ILP: %v", err)
	}

	valid, err := VerifyTransferFulfillment(result.Fulfillment, result.Condition)
	if err != nil {
		t.Fatalf("Failed to verify fulfillment: %v", err)
	}

	if !valid {
		t.Error("Generated condition and fulfillment should verify")
	}
}

func TestExpirationIsInFuture(t *testing.T) {
	result, err := GenerateTransferILP(
		"tx-123",
		10000,
		"USD",
		"bank-a",
		"bank-b",
		"user-456",
	)

	if err != nil {
		t.Fatalf("Failed to generate transfer ILP: %v", err)
	}

	// Parse expiration
	expiration, err := time.Parse("2006-01-02T15:04:05.000Z", result.Expiration)
	if err != nil {
		t.Fatalf("Failed to parse expiration: %v", err)
	}

	if !expiration.After(time.Now().UTC()) {
		t.Error("Expiration should be in the future")
	}
}

func TestPacketStartsWithCorrectType(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")
	condition := crypto.GenerateCondition([]byte("x"))

	packet := &ILPPacket{
		PacketType:         ILPPacketTypePrepare,
		Amount:             10000,
		Expiry:             time.Now().UTC().Add(30 * time.Second),
		ExecutionCondition: condition,
		Destination:        "g.bank-b.user-456",
		Data:               []byte(`{"test": "data"}`),
	}

	packetBytes := packet.ToBytes()
	if packetBytes[0] != ILPPacketTypePrepare {
		t.Errorf("Packet should start with PREPARE type byte %d, got %d", ILPPacketTypePrepare, packetBytes[0])
	}
}

func TestPacketToBase64IsURLSafe(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")
	condition := crypto.GenerateCondition([]byte("x"))

	packet := &ILPPacket{
		PacketType:         ILPPacketTypePrepare,
		Amount:             10000,
		Expiry:             time.Now().UTC().Add(30 * time.Second),
		ExecutionCondition: condition,
		Destination:        "g.bank-b.user-456",
		Data:               []byte(`{"test": "data"}`),
	}

	b64 := packet.ToBase64()

	// URL-safe base64 should not contain + or /
	if strings.Contains(b64, "+") || strings.Contains(b64, "/") {
		t.Error("Base64 encoding should be URL-safe (no + or /)")
	}
}

func TestAmountMismatchDetected(t *testing.T) {
	crypto := NewILPCryptoService("test-secret-key")

	fulfillment100 := crypto.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	fulfillment200 := crypto.GenerateFulfillment("tx-123", 20000, "bank-a", "bank-b")

	// Different amounts should produce different fulfillments
	if bytes.Equal(fulfillment100, fulfillment200) {
		t.Error("Different amounts should produce different fulfillments")
	}

	// Condition from $100 should not verify with $200 fulfillment
	condition100 := crypto.GenerateCondition(fulfillment100)
	if crypto.VerifyFulfillment(fulfillment200, condition100) {
		t.Error("Condition from $100 should not verify with $200 fulfillment")
	}
}

func TestDifferentSecretKeysProduceDifferentFulfillments(t *testing.T) {
	crypto1 := NewILPCryptoService("secret-key-1")
	crypto2 := NewILPCryptoService("secret-key-2")

	fulfillment1 := crypto1.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")
	fulfillment2 := crypto2.GenerateFulfillment("tx-123", 10000, "bank-a", "bank-b")

	if bytes.Equal(fulfillment1, fulfillment2) {
		t.Error("Different secret keys should produce different fulfillments")
	}
}

func TestCrossVerificationFails(t *testing.T) {
	crypto1 := NewILPCryptoService("secret-key-1")
	crypto2 := NewILPCryptoService("secret-key-2")

	fulfillment1, condition1 := crypto1.GenerateFulfillmentAndCondition("tx-123", 10000, "bank-a", "bank-b")
	fulfillment2, _ := crypto2.GenerateFulfillmentAndCondition("tx-123", 10000, "bank-a", "bank-b")

	// Fulfillment from crypto2 should not verify against condition from crypto1
	if crypto1.VerifyFulfillment(fulfillment2, condition1) {
		t.Error("Fulfillment from different key should not verify")
	}

	// But fulfillment1 should verify against condition1
	if !crypto1.VerifyFulfillment(fulfillment1, condition1) {
		t.Error("Fulfillment from same key should verify")
	}
}
