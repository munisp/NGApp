package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/services/gateway/internal/models"
)

// ============================================================
// Forex Trading API Handlers
// ============================================================

// --- FX Pairs ---

func (s *Server) fxListPairs(c *gin.Context) {
	category := c.Query("category")
	pairs := s.store.GetFXPairs(category)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    pairs,
		Meta:    models.PaginationMeta{Total: len(pairs), Page: 1, Limit: len(pairs), Pages: 1},
	})
}

func (s *Server) fxGetPair(c *gin.Context) {
	symbol := c.Param("pair")
	pair, ok := s.store.GetFXPair(symbol)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "FX pair not found: " + symbol})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: pair})
}

func (s *Server) fxSearchPairs(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "query parameter 'q' required"})
		return
	}
	results := s.store.SearchFXPairs(q)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: results})
}

// --- FX Orders ---

func (s *Server) fxListOrders(c *gin.Context) {
	userID := s.getUserID(c)
	status := c.Query("status")
	orders := s.store.GetFXOrders(userID, status)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    orders,
		Meta:    models.PaginationMeta{Total: len(orders), Page: 1, Limit: len(orders), Pages: 1},
	})
}

func (s *Server) fxGetOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, ok := s.store.GetFXOrder(orderID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "FX order not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: order})
}

func (s *Server) fxCreateOrder(c *gin.Context) {
	var req models.CreateFXOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Validate pair exists
	pair, ok := s.store.GetFXPair(req.Pair)
	if !ok {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "unknown FX pair: " + req.Pair})
		return
	}

	// Validate lot size
	if req.LotSize < pair.MinLotSize || req.LotSize > pair.MaxLotSize {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "lot size must be between min and max for this pair",
		})
		return
	}

	// Validate leverage
	if req.Leverage > pair.MaxLeverage {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "leverage exceeds maximum for this pair",
		})
		return
	}

	// Validate OCO order has both prices
	if req.Type == models.FXOrderOCO && (req.OCOStopPrice == 0 || req.OCOLimitPrice == 0) {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "OCO orders require both ocoStopPrice and ocoLimitPrice",
		})
		return
	}

	userID := s.getUserID(c)
	order := models.FXOrder{
		UserID:           userID,
		Pair:             req.Pair,
		Side:             req.Side,
		Type:             req.Type,
		LotSize:          req.LotSize,
		Price:            req.Price,
		StopLoss:         req.StopLoss,
		TakeProfit:       req.TakeProfit,
		TrailingStopPips: req.TrailingStopPips,
		OCOStopPrice:     req.OCOStopPrice,
		OCOLimitPrice:    req.OCOLimitPrice,
		Leverage:         req.Leverage,
		Comment:          req.Comment,
	}

	created := s.store.CreateFXOrder(order)

	// Publish order event via Kafka (fallback: no-op)
	s.kafka.ProduceAsync("fx-orders", created.ID, created)

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: created})
}

func (s *Server) fxCancelOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, err := s.store.CancelFXOrder(orderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: order})
}

// --- FX Positions ---

func (s *Server) fxListPositions(c *gin.Context) {
	userID := s.getUserID(c)
	status := c.DefaultQuery("status", "OPEN")
	positions := s.store.GetFXPositions(userID, status)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    positions,
		Meta:    models.PaginationMeta{Total: len(positions), Page: 1, Limit: len(positions), Pages: 1},
	})
}

func (s *Server) fxGetPosition(c *gin.Context) {
	posID := c.Param("id")
	pos, ok := s.store.GetFXPosition(posID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "FX position not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: pos})
}

func (s *Server) fxModifyPosition(c *gin.Context) {
	posID := c.Param("id")
	var req models.ModifyFXPositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	pos, err := s.store.ModifyFXPosition(posID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: pos})
}

func (s *Server) fxClosePosition(c *gin.Context) {
	posID := c.Param("id")
	pos, err := s.store.CloseFXPosition(posID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: pos})
}

// --- FX Account ---

func (s *Server) fxAccountSummary(c *gin.Context) {
	userID := s.getUserID(c)
	summary := s.store.GetFXAccountSummary(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: summary})
}

// --- FX Swap Rates ---

func (s *Server) fxSwapRates(c *gin.Context) {
	rates := s.store.GetFXSwapRates()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: rates})
}

// --- FX Cross Rates ---

func (s *Server) fxCrossRates(c *gin.Context) {
	rates := s.store.GetFXCrossRates()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: rates})
}

// --- FX Margin Requirements ---

func (s *Server) fxMarginRequirements(c *gin.Context) {
	reqs := s.store.GetFXMarginRequirements()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: reqs})
}

// --- FX Liquidity Providers ---

func (s *Server) fxLiquidityProviders(c *gin.Context) {
	providers := s.store.GetFXLiquidityProviders()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: providers})
}

// --- FX Regulatory Info ---

func (s *Server) fxRegulatoryInfo(c *gin.Context) {
	info := s.store.GetFXRegulatoryInfo()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: info})
}

// --- FX Pip Calculator ---

func (s *Server) fxPipCalculator(c *gin.Context) {
	var req models.FXPipCalculatorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	result := s.store.CalculateFXPips(req)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: result})
}

// --- FX Trading Hours ---

func (s *Server) fxTradingHours(c *gin.Context) {
	pairs := s.store.GetFXPairs("")
	type hourInfo struct {
		Pair         string `json:"pair"`
		TradingHours string `json:"tradingHours"`
		Active       bool   `json:"active"`
		Category     string `json:"category"`
	}
	var hours []hourInfo
	for _, p := range pairs {
		hours = append(hours, hourInfo{
			Pair:         p.Symbol,
			TradingHours: p.TradingHours,
			Active:       p.Active,
			Category:     p.Category,
		})
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: hours})
}
