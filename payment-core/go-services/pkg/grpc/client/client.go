// Package client provides a production-grade gRPC client factory with
// retries, circuit breakers, TLS, and observability baked in.
package client

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	"github.com/payment-switch/go-services/pkg/grpc/interceptors"
)

// Config holds configuration for a gRPC client connection.
type Config struct {
	Target string

	// TLS
	UseTLS    bool
	CACertFile string
	CertFile   string
	KeyFile    string

	// Retry
	MaxRetries   int
	InitialDelay time.Duration
	MaxDelay     time.Duration

	// Circuit breaker
	CBMaxFailures  int32
	CBResetTimeout time.Duration

	// Connection
	MaxRecvMsgSize int
	MaxSendMsgSize int

	// Keepalive
	KeepaliveTime    time.Duration
	KeepaliveTimeout time.Duration
}

// DefaultConfig returns production defaults.
func DefaultConfig(target string) Config {
	return Config{
		Target:           target,
		UseTLS:           false,
		MaxRetries:       3,
		InitialDelay:     100 * time.Millisecond,
		MaxDelay:         5 * time.Second,
		CBMaxFailures:    5,
		CBResetTimeout:   30 * time.Second,
		MaxRecvMsgSize:   10 * 1024 * 1024, // 10MB
		MaxSendMsgSize:   10 * 1024 * 1024, // 10MB
		KeepaliveTime:    30 * time.Second,
		KeepaliveTimeout: 10 * time.Second,
	}
}

// Dial creates a gRPC client connection with retries, circuit breakers,
// logging, and optionally mTLS.
func Dial(cfg Config) (*grpc.ClientConn, error) {
	retryCfg := interceptors.RetryConfig{
		MaxAttempts:  cfg.MaxRetries,
		InitialDelay: cfg.InitialDelay,
		MaxDelay:     cfg.MaxDelay,
		Multiplier:   2.0,
		JitterFrac:   0.2,
		RetryableCodes: interceptors.DefaultRetryConfig().RetryableCodes,
	}

	cbMgr := interceptors.NewCircuitBreakerManager(interceptors.CircuitBreakerConfig{
		MaxFailures:         cfg.CBMaxFailures,
		ResetTimeout:        cfg.CBResetTimeout,
		HalfOpenMaxRequests: 3,
	})

	unaryChain := grpc.WithChainUnaryInterceptor(
		interceptors.UnaryRequestIDInterceptor(),
		interceptors.UnaryLoggingInterceptor(),
		interceptors.UnaryCircuitBreakerInterceptor(cbMgr),
		interceptors.UnaryRetryInterceptor(retryCfg),
	)

	streamChain := grpc.WithChainStreamInterceptor(
		interceptors.StreamCircuitBreakerInterceptor(cbMgr),
		interceptors.StreamRetryInterceptor(retryCfg),
	)

	var transportCreds grpc.DialOption
	if cfg.UseTLS {
		creds, err := loadTLS(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS: %w", err)
		}
		transportCreds = grpc.WithTransportCredentials(creds)
	} else {
		transportCreds = grpc.WithTransportCredentials(insecure.NewCredentials())
	}

	ka := grpc.WithKeepaliveParams(keepalive.ClientParameters{
		Time:                cfg.KeepaliveTime,
		Timeout:             cfg.KeepaliveTimeout,
		PermitWithoutStream: true,
	})

	conn, err := grpc.NewClient(
		cfg.Target,
		transportCreds,
		unaryChain,
		streamChain,
		ka,
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(cfg.MaxRecvMsgSize),
			grpc.MaxCallSendMsgSize(cfg.MaxSendMsgSize),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to dial %s: %w", cfg.Target, err)
	}
	return conn, nil
}

func loadTLS(cfg Config) (credentials.TransportCredentials, error) {
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}

	if cfg.CACertFile != "" {
		caCert, err := os.ReadFile(cfg.CACertFile)
		if err != nil {
			return nil, fmt.Errorf("read CA cert: %w", err)
		}
		pool := x509.NewCertPool()
		pool.AppendCertsFromPEM(caCert)
		tlsCfg.RootCAs = pool
	}

	if cfg.CertFile != "" && cfg.KeyFile != "" {
		cert, err := tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("load client cert: %w", err)
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}

	return credentials.NewTLS(tlsCfg), nil
}
