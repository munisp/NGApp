// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// LinkedTransferManager handles multi-leg atomic transfers in TigerBeetle
// Used for FX, fees, and complex payment flows
type LinkedTransferManager struct {
	ledger        LedgerEngine
	workflowStore WorkflowStore
	accountModel  *AccountModel
	mu            sync.RWMutex
}

// AccountModel defines the TigerBeetle account structure
type AccountModel struct {
	// Account mappings by participant and currency
	ParticipantAccounts map[string]map[string]uint128 // fspID -> currency -> accountID
	
	// Hub accounts
	HubNostroAccounts   map[string]uint128 // currency -> hub nostro account
	HubFeeAccounts      map[string]uint128 // currency -> hub fee account
	InterchangeAccounts map[string]uint128 // currency -> interchange account
	
	// Settlement accounts
	SettlementAccounts  map[string]map[string]uint128 // fspID -> currency -> settlement account
}

// NewLinkedTransferManager creates a new linked transfer manager
func NewLinkedTransferManager(ledger LedgerEngine, workflow WorkflowStore) *LinkedTransferManager {
	return &LinkedTransferManager{
		ledger:        ledger,
		workflowStore: workflow,
		accountModel:  NewAccountModel(),
	}
}

// NewAccountModel creates a new account model with default structure
func NewAccountModel() *AccountModel {
	return &AccountModel{
		ParticipantAccounts: make(map[string]map[string]uint128),
		HubNostroAccounts:   make(map[string]uint128),
		HubFeeAccounts:      make(map[string]uint128),
		InterchangeAccounts: make(map[string]uint128),
		SettlementAccounts:  make(map[string]map[string]uint128),
	}
}

// LinkedTransferGroup represents a group of linked transfers
type LinkedTransferGroup struct {
	GroupID       string           `json:"group_id"`
	TransferID    string           `json:"transfer_id"` // Mojaloop transfer ID
	Legs          []*TransferLeg   `json:"legs"`
	State         LinkedGroupState `json:"state"`
	CreatedAt     time.Time        `json:"created_at"`
	PostedAt      *time.Time       `json:"posted_at,omitempty"`
	VoidedAt      *time.Time       `json:"voided_at,omitempty"`
}

// LinkedGroupState represents the state of a linked transfer group
type LinkedGroupState string

const (
	LinkedGroupStatePending LinkedGroupState = "PENDING"
	LinkedGroupStatePosted  LinkedGroupState = "POSTED"
	LinkedGroupStateVoided  LinkedGroupState = "VOIDED"
)

// TransferLeg represents a single leg in a linked transfer
type TransferLeg struct {
	LegIndex        int       `json:"leg_index"`
	LegType         LegType   `json:"leg_type"`
	DebitAccountID  uint128   `json:"debit_account_id"`
	CreditAccountID uint128   `json:"credit_account_id"`
	Amount          uint64    `json:"amount"`
	Currency        string    `json:"currency"`
	TBTransferID    uint128   `json:"tb_transfer_id"`
	Description     string    `json:"description,omitempty"`
}

// LegType identifies the type of transfer leg
type LegType string

const (
	LegTypePrincipal    LegType = "PRINCIPAL"     // Main transfer amount
	LegTypePayerFee     LegType = "PAYER_FEE"     // Fee charged to payer
	LegTypePayeeFee     LegType = "PAYEE_FEE"     // Fee charged to payee
	LegTypeHubFee       LegType = "HUB_FEE"       // Hub fee
	LegTypeInterchange  LegType = "INTERCHANGE"   // Interchange fee
	LegTypeFXDebit      LegType = "FX_DEBIT"      // FX source currency debit
	LegTypeFXCredit     LegType = "FX_CREDIT"     // FX target currency credit
	LegTypeFXSpread     LegType = "FX_SPREAD"     // FX spread/margin
	LegTypeSettlement   LegType = "SETTLEMENT"    // Settlement posting
)

// FXTransferRequest represents a foreign exchange transfer request
type FXTransferRequest struct {
	TransferID        string    `json:"transfer_id"`
	PayerFSP          string    `json:"payer_fsp"`
	PayeeFSP          string    `json:"payee_fsp"`
	SourceAmount      uint64    `json:"source_amount"`
	SourceCurrency    string    `json:"source_currency"`
	TargetAmount      uint64    `json:"target_amount"`
	TargetCurrency    string    `json:"target_currency"`
	ExchangeRate      float64   `json:"exchange_rate"`
	PayerFee          uint64    `json:"payer_fee,omitempty"`
	PayeeFee          uint64    `json:"payee_fee,omitempty"`
	HubFee            uint64    `json:"hub_fee,omitempty"`
	FXSpread          uint64    `json:"fx_spread,omitempty"`
	Expiration        time.Time `json:"expiration"`
	ILPCondition      string    `json:"ilp_condition"`
}

