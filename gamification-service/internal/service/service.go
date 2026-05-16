package service

import (
	"gamification-service/internal/events"
	"gamification-service/internal/repository"
)

type Service struct {
	repo   *repository.GamificationRepository
	events *events.EventPublisher
}

func NewService(repo *repository.GamificationRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.GamificationRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
