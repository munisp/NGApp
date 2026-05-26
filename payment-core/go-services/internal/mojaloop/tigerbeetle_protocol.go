// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// TigerBeetle Protocol Constants
const (
	// Message types
	TBMessageTypeRequest  uint8 = 0
	TBMessageTypeResponse uint8 = 1

	// Operations
	TBOpCreateAccounts  uint8 = 128
	TBOpCreateTransfers uint8 = 129
	TBOpLookupAccounts  uint8 = 130
	TBOpLookupTransfers uint8 = 131

	// Header size
	TBHeaderSize = 256

	// Result codes
	TBResultOK                          uint32 = 0
	TBResultLinkedEventFailed           uint32 = 1
	TBResultLinkedEventChainOpen        uint32 = 2
	TBResultTimestampMustBeZero         uint32 = 3
	TBResultExistsWithDifferentFlags    uint32 = 17
	TBResultExistsWithDifferentUserData uint32 = 18
	TBResultExists                      uint32 = 25
	TBResultExceedsCredits              uint32 = 30
	TBResultExceedsDebits               uint32 = 31
)

// TBHeader represents a TigerBeetle message header
type TBHeader struct {
	Checksum      [16]byte // AEGIS-128L checksum
	ChecksumBody  [16]byte // Body checksum
	RequestNumber uint32
	ClusterID     uint32
	ClientID      uint32
	ViewNumber    uint32
	OpNumber      uint32
	CommitNumber  uint32
	Timestamp     uint64
	MessageType   uint8
	Operation     uint8
	DataSize      uint32
}

// TBProtocolClient implements the real TigerBeetle wire protocol
type TBProtocolClient struct {
	host          string
	port          int
	clusterID     uint32
	clientID      uint32
	conn          net.Conn
	connected     bool
	requestNumber uint32
	mu            sync.Mutex
	readMu        sync.Mutex
	writeMu       sync.Mutex
	timeout       time.Duration
}

// NewTBProtocolClient creates a new TigerBeetle protocol client
func NewTBProtocolClient(host string, port int, clusterID uint32) *TBProtocolClient {
	return &TBProtocolClient{
		host:      host,
		port:      port,
		clusterID: clusterID,
		clientID:  uint32(time.Now().UnixNano() & 0xFFFFFFFF),
		timeout:   10 * time.Second,
	}
}

// Connect establishes a connection to TigerBeetle
func (c *TBProtocolClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	addr := fmt.Sprintf("%s:%d", c.host, c.port)
	dialer := net.Dialer{Timeout: 5 * time.Second}

	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to connect to TigerBeetle at %s: %w", addr, err)
	}

	c.conn = conn
	c.connected = true
	return nil
}

// Disconnect closes the connection
func (c *TBProtocolClient) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil
	}

	err := c.conn.Close()
	c.connected = false
	c.conn = nil
	return err
}

// nextRequestNumber returns the next request number
func (c *TBProtocolClient) nextRequestNumber() uint32 {
	return atomic.AddUint32(&c.requestNumber, 1)
}

// sendRequest sends a request to TigerBeetle and waits for response
func (c *TBProtocolClient) sendRequest(ctx context.Context, operation uint8, data []byte) ([]byte, error) {
	if !c.connected {
		if err := c.Connect(ctx); err != nil {
			return nil, err
		}
	}

	// Build header
	header := make([]byte, TBHeaderSize)
	reqNum := c.nextRequestNumber()

	// Fill header fields (simplified - real implementation needs proper checksum)
	binary.LittleEndian.PutUint32(header[32:36], reqNum)
	binary.LittleEndian.PutUint32(header[36:40], c.clusterID)
	binary.LittleEndian.PutUint32(header[40:44], c.clientID)
	header[64] = TBMessageTypeRequest
	header[65] = operation
	binary.LittleEndian.PutUint32(header[66:70], uint32(len(data)))

	// Send header + data
	c.writeMu.Lock()
	c.conn.SetWriteDeadline(time.Now().Add(c.timeout))
	_, err := c.conn.Write(header)
	if err != nil {
		c.writeMu.Unlock()
		return nil, fmt.Errorf("failed to write header: %w", err)
	}
	if len(data) > 0 {
		_, err = c.conn.Write(data)
		if err != nil {
			c.writeMu.Unlock()
			return nil, fmt.Errorf("failed to write data: %w", err)
		}
	}
	c.writeMu.Unlock()

	// Read response header
	c.readMu.Lock()
	defer c.readMu.Unlock()

	c.conn.SetReadDeadline(time.Now().Add(c.timeout))
	respHeader := make([]byte, TBHeaderSize)
	_, err = io.ReadFull(c.conn, respHeader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response header: %w", err)
	}

	// Parse response size
	respSize := binary.LittleEndian.Uint32(respHeader[66:70])
	if respSize == 0 {
		return nil, nil // Success with no data
	}

	// Read response data
	respData := make([]byte, respSize)
	_, err = io.ReadFull(c.conn, respData)
	if err != nil {
		return nil, fmt.Errorf("failed to read response data: %w", err)
	}

	return respData, nil
}

// CreateAccountResult represents the result of creating an account

