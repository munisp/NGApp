package models

import "time"

type Tenant struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	Domain          string    `json:"domain,omitempty"`
	Plan            string    `json:"plan"`
	Status          string    `json:"status"`
	Country         string    `json:"country"`
	Currency        string    `json:"currency"`
	RegulatorID     string    `json:"regulator_id,omitempty"`
	MaxUsers        int       `json:"max_users"`
	MaxPolicies     int       `json:"max_policies"`
	CurrentUsers    int       `json:"current_users"`
	CurrentPolicies int       `json:"current_policies"`
	StorageUsedMB   int       `json:"storage_used_mb"`
	StorageLimitMB  int       `json:"storage_limit_mb"`
	Features        []string  `json:"features"`
	Settings        map[string]string `json:"settings,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type TenantUser struct {
	ID       string    `json:"id"`
	TenantID string    `json:"tenant_id"`
	Email    string    `json:"email"`
	Name     string    `json:"name"`
	Role     string    `json:"role"`
	Status   string    `json:"status"`
	JoinedAt time.Time `json:"joined_at"`
}

type UsageRecord struct {
	TenantID    string    `json:"tenant_id"`
	Period      string    `json:"period"`
	APICallsCount int     `json:"api_calls"`
	PoliciesCreated int   `json:"policies_created"`
	ClaimsProcessed int   `json:"claims_processed"`
	StorageDeltaMB  int   `json:"storage_delta_mb"`
	RecordedAt  time.Time `json:"recorded_at"`
}
