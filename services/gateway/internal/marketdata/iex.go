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
// IEX Cloud REST API Client — Reference Data & Fundamentals
// ============================================================
// Connects to IEX Cloud for company fundamentals, dividends,
// earnings, and reference data (CUSIP, ISIN, SEDOL lookups).
// Falls back to cached/demo data when IEX is unavailable.
// Docs: https://iexcloud.io/docs/api/

// IEXClient wraps IEX Cloud REST API for reference data.
type IEXClient struct {
	baseURL      string
	apiKey       string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc

	// Metrics
	requestsOK   int64
	requestsFail int64
}

// IEXCompany represents company info from IEX.
type IEXCompany struct {
	Symbol      string   `json:"symbol"`
	CompanyName string   `json:"companyName"`
	Exchange    string   `json:"exchange"`
	Industry    string   `json:"industry"`
	Sector      string   `json:"sector"`
	Website     string   `json:"website"`
	Description string   `json:"description"`
	CEO         string   `json:"CEO"`
	Employees   int      `json:"employees"`
	Country     string   `json:"country"`
	State       string   `json:"state"`
	City        string   `json:"city"`
	Tags        []string `json:"tags"`
	IssueType   string   `json:"issueType"`
	SecurityName string  `json:"securityName"`
	PrimarySIC  int      `json:"primarySicCode"`
}

// IEXQuote represents a real-time stock quote from IEX.
type IEXQuote struct {
	Symbol           string  `json:"symbol"`
	CompanyName      string  `json:"companyName"`
	LatestPrice      float64 `json:"latestPrice"`
	LatestSource     string  `json:"latestSource"`
	LatestTime       string  `json:"latestTime"`
	LatestUpdate     int64   `json:"latestUpdate"`
	LatestVolume     int64   `json:"latestVolume"`
	Change           float64 `json:"change"`
	ChangePercent    float64 `json:"changePercent"`
	Open             float64 `json:"open"`
	High             float64 `json:"high"`
	Low              float64 `json:"low"`
	Close            float64 `json:"close"`
	PreviousClose    float64 `json:"previousClose"`
	Volume           int64   `json:"volume"`
	AvgTotalVolume   int64   `json:"avgTotalVolume"`
	MarketCap        int64   `json:"marketCap"`
	PERatio          float64 `json:"peRatio"`
	Week52High       float64 `json:"week52High"`
	Week52Low        float64 `json:"week52Low"`
	YTDChange        float64 `json:"ytdChange"`
	PrimaryExchange  string  `json:"primaryExchange"`
	IsUSMarketOpen   bool    `json:"isUSMarketOpen"`
}

