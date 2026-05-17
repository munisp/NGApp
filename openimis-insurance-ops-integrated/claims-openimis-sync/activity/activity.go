package activity

import (
	"context"
	"fmt"
	"log"
	"time"

	"claims-openimis-sync/client"
	"claims-openimis-sync/model"
)

type Activities struct {
	openIMISClient *client.OpenIMISClient
	claimsClient   *client.ClaimsServiceClient
}

func NewActivities(openIMISClient *client.OpenIMISClient, claimsClient *client.ClaimsServiceClient) *Activities {
	return &Activities{
		openIMISClient: openIMISClient,
		claimsClient:   claimsClient,
	}
}

func (a *Activities) FetchPendingClaimsActivity(ctx context.Context) ([]model.Claim, error) {
	log.Println("Fetching pending claims for sync...")
	claims, err := a.claimsClient.GetPendingSyncClaims(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pending claims: %w", err)
	}
	log.Printf("Found %d pending claims", len(claims))
	return claims, nil
}

func (a *Activities) SyncClaimToOpenIMISActivity(ctx context.Context, claim model.Claim) (*model.SyncResult, error) {
	log.Printf("Syncing claim %s to OpenIMIS...", claim.ID)
	
	openIMISClaim, err := a.openIMISClient.CreateClaim(ctx, &claim)
	if err != nil {
		return &model.SyncResult{
			ClaimID:      claim.ID,
			Status:       "failed",
			ErrorMessage: err.Error(),
			SyncedAt:     time.Now(),
		}, nil
	}

	if err := a.claimsClient.UpdateSyncStatus(ctx, claim.ID, openIMISClaim.UUID, "synced"); err != nil {
		log.Printf("Warning: failed to update sync status for claim %s: %v", claim.ID, err)
	}

	return &model.SyncResult{
		ClaimID:    claim.ID,
		OpenIMISID: openIMISClaim.UUID,
		Status:     "synced",
		SyncedAt:   time.Now(),
	}, nil
}

func (a *Activities) UpdateClaimStatusActivity(ctx context.Context, claimID, openIMISID string, status int) error {
	log.Printf("Updating claim %s status in OpenIMIS to %d...", claimID, status)
	return a.openIMISClient.UpdateClaimStatus(ctx, openIMISID, status)
}

func (a *Activities) GetOpenIMISClaimActivity(ctx context.Context, openIMISID string) (*model.OpenIMISClaim, error) {
	log.Printf("Fetching claim %s from OpenIMIS...", openIMISID)
	return a.openIMISClient.GetClaim(ctx, openIMISID)
}
