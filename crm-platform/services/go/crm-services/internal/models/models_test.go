package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMessageStatus_Constants(t *testing.T) {
	assert.Equal(t, MessageStatus("sent"), MessageStatusSent)
	assert.Equal(t, MessageStatus("delivered"), MessageStatusDelivered)
	assert.Equal(t, MessageStatus("read"), MessageStatusRead)
	assert.Equal(t, MessageStatus("failed"), MessageStatusFailed)
}

func TestMessageDirection_Constants(t *testing.T) {
	assert.Equal(t, MessageDirection("inbound"), MessageDirectionInbound)
	assert.Equal(t, MessageDirection("outbound"), MessageDirectionOutbound)
}

func TestConversationStatus_Constants(t *testing.T) {
	assert.Equal(t, ConversationStatus("active"), ConversationStatusActive)
	assert.Equal(t, ConversationStatus("closed"), ConversationStatusClosed)
}

func TestCustomer_Fields(t *testing.T) {
	c := Customer{
		ID:       "cust-1",
		TenantID: "tenant-1",
		FullName: "John Doe",
		Email:    "john@example.com",
		Phone:    "+2348012345678",
	}
	assert.Equal(t, "cust-1", c.ID)
	assert.Equal(t, "tenant-1", c.TenantID)
	assert.Equal(t, "john@example.com", c.Email)
	assert.Equal(t, "John Doe", c.FullName)
}

func TestTransaction_Fields(t *testing.T) {
	tx := Transaction{
		ID:        "tx-1",
		TenantID:  "t1",
		AccountID: "acc-1",
		Type:      "transfer",
		Amount:    50000.0,
		Currency:  "NGN",
		Status:    "completed",
		CreatedAt: time.Now(),
	}
	assert.Equal(t, "tx-1", tx.ID)
	assert.Equal(t, 50000.0, tx.Amount)
	assert.Equal(t, "NGN", tx.Currency)
}

func TestFraudAlert_Fields(t *testing.T) {
	alert := FraudAlert{
		ID:          "alert-1",
		RuleID:      "rule-1",
		Severity:    "critical",
		Description: "Large transaction detected",
		Score:       8.5,
	}
	assert.Equal(t, "critical", alert.Severity)
	assert.Equal(t, 8.5, alert.Score)
}

func TestFraudDetectionRule_Fields(t *testing.T) {
	rule := FraudDetectionRule{
		ID:          "rule-1",
		Name:        "High Amount",
		Description: "Detects transactions above threshold",
		Severity:    "high",
		Threshold:   100000,
		Enabled:     true,
	}
	assert.True(t, rule.Enabled)
	assert.Equal(t, 100000.0, rule.Threshold)
}

func TestMLPrediction_Fields(t *testing.T) {
	pred := MLPrediction{
		ModelName: "churn_v2",
	}
	assert.Equal(t, "churn_v2", pred.ModelName)
}

func TestMessage_Fields(t *testing.T) {
	msg := Message{
		ID:        "msg-1",
		TenantID:  "t1",
		Status:    MessageStatusSent,
		Direction: MessageDirectionOutbound,
		Content:   "Hello, how can I help?",
	}
	assert.Equal(t, MessageStatusSent, msg.Status)
	assert.Equal(t, MessageDirectionOutbound, msg.Direction)
}
