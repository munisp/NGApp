package saga

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type StepStatus string

const (
	StepPending      StepStatus = "PENDING"
	StepRunning      StepStatus = "RUNNING"
	StepCompleted    StepStatus = "COMPLETED"
	StepFailed       StepStatus = "FAILED"
	StepCompensating StepStatus = "COMPENSATING"
	StepCompensated  StepStatus = "COMPENSATED"
)

type SagaState string

const (
	SagaRunning      SagaState = "RUNNING"
	SagaCompleted    SagaState = "COMPLETED"
	SagaCompensating SagaState = "COMPENSATING"
	SagaCompensated  SagaState = "COMPENSATED"
	SagaFailed       SagaState = "FAILED"
)

type SagaStep struct {
	Name           string        `json:"name"`
	Status         StepStatus    `json:"status"`
	Timeout        time.Duration `json:"timeout"`
	RetryCount     int           `json:"retryCount"`
	MaxRetries     int           `json:"maxRetries"`
	ExecuteFn      func(ctx context.Context, data map[string]interface{}) error `json:"-"`
	CompensateFn   func(ctx context.Context, data map[string]interface{}) error `json:"-"`
	StartedAt      time.Time     `json:"startedAt,omitempty"`
	CompletedAt    time.Time     `json:"completedAt,omitempty"`
}

type SagaInstance struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	State     SagaState              `json:"state"`
	Steps     []SagaStep             `json:"steps"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt time.Time              `json:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt"`
}

type SagaOrchestrator struct {
	sagas map[string]*SagaDefinition
}

type SagaDefinition struct {
	Name  string
	Steps []SagaStepDef
}

type SagaStepDef struct {
	Name       string
	Timeout    time.Duration
	MaxRetries int
	Execute    func(ctx context.Context, data map[string]interface{}) error
	Compensate func(ctx context.Context, data map[string]interface{}) error
}

func NewSagaOrchestrator() *SagaOrchestrator {
	o := &SagaOrchestrator{sagas: make(map[string]*SagaDefinition)}
	o.registerPaymentSagas()
	return o
}

