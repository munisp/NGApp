package middleware

import (
	"time"
)

type TemporalConfig struct {
	HostPort       string
	Namespace      string
	TaskQueue      string
	WorkerCount    int
	MaxConcurrent  int
	WorkflowTimeout time.Duration
	ActivityTimeout time.Duration
	RetryPolicy    WorkflowRetryPolicy
}

type WorkflowRetryPolicy struct {
	InitialInterval    time.Duration
	BackoffCoefficient float64
	MaximumInterval    time.Duration
	MaximumAttempts    int
}

var DefaultTemporalConfig = TemporalConfig{
	HostPort:       "temporal:7233",
	Namespace:      "payment-switch",
	TaskQueue:      "payment-tasks",
	WorkerCount:    4,
	MaxConcurrent:  100,
	WorkflowTimeout: 24 * time.Hour,
	ActivityTimeout: 5 * time.Minute,
	RetryPolicy: WorkflowRetryPolicy{
		InitialInterval:    time.Second,
		BackoffCoefficient: 2.0,
		MaximumInterval:    5 * time.Minute,
		MaximumAttempts:    5,
	},
}

type PaymentSagaStep struct {
	Name       string
	Status     string
	StartedAt  time.Time
	CompletedAt time.Time
	Error      string
}

type PaymentSagaState struct {
	WorkflowID    string
	TransactionID string
	Amount        int64
	Currency      string
	SenderBank    string
	RecipientBank string
	Steps         []PaymentSagaStep
	Status        string
	StartedAt     time.Time
	CompletedAt   time.Time
}

var SagaWorkflows = map[string][]string{
	"nip_payment": {
		"validate_request",
		"check_sanctions",
		"evaluate_fraud_risk",
		"check_balance",
		"debit_sender",
		"credit_recipient",
		"notify_sender",
		"notify_recipient",
		"update_ledger",
		"emit_event",
	},
	"neft_batch": {
		"validate_batch",
		"screen_all_transactions",
		"calculate_settlement_positions",
		"submit_to_nibss",
		"await_acknowledgement",
		"process_returns",
		"update_ledger",
		"generate_settlement_report",
	},
	"outbound_remittance": {
		"validate_request",
		"kyc_verification",
		"sanctions_screening",
		"fx_rate_lock",
		"debit_sender_ngn",
		"submit_to_correspondent",
		"await_confirmation",
		"credit_beneficiary",
		"cbn_reporting",
		"notify_parties",
	},
	"settlement_cycle": {
		"collect_positions",
		"net_obligations",
		"validate_liquidity",
		"execute_multilateral_netting",
		"update_tigerbeetle",
		"generate_settlement_report",
		"notify_participants",
		"archive_to_lakehouse",
	},
}

var TaskQueues = map[string]string{
	"payment":     "payment-tasks",
	"settlement":  "settlement-tasks",
	"compliance":  "compliance-tasks",
	"remittance":  "remittance-tasks",
	"fraud":       "fraud-detection-tasks",
	"reporting":   "reporting-tasks",
	"notification": "notification-tasks",
}
