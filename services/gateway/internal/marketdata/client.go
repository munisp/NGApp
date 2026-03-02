package marketdata

import (
	"fmt"
	"log"
	"strconv"
)

// ============================================================
// Unified Market Data Client — Aggregates All External Sources
// ============================================================
// Provides a single entry point for all external market data:
// - OANDA v20 for FX price feeds
// - Polygon.io for US equities / NYSE data
// - IEX Cloud for reference data / fundamentals
// - Economic Calendar for central bank rates, events, swap rates

// Client is the unified market data aggregator.
type Client struct {
	Oanda    *OandaClient
	Polygon  *PolygonClient
	IEX      *IEXClient
	Calendar *CalendarClient
}

// Config holds configuration for all market data providers.
type Config struct {
	// OANDA v20 API
	OandaBaseURL   string
	OandaAPIKey    string
	OandaAccountID string

	// Polygon.io API
	PolygonAPIKey string

	// IEX Cloud API
	IEXAPIKey string

	// FRED API (for economic calendar)
	FREDAPIKey string
}

// NewClient creates a unified market data client with all providers.
func NewClient(cfg Config) *Client {
	log.Println("[MarketData] Initializing external data source clients...")

	c := &Client{
		Oanda:    NewOandaClient(cfg.OandaBaseURL, cfg.OandaAPIKey, cfg.OandaAccountID),
		Polygon:  NewPolygonClient(cfg.PolygonAPIKey),
		IEX:      NewIEXClient(cfg.IEXAPIKey),
		Calendar: NewCalendarClient(cfg.FREDAPIKey),
	}

	log.Printf("[MarketData] All clients initialized — OANDA:%s Polygon:%s IEX:%s Calendar:%s",
		statusStr(c.Oanda.IsConnected()), statusStr(c.Polygon.IsConnected()),
		statusStr(c.IEX.IsConnected()), statusStr(c.Calendar.IsConnected()))

	return c
}

// Status returns the connection status of all providers.
func (c *Client) Status() map[string]ProviderStatus {
	oandaOK, oandaFail := c.Oanda.GetMetrics()
	polygonOK, polygonFail := c.Polygon.GetMetrics()
	iexOK, iexFail := c.IEX.GetMetrics()
	calOK, calFail := c.Calendar.GetMetrics()

	return map[string]ProviderStatus{
		"oanda": {
			Name:         "OANDA v20",
			Type:         "FX Price Feed",
			Connected:    c.Oanda.IsConnected(),
			FallbackMode: c.Oanda.IsFallback(),
			RequestsOK:   oandaOK,
			RequestsFail: oandaFail,
			Description:  "Real-time forex bid/ask prices, historical candles, instrument metadata",
			Endpoint:     "https://api-fxtrade.oanda.com/v3",
			DocsURL:      "https://developer.oanda.com/rest-live-v20/pricing-ep/",
		},
		"polygon": {
			Name:         "Polygon.io",
			Type:         "US Equities / NYSE",
			Connected:    c.Polygon.IsConnected(),
			FallbackMode: c.Polygon.IsFallback(),
			RequestsOK:   polygonOK,
			RequestsFail: polygonFail,
			Description:  "Real-time US stock quotes, aggregates, ticker details, exchanges",
			Endpoint:     "https://api.polygon.io",
			DocsURL:      "https://polygon.io/docs/stocks",
		},
		"iex": {
			Name:         "IEX Cloud",
			Type:         "Reference Data / Fundamentals",
			Connected:    c.IEX.IsConnected(),
			FallbackMode: c.IEX.IsFallback(),
			RequestsOK:   iexOK,
			RequestsFail: iexFail,
			Description:  "Company info, earnings, dividends, key stats, CUSIP/ISIN lookups",
			Endpoint:     "https://cloud.iexapis.com/stable",
			DocsURL:      "https://iexcloud.io/docs/api/",
		},
		"calendar": {
			Name:         "Economic Calendar",
			Type:         "Central Bank Rates & Events",
			Connected:    c.Calendar.IsConnected(),
			FallbackMode: c.Calendar.IsFallback(),
			RequestsOK:   calOK,
			RequestsFail: calFail,
			Description:  "ECB/FRED/BoE rates, economic events, swap rates, reference FX rates",
			Endpoint:     "ECB SDW + FRED API + BoE API",
			DocsURL:      "https://data-api.ecb.europa.eu/",
		},
	}
}

// ProviderStatus represents the status of an external data provider.
type ProviderStatus struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Connected    bool   `json:"connected"`
	FallbackMode bool   `json:"fallbackMode"`
	RequestsOK   int64  `json:"requestsOK"`
	RequestsFail int64  `json:"requestsFail"`
	Description  string `json:"description"`
	Endpoint     string `json:"endpoint"`
	DocsURL      string `json:"docsURL"`
}

// Close shuts down all market data clients.
func (c *Client) Close() {
	c.Oanda.Close()
	c.Polygon.Close()
	c.IEX.Close()
	c.Calendar.Close()
	log.Println("[MarketData] All clients closed")
}

func statusStr(connected bool) string {
	if connected {
		return "connected"
	}
	return "fallback"
}

// parseFloat converts a string to float64, returns 0 on error.
func parseFloat(s string) float64 {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

// FormatPrice formats a price with the appropriate decimal places.
func FormatPrice(price float64, decimals int) string {
	return fmt.Sprintf("%.*f", decimals, price)
}
