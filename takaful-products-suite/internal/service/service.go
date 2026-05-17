package service

import (
	"fmt"
	"takaful-products-suite/internal/models"
	"takaful-products-suite/internal/repository"
	"time"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProducts() []models.TakafulProduct     { return s.repo.GetProducts() }
func (s *Service) GetProduct(id string) *models.TakafulProduct { return s.repo.GetProduct(id) }
func (s *Service) GetPools() []models.TakafulPool            { return s.repo.GetPools() }
func (s *Service) GetPool(id string) *models.TakafulPool     { return s.repo.GetPool(id) }
func (s *Service) GetMemberships() []models.TakafulMembership { return s.repo.GetMemberships() }

func (s *Service) JoinPool(productID, memberName, memberID string) (*models.TakafulMembership, error) {
	product := s.repo.GetProduct(productID)
	if product == nil {
		return nil, fmt.Errorf("product not found: %s", productID)
	}
	if !product.IsActive || !product.ShariaApproved {
		return nil, fmt.Errorf("product %s not available", productID)
	}
	wakalaFee := product.ContributionNGN * product.WakalaFeePct / 100
	netContribution := product.ContributionNGN - wakalaFee
	_ = netContribution
	m := &models.TakafulMembership{
		ID:               fmt.Sprintf("TKM-%d", time.Now().UnixNano()%1000000000),
		ProductID:        productID,
		MemberName:       memberName,
		MemberID:         memberID,
		ContributionPaid: product.ContributionNGN,
		PoolID:           product.PoolID,
		Status:           "active",
		JoinedAt:         time.Now(),
	}
	s.repo.CreateMembership(m)
	return m, nil
}

func (s *Service) DistributeSurplus(poolID string) (*models.SurplusDistribution, error) {
	pool := s.repo.GetPool(poolID)
	if pool == nil {
		return nil, fmt.Errorf("pool not found: %s", poolID)
	}
	if pool.Surplus <= 0 || pool.MemberCount == 0 {
		return nil, fmt.Errorf("no surplus to distribute")
	}
	perMember := pool.Surplus / float64(pool.MemberCount)
	return &models.SurplusDistribution{
		PoolID:         poolID,
		TotalSurplus:   pool.Surplus,
		MemberCount:    pool.MemberCount,
		PerMemberShare: perMember,
		DistributedAt:  time.Now(),
	}, nil
}

func (s *Service) CheckShariaCompliance(productID string) *models.ShariaCompliance {
	product := s.repo.GetProduct(productID)
	if product == nil {
		return &models.ShariaCompliance{ProductID: productID, IsCompliant: false, BoardApproval: "not_found"}
	}
	return &models.ShariaCompliance{
		ProductID:   productID,
		IsCompliant: product.ShariaApproved,
		Principles: []string{
			"tabarru_donation_principle",
			"gharar_uncertainty_minimized",
			"maysir_gambling_prohibited",
			"riba_interest_free",
			"mudharabah_profit_sharing",
			"wakala_agency_fee_transparent",
		},
		BoardApproval: "approved",
		ReviewDate:    "2026-01-15",
	}
}
