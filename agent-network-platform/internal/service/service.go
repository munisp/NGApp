package service

import (
	"agent-network-platform/internal/events"
	"agent-network-platform/internal/repository"
)

type Service struct {
	repo   *repository.AgentRepository
	events *events.EventPublisher
}

func NewService(repo *repository.AgentRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.AgentRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
