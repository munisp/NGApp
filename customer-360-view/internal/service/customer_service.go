package service

import (
	"context"
	"customer-360-view/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CustomerService struct {
	db *gorm.DB
}

func NewCustomerService(db *gorm.DB) *CustomerService {
	return &CustomerService{db: db}
}

func (s *CustomerService) GetCustomer360(ctx context.Context, customerID uuid.UUID) (map[string]interface{}, error) {
	var profile models.CustomerProfile
	if err := s.db.WithContext(ctx).First(&profile, "id = ?", customerID).Error; err != nil {
		return nil, err
	}

	var policies []models.CustomerPolicy
	s.db.WithContext(ctx).Where("customer_id = ?", customerID).Find(&policies)

	var claims []models.CustomerClaim
	s.db.WithContext(ctx).Where("customer_id = ?", customerID).Find(&claims)

	var interactions []models.CustomerInteraction
	s.db.WithContext(ctx).Where("customer_id = ?", customerID).Order("created_at DESC").Limit(10).Find(&interactions)

	var preferences models.CustomerPreference
	s.db.WithContext(ctx).Where("customer_id = ?", customerID).First(&preferences)

	return map[string]interface{}{
		"profile":      profile,
		"policies":     policies,
		"claims":       claims,
		"interactions": interactions,
		"preferences":  preferences,
		"summary": map[string]interface{}{
			"total_policies":     len(policies),
			"total_claims":       len(claims),
			"lifetime_value":     profile.LifetimeValue,
			"risk_score":         profile.RiskScore,
			"customer_segment":   profile.Segment,
		},
	}, nil
}

func (s *CustomerService) CreateCustomer(ctx context.Context, profile *models.CustomerProfile) error {
	profile.ID = uuid.New()
	return s.db.WithContext(ctx).Create(profile).Error
}

func (s *CustomerService) UpdateCustomer(ctx context.Context, customerID uuid.UUID, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&models.CustomerProfile{}).Where("id = ?", customerID).Updates(updates).Error
}

func (s *CustomerService) LogInteraction(ctx context.Context, interaction *models.CustomerInteraction) error {
	interaction.ID = uuid.New()
	if err := s.db.WithContext(ctx).Create(interaction).Error; err != nil {
		return err
	}
	now := time.Now()
	return s.db.WithContext(ctx).Model(&models.CustomerProfile{}).Where("id = ?", interaction.CustomerID).Update("last_interaction_at", now).Error
}

func (s *CustomerService) GetInteractions(ctx context.Context, customerID uuid.UUID) ([]models.CustomerInteraction, error) {
	var interactions []models.CustomerInteraction
	err := s.db.WithContext(ctx).Where("customer_id = ?", customerID).Order("created_at DESC").Find(&interactions).Error
	return interactions, err
}

func (s *CustomerService) UpdatePreferences(ctx context.Context, customerID uuid.UUID, prefs *models.CustomerPreference) error {
	prefs.CustomerID = customerID
	return s.db.WithContext(ctx).Save(prefs).Error
}

func (s *CustomerService) CalculateLifetimeValue(ctx context.Context, customerID uuid.UUID) (float64, error) {
	var totalPremium float64
	s.db.Model(&models.CustomerPolicy{}).Where("customer_id = ?", customerID).Select("COALESCE(SUM(premium), 0)").Scan(&totalPremium)
	s.db.Model(&models.CustomerProfile{}).Where("id = ?", customerID).Update("lifetime_value", totalPremium)
	return totalPremium, nil
}

func (s *CustomerService) SegmentCustomers(ctx context.Context) error {
	s.db.Model(&models.CustomerProfile{}).Where("lifetime_value >= ?", 1000000).Update("segment", "PLATINUM")
	s.db.Model(&models.CustomerProfile{}).Where("lifetime_value >= ? AND lifetime_value < ?", 500000, 1000000).Update("segment", "GOLD")
	s.db.Model(&models.CustomerProfile{}).Where("lifetime_value >= ? AND lifetime_value < ?", 100000, 500000).Update("segment", "SILVER")
	s.db.Model(&models.CustomerProfile{}).Where("lifetime_value < ?", 100000).Update("segment", "BRONZE")
	return nil
}

func (s *CustomerService) SearchCustomers(ctx context.Context, query string) ([]models.CustomerProfile, error) {
	var customers []models.CustomerProfile
	searchPattern := "%" + query + "%"
	err := s.db.WithContext(ctx).Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR phone ILIKE ?", searchPattern, searchPattern, searchPattern, searchPattern).Find(&customers).Error
	return customers, err
}
