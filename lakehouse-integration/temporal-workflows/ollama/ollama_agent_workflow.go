package ollama

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// OllamaAgentWorkflowInput defines input for Ollama agent workflow
type OllamaAgentWorkflowInput struct {
	AgentType       string                 `json:"agent_type"` // underwriting, claims, customer_service, document
	RequestID       string                 `json:"request_id"`
	Input           map[string]interface{} `json:"input"`
	Context         map[string]interface{} `json:"context"`
	Model           string                 `json:"model"`
	MaxTokens       int                    `json:"max_tokens"`
	Temperature     float64                `json:"temperature"`
	RequireApproval bool                   `json:"require_approval"`
}

// OllamaAgentWorkflowOutput defines output from Ollama agent workflow
type OllamaAgentWorkflowOutput struct {
	RequestID    string                 `json:"request_id"`
	AgentType    string                 `json:"agent_type"`
	Decision     string                 `json:"decision"`
	Reasoning    string                 `json:"reasoning"`
	Output       map[string]interface{} `json:"output"`
	Confidence   float64                `json:"confidence"`
	TokensUsed   int                    `json:"tokens_used"`
	LatencyMs    float64                `json:"latency_ms"`
	Status       string                 `json:"status"`
	ApprovedBy   string                 `json:"approved_by,omitempty"`
	ApprovalTime time.Time              `json:"approval_time,omitempty"`
}

// OllamaInferenceResult represents Ollama inference output
type OllamaInferenceResult struct {
	Response    string  `json:"response"`
	TokensUsed  int     `json:"tokens_used"`
	LatencyMs   float64 `json:"latency_ms"`
	Model       string  `json:"model"`
}

// UnderwritingDecision represents underwriting agent decision
type UnderwritingDecision struct {
	Decision          string   `json:"decision"` // APPROVE, REJECT, REFER
	RiskScore         float64  `json:"risk_score"`
	PremiumAdjustment float64  `json:"premium_adjustment"`
	Conditions        []string `json:"conditions"`
	Reasoning         string   `json:"reasoning"`
}

// ClaimsDecision represents claims adjudication decision
type ClaimsDecision struct {
	Decision        string   `json:"decision"` // APPROVE, REJECT, INVESTIGATE
	ApprovedAmount  float64  `json:"approved_amount"`
	FraudIndicators []string `json:"fraud_indicators"`
	Reasoning       string   `json:"reasoning"`
}

// OllamaAgentWorkflow orchestrates AI agent decision making
func OllamaAgentWorkflow(ctx workflow.Context, input OllamaAgentWorkflowInput) (*OllamaAgentWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Ollama Agent Workflow", "agentType", input.AgentType, "requestID", input.RequestID)

	startTime := workflow.Now(ctx)

	// Configure activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		HeartbeatTimeout:    1 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    10 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    2 * time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	output := &OllamaAgentWorkflowOutput{
		RequestID: input.RequestID,
		AgentType: input.AgentType,
		Status:    "RUNNING",
	}

	// Step 1: Enrich context with historical data
	var enrichedContext map[string]interface{}
	err := workflow.ExecuteActivity(ctx, EnrichContextActivity, input).Get(ctx, &enrichedContext)
	if err != nil {
		logger.Warn("Failed to enrich context", "error", err)
		enrichedContext = input.Context
	}

	// Step 2: Build prompt based on agent type
	var prompt string
	err = workflow.ExecuteActivity(ctx, BuildAgentPromptActivity, input.AgentType, input.Input, enrichedContext).Get(ctx, &prompt)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("failed to build prompt: %w", err)
	}

	// Step 3: Call Ollama for inference
	var inferenceResult OllamaInferenceResult
	err = workflow.ExecuteActivity(ctx, CallOllamaInferenceActivity, prompt, input.Model, input.MaxTokens, input.Temperature).Get(ctx, &inferenceResult)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("ollama inference failed: %w", err)
	}
	output.TokensUsed = inferenceResult.TokensUsed
	output.LatencyMs = inferenceResult.LatencyMs

	// Step 4: Parse and validate response based on agent type
	var parsedDecision map[string]interface{}
	err = workflow.ExecuteActivity(ctx, ParseAgentResponseActivity, input.AgentType, inferenceResult.Response).Get(ctx, &parsedDecision)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("failed to parse response: %w", err)
	}
	output.Output = parsedDecision
	output.Decision = fmt.Sprintf("%v", parsedDecision["decision"])
	output.Reasoning = fmt.Sprintf("%v", parsedDecision["reasoning"])
	output.Confidence = getConfidence(parsedDecision)

	// Step 5: Check if human approval is required
	if input.RequireApproval || requiresHumanReview(input.AgentType, parsedDecision) {
		logger.Info("Human approval required", "decision", output.Decision)

		// Create approval request
		var approvalResult map[string]interface{}
		err = workflow.ExecuteActivity(ctx, RequestHumanApprovalActivity, input, output).Get(ctx, &approvalResult)
		if err != nil {
			output.Status = "PENDING_APPROVAL"
			return output, nil
		}

		if approved, ok := approvalResult["approved"].(bool); ok && approved {
			output.ApprovedBy = fmt.Sprintf("%v", approvalResult["approver"])
			output.ApprovalTime = workflow.Now(ctx)
		} else {
			output.Status = "REJECTED_BY_HUMAN"
			return output, nil
		}
	}

	// Step 6: Execute decision actions
	err = workflow.ExecuteActivity(ctx, ExecuteDecisionActionsActivity, input.AgentType, input.RequestID, parsedDecision).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to execute decision actions", "error", err)
	}

	// Step 7: Publish decision to Kafka for lakehouse
	err = workflow.ExecuteActivity(ctx, PublishDecisionToKafkaActivity, output).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to publish decision to Kafka", "error", err)
	}

	// Step 8: Log to audit trail
	err = workflow.ExecuteActivity(ctx, LogToAuditTrailActivity, input, output).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to log to audit trail", "error", err)
	}

	output.Status = "COMPLETED"
	output.LatencyMs = float64(workflow.Now(ctx).Sub(startTime).Milliseconds())

	logger.Info("Ollama Agent Workflow completed", "decision", output.Decision, "confidence", output.Confidence)

	return output, nil
}

