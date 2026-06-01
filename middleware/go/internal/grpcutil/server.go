// Package grpcutil provides gRPC server and client utilities for inter-service
// communication with retries, circuit breakers, TLS, and interceptors.
package grpcutil

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"
)

// ServerConfig holds gRPC server configuration.
type ServerConfig struct {
	Port      int
	CertFile  string
	KeyFile   string
	CAFile    string
	UseMTLS   bool
	MaxRecvMB int
}

// NewServer creates a production-ready gRPC server with health checks,
// reflection, keep-alive, and optional mTLS.
func NewServer(cfg ServerConfig) (*grpc.Server, net.Listener, error) {
	var opts []grpc.ServerOption

	opts = append(opts,
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle:     5 * time.Minute,
			MaxConnectionAge:      30 * time.Minute,
			MaxConnectionAgeGrace: 10 * time.Second,
			Time:                  1 * time.Minute,
			Timeout:               20 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             10 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.ChainUnaryInterceptor(
			loggingUnaryInterceptor,
			recoveryUnaryInterceptor,
		),
		grpc.ChainStreamInterceptor(
			loggingStreamInterceptor,
		),
	)

	maxRecv := cfg.MaxRecvMB
	if maxRecv <= 0 {
		maxRecv = 16
	}
	opts = append(opts, grpc.MaxRecvMsgSize(maxRecv*1024*1024))

	if cfg.UseMTLS && cfg.CertFile != "" && cfg.KeyFile != "" && cfg.CAFile != "" {
		creds, err := loadMTLSServerCredentials(cfg.CertFile, cfg.KeyFile, cfg.CAFile)
		if err != nil {
			return nil, nil, fmt.Errorf("mTLS setup: %w", err)
		}
		opts = append(opts, grpc.Creds(creds))
		slog.Info("gRPC mTLS enabled")
	}

	srv := grpc.NewServer(opts...)

	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(srv, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	reflection.Register(srv)

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.Port))
	if err != nil {
		return nil, nil, fmt.Errorf("listen :%d: %w", cfg.Port, err)
	}

	return srv, lis, nil
}

func loadMTLSServerCredentials(certFile, keyFile, caFile string) (credentials.TransportCredentials, error) {
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
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    pool,
		MinVersion:   tls.VersionTLS13,
	}), nil
}

func loggingUnaryInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	slog.Debug("gRPC unary",
		"method", info.FullMethod,
		"duration", time.Since(start),
		"error", err,
	)
	return resp, err
}

func recoveryUnaryInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (resp any, err error) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("gRPC panic recovered",
				"method", info.FullMethod,
				"panic", r,
			)
			err = fmt.Errorf("internal server error")
		}
	}()
	return handler(ctx, req)
}

func loggingStreamInterceptor(
	srv any,
	ss grpc.ServerStream,
	info *grpc.StreamServerInfo,
	handler grpc.StreamHandler,
) error {
	start := time.Now()
	err := handler(srv, ss)
	slog.Debug("gRPC stream",
		"method", info.FullMethod,
		"duration", time.Since(start),
		"error", err,
	)
	return err
}
