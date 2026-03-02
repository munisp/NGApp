package redis

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"github.com/sony/gobreaker/v2"
)

// Client wraps Redis operations with real go-redis/v9 SDK and in-memory fallback.
// Key patterns:
//
//	cache:market:{symbol}        - Market ticker cache (TTL: 1s)
//	cache:orderbook:{symbol}     - Order book cache (TTL: 500ms)
//	cache:portfolio:{userId}     - Portfolio cache (TTL: 5s)
//	session:{sessionId}          - User session data (TTL: 24h)
//	rate:{userId}:{endpoint}     - Rate limiting counters
type Client struct {
	url          string
	password     string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	store        map[string]cacheEntry // in-memory fallback
	rdb          *goredis.Client       // Real go-redis client
	cb           *gobreaker.CircuitBreaker[string]
	ctx          context.Context
	cancel       context.CancelFunc
}

type cacheEntry struct {
	data      []byte
	expiresAt time.Time
}

func NewClient(url string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		url:    url,
		store:  make(map[string]cacheEntry),
		ctx:    ctx,
		cancel: cancel,
	}

	c.cb = gobreaker.NewCircuitBreaker[string](gobreaker.Settings{
		Name:        "redis",
		MaxRequests: 3,
		Interval:    30 * time.Second,
		Timeout:     10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Redis] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *Client) connect() {
	log.Printf("[Redis] Connecting to %s", c.url)

	// Create real go-redis client
	opts := &goredis.Options{
		Addr:         c.url,
		Password:     c.password,
		DB:           0,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
		PoolSize:     20,
		MinIdleConns: 5,
	}
	rdb := goredis.NewClient(opts)

	// Verify connectivity with real PING
	pingCtx, pingCancel := context.WithTimeout(c.ctx, 3*time.Second)
	defer pingCancel()
	_, err := rdb.Ping(pingCtx).Result()
	if err != nil {
		log.Printf("[Redis] WARN: Cannot reach %s: %v — running in fallback mode (in-memory cache)", c.url, err)
		rdb.Close()
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	c.mu.Lock()
	if c.rdb != nil {
		c.rdb.Close()
	}
	c.rdb = rdb
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Redis] Connected to %s (PING verified via go-redis)", c.url)
}

func (c *Client) reconnectLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			isFallback := c.fallbackMode
			c.mu.RUnlock()
			if isFallback {
				log.Printf("[Redis] Attempting reconnection to %s...", c.url)
				c.connect()
			}
		}
	}
}

// Set stores a value with TTL using real Redis SET or in-memory fallback
func (c *Client) Set(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	c.mu.RLock()
	isFallback := c.fallbackMode
	rdb := c.rdb
	c.mu.RUnlock()

	if !isFallback && rdb != nil {
		_, cbErr := c.cb.Execute(func() (string, error) {
			setCtx, setCancel := context.WithTimeout(c.ctx, 2*time.Second)
			defer setCancel()
			return rdb.Set(setCtx, key, data, ttl).Result()
		})
		if cbErr == nil {
			return nil
		}
		log.Printf("[Redis] WARN: SET %s failed: %v — using in-memory fallback", key, cbErr)
	}

	// Fallback: store in memory
	c.mu.Lock()
	c.store[key] = cacheEntry{data: data, expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()
	return nil
}

// Get retrieves a cached value using real Redis GET or in-memory fallback
func (c *Client) Get(key string, dest interface{}) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	rdb := c.rdb
	c.mu.RUnlock()

	if !isFallback && rdb != nil {
		result, cbErr := c.cb.Execute(func() (string, error) {
			getCtx, getCancel := context.WithTimeout(c.ctx, 2*time.Second)
			defer getCancel()
			return rdb.Get(getCtx, key).Result()
		})
		if cbErr == nil {
			return json.Unmarshal([]byte(result), dest)
		}
		if cbErr == goredis.Nil {
			return ErrCacheMiss
		}
		log.Printf("[Redis] WARN: GET %s failed: %v — using in-memory fallback", key, cbErr)
	}

	// Fallback: read from in-memory store
	c.mu.RLock()
	entry, exists := c.store[key]
	c.mu.RUnlock()
	if !exists || time.Now().After(entry.expiresAt) {
		return ErrCacheMiss
	}
	return json.Unmarshal(entry.data, dest)
}

// Delete removes a key using real Redis DEL or in-memory fallback
func (c *Client) Delete(key string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	rdb := c.rdb
	c.mu.RUnlock()

	if !isFallback && rdb != nil {
		delCtx, delCancel := context.WithTimeout(c.ctx, 2*time.Second)
		defer delCancel()
		rdb.Del(delCtx, key)
	}

	c.mu.Lock()
	delete(c.store, key)
	c.mu.Unlock()
	return nil
}

// Increment atomically increments a counter using real Redis INCR or in-memory fallback
func (c *Client) Increment(key string, ttl time.Duration) (int64, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	rdb := c.rdb
	c.mu.RUnlock()

	if !isFallback && rdb != nil {
		incrCtx, incrCancel := context.WithTimeout(c.ctx, 2*time.Second)
		defer incrCancel()

		pipe := rdb.Pipeline()
		incrCmd := pipe.Incr(incrCtx, key)
		pipe.Expire(incrCtx, key, ttl)
		_, err := pipe.Exec(incrCtx)
		if err == nil {
			return incrCmd.Val(), nil
		}
		log.Printf("[Redis] WARN: INCR %s failed: %v — using in-memory fallback", key, err)
	}

	// Fallback: in-memory atomic increment
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

func (c *Client) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

func (c *Client) Close() {
	c.cancel()
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.rdb != nil {
		c.rdb.Close()
	}
	c.connected = false
	log.Println("[Redis] Connection closed")
}

// ErrCacheMiss indicates a cache miss
type CacheMissError struct{}

func (e CacheMissError) Error() string { return "cache miss" }

var ErrCacheMiss = CacheMissError{}
