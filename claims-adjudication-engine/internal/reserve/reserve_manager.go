package reserve

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ReserveManagerConfig holds configuration for reserve management
type ReserveManagerConfig struct {
	DefaultCurrency     string
	MinReserveRatio     float64
	MaxReserveRatio     float64
	AutoReleaseOnSettle bool
}

// ReserveManager handles claim reserve management
type ReserveManager struct {
	db     *gorm.DB
	config ReserveManagerConfig
}

// NewReserveManager creates a new reserve manager
func NewReserveManager(db *gorm.DB, config ReserveManagerConfig) *ReserveManager {
	if config.DefaultCurrency == "" {
		config.DefaultCurrency = "NGN"
	}
	if config.MinReserveRatio == 0 {
		config.MinReserveRatio = 1.0 // 100% of claim amount
	}
	if config.MaxReserveRatio == 0 {
		config.MaxReserveRatio = 1.5 // 150% of claim amount
	}
	return &ReserveManager{
		db:     db,
		config: config,
	}
}

// Reserve represents a claim reserve
type Reserve struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID         uuid.UUID       `json:"claim_id" gorm:"type:uuid;not null;uniqueIndex"`
	PolicyID        uuid.UUID       `json:"policy_id" gorm:"type:uuid;not null;index"`
	ReserveNumber   string          `json:"reserve_number" gorm:"type:varchar(50);uniqueIndex"`
	Status          ReserveStatus   `json:"status" gorm:"type:varchar(20);not null"`
	InitialAmount   float64         `json:"initial_amount" gorm:"type:decimal(20,2);not null"`
	CurrentAmount   float64         `json:"current_amount" gorm:"type:decimal(20,2);not null"`
	PaidAmount      float64         `json:"paid_amount" gorm:"type:decimal(20,2);default:0"`
	ReleasedAmount  float64         `json:"released_amount" gorm:"type:decimal(20,2);default:0"`
	Currency        string          `json:"currency" gorm:"type:varchar(3);default:'NGN'"`
	ReserveType     ReserveType     `json:"reserve_type" gorm:"type:varchar(30);not null"`
	ProductType     string          `json:"product_type" gorm:"type:varchar(50)"`
	ClaimType       string          `json:"claim_type" gorm:"type:varchar(50)"`
	EstimatedLoss   float64         `json:"estimated_loss" gorm:"type:decimal(20,2)"`
	ActualLoss      *float64        `json:"actual_loss" gorm:"type:decimal(20,2)"`
	ReinsuranceCession float64      `json:"reinsurance_cession" gorm:"type:decimal(20,2);default:0"`
	NetReserve      float64         `json:"net_reserve" gorm:"type:decimal(20,2)"`
	CreatedBy       uuid.UUID       `json:"created_by" gorm:"type:uuid"`
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	ClosedAt        *time.Time      `json:"closed_at"`
	ClosedBy        *uuid.UUID      `json:"closed_by" gorm:"type:uuid"`
	CloseReason     string          `json:"close_reason" gorm:"type:text"`
	Adjustments     []ReserveAdjustment `json:"adjustments" gorm:"foreignKey:ReserveID"`
	Transactions    []ReserveTransaction `json:"transactions" gorm:"foreignKey:ReserveID"`
}

// ReserveStatus represents the status of a reserve
type ReserveStatus string

const (
	ReserveStatusActive    ReserveStatus = "ACTIVE"
	ReserveStatusPartial   ReserveStatus = "PARTIAL"    // Partially paid
	ReserveStatusSettled   ReserveStatus = "SETTLED"    // Fully paid
	ReserveStatusReleased  ReserveStatus = "RELEASED"   // Released without payment
	ReserveStatusClosed    ReserveStatus = "CLOSED"
)

// ReserveType represents the type of reserve
type ReserveType string

