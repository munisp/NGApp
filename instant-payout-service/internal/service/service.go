package service

import (
	"instant-payout-service/internal/events"
	"instant-payout-service/internal/repository"
)

type Service struct {
	repo   *repository.PayoutRepository
	events *events.EventPublisher
}

func NewService(repo *repository.PayoutRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.PayoutRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