// CreateFXTransfer creates a linked transfer group for an FX transfer
func (m *LinkedTransferManager) CreateFXTransfer(ctx context.Context, req *FXTransferRequest) (*LinkedTransferGroup, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Get account IDs
	payerSourceAccount := m.getParticipantAccount(req.PayerFSP, req.SourceCurrency)
	payeeTargetAccount := m.getParticipantAccount(req.PayeeFSP, req.TargetCurrency)
	hubNostroSource := m.accountModel.HubNostroAccounts[req.SourceCurrency]
	hubNostroTarget := m.accountModel.HubNostroAccounts[req.TargetCurrency]
	hubFeeAccount := m.accountModel.HubFeeAccounts[req.SourceCurrency]

	// Build linked transfer legs
	var legs []*TransferLeg
	legIndex := 0

	// Leg 1: Payer debit (source currency)
	// Payer position -> Hub nostro (source currency)
	legs = append(legs, &TransferLeg{
		LegIndex:        legIndex,
		LegType:         LegTypeFXDebit,
		DebitAccountID:  payerSourceAccount,
		CreditAccountID: hubNostroSource,
		Amount:          req.SourceAmount,
		Currency:        req.SourceCurrency,
		TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
		Description:     "FX debit from payer",
	})
	legIndex++

	// Leg 2: Payee credit (target currency)
	// Hub nostro (target currency) -> Payee position
	legs = append(legs, &TransferLeg{
		LegIndex:        legIndex,
		LegType:         LegTypeFXCredit,
		DebitAccountID:  hubNostroTarget,
		CreditAccountID: payeeTargetAccount,
		Amount:          req.TargetAmount,
		Currency:        req.TargetCurrency,
		TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
		Description:     "FX credit to payee",
	})
	legIndex++

	// Leg 3: Payer fee (if applicable)
	if req.PayerFee > 0 {
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypePayerFee,
			DebitAccountID:  payerSourceAccount,
			CreditAccountID: hubFeeAccount,
			Amount:          req.PayerFee,
			Currency:        req.SourceCurrency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "Payer fee",
		})
		legIndex++
	}

	// Leg 4: Hub fee (if applicable)
	if req.HubFee > 0 {
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypeHubFee,
			DebitAccountID:  hubNostroSource,
			CreditAccountID: hubFeeAccount,
			Amount:          req.HubFee,
			Currency:        req.SourceCurrency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "Hub fee",
		})
		legIndex++
	}

	// Leg 5: FX spread (if applicable)
	if req.FXSpread > 0 {
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypeFXSpread,
			DebitAccountID:  hubNostroSource,
			CreditAccountID: hubFeeAccount,
			Amount:          req.FXSpread,
			Currency:        req.SourceCurrency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "FX spread",
		})
		legIndex++
	}

	// Create linked transfer group
	group := &LinkedTransferGroup{
		GroupID:    fmt.Sprintf("fx-%s", req.TransferID),
		TransferID: req.TransferID,
		Legs:       legs,
		State:      LinkedGroupStatePending,
		CreatedAt:  time.Now(),
	}

	// Create TigerBeetle transfers
	tbTransfers := m.buildTBTransfers(legs, req.Expiration)
	if err := m.ledger.CreateLinkedPendingTransfers(ctx, tbTransfers); err != nil {
		return nil, fmt.Errorf("failed to create linked transfers: %w", err)
	}

	return group, nil
}

// SimpleTransferRequest represents a simple (non-FX) transfer request
type SimpleTransferRequest struct {
	TransferID   string    `json:"transfer_id"`
	PayerFSP     string    `json:"payer_fsp"`
	PayeeFSP     string    `json:"payee_fsp"`
	Amount       uint64    `json:"amount"`
	Currency     string    `json:"currency"`
	PayerFee     uint64    `json:"payer_fee,omitempty"`
	PayeeFee     uint64    `json:"payee_fee,omitempty"`
	HubFee       uint64    `json:"hub_fee,omitempty"`
	Expiration   time.Time `json:"expiration"`
	ILPCondition string    `json:"ilp_condition"`
}

