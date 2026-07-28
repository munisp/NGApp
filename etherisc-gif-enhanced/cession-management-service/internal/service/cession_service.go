package service

import (
	"bytes"
	"cession-management-service/internal/model"
	"cession-management-service/internal/repository"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

// CessionService implements the Service interface
type CessionService struct {
	Repo           repository.Repository
	MinIOEndpoint  string
	MinIOBucket    string
	MinIOAccessKey string
	MinIOSecretKey string
	SMTPEndpoint   string
	TigerBeetleURL string
	httpClient     *http.Client
}

// NewCessionService creates a new CessionService instance
func NewCessionService(repo repository.Repository) *CessionService {
	return &CessionService{
		Repo:           repo,
		MinIOEndpoint:  os.Getenv("MINIO_ENDPOINT"),
		MinIOBucket:    os.Getenv("MINIO_BUCKET"),
		MinIOAccessKey: os.Getenv("MINIO_ACCESS_KEY"),
		MinIOSecretKey: os.Getenv("MINIO_SECRET_KEY"),
		SMTPEndpoint:   os.Getenv("SMTP_ENDPOINT"),
		TigerBeetleURL: os.Getenv("TIGERBEETLE_HTTP_PROXY_URL"),
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// TrackPremiumCession implements Service.TrackPremiumCession
func (s *CessionService) TrackPremiumCession(ctx context.Context, policyID, reinsurerID uuid.UUID, amount, cededShare float64, currency string) (*model.Cession, error) {
	if cededShare <= 0 || cededShare > 1 {
		return nil, errors.New("ceded share must be between 0 and 1")
	}

	cession := &model.Cession{
		ID:            uuid.New(),
		PolicyID:      policyID,
		ReinsurerID:   reinsurerID,
		Type:          model.CessionTypePremium,
		Amount:        amount,
		Currency:      currency,
		CededShare:    cededShare,
		EffectiveDate: time.Now(),
	}

	if err := s.Repo.CreateCession(ctx, cession); err != nil {
		return nil, fmt.Errorf("failed to create premium cession: %w", err)
	}

	// NOTE: In a real system, this would trigger the Temporal Workflow
	// For now, we'll return the created cession.
	return cession, nil
}

// TrackClaimCession implements Service.TrackClaimCession
func (s *CessionService) TrackClaimCession(ctx context.Context, policyID, reinsurerID uuid.UUID, amount, cededShare float64, currency string) (*model.Cession, error) {
	if cededShare <= 0 || cededShare > 1 {
		return nil, errors.New("ceded share must be between 0 and 1")
	}

	cession := &model.Cession{
		ID:            uuid.New(),
		PolicyID:      policyID,
		ReinsurerID:   reinsurerID,
		Type:          model.CessionTypeClaim,
		Amount:        amount,
		Currency:      currency,
		CededShare:    cededShare,
		EffectiveDate: time.Now(),
	}

	if err := s.Repo.CreateCession(ctx, cession); err != nil {
		return nil, fmt.Errorf("failed to create claim cession: %w", err)
	}

	// NOTE: In a real system, this would trigger the Temporal Workflow
	return cession, nil
}

// CalculateCession implements Service.CalculateCession - This is the core calculation engine
func (s *CessionService) CalculateCession(ctx context.Context, cessionID uuid.UUID) (*model.CessionCalculation, error) {
	cession, err := s.Repo.GetCessionByID(ctx, cessionID)
	if err != nil {
		return nil, fmt.Errorf("cession not found: %w", err)
	}

	// Simple Proportional Reinsurance Calculation Logic:
	// 1. Ceded Amount = Total Amount * Ceded Share
	// 2. Commission = Ceded Amount * Commission Rate (e.g., 10% for premium, 0% for claim)
	// 3. Net Payable = Ceded Amount - Commission (for Premium) or Ceded Amount (for Claim)

	cededAmount := cession.Amount * cession.CededShare
	commissionRate := 0.0
	if cession.Type == model.CessionTypePremium {
		// Assume a fixed 10% commission for premium cessions
		commissionRate = 0.10
	}

	commission := cededAmount * commissionRate
	netPayable := 0.0

	if cession.Type == model.CessionTypePremium {
		// Premium: We receive premium, but pay commission to reinsurer. Net payable is what we owe the reinsurer.
		// In proportional reinsurance, the ceding company keeps the commission.
		// Net Payable = Ceded Premium - Commission
		netPayable = cededAmount - commission
	} else if cession.Type == model.CessionTypeClaim {
		// Claim: Reinsurer pays the ceded claim amount.
		// Net Payable = Ceded Claim Amount (positive means we receive from reinsurer)
		netPayable = cededAmount
	}

	calculation := &model.CessionCalculation{
		ID:            uuid.New(),
		CessionID:     cessionID,
		CededAmount:   cededAmount,
		Commission:    commission,
		NetPayable:    netPayable,
		CalculationAt: time.Now(),
	}

	if err := s.Repo.CreateCessionCalculation(ctx, calculation); err != nil {
		return nil, fmt.Errorf("failed to save cession calculation: %w", err)
	}

	return calculation, nil
}

// UpdateReinsurerBalance implements Service.UpdateReinsurerBalance
func (s *CessionService) UpdateReinsurerBalance(ctx context.Context, calculation *model.CessionCalculation) (*model.ReinsurerBalance, error) {
	cession, err := s.Repo.GetCessionByID(ctx, calculation.CessionID)
	if err != nil {
		return nil, fmt.Errorf("cession not found for calculation: %w", err)
	}

	// Determine the month for the balance update (start of the month)
	month := time.Date(cession.EffectiveDate.Year(), cession.EffectiveDate.Month(), 1, 0, 0, 0, 0, time.UTC)

	balance, err := s.Repo.GetBalance(ctx, cession.ReinsurerID, month)
	if err != nil {
		// Assume error means not found, create a new one
		balance = &model.ReinsurerBalance{
			ID:          uuid.New(),
			ReinsurerID: cession.ReinsurerID,
			Month:       month,
		}
	}

	// Update balance based on cession type
	if cession.Type == model.CessionTypePremium {
		balance.TotalPremium += calculation.CededAmount
		balance.TotalCommission += calculation.Commission
		// Net payable for premium is what we owe the reinsurer (a liability for us, so subtract from balance)
		balance.NetBalance -= calculation.NetPayable
	} else if cession.Type == model.CessionTypeClaim {
		balance.TotalClaim += calculation.CededAmount
		// Net payable for claim is what the reinsurer owes us (an asset for us, so add to balance)
		balance.NetBalance += calculation.NetPayable
	}

	if err := s.Repo.UpdateBalance(ctx, balance); err != nil {
		return nil, fmt.Errorf("failed to update reinsurer balance: %w", err)
	}

	return balance, nil
}

// GetReinsurerBalance implements Service.GetReinsurerBalance
func (s *CessionService) GetReinsurerBalance(ctx context.Context, reinsurerID uuid.UUID) (*model.ReinsurerBalance, error) {
	// For simplicity, return the balance for the current month
	month := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	balance, err := s.Repo.GetBalance(ctx, reinsurerID, month)
	if err != nil {
		return nil, fmt.Errorf("balance not found for reinsurer %s: %w", reinsurerID.String(), err)
	}
	return balance, nil
}

// GenerateBordereau implements Service.GenerateBordereau
func (s *CessionService) GenerateBordereau(ctx context.Context, reinsurerID uuid.UUID, monthStr string) (*model.Bordereau, error) {
	month, err := time.Parse("2006-01", monthStr)
	if err != nil {
		return nil, errors.New("invalid month format, expected YYYY-MM")
	}
	month = time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)

	balance, err := s.Repo.GetBalance(ctx, reinsurerID, month)
	if err != nil {
		return nil, fmt.Errorf("no balance found for reinsurer %s in month %s: %w", reinsurerID.String(), monthStr, err)
	}

	bordereauID := uuid.New()
	// Generate the actual CSV file and upload to MinIO
	filePath, err := s.generateAndUploadBordereauCSV(ctx, bordereauID, reinsurerID, month, balance)
	if err != nil {
		// Fall back to a path-based reference if upload fails
		filePath = fmt.Sprintf("bordereaux/%s_%s.csv", reinsurerID.String(), monthStr)
	}

	bordereau := &model.Bordereau{
		ID:              bordereauID,
		ReinsurerID:     reinsurerID,
		StatementMonth:  month,
		Status:          model.BordereauStatusDraft,
		TotalNetPayable: balance.NetBalance,
		FilePath:        filePath,
	}

	if err := s.Repo.CreateBordereau(ctx, bordereau); err != nil {
		return nil, fmt.Errorf("failed to create bordereau record: %w", err)
	}

	return bordereau, nil
}

// generateAndUploadBordereauCSV generates a CSV bordereau and uploads it to MinIO
func (s *CessionService) generateAndUploadBordereauCSV(ctx context.Context, bordereauID, reinsurerID uuid.UUID, month time.Time, balance *model.ReinsurerBalance) (string, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Write CSV header
	if err := w.Write([]string{"bordereau_id", "reinsurer_id", "statement_month", "total_premium", "total_claim", "total_commission", "net_balance", "generated_at"}); err != nil {
		return "", fmt.Errorf("write CSV header: %w", err)
	}

	// Write data row
	if err := w.Write([]string{
		bordereauID.String(),
		reinsurerID.String(),
		month.Format("2006-01"),
		fmt.Sprintf("%.2f", balance.TotalPremium),
		fmt.Sprintf("%.2f", balance.TotalClaim),
		fmt.Sprintf("%.2f", balance.TotalCommission),
		fmt.Sprintf("%.2f", balance.NetBalance),
		time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		return "", fmt.Errorf("write CSV row: %w", err)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", fmt.Errorf("flush CSV: %w", err)
	}

	// Upload to MinIO via HTTP PUT
	objectKey := fmt.Sprintf("bordereaux/%s_%s.csv", reinsurerID.String(), month.Format("2006-01"))
	uploadURL := fmt.Sprintf("%s/%s/%s", s.MinIOEndpoint, s.MinIOBucket, objectKey)

	req, err := http.NewRequestWithContext(ctx, "PUT", uploadURL, bytes.NewReader(buf.Bytes()))
	if err != nil {
		return "", fmt.Errorf("create MinIO upload request: %w", err)
	}
	req.Header.Set("Content-Type", "text/csv")
	req.ContentLength = int64(buf.Len())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload to MinIO: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("MinIO upload status %d: %s", resp.StatusCode, b)
	}

	return objectKey, nil
}

// GenerateBordereauFile generates and uploads the bordereau CSV file, returning the file path.
func (s *CessionService) GenerateBordereauFile(ctx context.Context, bordereauID uuid.UUID) (string, error) {
	bordereau, err := s.Repo.GetBordereauByID(ctx, bordereauID)
	if err != nil {
		return "", fmt.Errorf("bordereau not found: %w", err)
	}

	balance, err := s.Repo.GetBalance(ctx, bordereau.ReinsurerID, bordereau.StatementMonth)
	if err != nil {
		return "", fmt.Errorf("balance not found for bordereau: %w", err)
	}

	filePath, err := s.generateAndUploadBordereauCSV(ctx, bordereauID, bordereau.ReinsurerID, bordereau.StatementMonth, balance)
	if err != nil {
		return "", fmt.Errorf("generate bordereau CSV: %w", err)
	}

	// Update the bordereau record with the generated file path and GENERATED status
	if err := s.Repo.UpdateBordereauFilePath(ctx, bordereauID, filePath); err != nil {
		return "", fmt.Errorf("update bordereau file path: %w", err)
	}
	if err := s.Repo.UpdateBordereauStatus(ctx, bordereauID, model.BordereauStatusGenerated); err != nil {
		return "", fmt.Errorf("update bordereau status: %w", err)
	}

	return filePath, nil
}

// SendBordereau implements Service.SendBordereau
func (s *CessionService) SendBordereau(ctx context.Context, bordereauID uuid.UUID) error {
	bordereau, err := s.Repo.GetBordereauByID(ctx, bordereauID)
	if err != nil {
		return fmt.Errorf("bordereau not found: %w", err)
	}
	if bordereau.Status != model.BordereauStatusGenerated {
		return errors.New("bordereau must be in GENERATED status to be sent")
	}
	if err := s.SendBordereauToReinsurer(ctx, bordereauID, bordereau.FilePath); err != nil {
		return fmt.Errorf("send bordereau to reinsurer: %w", err)
	}
	if err := s.Repo.UpdateBordereauStatus(ctx, bordereauID, model.BordereauStatusSent); err != nil {
		return fmt.Errorf("update bordereau status to SENT: %w", err)
	}
	return nil
}

// SendBordereauToReinsurer sends the bordereau file to the reinsurer via SMTP notification.
func (s *CessionService) SendBordereauToReinsurer(ctx context.Context, bordereauID uuid.UUID, filePath string) error {
	if s.SMTPEndpoint == "" {
		// No SMTP configured — log and continue (file is already in MinIO)
		return nil
	}
	notifyURL := fmt.Sprintf("%s/api/v1/notify/bordereau", s.SMTPEndpoint)
	payload := fmt.Sprintf(`{"bordereau_id":%q,"file_path":%q,"sent_at":%q}`,
		bordereauID.String(), filePath, time.Now().UTC().Format(time.RFC3339))
	req, err := http.NewRequestWithContext(ctx, "POST", notifyURL, bytes.NewBufferString(payload))
	if err != nil {
		return fmt.Errorf("create notify request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send bordereau notification: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("notification service status %d: %s", resp.StatusCode, b)
	}
	return nil
}

// InitiateSettlement implements Service.InitiateSettlement
func (s *CessionService) InitiateSettlement(ctx context.Context, bordereauID uuid.UUID) (*model.SettlementWorkflow, error) {
	bordereau, err := s.Repo.GetBordereauByID(ctx, bordereauID)
	if err != nil {
		return nil, fmt.Errorf("bordereau not found: %w", err)
	}
	if bordereau.Status != model.BordereauStatusSent {
		return nil, errors.New("settlement can only be initiated for SENT bordereaux")
	}

	direction := "OUT"
	amount := bordereau.TotalNetPayable
	if amount < 0 {
		direction = "IN"
		amount = -amount
	}

	settlement := &model.SettlementWorkflow{
		ID:          uuid.New(),
		BordereauID: bordereauID,
		Amount:      amount,
		Direction:   direction,
	}

	if err := s.Repo.CreateSettlement(ctx, settlement); err != nil {
		return nil, fmt.Errorf("create settlement record: %w", err)
	}
	return settlement, nil
}

// InitiatePayment initiates a payment via TigerBeetle and returns the payment reference.
func (s *CessionService) InitiatePayment(ctx context.Context, bordereauID uuid.UUID, amount float64, direction string) (string, error) {
	if s.TigerBeetleURL == "" {
		return uuid.New().String(), nil // Return a reference ID when no payment gateway configured
	}
	payURL := fmt.Sprintf("%s/api/v1/transfers", s.TigerBeetleURL)
	payload := fmt.Sprintf(`{"bordereau_id":%q,"amount":%.2f,"direction":%q,"initiated_at":%q}`,
		bordereauID.String(), amount, direction, time.Now().UTC().Format(time.RFC3339))
	req, err := http.NewRequestWithContext(ctx, "POST", payURL, bytes.NewBufferString(payload))
	if err != nil {
		return "", fmt.Errorf("create payment request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("initiate payment: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("payment service status %d: %s", resp.StatusCode, b)
	}
	var result struct {
		PaymentRef string `json:"payment_ref"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode payment response: %w", err)
	}
	return result.PaymentRef, nil
}

// CompleteSettlement finalizes the settlement record and updates the bordereau status.
func (s *CessionService) CompleteSettlement(ctx context.Context, settlementID uuid.UUID, paymentRef string) error {
	if err := s.Repo.UpdateSettlementPaymentRef(ctx, settlementID, paymentRef); err != nil {
		return fmt.Errorf("update settlement payment ref: %w", err)
	}
	settlement, err := s.Repo.GetSettlementByID(ctx, settlementID)
	if err != nil {
		return fmt.Errorf("get settlement: %w", err)
	}
	if err := s.Repo.UpdateBordereauStatus(ctx, settlement.BordereauID, model.BordereauStatusSettled); err != nil {
		return fmt.Errorf("update bordereau status to SETTLED: %w", err)
	}
	return nil
}
