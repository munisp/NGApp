package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
)

// ============================================================
// Polygon.io REST API Client — US Equities & NYSE Market Data
// ============================================================
// Connects to Polygon.io for real-time and historical US equity data.
// Falls back to cached/demo data when Polygon is unavailable.
// Docs: https://polygon.io/docs/stocks

// PolygonClient wraps Polygon.io REST API for US equities data.
type PolygonClient struct {
	baseURL      string
	apiKey       string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc

	// Cached data
	tickers map[string]PolygonTicker
	trades  []PolygonTrade

	// Metrics
	requestsOK   int64
	requestsFail int64
}

// PolygonTicker represents a stock ticker snapshot from Polygon.
type PolygonTicker struct {
	Ticker    string  `json:"ticker"`
	Name      string  `json:"name"`
	Market    string  `json:"market"`
	Locale    string  `json:"locale"`
	Type      string  `json:"type"`
	Currency  string  `json:"currency_name"`
	LastPrice float64 `json:"lastPrice"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	VWAP      float64 `json:"vwap"`
	Change    float64 `json:"change"`
	ChangePct float64 `json:"changePercent"`
	Updated   int64   `json:"updated"`
}

// PolygonTrade represents a trade from Polygon.
type PolygonTrade struct {
	Ticker     string  `json:"ticker"`
	Price      float64 `json:"price"`
	Size       int     `json:"size"`
	Exchange   int     `json:"exchange"`
	Timestamp  int64   `json:"timestamp"`
	Conditions []int   `json:"conditions"`
}

// PolygonAggregate represents an OHLCV bar from Polygon.
type PolygonAggregate struct {
	Ticker string  `json:"T"`
	Open   float64 `json:"o"`
	High   float64 `json:"h"`
	Low    float64 `json:"l"`
	Close  float64 `json:"c"`
	Volume float64 `json:"v"`
	VWAP   float64 `json:"vw"`
	Time   int64   `json:"t"`
	NumTx  int     `json:"n"`
}

// PolygonExchange represents an exchange from Polygon reference data.
type PolygonExchange struct {
	ID           int    `json:"id"`
	Type         string `json:"type"`
	Market       string `json:"market"`
	MIC          string `json:"mic"`
	Name         string `json:"name"`
	Tape         string `json:"tape"`
	Acronym      string `json:"acronym"`
	Locale       string `json:"locale"`
	URL          string `json:"url"`
	OperatingMIC string `json:"operating_mic"`
}

// PolygonTickerDetails has detailed info about a ticker.
type PolygonTickerDetails struct {
	Ticker            string  `json:"ticker"`
	Name              string  `json:"name"`
	Market            string  `json:"market"`
	Locale            string  `json:"locale"`
	Type              string  `json:"type"`
	CurrencyName      string  `json:"currency_name"`
	CIK               string  `json:"cik"`
	CompositeFIGI     string  `json:"composite_figi"`
	ShareClassFIGI    string  `json:"share_class_figi"`
	PrimaryExchange   string  `json:"primary_exchange"`
	Description       string  `json:"description"`
	SICCode           string  `json:"sic_code"`
	SICDescription    string  `json:"sic_description"`
	TotalEmployees    int     `json:"total_employees"`
	ListDate          string  `json:"list_date"`
	MarketCap         float64 `json:"market_cap"`
	SharesOutstanding float64 `json:"share_class_shares_outstanding"`
	WeightedShares    float64 `json:"weighted_shares_outstanding"`
	HomepageURL       string  `json:"homepage_url"`
	LogoURL           string  `json:"branding_logo_url"`
}

// NewPolygonClient creates a new Polygon.io API client.
// apiKey: Polygon.io API key from https://polygon.io/dashboard/api-keys
func NewPolygonClient(apiKey string) *PolygonClient {
	ctx, cancel := context.WithCancel(context.Background())
	c := &PolygonClient{
		baseURL: "https://api.polygon.io",
		apiKey:  apiKey,
		tickers: make(map[string]PolygonTicker),
		ctx:     ctx,
		cancel:  cancel,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name:        "polygon-api",
		MaxRequests: 3,
		Interval:    30 * time.Second,
		Timeout:     15 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Polygon] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *PolygonClient) connect() {
	if c.apiKey == "" || c.apiKey == "demo" {
		log.Printf("[Polygon] No API key configured — running in fallback mode (demo data)")
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	log.Printf("[Polygon] Connecting to %s...", c.baseURL)

	// Test with a simple reference data call
	req, err := http.NewRequestWithContext(c.ctx, "GET",
		fmt.Sprintf("%s/v3/reference/tickers?market=stocks&limit=1&apiKey=%s", c.baseURL, c.apiKey), nil)
	if err != nil {
		c.setFallback("request creation failed: " + err.Error())
		return
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.setFallback("cannot reach API: " + err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		c.setFallback(fmt.Sprintf("API returned %d: %s", resp.StatusCode, string(body)))
		return
	}

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Polygon] Connected to %s", c.baseURL)
}

func (c *PolygonClient) setFallback(reason string) {
	log.Printf("[Polygon] WARN: %s — running in fallback mode", reason)
	c.mu.Lock()
	c.fallbackMode = true
	c.connected = false
	c.mu.Unlock()
}

func (c *PolygonClient) reconnectLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			isFallback := c.fallbackMode
			c.mu.RUnlock()
			if isFallback && c.apiKey != "" && c.apiKey != "demo" {
				c.connect()
			}
		}
	}
}

func (c *PolygonClient) doRequest(url string) ([]byte, error) {
	return c.cb.Execute(func() ([]byte, error) {
		separator := "?"
		if len(url) > 0 {
			for _, ch := range url {
				if ch == '?' {
					separator = "&"
					break
				}
			}
		}
		fullURL := fmt.Sprintf("%s%s%sapiKey=%s", c.baseURL, url, separator, c.apiKey)
		req, err := http.NewRequestWithContext(c.ctx, "GET", fullURL, nil)
		if err != nil {
			return nil, err
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			c.mu.Lock()
			c.requestsFail++
			c.mu.Unlock()
			return nil, err
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			c.mu.Lock()
			c.requestsFail++
			c.mu.Unlock()
			return nil, fmt.Errorf("Polygon API error %d: %s", resp.StatusCode, string(body))
		}
		c.mu.Lock()
		c.requestsOK++
		c.mu.Unlock()
		return body, nil
	})
}

// GetSnapshot fetches a real-time snapshot for a ticker.
func (c *PolygonClient) GetSnapshot(ticker string) (*PolygonTicker, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/v2/snapshot/locale/us/markets/stocks/tickers/%s?", ticker))
	if err != nil {
		return nil, err
	}

	var resp struct {
		Ticker struct {
			Ticker string `json:"ticker"`
			Day    struct {
				O  float64 `json:"o"`
				H  float64 `json:"h"`
				L  float64 `json:"l"`
				C  float64 `json:"c"`
				V  float64 `json:"v"`
				VW float64 `json:"vw"`
			} `json:"day"`
			LastTrade struct {
				P float64 `json:"p"`
				S int     `json:"s"`
				T int64   `json:"t"`
			} `json:"lastTrade"`
			PrevDay struct {
				C float64 `json:"c"`
			} `json:"prevDay"`
			TodaysChange     float64 `json:"todaysChange"`
			TodaysChangePerc float64 `json:"todaysChangePerc"`
			Updated          int64   `json:"updated"`
		} `json:"ticker"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}

	t := &PolygonTicker{
		Ticker:    resp.Ticker.Ticker,
		Open:      resp.Ticker.Day.O,
		High:      resp.Ticker.Day.H,
		Low:       resp.Ticker.Day.L,
		Close:     resp.Ticker.Day.C,
		Volume:    resp.Ticker.Day.V,
		VWAP:      resp.Ticker.Day.VW,
		LastPrice: resp.Ticker.LastTrade.P,
		Change:    resp.Ticker.TodaysChange,
		ChangePct: resp.Ticker.TodaysChangePerc,
		Updated:   resp.Ticker.Updated,
	}

	c.mu.Lock()
	c.tickers[ticker] = *t
	c.mu.Unlock()

	return t, nil
}

