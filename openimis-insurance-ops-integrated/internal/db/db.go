package db

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"claims-reserve-service/config"
	"claims-reserve-service/pkg/log"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
	"go.uber.org/zap"
)

// DB is a wrapper around pgxpool.Pool
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB creates a new database connection pool
func NewDB(cfg config.DatabaseConfig) (*DB, error) {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, cfg.SSLMode)

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	pool, err := pgxpool.ConnectConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.L().Info("Successfully connected to database", zap.String("host", cfg.Host), zap.String("db", cfg.Name))
	return &DB{Pool: pool}, nil
}

// RunMigrations executes SQL migration files
func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	log.L().Info("Starting database migrations", zap.String("dir", migrationsDir))

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		log.L().Info("Applying migration", zap.String("file", file.Name()))
		filePath := filepath.Join(migrationsDir, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", file.Name(), err)
		}

		_, err = d.Pool.Exec(ctx, string(content))
		if err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", file.Name(), err)
		}
		log.L().Info("Migration applied successfully", zap.String("file", file.Name()))
	}

	log.L().Info("Database migrations completed")
	return nil
}

// Close closes the database connection pool
func (d *DB) Close() {
	if d.Pool != nil {
		d.Pool.Close()
		log.L().Info("Database connection pool closed")
	}
}

// ReserveRepository handles database operations for Reserve
type ReserveRepository struct {
	DB *DB
}

// NewReserveRepository creates a new ReserveRepository
func NewReserveRepository(db *DB) *ReserveRepository {
	return &ReserveRepository{DB: db}
}

// SaveReserve saves a new reserve record
func (r *ReserveRepository) SaveReserve(ctx context.Context, reserve model.Reserve) error {
	const query = `
		INSERT INTO reserves (id, claim_id, reserve_type, amount, timestamp, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			reserve_type = EXCLUDED.reserve_type,
			amount = EXCLUDED.amount,
			timestamp = EXCLUDED.timestamp,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
	`
	_, err := r.DB.Pool.Exec(ctx, query,
		reserve.ID,
		reserve.ClaimID,
		reserve.ReserveType,
		reserve.Amount,
		reserve.Timestamp,
		reserve.IsActive,
	)
	if err != nil {
		return fmt.Errorf("failed to save reserve: %w", err)
	}
	return nil
}

// GetActiveReserveByClaimID retrieves the active reserve for a claim
func (r *ReserveRepository) GetActiveReserveByClaimID(ctx context.Context, claimID uuid.UUID) (model.Reserve, error) {
	const query = `
		SELECT id, claim_id, reserve_type, amount, timestamp, is_active
		FROM reserves
		WHERE claim_id = $1 AND is_active = TRUE
		ORDER BY timestamp DESC
		LIMIT 1
	`
	var reserve model.Reserve
	err := r.DB.Pool.QueryRow(ctx, query, claimID).Scan(
		&reserve.ID,
		&reserve.ClaimID,
		&reserve.ReserveType,
		&reserve.Amount,
		&reserve.Timestamp,
		&reserve.IsActive,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return model.Reserve{}, nil // No active reserve found
		}
		return model.Reserve{}, fmt.Errorf("failed to get active reserve: %w", err)
	}
	return reserve, nil
}

// DeactivateReservesByClaimID sets all reserves for a claim to inactive
func (r *ReserveRepository) DeactivateReservesByClaimID(ctx context.Context, claimID uuid.UUID) error {
	const query = `
		UPDATE reserves
		SET is_active = FALSE, updated_at = NOW()
		WHERE claim_id = $1 AND is_active = TRUE
	`
	_, err := r.DB.Pool.Exec(ctx, query, claimID)
	if err != nil {
		return fmt.Errorf("failed to deactivate reserves: %w", err)
	}
	return nil
}

// SaveIBNRResult saves the result of an IBNR calculation
func (r *ReserveRepository) SaveIBNRResult(ctx context.Context, result model.IBNRCalculationResult) error {
	const query = `
		INSERT INTO ibnr_history (id, total_ibnr, timestamp)
		VALUES ($1, $2, $3)
	`
	_, err := r.DB.Pool.Exec(ctx, query, uuid.New(), result.TotalIBNR, result.Timestamp)
	if err != nil {
		return fmt.Errorf("failed to save IBNR result: %w", err)
	}
	return nil
}