// CreateSimpleTransfer creates a linked transfer group for a simple transfer with fees
func (m *LinkedTransferManager) CreateSimpleTransfer(ctx context.Context, req *SimpleTransferRequest) (*LinkedTransferGroup, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Get account IDs
	payerAccount := m.getParticipantAccount(req.PayerFSP, req.Currency)
	payeeAccount := m.getParticipantAccount(req.PayeeFSP, req.Currency)
	hubFeeAccount := m.accountModel.HubFeeAccounts[req.Currency]

	// Build linked transfer legs
	var legs []*TransferLeg
	legIndex := 0

	// Leg 1: Principal transfer
	// Payer position -> Payee position
	legs = append(legs, &TransferLeg{
		LegIndex:        legIndex,
		LegType:         LegTypePrincipal,
		DebitAccountID:  payerAccount,
		CreditAccountID: payeeAccount,
		Amount:          req.Amount,
		Currency:        req.Currency,
		TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
		Description:     "Principal transfer",
	})
	legIndex++

	// Leg 2: Payer fee (if applicable)
	if req.PayerFee > 0 {
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypePayerFee,
			DebitAccountID:  payerAccount,
			CreditAccountID: hubFeeAccount,
			Amount:          req.PayerFee,
			Currency:        req.Currency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "Payer fee",
		})
		legIndex++
	}

	// Leg 3: Payee fee (if applicable)
	if req.PayeeFee > 0 {
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypePayeeFee,
			DebitAccountID:  payeeAccount,
			CreditAccountID: hubFeeAccount,
			Amount:          req.PayeeFee,
			Currency:        req.Currency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "Payee fee",
		})
		legIndex++
	}

	// Leg 4: Hub fee (if applicable)
	if req.HubFee > 0 {
		interchangeAccount := m.accountModel.InterchangeAccounts[req.Currency]
		legs = append(legs, &TransferLeg{
			LegIndex:        legIndex,
			LegType:         LegTypeHubFee,
			DebitAccountID:  interchangeAccount,
			CreditAccountID: hubFeeAccount,
			Amount:          req.HubFee,
			Currency:        req.Currency,
			TBTransferID:    GenerateTransferID(req.TransferID, legIndex),
			Description:     "Hub fee",
		})
		legIndex++
	}

	// Create linked transfer group
	group := &LinkedTransferGroup{
		GroupID:    fmt.Sprintf("simple-%s", req.TransferID),
		TransferID: req.TransferID,
		Legs:       legs,
		State:      LinkedGroupStatePending,
		CreatedAt:  time.Now(),
	}

	// Create TigerBeetle transfers
	tbTransfers := m.buildTBTransfers(legs, req.Expiration)
	if err := m.ledger.CreateLinkedPendingTransfers(ctx, tbTransfers); err != nil {
		return nil, fmt.Errorf("failed to create linked transfers: %w", err)
	}

	return group, nil
}

// PostLinkedGroup posts all pending transfers in a linked group
func (m *LinkedTransferManager) PostLinkedGroup(ctx context.Context, groupID string, group *LinkedTransferGroup) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if group.State != LinkedGroupStatePending {
		return fmt.Errorf("group is not in pending state: %s", group.State)
	}

	// Collect all transfer IDs
	var transferIDs []uint128
	for _, leg := range group.Legs {
		transferIDs = append(transferIDs, leg.TBTransferID)
	}

	// Post all transfers atomically
	if err := m.ledger.PostLinkedPendingTransfers(ctx, transferIDs); err != nil {
		return fmt.Errorf("failed to post linked transfers: %w", err)
	}

	now := time.Now()
	group.State = LinkedGroupStatePosted
	group.PostedAt = &now

	return nil
}

// VoidLinkedGroup voids all pending transfers in a linked group
func (m *LinkedTransferManager) VoidLinkedGroup(ctx context.Context, groupID string, group *LinkedTransferGroup) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if group.State != LinkedGroupStatePending {
		return fmt.Errorf("group is not in pending state: %s", group.State)
	}

	// Collect all transfer IDs
	var transferIDs []uint128
	for _, leg := range group.Legs {
		transferIDs = append(transferIDs, leg.TBTransferID)
	}

	// Void all transfers atomically
	if err := m.ledger.VoidLinkedPendingTransfers(ctx, transferIDs); err != nil {
		return fmt.Errorf("failed to void linked transfers: %w", err)
	}

	now := time.Now()
	group.State = LinkedGroupStateVoided
	group.VoidedAt = &now

	return nil
}

