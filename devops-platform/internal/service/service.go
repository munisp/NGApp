package service

import (
	"devops-platform/internal/events"
	"devops-platform/internal/repository"
)

type Service struct {
	repo   *repository.DevOpsRepository
	events *events.EventPublisher
}

func NewService(repo *repository.DevOpsRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.DevOpsRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
