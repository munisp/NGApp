package service

import (
	"microinsurance-engine/internal/events"
	"microinsurance-engine/internal/repository"
)

type Service struct {
	repo   *repository.MicroRepository
	events *events.EventPublisher
}

func NewService(repo *repository.MicroRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.MicroRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
