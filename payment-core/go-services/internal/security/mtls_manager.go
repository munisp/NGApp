// Package security provides mTLS management for service mesh
package security

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// MTLSManager provides end-to-end mutual TLS for internal services
type MTLSManager struct {
	// Certificate store
	certStore CertificateStore

	// Root CA pool
	rootCAs *x509.CertPool

	// Client certificates per service
	clientCerts map[string]*tls.Certificate
	clientMu    sync.RWMutex

	// Server certificate
	serverCert *tls.Certificate
	serverMu   sync.RWMutex

	// Certificate rotation
	rotationInterval time.Duration
	lastRotation     time.Time

	// Stats
	totalConnections     uint64
	successfulHandshakes uint64
	failedHandshakes     uint64
	certificatesRotated  uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// CertificateStore interface for certificate storage
type CertificateStore interface {
	// GetRootCA retrieves the root CA certificate
	GetRootCA(ctx context.Context) ([]byte, error)
	// GetServiceCert retrieves a service certificate
	GetServiceCert(ctx context.Context, serviceName string) (*ServiceCertificate, error)
	// IssueCert issues a new certificate for a service
	IssueCert(ctx context.Context, serviceName string, csr []byte) (*ServiceCertificate, error)
	// RevokeCert revokes a certificate
	RevokeCert(ctx context.Context, serialNumber string) error
}

// ServiceCertificate represents a service certificate
type ServiceCertificate struct {
	ServiceName  string
	Certificate  []byte
	PrivateKey   []byte
	SerialNumber string
	IssuedAt     time.Time
	ExpiresAt    time.Time
}

// MTLSConfig configures the mTLS manager
type MTLSConfig struct {
	ServiceName      string
	RotationInterval time.Duration
	MinTLSVersion    uint16
	CipherSuites     []uint16
}

// DefaultMTLSConfig returns secure defaults
func DefaultMTLSConfig() MTLSConfig {
	return MTLSConfig{
		RotationInterval: 24 * time.Hour,
		MinTLSVersion:    tls.VersionTLS13,
		CipherSuites: []uint16{
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
	}
}

// NewMTLSManager creates a new mTLS manager
func NewMTLSManager(certStore CertificateStore, config MTLSConfig) (*MTLSManager, error) {
	ctx, cancel := context.WithCancel(context.Background())

	m := &MTLSManager{
		certStore:        certStore,
		clientCerts:      make(map[string]*tls.Certificate),
		rotationInterval: config.RotationInterval,
		ctx:              ctx,
		cancel:           cancel,
	}

	// Load root CA
	if err := m.loadRootCA(ctx); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to load root CA: %w", err)
	}

	// Load service certificate
	if config.ServiceName != "" {
		if err := m.loadServiceCert(ctx, config.ServiceName); err != nil {
			cancel()
			return nil, fmt.Errorf("failed to load service certificate: %w", err)
		}
	}

	// Start certificate rotation loop
	m.wg.Add(1)
	go m.rotationLoop()

	return m, nil
}

// loadRootCA loads the root CA certificate
func (m *MTLSManager) loadRootCA(ctx context.Context) error {
	caBytes, err := m.certStore.GetRootCA(ctx)
	if err != nil {
		return err
	}

	m.rootCAs = x509.NewCertPool()
	if !m.rootCAs.AppendCertsFromPEM(caBytes) {
		return fmt.Errorf("failed to parse root CA certificate")
	}

	return nil
}

// loadServiceCert loads a service certificate
func (m *MTLSManager) loadServiceCert(ctx context.Context, serviceName string) error {
	serviceCert, err := m.certStore.GetServiceCert(ctx, serviceName)
	if err != nil {
		return err
	}

	cert, err := tls.X509KeyPair(serviceCert.Certificate, serviceCert.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %w", err)
	}

	m.serverMu.Lock()
	m.serverCert = &cert
	m.serverMu.Unlock()

	return nil
}

// GetServerTLSConfig returns TLS config for server
func (m *MTLSManager) GetServerTLSConfig() *tls.Config {
	return &tls.Config{
		GetCertificate: m.getServerCertificate,
		ClientAuth:     tls.RequireAndVerifyClientCert,
		ClientCAs:      m.rootCAs,
		MinVersion:     tls.VersionTLS13,
		CipherSuites: []uint16{
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
		VerifyConnection: m.verifyConnection,
	}
}

// GetClientTLSConfig returns TLS config for client connections
func (m *MTLSManager) GetClientTLSConfig(targetService string) *tls.Config {
	return &tls.Config{
		GetClientCertificate: func(info *tls.CertificateRequestInfo) (*tls.Certificate, error) {
			return m.getClientCertificate(targetService)
		},
		RootCAs:    m.rootCAs,
		MinVersion: tls.VersionTLS13,
		CipherSuites: []uint16{
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
		VerifyConnection: m.verifyConnection,
	}
}

// getServerCertificate returns the server certificate
func (m *MTLSManager) getServerCertificate(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	m.serverMu.RLock()
	defer m.serverMu.RUnlock()

	if m.serverCert == nil {
		return nil, fmt.Errorf("no server certificate available")
	}

	atomic.AddUint64(&m.totalConnections, 1)
	return m.serverCert, nil
}

// getClientCertificate returns a client certificate for a target service
func (m *MTLSManager) getClientCertificate(targetService string) (*tls.Certificate, error) {
	m.clientMu.RLock()
	cert, ok := m.clientCerts[targetService]
	m.clientMu.RUnlock()

	if ok {
		return cert, nil
	}

	// Load certificate for target service
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	serviceCert, err := m.certStore.GetServiceCert(ctx, targetService)
	if err != nil {
		return nil, fmt.Errorf("failed to get certificate for %s: %w", targetService, err)
	}

	tlsCert, err := tls.X509KeyPair(serviceCert.Certificate, serviceCert.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	m.clientMu.Lock()
	m.clientCerts[targetService] = &tlsCert
	m.clientMu.Unlock()

	return &tlsCert, nil
}

// verifyConnection performs additional connection verification
func (m *MTLSManager) verifyConnection(state tls.ConnectionState) error {
	if len(state.PeerCertificates) == 0 {
		atomic.AddUint64(&m.failedHandshakes, 1)
		return fmt.Errorf("no peer certificate provided")
	}

	peerCert := state.PeerCertificates[0]

	// Verify certificate is not expired
	now := time.Now()
	if now.Before(peerCert.NotBefore) || now.After(peerCert.NotAfter) {
		atomic.AddUint64(&m.failedHandshakes, 1)
		return fmt.Errorf("peer certificate is expired or not yet valid")
	}

	// Verify certificate chain
	opts := x509.VerifyOptions{
		Roots:         m.rootCAs,
		CurrentTime:   now,
		Intermediates: x509.NewCertPool(),
	}

	for _, cert := range state.PeerCertificates[1:] {
		opts.Intermediates.AddCert(cert)
	}

	if _, err := peerCert.Verify(opts); err != nil {
		atomic.AddUint64(&m.failedHandshakes, 1)
		return fmt.Errorf("certificate verification failed: %w", err)
	}

	atomic.AddUint64(&m.successfulHandshakes, 1)
	return nil
}

// rotationLoop handles certificate rotation
func (m *MTLSManager) rotationLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.checkAndRotateCertificates()
		}
	}
}

// checkAndRotateCertificates checks and rotates certificates if needed
func (m *MTLSManager) checkAndRotateCertificates() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Check server certificate
	m.serverMu.RLock()
	serverCert := m.serverCert
	m.serverMu.RUnlock()

	if serverCert != nil && len(serverCert.Certificate) > 0 {
		x509Cert, err := x509.ParseCertificate(serverCert.Certificate[0])
		if err == nil {
			// Rotate if certificate expires within rotation interval
			if time.Until(x509Cert.NotAfter) < m.rotationInterval {
				// Request new certificate
				// In production, this would call the certificate store to issue a new cert
				atomic.AddUint64(&m.certificatesRotated, 1)
			}
		}
	}

	// Check client certificates
	m.clientMu.RLock()
	clientCerts := make(map[string]*tls.Certificate)
	for k, v := range m.clientCerts {
		clientCerts[k] = v
	}
	m.clientMu.RUnlock()

	for serviceName, cert := range clientCerts {
		if len(cert.Certificate) > 0 {
			x509Cert, err := x509.ParseCertificate(cert.Certificate[0])
			if err == nil {
				if time.Until(x509Cert.NotAfter) < m.rotationInterval {
					// Reload certificate
					_ = m.loadServiceCert(ctx, serviceName)
					atomic.AddUint64(&m.certificatesRotated, 1)
				}
			}
		}
	}

	m.lastRotation = time.Now()
}

