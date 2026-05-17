package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"cession-management-service/internal/model"
)

type CessionService struct {
	treaties []model.Treaty
	cessions []model.Cession
}

func NewCessionService() *CessionService {
	return &CessionService{
		treaties: []model.Treaty{},
		cessions: []model.Cession{},
	}
}

func (s *CessionService) CreateTreaty(ctx context.Context, treaty model.Treaty) (*model.Treaty, error) {
	if treaty.RetentionPct < 0 || treaty.RetentionPct > 100 {
		return nil, fmt.Errorf("retention percentage must be between 0 and 100")
	}
	treaty.ID = fmt.Sprintf("TRT-%d", time.Now().UnixNano()%1000000)
	treaty.Status = "active"
	treaty.CreatedAt = time.Now()
	s.treaties = append(s.treaties, treaty)
	return &treaty, nil
}

func (s *CessionService) CalculateCession(ctx context.Context, policyID string, premium float64, sumAssured float64) (*model.Cession, error) {
	if len(s.treaties) == 0 {
		return nil, fmt.Errorf("no active treaties available")
	}
	treaty := s.treaties[0]
	retainedPremium := premium * (treaty.RetentionPct / 100)
	cededPremium := premium - retainedPremium
	retainedRisk := sumAssured * (treaty.RetentionPct / 100)
	cededRisk := sumAssured - retainedRisk
	commission := cededPremium * 0.25

	cession := model.Cession{
		ID:              fmt.Sprintf("CES-%d", time.Now().UnixNano()%1000000),
		TreatyID:        treaty.ID,
		PolicyID:        policyID,
		CededPremium:    math.Round(cededPremium*100) / 100,
		RetainedPremium: math.Round(retainedPremium*100) / 100,
		CededRisk:       math.Round(cededRisk*100) / 100,
		RetainedRisk:    math.Round(retainedRisk*100) / 100,
		Commission:      math.Round(commission*100) / 100,
		Status:          "calculated",
		CreatedAt:       time.Now(),
	}
	s.cessions = append(s.cessions, cession)
	return &cession, nil
}

func (s *CessionService) GetCessions(ctx context.Context, treatyID string) ([]model.Cession, error) {
	var result []model.Cession
	for _, c := range s.cessions {
		if treatyID == "" || c.TreatyID == treatyID {
			result = append(result, c)
		}
	}
	return result, nil
}

func (s *CessionService) GetTreaties(ctx context.Context) ([]model.Treaty, error) {
	return s.treaties, nil
}
