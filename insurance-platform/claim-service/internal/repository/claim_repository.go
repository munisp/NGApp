package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"claim-service/internal/models"

	"github.com/google/uuid"
)

type ClaimRepository struct {
	db *sql.DB
}

func NewClaimRepository(db *sql.DB) *ClaimRepository {
	return &ClaimRepository{db: db}
}

func (r *ClaimRepository) Create(ctx context.Context, claim *models.Claim) error {
	claim.ID = uuid.New().String()
	claim.Status = models.StatusPending
	claim.Priority = models.PriorityMedium
	claim.FiledDate = time.Now()
	claim.UpdatedAt = time.Now()

	query := `INSERT INTO claims (id, policy_id, customer_id, amount, status, description, claim_type, incident_date, filed_date, priority, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query, claim.ID, claim.PolicyID, claim.CustomerID, claim.Amount,
		claim.Status, claim.Description, claim.ClaimType, claim.IncidentDate, claim.FiledDate, claim.Priority, claim.UpdatedAt)
	return err
}

func (r *ClaimRepository) GetByID(ctx context.Context, id string) (*models.Claim, error) {
	var claim models.Claim
	query := `SELECT id, policy_id, customer_id, amount, status, description, COALESCE(claim_type,''), incident_date, filed_date, 
		COALESCE(approved_amount,0), COALESCE(rejection_reason,''), COALESCE(assigned_to,''), COALESCE(priority,'medium'), updated_at 
		FROM claims WHERE id = $1`
	err := r.db.QueryRowContext(ctx, query, id).Scan(&claim.ID, &claim.PolicyID, &claim.CustomerID,
		&claim.Amount, &claim.Status, &claim.Description, &claim.ClaimType, &claim.IncidentDate, &claim.FiledDate,
		&claim.ApprovedAmount, &claim.RejectionReason, &claim.AssignedTo, &claim.Priority, &claim.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("claim not found: %s", id)
	}
	return &claim, err
}

func (r *ClaimRepository) List(ctx context.Context, filter models.ClaimFilter) ([]models.Claim, error) {
	query := `SELECT id, policy_id, customer_id, amount, status, description, COALESCE(claim_type,''), incident_date, filed_date, 
		COALESCE(approved_amount,0), COALESCE(rejection_reason,''), COALESCE(assigned_to,''), COALESCE(priority,'medium'), updated_at 
		FROM claims WHERE 1=1`
	args := []interface{}{}
	n := 1

	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", n); args = append(args, filter.Status); n++
	}
	if filter.CustomerID != "" {
		query += fmt.Sprintf(" AND customer_id = $%d", n); args = append(args, filter.CustomerID); n++
	}
	if filter.PolicyID != "" {
		query += fmt.Sprintf(" AND policy_id = $%d", n); args = append(args, filter.PolicyID); n++
	}
	query += " ORDER BY filed_date DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil { return nil, err }
	defer rows.Close()

	var claims []models.Claim
	for rows.Next() {
		var c models.Claim
		if err := rows.Scan(&c.ID, &c.PolicyID, &c.CustomerID, &c.Amount, &c.Status, &c.Description,
			&c.ClaimType, &c.IncidentDate, &c.FiledDate, &c.ApprovedAmount, &c.RejectionReason,
			&c.AssignedTo, &c.Priority, &c.UpdatedAt); err != nil {
			continue
		}
		claims = append(claims, c)
	}
	return claims, nil
}

func (r *ClaimRepository) UpdateStatus(ctx context.Context, id, status string) error {
	now := time.Now()
	query := `UPDATE claims SET status = $1, updated_at = $2 WHERE id = $3`
	res, err := r.db.ExecContext(ctx, query, status, now, id)
	if err != nil { return err }
	if n, _ := res.RowsAffected(); n == 0 { return fmt.Errorf("claim not found: %s", id) }
	return nil
}

func (r *ClaimRepository) Update(ctx context.Context, claim *models.Claim) error {
	claim.UpdatedAt = time.Now()
	query := `UPDATE claims SET amount=$1, description=$2, incident_date=$3, approved_amount=$4, rejection_reason=$5, assigned_to=$6, priority=$7, updated_at=$8 WHERE id=$9`
	res, err := r.db.ExecContext(ctx, query, claim.Amount, claim.Description, claim.IncidentDate,
		claim.ApprovedAmount, claim.RejectionReason, claim.AssignedTo, claim.Priority, claim.UpdatedAt, claim.ID)
	if err != nil { return err }
	if n, _ := res.RowsAffected(); n == 0 { return fmt.Errorf("claim not found") }
	return nil
}

func (r *ClaimRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM claims WHERE id = $1", id)
	if err != nil { return err }
	if n, _ := res.RowsAffected(); n == 0 { return fmt.Errorf("claim not found") }
	return nil
}

func (r *ClaimRepository) CreateDocument(ctx context.Context, doc *models.ClaimDocument) error {
	doc.ID = uuid.New().String()
	doc.UploadedAt = time.Now()
	query := `INSERT INTO claim_documents (id, claim_id, document_type, document_url, uploaded_at) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query, doc.ID, doc.ClaimID, doc.DocumentType, doc.DocumentURL, doc.UploadedAt)
	return err
}

func (r *ClaimRepository) ListDocuments(ctx context.Context, claimID string) ([]models.ClaimDocument, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, claim_id, document_type, document_url, uploaded_at FROM claim_documents WHERE claim_id = $1 ORDER BY uploaded_at DESC", claimID)
	if err != nil { return nil, err }
	defer rows.Close()
	var docs []models.ClaimDocument
	for rows.Next() {
		var d models.ClaimDocument
		if err := rows.Scan(&d.ID, &d.ClaimID, &d.DocumentType, &d.DocumentURL, &d.UploadedAt); err != nil { continue }
		docs = append(docs, d)
	}
	return docs, nil
}

func (r *ClaimRepository) CreateNote(ctx context.Context, note *models.ClaimNote) error {
	note.ID = uuid.New().String()
	note.CreatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, "INSERT INTO claim_notes (id, claim_id, author, content, created_at) VALUES ($1,$2,$3,$4,$5)",
		note.ID, note.ClaimID, note.Author, note.Content, note.CreatedAt)
	return err
}

func (r *ClaimRepository) ListNotes(ctx context.Context, claimID string) ([]models.ClaimNote, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, claim_id, author, content, created_at FROM claim_notes WHERE claim_id = $1 ORDER BY created_at DESC", claimID)
	if err != nil { return nil, err }
	defer rows.Close()
	var notes []models.ClaimNote
	for rows.Next() {
		var n models.ClaimNote
		if err := rows.Scan(&n.ID, &n.ClaimID, &n.Author, &n.Content, &n.CreatedAt); err != nil { continue }
		notes = append(notes, n)
	}
	return notes, nil
}
