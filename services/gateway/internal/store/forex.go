package store

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/munisp/NGApp/services/gateway/internal/models"
)

// ============================================================
// Forex Pair Registry & Data Store
// ============================================================

func (s *Store) seedForexData() {
	s.fxPairs = seedFXPairs()
	for i := range s.fxPairs {
		p := &s.fxPairs[i]
		spread := p.SpreadTypical * p.PipSize
		p.Bid = p.Bid - spread/2
		p.Ask = p.Bid + spread*p.PipSize*10000 // ensure ask > bid
		if p.Ask <= p.Bid {
			p.Ask = p.Bid + spread
		}
		p.LastUpdate = time.Now().UnixMilli()
	}

	// Seed demo FX positions
	demoUserID := "usr-001"
	s.fxPositions = make(map[string]models.FXPosition)
	s.fxOrders = make(map[string]models.FXOrder)

	posData := []struct {
		pair  string
		side  models.OrderSide
		lots  float64
		entry float64
	}{
		{"EUR/USD", models.SideBuy, 1.0, 1.0842},
		{"GBP/USD", models.SideBuy, 0.5, 1.2685},
		{"USD/JPY", models.SideSell, 2.0, 149.85},
		{"USD/NGN", models.SideSell, 0.1, 1580.50},
	}

	for i, pd := range posData {
		pid := fmt.Sprintf("fxpos-%03d", i+1)
		pair := s.getFXPair(pd.pair)
		if pair == nil {
			continue
		}
		currentPrice := pair.Bid
		if pd.side == models.SideBuy {
			currentPrice = pair.Ask
		}
		pipSize := pair.PipSize
		pips := (currentPrice - pd.entry) / pipSize
		if pd.side == models.SideSell {
			pips = (pd.entry - currentPrice) / pipSize
		}
		pnl := pips * pair.PipValue * pd.lots
		marginUsed := (pd.entry * 100000 * pd.lots) / float64(pair.MaxLeverage)

		s.fxPositions[pid] = models.FXPosition{
			ID:               pid,
			UserID:           demoUserID,
			Pair:             pd.pair,
			Side:             pd.side,
			Status:           models.FXPositionOpen,
			LotSize:          pd.lots,
			EntryPrice:       pd.entry,
			CurrentPrice:     math.Round(currentPrice*100000) / 100000,
			StopLoss:         0,
			TakeProfit:       0,
			Leverage:         pair.MaxLeverage,
			MarginUsed:       math.Round(marginUsed*100) / 100,
			UnrealizedPnl:    math.Round(pnl*100) / 100,
			UnrealizedPips:   math.Round(pips*10) / 10,
			SwapAccrued:      math.Round((rand.Float64()*20-10)*100) / 100,
			Commission:       math.Round(pair.CommissionPerLot*pd.lots*100) / 100,
			LiquidationPrice: 0,
			OpenedAt:         time.Now().Add(-time.Duration(i*8) * time.Hour),
		}
	}

	// Seed pending FX orders
	orderData := []struct {
		pair  string
		side  models.OrderSide
		typ   models.FXOrderType
		lots  float64
		price float64
	}{
		{"EUR/USD", models.SideBuy, models.FXOrderLimit, 0.5, 1.0780},
		{"GBP/JPY", models.SideSell, models.FXOrderStop, 1.0, 188.50},
	}

	for i, od := range orderData {
		oid := fmt.Sprintf("fxord-%03d", i+1)
		pair := s.getFXPair(od.pair)
		lev := 100
		if pair != nil {
			lev = pair.MaxLeverage
		}
		marginUsed := (od.price * 100000 * od.lots) / float64(lev)

		s.fxOrders[oid] = models.FXOrder{
			ID:         oid,
			UserID:     demoUserID,
			Pair:       od.pair,
			Side:       od.side,
			Type:       od.typ,
			Status:     models.StatusOpen,
			LotSize:    od.lots,
			Price:      od.price,
			Leverage:   lev,
			MarginUsed: math.Round(marginUsed*100) / 100,
			CreatedAt:  time.Now().Add(-time.Duration(i*2) * time.Hour),
			UpdatedAt:  time.Now().Add(-time.Duration(i*2) * time.Hour),
		}
	}
}

func (s *Store) getFXPair(symbol string) *models.FXPair {
	for i := range s.fxPairs {
		if s.fxPairs[i].Symbol == symbol {
			return &s.fxPairs[i]
		}
	}
	return nil
}

// ============================================================
// FX Pairs CRUD
// ============================================================

