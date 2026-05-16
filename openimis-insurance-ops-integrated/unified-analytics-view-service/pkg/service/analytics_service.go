package service

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"unified-analytics-view-service/pkg/integrations"
	"unified-analytics-view-service/pkg/models"
)

// AnalyticsService defines the business logic for generating and managing unified analytics views.
type AnalyticsService interface {
	GeneratePolicyView(ctx context.Context, policyID string) (*models.PolicyWithActuarialMetrics, error)
	GenerateClaimsView(ctx context.Context, claimID string) (*models.ClaimsWithReservesAndLossRatios, error)
	GenerateUnderwritingView(ctx context.Context, underwritingID string) (*models.UnderwritingWithRiskScores, error)
	PublishViewToKafka(ctx context.Context, view interface{}) error
	GenerateRegulatoryReport(ctx context.Context, period string) (*models.RegulatoryReportData, error)
}

// analyticsServiceImpl implements the AnalyticsService interface.
type analyticsServiceImpl struct {
	imisClient integrations.OpenIMISClient
	kafkaProd  integrations.KafkaProducer
	dataLake   integrations.DataLakeClient
	logger     *logrus.Entry
}

// NewAnalyticsService creates a new instance of AnalyticsService.
func NewAnalyticsService(
	imisClient integrations.OpenIMISClient,
	kafkaProd integrations.KafkaProducer,
	dataLake integrations.DataLakeClient,
	logger *logrus.Entry,
) AnalyticsService {
	return &analyticsServiceImpl{
		imisClient: imisClient,
		kafkaProd:  kafkaProd,
		dataLake:   dataLake,
		logger:     logger,
	}
}

// GeneratePolicyView fetches raw data and enriches it to create the unified policy view.
func (s *analyticsServiceImpl) GeneratePolicyView(ctx context.Context, policyID string) (*models.PolicyWithActuarialMetrics, error) {
	s.logger.WithField("policy_id", policyID).Info("Generating policy view")

	// 1. Fetch raw policy data (simulated as fetching the enriched model directly for simplicity)
	rawPolicy, err := s.imisClient.FetchPolicyData(ctx, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch raw policy data: %w", err)
	}

	// 2. Apply Spark SQL logic for enrichment (simulated)
	// In a real scenario, this would involve complex calculations or lookups.
	rawPolicy.ActuarialValue = rawPolicy.PremiumAmount * 0.65 // Simulated Expected Loss Ratio
	rawPolicy.RiskScore = 0.75 // Simulated Risk Score

	s.logger.WithField("policy_id", policyID).Info("Policy view generated successfully")
	return rawPolicy, nil
}

// GenerateClaimsView fetches raw data and enriches it to create the unified claims view.
func (s *analyticsServiceImpl) GenerateClaimsView(ctx context.Context, claimID string) (*models.ClaimsWithReservesAndLossRatios, error) {
	s.logger.WithField("claim_id", claimID).Info("Generating claims view")

	// 1. Fetch raw claims data (simulated)
	rawClaim, err := s.imisClient.FetchClaimData(ctx, claimID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch raw claim data: %w", err)
	}

	// 2. Apply Spark SQL logic for enrichment (simulated)
	rawClaim.TotalReserve = rawClaim.CaseReserve + rawClaim.IBNRReserve
	if rawClaim.PremiumAmount > 0 {
		rawClaim.LossRatio = rawClaim.IncurredAmount / rawClaim.PremiumAmount
	} else {
		rawClaim.LossRatio = 0.0
	}

	s.logger.WithField("claim_id", claimID).Info("Claims view generated successfully")
	return rawClaim, nil
}

// GenerateUnderwritingView fetches raw data and enriches it to create the unified underwriting view.
func (s *analyticsServiceImpl) GenerateUnderwritingView(ctx context.Context, underwritingID string) (*models.UnderwritingWithRiskScores, error) {
	s.logger.WithField("underwriting_id", underwritingID).Info("Generating underwriting view")

	// 1. Fetch raw underwriting data (simulated)
	rawUnderwriting, err := s.imisClient.FetchUnderwritingData(ctx, underwritingID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch raw underwriting data: %w", err)
	}

	// 2. Apply Spark SQL logic for enrichment (simulated)
	rawUnderwriting.CalculatedRiskScore = (rawUnderwriting.CalculatedRiskScore + rawUnderwriting.ExternalDataScore) / 2.0

	s.logger.WithField("underwriting_id", underwritingID).Info("Underwriting view generated successfully")
	return rawUnderwriting, nil
}

// PublishViewToKafka publishes the generated view to the appropriate Kafka topic.
func (s *analyticsServiceImpl) PublishViewToKafka(ctx context.Context, view interface{}) error {
	var topic string
	var key string

	switch v := view.(type) {
	case *models.PolicyWithActuarialMetrics:
		topic = "unified-analytics.policy-views"
		key = v.PolicyID
	case *models.ClaimsWithReservesAndLossRatios:
		topic = "unified-analytics.claims-views"
		key = v.ClaimID
	case *models.UnderwritingWithRiskScores:
		topic = "unified-analytics.underwriting-views"
		key = v.UnderwritingID
	default:
		return fmt.Errorf("unsupported view type for Kafka publishing: %T", view)
	}

	s.logger.WithField("topic", topic).Info("Publishing view to Kafka")
	if err := s.kafkaProd.ProduceView(ctx, topic, key, view); err != nil {
		return fmt.Errorf("failed to produce view to Kafka topic %s: %w", topic, err)
	}

	s.logger.WithField("topic", topic).Info("View published successfully")
	return nil
}

// GenerateRegulatoryReport retrieves data from the data lake for regulatory reporting.
func (s *analyticsServiceImpl) GenerateRegulatoryReport(ctx context.Context, period string) (*models.RegulatoryReportData, error) {
	s.logger.WithField("period", period).Info("Generating regulatory report")

	report, err := s.dataLake.ExportDataForRegulatoryReporting(ctx, period)
	if err != nil {
		return nil, fmt.Errorf("failed to export data for regulatory reporting: %w", err)
	}

	report.GeneratedAt = time.Now()
	report.ReportID = fmt.Sprintf("REG-%s-%d", period, time.Now().Unix())

	s.logger.WithField("report_id", report.ReportID).Info("Regulatory report generated successfully")
	return report, nil
}
