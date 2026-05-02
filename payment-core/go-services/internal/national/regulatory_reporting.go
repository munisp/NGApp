// Package national implements national payment switch components
package national

import (
	"crypto/sha256"
	"encoding/hex"
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// ReportType defines the type of regulatory report
type ReportType string

const (
	ReportTypeDailyLiquidity      ReportType = "DAILY_LIQUIDITY"
	ReportTypeDailyPosition       ReportType = "DAILY_POSITION"
	ReportTypeDailySettlement     ReportType = "DAILY_SETTLEMENT"
	ReportTypeTransactionVolume   ReportType = "TRANSACTION_VOLUME"
	ReportTypeSuspiciousActivity  ReportType = "SUSPICIOUS_ACTIVITY"
	ReportTypeLargeTransaction    ReportType = "LARGE_TRANSACTION"
	ReportTypeParticipantStatus   ReportType = "PARTICIPANT_STATUS"
	ReportTypeSystemAvailability  ReportType = "SYSTEM_AVAILABILITY"
	ReportTypeIncidentSummary     ReportType = "INCIDENT_SUMMARY"
	ReportTypeAMLCompliance       ReportType = "AML_COMPLIANCE"
	ReportTypeCTR                 ReportType = "CTR" // Currency Transaction Report
	ReportTypeSAR                 ReportType = "SAR" // Suspicious Activity Report
)

// ReportFormat defines the output format
type ReportFormat string

const (
	ReportFormatJSON ReportFormat = "JSON"
	ReportFormatXML  ReportFormat = "XML"
	ReportFormatCSV  ReportFormat = "CSV"
	ReportFormatISO20022 ReportFormat = "ISO20022"
)

// ReportFrequency defines how often reports are generated
type ReportFrequency string

const (
	ReportFrequencyRealtime ReportFrequency = "REALTIME"
	ReportFrequencyHourly   ReportFrequency = "HOURLY"
	ReportFrequencyDaily    ReportFrequency = "DAILY"
	ReportFrequencyWeekly   ReportFrequency = "WEEKLY"
	ReportFrequencyMonthly  ReportFrequency = "MONTHLY"
	ReportFrequencyQuarterly ReportFrequency = "QUARTERLY"
	ReportFrequencyAnnual   ReportFrequency = "ANNUAL"
)

// RegulatoryReportingService handles regulatory report generation and submission
type RegulatoryReportingService struct {
	db              *sql.DB
	auditLogger     *ImmutableAuditLogger
	hsmManager      *HSMKeyManager
	config          *ReportingConfig
	schedules       map[ReportType]*ReportSchedule
	mu              sync.RWMutex
}

// ReportingConfig holds reporting configuration
type ReportingConfig struct {
	CentralBankCode     string
	InstitutionCode     string
	ReportingCurrency   string
	LargeTransactionThreshold int64
	SuspiciousPatterns  []string
	RetentionYears      int
	SubmissionEndpoint  string
	SubmissionAPIKey    string
}

// ReportSchedule defines when a report should be generated
type ReportSchedule struct {
	ReportType  ReportType
	Frequency   ReportFrequency
	Format      ReportFormat
	Recipients  []string
	NextRun     time.Time
	LastRun     *time.Time
	Enabled     bool
}

// NewRegulatoryReportingService creates a new regulatory reporting service
func NewRegulatoryReportingService(db *sql.DB, audit *ImmutableAuditLogger, hsm *HSMKeyManager, config *ReportingConfig) *RegulatoryReportingService {
	return &RegulatoryReportingService{
		db:          db,
		auditLogger: audit,
		hsmManager:  hsm,
		config:      config,
		schedules:   make(map[ReportType]*ReportSchedule),
	}
}

// Report represents a generated regulatory report
type Report struct {
	ReportID        string          `json:"report_id" xml:"ReportId"`
	ReportType      ReportType      `json:"report_type" xml:"ReportType"`
	ReportingPeriod *ReportingPeriod `json:"reporting_period" xml:"ReportingPeriod"`
	GeneratedAt     time.Time       `json:"generated_at" xml:"GeneratedAt"`
	InstitutionCode string          `json:"institution_code" xml:"InstitutionCode"`
	Format          ReportFormat    `json:"format" xml:"Format"`
	Data            interface{}     `json:"data" xml:"Data"`
	Hash            string          `json:"hash" xml:"Hash"`
	Signature       string          `json:"signature,omitempty" xml:"Signature,omitempty"`
	Status          ReportStatus    `json:"status" xml:"Status"`
}

// ReportingPeriod defines the time period covered by a report
type ReportingPeriod struct {
	StartDate time.Time `json:"start_date" xml:"StartDate"`
	EndDate   time.Time `json:"end_date" xml:"EndDate"`
}

// ReportStatus defines the status of a report
type ReportStatus string

const (
	ReportStatusGenerated  ReportStatus = "GENERATED"
	ReportStatusSubmitted  ReportStatus = "SUBMITTED"
	ReportStatusAccepted   ReportStatus = "ACCEPTED"
	ReportStatusRejected   ReportStatus = "REJECTED"
	ReportStatusPending    ReportStatus = "PENDING"
)

// GenerateDailyLiquidityReport generates the daily liquidity report
func (s *RegulatoryReportingService) GenerateDailyLiquidityReport(ctx context.Context, date time.Time) (*Report, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	// Query liquidity positions
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.participant_id, p.participant_name, pc.currency,
		       pc.net_debit_cap, pc.current_position, pc.available_limit,
		       pc.reserved_amount
		FROM participants p
		JOIN participant_currencies pc ON p.participant_id = pc.participant_id
		WHERE p.status = 'ACTIVE'
		ORDER BY p.participant_name, pc.currency
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query liquidity positions: %w", err)
	}
	defer rows.Close()

	var positions []*LiquidityPosition
	for rows.Next() {
		pos := &LiquidityPosition{}
		err := rows.Scan(
			&pos.ParticipantID, &pos.ParticipantName, &pos.Currency,
			&pos.NetDebitCap, &pos.CurrentPosition, &pos.AvailableLimit,
			&pos.ReservedAmount,
		)
		if err != nil {
			continue
		}
		pos.UtilizationRate = float64(pos.CurrentPosition) / float64(pos.NetDebitCap) * 100
		positions = append(positions, pos)
	}

	// Calculate aggregates
	aggregates := s.calculateLiquidityAggregates(positions)

	reportData := &DailyLiquidityReportData{
		Positions:  positions,
		Aggregates: aggregates,
	}

	return s.createReport(ctx, ReportTypeDailyLiquidity, startOfDay, endOfDay, reportData)
}