// buildTBTransfers converts transfer legs to TigerBeetle transfers
func (m *LinkedTransferManager) buildTBTransfers(legs []*TransferLeg, expiration time.Time) []*TBTransfer {
	var transfers []*TBTransfer
	timeout := uint32(time.Until(expiration).Seconds())

	for i, leg := range legs {
		flags := uint16(TransferFlagPending)
		
		// Set linked flag for all but the last transfer
		if i < len(legs)-1 {
			flags |= uint16(TransferFlagLinked)
		}

		transfer := &TBTransfer{
			ID:              leg.TBTransferID,
			DebitAccountID:  leg.DebitAccountID,
			CreditAccountID: leg.CreditAccountID,
			Amount:          leg.Amount,
			UserData32:      uint32(leg.LegIndex),
			Timeout:         timeout,
			Ledger:          CurrencyToLedger(leg.Currency),
			Code:            legTypeToCode(leg.LegType),
			Flags:           flags,
		}
		transfers = append(transfers, transfer)
	}

	return transfers
}

// getParticipantAccount gets or creates a participant account
func (m *LinkedTransferManager) getParticipantAccount(fspID, currency string) uint128 {
	if accounts, ok := m.accountModel.ParticipantAccounts[fspID]; ok {
		if accountID, ok := accounts[currency]; ok {
			return accountID
		}
	}
	// Generate deterministic account ID
	return HashToUint128(fmt.Sprintf("participant:%s:%s", fspID, currency))
}

// legTypeToCode converts a leg type to a TigerBeetle transfer code
func legTypeToCode(legType LegType) uint16 {
	codes := map[LegType]uint16{
		LegTypePrincipal:   1,
		LegTypePayerFee:    2,
		LegTypePayeeFee:    3,
		LegTypeHubFee:      4,
		LegTypeInterchange: 5,
		LegTypeFXDebit:     6,
		LegTypeFXCredit:    7,
		LegTypeFXSpread:    8,
		LegTypeSettlement:  9,
	}
	if code, ok := codes[legType]; ok {
		return code
	}
	return 0
}

// BulkTransferRequest represents a bulk transfer request


// BulkTransferResult represents the result of a bulk transfer
type BulkTransferResult struct {
	BulkTransferID     string                     `json:"bulk_transfer_id"`
	TotalTransfers     int                        `json:"total_transfers"`
	SuccessfulTransfers int                       `json:"successful_transfers"`
	FailedTransfers    int                        `json:"failed_transfers"`
	Results            []*IndividualTransferResult `json:"results"`
}


// CreateBulkTransfer creates a batch of transfers using TigerBeetle batching
func (m *LinkedTransferManager) CreateBulkTransfer(ctx context.Context, req *BulkTransferRequest) (*BulkTransferResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := &BulkTransferResult{
		BulkTransferID:  req.BulkTransferID,
		TotalTransfers:  len(req.Transfers),
		Results:         make([]*IndividualTransferResult, 0, len(req.Transfers)),
	}

	// Build batch of TigerBeetle transfers
	var tbTransfers []*TBTransfer
	timeout := uint32(time.Until(req.Expiration).Seconds())

	for i, transfer := range req.Transfers {
		payerAccount := m.getParticipantAccount(req.PayerFSP, transfer.Currency)
		payeeAccount := m.getParticipantAccount(transfer.PayeeFSP, transfer.Currency)

		tbTransfer := &TBTransfer{
			ID:              GenerateTransferID(transfer.TransferID, 0),
			DebitAccountID:  payerAccount,
			CreditAccountID: payeeAccount,
			Amount:          transfer.Amount,
			UserData128:     StringToUint128(transfer.TransferID),
			UserData32:      uint32(i),
			Timeout:         timeout,
			Ledger:          CurrencyToLedger(transfer.Currency),
			Code:            1, // Principal transfer
			Flags:           uint16(TransferFlagPending),
		}
		tbTransfers = append(tbTransfers, tbTransfer)
	}

	// Execute batch
	batchResults, err := m.ledger.CreateTransferBatch(ctx, tbTransfers)
	if err != nil {
		return nil, fmt.Errorf("batch creation failed: %w", err)
	}

	// Process results
	for i, batchResult := range batchResults {
		individualResult := &IndividualTransferResult{
			TransferID: req.Transfers[i].TransferID,
		}

		if batchResult.Result == TransferResultOK {
			individualResult.Success = true
			result.SuccessfulTransfers++
		} else {
			individualResult.Success = false
			individualResult.Error = fmt.Sprintf("TigerBeetle error: %d", batchResult.Result)
			result.FailedTransfers++
		}

		result.Results = append(result.Results, individualResult)
	}

	return result, nil
}