func (s *Store) GetFXPairs(category string) []models.FXPair {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if category == "" {
		result := make([]models.FXPair, len(s.fxPairs))
		copy(result, s.fxPairs)
		return result
	}
	var result []models.FXPair
	for _, p := range s.fxPairs {
		if p.Category == category {
			result = append(result, p)
		}
	}
	return result
}

func (s *Store) GetFXPair(symbol string) (models.FXPair, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.fxPairs {
		if p.Symbol == symbol {
			return p, true
		}
	}
	return models.FXPair{}, false
}

func (s *Store) SearchFXPairs(query string) []models.FXPair {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []models.FXPair
	q := strings.ToUpper(query)
	for _, p := range s.fxPairs {
		if strings.Contains(strings.ToUpper(p.Symbol), q) ||
			strings.Contains(strings.ToUpper(p.DisplayName), q) ||
			strings.Contains(strings.ToUpper(p.BaseCurrency), q) ||
			strings.Contains(strings.ToUpper(p.QuoteCurrency), q) {
			results = append(results, p)
		}
	}
	return results
}

// ============================================================
// FX Orders CRUD
// ============================================================

func (s *Store) GetFXOrders(userID string, status string) []models.FXOrder {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []models.FXOrder
	for _, o := range s.fxOrders {
		if o.UserID == userID {
			if status == "" || string(o.Status) == status {
				result = append(result, o)
			}
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	return result
}

func (s *Store) GetFXOrder(orderID string) (models.FXOrder, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.fxOrders[orderID]
	return o, ok
}

func (s *Store) CreateFXOrder(order models.FXOrder) models.FXOrder {
	s.mu.Lock()
	defer s.mu.Unlock()

	order.ID = "fxord-" + uuid.New().String()[:8]
	order.Status = models.StatusOpen
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	// Calculate margin
	pair := s.getFXPair(order.Pair)
	if pair != nil {
		if order.Leverage == 0 {
			order.Leverage = pair.MaxLeverage
		}
		notional := order.LotSize * 100000
		if order.Price > 0 {
			notional = order.LotSize * 100000 * order.Price
		} else {
			notional = order.LotSize * 100000 * pair.Ask
		}
		order.MarginUsed = math.Round(notional/float64(order.Leverage)*100) / 100
		order.Commission = math.Round(pair.CommissionPerLot*order.LotSize*100) / 100
	}

	// For market orders, fill immediately
	if order.Type == models.FXOrderMarket {
		order.Status = models.StatusFilled
		now := time.Now()
		order.FilledAt = &now
		if pair != nil {
			if order.Side == models.SideBuy {
				order.FilledPrice = pair.Ask
			} else {
				order.FilledPrice = pair.Bid
			}
		}

		// Create position
		posID := "fxpos-" + uuid.New().String()[:8]
		fillPrice := order.FilledPrice
		if fillPrice == 0 {
			fillPrice = order.Price
		}
		s.fxPositions[posID] = models.FXPosition{
			ID:            posID,
			UserID:        order.UserID,
			Pair:          order.Pair,
			Side:          order.Side,
			Status:        models.FXPositionOpen,
			LotSize:       order.LotSize,
			EntryPrice:    fillPrice,
			CurrentPrice:  fillPrice,
			StopLoss:      order.StopLoss,
			TakeProfit:    order.TakeProfit,
			Leverage:      order.Leverage,
			MarginUsed:    order.MarginUsed,
			Commission:    order.Commission,
			OpenedAt:      now,
		}
	}

	s.fxOrders[order.ID] = order
	return order
}

func (s *Store) CancelFXOrder(orderID string) (models.FXOrder, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	order, ok := s.fxOrders[orderID]
	if !ok {
		return models.FXOrder{}, fmt.Errorf("FX order not found: %s", orderID)
	}
	if order.Status != models.StatusOpen {
		return order, fmt.Errorf("cannot cancel order with status: %s", order.Status)
	}
	order.Status = models.StatusCancelled
	order.UpdatedAt = time.Now()
	s.fxOrders[orderID] = order

	// Cancel linked OCO order if exists
	if order.OCOLinkedOrderID != "" {
		linked, ok := s.fxOrders[order.OCOLinkedOrderID]
		if ok && linked.Status == models.StatusOpen {
			linked.Status = models.StatusCancelled
			linked.UpdatedAt = time.Now()
			s.fxOrders[linked.ID] = linked
		}
	}

	return order, nil
}

// ============================================================
// FX Positions CRUD
// ============================================================

func (s *Store) GetFXPositions(userID string, status string) []models.FXPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []models.FXPosition
	for _, p := range s.fxPositions {
		if p.UserID == userID {
			if status == "" || string(p.Status) == status {
				// Update current price
				pair := s.getFXPair(p.Pair)
				if pair != nil {
					if p.Side == models.SideBuy {
						p.CurrentPrice = pair.Bid
					} else {
						p.CurrentPrice = pair.Ask
					}
					pips := (p.CurrentPrice - p.EntryPrice) / pair.PipSize
					if p.Side == models.SideSell {
						pips = (p.EntryPrice - p.CurrentPrice) / pair.PipSize
					}
					p.UnrealizedPips = math.Round(pips*10) / 10
					p.UnrealizedPnl = math.Round(pips*pair.PipValue*p.LotSize*100) / 100
				}
				result = append(result, p)
			}
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].OpenedAt.After(result[j].OpenedAt)
	})
	return result
}