func (o *SagaOrchestrator) registerPaymentSagas() {
	o.sagas["NIP_TRANSFER"] = &SagaDefinition{
		Name: "NIP Instant Payment",
		Steps: []SagaStepDef{
			{Name: "validate_request", Timeout: 2 * time.Second, MaxRetries: 0,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return validateTransferRequest(d)
				},
				Compensate: nil,
			},
			{Name: "sanctions_screening", Timeout: 3 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return screenSanctions(d)
				},
				Compensate: nil,
			},
			{Name: "fraud_scoring", Timeout: 500 * time.Millisecond, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return scoreFraud(d)
				},
				Compensate: nil,
			},
			{Name: "reserve_funds", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return reserveFunds(d)
				},
				Compensate: func(ctx context.Context, d map[string]interface{}) error {
					return releaseReservedFunds(d)
				},
			},
			{Name: "post_ledger", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return postToLedger(d)
				},
				Compensate: func(ctx context.Context, d map[string]interface{}) error {
					return reverseLedgerEntry(d)
				},
			},
			{Name: "notify_beneficiary", Timeout: 10 * time.Second, MaxRetries: 3,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return notifyBeneficiary(d)
				},
				Compensate: nil,
			},
			{Name: "emit_events", Timeout: 5 * time.Second, MaxRetries: 3,
				Execute: func(ctx context.Context, d map[string]interface{}) error {
					return emitKafkaEvents(d)
				},
				Compensate: nil,
			},
		},
	}

	o.sagas["NEFT_CLEARING"] = &SagaDefinition{
		Name: "NEFT Batch Clearing",
		Steps: []SagaStepDef{
			{Name: "validate_batch", Timeout: 10 * time.Second, MaxRetries: 0,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return validateBatch(d) },
				Compensate: nil,
			},
			{Name: "deduplicate", Timeout: 5 * time.Second, MaxRetries: 0,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return deduplicateItems(d) },
				Compensate: nil,
			},
			{Name: "screen_all_items", Timeout: 30 * time.Second, MaxRetries: 1,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return screenBatchItems(d) },
				Compensate: nil,
			},
			{Name: "check_prefunding", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return checkPrefunding(d) },
				Compensate: nil,
			},
			{Name: "reserve_batch_funds", Timeout: 10 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return reserveBatchFunds(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return releaseBatchFunds(d) },
			},
			{Name: "submit_to_clearing", Timeout: 30 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return submitToClearing(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return reverseClearingSubmission(d) },
			},
			{Name: "post_settlement", Timeout: 10 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return postSettlement(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return reverseSettlement(d) },
			},
		},
	}

	o.sagas["OUTBOUND_REMITTANCE"] = &SagaDefinition{
		Name: "Outbound Remittance",
		Steps: []SagaStepDef{
			{Name: "validate_corridor", Timeout: 2 * time.Second, MaxRetries: 0,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return validateCorridor(d) },
			},
			{Name: "kyc_verification", Timeout: 10 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return verifyKYC(d) },
			},
			{Name: "sanctions_screening", Timeout: 5 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return screenSanctions(d) },
			},
			{Name: "fx_quote", Timeout: 3 * time.Second, MaxRetries: 2,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return getFXQuote(d) },
			},
			{Name: "lock_fx_rate", Timeout: 5 * time.Second, MaxRetries: 1,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return lockFXRate(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return releaseFXLock(d) },
			},
			{Name: "debit_sender", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return debitSender(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return refundSender(d) },
			},
			{Name: "submit_to_correspondent", Timeout: 30 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return submitToCorrespondent(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return cancelCorrespondentTransfer(d) },
			},
			{Name: "mojaloop_transfer", Timeout: 15 * time.Second, MaxRetries: 2,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return executeMojaloopTransfer(d) },
			},
		},
	}

	o.sagas["DIRECT_DEBIT_EXECUTION"] = &SagaDefinition{
		Name: "NDD Direct Debit Execution",
		Steps: []SagaStepDef{
			{Name: "validate_mandate", Timeout: 2 * time.Second, MaxRetries: 0,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return validateMandate(d) },
			},
			{Name: "verify_subscriber_bvn", Timeout: 5 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return verifySubscriberBVN(d) },
			},
			{Name: "check_balance", Timeout: 3 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return checkBalance(d) },
			},
			{Name: "debit_subscriber", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return debitSubscriber(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return refundSubscriber(d) },
			},
			{Name: "credit_biller", Timeout: 5 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return creditBiller(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return reverseBillerCredit(d) },
			},
		},
	}

	o.sagas["DISPUTE_RESOLUTION"] = &SagaDefinition{
		Name: "Inter-Bank Dispute Resolution",
		Steps: []SagaStepDef{
			{Name: "log_dispute", Timeout: 5 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return logDispute(d) },
			},
			{Name: "notify_responding_bank", Timeout: 10 * time.Second, MaxRetries: 3,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return notifyRespondingBank(d) },
			},
			{Name: "start_sla_timer", Timeout: 2 * time.Second, MaxRetries: 1,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return startSLATimer(d) },
			},
			{Name: "review_evidence", Timeout: 72 * time.Hour, MaxRetries: 0,
				Execute: func(ctx context.Context, d map[string]interface{}) error { return reviewEvidence(d) },
			},
			{Name: "execute_decision", Timeout: 10 * time.Second, MaxRetries: 2,
				Execute:    func(ctx context.Context, d map[string]interface{}) error { return executeDecision(d) },
				Compensate: func(ctx context.Context, d map[string]interface{}) error { return reverseDecision(d) },
			},
		},
	}
}

func (o *SagaOrchestrator) Execute(ctx context.Context, sagaType string, data map[string]interface{}) (*SagaInstance, error) {
	def, exists := o.sagas[sagaType]
	if !exists {
		return nil, fmt.Errorf("unknown saga type: %s", sagaType)
	}

	instance := &SagaInstance{
		ID:        fmt.Sprintf("saga-%d", time.Now().UnixNano()),
		Type:      sagaType,
		State:     SagaRunning,
		Data:      data,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	for _, stepDef := range def.Steps {
		instance.Steps = append(instance.Steps, SagaStep{
			Name:       stepDef.Name,
			Status:     StepPending,
			Timeout:    stepDef.Timeout,
			MaxRetries: stepDef.MaxRetries,
			ExecuteFn:  stepDef.Execute,
			CompensateFn: stepDef.Compensate,
		})
	}

	for i := range instance.Steps {
		step := &instance.Steps[i]
		step.Status = StepRunning
		step.StartedAt = time.Now()

		stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)
		err := step.ExecuteFn(stepCtx, instance.Data)
		cancel()

		if err != nil {
			step.Status = StepFailed
			instance.State = SagaCompensating
			instance.UpdatedAt = time.Now()
			o.compensate(ctx, instance, i-1)
			return instance, fmt.Errorf("saga step %s failed: %w", step.Name, err)
		}

		step.Status = StepCompleted
		step.CompletedAt = time.Now()
	}

	instance.State = SagaCompleted
	instance.UpdatedAt = time.Now()
	return instance, nil
}