// LiquidityPosition represents a participant's liquidity position
type LiquidityPosition struct {
	ParticipantID   string  `json:"participant_id" xml:"ParticipantId"`
	ParticipantName string  `json:"participant_name" xml:"ParticipantName"`
	Currency        string  `json:"currency" xml:"Currency"`
	NetDebitCap     int64   `json:"net_debit_cap" xml:"NetDebitCap"`
	CurrentPosition int64   `json:"current_position" xml:"CurrentPosition"`
	AvailableLimit  int64   `json:"available_limit" xml:"AvailableLimit"`
	ReservedAmount  int64   `json:"reserved_amount" xml:"ReservedAmount"`
	UtilizationRate float64 `json:"utilization_rate" xml:"UtilizationRate"`
}

// DailyLiquidityReportData holds the daily liquidity report data
type DailyLiquidityReportData struct {
	Positions  []*LiquidityPosition    `json:"positions" xml:"Positions>Position"`
	Aggregates *LiquidityAggregates    `json:"aggregates" xml:"Aggregates"`
}

// LiquidityAggregates holds aggregate liquidity metrics
type LiquidityAggregates struct {
	TotalNetDebitCap     map[string]int64   `json:"total_net_debit_cap" xml:"TotalNetDebitCap"`
	TotalCurrentPosition map[string]int64   `json:"total_current_position" xml:"TotalCurrentPosition"`
	TotalAvailableLimit  map[string]int64   `json:"total_available_limit" xml:"TotalAvailableLimit"`
	AverageUtilization   map[string]float64 `json:"average_utilization" xml:"AverageUtilization"`
	ParticipantCount     int                `json:"participant_count" xml:"ParticipantCount"`
}

