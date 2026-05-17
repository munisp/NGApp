package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"customer-service/internal/models"
	"github.com/google/uuid"
)

type CustomerRepository struct{ db *sql.DB }

func NewCustomerRepository(db *sql.DB) *CustomerRepository { return &CustomerRepository{db: db} }

func (r *CustomerRepository) Create(ctx context.Context, c *models.Customer) error {
	c.ID = uuid.New().String()
	c.KYCStatus = models.KYCPending
	c.Tier = models.TierBronze
	c.CreatedAt = time.Now()
	c.UpdatedAt = time.Now()
	query := `INSERT INTO customers (id, first_name, last_name, email, phone, date_of_birth, address, city, state, kyc_status, bvn, nin, risk_score, tier, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.FirstName, c.LastName, c.Email, c.Phone, c.DateOfBirth,
		c.Address, c.City, c.State, c.KYCStatus, c.BVN, c.NIN, c.RiskScore, c.Tier, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *CustomerRepository) GetByID(ctx context.Context, id string) (*models.Customer, error) {
	var c models.Customer
	query := `SELECT id, first_name, last_name, email, phone, date_of_birth, address, COALESCE(city,''), COALESCE(state,''), kyc_status, COALESCE(bvn,''), COALESCE(nin,''), COALESCE(risk_score,0), COALESCE(tier,'bronze'), created_at, updated_at FROM customers WHERE id = $1`
	err := r.db.QueryRowContext(ctx, query, id).Scan(&c.ID, &c.FirstName, &c.LastName, &c.Email, &c.Phone,
		&c.DateOfBirth, &c.Address, &c.City, &c.State, &c.KYCStatus, &c.BVN, &c.NIN, &c.RiskScore, &c.Tier, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows { return nil, fmt.Errorf("customer not found: %s", id) }
	return &c, err
}

func (r *CustomerRepository) List(ctx context.Context, filter models.CustomerFilter) ([]models.Customer, error) {
	query := `SELECT id, first_name, last_name, email, phone, date_of_birth, address, COALESCE(city,''), COALESCE(state,''), kyc_status, COALESCE(bvn,''), COALESCE(nin,''), COALESCE(risk_score,0), COALESCE(tier,'bronze'), created_at, updated_at FROM customers WHERE 1=1`
	args := []interface{}{}
	n := 1
	if filter.KYCStatus != "" { query += fmt.Sprintf(" AND kyc_status = $%d", n); args = append(args, filter.KYCStatus); n++ }
	if filter.State != "" { query += fmt.Sprintf(" AND state = $%d", n); args = append(args, filter.State); n++ }
	if filter.Tier != "" { query += fmt.Sprintf(" AND tier = $%d", n); args = append(args, filter.Tier); n++ }
	query += " ORDER BY created_at DESC"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	var customers []models.Customer
	for rows.Next() {
		var c models.Customer
		if err := rows.Scan(&c.ID, &c.FirstName, &c.LastName, &c.Email, &c.Phone, &c.DateOfBirth, &c.Address, &c.City, &c.State, &c.KYCStatus, &c.BVN, &c.NIN, &c.RiskScore, &c.Tier, &c.CreatedAt, &c.UpdatedAt); err != nil { continue }
		customers = append(customers, c)
	}
	return customers, nil
}

func (r *CustomerRepository) Update(ctx context.Context, c *models.Customer) error {
	c.UpdatedAt = time.Now()
	query := `UPDATE customers SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, city=$6, state=$7, kyc_status=$8, bvn=$9, nin=$10, risk_score=$11, tier=$12, updated_at=$13 WHERE id=$14`
	res, err := r.db.ExecContext(ctx, query, c.FirstName, c.LastName, c.Email, c.Phone, c.Address, c.City, c.State, c.KYCStatus, c.BVN, c.NIN, c.RiskScore, c.Tier, c.UpdatedAt, c.ID)
	if err != nil { return err }
	if n, _ := res.RowsAffected(); n == 0 { return fmt.Errorf("customer not found") }
	return nil
}

func (r *CustomerRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM customers WHERE id = $1", id)
	if err != nil { return err }
	if n, _ := res.RowsAffected(); n == 0 { return fmt.Errorf("customer not found") }
	return nil
}

func (r *CustomerRepository) GetPolicies(ctx context.Context, customerID string) ([]models.CustomerPolicy, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, customer_id, policy_type, status, premium, COALESCE(sum_assured,0), start_date, end_date FROM policies WHERE customer_id=$1 ORDER BY start_date DESC", customerID)
	if err != nil { return nil, err }
	defer rows.Close()
	var ps []models.CustomerPolicy
	for rows.Next() {
		var p models.CustomerPolicy
		if err := rows.Scan(&p.ID, &p.CustomerID, &p.PolicyType, &p.Status, &p.Premium, &p.SumAssured, &p.StartDate, &p.EndDate); err != nil { continue }
		ps = append(ps, p)
	}
	return ps, nil
}

func (r *CustomerRepository) GetClaims(ctx context.Context, customerID string) ([]models.CustomerClaim, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, policy_id, customer_id, amount, status, filed_date FROM claims WHERE customer_id=$1 ORDER BY filed_date DESC", customerID)
	if err != nil { return nil, err }
	defer rows.Close()
	var cs []models.CustomerClaim
	for rows.Next() {
		var c models.CustomerClaim
		if err := rows.Scan(&c.ID, &c.PolicyID, &c.CustomerID, &c.Amount, &c.Status, &c.FiledDate); err != nil { continue }
		cs = append(cs, c)
	}
	return cs, nil
}

func (r *CustomerRepository) GetPayments(ctx context.Context, customerID string) ([]models.CustomerPayment, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, policy_id, customer_id, amount, status, payment_date FROM payments WHERE customer_id=$1 ORDER BY payment_date DESC", customerID)
	if err != nil { return nil, err }
	defer rows.Close()
	var ps []models.CustomerPayment
	for rows.Next() {
		var p models.CustomerPayment
		if err := rows.Scan(&p.ID, &p.PolicyID, &p.CustomerID, &p.Amount, &p.Status, &p.PaymentDate); err != nil { continue }
		ps = append(ps, p)
	}
	return ps, nil
}
