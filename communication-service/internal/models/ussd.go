package models

import "time"

// USSDSession represents an active USSD session
type USSDSession struct {
	SessionID   string                 `json:"session_id"`
	PhoneNumber string                 `json:"phone_number"`
	CurrentMenu string                 `json:"current_menu"`
	State       map[string]interface{} `json:"state"` // Store user selections
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	ExpiresAt   time.Time              `json:"expires_at"`
}

// USSDRequest represents an incoming USSD request
type USSDRequest struct {
	SessionID   string `json:"session_id"`
	PhoneNumber string `json:"phone_number"`
	ServiceCode string `json:"service_code"` // e.g., *123#
	Text        string `json:"text"`         // User input
	NetworkCode string `json:"network_code"` // e.g., MTN, Airtel
}

// USSDResponse represents a USSD response
type USSDResponse struct {
	Message  string       `json:"message"`
	Type     USSDType     `json:"type"`
	Continue bool         `json:"continue"` // true = CON, false = END
}

// USSDType represents the type of USSD response
type USSDType string

const (
	USSDTypeContinue USSDType = "CON" // Continue session
	USSDTypeEnd      USSDType = "END" // End session
)

// USSDMenu represents a menu in the USSD flow
type USSDMenu struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Options     []USSDOption      `json:"options"`
	InputType   USSDInputType     `json:"input_type"`
	Validation  string            `json:"validation,omitempty"`
	ErrorMsg    string            `json:"error_msg,omitempty"`
	NextMenu    string            `json:"next_menu,omitempty"`
	Action      string            `json:"action,omitempty"` // e.g., "check_balance", "make_payment"
}

// USSDOption represents an option in a USSD menu
type USSDOption struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	NextMenu string `json:"next_menu,omitempty"`
	Action   string `json:"action,omitempty"`
}

// USSDInputType represents the type of input expected
type USSDInputType string

const (
	USSDInputTypeMenu   USSDInputType = "menu"   // Select from options
	USSDInputTypeText   USSDInputType = "text"   // Free text input
	USSDInputTypeNumber USSDInputType = "number" // Numeric input
	USSDInputTypeNone   USSDInputType = "none"   // Display only
)
