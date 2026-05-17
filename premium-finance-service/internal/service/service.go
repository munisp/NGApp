package service

import (
	"premium-finance-service/internal/events"
	"premium-finance-service/internal/repository"
)

type Service struct {
	repo   *repository.FinanceRepository
	events *events.EventPublisher
}

func NewService(repo *repository.FinanceRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.FinanceRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
