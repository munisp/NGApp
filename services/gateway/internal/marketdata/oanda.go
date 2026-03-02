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
// OANDA v20 REST API Client — Real-Time FX Price Feeds
// ============================================================
// Connects to OANDA's v20 REST API for live forex quotes.
// Falls back to cached/demo data when OANDA is unavailable.
// Docs: https://developer.oanda.com/rest-live-v20/pricing-ep/

// OandaClient wraps OANDA v20 REST API for FX price streaming.
type OandaClient struct {
	baseURL      string
	apiKey       string
	accountID    string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc

	// Cached prices
	prices map[string]OandaPrice

	// Metrics
	requestsOK   int64
	requestsFail int64
}

// OandaPrice represents a live FX price from OANDA.
type OandaPrice struct {
	Instrument  string    `json:"instrument"`
	Bid         float64   `json:"bid"`
	Ask         float64   `json:"ask"`
	Spread      float64   `json:"spread"`
	Time        time.Time `json:"time"`
	Tradeable   bool      `json:"tradeable"`
	CloseoutBid float64   `json:"closeoutBid"`
	CloseoutAsk float64   `json:"closeoutAsk"`
}

// OandaCandle represents an OHLCV candle from OANDA.
type OandaCandle struct {
	Time   time.Time `json:"time"`
	Open   float64   `json:"open"`
	High   float64   `json:"high"`
	Low    float64   `json:"low"`
	Close  float64   `json:"close"`
	Volume int       `json:"volume"`
}

// OandaInstrument represents an instrument from OANDA.
type OandaInstrument struct {
	Name                string  `json:"name"`
	Type                string  `json:"type"`
	DisplayName         string  `json:"displayName"`
	PipLocation         int     `json:"pipLocation"`
	DisplayPrecision    int     `json:"displayPrecision"`
	TradeUnitsPrecision int     `json:"tradeUnitsPrecision"`
	MinimumTradeSize    string  `json:"minimumTradeSize"`
	MaximumTrailingStop string  `json:"maximumTrailingStopDistance"`
	MinimumTrailingStop string  `json:"minimumTrailingStopDistance"`
	MarginRate          string  `json:"marginRate"`
	Financing           *OandaFinancing `json:"financing,omitempty"`
}

// OandaFinancing contains swap/financing rate info.
type OandaFinancing struct {
	LongRate  float64 `json:"longRate"`
	ShortRate float64 `json:"shortRate"`
}

// NewOandaClient creates a new OANDA v20 API client.
// baseURL: "https://api-fxpractice.oanda.com" (demo) or "https://api-fxtrade.oanda.com" (live)
// apiKey: OANDA API token from account settings
// accountID: OANDA account ID (e.g., "101-001-12345678-001")
func NewOandaClient(baseURL, apiKey, accountID string) *OandaClient {
	ctx, cancel := context.WithCancel(context.Background())
	c := &OandaClient{
		baseURL:   baseURL,
		apiKey:    apiKey,
		accountID: accountID,
		prices:    make(map[string]OandaPrice),
		ctx:       ctx,
		cancel:    cancel,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name:        "oanda-api",
		MaxRequests: 3,
		Interval:    30 * time.Second,
		Timeout:     15 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[OANDA] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *OandaClient) connect() {
	if c.apiKey == "" || c.apiKey == "demo" {
		log.Printf("[OANDA] No API key configured — running in fallback mode (demo data)")
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	log.Printf("[OANDA] Connecting to %s (account: %s)...", c.baseURL, c.accountID)

	// Test connectivity by fetching account summary
	req, err := http.NewRequestWithContext(c.ctx, "GET", fmt.Sprintf("%s/v3/accounts/%s/summary", c.baseURL, c.accountID), nil)
	if err != nil {
		log.Printf("[OANDA] WARN: Request creation failed: %v — running in fallback mode", err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[OANDA] WARN: Cannot reach %s: %v — running in fallback mode", c.baseURL, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[OANDA] WARN: API returned %d: %s — running in fallback mode", resp.StatusCode, string(body))
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[OANDA] Connected to %s (account: %s)", c.baseURL, c.accountID)
}

func (c *OandaClient) reconnectLoop() {
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
				log.Printf("[OANDA] Attempting reconnection...")
				c.connect()
			}
		}
	}
}

