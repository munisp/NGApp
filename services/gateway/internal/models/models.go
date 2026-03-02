package models

import "time"

// ============================================================
// Core Domain Models
// ============================================================

type OrderSide string
type OrderType string
type OrderStatus string
type KYCStatus string
type AccountTier string
type AlertCondition string
type SettlementStatus string

const (
	SideBuy  OrderSide = "BUY"
	SideSell OrderSide = "SELL"

	TypeMarket    OrderType = "MARKET"
	TypeLimit     OrderType = "LIMIT"
	TypeStop      OrderType = "STOP"
	TypeStopLimit OrderType = "STOP_LIMIT"

	StatusPending   OrderStatus = "PENDING"
	StatusOpen      OrderStatus = "OPEN"
	StatusPartial   OrderStatus = "PARTIAL"
	StatusFilled    OrderStatus = "FILLED"
	StatusCancelled OrderStatus = "CANCELLED"
	StatusRejected  OrderStatus = "REJECTED"

	KYCNone     KYCStatus = "NONE"
	KYCPending  KYCStatus = "PENDING"
	KYCVerified KYCStatus = "VERIFIED"
	KYCRejected KYCStatus = "REJECTED"

	TierFarmer        AccountTier = "farmer"
	TierRetailTrader  AccountTier = "retail_trader"
	TierInstitutional AccountTier = "institutional"
	TierCooperative   AccountTier = "cooperative"

	ConditionAbove AlertCondition = "above"
	ConditionBelow AlertCondition = "below"

	SettlementPending SettlementStatus = "pending"
	SettlementSettled SettlementStatus = "settled"
	SettlementFailed  SettlementStatus = "failed"
)

