// Package mtls provides mutual TLS (mTLS) configuration for OG-RMM Go services.
// All inter-service communication uses mTLS to ensure:
//   - Service identity verification (both client and server authenticate)
//   - Encrypted communication (TLS 1.3)
//   - Certificate rotation support via cert-manager or Vault PKI
//
// Certificate hierarchy:
//   og-rmm-ca (root CA)
//   ├── og-rmm-server-*.crt (per-service server certificates)
//   └── og-rmm-client-*.crt (per-service client certificates)
//
// Environment variables:
//   MTLS_CA_CERT_PATH     — path to CA certificate (PEM)
//   MTLS_CERT_PATH        — path to service certificate (PEM)
//   MTLS_KEY_PATH         — path to service private key (PEM)
//   MTLS_ENABLED          — "true" to enable mTLS (default: "false" in dev)
package mtls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
)

// Config holds mTLS configuration paths.
type Config struct {
	CACertPath string
	CertPath   string
	KeyPath    string
	Enabled    bool
}

// DefaultConfig returns mTLS Config from environment variables.
func DefaultConfig() Config {
	return Config{
		CACertPath: envOrDefault("MTLS_CA_CERT_PATH", "/etc/og-rmm/certs/ca.crt"),
		CertPath:   envOrDefault("MTLS_CERT_PATH", "/etc/og-rmm/certs/tls.crt"),
		KeyPath:    envOrDefault("MTLS_KEY_PATH", "/etc/og-rmm/certs/tls.key"),
		Enabled:    os.Getenv("MTLS_ENABLED") == "true",
	}
}

// ServerTLSConfig returns a *tls.Config for an mTLS server.
// The server requires client certificates signed by the OG-RMM CA.
func ServerTLSConfig(cfg Config) (*tls.Config, error) {
	if !cfg.Enabled {
		return nil, nil // mTLS disabled — use plain HTTP
	}

	cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load server cert: %w", err)
	}

	caCert, err := os.ReadFile(cfg.CACertPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: read CA cert: %w", err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("mtls: failed to parse CA certificate")
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientCAs:    caPool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
		CipherSuites: []uint16{
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
	}, nil
}

// ClientTLSConfig returns a *tls.Config for an mTLS client.
// The client presents its certificate to the server for mutual authentication.
func ClientTLSConfig(cfg Config) (*tls.Config, error) {
	if !cfg.Enabled {
		return &tls.Config{InsecureSkipVerify: false}, nil //nolint:gosec
	}

	cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load client cert: %w", err)
	}

	caCert, err := os.ReadFile(cfg.CACertPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: read CA cert: %w", err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("mtls: failed to parse CA certificate")
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

// VerifyCertificate validates that a certificate is signed by the OG-RMM CA
// and has not expired. Use this for custom certificate validation logic.
func VerifyCertificate(certPEM []byte, caCertPath string) error {
	caCert, err := os.ReadFile(caCertPath)
	if err != nil {
		return fmt.Errorf("mtls: read CA cert: %w", err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return fmt.Errorf("mtls: failed to parse CA certificate")
	}

	block := certPEM
	var cert *x509.Certificate
	for len(block) > 0 {
		var rest []byte
		cert, err = x509.ParseCertificate(block)
		if err != nil {
			// Try next block
			block = rest
			continue
		}
		break
	}
	if cert == nil {
		return fmt.Errorf("mtls: no valid certificate found in PEM")
	}

	opts := x509.VerifyOptions{
		Roots: caPool,
	}
	if _, err := cert.Verify(opts); err != nil {
		return fmt.Errorf("mtls: certificate verification failed: %w", err)
	}
	return nil
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