const (
	ReserveTypeCaseReserve    ReserveType = "CASE"       // Individual claim reserve
	ReserveTypeIBNR           ReserveType = "IBNR"       // Incurred But Not Reported
	ReserveTypeIBNER          ReserveType = "IBNER"      // Incurred But Not Enough Reported
	ReserveTypeCatastrophe    ReserveType = "CAT"        // Catastrophe reserve
	ReserveTypeUnallocated    ReserveType = "UNALLOCATED"
)

// ReserveAdjustment represents an adjustment to a reserve
type ReserveAdjustment struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReserveID     uuid.UUID `json:"reserve_id" gorm:"type:uuid;not null;index"`
	AdjustmentType string   `json:"adjustment_type" gorm:"type:varchar(20);not null"`
	PreviousAmount float64  `json:"previous_amount" gorm:"type:decimal(20,2)"`
	NewAmount     float64   `json:"new_amount" gorm:"type:decimal(20,2)"`
	ChangeAmount  float64   `json:"change_amount" gorm:"type:decimal(20,2)"`
	Reason        string    `json:"reason" gorm:"type:text"`
	AdjustedBy    uuid.UUID `json:"adjusted_by" gorm:"type:uuid"`
	AdjustedAt    time.Time `json:"adjusted_at" gorm:"autoCreateTime"`
	ApprovedBy    *uuid.UUID `json:"approved_by" gorm:"type:uuid"`
	ApprovedAt    *time.Time `json:"approved_at"`
}

// ReserveTransaction represents a transaction against a reserve
type ReserveTransaction struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReserveID       uuid.UUID `json:"reserve_id" gorm:"type:uuid;not null;index"`
	TransactionType string    `json:"transaction_type" gorm:"type:varchar(20);not null"`
	Amount          float64   `json:"amount" gorm:"type:decimal(20,2);not null"`
	Reference       string    `json:"reference" gorm:"type:varchar(100)"`
	Description     string    `json:"description" gorm:"type:text"`
	PaymentID       *uuid.UUID `json:"payment_id" gorm:"type:uuid"`
	ProcessedBy     uuid.UUID `json:"processed_by" gorm:"type:uuid"`
	ProcessedAt     time.Time `json:"processed_at" gorm:"autoCreateTime"`
}

// CreateReserve creates a new reserve for a claim
func (m *ReserveManager) CreateReserve(ctx context.Context, reserve *Reserve) error {
	reserve.ID = uuid.New()
	reserve.ReserveNumber = fmt.Sprintf("RSV-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
	reserve.Status = ReserveStatusActive
	reserve.CurrentAmount = reserve.InitialAmount
	reserve.NetReserve = reserve.InitialAmount - reserve.ReinsuranceCession

	if reserve.Currency == "" {
		reserve.Currency = m.config.DefaultCurrency
	}

	if err := m.db.WithContext(ctx).Create(reserve).Error; err != nil {
		return err
	}

	// Create initial adjustment record
	adjustment := ReserveAdjustment{
		ID:             uuid.New(),
		ReserveID:      reserve.ID,
		AdjustmentType: "INITIAL",
		PreviousAmount: 0,
		NewAmount:      reserve.InitialAmount,
		ChangeAmount:   reserve.InitialAmount,
		Reason:         "Initial reserve creation",
		AdjustedBy:     reserve.CreatedBy,
		AdjustedAt:     time.Now(),
	}
	m.db.WithContext(ctx).Create(&adjustment)

	return nil
}

// AdjustReserve adjusts the reserve amount
func (m *ReserveManager) AdjustReserve(ctx context.Context, reserveID uuid.UUID, newAmount float64, reason string, adjustedBy uuid.UUID) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	if reserve.Status == ReserveStatusClosed || reserve.Status == ReserveStatusSettled {
		return fmt.Errorf("cannot adjust a closed or settled reserve")
	}

	// Validate adjustment
	if newAmount < reserve.PaidAmount {
		return fmt.Errorf("new reserve amount cannot be less than paid amount")
	}

	previousAmount := reserve.CurrentAmount
	changeAmount := newAmount - previousAmount

	// Create adjustment record
	adjustment := ReserveAdjustment{
		ID:             uuid.New(),
		ReserveID:      reserveID,
		AdjustmentType: "ADJUSTMENT",
		PreviousAmount: previousAmount,
		NewAmount:      newAmount,
		ChangeAmount:   changeAmount,
		Reason:         reason,
		AdjustedBy:     adjustedBy,
		AdjustedAt:     time.Now(),
	}

	if err := m.db.WithContext(ctx).Create(&adjustment).Error; err != nil {
		return err
	}

	// Update reserve
	reserve.CurrentAmount = newAmount
	reserve.NetReserve = newAmount - reserve.ReinsuranceCession

	return m.db.WithContext(ctx).Save(&reserve).Error
}

