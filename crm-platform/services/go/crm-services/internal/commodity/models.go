package commodity

import (
	"time"

	"github.com/google/uuid"
)

type Position struct {
	ID            uuid.UUID  `json:"id"`
	TenantID      uuid.UUID  `json:"tenant_id"`
	Instrument    string     `json:"instrument"`
	InstrumentType string   `json:"instrument_type"`
	Direction     string     `json:"direction"`
	Quantity      float64    `json:"quantity"`
	EntryPrice    float64    `json:"entry_price"`
	CurrentPrice  float64    `json:"current_price"`
	UnrealizedPnL float64   `json:"unrealized_pnl"`
	MarginRequired float64  `json:"margin_required"`
	OpenedAt      time.Time  `json:"opened_at"`
	Status        string     `json:"status"`
	TraderID      *uuid.UUID `json:"trader_id"`
}

type Trade struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	TradeRef       string     `json:"trade_ref"`
	Instrument     string     `json:"instrument"`
	Side           string     `json:"side"`
	Quantity       float64    `json:"quantity"`
	Price          float64    `json:"price"`
	TotalValue     float64    `json:"total_value"`
	CounterpartyID *uuid.UUID `json:"counterparty_id"`
	ExecutionVenue string     `json:"execution_venue"`
	Status         string     `json:"status"`
	ExecutedAt     *time.Time `json:"executed_at"`
	Fees           float64    `json:"fees"`
}

type Settlement struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	TradeID        *uuid.UUID `json:"trade_id"`
	SettlementDate time.Time  `json:"settlement_date"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	Status         string     `json:"status"`
	NettingGroup   string     `json:"netting_group"`
}

type CounterpartyExposure struct {
	CounterpartyID   uuid.UUID `json:"counterparty_id"`
	Name             string    `json:"name"`
	CreditRating     string    `json:"credit_rating"`
	ExposureLimit    float64   `json:"exposure_limit"`
	CurrentExposure  float64   `json:"current_exposure"`
	UtilizationPct   float64   `json:"utilization_pct"`
}

type PriceQuote struct {
	Instrument string    `json:"instrument"`
	BidPrice   float64   `json:"bid_price"`
	AskPrice   float64   `json:"ask_price"`
	LastPrice  float64   `json:"last_price"`
	Volume     float64   `json:"volume"`
	Timestamp  time.Time `json:"timestamp"`
}
