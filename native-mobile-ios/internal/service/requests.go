package service

type RegisterUserRequest struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	BVN             string `json:"bvn"`
	DeviceModel     string `json:"device_model"`
	OSVersion       string `json:"os_version"`
	AppVersion      string `json:"app_version"`
	PushToken       string `json:"push_token"`
}

type SubmitClaimRequest struct {
	UserRef       string                 `json:"user_ref"`
	PolicyNumber  string                 `json:"policy_number"`
	ClaimType     string                 `json:"claim_type"`
	Description   string                 `json:"description"`
	AmountClaimed float64                `json:"amount_claimed"`
	Documents     map[string]interface{} `json:"documents"`
}

type MakePaymentRequest struct {
	UserRef        string  `json:"user_ref"`
	PolicyNumber   string  `json:"policy_number"`
	Amount         float64 `json:"amount"`
	PaymentMethod  string  `json:"payment_method"`
	TransactionRef string  `json:"transaction_ref"`
}

type UpdatePrefsRequest struct {
	BiometricEnabled  *bool                  `json:"biometric_enabled"`
	NotificationPrefs map[string]interface{} `json:"notification_prefs"`
	PushToken         string                 `json:"push_token"`
}
