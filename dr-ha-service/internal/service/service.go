package service

import (
	"dr-ha-service/internal/events"
	"dr-ha-service/internal/repository"
)

type Service struct {
	repo   *repository.DRRepository
	events *events.EventPublisher
}

func NewService(repo *repository.DRRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.DRRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
