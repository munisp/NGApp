package models

import "time"

type APIProduct struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Version     string    `json:"version"`
	Category    string    `json:"category"`
	Provider    string    `json:"provider"`
	BaseURL     string    `json:"base_url"`
	DocsURL     string    `json:"docs_url"`
	Pricing     string    `json:"pricing"`
	RateLimit   int       `json:"rate_limit_per_min"`
	Status      string    `json:"status"`
	Subscribers int       `json:"subscribers"`
	Endpoints   []APIEndpoint `json:"endpoints"`
	CreatedAt   time.Time `json:"created_at"`
}

type APIEndpoint struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
}

type Subscription struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenant_id"`
	ProductID  string    `json:"product_id"`
	APIKey     string    `json:"api_key"`
	Plan       string    `json:"plan"`
	Status     string    `json:"status"`
	CallsUsed  int       `json:"calls_used"`
	CallsLimit int       `json:"calls_limit"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}
