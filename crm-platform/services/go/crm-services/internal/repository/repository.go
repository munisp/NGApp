package repository

import (
	"context"
	"database/sql"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/config"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/sirupsen/logrus"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

// NewPostgresDB creates a new Postgres connection.
func NewPostgresDB(cfg config.DatabaseConfig) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.URL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	return db, db.Ping()
}

// NewRedisClient creates a new Redis client.
func NewRedisClient(cfg config.RedisConfig) (*redis.Client, error) {
	opts, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	return client, client.Ping(context.Background()).Err()
}

// CustomerRepository defines data access for customers.
type CustomerRepository interface {
	GetByID(ctx context.Context, id string) (*models.Customer, error)
	List(ctx context.Context, tenantID string, offset, limit int) ([]models.Customer, int, error)
	Create(ctx context.Context, customer *models.Customer) error
	Update(ctx context.Context, customer *models.Customer) error
	Delete(ctx context.Context, id string) error
	Search(ctx context.Context, tenantID, query string) ([]models.Customer, error)
}

// EventRepository defines data access for events.
type EventRepository interface {
	Store(ctx context.Context, event interface{}) error
	List(ctx context.Context, tenantID string, limit int) ([]interface{}, error)
}

type customerRepo struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewCustomerRepository creates a customer repository backed by Postgres+Redis.
func NewCustomerRepository(db *sql.DB, redis *redis.Client, logger *logrus.Logger) CustomerRepository {
	return &customerRepo{db: db, redis: redis, logger: logger}
}

func (r *customerRepo) GetByID(ctx context.Context, id string) (*models.Customer, error) {
	return &models.Customer{ID: id}, nil
}

func (r *customerRepo) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Customer, int, error) {
	return nil, 0, nil
}

func (r *customerRepo) Create(ctx context.Context, c *models.Customer) error { return nil }
func (r *customerRepo) Update(ctx context.Context, c *models.Customer) error { return nil }
func (r *customerRepo) Delete(ctx context.Context, id string) error           { return nil }
func (r *customerRepo) Search(ctx context.Context, tenantID, q string) ([]models.Customer, error) {
	return nil, nil
}

type eventRepo struct {
	db     *sql.DB
	logger *logrus.Logger
}

// NewEventRepository creates an event repository.
func NewEventRepository(db *sql.DB, logger *logrus.Logger) EventRepository {
	return &eventRepo{db: db, logger: logger}
}

func (r *eventRepo) Store(ctx context.Context, event interface{}) error { return nil }
func (r *eventRepo) List(ctx context.Context, tenantID string, limit int) ([]interface{}, error) {
	return nil, nil
}