// BatchOllamaAgentWorkflow processes multiple agent requests
func BatchOllamaAgentWorkflow(ctx workflow.Context, inputs []OllamaAgentWorkflowInput) ([]OllamaAgentWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Batch Ollama Agent Workflow", "count", len(inputs))

	var outputs []OllamaAgentWorkflowOutput

	// Process in parallel with limited concurrency
	const maxConcurrency = 5
	sem := workflow.NewSemaphore(ctx, int64(maxConcurrency))

	var futures []workflow.Future
	for _, input := range inputs {
		if err := sem.Acquire(ctx, 1); err != nil {
			return nil, err
		}

		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID: fmt.Sprintf("ollama-agent-%s-%s", input.AgentType, input.RequestID),
		})

		future := workflow.ExecuteChildWorkflow(childCtx, OllamaAgentWorkflow, input)
		futures = append(futures, future)

		// Release semaphore when child completes
		workflow.Go(ctx, func(ctx workflow.Context) {
			var output OllamaAgentWorkflowOutput
			future.Get(ctx, &output)
			sem.Release(1)
		})
	}

	// Collect results
	for _, future := range futures {
		var output OllamaAgentWorkflowOutput
		if err := future.Get(ctx, &output); err != nil {
			logger.Error("Child workflow failed", "error", err)
			output.Status = "FAILED"
		}
		outputs = append(outputs, output)
	}

	return outputs, nil
}

func getConfidence(decision map[string]interface{}) float64 {
	if conf, ok := decision["confidence"].(float64); ok {
		return conf
	}
	return 0.85 // Default confidence
}

func requiresHumanReview(agentType string, decision map[string]interface{}) bool {
	switch agentType {
	case "underwriting":
		// Require review for high-risk or large policies
		if riskScore, ok := decision["risk_score"].(float64); ok && riskScore > 0.7 {
			return true
		}
	case "claims":
		// Require review for large claims or fraud indicators
		if indicators, ok := decision["fraud_indicators"].([]interface{}); ok && len(indicators) > 0 {
			return true
		}
	}
	return false
}

// Activities

// EnrichContextActivity enriches context with historical data
func EnrichContextActivity(ctx context.Context, input OllamaAgentWorkflowInput) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Enriching context", "agentType", input.AgentType)

	enriched := make(map[string]interface{})
	for k, v := range input.Context {
		enriched[k] = v
	}

	// Add historical data based on agent type
	switch input.AgentType {
	case "underwriting":
		enriched["customer_history"] = map[string]interface{}{
			"previous_policies":  3,
			"claims_history":     1,
			"payment_history":    "good",
			"risk_profile":       "standard",
		}
	case "claims":
		enriched["policy_details"] = map[string]interface{}{
			"coverage_limit":    5000000,
			"deductible":        50000,
			"policy_start_date": "2025-01-01",
		}
	}

	return enriched, nil
}