// RecordPayment records a payment against the reserve
func (m *ReserveManager) RecordPayment(ctx context.Context, reserveID uuid.UUID, amount float64, paymentID *uuid.UUID, reference string, processedBy uuid.UUID) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	if reserve.Status == ReserveStatusClosed {
		return fmt.Errorf("cannot record payment on a closed reserve")
	}

	if amount > reserve.CurrentAmount-reserve.PaidAmount {
		return fmt.Errorf("payment amount exceeds available reserve")
	}

	// Create transaction record
	transaction := ReserveTransaction{
		ID:              uuid.New(),
		ReserveID:       reserveID,
		TransactionType: "PAYMENT",
		Amount:          amount,
		Reference:       reference,
		Description:     fmt.Sprintf("Payment of %.2f %s", amount, reserve.Currency),
		PaymentID:       paymentID,
		ProcessedBy:     processedBy,
		ProcessedAt:     time.Now(),
	}

	if err := m.db.WithContext(ctx).Create(&transaction).Error; err != nil {
		return err
	}

	// Update reserve
	reserve.PaidAmount += amount
	if reserve.PaidAmount >= reserve.CurrentAmount {
		reserve.Status = ReserveStatusSettled
	} else if reserve.PaidAmount > 0 {
		reserve.Status = ReserveStatusPartial
	}

	return m.db.WithContext(ctx).Save(&reserve).Error
}

// ReleaseReserve releases unused reserve
func (m *ReserveManager) ReleaseReserve(ctx context.Context, reserveID uuid.UUID, amount float64, reason string, releasedBy uuid.UUID) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	if reserve.Status == ReserveStatusClosed {
		return fmt.Errorf("cannot release a closed reserve")
	}

	availableToRelease := reserve.CurrentAmount - reserve.PaidAmount - reserve.ReleasedAmount
	if amount > availableToRelease {
		return fmt.Errorf("release amount exceeds available reserve")
	}

	// Create transaction record
	transaction := ReserveTransaction{
		ID:              uuid.New(),
		ReserveID:       reserveID,
		TransactionType: "RELEASE",
		Amount:          amount,
		Description:     fmt.Sprintf("Reserve release: %s", reason),
		ProcessedBy:     releasedBy,
		ProcessedAt:     time.Now(),
	}

	if err := m.db.WithContext(ctx).Create(&transaction).Error; err != nil {
		return err
	}

	// Update reserve
	reserve.ReleasedAmount += amount
	if reserve.PaidAmount+reserve.ReleasedAmount >= reserve.CurrentAmount {
		reserve.Status = ReserveStatusReleased
	}

	return m.db.WithContext(ctx).Save(&reserve).Error
}

