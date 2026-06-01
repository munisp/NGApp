package resilience

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"net/http"
	"time"
)

// RetryConfig controls exponential-backoff retry behaviour.
type RetryConfig struct {
	MaxRetries  int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
	Jitter      bool
	RetryableFn func(err error) bool
}

// DefaultRetryConfig returns production-ready retry defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:  3,
		BaseDelay:   200 * time.Millisecond,
		MaxDelay:    5 * time.Second,
		Jitter:      true,
		RetryableFn: DefaultRetryable,
	}
}

// WithRetry wraps fn with exponential-backoff retry logic.
func WithRetry(ctx context.Context, cfg RetryConfig, fn func(ctx context.Context) error) error {
	var lastErr error
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		lastErr = fn(ctx)
		if lastErr == nil {
			return nil
		}
		if attempt == cfg.MaxRetries {
			break
		}
		if cfg.RetryableFn != nil && !cfg.RetryableFn(lastErr) {
			return lastErr
		}

		delay := computeDelay(attempt, cfg)
		slog.Debug("retrying after error",
			"attempt", attempt+1,
			"maxRetries", cfg.MaxRetries,
			"delay", delay,
			"error", lastErr,
		)

		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled during retry: %w", ctx.Err())
		case <-time.After(delay):
		}
	}
	return fmt.Errorf("all %d retries exhausted: %w", cfg.MaxRetries, lastErr)
}

func computeDelay(attempt int, cfg RetryConfig) time.Duration {
	exp := float64(cfg.BaseDelay) * math.Pow(2, float64(attempt))
	if exp > float64(cfg.MaxDelay) {
		exp = float64(cfg.MaxDelay)
	}
	if cfg.Jitter {
		exp = exp * (0.5 + rand.Float64()*0.5)
	}
	return time.Duration(exp)
}

// DefaultRetryable returns true for transient errors.
func DefaultRetryable(err error) bool {
	if err == nil {
		return false
	}
	// Always retry circuit open (wait for half-open)
	if err == ErrCircuitOpen {
		return true
	}
	return true
}

// IsRetryableHTTPStatus returns true for HTTP status codes that are safe to retry.
func IsRetryableHTTPStatus(status int) bool {
	switch status {
	case http.StatusRequestTimeout,
		http.StatusTooManyRequests,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		return true
	default:
		return false
	}
}