func (s *RegulatoryReportingService) calculateLiquidityAggregates(positions []*LiquidityPosition) *LiquidityAggregates {
	agg := &LiquidityAggregates{
		TotalNetDebitCap:     make(map[string]int64),
		TotalCurrentPosition: make(map[string]int64),
		TotalAvailableLimit:  make(map[string]int64),
		AverageUtilization:   make(map[string]float64),
	}

	currencyCount := make(map[string]int)
	utilizationSum := make(map[string]float64)
	participantSet := make(map[string]bool)

	for _, pos := range positions {
		agg.TotalNetDebitCap[pos.Currency] += pos.NetDebitCap
		agg.TotalCurrentPosition[pos.Currency] += pos.CurrentPosition
		agg.TotalAvailableLimit[pos.Currency] += pos.AvailableLimit
		utilizationSum[pos.Currency] += pos.UtilizationRate
		currencyCount[pos.Currency]++
		participantSet[pos.ParticipantID] = true
	}

	for currency, count := range currencyCount {
		agg.AverageUtilization[currency] = utilizationSum[currency] / float64(count)
	}

	agg.ParticipantCount = len(participantSet)
	return agg
}

// GenerateDailySettlementReport generates the daily settlement report
func (s *RegulatoryReportingService) GenerateDailySettlementReport(ctx context.Context, date time.Time) (*Report, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	// Query settlements
	rows, err := s.db.QueryContext(ctx, `
		SELECT s.settlement_id, s.state, s.created_date, s.changed_date,
		       COUNT(DISTINCT ssw.settlement_window_id) as window_count,
		       SUM(spc.net_amount) as total_net_amount,
		       SUM(spc.transfer_count) as total_transfers
		FROM settlements s
		LEFT JOIN settlement_settlement_window ssw ON s.settlement_id = ssw.settlement_id
		LEFT JOIN settlement_participant_currency spc ON s.settlement_id = spc.settlement_id
		WHERE s.created_date >= $1 AND s.created_date < $2
		GROUP BY s.settlement_id, s.state, s.created_date, s.changed_date
		ORDER BY s.created_date
	`, startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("failed to query settlements: %w", err)
	}
	defer rows.Close()

	var settlements []*SettlementSummary
	for rows.Next() {
		s := &SettlementSummary{}
		var netAmount sql.NullInt64
		var transferCount sql.NullInt64
		err := rows.Scan(
			&s.SettlementID, &s.State, &s.CreatedDate, &s.ChangedDate,
			&s.WindowCount, &netAmount, &transferCount,
		)
		if err != nil {
			continue
		}
		if netAmount.Valid {
			s.TotalNetAmount = netAmount.Int64
		}
		if transferCount.Valid {
			s.TotalTransfers = int(transferCount.Int64)
		}
		settlements = append(settlements, s)
	}

	reportData := &DailySettlementReportData{
		Settlements:     settlements,
		TotalSettlements: len(settlements),
	}

	return s.createReport(ctx, ReportTypeDailySettlement, startOfDay, endOfDay, reportData)
}

// SettlementSummary represents a settlement summary
type SettlementSummary struct {
	SettlementID   int64     `json:"settlement_id" xml:"SettlementId"`
	State          string    `json:"state" xml:"State"`
	CreatedDate    time.Time `json:"created_date" xml:"CreatedDate"`
	ChangedDate    time.Time `json:"changed_date" xml:"ChangedDate"`
	WindowCount    int       `json:"window_count" xml:"WindowCount"`
	TotalNetAmount int64     `json:"total_net_amount" xml:"TotalNetAmount"`
	TotalTransfers int       `json:"total_transfers" xml:"TotalTransfers"`
}

// DailySettlementReportData holds the daily settlement report data
type DailySettlementReportData struct {
	Settlements      []*SettlementSummary `json:"settlements" xml:"Settlements>Settlement"`
	TotalSettlements int                  `json:"total_settlements" xml:"TotalSettlements"`
}