// SettlementTransferRequest represents a settlement transfer request
type SettlementTransferRequest struct {
	SettlementID    string                    `json:"settlement_id"`
	SettlementWindowID string                 `json:"settlement_window_id"`
	Entries         []*SettlementEntry        `json:"entries"`
}

// SettlementEntry represents a single settlement entry
type SettlementEntry struct {
	ParticipantID string `json:"participant_id"`
	Currency      string `json:"currency"`
	NetAmount     int64  `json:"net_amount"` // Positive = receive, Negative = pay
}

// CreateSettlementTransfers creates linked transfers for settlement
func (m *LinkedTransferManager) CreateSettlementTransfers(ctx context.Context, req *SettlementTransferRequest) (*LinkedTransferGroup, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var legs []*TransferLeg
	legIndex := 0

	// Group entries by currency
	entriesByCurrency := make(map[string][]*SettlementEntry)
	for _, entry := range req.Entries {
		entriesByCurrency[entry.Currency] = append(entriesByCurrency[entry.Currency], entry)
	}

	// Create settlement legs for each currency
	for currency, entries := range entriesByCurrency {
		hubSettlementAccount := m.accountModel.HubNostroAccounts[currency]

		for _, entry := range entries {
			participantSettlement := m.getSettlementAccount(entry.ParticipantID, currency)

			if entry.NetAmount > 0 {
				// Participant receives - Hub pays participant
				legs = append(legs, &TransferLeg{
					LegIndex:        legIndex,
					LegType:         LegTypeSettlement,
					DebitAccountID:  hubSettlementAccount,
					CreditAccountID: participantSettlement,
					Amount:          uint64(entry.NetAmount),
					Currency:        currency,
					TBTransferID:    GenerateTransferID(req.SettlementID, legIndex),
					Description:     fmt.Sprintf("Settlement credit to %s", entry.ParticipantID),
				})
			} else if entry.NetAmount < 0 {
				// Participant pays - Participant pays hub
				legs = append(legs, &TransferLeg{
					LegIndex:        legIndex,
					LegType:         LegTypeSettlement,
					DebitAccountID:  participantSettlement,
					CreditAccountID: hubSettlementAccount,
					Amount:          uint64(-entry.NetAmount),
					Currency:        currency,
					TBTransferID:    GenerateTransferID(req.SettlementID, legIndex),
					Description:     fmt.Sprintf("Settlement debit from %s", entry.ParticipantID),
				})
			}
			legIndex++
		}
	}

	// Create linked transfer group
	group := &LinkedTransferGroup{
		GroupID:    fmt.Sprintf("settlement-%s", req.SettlementID),
		TransferID: req.SettlementID,
		Legs:       legs,
		State:      LinkedGroupStatePending,
		CreatedAt:  time.Now(),
	}

	// Settlement transfers are posted immediately (not pending)
	// Build non-pending transfers
	var tbTransfers []*TBTransfer
	for i, leg := range legs {
		flags := uint16(0) // No pending flag for settlement
		if i < len(legs)-1 {
			flags |= uint16(TransferFlagLinked)
		}

		transfer := &TBTransfer{
			ID:              leg.TBTransferID,
			DebitAccountID:  leg.DebitAccountID,
			CreditAccountID: leg.CreditAccountID,
			Amount:          leg.Amount,
			UserData128:     StringToUint128(req.SettlementID),
			UserData32:      uint32(leg.LegIndex),
			Ledger:          CurrencyToLedger(leg.Currency),
			Code:            legTypeToCode(LegTypeSettlement),
			Flags:           flags,
		}
		tbTransfers = append(tbTransfers, transfer)
	}

	// Execute settlement transfers
	_, err := m.ledger.CreateTransferBatch(ctx, tbTransfers)
	if err != nil {
		return nil, fmt.Errorf("failed to create settlement transfers: %w", err)
	}

	now := time.Now()
	group.State = LinkedGroupStatePosted
	group.PostedAt = &now

	return group, nil
}

