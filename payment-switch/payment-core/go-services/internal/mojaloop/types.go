package mojaloop

import "time"

// MojaloopTransferState represents the state of a Mojaloop transfer
type MojaloopTransferState string

const (
	TransferStateReceived  MojaloopTransferState = "RECEIVED"
	TransferStateReserved  MojaloopTransferState = "RESERVED"
	TransferStateCommitted MojaloopTransferState = "COMMITTED"
	TransferStateAborted   MojaloopTransferState = "ABORTED"
	TransferStateExpired   MojaloopTransferState = "EXPIRED"
	TransferStateInvalid   MojaloopTransferState = "INVALID"
)

// BulkTransferRequest represents a bulk transfer request
type BulkTransferRequest struct {
	BulkTransferID string               `json:"bulk_transfer_id"`
	PayerFSP       string               `json:"payer_fsp"`
	Transfers      []IndividualTransfer `json:"transfers"`
	Expiration     time.Time            `json:"expiration"`
}

// IndividualTransfer represents a single transfer in a bulk
type IndividualTransfer struct {
	TransferID string `json:"transfer_id"`
	PayeeFSP   string `json:"payee_fsp"`
	Amount     uint64 `json:"amount"`
	Currency   string `json:"currency"`
	ILPPacket  string `json:"ilp_packet,omitempty"`
	Condition  string `json:"condition,omitempty"`
}

// IndividualTransferResult represents the result of an individual transfer
type IndividualTransferResult struct {
	TransferID       string      `json:"transfer_id"`
	TigerBeetleID    string      `json:"tigerbeetle_id,omitempty"`
	Success          bool        `json:"success"`
	Error            string      `json:"error,omitempty"`
	Fulfilment       string      `json:"fulfilment,omitempty"`
	ErrorCode        string      `json:"error_code,omitempty"`
	ErrorDescription string      `json:"error_description,omitempty"`
	ExtensionList    []Extension `json:"extension_list,omitempty"`
}

// Extension represents a Mojaloop extension
type Extension struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ReconciliationConfig holds configuration for reconciliation
type ReconciliationConfig struct {
	// Fast loop: validate recent transfer state alignment
	FastLoopInterval time.Duration
	FastLoopLookback time.Duration // How far back to check transfers

	// Slow loop: balance-level reconciliation
	SlowLoopInterval time.Duration

	// Simple interval for basic reconciliation
	ReconcileInterval time.Duration

	// Thresholds
	MaxDriftAllowed  int64         // Maximum balance drift before alerting
	DriftThreshold   uint64        // Maximum allowed drift in currency units
	StuckTransferAge time.Duration // Age after which pending transfers are considered stuck

	// Alerting
	AlertWebhookURL string
	AlertOnDrift    bool
	AlertOnStuck    bool
}

// DefaultReconciliationConfig returns default configuration
func DefaultReconciliationConfig() *ReconciliationConfig {
	return &ReconciliationConfig{
		FastLoopInterval:  30 * time.Second,
		FastLoopLookback:  5 * time.Minute,
		SlowLoopInterval:  15 * time.Minute,
		ReconcileInterval: 5 * time.Minute,
		MaxDriftAllowed:   0,   // Zero tolerance by default
		DriftThreshold:    100, // 100 currency units
		StuckTransferAge:  5 * time.Minute,
		AlertOnDrift:      true,
		AlertOnStuck:      true,
	}
}

// ReconciliationResult represents the result of a reconciliation run
