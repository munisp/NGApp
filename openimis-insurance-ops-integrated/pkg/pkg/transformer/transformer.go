package transformer

import (
	"context"
	"time"

	"github.com/openimis/actuarial-data-transformer/config"
	"github.com/openimis/actuarial-data-transformer/pkg/models"
)

// Transformer handles the data quality, enrichment, and transformation process.
type Transformer struct {
	cfg *config.Config
	enrichmentClient EnrichmentClient
}

// NewTransformer creates a new Transformer instance.
func NewTransformer(cfg *config.Config, client EnrichmentClient) *Transformer {
	return &Transformer{
		cfg: cfg,
		enrichmentClient: client,
	}
}

// Transform processes a raw claim event into an enriched claim.
func (t *Transformer) Transform(ctx context.Context, event models.ClaimEvent) (*models.EnrichedClaim, error) {
	// 1. Data Quality Checks and Validation
	qualityScore := t.dataQualityCheck(&event)
	if qualityScore < 0.5 {
		// In a real Flink job, we might route this to a side output for error handling.
		// Here, we'll just log and potentially skip or mark as low quality.
		// For this implementation, we'll proceed but mark the score.
	}

	// 2. Data Enrichment with Operational Context
	opContext, err := t.enrichmentClient.GetOperationalContext(ctx, event.InsureeID)
	if err != nil {
		// Handle enrichment failure - could be a retry or a default context
		// For now, we'll return an error to simulate a critical failure.
		return nil, err
	}

	// 3. Late-Arriving Data Handling
	isLate := t.isLateArriving(event.ClaimDate)

	// 4. Create Enriched Claim
	enriched := &models.EnrichedClaim{
		ClaimEvent: event,
		OperationalContext: *opContext,
		ProcessingTime: time.Now().UTC(),
		IsLate: isLate,
		DataQualityScore: qualityScore,
	}

	return enriched, nil
}

// dataQualityCheck performs validation and returns a quality score (0.0 to 1.0).
func (t *Transformer) dataQualityCheck(event *models.ClaimEvent) float64 {
	score := 1.0
	// Check for required fields
	if event.ClaimID == "" || event.PolicyID == "" || event.InsureeID == "" {
		score -= 0.3
	}
	// Check for valid claim amount
	if event.ClaimAmount <= 0 {
		score -= 0.2
	}
	// Check for claim date in the future (invalid)
	if event.ClaimDate.After(time.Now()) {
		score -= 0.5
	}
	// Ensure score is not negative
	if score < 0 {
		return 0.0
	}
	return score
}

// isLateArriving checks if the claim date is outside the configured threshold.
func (t *Transformer) isLateArriving(claimDate time.Time) bool {
	// A claim is considered late if its date is older than the configured threshold
	// relative to the current processing time.
	threshold := time.Now().Add(-t.cfg.Data.LateDataThreshold)
	return claimDate.Before(threshold)
}