// GenerateTransactionVolumeReport generates transaction volume statistics
func (s *RegulatoryReportingService) GenerateTransactionVolumeReport(ctx context.Context, startDate, endDate time.Time) (*Report, error) {
	// Query transaction volumes by currency and participant
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.currency, t.payer_fsp, t.payee_fsp,
		       COUNT(*) as transaction_count,
		       SUM(t.amount) as total_amount,
		       AVG(t.amount) as avg_amount,
		       MIN(t.amount) as min_amount,
		       MAX(t.amount) as max_amount
		FROM mojaloop_transfers t
		WHERE t.created_at >= $1 AND t.created_at < $2
		  AND t.mojaloop_state = 'COMMITTED'
		GROUP BY t.currency, t.payer_fsp, t.payee_fsp
		ORDER BY t.currency, total_amount DESC
	`, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query transaction volumes: %w", err)
	}
	defer rows.Close()

	var volumes []*TransactionVolume
	for rows.Next() {
		v := &TransactionVolume{}
		err := rows.Scan(
			&v.Currency, &v.PayerFSP, &v.PayeeFSP,
			&v.TransactionCount, &v.TotalAmount, &v.AvgAmount,
			&v.MinAmount, &v.MaxAmount,
		)
		if err != nil {
			continue
		}
		volumes = append(volumes, v)
	}

	// Calculate aggregates
	aggregates := s.calculateVolumeAggregates(volumes)

	reportData := &TransactionVolumeReportData{
		Volumes:    volumes,
		Aggregates: aggregates,
	}

	return s.createReport(ctx, ReportTypeTransactionVolume, startDate, endDate, reportData)
}

// TransactionVolume represents transaction volume statistics
type TransactionVolume struct {
	Currency         string  `json:"currency" xml:"Currency"`
	PayerFSP         string  `json:"payer_fsp" xml:"PayerFsp"`
	PayeeFSP         string  `json:"payee_fsp" xml:"PayeeFsp"`
	TransactionCount int64   `json:"transaction_count" xml:"TransactionCount"`
	TotalAmount      int64   `json:"total_amount" xml:"TotalAmount"`
	AvgAmount        float64 `json:"avg_amount" xml:"AvgAmount"`
	MinAmount        int64   `json:"min_amount" xml:"MinAmount"`
	MaxAmount        int64   `json:"max_amount" xml:"MaxAmount"`
}

// TransactionVolumeReportData holds transaction volume report data
type TransactionVolumeReportData struct {
	Volumes    []*TransactionVolume   `json:"volumes" xml:"Volumes>Volume"`
	Aggregates *VolumeAggregates      `json:"aggregates" xml:"Aggregates"`
}

// VolumeAggregates holds aggregate volume metrics
type VolumeAggregates struct {
	TotalTransactions map[string]int64 `json:"total_transactions" xml:"TotalTransactions"`
	TotalAmount       map[string]int64 `json:"total_amount" xml:"TotalAmount"`
	UniqueParticipants int             `json:"unique_participants" xml:"UniqueParticipants"`
}

func (s *RegulatoryReportingService) calculateVolumeAggregates(volumes []*TransactionVolume) *VolumeAggregates {
	agg := &VolumeAggregates{
		TotalTransactions: make(map[string]int64),
		TotalAmount:       make(map[string]int64),
	}

	participantSet := make(map[string]bool)
	for _, v := range volumes {
		agg.TotalTransactions[v.Currency] += v.TransactionCount
		agg.TotalAmount[v.Currency] += v.TotalAmount
		participantSet[v.PayerFSP] = true
		participantSet[v.PayeeFSP] = true
	}

	agg.UniqueParticipants = len(participantSet)
	return agg
}

// GenerateLargeTransactionReport generates report of large transactions (CTR)
func (s *RegulatoryReportingService) GenerateLargeTransactionReport(ctx context.Context, startDate, endDate time.Time) (*Report, error) {
	threshold := s.config.LargeTransactionThreshold
	if threshold == 0 {
		threshold = 1000000000 // Default 10,000 in minor units (cents)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT t.transfer_id, t.payer_fsp, t.payee_fsp, t.amount, t.currency,
		       t.created_at, t.mojaloop_state
		FROM mojaloop_transfers t
		WHERE t.created_at >= $1 AND t.created_at < $2
		  AND t.amount >= $3
		  AND t.mojaloop_state = 'COMMITTED'
		ORDER BY t.amount DESC
	`, startDate, endDate, threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to query large transactions: %w", err)
	}
	defer rows.Close()

	var transactions []*LargeTransaction
	for rows.Next() {
		t := &LargeTransaction{}
		err := rows.Scan(
			&t.TransferID, &t.PayerFSP, &t.PayeeFSP, &t.Amount, &t.Currency,
			&t.CreatedAt, &t.State,
		)
		if err != nil {
			continue
		}
		transactions = append(transactions, t)
	}

	reportData := &LargeTransactionReportData{
		Transactions: transactions,
		Threshold:    threshold,
		TotalCount:   len(transactions),
	}

	return s.createReport(ctx, ReportTypeLargeTransaction, startDate, endDate, reportData)
}