// GetAggregates fetches historical OHLCV bars for a ticker.
// timespan: "minute", "hour", "day", "week", "month", "quarter", "year"
func (c *PolygonClient) GetAggregates(ticker string, multiplier int, timespan, from, to string) ([]PolygonAggregate, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	url := fmt.Sprintf("/v2/aggs/ticker/%s/range/%d/%s/%s/%s?adjusted=true&sort=asc&limit=5000&",
		ticker, multiplier, timespan, from, to)
	data, err := c.doRequest(url)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Results []PolygonAggregate `json:"results"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Results, nil
}

// GetTickerDetails fetches detailed information about a ticker.
func (c *PolygonClient) GetTickerDetails(ticker string) (*PolygonTickerDetails, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/v3/reference/tickers/%s?", ticker))
	if err != nil {
		return nil, err
	}

	var resp struct {
		Results PolygonTickerDetails `json:"results"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return &resp.Results, nil
}

// SearchTickers searches for tickers matching a query.
func (c *PolygonClient) SearchTickers(query string, market string, limit int) ([]PolygonTickerDetails, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	url := fmt.Sprintf("/v3/reference/tickers?search=%s&market=%s&active=true&limit=%d&", query, market, limit)
	data, err := c.doRequest(url)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Results []PolygonTickerDetails `json:"results"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Results, nil
}

// GetExchanges fetches available exchanges.
func (c *PolygonClient) GetExchanges() ([]PolygonExchange, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	data, err := c.doRequest("/v3/reference/exchanges?")
	if err != nil {
		return nil, err
	}

	var resp struct {
		Results []PolygonExchange `json:"results"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Results, nil
}

// GetMarketStatus fetches current market status (open/closed).
func (c *PolygonClient) GetMarketStatus() (map[string]interface{}, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("Polygon not connected")
	}

	data, err := c.doRequest("/v1/marketstatus/now?")
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// IsConnected returns true if Polygon API is reachable.
func (c *PolygonClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// IsFallback returns true if running in fallback mode.
func (c *PolygonClient) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

// GetMetrics returns request success/failure counts.
func (c *PolygonClient) GetMetrics() (ok, fail int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.requestsOK, c.requestsFail
}

// Close shuts down the Polygon client.
func (c *PolygonClient) Close() {
	c.cancel()
	log.Println("[Polygon] Client closed")
}
