package service

import (
	"notification-service/internal/events"
	"notification-service/internal/repository"
)

type Service struct {
	repo   *repository.NotificationRepository
	events *events.EventPublisher
}

func NewService(repo *repository.NotificationRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.NotificationRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
