package activity

import (
	"context"

	"policy-imis-sync/internal/model"
	"policy-imis-sync/internal/service"
)

type Activities struct {
	syncService *service.PolicySyncService
}

func NewActivities(syncService *service.PolicySyncService) *Activities {
	return &Activities{syncService: syncService}
}

func (a *Activities) SyncPolicyActivity(ctx context.Context, policy model.Policy) (*model.SyncStatus, error) {
	return a.syncService.SyncPolicy(ctx, &policy)
}

func (a *Activities) SyncPendingPoliciesActivity(ctx context.Context) ([]model.SyncStatus, error) {
	return a.syncService.SyncPendingPolicies(ctx)
}
