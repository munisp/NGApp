package service

import (
	"usage-based-insurance/internal/events"
	"usage-based-insurance/internal/repository"
)

type Service struct {
	repo   *repository.UBIRepository
	events *events.EventPublisher
}

func NewService(repo *repository.UBIRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.UBIRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
