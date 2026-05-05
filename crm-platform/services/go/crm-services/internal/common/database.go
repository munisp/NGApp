package repository

import (
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/config"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// NewPostgresDB creates a new PostgreSQL database connection
func NewPostgresDB(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := cfg.GetDSN()

	// Configure GORM logger
	gormLogger := logger.New(
		logrus.New(),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	// Open database connection
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying sql.DB
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Auto-migrate models
	if err := autoMigrate(db); err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	return db, nil
}

// NewRedisClient creates a new Redis client
func NewRedisClient(cfg config.RedisConfig) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.GetRedisAddr(),
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		DialTimeout:  10 * time.Second,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		PoolTimeout:  30 * time.Second,
		IdleTimeout:  5 * time.Minute,
	})

	// Test connection
	ctx := client.Context()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}

// autoMigrate runs database migrations
func autoMigrate(db *gorm.DB) error {
	models := []interface{}{
		&models.Customer{},
		&models.CustomerProfile{},
		&models.CustomerAddress{},
		&models.CustomerInteraction{},
		&models.CustomerSegment{},
		&models.CustomerPreferences{},
		&models.CustomerEvent{},
	}

	for _, model := range models {
		if err := db.AutoMigrate(model); err != nil {
			return fmt.Errorf("failed to migrate %T: %w", model, err)
		}
	}

	// Create indexes
	if err := createIndexes(db); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	// Create constraints
	if err := createConstraints(db); err != nil {
		return fmt.Errorf("failed to create constraints: %w", err)
	}

	return nil
}

// createIndexes creates additional database indexes
func createIndexes(db *gorm.DB) error {
	indexes := []string{
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_tier ON customers(status, tier)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_at ON customers(created_at)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_last_activity ON customers(last_activity_at)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_lifetime_value ON customers(lifetime_value)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_risk_score ON customers(risk_score)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_interactions_type_channel ON customer_interactions(type, channel)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_interactions_created_at ON customer_interactions(created_at)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_interactions_status ON customer_interactions(status)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_addresses_type ON customer_addresses(type)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_addresses_is_primary ON customer_addresses(is_primary)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_events_event_type ON customer_events(event_type)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_events_timestamp ON customer_events(timestamp)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_segments_type ON customer_segments(type)",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_segments_is_active ON customer_segments(is_active)",
	}

	for _, index := range indexes {
		if err := db.Exec(index).Error; err != nil {
			logrus.Warnf("Failed to create index: %s, error: %v", index, err)
		}
	}

	return nil
}

// createConstraints creates additional database constraints
func createConstraints(db *gorm.DB) error {
	constraints := []string{
		"ALTER TABLE customers ADD CONSTRAINT chk_customers_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')",
		"ALTER TABLE customers ADD CONSTRAINT chk_customers_phone_format CHECK (phone ~* '^[+]?[0-9\\s\\-\\(\\)]+$')",
		"ALTER TABLE customers ADD CONSTRAINT chk_customers_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100)",
		"ALTER TABLE customers ADD CONSTRAINT chk_customers_credit_score_range CHECK (credit_score >= 0 AND credit_score <= 850)",
		"ALTER TABLE customer_interactions ADD CONSTRAINT chk_interactions_satisfaction_score CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5)",
		"ALTER TABLE customer_interactions ADD CONSTRAINT chk_interactions_duration CHECK (duration >= 0)",
		"ALTER TABLE customer_addresses ADD CONSTRAINT chk_addresses_coordinates CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))",
		"ALTER TABLE customer_addresses ADD CONSTRAINT chk_addresses_latitude_range CHECK (latitude >= -90 AND latitude <= 90)",
		"ALTER TABLE customer_addresses ADD CONSTRAINT chk_addresses_longitude_range CHECK (longitude >= -180 AND longitude <= 180)",
	}

	for _, constraint := range constraints {
		if err := db.Exec(constraint).Error; err != nil {
			logrus.Warnf("Failed to create constraint: %s, error: %v", constraint, err)
		}
	}

	return nil
}

