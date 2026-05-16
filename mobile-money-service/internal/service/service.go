package service

import (
	"mobile-money-service/internal/events"
	"mobile-money-service/internal/repository"
)

type Service struct {
	repo   *repository.MoMoRepository
	events *events.EventPublisher
}

func NewService(repo *repository.MoMoRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.MoMoRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
