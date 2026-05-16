package service

import (
	"takaful-module/internal/events"
	"takaful-module/internal/repository"
)

type Service struct {
	repo   *repository.TakafulRepository
	events *events.EventPublisher
}

func NewService(repo *repository.TakafulRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.TakafulRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
