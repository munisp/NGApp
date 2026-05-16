package service

import (
	"api-marketplace/internal/events"
	"api-marketplace/internal/repository"
)

type Service struct {
	repo   *repository.MarketplaceRepository
	events *events.EventPublisher
}

func NewService(repo *repository.MarketplaceRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.MarketplaceRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