func (s *Store) GetFXPosition(posID string) (models.FXPosition, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.fxPositions[posID]
	return p, ok
}

func (s *Store) ModifyFXPosition(posID string, req models.ModifyFXPositionRequest) (models.FXPosition, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	pos, ok := s.fxPositions[posID]
	if !ok {
		return models.FXPosition{}, fmt.Errorf("FX position not found: %s", posID)
	}
	if pos.Status != models.FXPositionOpen {
		return pos, fmt.Errorf("cannot modify closed position")
	}
	if req.StopLoss != nil {
		pos.StopLoss = *req.StopLoss
	}
	if req.TakeProfit != nil {
		pos.TakeProfit = *req.TakeProfit
	}
	if req.TrailingStopPips != nil {
		pos.TrailingStopPips = *req.TrailingStopPips
	}
	s.fxPositions[posID] = pos
	return pos, nil
}

func (s *Store) CloseFXPosition(posID string) (models.FXPosition, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	pos, ok := s.fxPositions[posID]
	if !ok {
		return models.FXPosition{}, fmt.Errorf("FX position not found: %s", posID)
	}
	if pos.Status != models.FXPositionOpen {
		return pos, fmt.Errorf("position already closed")
	}

	pair := s.getFXPair(pos.Pair)
	if pair != nil {
		if pos.Side == models.SideBuy {
			pos.ClosePrice = pair.Bid
		} else {
			pos.ClosePrice = pair.Ask
		}
		pips := (pos.ClosePrice - pos.EntryPrice) / pair.PipSize
		if pos.Side == models.SideSell {
			pips = (pos.EntryPrice - pos.ClosePrice) / pair.PipSize
		}
		pos.RealizedPnl = math.Round(pips*pair.PipValue*pos.LotSize*100) / 100
	}

	pos.Status = models.FXPositionClosed
	now := time.Now()
	pos.ClosedAt = &now
	pos.UnrealizedPnl = 0
	pos.UnrealizedPips = 0
	s.fxPositions[posID] = pos
	return pos, nil
}

// ============================================================
// FX Account Summary
// ============================================================

func (s *Store) GetFXAccountSummary(userID string) models.FXAccountSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	balance := 50000.0 // demo starting balance
	var marginUsed, unrealizedPnl, realizedToday float64
	openCount, pendingCount := 0, 0

	for _, p := range s.fxPositions {
		if p.UserID == userID && p.Status == models.FXPositionOpen {
			marginUsed += p.MarginUsed
			pair := s.getFXPair(p.Pair)
			if pair != nil {
				currentPrice := pair.Bid
				if p.Side == models.SideSell {
					currentPrice = pair.Ask
				}
				pips := (currentPrice - p.EntryPrice) / pair.PipSize
				if p.Side == models.SideSell {
					pips = (p.EntryPrice - currentPrice) / pair.PipSize
				}
				unrealizedPnl += pips * pair.PipValue * p.LotSize
			}
			openCount++
		}
		if p.UserID == userID && p.Status == models.FXPositionClosed && p.ClosedAt != nil {
			if p.ClosedAt.Day() == time.Now().Day() {
				realizedToday += p.RealizedPnl
			}
		}
	}

	for _, o := range s.fxOrders {
		if o.UserID == userID && o.Status == models.StatusOpen {
			pendingCount++
		}
	}

	equity := balance + unrealizedPnl
	freeMargin := equity - marginUsed
	marginLevel := 0.0
	if marginUsed > 0 {
		marginLevel = (equity / marginUsed) * 100
	}

	return models.FXAccountSummary{
		Balance:          math.Round(balance*100) / 100,
		Equity:           math.Round(equity*100) / 100,
		MarginUsed:       math.Round(marginUsed*100) / 100,
		FreeMargin:       math.Round(freeMargin*100) / 100,
		MarginLevel:      math.Round(marginLevel*100) / 100,
		UnrealizedPnl:    math.Round(unrealizedPnl*100) / 100,
		RealizedPnlToday: math.Round(realizedToday*100) / 100,
		OpenPositions:    openCount,
		PendingOrders:    pendingCount,
		LeverageTier:     "retail",
		Currency:         "USD",
	}
}