// BuildAgentPromptActivity builds prompt for Ollama
func BuildAgentPromptActivity(ctx context.Context, agentType string, input, context map[string]interface{}) (string, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Building agent prompt", "agentType", agentType)

	var systemPrompt, userPrompt string

	switch agentType {
	case "underwriting":
		systemPrompt = `You are an expert insurance underwriter AI assistant. Analyze the application and provide a decision.
Output JSON with: decision (APPROVE/REJECT/REFER), risk_score (0-1), premium_adjustment (percentage), conditions (array), reasoning (string).`
		userPrompt = fmt.Sprintf("Analyze this insurance application: %v\nContext: %v", input, context)

	case "claims":
		systemPrompt = `You are an expert claims adjudicator AI assistant. Analyze the claim and provide a decision.
Output JSON with: decision (APPROVE/REJECT/INVESTIGATE), approved_amount (number), fraud_indicators (array), reasoning (string).`
		userPrompt = fmt.Sprintf("Analyze this insurance claim: %v\nContext: %v", input, context)

	case "customer_service":
		systemPrompt = `You are a helpful insurance customer service AI assistant. Respond to the customer query professionally.
Output JSON with: intent (string), response (string), sentiment (string), escalation_required (boolean).`
		userPrompt = fmt.Sprintf("Customer query: %v\nContext: %v", input, context)

	case "document":
		systemPrompt = `You are a document analysis AI assistant. Extract and validate information from the document.
Output JSON with: extracted_data (object), validation_result (VALID/INVALID/NEEDS_REVIEW), confidence (0-1), issues (array).`
		userPrompt = fmt.Sprintf("Analyze this document: %v\nContext: %v", input, context)

	default:
		systemPrompt = "You are a helpful AI assistant."
		userPrompt = fmt.Sprintf("Input: %v\nContext: %v", input, context)
	}

	return fmt.Sprintf("System: %s\n\nUser: %s", systemPrompt, userPrompt), nil
}

// CallOllamaInferenceActivity calls Ollama for inference
func CallOllamaInferenceActivity(ctx context.Context, prompt, model string, maxTokens int, temperature float64) (*OllamaInferenceResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Calling Ollama inference", "model", model)

	activity.RecordHeartbeat(ctx, "Running Ollama inference")

	startTime := time.Now()

	// In production, this would call Ollama API
	// Simulate inference
	time.Sleep(2 * time.Second)

	return &OllamaInferenceResult{
		Response: `{"decision": "APPROVE", "risk_score": 0.35, "premium_adjustment": -5.0, "conditions": ["annual_checkup"], "reasoning": "Low risk profile with good history", "confidence": 0.92}`,
		TokensUsed: 250,
		LatencyMs:  float64(time.Since(startTime).Milliseconds()),
		Model:      model,
	}, nil
}

// ParseAgentResponseActivity parses Ollama response
func ParseAgentResponseActivity(ctx context.Context, agentType, response string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Parsing agent response", "agentType", agentType)

	// In production, this would parse JSON from response
	// For now, return simulated parsed response
	switch agentType {
	case "underwriting":
		return map[string]interface{}{
			"decision":           "APPROVE",
			"risk_score":         0.35,
			"premium_adjustment": -5.0,
			"conditions":         []string{"annual_checkup"},
			"reasoning":          "Low risk profile with good payment history",
			"confidence":         0.92,
		}, nil
	case "claims":
		return map[string]interface{}{
			"decision":         "APPROVE",
			"approved_amount":  250000.0,
			"fraud_indicators": []string{},
			"reasoning":        "Valid claim within policy coverage",
			"confidence":       0.95,
		}, nil
	default:
		return map[string]interface{}{
			"decision":   "PROCESSED",
			"reasoning":  "Request processed successfully",
			"confidence": 0.90,
		}, nil
	}
}

// RequestHumanApprovalActivity requests human approval
func RequestHumanApprovalActivity(ctx context.Context, input OllamaAgentWorkflowInput, output *OllamaAgentWorkflowOutput) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Requesting human approval", "requestID", input.RequestID)

	// In production, this would create approval request in workflow system
	// For now, auto-approve
	return map[string]interface{}{
		"approved": true,
		"approver": "system-auto-approve",
	}, nil
}

// ExecuteDecisionActionsActivity executes actions based on decision
func ExecuteDecisionActionsActivity(ctx context.Context, agentType, requestID string, decision map[string]interface{}) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Executing decision actions", "agentType", agentType, "requestID", requestID)

	// In production, this would call relevant services to execute the decision
	return nil
}

// PublishDecisionToKafkaActivity publishes decision to Kafka
func PublishDecisionToKafkaActivity(ctx context.Context, output *OllamaAgentWorkflowOutput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Publishing decision to Kafka", "requestID", output.RequestID)

	// In production, this would publish to Kafka topic
	return nil
}

// LogToAuditTrailActivity logs to audit trail
func LogToAuditTrailActivity(ctx context.Context, input OllamaAgentWorkflowInput, output *OllamaAgentWorkflowOutput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Logging to audit trail", "requestID", input.RequestID, "decision", output.Decision)

	// In production, this would log to audit database
	return nil
}