func (o *SagaOrchestrator) compensate(ctx context.Context, instance *SagaInstance, fromStep int) {
	for i := fromStep; i >= 0; i-- {
		step := &instance.Steps[i]
		if step.CompensateFn == nil {
			continue
		}

		step.Status = StepCompensating
		stepCtx, cancel := context.WithTimeout(ctx, step.Timeout*2)
		err := step.CompensateFn(stepCtx, instance.Data)
		cancel()

		if err != nil {
			step.Status = StepFailed
			instance.State = SagaFailed
			return
		}
		step.Status = StepCompensated
	}
	instance.State = SagaCompensated
}

func (o *SagaOrchestrator) GetSagaTypes() []string {
	types := make([]string, 0, len(o.sagas))
	for k := range o.sagas {
		types = append(types, k)
	}
	return types
}

func (o *SagaOrchestrator) GetSagaDefinition(sagaType string) (*SagaDefinition, error) {
	def, exists := o.sagas[sagaType]
	if !exists {
		return nil, fmt.Errorf("unknown saga type: %s", sagaType)
	}
	return def, nil
}

func (si *SagaInstance) ToJSON() ([]byte, error) {
	return json.Marshal(si)
}

// Step implementations (production would call actual services)
func validateTransferRequest(d map[string]interface{}) error { return nil }
func screenSanctions(d map[string]interface{}) error         { return nil }
func scoreFraud(d map[string]interface{}) error              { return nil }
func reserveFunds(d map[string]interface{}) error            { return nil }
func releaseReservedFunds(d map[string]interface{}) error    { return nil }
func postToLedger(d map[string]interface{}) error            { return nil }
func reverseLedgerEntry(d map[string]interface{}) error      { return nil }
func notifyBeneficiary(d map[string]interface{}) error       { return nil }
func emitKafkaEvents(d map[string]interface{}) error         { return nil }
func validateBatch(d map[string]interface{}) error           { return nil }
func deduplicateItems(d map[string]interface{}) error        { return nil }
func screenBatchItems(d map[string]interface{}) error        { return nil }
func checkPrefunding(d map[string]interface{}) error         { return nil }
func reserveBatchFunds(d map[string]interface{}) error       { return nil }
func releaseBatchFunds(d map[string]interface{}) error       { return nil }
func submitToClearing(d map[string]interface{}) error        { return nil }
func reverseClearingSubmission(d map[string]interface{}) error { return nil }
func postSettlement(d map[string]interface{}) error          { return nil }
func reverseSettlement(d map[string]interface{}) error       { return nil }
func validateCorridor(d map[string]interface{}) error        { return nil }
func verifyKYC(d map[string]interface{}) error               { return nil }
func getFXQuote(d map[string]interface{}) error              { return nil }
func lockFXRate(d map[string]interface{}) error              { return nil }
func releaseFXLock(d map[string]interface{}) error           { return nil }
func debitSender(d map[string]interface{}) error             { return nil }
func refundSender(d map[string]interface{}) error            { return nil }
func submitToCorrespondent(d map[string]interface{}) error   { return nil }
func cancelCorrespondentTransfer(d map[string]interface{}) error { return nil }
func executeMojaloopTransfer(d map[string]interface{}) error { return nil }
func validateMandate(d map[string]interface{}) error         { return nil }
func verifySubscriberBVN(d map[string]interface{}) error     { return nil }
func checkBalance(d map[string]interface{}) error            { return nil }
func debitSubscriber(d map[string]interface{}) error         { return nil }
func refundSubscriber(d map[string]interface{}) error        { return nil }
func creditBiller(d map[string]interface{}) error            { return nil }
func reverseBillerCredit(d map[string]interface{}) error     { return nil }
func logDispute(d map[string]interface{}) error              { return nil }
func notifyRespondingBank(d map[string]interface{}) error    { return nil }
func startSLATimer(d map[string]interface{}) error           { return nil }
func reviewEvidence(d map[string]interface{}) error          { return nil }
func executeDecision(d map[string]interface{}) error         { return nil }
func reverseDecision(d map[string]interface{}) error         { return nil }
