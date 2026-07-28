package service

import (
	"embedded-distribution-platform/internal/models"
	"embedded-distribution-platform/internal/repository"
	"fmt"
	"time"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetPartners() []models.Partner       { return s.repo.GetPartners() }
func (s *Service) GetPartner(id string) *models.Partner { return s.repo.GetPartner(id) }
func (s *Service) GetProducts() []models.EmbeddedProduct { return s.repo.GetProducts() }
func (s *Service) GetEnrollments() []models.Enrollment  { return s.repo.GetEnrollments() }

func (s *Service) Enroll(partnerID, productID, customerRef, customerName, txRef string) (*models.Enrollment, error) {
	partner := s.repo.GetPartner(partnerID)
	if partner == nil {
		return nil, fmt.Errorf("partner not found: %s", partnerID)
	}
	if !partner.IsActive {
		return nil, fmt.Errorf("partner %s is inactive", partnerID)
	}
	products := s.repo.GetProducts()
	var product *models.EmbeddedProduct
	for i, p := range products {
		if p.ID == productID {
			product = &products[i]
			break
		}
	}
	if product == nil {
		return nil, fmt.Errorf("product not found: %s", productID)
	}
	e := &models.Enrollment{
		ID:             fmt.Sprintf("ENR-%d", time.Now().UnixNano()%1000000000),
		PartnerID:      partnerID,
		ProductID:      productID,
		CustomerRef:    customerRef,
		CustomerName:   customerName,
		PremiumPaid:    product.PremiumNGN,
		Status:         "active",
		Channel:        string(partner.Channel),
		TransactionRef: txRef,
		CreatedAt:      time.Now(),
	}
	s.repo.CreateEnrollment(e)
	return e, nil
}

func (s *Service) GetRevenueShare(partnerID string) (*models.RevenueShare, error) {
	partner := s.repo.GetPartner(partnerID)
	if partner == nil {
		return nil, fmt.Errorf("partner not found: %s", partnerID)
	}
	enrollments := s.repo.GetEnrollmentsByPartner(partnerID)
	total := 0.0
	for _, e := range enrollments {
		total += e.PremiumPaid
	}
	commission := total * partner.CommissionPct / 100
	return &models.RevenueShare{
		PartnerID:     partnerID,
		TotalPremiums: total,
		Commission:    commission,
		NetToInsurer:  total - commission,
		Enrollments:   len(enrollments),
	}, nil
}