// LargeTransaction represents a large transaction for CTR
type LargeTransaction struct {
	TransferID string    `json:"transfer_id" xml:"TransferId"`
	PayerFSP   string    `json:"payer_fsp" xml:"PayerFsp"`
	PayeeFSP   string    `json:"payee_fsp" xml:"PayeeFsp"`
	Amount     int64     `json:"amount" xml:"Amount"`
	Currency   string    `json:"currency" xml:"Currency"`
	CreatedAt  time.Time `json:"created_at" xml:"CreatedAt"`
	State      string    `json:"state" xml:"State"`
}

// LargeTransactionReportData holds large transaction report data
type LargeTransactionReportData struct {
	Transactions []*LargeTransaction `json:"transactions" xml:"Transactions>Transaction"`
	Threshold    int64               `json:"threshold" xml:"Threshold"`
	TotalCount   int                 `json:"total_count" xml:"TotalCount"`
}

// GenerateSuspiciousActivityReport generates SAR report
func (s *RegulatoryReportingService) GenerateSuspiciousActivityReport(ctx context.Context, startDate, endDate time.Time) (*Report, error) {
	// Query flagged transactions
	rows, err := s.db.QueryContext(ctx, `
		SELECT sa.alert_id, sa.transfer_id, sa.participant_id, sa.alert_type,
		       sa.risk_score, sa.reason, sa.created_at, sa.status,
		       t.amount, t.currency, t.payer_fsp, t.payee_fsp
		FROM suspicious_activity_alerts sa
		LEFT JOIN mojaloop_transfers t ON sa.transfer_id = t.transfer_id
		WHERE sa.created_at >= $1 AND sa.created_at < $2
		ORDER BY sa.risk_score DESC, sa.created_at
	`, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query suspicious activities: %w", err)
	}
	defer rows.Close()

	var alerts []*SuspiciousActivityAlert
	for rows.Next() {
		a := &SuspiciousActivityAlert{}
		var amount sql.NullInt64
		var currency, payerFSP, payeeFSP sql.NullString
		err := rows.Scan(
			&a.AlertID, &a.TransferID, &a.ParticipantID, &a.AlertType,
			&a.RiskScore, &a.Reason, &a.CreatedAt, &a.Status,
			&amount, &currency, &payerFSP, &payeeFSP,
		)
		if err != nil {
			continue
		}
		if amount.Valid {
			a.Amount = amount.Int64
		}
		if currency.Valid {
			a.Currency = currency.String
		}
		if payerFSP.Valid {
			a.PayerFSP = payerFSP.String
		}
		if payeeFSP.Valid {
			a.PayeeFSP = payeeFSP.String
		}
		alerts = append(alerts, a)
	}

	reportData := &SuspiciousActivityReportData{
		Alerts:     alerts,
		TotalCount: len(alerts),
	}

	return s.createReport(ctx, ReportTypeSuspiciousActivity, startDate, endDate, reportData)
}

// SuspiciousActivityAlert represents a suspicious activity alert
type SuspiciousActivityAlert struct {
	AlertID       string    `json:"alert_id" xml:"AlertId"`
	TransferID    string    `json:"transfer_id" xml:"TransferId"`
	ParticipantID string    `json:"participant_id" xml:"ParticipantId"`
	AlertType     string    `json:"alert_type" xml:"AlertType"`
	RiskScore     float64   `json:"risk_score" xml:"RiskScore"`
	Reason        string    `json:"reason" xml:"Reason"`
	CreatedAt     time.Time `json:"created_at" xml:"CreatedAt"`
	Status        string    `json:"status" xml:"Status"`
	Amount        int64     `json:"amount" xml:"Amount"`
	Currency      string    `json:"currency" xml:"Currency"`
	PayerFSP      string    `json:"payer_fsp" xml:"PayerFsp"`
	PayeeFSP      string    `json:"payee_fsp" xml:"PayeeFsp"`
}

// SuspiciousActivityReportData holds SAR report data
type SuspiciousActivityReportData struct {
	Alerts     []*SuspiciousActivityAlert `json:"alerts" xml:"Alerts>Alert"`
	TotalCount int                        `json:"total_count" xml:"TotalCount"`
}

