package db

import (
	"context"
	"database/sql"
	"time"

	"policy-imis-sync/internal/model"
)

type SyncStatusRepository struct {
	db *sql.DB
}

func NewSyncStatusRepository(db *sql.DB) *SyncStatusRepository {
	return &SyncStatusRepository{db: db}
}

func (r *SyncStatusRepository) SaveSyncStatus(ctx context.Context, status *model.SyncStatus) error {
	query := `
		INSERT INTO sync_status (policy_id, openimis_id, status, last_sync_at, error_message)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (policy_id) DO UPDATE SET
			openimis_id = EXCLUDED.openimis_id,
			status = EXCLUDED.status,
			last_sync_at = EXCLUDED.last_sync_at,
			error_message = EXCLUDED.error_message
	`
	_, err := r.db.ExecContext(ctx, query, status.PolicyID, status.OpenIMISID, status.Status, status.LastSyncAt, status.ErrorMessage)
	return err
}

func (r *SyncStatusRepository) GetSyncStatus(ctx context.Context, policyID string) (*model.SyncStatus, error) {
	query := `SELECT policy_id, openimis_id, status, last_sync_at, error_message FROM sync_status WHERE policy_id = $1`
	var status model.SyncStatus
	err := r.db.QueryRowContext(ctx, query, policyID).Scan(&status.PolicyID, &status.OpenIMISID, &status.Status, &status.LastSyncAt, &status.ErrorMessage)
	if err != nil {
		return nil, err
	}
	return &status, nil
}

func (r *SyncStatusRepository) GetPendingSyncStatuses(ctx context.Context) ([]model.SyncStatus, error) {
	query := `SELECT policy_id, openimis_id, status, last_sync_at, error_message FROM sync_status WHERE status = 'pending'`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var statuses []model.SyncStatus
	for rows.Next() {
		var s model.SyncStatus
		if err := rows.Scan(&s.PolicyID, &s.OpenIMISID, &s.Status, &s.LastSyncAt, &s.ErrorMessage); err != nil {
			return nil, err
		}
		statuses = append(statuses, s)
	}
	return statuses, nil
}

func (r *SyncStatusRepository) UpdateSyncStatus(ctx context.Context, policyID, status string) error {
	query := `UPDATE sync_status SET status = $1, last_sync_at = $2 WHERE policy_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, time.Now(), policyID)
	return err
}
