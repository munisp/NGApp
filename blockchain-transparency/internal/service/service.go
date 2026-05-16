package service

import (
	"blockchain-transparency/internal/events"
	"blockchain-transparency/internal/repository"
)

type Service struct {
	repo   *repository.BlockchainRepository
	events *events.EventPublisher
}

func NewService(repo *repository.BlockchainRepository, events *events.EventPublisher) *Service {
	return &Service{
		repo:   repo,
		events: events,
	}
}

func (s *Service) Repo() *repository.BlockchainRepository {
	return s.repo
}

func (s *Service) Events() *events.EventPublisher {
	return s.events
}
