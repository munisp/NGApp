package service

import (
	"context"
	"log"
	"time"

	"policy-imis-sync/internal/client"
	"policy-imis-sync/internal/db"
	"policy-imis-sync/internal/model"
)

type PolicySyncService struct {
	openIMISClient *client.OpenIMISClient
	policyClient   *client.PolicyServiceClient
	syncRepo       *db.SyncStatusRepository
}

func NewPolicySyncService(openIMISClient *client.OpenIMISClient, policyClient *client.PolicyServiceClient, syncRepo *db.SyncStatusRepository) *PolicySyncService {
	return &PolicySyncService{
		openIMISClient: openIMISClient,
		policyClient:   policyClient,
		syncRepo:       syncRepo,
	}
}

func (s *PolicySyncService) SyncPolicy(ctx context.Context, policy *model.Policy) (*model.SyncStatus, error) {
	log.Printf("Syncing policy %s to OpenIMIS...", policy.ID)

	openIMISPolicy, err := s.openIMISClient.CreatePolicy(ctx, policy)
	if err != nil {
		status := &model.SyncStatus{
			PolicyID:     policy.ID,
			Status:       "failed",
			LastSyncAt:   time.Now(),
			ErrorMessage: err.Error(),
		}
		s.syncRepo.SaveSyncStatus(ctx, status)
		return status, err
	}

	status := &model.SyncStatus{
		PolicyID:   policy.ID,
		OpenIMISID: openIMISPolicy.UUID,
		Status:     "synced",
		LastSyncAt: time.Now(),
	}

	if err := s.syncRepo.SaveSyncStatus(ctx, status); err != nil {
		log.Printf("Warning: failed to save sync status: %v", err)
	}

	if err := s.policyClient.UpdateSyncStatus(ctx, policy.ID, openIMISPolicy.UUID, "synced"); err != nil {
		log.Printf("Warning: failed to update policy service: %v", err)
	}

	return status, nil
}

func (s *PolicySyncService) SyncPendingPolicies(ctx context.Context) ([]model.SyncStatus, error) {
	policies, err := s.policyClient.GetPendingPolicies(ctx)
	if err != nil {
		return nil, err
	}

	var results []model.SyncStatus
	for _, policy := range policies {
		status, _ := s.SyncPolicy(ctx, &policy)
		results = append(results, *status)
	}

	return results, nil
}