// ============================================================
// FX Swap Rates
// ============================================================

func (s *Store) GetFXSwapRates() []models.FXSwapRate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var rates []models.FXSwapRate
	for _, p := range s.fxPairs {
		rates = append(rates, models.FXSwapRate{
			Pair:          p.Symbol,
			SwapLong:      p.SwapLong,
			SwapShort:     p.SwapShort,
			SwapLongRate:  math.Round(p.SwapLong*365*p.PipValue/1000*100) / 100,
			SwapShortRate: math.Round(p.SwapShort*365*p.PipValue/1000*100) / 100,
			TripleSwapDay: p.SwapTripleDay,
			LastUpdated:   time.Now().UnixMilli(),
		})
	}
	return rates
}

// ============================================================
// FX Cross Rates
// ============================================================

func (s *Store) GetFXCrossRates() []models.FXCrossRate {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Build a map of USD-based rates
	usdRates := make(map[string]models.FXPair)
	for _, p := range s.fxPairs {
		usdRates[p.Symbol] = p
	}

	// Calculate cross rates for common non-USD pairs
	crossPairs := [][2]string{
		{"EUR", "GBP"}, {"EUR", "JPY"}, {"EUR", "CHF"},
		{"GBP", "JPY"}, {"GBP", "CHF"}, {"CHF", "JPY"},
		{"AUD", "NZD"}, {"AUD", "JPY"}, {"EUR", "NGN"},
	}

	var results []models.FXCrossRate
	for _, cp := range crossPairs {
		base, quote := cp[0], cp[1]
		baseUSD, hasBase := usdRates[base+"/USD"]
		quoteUSD, hasQuote := usdRates[quote+"/USD"]

		// Try reverse pairs
		if !hasBase {
			if rev, ok := usdRates["USD/"+base]; ok {
				baseUSD = rev
				baseUSD.Bid = 1 / rev.Ask
				baseUSD.Ask = 1 / rev.Bid
				hasBase = true
			}
		}
		if !hasQuote {
			if rev, ok := usdRates["USD/"+quote]; ok {
				quoteUSD = rev
				quoteUSD.Bid = 1 / rev.Ask
				quoteUSD.Ask = 1 / rev.Bid
				hasQuote = true
			}
		}

		if hasBase && hasQuote {
			crossBid := baseUSD.Bid / quoteUSD.Ask
			crossAsk := baseUSD.Ask / quoteUSD.Bid
			pipSize := 0.0001
			if quote == "JPY" {
				pipSize = 0.01
			}
			spread := crossAsk - crossBid
			results = append(results, models.FXCrossRate{
				Pair:        base + "/" + quote,
				Bid:         math.Round(crossBid/pipSize) * pipSize,
				Ask:         math.Round(crossAsk/pipSize) * pipSize,
				DerivedFrom: base + "/USD x USD/" + quote,
				Spread:      math.Round(spread*100000) / 100000,
				SpreadPips:  math.Round(spread/pipSize*10) / 10,
				LastUpdate:  time.Now().UnixMilli(),
			})
		}
	}
	return results
}

// ============================================================
// FX Margin Requirements
// ============================================================

func (s *Store) GetFXMarginRequirements() []models.FXMarginRequirement {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var reqs []models.FXMarginRequirement
	for _, p := range s.fxPairs {
		retailLev := p.MaxLeverage
		if retailLev > 50 {
			retailLev = 50 // CBN retail cap
		}
		proLev := p.MaxLeverage
		if proLev > 200 {
			proLev = 200
		}
		reqs = append(reqs, models.FXMarginRequirement{
			Pair:              p.Symbol,
			RetailLeverage:    retailLev,
			RetailMargin:      math.Round(100.0/float64(retailLev)*100) / 100,
			ProLeverage:       proLev,
			ProMargin:         math.Round(100.0/float64(proLev)*100) / 100,
			InstitutionalLev:  p.MaxLeverage,
			InstitutionalMarg: math.Round(100.0/float64(p.MaxLeverage)*100) / 100,
		})
	}
	return reqs
}

