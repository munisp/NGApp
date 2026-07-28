package activity

import (
	"context"
	"time"

	"claims-openimis-sync/client"
	"claims-openimis-sync/model"
)

// Activities holds the clients required for all activities.
type Activities struct {
	ClaimsClient client.ClaimsClient
	OpenIMISClient client.OpenIMISClient
}

// NewActivities creates a new Activities struct.
func NewActivities(claimsClient client.ClaimsClient, openIMISClient client.OpenIMISClient) *Activities {
	return &Activities{
		ClaimsClient: claimsClient,
		OpenIMISClient: openIMISClient,
	}
}

// SyncClaimsToOpenIMIS fetches claims from the Claims service and syncs them to OpenIMIS.
func (a *Activities) SyncClaimsToOpenIMIS(ctx context.Context) ([]model.SyncStatus, error) {
	log.Info("Starting SyncClaimsToOpenIMIS activity")
	start := time.Now()
	defer func() {
		syncDuration.Observe(time.Since(start).Seconds())
	}()

	claims, err := a.ClaimsClient.GetClaimsForSync(ctx)
	if err != nil {
		log.WithError(err).Error("Failed to get claims for sync")
		return nil, err
	}

	var statuses []model.SyncStatus
	for _, claim := range claims {
		openIMISClaim := model.OpenIMISClaim{
			ClaimUUID: claim.ID,
			InsureeID: "MOCK_INSUREE_ID", // Mocked data
			ClaimDate: time.Now(),
			TotalAmount: claim.ClaimAmount,
			Status: "PENDING",
			ExternalRefID: claim.ID,
		}

		err := a.OpenIMISClient.SyncClaim(ctx, openIMISClaim)
		status := model.SyncStatus{
			ClaimID: claim.ID,
			LastSyncTime: time.Now(),
			Status: "COMPLETED",
		}

		if err != nil {
			log.WithError(err).WithField("claim_id", claim.ID).Error("Failed to sync claim to OpenIMIS")
			status.Status = "FAILED"
			status.ErrorMessage = err.Error()
		} else {
			claimsSynced.Inc()
		}
		statuses = append(statuses, status)
	}

	log.WithField("count", len(claims)).Info("Finished SyncClaimsToOpenIMIS activity")
	return statuses, nil
}

// ReverseSyncReserveAdjustments fetches reserve adjustments from OpenIMIS and applies them to the Claims service.
func (a *Activities) ReverseSyncReserveAdjustments(ctx context.Context) ([]model.SyncStatus, error) {
	log.Info("Starting ReverseSyncReserveAdjustments activity")
	adjustments, err := a.OpenIMISClient.GetReserveAdjustments(ctx)
	if err != nil {
		log.WithError(err).Error("Failed to get reserve adjustments from OpenIMIS")
		return nil, err
	}

	var statuses []model.SyncStatus
	for _, adj := range adjustments {
		err := a.ClaimsClient.AdjustReserve(ctx, adj)
		status := model.SyncStatus{
			ClaimID: adj.ClaimUUID,
			LastSyncTime: time.Now(),
			Status: "COMPLETED",
		}

		if err != nil {
			log.WithError(err).WithField("claim_id", adj.ClaimUUID).Error("Failed to apply reserve adjustment to Claims service")
			status.Status = "FAILED"
			status.ErrorMessage = err.Error()
		} else {
			reserveAdjustmentsApplied.Inc()
		}
		statuses = append(statuses, status)
	}

	log.WithField("count", len(adjustments)).Info("Finished ReverseSyncReserveAdjustments activity")
	return statuses, nil
}

// ReconcileLossRatio calculates and updates the loss ratio for a given policy.
func (a *Activities) ReconcileLossRatio(ctx context.Context, policyID string) (model.LossRatioUpdate, error) {
	log.WithField("policy_id", policyID).Info("Starting ReconcileLossRatio activity")

	totalClaims, totalPremium, err := a.OpenIMISClient.GetPolicyDataForLossRatio(ctx, policyID)
	if err != nil {
		log.WithError(err).WithField("policy_id", policyID).Error("Failed to get policy data for loss ratio")
		return model.LossRatioUpdate{}, err
	}

	var lossRatio float64
	if totalPremium > 0 {
		lossRatio = totalClaims / totalPremium
	}

	update := model.LossRatioUpdate{
		PolicyID: policyID,
		TotalClaims: totalClaims,
		TotalPremium: totalPremium,
		LossRatio: lossRatio,
		CalculationDate: time.Now(),
	}

	err = a.ClaimsClient.UpdateLossRatio(ctx, update)
	if err != nil {
		log.WithError(err).WithField("policy_id", policyID).Error("Failed to update loss ratio in Claims service")
		return model.LossRatioUpdate{}, err
	}

	lossRatioUpdates.Inc()
	log.WithField("policy_id", policyID).WithField("loss_ratio", lossRatio).Info("Finished ReconcileLossRatio activity")
	return update, nil
}