// CloseReserve closes a reserve
func (m *ReserveManager) CloseReserve(ctx context.Context, reserveID uuid.UUID, reason string, closedBy uuid.UUID) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	if reserve.Status == ReserveStatusClosed {
		return fmt.Errorf("reserve is already closed")
	}

	// Release any remaining reserve
	remainingAmount := reserve.CurrentAmount - reserve.PaidAmount - reserve.ReleasedAmount
	if remainingAmount > 0 {
		if err := m.ReleaseReserve(ctx, reserveID, remainingAmount, "Closing reserve", closedBy); err != nil {
			return err
		}
	}

	now := time.Now()
	reserve.Status = ReserveStatusClosed
	reserve.ClosedAt = &now
	reserve.ClosedBy = &closedBy
	reserve.CloseReason = reason

	return m.db.WithContext(ctx).Save(&reserve).Error
}

// GetReserve gets a reserve by ID
func (m *ReserveManager) GetReserve(ctx context.Context, reserveID uuid.UUID) (*Reserve, error) {
	var reserve Reserve
	err := m.db.WithContext(ctx).
		Preload("Adjustments").
		Preload("Transactions").
		First(&reserve, "id = ?", reserveID).Error
	if err != nil {
		return nil, err
	}
	return &reserve, nil
}

// GetReserveByClaimID gets a reserve by claim ID
func (m *ReserveManager) GetReserveByClaimID(ctx context.Context, claimID uuid.UUID) (*Reserve, error) {
	var reserve Reserve
	err := m.db.WithContext(ctx).
		Preload("Adjustments").
		Preload("Transactions").
		First(&reserve, "claim_id = ?", claimID).Error
	if err != nil {
		return nil, err
	}
	return &reserve, nil
}

// GetReservesByPolicyID gets all reserves for a policy
func (m *ReserveManager) GetReservesByPolicyID(ctx context.Context, policyID uuid.UUID) ([]Reserve, error) {
	var reserves []Reserve
	err := m.db.WithContext(ctx).
		Where("policy_id = ?", policyID).
		Order("created_at DESC").
		Find(&reserves).Error
	return reserves, err
}

// GetActiveReserves gets all active reserves
func (m *ReserveManager) GetActiveReserves(ctx context.Context) ([]Reserve, error) {
	var reserves []Reserve
	err := m.db.WithContext(ctx).
		Where("status IN ?", []ReserveStatus{ReserveStatusActive, ReserveStatusPartial}).
		Order("created_at DESC").
		Find(&reserves).Error
	return reserves, err
}

// CalculateReserveAdequacy calculates reserve adequacy metrics
func (m *ReserveManager) CalculateReserveAdequacy(ctx context.Context, productType string) (*ReserveAdequacy, error) {
	var adequacy ReserveAdequacy

	query := m.db.WithContext(ctx).Model(&Reserve{})
	if productType != "" {
		query = query.Where("product_type = ?", productType)
	}

	// Total reserves
	query.Where("status IN ?", []ReserveStatus{ReserveStatusActive, ReserveStatusPartial}).
		Select("SUM(current_amount)").Scan(&adequacy.TotalReserves)

	// Total paid
	query.Select("SUM(paid_amount)").Scan(&adequacy.TotalPaid)

	// Total released
	query.Select("SUM(released_amount)").Scan(&adequacy.TotalReleased)

	// Calculate ratios
	if adequacy.TotalReserves > 0 {
		adequacy.PaidRatio = adequacy.TotalPaid / adequacy.TotalReserves * 100
		adequacy.ReleaseRatio = adequacy.TotalReleased / adequacy.TotalReserves * 100
	}

	// Net reserves
	adequacy.NetReserves = adequacy.TotalReserves - adequacy.TotalPaid - adequacy.TotalReleased

	// Count by status
	m.db.WithContext(ctx).Model(&Reserve{}).Where("status = ?", ReserveStatusActive).Count(&adequacy.ActiveCount)
	m.db.WithContext(ctx).Model(&Reserve{}).Where("status = ?", ReserveStatusPartial).Count(&adequacy.PartialCount)
	m.db.WithContext(ctx).Model(&Reserve{}).Where("status = ?", ReserveStatusSettled).Count(&adequacy.SettledCount)

	return &adequacy, nil
}