type Commodity struct {
	ID               string  `json:"id"`
	Symbol           string  `json:"symbol"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	Unit             string  `json:"unit"`
	TickSize         float64 `json:"tickSize"`
	LotSize          int     `json:"lotSize"`
	LastPrice        float64 `json:"lastPrice"`
	Change24h        float64 `json:"change24h"`
	ChangePercent24h float64 `json:"changePercent24h"`
	Volume24h        float64 `json:"volume24h"`
	High24h          float64 `json:"high24h"`
	Low24h           float64 `json:"low24h"`
	Open24h          float64 `json:"open24h"`
}

type Order struct {
	ID             string      `json:"id"`
	UserID         string      `json:"userId"`
	Symbol         string      `json:"symbol"`
	Side           OrderSide   `json:"side"`
	Type           OrderType   `json:"type"`
	Status         OrderStatus `json:"status"`
	Quantity       float64     `json:"quantity"`
	Price          float64     `json:"price"`
	StopPrice      float64     `json:"stopPrice,omitempty"`
	FilledQuantity float64     `json:"filledQuantity"`
	AveragePrice   float64     `json:"averagePrice"`
	CreatedAt      time.Time   `json:"createdAt"`
	UpdatedAt      time.Time   `json:"updatedAt"`
}

type Trade struct {
	ID               string           `json:"id"`
	OrderID          string           `json:"orderId"`
	UserID           string           `json:"userId"`
	Symbol           string           `json:"symbol"`
	Side             OrderSide        `json:"side"`
	Price            float64          `json:"price"`
	Quantity         float64          `json:"quantity"`
	Fee              float64          `json:"fee"`
	Timestamp        time.Time        `json:"timestamp"`
	SettlementStatus SettlementStatus `json:"settlementStatus"`
}

type Position struct {
	ID                   string    `json:"id"`
	UserID               string    `json:"userId"`
	Symbol               string    `json:"symbol"`
	Side                 OrderSide `json:"side"`
	Quantity             float64   `json:"quantity"`
	AverageEntryPrice    float64   `json:"averageEntryPrice"`
	CurrentPrice         float64   `json:"currentPrice"`
	UnrealizedPnl        float64   `json:"unrealizedPnl"`
	UnrealizedPnlPercent float64   `json:"unrealizedPnlPercent"`
	RealizedPnl          float64   `json:"realizedPnl"`
	Margin               float64   `json:"margin"`
	LiquidationPrice     float64   `json:"liquidationPrice"`
}

type PortfolioSummary struct {
	TotalValue       float64    `json:"totalValue"`
	TotalPnl         float64    `json:"totalPnl"`
	TotalPnlPercent  float64    `json:"totalPnlPercent"`
	AvailableBalance float64    `json:"availableBalance"`
	MarginUsed       float64    `json:"marginUsed"`
	MarginAvailable  float64    `json:"marginAvailable"`
	Positions        []Position `json:"positions"`
}

type PriceAlert struct {
	ID          string         `json:"id"`
	UserID      string         `json:"userId"`
	Symbol      string         `json:"symbol"`
	Condition   AlertCondition `json:"condition"`
	TargetPrice float64        `json:"targetPrice"`
	Active      bool           `json:"active"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

type User struct {
	ID          string      `json:"id"`
	Email       string      `json:"email"`
	Name        string      `json:"name"`
	AccountTier AccountTier `json:"accountTier"`
	KYCStatus   KYCStatus   `json:"kycStatus"`
	Phone       string      `json:"phone,omitempty"`
	Country     string      `json:"country,omitempty"`
	CreatedAt   time.Time   `json:"createdAt"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Device    string    `json:"device"`
	Location  string    `json:"location"`
	IP        string    `json:"ip"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"createdAt"`
	LastSeen  time.Time `json:"lastSeen"`
}

type UserPreferences struct {
	UserID              string `json:"userId"`
	OrderFilled         bool   `json:"orderFilled"`
	PriceAlerts         bool   `json:"priceAlerts"`
	MarginWarnings      bool   `json:"marginWarnings"`
	MarketNews          bool   `json:"marketNews"`
	SettlementUpdates   bool   `json:"settlementUpdates"`
	SystemMaintenance   bool   `json:"systemMaintenance"`
	EmailNotifications  bool   `json:"emailNotifications"`
	SMSNotifications    bool   `json:"smsNotifications"`
	PushNotifications   bool   `json:"pushNotifications"`
	USSDNotifications   bool   `json:"ussdNotifications"`
	DefaultCurrency     string `json:"defaultCurrency"`
	TimeZone            string `json:"timeZone"`
	DefaultChartPeriod  string `json:"defaultChartPeriod"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Read      bool      `json:"read"`
	Timestamp time.Time `json:"timestamp"`
}

type OrderBookLevel struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
	Total    float64 `json:"total"`
}

type OrderBook struct {
	Symbol        string           `json:"symbol"`
	Bids          []OrderBookLevel `json:"bids"`
	Asks          []OrderBookLevel `json:"asks"`
	Spread        float64          `json:"spread"`
	SpreadPercent float64          `json:"spreadPercent"`
	LastUpdate    int64            `json:"lastUpdate"`
}

