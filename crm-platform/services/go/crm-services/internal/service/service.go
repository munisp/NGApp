package service

import (
	"context"
	"database/sql"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/repository"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// CustomerService handles business logic for customers.
type CustomerService struct {
	repo      repository.CustomerRepository
	eventRepo repository.EventRepository
	logger    *logrus.Logger
}

// NewCustomerService creates a new customer service.
func NewCustomerService(repo repository.CustomerRepository, eventRepo repository.EventRepository, logger *logrus.Logger) *CustomerService {
	return &CustomerService{repo: repo, eventRepo: eventRepo, logger: logger}
}

// GetCustomer retrieves a customer by ID.
func (s *CustomerService) GetCustomer(ctx context.Context, id string) (*models.Customer, error) {
	return s.repo.GetByID(ctx, id)
}

// ListCustomers lists customers for a tenant.
func (s *CustomerService) ListCustomers(ctx context.Context, tenantID string, page, limit int) ([]models.Customer, int, error) {
	offset := (page - 1) * limit
	return s.repo.List(ctx, tenantID, offset, limit)
}

// CreateCustomer creates a new customer.
func (s *CustomerService) CreateCustomer(ctx context.Context, customer *models.Customer) error {
	return s.repo.Create(ctx, customer)
}

// HealthService handles health checks.
type HealthService struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

// NewHealthService creates a new health service.
func NewHealthService(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *HealthService {
	return &HealthService{db: db, redis: redis, logger: logger}
}

// Check verifies database and redis connectivity.
func (s *HealthService) Check(ctx context.Context) error {
	if err := s.db.PingContext(ctx); err != nil {
		return err
	}
	return s.redis.Ping(ctx).Err()
}
