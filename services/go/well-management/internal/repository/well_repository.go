// Package repository implements PostgreSQL-backed data access for wells.
// All queries use parameterized statements to prevent SQL injection.
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Well represents a single oil/gas well record.
type Well struct {
	WellID     string    `json:"well_id"`
	Name       string    `json:"name"`
	APINumber  *string   `json:"api_number,omitempty"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	DepthFt    *float64  `json:"depth_ft,omitempty"`
	Formation  *string   `json:"formation,omitempty"`
	OperatorID string    `json:"operator_id"`
	Status     string    `json:"status"`
	WellType   string    `json:"well_type"`
	SpudDate   *string   `json:"spud_date,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Equipment represents a piece of equipment installed on a well.
type Equipment struct {
	EquipmentID  string    `json:"equipment_id"`
	WellID       string    `json:"well_id"`
	Type         string    `json:"type"`
	Model        *string   `json:"model,omitempty"`
	SerialNumber *string   `json:"serial_number,omitempty"`
	Manufacturer *string   `json:"manufacturer,omitempty"`
	InstallDate  *string   `json:"install_date,omitempty"`
	Status       string    `json:"status"`
	LastService  *time.Time `json:"last_service,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Operator represents a tenant/operator company.
type Operator struct {
	OperatorID   string    `json:"operator_id"`
	Name         string    `json:"name"`
	Country      *string   `json:"country,omitempty"`
	ContactEmail *string   `json:"contact_email,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// WellFilter holds query parameters for listing wells.
type WellFilter struct {
	OperatorID string
	Status     string
	WellType   string
	Limit      int
	Offset     int
}

// WellRepository provides data access methods for wells.
type WellRepository struct {
	pool *pgxpool.Pool
}

// NewWellRepository creates a new repository backed by the given pool.
func NewWellRepository(pool *pgxpool.Pool) *WellRepository {
	return &WellRepository{pool: pool}
}

// ListWells returns wells matching the given filter, ordered by name.
func (r *WellRepository) ListWells(ctx context.Context, f WellFilter) ([]Well, int, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 500 {
		f.Limit = 500
	}

	// Build dynamic WHERE clause
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if f.OperatorID != "" {
		where += fmt.Sprintf(" AND operator_id = $%d", argIdx)
		args = append(args, f.OperatorID)
		argIdx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, f.Status)
		argIdx++
	}
	if f.WellType != "" {
		where += fmt.Sprintf(" AND well_type = $%d", argIdx)
		args = append(args, f.WellType)
		argIdx++
	}

	// Count query
	var total int
	countSQL := "SELECT COUNT(*) FROM wells " + where
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count query failed: %w", err)
	}

	// Data query
	dataSQL := fmt.Sprintf(`
		SELECT well_id, name, api_number, latitude, longitude, depth_ft,
		       formation, operator_id, status, well_type, spud_date::text,
		       created_at, updated_at
		FROM wells %s
		ORDER BY name ASC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := r.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list query failed: %w", err)
	}
	defer rows.Close()

	wells, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Well, error) {
		var w Well
		err := row.Scan(
			&w.WellID, &w.Name, &w.APINumber, &w.Latitude, &w.Longitude,
			&w.DepthFt, &w.Formation, &w.OperatorID, &w.Status, &w.WellType,
			&w.SpudDate, &w.CreatedAt, &w.UpdatedAt,
		)
		return w, err
	})
	if err != nil {
		return nil, 0, fmt.Errorf("scan failed: %w", err)
	}
	return wells, total, nil
}

// GetWell retrieves a single well by ID.
func (r *WellRepository) GetWell(ctx context.Context, wellID string) (*Well, error) {
	sql := `
		SELECT well_id, name, api_number, latitude, longitude, depth_ft,
		       formation, operator_id, status, well_type, spud_date::text,
		       created_at, updated_at
		FROM wells WHERE well_id = $1`

	var w Well
	err := r.pool.QueryRow(ctx, sql, wellID).Scan(
		&w.WellID, &w.Name, &w.APINumber, &w.Latitude, &w.Longitude,
		&w.DepthFt, &w.Formation, &w.OperatorID, &w.Status, &w.WellType,
		&w.SpudDate, &w.CreatedAt, &w.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get well failed: %w", err)
	}
	return &w, nil
}

// CreateWell inserts a new well record and returns the created well.
func (r *WellRepository) CreateWell(ctx context.Context, w Well) (*Well, error) {
	sql := `
		INSERT INTO wells (name, api_number, latitude, longitude, depth_ft,
		                   formation, operator_id, status, well_type, spud_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date)
		RETURNING well_id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, sql,
		w.Name, w.APINumber, w.Latitude, w.Longitude, w.DepthFt,
		w.Formation, w.OperatorID, w.Status, w.WellType, w.SpudDate,
	).Scan(&w.WellID, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create well failed: %w", err)
	}
	return &w, nil
}

// UpdateWellStatus changes the operational status of a well.
func (r *WellRepository) UpdateWellStatus(ctx context.Context, wellID, status, changedBy string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Update well status
	_, err = tx.Exec(ctx,
		"UPDATE wells SET status = $1 WHERE well_id = $2",
		status, wellID)
	if err != nil {
		return fmt.Errorf("status update failed: %w", err)
	}

	// Record audit event
	_, err = tx.Exec(ctx,
		`INSERT INTO well_events (well_id, event_type, description, created_by)
		 VALUES ($1, 'STATUS_CHANGE', $2, $3)`,
		wellID,
		fmt.Sprintf("Status changed to %s", status),
		changedBy,
	)
	if err != nil {
		return fmt.Errorf("event insert failed: %w", err)
	}

	return tx.Commit(ctx)
}

// ListEquipment returns all equipment for a given well.
func (r *WellRepository) ListEquipment(ctx context.Context, wellID string) ([]Equipment, error) {
	sql := `
		SELECT equipment_id, well_id, type, model, serial_number, manufacturer,
		       install_date::text, status, last_service, created_at
		FROM equipment WHERE well_id = $1 ORDER BY type, created_at`

	rows, err := r.pool.Query(ctx, sql, wellID)
	if err != nil {
		return nil, fmt.Errorf("list equipment failed: %w", err)
	}
	defer rows.Close()

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Equipment, error) {
		var e Equipment
		err := row.Scan(
			&e.EquipmentID, &e.WellID, &e.Type, &e.Model, &e.SerialNumber,
			&e.Manufacturer, &e.InstallDate, &e.Status, &e.LastService, &e.CreatedAt,
		)
		return e, err
	})
}

// ListOperators returns all operators.
func (r *WellRepository) ListOperators(ctx context.Context) ([]Operator, error) {
	rows, err := r.pool.Query(ctx,
		"SELECT operator_id, name, country, contact_email, created_at FROM operators ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Operator, error) {
		var o Operator
		err := row.Scan(&o.OperatorID, &o.Name, &o.Country, &o.ContactEmail, &o.CreatedAt)
		return o, err
	})
}