type OHLCVCandle struct {
	Time   int64   `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

type MarketTicker struct {
	Symbol           string  `json:"symbol"`
	LastPrice        float64 `json:"lastPrice"`
	Bid              float64 `json:"bid"`
	Ask              float64 `json:"ask"`
	Change24h        float64 `json:"change24h"`
	ChangePercent24h float64 `json:"changePercent24h"`
	Volume24h        float64 `json:"volume24h"`
	High24h          float64 `json:"high24h"`
	Low24h           float64 `json:"low24h"`
	Timestamp        int64   `json:"timestamp"`
}

// ============================================================
// Request/Response types
// ============================================================

type CreateOrderRequest struct {
	Symbol    string    `json:"symbol" binding:"required"`
	Side      OrderSide `json:"side" binding:"required"`
	Type      OrderType `json:"type" binding:"required"`
	Quantity  float64   `json:"quantity" binding:"required,gt=0"`
	Price     float64   `json:"price,omitempty"`
	StopPrice float64   `json:"stopPrice,omitempty"`
}

type CreateAlertRequest struct {
	Symbol      string         `json:"symbol" binding:"required"`
	Condition   AlertCondition `json:"condition" binding:"required"`
	TargetPrice float64        `json:"targetPrice" binding:"required,gt=0"`
}

type UpdateAlertRequest struct {
	Active *bool `json:"active,omitempty"`
}

type UpdateProfileRequest struct {
	Name    string `json:"name,omitempty"`
	Phone   string `json:"phone,omitempty"`
	Country string `json:"country,omitempty"`
}

type UpdatePreferencesRequest struct {
	OrderFilled         *bool   `json:"orderFilled,omitempty"`
	PriceAlerts         *bool   `json:"priceAlerts,omitempty"`
	MarginWarnings      *bool   `json:"marginWarnings,omitempty"`
	MarketNews          *bool   `json:"marketNews,omitempty"`
	SettlementUpdates   *bool   `json:"settlementUpdates,omitempty"`
	SystemMaintenance   *bool   `json:"systemMaintenance,omitempty"`
	EmailNotifications  *bool   `json:"emailNotifications,omitempty"`
	SMSNotifications    *bool   `json:"smsNotifications,omitempty"`
	PushNotifications   *bool   `json:"pushNotifications,omitempty"`
	USSDNotifications   *bool   `json:"ussdNotifications,omitempty"`
	DefaultCurrency     *string `json:"defaultCurrency,omitempty"`
	TimeZone            *string `json:"timeZone,omitempty"`
	DefaultChartPeriod  *string `json:"defaultChartPeriod,omitempty"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	IDToken      string `json:"idToken"`
	ExpiresIn    int    `json:"expiresIn"`
	TokenType    string `json:"tokenType"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

type PaginationMeta struct {
	Total  int `json:"total"`
	Page   int `json:"page"`
	Limit  int `json:"limit"`
	Pages  int `json:"pages"`
}

// Kafka event types
type OrderEvent struct {
	EventType string `json:"eventType"`
	Order     Order  `json:"order"`
	Timestamp int64  `json:"timestamp"`
}

type TradeEvent struct {
	EventType string `json:"eventType"`
	Trade     Trade  `json:"trade"`
	Timestamp int64  `json:"timestamp"`
}

type MarketDataEvent struct {
	EventType string       `json:"eventType"`
	Ticker    MarketTicker `json:"ticker"`
	Timestamp int64        `json:"timestamp"`
}

// TigerBeetle transfer
type LedgerTransfer struct {
	ID              string  `json:"id"`
	DebitAccountID  string  `json:"debitAccountId"`
	CreditAccountID string  `json:"creditAccountId"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Reference       string  `json:"reference"`
	Status          string  `json:"status"`
}

// Temporal workflow
type OrderWorkflowInput struct {
	OrderID string `json:"orderId"`
	UserID  string `json:"userId"`
	Symbol  string `json:"symbol"`
	Side    string `json:"side"`
	Type    string `json:"type"`
	Price   float64 `json:"price"`
	Qty     float64 `json:"quantity"`
}

type SettlementWorkflowInput struct {
	TradeID  string  `json:"tradeId"`
	BuyerID  string  `json:"buyerId"`
	SellerID string  `json:"sellerId"`
	Amount   float64 `json:"amount"`
	Symbol   string  `json:"symbol"`
}

// ============================================================
// Account & Audit Log Models (Improvement #18)
// ============================================================

type Account struct {
	ID        string      `json:"id"`
	UserID    string      `json:"userId"`
	Type      string      `json:"type"`
	Currency  string      `json:"currency"`
	Balance   float64     `json:"balance"`
	Available float64     `json:"available"`
	Locked    float64     `json:"locked"`
	Status    string      `json:"status"`
	Tier      AccountTier `json:"tier"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`
}