// GenerateSystemAvailabilityReport generates system availability report
func (s *RegulatoryReportingService) GenerateSystemAvailabilityReport(ctx context.Context, startDate, endDate time.Time) (*Report, error) {
	// Query system metrics
	rows, err := s.db.QueryContext(ctx, `
		SELECT service_name, 
		       COUNT(*) as total_checks,
		       SUM(CASE WHEN status = 'UP' THEN 1 ELSE 0 END) as up_count,
		       AVG(response_time_ms) as avg_response_time,
		       MAX(response_time_ms) as max_response_time
		FROM system_health_checks
		WHERE check_time >= $1 AND check_time < $2
		GROUP BY service_name
		ORDER BY service_name
	`, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query system availability: %w", err)
	}
	defer rows.Close()

	var services []*ServiceAvailability
	for rows.Next() {
		svc := &ServiceAvailability{}
		err := rows.Scan(
			&svc.ServiceName, &svc.TotalChecks, &svc.UpCount,
			&svc.AvgResponseTime, &svc.MaxResponseTime,
		)
		if err != nil {
			continue
		}
		if svc.TotalChecks > 0 {
			svc.AvailabilityPercent = float64(svc.UpCount) / float64(svc.TotalChecks) * 100
		}
		services = append(services, svc)
	}

	reportData := &SystemAvailabilityReportData{
		Services: services,
	}

	return s.createReport(ctx, ReportTypeSystemAvailability, startDate, endDate, reportData)
}

// ServiceAvailability represents service availability metrics
type ServiceAvailability struct {
	ServiceName         string  `json:"service_name" xml:"ServiceName"`
	TotalChecks         int     `json:"total_checks" xml:"TotalChecks"`
	UpCount             int     `json:"up_count" xml:"UpCount"`
	AvailabilityPercent float64 `json:"availability_percent" xml:"AvailabilityPercent"`
	AvgResponseTime     float64 `json:"avg_response_time_ms" xml:"AvgResponseTimeMs"`
	MaxResponseTime     float64 `json:"max_response_time_ms" xml:"MaxResponseTimeMs"`
}

// SystemAvailabilityReportData holds system availability report data
type SystemAvailabilityReportData struct {
	Services []*ServiceAvailability `json:"services" xml:"Services>Service"`
}

// createReport creates a report with hash and signature
func (s *RegulatoryReportingService) createReport(ctx context.Context, reportType ReportType, startDate, endDate time.Time, data interface{}) (*Report, error) {
	report := &Report{
		ReportID:        generateEventID(),
		ReportType:      reportType,
		ReportingPeriod: &ReportingPeriod{StartDate: startDate, EndDate: endDate},
		GeneratedAt:     time.Now().UTC(),
		InstitutionCode: s.config.InstitutionCode,
		Format:          ReportFormatJSON,
		Data:            data,
		Status:          ReportStatusGenerated,
	}

	// Calculate hash
	dataJSON, _ := json.Marshal(data)
	hash := sha256.Sum256(dataJSON)
	report.Hash = hex.EncodeToString(hash[:])

	// Sign if HSM available
	if s.hsmManager != nil {
		signature, err := s.hsmManager.Sign(ctx, "report-signing-key", []byte(report.Hash))
		if err == nil {
			report.Signature = hex.EncodeToString(signature)
		}
	}

	// Store report
	if err := s.storeReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to store report: %w", err)
	}

	// Audit log
	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventType("REPORT_GENERATED"),
			Severity:  AuditSeverityInfo,
			Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Reporting Service"},
			Subject:   &AuditSubject{SubjectID: report.ReportID, SubjectType: "REPORT", SubjectName: string(reportType)},
			Action:    "Generated regulatory report",
			Details:   map[string]interface{}{"report_type": reportType, "period_start": startDate, "period_end": endDate},
		})
	}

	return report, nil
}

func (s *RegulatoryReportingService) storeReport(ctx context.Context, report *Report) error {
	dataJSON, _ := json.Marshal(report.Data)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO regulatory_reports (
			report_id, report_type, start_date, end_date, generated_at,
			institution_code, format, data, hash, signature, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, report.ReportID, string(report.ReportType), report.ReportingPeriod.StartDate,
		report.ReportingPeriod.EndDate, report.GeneratedAt, report.InstitutionCode,
		string(report.Format), dataJSON, report.Hash, report.Signature, string(report.Status))
	return err
}