// CreateTriggers creates database triggers for audit and business logic
func CreateTriggers(db *gorm.DB) error {
	triggers := []string{
		`
		CREATE OR REPLACE FUNCTION update_customer_last_activity()
		RETURNS TRIGGER AS $$
		BEGIN
			UPDATE customers 
			SET last_activity_at = NOW() 
			WHERE id = NEW.customer_id;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
		`,
		`
		CREATE TRIGGER trigger_update_customer_last_activity
		AFTER INSERT ON customer_interactions
		FOR EACH ROW
		EXECUTE FUNCTION update_customer_last_activity();
		`,
		`
		CREATE OR REPLACE FUNCTION calculate_customer_lifetime_value()
		RETURNS TRIGGER AS $$
		BEGIN
			-- Update lifetime value calculation logic here
			-- This is a simplified version
			UPDATE customers 
			SET lifetime_value = (
				SELECT COALESCE(SUM(CAST(metadata->>'amount' AS DECIMAL)), 0)
				FROM customer_interactions 
				WHERE customer_id = NEW.customer_id 
				AND type = 'transaction'
			)
			WHERE id = NEW.customer_id;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
		`,
		`
		CREATE TRIGGER trigger_calculate_customer_lifetime_value
		AFTER INSERT OR UPDATE ON customer_interactions
		FOR EACH ROW
		WHEN (NEW.type = 'transaction')
		EXECUTE FUNCTION calculate_customer_lifetime_value();
		`,
		`
		CREATE OR REPLACE FUNCTION ensure_single_primary_address()
		RETURNS TRIGGER AS $$
		BEGIN
			IF NEW.is_primary = true THEN
				UPDATE customer_addresses 
				SET is_primary = false 
				WHERE customer_id = NEW.customer_id 
				AND id != NEW.id;
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
		`,
		`
		CREATE TRIGGER trigger_ensure_single_primary_address
		BEFORE INSERT OR UPDATE ON customer_addresses
		FOR EACH ROW
		WHEN (NEW.is_primary = true)
		EXECUTE FUNCTION ensure_single_primary_address();
		`,
	}

	for _, trigger := range triggers {
		if err := db.Exec(trigger).Error; err != nil {
			logrus.Warnf("Failed to create trigger: %v", err)
		}
	}

	return nil
}

// CreateViews creates database views for common queries
func CreateViews(db *gorm.DB) error {
	views := []string{
		`
		CREATE OR REPLACE VIEW customer_summary AS
		SELECT 
			c.id,
			c.customer_number,
			c.first_name,
			c.last_name,
			c.email,
			c.phone,
			c.status,
			c.tier,
			c.kyc_status,
			c.lifetime_value,
			c.total_spent,
			c.risk_score,
			c.credit_score,
			c.last_activity_at,
			c.created_at,
			cp.occupation,
			cp.industry,
			cp.annual_income,
			COUNT(ci.id) as interaction_count,
			MAX(ci.created_at) as last_interaction_at,
			COUNT(DISTINCT cs.id) as segment_count
		FROM customers c
		LEFT JOIN customer_profiles cp ON c.id = cp.customer_id
		LEFT JOIN customer_interactions ci ON c.id = ci.customer_id
		LEFT JOIN customer_segment_mappings csm ON c.id = csm.customer_id
		LEFT JOIN customer_segments cs ON csm.customer_segment_id = cs.id
		WHERE c.deleted_at IS NULL
		GROUP BY c.id, cp.id;
		`,
		`
		CREATE OR REPLACE VIEW customer_interaction_summary AS
		SELECT 
			customer_id,
			COUNT(*) as total_interactions,
			COUNT(CASE WHEN type = 'call' THEN 1 END) as call_count,
			COUNT(CASE WHEN type = 'email' THEN 1 END) as email_count,
			COUNT(CASE WHEN type = 'chat' THEN 1 END) as chat_count,
			COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_count,
			COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
			AVG(satisfaction_score) as avg_satisfaction_score,
			AVG(duration) as avg_duration,
			MAX(created_at) as last_interaction_at,
			MIN(created_at) as first_interaction_at
		FROM customer_interactions
		GROUP BY customer_id;
		`,
		`
		CREATE OR REPLACE VIEW customer_segment_summary AS
		SELECT 
			cs.id,
			cs.name,
			cs.type,
			cs.description,
			COUNT(csm.customer_id) as customer_count,
			AVG(c.lifetime_value) as avg_lifetime_value,
			AVG(c.risk_score) as avg_risk_score,
			cs.created_at
		FROM customer_segments cs
		LEFT JOIN customer_segment_mappings csm ON cs.id = csm.customer_segment_id
		LEFT JOIN customers c ON csm.customer_id = c.id AND c.deleted_at IS NULL
		WHERE cs.is_active = true
		GROUP BY cs.id;
		`,
	}

	for _, view := range views {
		if err := db.Exec(view).Error; err != nil {
			logrus.Warnf("Failed to create view: %v", err)
		}
	}

	return nil
}

// HealthCheck checks database connectivity
func HealthCheck(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

// RedisHealthCheck checks Redis connectivity
func RedisHealthCheck(client *redis.Client) error {
	ctx := client.Context()
	return client.Ping(ctx).Err()
}