// getSettlementAccount gets or creates a settlement account
func (m *LinkedTransferManager) getSettlementAccount(fspID, currency string) uint128 {
	if accounts, ok := m.accountModel.SettlementAccounts[fspID]; ok {
		if accountID, ok := accounts[currency]; ok {
			return accountID
		}
	}
	// Generate deterministic account ID
	return HashToUint128(fmt.Sprintf("settlement:%s:%s", fspID, currency))
}

// InitializeAccountModel initializes the account model with hub accounts
func (m *LinkedTransferManager) InitializeAccountModel(ctx context.Context, currencies []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, currency := range currencies {
		// Create hub nostro account
		nostroID := HashToUint128(fmt.Sprintf("hub:nostro:%s", currency))
		m.accountModel.HubNostroAccounts[currency] = nostroID

		nostroAccount := &TBAccount{
			ID:     nostroID,
			Ledger: CurrencyToLedger(currency),
			Code:   uint16(AccountTypeHubNostro),
			Flags:  uint16(AccountFlagDebitsMustNotExceedCredits),
		}
		if err := m.ledger.CreateAccount(ctx, nostroAccount); err != nil {
			return fmt.Errorf("failed to create hub nostro account for %s: %w", currency, err)
		}

		// Create hub fee account
		feeID := HashToUint128(fmt.Sprintf("hub:fee:%s", currency))
		m.accountModel.HubFeeAccounts[currency] = feeID

		feeAccount := &TBAccount{
			ID:     feeID,
			Ledger: CurrencyToLedger(currency),
			Code:   uint16(AccountTypeHubFee),
			Flags:  uint16(AccountFlagDebitsMustNotExceedCredits),
		}
		if err := m.ledger.CreateAccount(ctx, feeAccount); err != nil {
			return fmt.Errorf("failed to create hub fee account for %s: %w", currency, err)
		}

		// Create interchange account
		interchangeID := HashToUint128(fmt.Sprintf("hub:interchange:%s", currency))
		m.accountModel.InterchangeAccounts[currency] = interchangeID

		interchangeAccount := &TBAccount{
			ID:     interchangeID,
			Ledger: CurrencyToLedger(currency),
			Code:   uint16(AccountTypeInterchange),
			Flags:  uint16(AccountFlagDebitsMustNotExceedCredits),
		}
		if err := m.ledger.CreateAccount(ctx, interchangeAccount); err != nil {
			return fmt.Errorf("failed to create interchange account for %s: %w", currency, err)
		}
	}

	return nil
}

// CreateParticipantAccounts creates position and settlement accounts for a participant
func (m *LinkedTransferManager) CreateParticipantAccounts(ctx context.Context, fspID string, currencies []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.accountModel.ParticipantAccounts[fspID] == nil {
		m.accountModel.ParticipantAccounts[fspID] = make(map[string]uint128)
	}
	if m.accountModel.SettlementAccounts[fspID] == nil {
		m.accountModel.SettlementAccounts[fspID] = make(map[string]uint128)
	}

	for _, currency := range currencies {
		// Create position account
		positionID := HashToUint128(fmt.Sprintf("participant:%s:%s", fspID, currency))
		m.accountModel.ParticipantAccounts[fspID][currency] = positionID

		positionAccount := &TBAccount{
			ID:          positionID,
			UserData128: StringToUint128(fspID),
			Ledger:      CurrencyToLedger(currency),
			Code:        uint16(AccountTypePosition),
			Flags:       uint16(AccountFlagDebitsMustNotExceedCredits), // Prevent overdrafts
		}
		if err := m.ledger.CreateAccount(ctx, positionAccount); err != nil {
			return fmt.Errorf("failed to create position account for %s/%s: %w", fspID, currency, err)
		}

		// Create settlement account
		settlementID := HashToUint128(fmt.Sprintf("settlement:%s:%s", fspID, currency))
		m.accountModel.SettlementAccounts[fspID][currency] = settlementID

		settlementAccount := &TBAccount{
			ID:          settlementID,
			UserData128: StringToUint128(fspID),
			Ledger:      CurrencyToLedger(currency),
			Code:        uint16(AccountTypeSettlement),
			Flags:       uint16(AccountFlagDebitsMustNotExceedCredits),
		}
		if err := m.ledger.CreateAccount(ctx, settlementAccount); err != nil {
			return fmt.Errorf("failed to create settlement account for %s/%s: %w", fspID, currency, err)
		}
	}

	return nil
}
