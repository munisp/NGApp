package service

import (
	"ussd-gateway/internal/events"
	"ussd-gateway/internal/repository"
)

type Service struct {
	repo   *repository.USSDRepository
	events *events.EventPublisher
}

func NewService(repo *repository.USSDRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.USSDRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
