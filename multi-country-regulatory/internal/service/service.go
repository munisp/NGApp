package service

import (
	"multi-country-regulatory/internal/events"
	"multi-country-regulatory/internal/repository"
)

type Service struct {
	repo   *repository.RegulatoryRepository
	events *events.EventPublisher
}

func NewService(repo *repository.RegulatoryRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.RegulatoryRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