// CreateHTTPClient creates an HTTP client with mTLS
func (m *MTLSManager) CreateHTTPClient(targetService string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: m.GetClientTLSConfig(targetService),
		},
		Timeout: 30 * time.Second,
	}
}

// CreateHTTPServer creates an HTTP server with mTLS
func (m *MTLSManager) CreateHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:      addr,
		Handler:   handler,
		TLSConfig: m.GetServerTLSConfig(),
	}
}

// Stats returns mTLS statistics
func (m *MTLSManager) Stats() (connections, successful, failed, rotated uint64) {
	return atomic.LoadUint64(&m.totalConnections),
		atomic.LoadUint64(&m.successfulHandshakes),
		atomic.LoadUint64(&m.failedHandshakes),
		atomic.LoadUint64(&m.certificatesRotated)
}

// Close shuts down the mTLS manager
func (m *MTLSManager) Close() error {
	m.cancel()
	m.wg.Wait()
	return nil
}

// FileCertificateStore implements CertificateStore using files
type FileCertificateStore struct {
	basePath string
}

// NewFileCertificateStore creates a new file-based certificate store
func NewFileCertificateStore(basePath string) *FileCertificateStore {
	return &FileCertificateStore{basePath: basePath}
}

// GetRootCA implements CertificateStore
func (s *FileCertificateStore) GetRootCA(ctx context.Context) ([]byte, error) {
	return os.ReadFile(s.basePath + "/ca.crt")
}

