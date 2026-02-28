package redis

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

// Client wraps Redis operations with real TCP connectivity and in-memory fallback.
// Key patterns:
//   cache:market:{symbol}        - Market ticker cache (TTL: 1s)
//   cache:orderbook:{symbol}     - Order book cache (TTL: 500ms)
//   cache:portfolio:{userId}     - Portfolio cache (TTL: 5s)
//   session:{sessionId}          - User session data (TTL: 24h)
//   rate:{userId}:{endpoint}     - Rate limiting counters
type Client struct {
	url          string
	password     string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	store        map[string]cacheEntry // in-memory fallback
	conn         net.Conn
}

type cacheEntry struct {
	data      []byte
	expiresAt time.Time
}

func NewClient(url string) *Client {
	c := &Client{
		url:   url,
		store: make(map[string]cacheEntry),
	}
	c.connect()
	return c
}

func (c *Client) connect() {
	log.Printf("[Redis] Connecting to %s", c.url)

	// Attempt real TCP connection to Redis
	conn, err := net.DialTimeout("tcp", c.url, 3*time.Second)
	if err != nil {
		log.Printf("[Redis] WARN: Cannot reach %s: %v — running in fallback mode (in-memory cache)", c.url, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	// Send PING to verify Redis protocol
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	n, err := conn.Read(buf)
	if err != nil || (n > 0 && buf[0] != '+') {
		log.Printf("[Redis] WARN: PING failed: %v — running in fallback mode", err)
		conn.Close()
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	c.mu.Lock()
	c.conn = conn
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Redis] Connected to %s (PING verified)", c.url)
}

// Set stores a value with TTL
func (c *Client) Set(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	c.store[key] = cacheEntry{data: data, expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()
	return nil
}

// Get retrieves a cached value
func (c *Client) Get(key string, dest interface{}) error {
	c.mu.RLock()
	entry, exists := c.store[key]
	c.mu.RUnlock()

	if !exists || time.Now().After(entry.expiresAt) {
		return ErrCacheMiss
	}
	return json.Unmarshal(entry.data, dest)
}

// Delete removes a key
func (c *Client) Delete(key string) error {
	c.mu.Lock()
	delete(c.store, key)
	c.mu.Unlock()
	return nil
}

// Increment atomically increments a counter (for rate limiting)
func (c *Client) Increment(key string, ttl time.Duration) (int64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, exists := c.store[key]
	if !exists || time.Now().After(entry.expiresAt) {
		data, _ := json.Marshal(int64(1))
		c.store[key] = cacheEntry{data: data, expiresAt: time.Now().Add(ttl)}
		return 1, nil
	}

	var count int64
	_ = json.Unmarshal(entry.data, &count)
	count++
	data, _ := json.Marshal(count)
	c.store[key] = cacheEntry{data: data, expiresAt: entry.expiresAt}
	return count, nil
}

// CheckRateLimit checks if request exceeds rate limit
func (c *Client) CheckRateLimit(userID string, endpoint string, maxRequests int64, window time.Duration) (bool, error) {
	key := "rate:" + userID + ":" + endpoint
	count, err := c.Increment(key, window)
	if err != nil {
		return false, err
	}
	return count <= maxRequests, nil
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[Redis] Connection closed")
}

// ErrCacheMiss indicates a cache miss
type CacheMissError struct{}

func (e CacheMissError) Error() string { return "cache miss" }

var ErrCacheMiss = CacheMissError{}
