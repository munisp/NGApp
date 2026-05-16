package service

import (
	"multi-language-service/internal/events"
	"multi-language-service/internal/repository"
)

type Service struct {
	repo   *repository.I18nRepository
	events *events.EventPublisher
}

func NewService(repo *repository.I18nRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.I18nRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
