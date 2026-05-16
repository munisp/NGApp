package service

import (
	"multi-tenant-platform/internal/events"
	"multi-tenant-platform/internal/repository"
)

type Service struct {
	repo   *repository.TenantRepository
	events *events.EventPublisher
}

func NewService(repo *repository.TenantRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.TenantRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
