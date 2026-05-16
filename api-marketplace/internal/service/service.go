package service

import (
	"api-marketplace/internal/models"
	"api-marketplace/internal/repository"
	"fmt"
)

type MarketplaceService struct { repo *repository.MarketplaceRepository }
func NewMarketplaceService(repo *repository.MarketplaceRepository) *MarketplaceService { return &MarketplaceService{repo: repo} }

func (s *MarketplaceService) GetProducts(category string) []models.APIProduct { return s.repo.GetProducts(category) }
func (s *MarketplaceService) GetProduct(id string) (*models.APIProduct, error) { return s.repo.GetProduct(id) }

type SubscribeRequest struct {
	TenantID  string `json:"tenant_id"`
	ProductID string `json:"product_id"`
	Plan      string `json:"plan"`
}

func (s *MarketplaceService) Subscribe(req SubscribeRequest) (*models.Subscription, error) {
	if req.TenantID == "" || req.ProductID == "" {
		return nil, fmt.Errorf("tenant_id and product_id are required")
	}
	if req.Plan == "" { req.Plan = "starter" }
	return s.repo.Subscribe(req.TenantID, req.ProductID, req.Plan)
}

func (s *MarketplaceService) GetSubscriptions(tenantID string) []models.Subscription { return s.repo.GetSubscriptions(tenantID) }
func (s *MarketplaceService) GetStats() map[string]interface{} { return s.repo.GetStats() }
