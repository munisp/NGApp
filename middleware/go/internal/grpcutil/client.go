package grpcutil

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

// ClientConfig holds gRPC client connection configuration.
type ClientConfig struct {
	Target    string
	CertFile  string
	KeyFile   string
	CAFile    string
	UseMTLS   bool
	UseTLS    bool
	TimeoutMs int
}

// Dial creates a gRPC client connection with retry, backoff, and keep-alive.
func Dial(ctx context.Context, cfg ClientConfig) (*grpc.ClientConn, error) {
	var opts []grpc.DialOption

	opts = append(opts,
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                30 * time.Second,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.WithConnectParams(grpc.ConnectParams{
			Backoff: backoff.Config{
				BaseDelay:  200 * time.Millisecond,
				Multiplier: 2.0,
				Jitter:     0.2,
				MaxDelay:   10 * time.Second,
			},
			MinConnectTimeout: 5 * time.Second,
		}),
		grpc.WithDefaultServiceConfig(`{
			"methodConfig": [{
				"name": [{"service": ""}],
				"retryPolicy": {
					"maxAttempts": 4,
					"initialBackoff": "0.2s",
					"maxBackoff": "5s",
					"backoffMultiplier": 2,
					"retryableStatusCodes": ["UNAVAILABLE", "DEADLINE_EXCEEDED", "RESOURCE_EXHAUSTED"]
				}
			}],
			"loadBalancingConfig": [{"round_robin": {}}]
		}`),
		grpc.WithChainUnaryInterceptor(
			clientLoggingInterceptor,
		),
	)

	if cfg.UseMTLS && cfg.CertFile != "" && cfg.KeyFile != "" && cfg.CAFile != "" {
		creds, err := loadMTLSClientCredentials(cfg.CertFile, cfg.KeyFile, cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("gRPC mTLS client: %w", err)
		}
		opts = append(opts, grpc.WithTransportCredentials(creds))
	} else if cfg.UseTLS && cfg.CAFile != "" {
		creds, err := loadTLSCredentials(cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("gRPC TLS client: %w", err)
		}
		opts = append(opts, grpc.WithTransportCredentials(creds))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	conn, err := grpc.DialContext(ctx, cfg.Target, opts...)
	if err != nil {
		return nil, fmt.Errorf("gRPC dial %s: %w", cfg.Target, err)
	}
	return conn, nil
}

func loadMTLSClientCredentials(certFile, keyFile, caFile string) (credentials.TransportCredentials, error) {
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, err
	}
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to add CA cert")
	}
	return credentials.NewTLS(&tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      pool,
		MinVersion:   tls.VersionTLS13,
	}), nil
}

func loadTLSCredentials(caFile string) (credentials.TransportCredentials, error) {
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to add CA cert")
	}
	return credentials.NewTLS(&tls.Config{
		RootCAs:    pool,
		MinVersion: tls.VersionTLS13,
	}), nil
}

func clientLoggingInterceptor(
	ctx context.Context,
	method string,
	req, reply any,
	cc *grpc.ClientConn,
	invoker grpc.UnaryInvoker,
	opts ...grpc.CallOption,
) error {
	start := time.Now()
	err := invoker(ctx, method, req, reply, cc, opts...)
	slog.Debug("gRPC client call",
		"method", method,
		"target", cc.Target(),
		"duration", time.Since(start),
		"error", err,
	)
	return err
}
