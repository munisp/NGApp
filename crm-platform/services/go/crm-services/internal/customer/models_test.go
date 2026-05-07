package models

import (
	"testing"
)

func TestCustomerStatus_Valid(t *testing.T) {
	tests := []struct {
		name   string
		status CustomerStatus
		want   string
	}{
		{"active", CustomerStatusActive, "active"},
		{"inactive", CustomerStatusInactive, "inactive"},
		{"suspended", CustomerStatusSuspended, "suspended"},
		{"closed", CustomerStatusClosed, "closed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.status) != tt.want {
				t.Errorf("CustomerStatus = %q, want %q", tt.status, tt.want)
			}
		})
	}
}

func TestCustomerTier_Valid(t *testing.T) {
	tests := []struct {
		name string
		tier CustomerTier
		want string
	}{
		{"bronze", CustomerTierBronze, "bronze"},
		{"silver", CustomerTierSilver, "silver"},
		{"gold", CustomerTierGold, "gold"},
		{"platinum", CustomerTierPlatinum, "platinum"},
		{"diamond", CustomerTierDiamond, "diamond"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.tier) != tt.want {
				t.Errorf("CustomerTier = %q, want %q", tt.tier, tt.want)
			}
		})
	}
}

func TestKYCStatus_Valid(t *testing.T) {
	tests := []struct {
		name   string
		status KYCStatus
		want   string
	}{
		{"pending", KYCStatusPending, "pending"},
		{"in_review", KYCStatusInReview, "in_review"},
		{"approved", KYCStatusApproved, "approved"},
		{"rejected", KYCStatusRejected, "rejected"},
		{"expired", KYCStatusExpired, "expired"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.status) != tt.want {
				t.Errorf("KYCStatus = %q, want %q", tt.status, tt.want)
			}
		})
	}
}

func TestCustomerSegmentType_Valid(t *testing.T) {
	tests := []struct {
		name string
		st   SegmentType
		want string
	}{
		{"demographic", SegmentTypeDemographic, "demographic"},
		{"behavioral", SegmentTypeBehavioral, "behavioral"},
		{"geographic", SegmentTypeGeographic, "geographic"},
		{"psychographic", SegmentTypePsychographic, "psychographic"},
		{"value", SegmentTypeValue, "value"},
		{"lifecycle", SegmentTypeLifecycle, "lifecycle"},
		{"custom", SegmentTypeCustom, "custom"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.st) != tt.want {
				t.Errorf("SegmentType = %q, want %q", tt.st, tt.want)
			}
		})
	}
}

func TestInteractionType_Valid(t *testing.T) {
	tests := []struct {
		name string
		it   InteractionType
		want string
	}{
		{"call", InteractionTypeCall, "call"},
		{"email", InteractionTypeEmail, "email"},
		{"sms", InteractionTypeSMS, "sms"},
		{"chat", InteractionTypeChat, "chat"},
		{"meeting", InteractionTypeMeeting, "meeting"},
		{"support", InteractionTypeSupport, "support"},
		{"sales", InteractionTypeSales, "sales"},
		{"marketing", InteractionTypeMarketing, "marketing"},
		{"complaint", InteractionTypeComplaint, "complaint"},
		{"feedback", InteractionTypeFeedback, "feedback"},
		{"onboarding", InteractionTypeOnboarding, "onboarding"},
		{"transaction", InteractionTypeTransaction, "transaction"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.it) != tt.want {
				t.Errorf("InteractionType = %q, want %q", tt.it, tt.want)
			}
		})
	}
}
