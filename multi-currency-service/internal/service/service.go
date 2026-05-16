package service

import (
	"multi-currency-service/internal/events"
	"multi-currency-service/internal/repository"
)

type Service struct {
	repo   *repository.CurrencyRepository
	events *events.EventPublisher
}

func NewService(repo *repository.CurrencyRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.CurrencyRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
