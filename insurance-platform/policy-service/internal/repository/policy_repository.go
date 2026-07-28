package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"insurance-platform/policy-service/internal/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// PolicyRepository handles database operations for policies
type PolicyRepository struct {
	db *sql.DB
}

// NewPolicyRepository creates a new policy repository
func NewPolicyRepository(db *sql.DB) *PolicyRepository {
	return &PolicyRepository{
		db: db,
	}
}

// Create inserts a new policy into the database
func (r *PolicyRepository) Create(ctx context.Context, policy *models.Policy) error {
	query := `
		INSERT INTO policies (
			id, policy_number, customer_id, agent_id, policy_type, status,
			premium_amount, premium_frequency, sum_assured, currency,
			start_date, end_date, next_premium_due_date, beneficiaries,
			coverage_details, exclusions, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`

	_, err := r.db.ExecContext(ctx, query,
		policy.ID,
		policy.PolicyNumber,
		policy.CustomerID,
		policy.AgentID,
		policy.PolicyType,
		policy.Status,
		policy.PremiumAmount,
		policy.PremiumFrequency,
		policy.SumAssured,
		policy.Currency,
		policy.StartDate,
		policy.EndDate,
		policy.NextPremiumDueDate,
		policy.Beneficiaries,
		policy.CoverageDetails,
		policy.Exclusions,
		policy.Metadata,
		policy.CreatedAt,
		policy.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create policy: %w", err)
	}

	return nil
}