// ============================================================
// FX Liquidity Providers
// ============================================================

func (s *Store) GetFXLiquidityProviders() []models.FXLiquidityProvider {
	return []models.FXLiquidityProvider{
		{ID: "lp-001", Name: "Tier-1 Bank Pool (Stanbic IBTC)", Type: "bank", Status: "connected", Latency: 2, PairsCount: 28, SpreadMarkup: 0.1, LastHeartbeat: time.Now().UnixMilli()},
		{ID: "lp-002", Name: "LMAX Exchange ECN", Type: "ecn", Status: "connected", Latency: 5, PairsCount: 45, SpreadMarkup: 0.0, LastHeartbeat: time.Now().UnixMilli()},
		{ID: "lp-003", Name: "Currenex Prime", Type: "prime_broker", Status: "connected", Latency: 3, PairsCount: 60, SpreadMarkup: 0.05, LastHeartbeat: time.Now().UnixMilli()},
		{ID: "lp-004", Name: "FirstBank FX Desk", Type: "bank", Status: "connected", Latency: 8, PairsCount: 12, SpreadMarkup: 0.3, LastHeartbeat: time.Now().UnixMilli()},
		{ID: "lp-005", Name: "Zenith Bank Treasury", Type: "bank", Status: "degraded", Latency: 15, PairsCount: 8, SpreadMarkup: 0.5, LastHeartbeat: time.Now().Add(-30 * time.Second).UnixMilli()},
	}
}

// ============================================================
// FX Regulatory Info
// ============================================================

func (s *Store) GetFXRegulatoryInfo() []models.FXRegulatoryInfo {
	return []models.FXRegulatoryInfo{
		{
			Jurisdiction:      "Nigeria",
			Regulator:         "Central Bank of Nigeria (CBN)",
			LicenseType:       "Authorized Dealer",
			MaxRetailLeverage: 50,
			NegativeBalance:   true,
			RequiredWarnings:  []string{"Forex trading carries significant risk of loss", "Past performance is not indicative of future results", "Leverage can amplify both profits and losses"},
			ReportingFreq:     "Daily to CBN, Monthly to SEC Nigeria",
		},
		{
			Jurisdiction:      "United Kingdom",
			Regulator:         "Financial Conduct Authority (FCA)",
			LicenseType:       "IFPRU 730K",
			MaxRetailLeverage: 30,
			NegativeBalance:   true,
			RequiredWarnings:  []string{"CFDs are complex instruments with high risk of losing money", "76% of retail investor accounts lose money trading CFDs"},
			ReportingFreq:     "Transaction reporting via ARM, Annual audit",
		},
		{
			Jurisdiction:      "United States",
			Regulator:         "CFTC / NFA",
			LicenseType:       "Retail Foreign Exchange Dealer (RFED)",
			MaxRetailLeverage: 50,
			NegativeBalance:   false,
			RequiredWarnings:  []string{"Trading forex on margin carries a high level of risk", "You may lose more than your initial deposit"},
			ReportingFreq:     "Daily to NFA, Quarterly financial statements",
		},
		{
			Jurisdiction:      "ECOWAS",
			Regulator:         "West African Monetary Agency (WAMA)",
			LicenseType:       "Regional FX License",
			MaxRetailLeverage: 100,
			NegativeBalance:   true,
			RequiredWarnings:  []string{"Currency trading involves substantial risk", "Ensure you understand the risks before trading"},
			ReportingFreq:     "Monthly to WAMA, Quarterly to national regulators",
		},
	}
}

// ============================================================
// FX Pip Calculator
// ============================================================

func (s *Store) CalculateFXPips(req models.FXPipCalculatorRequest) models.FXPipCalculatorResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pair := s.getFXPair(req.Pair)
	if pair == nil {
		return models.FXPipCalculatorResult{Pair: req.Pair}
	}

	pipDiff := (req.ExitPrice - req.EntryPrice) / pair.PipSize
	pnl := pipDiff * pair.PipValue * req.LotSize
	marginReq := (req.EntryPrice * 100000 * req.LotSize) / float64(pair.MaxLeverage)

	return models.FXPipCalculatorResult{
		Pair:           req.Pair,
		PipDifference:  math.Round(pipDiff*10) / 10,
		PipValue:       pair.PipValue,
		ProfitLoss:     math.Round(pnl*100) / 100,
		ProfitLossPips: math.Round(pipDiff*10) / 10,
		MarginRequired: math.Round(marginReq*100) / 100,
		LotSize:        req.LotSize,
	}
}

