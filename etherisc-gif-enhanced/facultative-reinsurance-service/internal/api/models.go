package api

// SubmitPolicyRequest is the request body for submitting a policy for reinsurance.
type SubmitPolicyRequest struct {
	PolicyID string `json:"policy_id"`
}

// SubmitPolicyResponse is the response body for submitting a policy for reinsurance.
type SubmitPolicyResponse struct {
	WorkflowID string `json:"workflow_id"`
	RunID      string `json:"run_id"`
	Message    string `json:"message"`
}

// QuoteActionRequest is the request body for accepting or rejecting a quote.
type QuoteActionRequest struct {
	QuoteID string `json:"quote_id"`
}

// QuoteActionResponse is the response body for accepting or rejecting a quote.
type QuoteActionResponse struct {
	ContractID string `json:"contract_id,omitempty"`
	Message    string `json:"message"`
}

// SubmitClaimRequest is the request body for submitting a claim for cession.
type SubmitClaimRequest struct {
	ClaimID    string  `json:"claim_id"`
	ContractID string  `json:"contract_id"`
	ClaimAmount float64 `json:"claim_amount"`
}

// SubmitClaimResponse is the response body for submitting a claim for cession.
type SubmitClaimResponse struct {
	WorkflowID string `json:"workflow_id"`
	RunID      string `json:"run_id"`
	Message    string `json:"message"`
}

// ErrorResponse is the standard error response format.
type ErrorResponse struct {
	Error string `json:"error"`
}
