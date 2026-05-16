package service

import (
	"pan-african-ekyc/internal/events"
	"pan-african-ekyc/internal/repository"
)

type Service struct {
	repo   *repository.EKYCRepository
	events *events.EventPublisher
}

func NewService(repo *repository.EKYCRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.EKYCRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