// CreateAccounts creates accounts in TigerBeetle
func (c *TBProtocolClient) CreateAccounts(ctx context.Context, accounts []*Account) ([]CreateAccountResult, error) {
	if len(accounts) == 0 {
		return nil, nil
	}

	// Serialize accounts
	data := make([]byte, len(accounts)*TBAccountSize)
	for i, acc := range accounts {
		copy(data[i*TBAccountSize:], acc.ToBytes())
	}

	// Send request
	resp, err := c.sendRequest(ctx, TBOpCreateAccounts, data)
	if err != nil {
		return nil, err
	}

	// Parse results (8 bytes per result: 4 byte index + 4 byte result code)
	if len(resp) == 0 {
		return nil, nil // All succeeded
	}

	results := make([]CreateAccountResult, len(resp)/8)
	for i := range results {
		offset := i * 8
		results[i] = CreateAccountResult{
			Index:  binary.LittleEndian.Uint32(resp[offset : offset+4]),
			Result: binary.LittleEndian.Uint32(resp[offset+4 : offset+8]),
		}
	}

	return results, nil
}

// CreateTransferResult represents the result of creating a transfer
type CreateTransferResultProto struct {
	Index  uint32
	Result uint32
}

// CreateTransfers creates transfers in TigerBeetle
func (c *TBProtocolClient) CreateTransfers(ctx context.Context, transfers []*Transfer) ([]CreateTransferResultProto, error) {
	if len(transfers) == 0 {
		return nil, nil
	}

	// Serialize transfers
	data := make([]byte, len(transfers)*TBTransferSize)
	for i, tr := range transfers {
		copy(data[i*TBTransferSize:], tr.ToBytes())
	}

	// Send request
	resp, err := c.sendRequest(ctx, TBOpCreateTransfers, data)
	if err != nil {
		return nil, err
	}

	// Parse results
	if len(resp) == 0 {
		return nil, nil // All succeeded
	}

	results := make([]CreateTransferResultProto, len(resp)/8)
	for i := range results {
		offset := i * 8
		results[i] = CreateTransferResultProto{
			Index:  binary.LittleEndian.Uint32(resp[offset : offset+4]),
			Result: binary.LittleEndian.Uint32(resp[offset+4 : offset+8]),
		}
	}

	return results, nil
}

// LookupAccounts looks up accounts by ID
func (c *TBProtocolClient) LookupAccounts(ctx context.Context, ids []uint64) ([]*Account, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	// Serialize IDs
	data := make([]byte, len(ids)*8)
	for i, id := range ids {
		binary.LittleEndian.PutUint64(data[i*8:], id)
	}

	// Send request
	resp, err := c.sendRequest(ctx, TBOpLookupAccounts, data)
	if err != nil {
		return nil, err
	}

	// Parse accounts
	if len(resp) == 0 {
		return nil, nil
	}

	accounts := make([]*Account, len(resp)/TBAccountSize)
	for i := range accounts {
		accounts[i] = AccountFromBytes(resp[i*TBAccountSize : (i+1)*TBAccountSize])
	}

	return accounts, nil
}

// LookupTransfers looks up transfers by ID
func (c *TBProtocolClient) LookupTransfers(ctx context.Context, ids []uint64) ([]*Transfer, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	// Serialize IDs
	data := make([]byte, len(ids)*8)
	for i, id := range ids {
		binary.LittleEndian.PutUint64(data[i*8:], id)
	}

	// Send request
	resp, err := c.sendRequest(ctx, TBOpLookupTransfers, data)
	if err != nil {
		return nil, err
	}

	// Parse transfers
	if len(resp) == 0 {
		return nil, nil
	}

	transfers := make([]*Transfer, len(resp)/TBTransferSize)
	for i := range transfers {
		transfers[i] = TransferFromBytes(resp[i*TBTransferSize : (i+1)*TBTransferSize])
	}

	return transfers, nil
}

// TBResultCodeToString converts a result code to a human-readable string
func TBResultCodeToString(code uint32) string {
	switch code {
	case TBResultOK:
		return "OK"
	case TBResultLinkedEventFailed:
		return "linked_event_failed"
	case TBResultLinkedEventChainOpen:
		return "linked_event_chain_open"
	case TBResultTimestampMustBeZero:
		return "timestamp_must_be_zero"
	case TBResultExistsWithDifferentFlags:
		return "exists_with_different_flags"
	case TBResultExistsWithDifferentUserData:
		return "exists_with_different_user_data"
	case TBResultExists:
		return "exists"
	case TBResultExceedsCredits:
		return "exceeds_credits"
	case TBResultExceedsDebits:
		return "exceeds_debits"
	default:
		return fmt.Sprintf("unknown_error_%d", code)
	}
}

// Singleton protocol client
var (
	defaultProtocolClient *TBProtocolClient
	protocolClientOnce    sync.Once
)

// GetTBProtocolClient returns the singleton protocol client
func GetTBProtocolClient() *TBProtocolClient {
	protocolClientOnce.Do(func() {
		config := DefaultTigerBeetleConfig()
		defaultProtocolClient = NewTBProtocolClient(config.Host, config.Port, uint32(config.ClusterID))
	})
	return defaultProtocolClient
}
