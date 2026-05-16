package openimis

import (
	"context"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/sony/gobreaker"
	"go.uber.org/zap"

	"openimis-policy-integration/configs"
	"openimis-policy-integration/internal/metrics"
)

const (
	premiumCalcEndpoint = "/api/v1/actuarial/calculate_premium"
)

// Client defines the interface for the OpenIMIS actuarial service client.
type Client interface {
	CalculatePremium(ctx context.Context, req PremiumCalculationRequest) (*PremiumCalculationResponse, error)
}

type client struct {
	restyClient *resty.Client
	cb          *gobreaker.CircuitBreaker
	logger      *zap.Logger
}

// NewClient creates a new OpenIMIS API client.
func NewClient(cfg configs.OpenIMISConfig, logger *zap.Logger) Client {
	restyClient := resty.New().
		SetBaseURL(cfg.BaseURL).
		SetTimeout(time.Duration(cfg.Timeout) * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(1 * time.Second).
		SetRetryMaxWaitTime(5 * time.Second).
		AddRetryCondition(func(r *resty.Response, err error) bool {
			return r.IsError() || err != nil
		})

	st := gobreaker.Settings{
		Name:        "OpenIMIS-Premium-Calculator",
		MaxRequests: 1,
		Timeout:     5 * time.Second, // After 5s, the breaker moves to half-open
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			metrics.CircuitBreakerState.WithLabelValues(name).Set(metrics.StateMapping(to.String()))
			logger.Warn("Circuit Breaker State Change",
				zap.String("name", name),
				zap.String("from", from.String()),
				zap.String("to", to.String()),
			)
		},
	}
	cb := gobreaker.NewCircuitBreaker(st)

	return &client{
		restyClient: restyClient,
		cb:          cb,
		logger:      logger,
	}
}

// CalculatePremium calls the OpenIMIS premium calculator API.
func (c *client) CalculatePremium(ctx context.Context, req PremiumCalculationRequest) (*PremiumCalculationResponse, error) {
	start := time.Now()
	status := "failure"
	defer func() {
		metrics.PremiumCalculationDuration.WithLabelValues(status).Observe(time.Since(start).Seconds())
	}()

	result, err := c.cb.Execute(func() (interface{}, error) {
		resp := PremiumCalculationResponse{}
		httpResp, httpErr := c.restyClient.R().
			SetContext(ctx).
			SetBody(req).
			SetResult(&resp).
			Post(premiumCalcEndpoint)

		if httpErr != nil {
			c.logger.Error("HTTP request failed", zap.Error(httpErr))
			return nil, httpErr
		}

		if httpResp.IsError() {
			errMsg := fmt.Sprintf("OpenIMIS API returned error status: %s, body: %s", httpResp.Status(), httpResp.String())
			c.logger.Error("OpenIMIS API error", zap.String("status", httpResp.Status()), zap.String("body", httpResp.String()))
			return nil, fmt.Errorf(errMsg)
		}

		// Check for application-level error in the response body
		if resp.ValidationStatus == "ERROR" {
			errMsg := fmt.Sprintf("OpenIMIS application error: %s", resp.ErrorDetails)
			c.logger.Error("OpenIMIS application error", zap.String("details", resp.ErrorDetails))
			return nil, fmt.Errorf(errMsg)
		}

		return &resp, nil
	})

	if err != nil {
		if err == gobreaker.ErrOpenState {
			c.logger.Error("Circuit breaker is open", zap.Error(err))
			return nil, fmt.Errorf("service unavailable: circuit breaker is open")
		}
		return nil, err
	}

	status = "success"
	return result.(*PremiumCalculationResponse), nil
}