// IEXDividend represents a dividend record from IEX.
type IEXDividend struct {
	ExDate       string  `json:"exDate"`
	PaymentDate  string  `json:"paymentDate"`
	RecordDate   string  `json:"recordDate"`
	DeclaredDate string  `json:"declaredDate"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Frequency    string  `json:"frequency"`
	Flag         string  `json:"flag"`
	Description  string  `json:"description"`
}

// IEXEarnings represents earnings data from IEX.
type IEXEarnings struct {
	ActualEPS      float64 `json:"actualEPS"`
	ConsensusEPS   float64 `json:"consensusEPS"`
	EPSSurprisePct float64 `json:"EPSSurpriseDollar"`
	FiscalPeriod   string  `json:"fiscalPeriod"`
	FiscalEndDate  string  `json:"fiscalEndDate"`
	ReportDate     string  `json:"reportDate"`
	Revenue        float64 `json:"revenue"`
	RevenueEstimate float64 `json:"revenueEstimate"`
}

// IEXKeyStats represents key statistics from IEX.
type IEXKeyStats struct {
	MarketCap         int64   `json:"marketcap"`
	Week52High        float64 `json:"week52high"`
	Week52Low         float64 `json:"week52low"`
	Week52Change      float64 `json:"week52change"`
	SharesOutstanding int64   `json:"sharesOutstanding"`
	Float             int64   `json:"float"`
	AvgVolume30       int64   `json:"avg30Volume"`
	AvgVolume10       int64   `json:"avg10Volume"`
	Employees         int     `json:"employees"`
	TTMEPS            float64 `json:"ttmEPS"`
	TTMDividendRate   float64 `json:"ttmDividendRate"`
	DividendYield     float64 `json:"dividendYield"`
	NextDividendDate  string  `json:"nextDividendDate"`
	ExDividendDate    string  `json:"exDividendDate"`
	NextEarningsDate  string  `json:"nextEarningsDate"`
	PERatio           float64 `json:"peRatio"`
	Beta              float64 `json:"beta"`
	Day200MovingAvg   float64 `json:"day200MovingAvg"`
	Day50MovingAvg    float64 `json:"day50MovingAvg"`
}

// NewIEXClient creates a new IEX Cloud API client.
// apiKey: IEX Cloud token from https://iexcloud.io/console/tokens
func NewIEXClient(apiKey string) *IEXClient {
	ctx, cancel := context.WithCancel(context.Background())
	c := &IEXClient{
		baseURL:  "https://cloud.iexapis.com",
		apiKey:   apiKey,
		ctx:      ctx,
		cancel:   cancel,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name:        "iex-api",
		MaxRequests: 3,
		Interval:    30 * time.Second,
		Timeout:     15 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[IEX] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *IEXClient) connect() {
	if c.apiKey == "" || c.apiKey == "demo" {
		log.Printf("[IEX] No API key configured — running in fallback mode (demo data)")
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	log.Printf("[IEX] Connecting to %s...", c.baseURL)

	req, err := http.NewRequestWithContext(c.ctx, "GET",
		fmt.Sprintf("%s/stable/stock/AAPL/quote?token=%s", c.baseURL, c.apiKey), nil)
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
	log.Printf("[IEX] Connected to %s", c.baseURL)
}

func (c *IEXClient) setFallback(reason string) {
	log.Printf("[IEX] WARN: %s — running in fallback mode", reason)
	c.mu.Lock()
	c.fallbackMode = true
	c.connected = false
	c.mu.Unlock()
}

func (c *IEXClient) reconnectLoop() {
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

func (c *IEXClient) doRequest(path string) ([]byte, error) {
	return c.cb.Execute(func() ([]byte, error) {
		separator := "?"
		for _, ch := range path {
			if ch == '?' {
				separator = "&"
				break
			}
		}
		fullURL := fmt.Sprintf("%s%s%stoken=%s", c.baseURL, path, separator, c.apiKey)
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
			return nil, fmt.Errorf("IEX API error %d: %s", resp.StatusCode, string(body))
		}
		c.mu.Lock()
		c.requestsOK++
		c.mu.Unlock()
		return body, nil
	})
}

// GetQuote fetches a real-time quote for a symbol.
func (c *IEXClient) GetQuote(symbol string) (*IEXQuote, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("IEX not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/stable/stock/%s/quote", symbol))
	if err != nil {
		return nil, err
	}

	var quote IEXQuote
	if err := json.Unmarshal(data, &quote); err != nil {
		return nil, err
	}
	return &quote, nil
}

// GetCompany fetches company information for a symbol.
func (c *IEXClient) GetCompany(symbol string) (*IEXCompany, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("IEX not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/stable/stock/%s/company", symbol))
	if err != nil {
		return nil, err
	}

	var company IEXCompany
	if err := json.Unmarshal(data, &company); err != nil {
		return nil, err
	}
	return &company, nil
}

// GetDividends fetches dividend history for a symbol.
// range: "5y", "2y", "1y", "ytd", "6m", "3m", "1m", "next"
func (c *IEXClient) GetDividends(symbol, rangeParam string) ([]IEXDividend, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("IEX not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/stable/stock/%s/dividends/%s", symbol, rangeParam))
	if err != nil {
		return nil, err
	}

	var dividends []IEXDividend
	if err := json.Unmarshal(data, &dividends); err != nil {
		return nil, err
	}
	return dividends, nil
}

// GetEarnings fetches earnings data for a symbol.
func (c *IEXClient) GetEarnings(symbol string, last int) ([]IEXEarnings, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("IEX not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/stable/stock/%s/earnings/%d", symbol, last))
	if err != nil {
		return nil, err
	}

	var resp struct {
		Earnings []IEXEarnings `json:"earnings"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Earnings, nil
}

// GetKeyStats fetches key statistics for a symbol.
func (c *IEXClient) GetKeyStats(symbol string) (*IEXKeyStats, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		return nil, fmt.Errorf("IEX not connected")
	}

	data, err := c.doRequest(fmt.Sprintf("/stable/stock/%s/stats", symbol))
	if err != nil {
		return nil, err
	}

	var stats IEXKeyStats
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

// IsConnected returns true if IEX API is reachable.
func (c *IEXClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// IsFallback returns true if running in fallback mode.
func (c *IEXClient) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

// GetMetrics returns request success/failure counts.
func (c *IEXClient) GetMetrics() (ok, fail int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.requestsOK, c.requestsFail
}

// Close shuts down the IEX client.
func (c *IEXClient) Close() {
	c.cancel()
	log.Println("[IEX] Client closed")
}
