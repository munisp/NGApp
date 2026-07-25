package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/munisp/NGApp/api-marketplace/internal/store"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type MarketplaceService struct {
	store           *store.Store
	redis           *redis.Client
	kafkaWriter     *kafka.Writer
	apisixAdminURL  string
	tigerbeetleAddr string
	logger          *zap.Logger
}

type APIProduct struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Version     string   `json:"version"`
	Category    string   `json:"category"`
	BaseURL     string   `json:"base_url"`
	Endpoints   []Endpoint `json:"endpoints"`
	RateLimit   int      `json:"rate_limit_per_minute"`
	Pricing     Pricing  `json:"pricing"`
	Status      string   `json:"status"`
}

type Endpoint struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
	AuthRequired bool  `json:"auth_required"`
}

type Pricing struct {
	Model    string  `json:"model"` // free, per_call, tiered, subscription
	FreeQuota int    `json:"free_quota_per_month"`
	PricePerCall float64 `json:"price_per_call_ngn"`
}

type Developer struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Company   string    `json:"company"`
	APIKeys   []string  `json:"api_keys"`
	Plan      string    `json:"plan"`
	JoinedAt  time.Time `json:"joined_at"`
}

func NewMarketplaceService(s *store.Store, redisAddr, apisixURL, tbAddr string, logger *zap.Logger) *MarketplaceService {
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr, PoolSize: 10})
	writer := &kafka.Writer{
		Addr:    kafka.TCP("localhost:9092"),
		Topic:   "marketplace.events",
		Balancer: &kafka.LeastBytes{},
	}

	return &MarketplaceService{
		store:           s,
		redis:           rdb,
		kafkaWriter:     writer,
		apisixAdminURL:  apisixURL,
		tigerbeetleAddr: tbAddr,
		logger:          logger,
	}
}

func (s *MarketplaceService) ListProducts(ctx context.Context) []APIProduct {
	return []APIProduct{
		{
			ID: "motor-insurance-api", Name: "Motor Insurance API", Version: "v1",
			Category: "insurance", BaseURL: "/api/v1/motor",
			Description: "Issue, renew, and verify motor insurance policies. Integrates with NMID.",
			RateLimit: 100,
			Endpoints: []Endpoint{
				{Method: "POST", Path: "/quotes", Description: "Get motor insurance quote", AuthRequired: true},
				{Method: "POST", Path: "/policies", Description: "Issue new policy", AuthRequired: true},
				{Method: "GET", Path: "/policies/{id}", Description: "Get policy details", AuthRequired: true},
				{Method: "GET", Path: "/verify/{reg_number}", Description: "Verify vehicle insurance via NMID", AuthRequired: true},
			},
			Pricing: Pricing{Model: "per_call", FreeQuota: 1000, PricePerCall: 2.50},
			Status: "active",
		},
		{
			ID: "claims-api", Name: "Claims Processing API", Version: "v1",
			Category: "insurance", BaseURL: "/api/v1/claims",
			Description: "Submit and track insurance claims with AI-powered adjudication.",
			RateLimit: 50,
			Pricing: Pricing{Model: "per_call", FreeQuota: 500, PricePerCall: 5.00},
			Status: "active",
		},
		{
			ID: "kyc-verification-api", Name: "KYC/AML Verification API", Version: "v1",
			Category: "compliance", BaseURL: "/api/v1/kyc",
			Description: "BVN/NIN verification, AML screening, PEP checks via NAICOM guidelines.",
			RateLimit: 30,
			Pricing: Pricing{Model: "per_call", FreeQuota: 100, PricePerCall: 15.00},
			Status: "active",
		},
		{
			ID: "payments-api", Name: "Premium Payments API", Version: "v1",
			Category: "financial", BaseURL: "/api/v1/payments",
			Description: "Process premium payments, refunds, and reconciliation via TigerBeetle ledger.",
			RateLimit: 200,
			Pricing: Pricing{Model: "tiered", FreeQuota: 0, PricePerCall: 1.00},
			Status: "active",
		},
	}
}

func (s *MarketplaceService) GenerateAPIKey() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return "ag_live_" + hex.EncodeToString(bytes)
}

func (s *MarketplaceService) RecordAPICall(ctx context.Context, apiKey, productID, endpoint string, latencyMs int) {
	// Record usage to TigerBeetle for billing
	// Increment Redis counter for rate limiting
	s.redis.Incr(ctx, "usage:"+apiKey+":"+time.Now().Format("2006-01-02"))
}