// ExportReport exports a report in the specified format
func (s *RegulatoryReportingService) ExportReport(ctx context.Context, reportID string, format ReportFormat) ([]byte, error) {
	report, err := s.GetReport(ctx, reportID)
	if err != nil {
		return nil, err
	}

	switch format {
	case ReportFormatJSON:
		return json.MarshalIndent(report, "", "  ")
	case ReportFormatXML:
		return xml.MarshalIndent(report, "", "  ")
	case ReportFormatCSV:
		return s.exportToCSV(report)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}

func (s *RegulatoryReportingService) exportToCSV(report *Report) ([]byte, error) {
	var buf strings.Builder
	writer := csv.NewWriter(&buf)

	// Write header
	writer.Write([]string{"Report ID", "Report Type", "Generated At", "Institution Code"})
	writer.Write([]string{report.ReportID, string(report.ReportType), report.GeneratedAt.Format(time.RFC3339), report.InstitutionCode})

	writer.Flush()
	return []byte(buf.String()), nil
}

// GetReport retrieves a report by ID
func (s *RegulatoryReportingService) GetReport(ctx context.Context, reportID string) (*Report, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT report_id, report_type, start_date, end_date, generated_at,
		       institution_code, format, data, hash, signature, status
		FROM regulatory_reports
		WHERE report_id = $1
	`, reportID)

	report := &Report{ReportingPeriod: &ReportingPeriod{}}
	var reportType, format, status string
	var dataJSON []byte

	err := row.Scan(
		&report.ReportID, &reportType, &report.ReportingPeriod.StartDate,
		&report.ReportingPeriod.EndDate, &report.GeneratedAt, &report.InstitutionCode,
		&format, &dataJSON, &report.Hash, &report.Signature, &status,
	)
	if err != nil {
		return nil, err
	}

	report.ReportType = ReportType(reportType)
	report.Format = ReportFormat(format)
	report.Status = ReportStatus(status)
	json.Unmarshal(dataJSON, &report.Data)

	return report, nil
}

// SubmitReport submits a report to the regulatory authority
func (s *RegulatoryReportingService) SubmitReport(ctx context.Context, reportID string) error {
	report, err := s.GetReport(ctx, reportID)
	if err != nil {
		return err
	}

	// In production, submit to regulatory endpoint
	// http.Post(s.config.SubmissionEndpoint, "application/json", bytes.NewReader(reportData))

	// Update status
	_, err = s.db.ExecContext(ctx, `
		UPDATE regulatory_reports SET status = 'SUBMITTED', submitted_at = $1
		WHERE report_id = $2
	`, time.Now(), reportID)

	// Audit log
	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventType("REPORT_SUBMITTED"),
			Severity:  AuditSeverityInfo,
			Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Reporting Service"},
			Subject:   &AuditSubject{SubjectID: reportID, SubjectType: "REPORT", SubjectName: string(report.ReportType)},
			Action:    "Submitted regulatory report",
		})
	}

	return err
}

// RegulatoryReportingSchema returns the PostgreSQL schema for reporting tables
func RegulatoryReportingSchema() string {
	return `
-- Regulatory reports table
CREATE TABLE IF NOT EXISTS regulatory_reports (
    report_id VARCHAR(64) PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    institution_code VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    data JSONB NOT NULL,
    hash VARCHAR(64) NOT NULL,
    signature TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
    submitted_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);

-- Index for report queries
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_type 
ON regulatory_reports(report_type, generated_at DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_status 
ON regulatory_reports(status, generated_at DESC);

-- Suspicious activity alerts table
CREATE TABLE IF NOT EXISTS suspicious_activity_alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    transfer_id VARCHAR(64),
    participant_id VARCHAR(128),
    alert_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    reviewed_by VARCHAR(128),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_alerts_status 
ON suspicious_activity_alerts(status, created_at DESC);

-- Index for participant alerts
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_alerts_participant 
ON suspicious_activity_alerts(participant_id, created_at DESC);

-- System health checks table
CREATE TABLE IF NOT EXISTS system_health_checks (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(128) NOT NULL,
    check_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT
);

-- Index for health check queries
CREATE INDEX IF NOT EXISTS idx_system_health_checks_service 
ON system_health_checks(service_name, check_time DESC);

-- Report schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
    schedule_id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    format VARCHAR(20) NOT NULL,
    recipients TEXT[],
    next_run TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- Index for schedule queries
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run 
ON report_schedules(next_run) WHERE enabled = TRUE;
`
}

// Unused import placeholders
var _ = io.EOF
var _ = csv.NewWriter
