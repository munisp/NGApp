package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/services/gateway/internal/models"
)

// ============================================================
// External Market Data API Handlers
// ============================================================
// Exposes OANDA, Polygon.io, IEX Cloud, and Economic Calendar
// data through the gateway REST API.

// --- Market Data Sources Status ---

func (s *Server) marketDataStatus(c *gin.Context) {
	status := s.marketData.Status()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: status})
}

// --- OANDA FX Price Feed ---

func (s *Server) oandaPrices(c *gin.Context) {
	instruments := c.Query("instruments")
	if instruments == "" {
		instruments = "EUR_USD,GBP_USD,USD_JPY,USD_CHF,AUD_USD,USD_CAD,NZD_USD,EUR_GBP,EUR_JPY,GBP_JPY"
	}
	prices, err := s.marketData.Oanda.GetPrices(instruments)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "OANDA price feed unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: prices})
}

func (s *Server) oandaCandles(c *gin.Context) {
	instrument := c.Param("instrument")
	granularity := c.DefaultQuery("granularity", "H1")
	countStr := c.DefaultQuery("count", "100")
	count, _ := strconv.Atoi(countStr)
	if count <= 0 || count > 5000 {
		count = 100
	}

	candles, err := s.marketData.Oanda.GetCandles(instrument, granularity, count)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "OANDA candle data unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: candles})
}

func (s *Server) oandaInstruments(c *gin.Context) {
	instruments, err := s.marketData.Oanda.GetInstruments()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "OANDA instruments unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: instruments})
}

// --- Polygon.io US Equities / NYSE ---

func (s *Server) polygonSnapshot(c *gin.Context) {
	ticker := c.Param("ticker")
	snapshot, err := s.marketData.Polygon.GetSnapshot(ticker)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon snapshot unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: snapshot})
}

func (s *Server) polygonAggregates(c *gin.Context) {
	ticker := c.Param("ticker")
	multiplierStr := c.DefaultQuery("multiplier", "1")
	timespan := c.DefaultQuery("timespan", "day")
	from := c.Query("from")
	to := c.Query("to")

	if from == "" || to == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "from and to date parameters required (YYYY-MM-DD)",
		})
		return
	}

	multiplier, _ := strconv.Atoi(multiplierStr)
	if multiplier <= 0 {
		multiplier = 1
	}

	aggs, err := s.marketData.Polygon.GetAggregates(ticker, multiplier, timespan, from, to)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon aggregates unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: aggs})
}

func (s *Server) polygonTickerDetails(c *gin.Context) {
	ticker := c.Param("ticker")
	details, err := s.marketData.Polygon.GetTickerDetails(ticker)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon ticker details unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: details})
}

func (s *Server) polygonSearch(c *gin.Context) {
	query := c.Query("q")
	market := c.DefaultQuery("market", "stocks")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	results, err := s.marketData.Polygon.SearchTickers(query, market, limit)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon search unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: results})
}

func (s *Server) polygonExchanges(c *gin.Context) {
	exchanges, err := s.marketData.Polygon.GetExchanges()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon exchanges unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: exchanges})
}

func (s *Server) polygonMarketStatus(c *gin.Context) {
	status, err := s.marketData.Polygon.GetMarketStatus()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "Polygon market status unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: status})
}

// --- IEX Cloud Reference Data / Fundamentals ---

func (s *Server) iexQuote(c *gin.Context) {
	symbol := c.Param("symbol")
	quote, err := s.marketData.IEX.GetQuote(symbol)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "IEX quote unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: quote})
}

func (s *Server) iexCompany(c *gin.Context) {
	symbol := c.Param("symbol")
	company, err := s.marketData.IEX.GetCompany(symbol)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "IEX company data unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: company})
}

func (s *Server) iexDividends(c *gin.Context) {
	symbol := c.Param("symbol")
	rangeParam := c.DefaultQuery("range", "1y")
	dividends, err := s.marketData.IEX.GetDividends(symbol, rangeParam)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "IEX dividend data unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: dividends})
}

func (s *Server) iexEarnings(c *gin.Context) {
	symbol := c.Param("symbol")
	lastStr := c.DefaultQuery("last", "4")
	last, _ := strconv.Atoi(lastStr)
	if last <= 0 || last > 12 {
		last = 4
	}
	earnings, err := s.marketData.IEX.GetEarnings(symbol, last)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "IEX earnings data unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: earnings})
}

func (s *Server) iexKeyStats(c *gin.Context) {
	symbol := c.Param("symbol")
	stats, err := s.marketData.IEX.GetKeyStats(symbol)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.APIResponse{
			Success: false,
			Error:   "IEX stats unavailable: " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: stats})
}

// --- Economic Calendar & Central Bank Rates ---

func (s *Server) calendarCentralBankRates(c *gin.Context) {
	rates := s.marketData.Calendar.GetCentralBankRates()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: rates})
}

func (s *Server) calendarEconomicEvents(c *gin.Context) {
	currency := c.Query("currency")
	events := s.marketData.Calendar.GetEconomicEvents(currency)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: events})
}

func (s *Server) calendarSwapRates(c *gin.Context) {
	rates := s.marketData.Calendar.GetSwapRates()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: rates})
}

func (s *Server) calendarExchangeRates(c *gin.Context) {
	rates := s.marketData.Calendar.GetExchangeRates()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: rates})
}