// ReserveAdequacy represents reserve adequacy metrics
type ReserveAdequacy struct {
	TotalReserves float64 `json:"total_reserves"`
	TotalPaid     float64 `json:"total_paid"`
	TotalReleased float64 `json:"total_released"`
	NetReserves   float64 `json:"net_reserves"`
	PaidRatio     float64 `json:"paid_ratio"`
	ReleaseRatio  float64 `json:"release_ratio"`
	ActiveCount   int64   `json:"active_count"`
	PartialCount  int64   `json:"partial_count"`
	SettledCount  int64   `json:"settled_count"`
}

// GetReserveStats gets reserve statistics
func (m *ReserveManager) GetReserveStats(ctx context.Context, startDate, endDate time.Time) (*ReserveStats, error) {
	var stats ReserveStats

	// Total reserves created
	m.db.WithContext(ctx).Model(&Reserve{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Count(&stats.TotalCreated)

	// Total amount reserved
	m.db.WithContext(ctx).Model(&Reserve{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Select("COALESCE(SUM(initial_amount), 0)").Scan(&stats.TotalAmountReserved)

	// Total adjustments
	m.db.WithContext(ctx).Model(&ReserveAdjustment{}).
		Where("adjusted_at BETWEEN ? AND ?", startDate, endDate).
		Count(&stats.TotalAdjustments)

	// Net adjustment amount
	m.db.WithContext(ctx).Model(&ReserveAdjustment{}).
		Where("adjusted_at BETWEEN ? AND ?", startDate, endDate).
		Select("COALESCE(SUM(change_amount), 0)").Scan(&stats.NetAdjustmentAmount)

	// Total payments
	m.db.WithContext(ctx).Model(&ReserveTransaction{}).
		Where("processed_at BETWEEN ? AND ? AND transaction_type = ?", startDate, endDate, "PAYMENT").
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalPayments)

	// Total releases
	m.db.WithContext(ctx).Model(&ReserveTransaction{}).
		Where("processed_at BETWEEN ? AND ? AND transaction_type = ?", startDate, endDate, "RELEASE").
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalReleases)

	// By product type
	var byProduct []struct {
		ProductType string  `json:"product_type"`
		Amount      float64 `json:"amount"`
	}
	m.db.WithContext(ctx).Model(&Reserve{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Select("product_type, SUM(initial_amount) as amount").
		Group("product_type").
		Scan(&byProduct)

	stats.ByProductType = make(map[string]float64)
	for _, p := range byProduct {
		stats.ByProductType[p.ProductType] = p.Amount
	}

	return &stats, nil
}

// ReserveStats represents reserve statistics
type ReserveStats struct {
	TotalCreated        int64              `json:"total_created"`
	TotalAmountReserved float64            `json:"total_amount_reserved"`
	TotalAdjustments    int64              `json:"total_adjustments"`
	NetAdjustmentAmount float64            `json:"net_adjustment_amount"`
	TotalPayments       float64            `json:"total_payments"`
	TotalReleases       float64            `json:"total_releases"`
	ByProductType       map[string]float64 `json:"by_product_type"`
}

// SetReinsuranceCession sets the reinsurance cession for a reserve
func (m *ReserveManager) SetReinsuranceCession(ctx context.Context, reserveID uuid.UUID, cessionAmount float64, updatedBy uuid.UUID) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	reserve.ReinsuranceCession = cessionAmount
	reserve.NetReserve = reserve.CurrentAmount - cessionAmount

	return m.db.WithContext(ctx).Save(&reserve).Error
}

// SetActualLoss sets the actual loss amount for a reserve
func (m *ReserveManager) SetActualLoss(ctx context.Context, reserveID uuid.UUID, actualLoss float64) error {
	var reserve Reserve
	if err := m.db.WithContext(ctx).First(&reserve, "id = ?", reserveID).Error; err != nil {
		return err
	}

	reserve.ActualLoss = &actualLoss

	return m.db.WithContext(ctx).Save(&reserve).Error
}