// GetPrices fetches live bid/ask prices for the given instruments.
// instruments: comma-separated list like "EUR_USD,GBP_USD,USD_JPY"
func (c *OandaClient) GetPrices(instruments string) ([]OandaPrice, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if isFallback {
		return c.getCachedPrices(instruments), nil
	}

	data, err := c.cb.Execute(func() ([]byte, error) {
		url := fmt.Sprintf("%s/v3/accounts/%s/pricing?instruments=%s", c.baseURL, c.accountID, instruments)
		req, reqErr := http.NewRequestWithContext(c.ctx, "GET", url, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, respErr := c.httpClient.Do(req)
		if respErr != nil {
			c.mu.Lock()
			c.requestsFail++
			c.mu.Unlock()
			return nil, respErr
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			c.mu.Lock()
			c.requestsFail++
			c.mu.Unlock()
			return nil, fmt.Errorf("OANDA API error %d: %s", resp.StatusCode, string(body))
		}
		c.mu.Lock()
		c.requestsOK++
		c.mu.Unlock()
		return body, nil
	})

	if err != nil {
		log.Printf("[OANDA] WARN: GetPrices failed: %v — using cached data", err)
		return c.getCachedPrices(instruments), nil
	}

	// Parse OANDA pricing response
	var resp struct {
		Prices []struct {
			Instrument string `json:"instrument"`
			Tradeable  bool   `json:"tradeable"`
			Time       string `json:"time"`
			Bids       []struct {
				Price     string `json:"price"`
				Liquidity int    `json:"liquidity"`
			} `json:"bids"`
			Asks []struct {
				Price     string `json:"price"`
				Liquidity int    `json:"liquidity"`
			} `json:"asks"`
			CloseoutBid string `json:"closeoutBid"`
			CloseoutAsk string `json:"closeoutAsk"`
		} `json:"prices"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return c.getCachedPrices(instruments), nil
	}

	var prices []OandaPrice
	for _, p := range resp.Prices {
		bid := parseFloat(p.Bids[0].Price)
		ask := parseFloat(p.Asks[0].Price)
		t, _ := time.Parse(time.RFC3339Nano, p.Time)
		price := OandaPrice{
			Instrument:  p.Instrument,
			Bid:         bid,
			Ask:         ask,
			Spread:      ask - bid,
			Time:        t,
			Tradeable:   p.Tradeable,
			CloseoutBid: parseFloat(p.CloseoutBid),
			CloseoutAsk: parseFloat(p.CloseoutAsk),
		}
		prices = append(prices, price)

		// Cache the price
		c.mu.Lock()
		c.prices[p.Instrument] = price
		c.mu.Unlock()
	}

	return prices, nil
}

// GetCandles fetches historical OHLCV candles for an instrument.
// granularity: "S5","S10","S15","S30","M1","M2","M4","M5","M10","M15","M30","H1","H2","H3","H4","H6","H8","H12","D","W","M"
func (c *OandaClient) GetCandles(instrument, granularity string, count int) ([]OandaCandle, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if isFallback {
		return nil, fmt.Errorf("OANDA not connected — no candle data available")
	}

	data, err := c.cb.Execute(func() ([]byte, error) {
		url := fmt.Sprintf("%s/v3/instruments/%s/candles?granularity=%s&count=%d&price=M",
			c.baseURL, instrument, granularity, count)
		req, reqErr := http.NewRequestWithContext(c.ctx, "GET", url, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, respErr := c.httpClient.Do(req)
		if respErr != nil {
			return nil, respErr
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("OANDA candles API error %d: %s", resp.StatusCode, string(body))
		}
		return body, nil
	})

	if err != nil {
		return nil, err
	}

	var resp struct {
		Candles []struct {
			Time   string `json:"time"`
			Volume int    `json:"volume"`
			Mid    struct {
				O string `json:"o"`
				H string `json:"h"`
				L string `json:"l"`
				C string `json:"c"`
			} `json:"mid"`
		} `json:"candles"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}

	var candles []OandaCandle
	for _, raw := range resp.Candles {
		t, _ := time.Parse(time.RFC3339Nano, raw.Time)
		candles = append(candles, OandaCandle{
			Time:   t,
			Open:   parseFloat(raw.Mid.O),
			High:   parseFloat(raw.Mid.H),
			Low:    parseFloat(raw.Mid.L),
			Close:  parseFloat(raw.Mid.C),
			Volume: raw.Volume,
		})
	}
	return candles, nil
}

// GetInstruments fetches available tradeable instruments from OANDA.
func (c *OandaClient) GetInstruments() ([]OandaInstrument, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if isFallback {
		return nil, fmt.Errorf("OANDA not connected — no instrument data available")
	}

	data, err := c.cb.Execute(func() ([]byte, error) {
		url := fmt.Sprintf("%s/v3/accounts/%s/instruments?type=CURRENCY", c.baseURL, c.accountID)
		req, reqErr := http.NewRequestWithContext(c.ctx, "GET", url, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, respErr := c.httpClient.Do(req)
		if respErr != nil {
			return nil, respErr
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("OANDA instruments API error %d: %s", resp.StatusCode, string(body))
		}
		return body, nil
	})

	if err != nil {
		return nil, err
	}

	var resp struct {
		Instruments []OandaInstrument `json:"instruments"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Instruments, nil
}

func (c *OandaClient) getCachedPrices(instruments string) []OandaPrice {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var result []OandaPrice
	for _, p := range c.prices {
		result = append(result, p)
	}
	return result
}

// IsConnected returns true if OANDA API is reachable.
func (c *OandaClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// IsFallback returns true if running in fallback (demo data) mode.
func (c *OandaClient) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

// GetMetrics returns request success/failure counts.
func (c *OandaClient) GetMetrics() (ok, fail int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.requestsOK, c.requestsFail
}

// Close shuts down the OANDA client.
func (c *OandaClient) Close() {
	c.cancel()
	log.Println("[OANDA] Client closed")
}