type CreateAccountRequest struct {
	UserID   string `json:"userId" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Currency string `json:"currency" binding:"required"`
}

type UpdateAccountRequest struct {
	Status *string  `json:"status,omitempty"`
	Tier   *string  `json:"tier,omitempty"`
}

type AuditEntry struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Action    string    `json:"action"`
	Resource  string    `json:"resource"`
	Details   string    `json:"details"`
	IP        string    `json:"ip"`
	Timestamp time.Time `json:"timestamp"`
}

// ============================================================
// Forex Trading Models
// ============================================================

type FXOrderType string
type FXPositionStatus string
type LeverageTier string

const (
	FXOrderMarket       FXOrderType = "MARKET"
	FXOrderLimit        FXOrderType = "LIMIT"
	FXOrderStop         FXOrderType = "STOP"
	FXOrderStopLimit    FXOrderType = "STOP_LIMIT"
	FXOrderOCO          FXOrderType = "OCO"
	FXOrderTrailingStop FXOrderType = "TRAILING_STOP"

	FXPositionOpen       FXPositionStatus = "OPEN"
	FXPositionClosed     FXPositionStatus = "CLOSED"
	FXPositionLiquidated FXPositionStatus = "LIQUIDATED"

	LeverageRetail        LeverageTier = "retail"
	LeverageProfessional  LeverageTier = "professional"
	LeverageInstitutional LeverageTier = "institutional"
)

// FXPair represents a forex currency pair with trading parameters
type FXPair struct {
	ID              string  `json:"id"`
	Symbol          string  `json:"symbol"`          // e.g. "EUR/USD"
	BaseCurrency    string  `json:"baseCurrency"`    // e.g. "EUR"
	QuoteCurrency   string  `json:"quoteCurrency"`   // e.g. "USD"
	DisplayName     string  `json:"displayName"`     // e.g. "Euro / US Dollar"
	Category        string  `json:"category"`        // major, minor, exotic, african
	PipSize         float64 `json:"pipSize"`         // e.g. 0.0001 for most, 0.01 for JPY pairs
	PipValue        float64 `json:"pipValue"`        // value of 1 pip per standard lot
	MinLotSize      float64 `json:"minLotSize"`      // e.g. 0.01 (micro lot)
	MaxLotSize      float64 `json:"maxLotSize"`      // e.g. 100 (standard lots)
	LotStep         float64 `json:"lotStep"`         // e.g. 0.01
	MaxLeverage     int     `json:"maxLeverage"`     // e.g. 200 for majors
	MarginRequired  float64 `json:"marginRequired"`  // percentage e.g. 0.5 = 0.5%
	SwapLong        float64 `json:"swapLong"`        // overnight swap for long positions (pips)
	SwapShort       float64 `json:"swapShort"`       // overnight swap for short positions (pips)
	SwapTripleDay   string  `json:"swapTripleDay"`   // day triple swap is charged (e.g. "Wednesday")
	SpreadTypical   float64 `json:"spreadTypical"`   // typical spread in pips
	SpreadMin       float64 `json:"spreadMin"`       // minimum spread in pips
	CommissionPerLot float64 `json:"commissionPerLot"` // commission per lot (one way)
	TradingHours    string  `json:"tradingHours"`    // e.g. "24/5" or "Sun 22:00 - Fri 22:00 UTC"
	Active          bool    `json:"active"`
	Bid             float64 `json:"bid"`
	Ask             float64 `json:"ask"`
	High24h         float64 `json:"high24h"`
	Low24h          float64 `json:"low24h"`
	Change24h       float64 `json:"change24h"`
	ChangePercent   float64 `json:"changePercent"`
	Volume24h       float64 `json:"volume24h"`
	LastUpdate      int64   `json:"lastUpdate"`
}

// FXOrder represents a forex trading order
type FXOrder struct {
	ID               string      `json:"id"`
	UserID           string      `json:"userId"`
	Pair             string      `json:"pair"`             // e.g. "EUR/USD"
	Side             OrderSide   `json:"side"`
	Type             FXOrderType `json:"type"`
	Status           OrderStatus `json:"status"`
	LotSize          float64     `json:"lotSize"`          // in standard lots
	Price            float64     `json:"price,omitempty"`  // limit/stop price
	StopLoss         float64     `json:"stopLoss,omitempty"`
	TakeProfit       float64     `json:"takeProfit,omitempty"`
	TrailingStopPips float64     `json:"trailingStopPips,omitempty"`
	// OCO fields
	OCOStopPrice     float64     `json:"ocoStopPrice,omitempty"`
	OCOLimitPrice    float64     `json:"ocoLimitPrice,omitempty"`
	OCOLinkedOrderID string      `json:"ocoLinkedOrderId,omitempty"`
	Leverage         int         `json:"leverage"`
	MarginUsed       float64     `json:"marginUsed"`
	FilledPrice      float64     `json:"filledPrice,omitempty"`
	FilledAt         *time.Time  `json:"filledAt,omitempty"`
	Commission       float64     `json:"commission"`
	SwapAccrued      float64     `json:"swapAccrued"`
	Comment          string      `json:"comment,omitempty"`
	CreatedAt        time.Time   `json:"createdAt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
}