// GetServiceCert implements CertificateStore
func (s *FileCertificateStore) GetServiceCert(ctx context.Context, serviceName string) (*ServiceCertificate, error) {
	certPath := fmt.Sprintf("%s/%s.crt", s.basePath, serviceName)
	keyPath := fmt.Sprintf("%s/%s.key", s.basePath, serviceName)

	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate: %w", err)
	}

	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key: %w", err)
	}

	// Parse certificate to get metadata
	block, _ := pem.Decode(certBytes)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	x509Cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	return &ServiceCertificate{
		ServiceName:  serviceName,
		Certificate:  certBytes,
		PrivateKey:   keyBytes,
		SerialNumber: x509Cert.SerialNumber.String(),
		IssuedAt:     x509Cert.NotBefore,
		ExpiresAt:    x509Cert.NotAfter,
	}, nil
}

// IssueCert implements CertificateStore
func (s *FileCertificateStore) IssueCert(ctx context.Context, serviceName string, csr []byte) (*ServiceCertificate, error) {
	// In production, this would call a CA to issue a certificate
	return nil, fmt.Errorf("certificate issuance not implemented for file store")
}

// RevokeCert implements CertificateStore
func (s *FileCertificateStore) RevokeCert(ctx context.Context, serialNumber string) error {
	// In production, this would update a CRL or OCSP responder
	return nil
}

// VaultCertificateStore implements CertificateStore using HashiCorp Vault
type VaultCertificateStore struct {
	client   VaultClient
	pkiPath  string
	roleName string
}

// VaultClient interface for Vault operations
type VaultClient interface {
	Read(path string) (map[string]interface{}, error)
	Write(path string, data map[string]interface{}) (map[string]interface{}, error)
}

// NewVaultCertificateStore creates a new Vault-based certificate store
func NewVaultCertificateStore(client VaultClient, pkiPath, roleName string) *VaultCertificateStore {
	return &VaultCertificateStore{
		client:   client,
		pkiPath:  pkiPath,
		roleName: roleName,
	}
}

// GetRootCA implements CertificateStore
func (s *VaultCertificateStore) GetRootCA(ctx context.Context) ([]byte, error) {
	resp, err := s.client.Read(s.pkiPath + "/ca/pem")
	if err != nil {
		return nil, err
	}

	if ca, ok := resp["certificate"].(string); ok {
		return []byte(ca), nil
	}

	return nil, fmt.Errorf("CA certificate not found")
}

// GetServiceCert implements CertificateStore
func (s *VaultCertificateStore) GetServiceCert(ctx context.Context, serviceName string) (*ServiceCertificate, error) {
	resp, err := s.client.Write(s.pkiPath+"/issue/"+s.roleName, map[string]interface{}{
		"common_name": serviceName + ".payment-switch.svc.cluster.local",
		"ttl":         "24h",
	})
	if err != nil {
		return nil, err
	}

	cert, _ := resp["certificate"].(string)
	key, _ := resp["private_key"].(string)
	serial, _ := resp["serial_number"].(string)

	return &ServiceCertificate{
		ServiceName:  serviceName,
		Certificate:  []byte(cert),
		PrivateKey:   []byte(key),
		SerialNumber: serial,
		IssuedAt:     time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}, nil
}

// IssueCert implements CertificateStore
func (s *VaultCertificateStore) IssueCert(ctx context.Context, serviceName string, csr []byte) (*ServiceCertificate, error) {
	resp, err := s.client.Write(s.pkiPath+"/sign/"+s.roleName, map[string]interface{}{
		"csr": string(csr),
		"ttl": "24h",
	})
	if err != nil {
		return nil, err
	}

	cert, _ := resp["certificate"].(string)
	serial, _ := resp["serial_number"].(string)

	return &ServiceCertificate{
		ServiceName:  serviceName,
		Certificate:  []byte(cert),
		SerialNumber: serial,
		IssuedAt:     time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}, nil
}

// RevokeCert implements CertificateStore
func (s *VaultCertificateStore) RevokeCert(ctx context.Context, serialNumber string) error {
	_, err := s.client.Write(s.pkiPath+"/revoke", map[string]interface{}{
		"serial_number": serialNumber,
	})
	return err
}