// GetByID retrieves a policy by its ID
func (r *PolicyRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Policy, error) {
	query := `
		SELECT id, policy_number, customer_id, agent_id, policy_type, status,
		       premium_amount, premium_frequency, sum_assured, currency,
		       start_date, end_date, next_premium_due_date, beneficiaries,
		       coverage_details, exclusions, metadata, created_at, updated_at,
		       issued_at, cancelled_at
		FROM policies
		WHERE id = $1
	`

	policy := &models.Policy{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&policy.ID,
		&policy.PolicyNumber,
		&policy.CustomerID,
		&policy.AgentID,
		&policy.PolicyType,
		&policy.Status,
		&policy.PremiumAmount,
		&policy.PremiumFrequency,
		&policy.SumAssured,
		&policy.Currency,
		&policy.StartDate,
		&policy.EndDate,
		&policy.NextPremiumDueDate,
		&policy.Beneficiaries,
		&policy.CoverageDetails,
		&policy.Exclusions,
		&policy.Metadata,
		&policy.CreatedAt,
		&policy.UpdatedAt,
		&policy.IssuedAt,
		&policy.CancelledAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("policy not found: %s", id)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	return policy, nil
}

// GetByPolicyNumber retrieves a policy by its policy number
func (r *PolicyRepository) GetByPolicyNumber(ctx context.Context, policyNumber string) (*models.Policy, error) {
	query := `
		SELECT id, policy_number, customer_id, agent_id, policy_type, status,
		       premium_amount, premium_frequency, sum_assured, currency,
		       start_date, end_date, next_premium_due_date, beneficiaries,
		       coverage_details, exclusions, metadata, created_at, updated_at,
		       issued_at, cancelled_at
		FROM policies
		WHERE policy_number = $1
	`

	policy := &models.Policy{}
	err := r.db.QueryRowContext(ctx, query, policyNumber).Scan(
		&policy.ID,
		&policy.PolicyNumber,
		&policy.CustomerID,
		&policy.AgentID,
		&policy.PolicyType,
		&policy.Status,
		&policy.PremiumAmount,
		&policy.PremiumFrequency,
		&policy.SumAssured,
		&policy.Currency,
		&policy.StartDate,
		&policy.EndDate,
		&policy.NextPremiumDueDate,
		&policy.Beneficiaries,
		&policy.CoverageDetails,
		&policy.Exclusions,
		&policy.Metadata,
		&policy.CreatedAt,
		&policy.UpdatedAt,
		&policy.IssuedAt,
		&policy.CancelledAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("policy not found: %s", policyNumber)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	return policy, nil
}

// Update updates a policy
func (r *PolicyRepository) Update(ctx context.Context, policy *models.Policy) error {
	query := `
		UPDATE policies
		SET status = $1, premium_amount = $2, sum_assured = $3, beneficiaries = $4,
		    coverage_details = $5, metadata = $6, updated_at = $7
		WHERE id = $8
	`

	_, err := r.db.ExecContext(ctx, query,
		policy.Status,
		policy.PremiumAmount,
		policy.SumAssured,
		policy.Beneficiaries,
		policy.CoverageDetails,
		policy.Metadata,
		time.Now(),
		policy.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update policy: %w", err)
	}

	return nil
}

// UpdateStatus updates the status of a policy
func (r *PolicyRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.PolicyStatus) error {
	query := `
		UPDATE policies
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, status, now, id)
	if err != nil {
		return fmt.Errorf("failed to update policy status: %w", err)
	}

	return nil
}

// Issue marks a policy as issued
func (r *PolicyRepository) Issue(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE policies
		SET status = $1, issued_at = $2, updated_at = $3
		WHERE id = $4
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, models.PolicyStatusActive, now, now, id)
	if err != nil {
		return fmt.Errorf("failed to issue policy: %w", err)
	}

	return nil
}

// Cancel marks a policy as cancelled
func (r *PolicyRepository) Cancel(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE policies
		SET status = $1, cancelled_at = $2, updated_at = $3
		WHERE id = $4
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, models.PolicyStatusCancelled, now, now, id)
	if err != nil {
		return fmt.Errorf("failed to cancel policy: %w", err)
	}

	return nil
}

// GetByCustomerID retrieves all policies for a customer
func (r *PolicyRepository) GetByCustomerID(ctx context.Context, customerID uuid.UUID) ([]*models.Policy, error) {
	query := `
		SELECT id, policy_number, customer_id, agent_id, policy_type, status,
		       premium_amount, premium_frequency, sum_assured, currency,
		       start_date, end_date, next_premium_due_date, beneficiaries,
		       coverage_details, exclusions, metadata, created_at, updated_at,
		       issued_at, cancelled_at
		FROM policies
		WHERE customer_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get policies by customer: %w", err)
	}
	defer rows.Close()

	var policies []*models.Policy
	for rows.Next() {
		policy := &models.Policy{}
		err := rows.Scan(
			&policy.ID,
			&policy.PolicyNumber,
			&policy.CustomerID,
			&policy.AgentID,
			&policy.PolicyType,
			&policy.Status,
			&policy.PremiumAmount,
			&policy.PremiumFrequency,
			&policy.SumAssured,
			&policy.Currency,
			&policy.StartDate,
			&policy.EndDate,
			&policy.NextPremiumDueDate,
			&policy.Beneficiaries,
			&policy.CoverageDetails,
			&policy.Exclusions,
			&policy.Metadata,
			&policy.CreatedAt,
			&policy.UpdatedAt,
			&policy.IssuedAt,
			&policy.CancelledAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan policy: %w", err)
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// GetByAgentID retrieves all policies for an agent
func (r *PolicyRepository) GetByAgentID(ctx context.Context, agentID uuid.UUID) ([]*models.Policy, error) {
	query := `
		SELECT id, policy_number, customer_id, agent_id, policy_type, status,
		       premium_amount, premium_frequency, sum_assured, currency,
		       start_date, end_date, next_premium_due_date, beneficiaries,
		       coverage_details, exclusions, metadata, created_at, updated_at,
		       issued_at, cancelled_at
		FROM policies
		WHERE agent_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get policies by agent: %w", err)
	}
	defer rows.Close()

	var policies []*models.Policy
	for rows.Next() {
		policy := &models.Policy{}
		err := rows.Scan(
			&policy.ID,
			&policy.PolicyNumber,
			&policy.CustomerID,
			&policy.AgentID,
			&policy.PolicyType,
			&policy.Status,
			&policy.PremiumAmount,
			&policy.PremiumFrequency,
			&policy.SumAssured,
			&policy.Currency,
			&policy.StartDate,
			&policy.EndDate,
			&policy.NextPremiumDueDate,
			&policy.Beneficiaries,
			&policy.CoverageDetails,
			&policy.Exclusions,
			&policy.Metadata,
			&policy.CreatedAt,
			&policy.UpdatedAt,
			&policy.IssuedAt,
			&policy.CancelledAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan policy: %w", err)
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// GetExpiringPolicies retrieves policies expiring within the specified days
func (r *PolicyRepository) GetExpiringPolicies(ctx context.Context, days int) ([]*models.Policy, error) {
	query := `
		SELECT id, policy_number, customer_id, agent_id, policy_type, status,
		       premium_amount, premium_frequency, sum_assured, currency,
		       start_date, end_date, next_premium_due_date, beneficiaries,
		       coverage_details, exclusions, metadata, created_at, updated_at,
		       issued_at, cancelled_at
		FROM policies
		WHERE status = $1 AND end_date BETWEEN NOW() AND NOW() + INTERVAL '%d days'
		ORDER BY end_date ASC
	`

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(query, days), models.PolicyStatusActive)
	if err != nil {
		return nil, fmt.Errorf("failed to get expiring policies: %w", err)
	}
	defer rows.Close()

	var policies []*models.Policy
	for rows.Next() {
		policy := &models.Policy{}
		err := rows.Scan(
			&policy.ID,
			&policy.PolicyNumber,
			&policy.CustomerID,
			&policy.AgentID,
			&policy.PolicyType,
			&policy.Status,
			&policy.PremiumAmount,
			&policy.PremiumFrequency,
			&policy.SumAssured,
			&policy.Currency,
			&policy.StartDate,
			&policy.EndDate,
			&policy.NextPremiumDueDate,
			&policy.Beneficiaries,
			&policy.CoverageDetails,
			&policy.Exclusions,
			&policy.Metadata,
			&policy.CreatedAt,
			&policy.UpdatedAt,
			&policy.IssuedAt,
			&policy.CancelledAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan policy: %w", err)
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// InitSchema creates the policies table
func (r *PolicyRepository) InitSchema(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS policies (
			id UUID PRIMARY KEY,
			policy_number VARCHAR(255) UNIQUE NOT NULL,
			customer_id UUID NOT NULL,
			agent_id UUID,
			policy_type VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL,
			premium_amount BIGINT NOT NULL,
			premium_frequency VARCHAR(50) NOT NULL,
			sum_assured BIGINT NOT NULL,
			currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
			start_date TIMESTAMP NOT NULL,
			end_date TIMESTAMP NOT NULL,
			next_premium_due_date TIMESTAMP,
			beneficiaries JSONB,
			coverage_details JSONB,
			exclusions JSONB,
			metadata JSONB,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
			issued_at TIMESTAMP,
			cancelled_at TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_customer_id ON policies(customer_id);
		CREATE INDEX IF NOT EXISTS idx_agent_id ON policies(agent_id);
		CREATE INDEX IF NOT EXISTS idx_policy_number ON policies(policy_number);
		CREATE INDEX IF NOT EXISTS idx_status ON policies(status);
		CREATE INDEX IF NOT EXISTS idx_end_date ON policies(end_date);
		CREATE INDEX IF NOT EXISTS idx_created_at ON policies(created_at);
	`

	_, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create policies table: %w", err)
	}

	return nil
}