// FXPosition represents an open forex position
type FXPosition struct {
	ID               string           `json:"id"`
	UserID           string           `json:"userId"`
	Pair             string           `json:"pair"`
	Side             OrderSide        `json:"side"`
	Status           FXPositionStatus `json:"status"`
	LotSize          float64          `json:"lotSize"`
	EntryPrice       float64          `json:"entryPrice"`
	CurrentPrice     float64          `json:"currentPrice"`
	StopLoss         float64          `json:"stopLoss,omitempty"`
	TakeProfit       float64          `json:"takeProfit,omitempty"`
	TrailingStopPips float64          `json:"trailingStopPips,omitempty"`
	Leverage         int              `json:"leverage"`
	MarginUsed       float64          `json:"marginUsed"`
	UnrealizedPnl    float64          `json:"unrealizedPnl"`
	UnrealizedPips   float64          `json:"unrealizedPips"`
	SwapAccrued      float64          `json:"swapAccrued"`
	Commission       float64          `json:"commission"`
	LiquidationPrice float64          `json:"liquidationPrice"`
	OpenedAt         time.Time        `json:"openedAt"`
	ClosedAt         *time.Time       `json:"closedAt,omitempty"`
	ClosePrice       float64          `json:"closePrice,omitempty"`
	RealizedPnl      float64          `json:"realizedPnl,omitempty"`
}

// FXAccountSummary represents a trader's forex account summary
type FXAccountSummary struct {
	Balance          float64 `json:"balance"`
	Equity           float64 `json:"equity"`
	MarginUsed       float64 `json:"marginUsed"`
	FreeMargin       float64 `json:"freeMargin"`
	MarginLevel      float64 `json:"marginLevel"`      // equity / margin * 100
	UnrealizedPnl    float64 `json:"unrealizedPnl"`
	RealizedPnlToday float64 `json:"realizedPnlToday"`
	OpenPositions    int     `json:"openPositions"`
	PendingOrders    int     `json:"pendingOrders"`
	LeverageTier     string  `json:"leverageTier"`
	Currency         string  `json:"currency"`
}

// FXSwapRate represents overnight swap/rollover rates
type FXSwapRate struct {
	Pair          string  `json:"pair"`
	SwapLong      float64 `json:"swapLong"`      // pips per lot
	SwapShort     float64 `json:"swapShort"`     // pips per lot
	SwapLongRate  float64 `json:"swapLongRate"`  // annual percentage
	SwapShortRate float64 `json:"swapShortRate"` // annual percentage
	TripleSwapDay string  `json:"tripleSwapDay"` // Wednesday for T+2
	LastUpdated   int64   `json:"lastUpdated"`
}

