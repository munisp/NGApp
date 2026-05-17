package openimis

// PremiumCalculationRequest represents the payload sent to the OpenIMIS premium calculator API.
type PremiumCalculationRequest struct {
	PolicyID      string   `json:"policy_id"`
	EnrollmentDate string   `json:"enrollment_date"`
	FamilyMembers []Member `json:"family_members"`
	SchemeID      string   `json:"scheme_id"`
	// Add other necessary fields for premium calculation
}

// Member represents a family member in the request.
type Member struct {
	MemberID string `json:"member_id"`
	Age      int    `json:"age"`
	Gender   string `json:"gender"`
	// Add other member-specific fields
}

// PremiumCalculationResponse represents the response from the OpenIMIS premium calculator API.
type PremiumCalculationResponse struct {
	CalculatedPremium float64 `json:"calculated_premium"`
	Currency          string  `json:"currency"`
	ValidationStatus  string  `json:"validation_status"` // e.g., "OK", "ERROR"
	ErrorDetails      string  `json:"error_details,omitempty"`
}
