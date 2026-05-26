// PostgresStore handles telemetry metadata in PostgreSQL.
// Stores sensor configuration, calibration records, and aggregated daily summaries.
// PostgreSQL is the sole relational database — no MySQL or TiDB.
package store

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore provides PostgreSQL-backed metadata storage.
type PostgresStore struct {
	pool *pgxpool.Pool
}

// NewPostgresStore connects to PostgreSQL and runs telemetry schema migrations.
func NewPostgresStore(ctx context.Context, dsn string) (*PostgresStore, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("invalid DSN: %w", err)
	}
	config.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("pool creation failed: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("PostgreSQL ping failed: %w", err)
	}

	s := &PostgresStore{pool: pool}
	if err := s.migrate(ctx); err != nil {
		return nil, fmt.Errorf("telemetry migration failed: %w", err)
	}
	return s, nil
}

func (s *PostgresStore) migrate(ctx context.Context) error {
	migrations := []string{
		// Sensor configuration table
		`CREATE TABLE IF NOT EXISTS sensor_configs (
			sensor_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			well_id         UUID NOT NULL,
			sensor_type     VARCHAR(50) NOT NULL,
			tag_name        VARCHAR(255) NOT NULL,
			unit            VARCHAR(20),
			min_range       DOUBLE PRECISION,
			max_range       DOUBLE PRECISION,
			alarm_low       DOUBLE PRECISION,
			alarm_high      DOUBLE PRECISION,
			alarm_critical  DOUBLE PRECISION,
			scan_rate_ms    INTEGER NOT NULL DEFAULT 1000,
			enabled         BOOLEAN NOT NULL DEFAULT TRUE,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(well_id, sensor_type, tag_name)
		);
		CREATE INDEX IF NOT EXISTS idx_sensor_configs_well ON sensor_configs(well_id);`,

		// Daily production summary (aggregated from InfluxDB)
		`CREATE TABLE IF NOT EXISTS daily_production (
			summary_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			well_id         UUID NOT NULL,
			production_date DATE NOT NULL,
			oil_bbls        DOUBLE PRECISION DEFAULT 0,
			gas_mcf         DOUBLE PRECISION DEFAULT 0,
			water_bbls      DOUBLE PRECISION DEFAULT 0,
			uptime_hours    DOUBLE PRECISION DEFAULT 0,
			avg_tubing_psi  DOUBLE PRECISION,
			avg_flow_rate   DOUBLE PRECISION,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(well_id, production_date)
		);
		CREATE INDEX IF NOT EXISTS idx_daily_prod_well ON daily_production(well_id);
		CREATE INDEX IF NOT EXISTS idx_daily_prod_date ON daily_production(production_date DESC);`,

		// Calibration records
		`CREATE TABLE IF NOT EXISTS sensor_calibrations (
			cal_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			sensor_id       UUID NOT NULL REFERENCES sensor_configs(sensor_id),
			calibrated_by   VARCHAR(255),
			calibrated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			offset_value    DOUBLE PRECISION DEFAULT 0,
			scale_factor    DOUBLE PRECISION DEFAULT 1,
			notes           TEXT
		);`,
	}

	for i, sql := range migrations {
		if _, err := s.pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("telemetry migration %d failed: %w", i, err)
		}
	}
	slog.Info("telemetry PostgreSQL migrations completed")
	return nil
}

// Close releases the connection pool.
func (s *PostgresStore) Close() {
	s.pool.Close()
}

// WriteTelemetryReadingDirect inserts a single telemetry reading into the main app's
// telemetry_readings table. This is the bridge between the Kafka consumer and the
// PostgreSQL database used by the Node.js tRPC layer.
// The telemetry_readings table is managed by the main app's Drizzle schema.
func (s *PostgresStore) WriteTelemetryReadingDirect(ctx context.Context, wellID, sensorTag string, value float64, unit, quality string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO telemetry_readings (well_id, sensor_tag, value, unit, quality, recorded_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT DO NOTHING
	`, wellID, sensorTag, value, unit, quality)
	if err != nil {
		// Gracefully handle missing table — the main app may not have run db:push yet
		slog.Warn("WriteTelemetryReadingDirect failed (table may not exist yet)", "err", err)
		return nil
	}
	return nil
}

// GetSensorConfigs returns all sensor configurations for a given well.
func (s *PostgresStore) GetSensorConfigs(ctx context.Context, wellID string) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT sensor_id, well_id, sensor_type, tag_name, unit, min_range, max_range,
		       alarm_low, alarm_high, alarm_critical, scan_rate_ms, enabled
		FROM sensor_configs
		WHERE well_id = $1 AND enabled = TRUE
		ORDER BY sensor_type, tag_name
	`, wellID)
	if err != nil {
		return nil, fmt.Errorf("GetSensorConfigs failed: %w", err)
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var (
			sensorID, wID, sensorType, tagName string
			unit                               *string
			minRange, maxRange                 *float64
			alarmLow, alarmHigh, alarmCritical *float64
			scanRateMs                         int
			enabled                            bool
		)
		if err := rows.Scan(&sensorID, &wID, &sensorType, &tagName, &unit,
			&minRange, &maxRange, &alarmLow, &alarmHigh, &alarmCritical,
			&scanRateMs, &enabled); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"sensor_id":      sensorID,
			"well_id":        wID,
			"sensor_type":    sensorType,
			"tag_name":       tagName,
			"unit":           unit,
			"min_range":      minRange,
			"max_range":      maxRange,
			"alarm_low":      alarmLow,
			"alarm_high":     alarmHigh,
			"alarm_critical": alarmCritical,
			"scan_rate_ms":   scanRateMs,
			"enabled":        enabled,
		})
	}
	return results, nil
}