// FXCrossRate represents a calculated cross rate
type FXCrossRate struct {
	Pair           string  `json:"pair"`
	Bid            float64 `json:"bid"`
	Ask            float64 `json:"ask"`
	DerivedFrom    string  `json:"derivedFrom"`    // e.g. "EUR/USD x USD/GBP"
	Spread         float64 `json:"spread"`
	SpreadPips     float64 `json:"spreadPips"`
	LastUpdate     int64   `json:"lastUpdate"`
}

// FXMarginRequirement represents margin requirements per leverage tier
type FXMarginRequirement struct {
	Pair               string  `json:"pair"`
	RetailLeverage     int     `json:"retailLeverage"`
	RetailMargin       float64 `json:"retailMargin"`       // percentage
	ProLeverage        int     `json:"proLeverage"`
	ProMargin          float64 `json:"proMargin"`          // percentage
	InstitutionalLev   int     `json:"institutionalLeverage"`
	InstitutionalMarg  float64 `json:"institutionalMargin"` // percentage
}

// FXLiquidityProvider represents a connected liquidity source
type FXLiquidityProvider struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Type          string  `json:"type"` // bank, ecn, prime_broker
	Status        string  `json:"status"`
	Latency       int     `json:"latencyMs"`
	PairsCount    int     `json:"pairsCount"`
	SpreadMarkup  float64 `json:"spreadMarkup"`
	LastHeartbeat int64   `json:"lastHeartbeat"`
}

// FXRegulatoryInfo represents regulatory compliance information
type FXRegulatoryInfo struct {
	Jurisdiction     string   `json:"jurisdiction"`
	Regulator        string   `json:"regulator"`
	LicenseType      string   `json:"licenseType"`
	MaxRetailLeverage int     `json:"maxRetailLeverage"`
	NegativeBalance  bool     `json:"negativeBalanceProtection"`
	RequiredWarnings []string `json:"requiredWarnings"`
	ReportingFreq    string   `json:"reportingFrequency"`
}

// FX Request types
type CreateFXOrderRequest struct {
	Pair             string      `json:"pair" binding:"required"`
	Side             OrderSide   `json:"side" binding:"required"`
	Type             FXOrderType `json:"type" binding:"required"`
	LotSize          float64     `json:"lotSize" binding:"required,gt=0"`
	Price            float64     `json:"price,omitempty"`
	StopLoss         float64     `json:"stopLoss,omitempty"`
	TakeProfit       float64     `json:"takeProfit,omitempty"`
	TrailingStopPips float64     `json:"trailingStopPips,omitempty"`
	OCOStopPrice     float64     `json:"ocoStopPrice,omitempty"`
	OCOLimitPrice    float64     `json:"ocoLimitPrice,omitempty"`
	Leverage         int         `json:"leverage,omitempty"`
	Comment          string      `json:"comment,omitempty"`
}

type ModifyFXPositionRequest struct {
	StopLoss         *float64 `json:"stopLoss,omitempty"`
	TakeProfit       *float64 `json:"takeProfit,omitempty"`
	TrailingStopPips *float64 `json:"trailingStopPips,omitempty"`
}

type FXPipCalculatorRequest struct {
	Pair       string  `json:"pair" binding:"required"`
	LotSize    float64 `json:"lotSize" binding:"required,gt=0"`
	EntryPrice float64 `json:"entryPrice" binding:"required,gt=0"`
	ExitPrice  float64 `json:"exitPrice" binding:"required,gt=0"`
	AccountCurrency string `json:"accountCurrency,omitempty"`
}

type FXPipCalculatorResult struct {
	Pair           string  `json:"pair"`
	PipDifference  float64 `json:"pipDifference"`
	PipValue       float64 `json:"pipValue"`
	ProfitLoss     float64 `json:"profitLoss"`
	ProfitLossPips float64 `json:"profitLossPips"`
	MarginRequired float64 `json:"marginRequired"`
	LotSize        float64 `json:"lotSize"`
}