// ============================================================
// Seed FX Pairs
// ============================================================

func seedFXPairs() []models.FXPair {
	now := time.Now().UnixMilli()
	return []models.FXPair{
		// Major Pairs
		{ID: "fx-001", Symbol: "EUR/USD", BaseCurrency: "EUR", QuoteCurrency: "USD", DisplayName: "Euro / US Dollar", Category: "major", PipSize: 0.0001, PipValue: 10.0, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: -0.56, SwapShort: 0.23, SwapTripleDay: "Wednesday", SpreadTypical: 1.2, SpreadMin: 0.6, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 1.0853, Ask: 1.0855, High24h: 1.0892, Low24h: 1.0821, Change24h: 0.0018, ChangePercent: 0.17, Volume24h: 1850000, LastUpdate: now},
		{ID: "fx-002", Symbol: "GBP/USD", BaseCurrency: "GBP", QuoteCurrency: "USD", DisplayName: "British Pound / US Dollar", Category: "major", PipSize: 0.0001, PipValue: 10.0, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: -0.42, SwapShort: 0.15, SwapTripleDay: "Wednesday", SpreadTypical: 1.5, SpreadMin: 0.8, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 1.2698, Ask: 1.2701, High24h: 1.2745, Low24h: 1.2662, Change24h: 0.0024, ChangePercent: 0.19, Volume24h: 1420000, LastUpdate: now},
		{ID: "fx-003", Symbol: "USD/JPY", BaseCurrency: "USD", QuoteCurrency: "JPY", DisplayName: "US Dollar / Japanese Yen", Category: "major", PipSize: 0.01, PipValue: 6.67, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: 1.25, SwapShort: -1.85, SwapTripleDay: "Wednesday", SpreadTypical: 1.1, SpreadMin: 0.5, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 149.82, Ask: 149.84, High24h: 150.25, Low24h: 149.45, Change24h: 0.35, ChangePercent: 0.23, Volume24h: 1680000, LastUpdate: now},
		{ID: "fx-004", Symbol: "USD/CHF", BaseCurrency: "USD", QuoteCurrency: "CHF", DisplayName: "US Dollar / Swiss Franc", Category: "major", PipSize: 0.0001, PipValue: 11.24, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: 0.68, SwapShort: -1.12, SwapTripleDay: "Wednesday", SpreadTypical: 1.4, SpreadMin: 0.8, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 0.8892, Ask: 0.8894, High24h: 0.8925, Low24h: 0.8860, Change24h: -0.0012, ChangePercent: -0.13, Volume24h: 890000, LastUpdate: now},
		{ID: "fx-005", Symbol: "AUD/USD", BaseCurrency: "AUD", QuoteCurrency: "USD", DisplayName: "Australian Dollar / US Dollar", Category: "major", PipSize: 0.0001, PipValue: 10.0, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: -0.35, SwapShort: 0.08, SwapTripleDay: "Wednesday", SpreadTypical: 1.3, SpreadMin: 0.7, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 0.6542, Ask: 0.6544, High24h: 0.6578, Low24h: 0.6510, Change24h: 0.0015, ChangePercent: 0.23, Volume24h: 1120000, LastUpdate: now},
		{ID: "fx-006", Symbol: "USD/CAD", BaseCurrency: "USD", QuoteCurrency: "CAD", DisplayName: "US Dollar / Canadian Dollar", Category: "major", PipSize: 0.0001, PipValue: 7.35, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: -0.15, SwapShort: -0.32, SwapTripleDay: "Wednesday", SpreadTypical: 1.5, SpreadMin: 0.8, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 1.3598, Ask: 1.3601, High24h: 1.3645, Low24h: 1.3565, Change24h: -0.0018, ChangePercent: -0.13, Volume24h: 920000, LastUpdate: now},
		{ID: "fx-007", Symbol: "NZD/USD", BaseCurrency: "NZD", QuoteCurrency: "USD", DisplayName: "New Zealand Dollar / US Dollar", Category: "major", PipSize: 0.0001, PipValue: 10.0, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 200, MarginRequired: 0.5, SwapLong: -0.28, SwapShort: 0.05, SwapTripleDay: "Wednesday", SpreadTypical: 1.8, SpreadMin: 1.0, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 0.6185, Ask: 0.6188, High24h: 0.6215, Low24h: 0.6155, Change24h: 0.0012, ChangePercent: 0.19, Volume24h: 680000, LastUpdate: now},

		// Minor / Cross Pairs
		{ID: "fx-008", Symbol: "EUR/GBP", BaseCurrency: "EUR", QuoteCurrency: "GBP", DisplayName: "Euro / British Pound", Category: "minor", PipSize: 0.0001, PipValue: 12.70, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 100, MarginRequired: 1.0, SwapLong: -0.38, SwapShort: 0.12, SwapTripleDay: "Wednesday", SpreadTypical: 1.5, SpreadMin: 0.9, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 0.8546, Ask: 0.8549, High24h: 0.8572, Low24h: 0.8525, Change24h: -0.0005, ChangePercent: -0.06, Volume24h: 520000, LastUpdate: now},
		{ID: "fx-009", Symbol: "EUR/JPY", BaseCurrency: "EUR", QuoteCurrency: "JPY", DisplayName: "Euro / Japanese Yen", Category: "minor", PipSize: 0.01, PipValue: 6.67, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 100, MarginRequired: 1.0, SwapLong: 0.85, SwapShort: -1.45, SwapTripleDay: "Wednesday", SpreadTypical: 2.0, SpreadMin: 1.2, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 162.58, Ask: 162.62, High24h: 163.10, Low24h: 162.05, Change24h: 0.42, ChangePercent: 0.26, Volume24h: 680000, LastUpdate: now},
		{ID: "fx-010", Symbol: "GBP/JPY", BaseCurrency: "GBP", QuoteCurrency: "JPY", DisplayName: "British Pound / Japanese Yen", Category: "minor", PipSize: 0.01, PipValue: 6.67, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 100, MarginRequired: 1.0, SwapLong: 1.05, SwapShort: -1.65, SwapTripleDay: "Wednesday", SpreadTypical: 2.5, SpreadMin: 1.5, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 190.25, Ask: 190.30, High24h: 190.85, Low24h: 189.65, Change24h: 0.55, ChangePercent: 0.29, Volume24h: 450000, LastUpdate: now},

		// Exotic / African Pairs
		{ID: "fx-011", Symbol: "USD/NGN", BaseCurrency: "USD", QuoteCurrency: "NGN", DisplayName: "US Dollar / Nigerian Naira", Category: "african", PipSize: 0.01, PipValue: 0.0063, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -2.50, SwapShort: 1.80, SwapTripleDay: "Wednesday", SpreadTypical: 50.0, SpreadMin: 25.0, CommissionPerLot: 5.00, TradingHours: "Mon 08:00 - Fri 16:00 WAT", Active: true, Bid: 1585.00, Ask: 1586.50, High24h: 1590.00, Low24h: 1578.00, Change24h: 3.50, ChangePercent: 0.22, Volume24h: 320000, LastUpdate: now},
		{ID: "fx-012", Symbol: "EUR/NGN", BaseCurrency: "EUR", QuoteCurrency: "NGN", DisplayName: "Euro / Nigerian Naira", Category: "african", PipSize: 0.01, PipValue: 0.0063, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -3.10, SwapShort: 2.25, SwapTripleDay: "Wednesday", SpreadTypical: 65.0, SpreadMin: 35.0, CommissionPerLot: 5.00, TradingHours: "Mon 08:00 - Fri 16:00 WAT", Active: true, Bid: 1720.00, Ask: 1722.00, High24h: 1728.00, Low24h: 1712.00, Change24h: 5.00, ChangePercent: 0.29, Volume24h: 180000, LastUpdate: now},
		{ID: "fx-013", Symbol: "GBP/NGN", BaseCurrency: "GBP", QuoteCurrency: "NGN", DisplayName: "British Pound / Nigerian Naira", Category: "african", PipSize: 0.01, PipValue: 0.0063, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -2.80, SwapShort: 1.95, SwapTripleDay: "Wednesday", SpreadTypical: 70.0, SpreadMin: 40.0, CommissionPerLot: 5.00, TradingHours: "Mon 08:00 - Fri 16:00 WAT", Active: true, Bid: 2012.00, Ask: 2014.50, High24h: 2022.00, Low24h: 2005.00, Change24h: 6.50, ChangePercent: 0.32, Volume24h: 145000, LastUpdate: now},
		{ID: "fx-014", Symbol: "USD/ZAR", BaseCurrency: "USD", QuoteCurrency: "ZAR", DisplayName: "US Dollar / South African Rand", Category: "african", PipSize: 0.0001, PipValue: 0.55, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -1.85, SwapShort: 0.95, SwapTripleDay: "Wednesday", SpreadTypical: 12.0, SpreadMin: 8.0, CommissionPerLot: 5.00, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 18.2450, Ask: 18.2570, High24h: 18.3200, Low24h: 18.1800, Change24h: 0.0350, ChangePercent: 0.19, Volume24h: 420000, LastUpdate: now},
		{ID: "fx-015", Symbol: "USD/KES", BaseCurrency: "USD", QuoteCurrency: "KES", DisplayName: "US Dollar / Kenyan Shilling", Category: "african", PipSize: 0.01, PipValue: 0.0077, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -1.50, SwapShort: 0.85, SwapTripleDay: "Wednesday", SpreadTypical: 30.0, SpreadMin: 15.0, CommissionPerLot: 5.00, TradingHours: "Mon 08:00 - Fri 16:00 EAT", Active: true, Bid: 129.50, Ask: 130.00, High24h: 130.50, Low24h: 129.00, Change24h: 0.25, ChangePercent: 0.19, Volume24h: 180000, LastUpdate: now},
		{ID: "fx-016", Symbol: "USD/GHS", BaseCurrency: "USD", QuoteCurrency: "GHS", DisplayName: "US Dollar / Ghanaian Cedi", Category: "african", PipSize: 0.01, PipValue: 0.065, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -2.20, SwapShort: 1.50, SwapTripleDay: "Wednesday", SpreadTypical: 40.0, SpreadMin: 20.0, CommissionPerLot: 5.00, TradingHours: "Mon 08:00 - Fri 16:00 GMT", Active: true, Bid: 15.35, Ask: 15.42, High24h: 15.50, Low24h: 15.28, Change24h: 0.05, ChangePercent: 0.33, Volume24h: 95000, LastUpdate: now},

		// Exotic Pairs
		{ID: "fx-017", Symbol: "USD/TRY", BaseCurrency: "USD", QuoteCurrency: "TRY", DisplayName: "US Dollar / Turkish Lira", Category: "exotic", PipSize: 0.0001, PipValue: 0.30, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -25.0, SwapShort: 18.0, SwapTripleDay: "Wednesday", SpreadTypical: 15.0, SpreadMin: 8.0, CommissionPerLot: 5.00, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 32.4500, Ask: 32.4650, High24h: 32.5200, Low24h: 32.3800, Change24h: 0.0450, ChangePercent: 0.14, Volume24h: 350000, LastUpdate: now},
		{ID: "fx-018", Symbol: "USD/MXN", BaseCurrency: "USD", QuoteCurrency: "MXN", DisplayName: "US Dollar / Mexican Peso", Category: "exotic", PipSize: 0.0001, PipValue: 0.56, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -8.50, SwapShort: 5.20, SwapTripleDay: "Wednesday", SpreadTypical: 8.0, SpreadMin: 5.0, CommissionPerLot: 5.00, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 17.8250, Ask: 17.8330, High24h: 17.8800, Low24h: 17.7600, Change24h: 0.0280, ChangePercent: 0.16, Volume24h: 480000, LastUpdate: now},
		{ID: "fx-019", Symbol: "USD/SGD", BaseCurrency: "USD", QuoteCurrency: "SGD", DisplayName: "US Dollar / Singapore Dollar", Category: "exotic", PipSize: 0.0001, PipValue: 7.45, MinLotSize: 0.01, MaxLotSize: 100, LotStep: 0.01, MaxLeverage: 100, MarginRequired: 1.0, SwapLong: -0.45, SwapShort: 0.12, SwapTripleDay: "Wednesday", SpreadTypical: 2.0, SpreadMin: 1.2, CommissionPerLot: 3.50, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 1.3412, Ask: 1.3415, High24h: 1.3445, Low24h: 1.3385, Change24h: -0.0008, ChangePercent: -0.06, Volume24h: 380000, LastUpdate: now},
		{ID: "fx-020", Symbol: "USD/CNH", BaseCurrency: "USD", QuoteCurrency: "CNH", DisplayName: "US Dollar / Offshore Chinese Yuan", Category: "exotic", PipSize: 0.0001, PipValue: 1.38, MinLotSize: 0.01, MaxLotSize: 50, LotStep: 0.01, MaxLeverage: 50, MarginRequired: 2.0, SwapLong: -1.20, SwapShort: 0.45, SwapTripleDay: "Wednesday", SpreadTypical: 3.0, SpreadMin: 1.8, CommissionPerLot: 5.00, TradingHours: "Sun 22:00 - Fri 22:00 UTC", Active: true, Bid: 7.2485, Ask: 7.2515, High24h: 7.2650, Low24h: 7.2350, Change24h: 0.0085, ChangePercent: 0.12, Volume24h: 520000, LastUpdate: now},
	}
}
