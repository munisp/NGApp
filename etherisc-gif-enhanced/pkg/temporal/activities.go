package temporal

import (
	"context"
	"log"
	"time"

	"reinsurer-api/internal/model"
)

// Activities struct to hold dependencies for activities (e.g., HTTP clients for external services)
type Activities struct {
	PolicyServiceURL string
	ClaimsServiceURL string
}

// NewActivities creates a new Activities instance.
func NewActivities(policyURL, claimsURL string) *Activities {
	return &Activities{
		PolicyServiceURL: policyURL,
		ClaimsServiceURL: claimsURL,
	}
}

// ProcessQuoteActivity simulates processing a quote submission.
func (a *Activities) ProcessQuoteActivity(ctx context.Context, quote model.QuoteSubmission) (model.QuoteResponse, error) {
	log.Printf("Activity: Processing quote %s for policy %s. Reinsurer: %s", quote.QuoteID, quote.PolicyID, quote.ReinsurerID)
	
	// Simulate integration with Policy Service (e.g., to confirm policy details)
	// In a real implementation, this would be an HTTP call to a.PolicyServiceURL
	log.Printf("Activity: Calling Policy Service at %s to validate policy %s...", a.PolicyServiceURL, quote.PolicyID)
	time.Sleep(50 * time.Millisecond) // Simulate network latency

	// Simulate complex business logic
	if quote.QuoteAmount > 1000000 {
		log.Printf("Activity: Quote %s is too high, rejecting.", quote.QuoteID)
		return model.QuoteResponse{
			QuoteID: quote.QuoteID,
			Status:  "REJECTED",
			Message: "Quote amount exceeds internal limit.",
		}, nil
	}

	log.Printf("Activity: Quote %s processed successfully. Status: ACCEPTED", quote.QuoteID)
	return model.QuoteResponse{
		QuoteID: quote.QuoteID,
		Status:  "ACCEPTED",
		Message: "Quote successfully processed and accepted.",
	}, nil
}

// NotifyReinsurerActivity simulates notifying the reinsurer about a claim.
func (a *Activities) NotifyReinsurerActivity(ctx context.Context, claim model.ClaimNotification) (model.ClaimResponse, error) {
	log.Printf("Activity: Notifying reinsurer %s about claim %s for policy %s.", claim.ReinsurerID, claim.ClaimID, claim.PolicyID)

	// Simulate integration with Claims Service (e.g., to confirm claim details)
	// In a real implementation, this would be an HTTP call to a.ClaimsServiceURL
	log.Printf("Activity: Calling Claims Service at %s to confirm claim %s...", a.ClaimsServiceURL, claim.ClaimID)
	time.Sleep(50 * time.Millisecond) // Simulate network latency

	// Simulate sending the notification to the reinsurer's system (e.g., via a webhook)
	log.Printf("Activity: Sending claim notification to reinsurer %s...", claim.ReinsurerID)
	time.Sleep(100 * time.Millisecond) // Simulate external API call

	log.Printf("Activity: Claim %s notification sent successfully. Status: ACKNOWLEDGED", claim.ClaimID)
	return model.ClaimResponse{
		ClaimID: claim.ClaimID,
		Status:  "ACKNOWLEDGED",
		Message: "Claim notification successfully sent to reinsurer.",
	}, nil
}
