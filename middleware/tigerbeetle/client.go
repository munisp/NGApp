package tigerbeetle

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a real HTTP client for TigerBeetle's HTTP gateway.
type Client struct {
	baseURL    string
	clusterID  uint64
	httpClient *http.Client
}

// NewClient creates a TigerBeetle client pointing to the HTTP gateway.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = os.Getenv("TIGERBEETLE_HTTP_URL")
		if baseURL == "" {
			baseURL = "http://tigerbeetle-gateway:3000"
		}
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// AccountRequest describes a TigerBeetle create_accounts request.
type AccountRequest struct {
	ID       [16]byte `json:"id"`
	Ledger   uint32   `json:"ledger"`
	Code     uint16   `json:"code"`
	Flags    uint16   `json:"flags"`
	UserData [16]byte `json:"user_data_128"`
}

// TransferRequest describes a TigerBeetle create_transfers request.
type TransferRequest struct {
	ID              [16]byte `json:"id"`
	DebitAccountID  [16]byte `json:"debit_account_id"`
	CreditAccountID [16]byte `json:"credit_account_id"`
	Amount          uint64   `json:"amount"`
	Ledger          uint32   `json:"ledger"`
	Code            uint16   `json:"code"`
	Flags           uint16   `json:"flags"`
	PendingID       [16]byte `json:"pending_id,omitempty"`
	Timeout         uint32   `json:"timeout,omitempty"`
}

// AccountBalance is the result from lookup_accounts.
type AccountBalance struct {
	ID             [16]byte `json:"id"`
	DebitsPosted   uint64   `json:"debits_posted"`
	CreditsPosted  uint64   `json:"credits_posted"`
	DebitsPending  uint64   `json:"debits_pending"`
	CreditsPending uint64   `json:"credits_pending"`
	Ledger         uint32   `json:"ledger"`
	Code           uint16   `json:"code"`
}

// HealthCheck verifies the TigerBeetle gateway is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("tigerbeetle health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("tigerbeetle unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// CreateAccounts creates accounts in TigerBeetle.
func (c *Client) CreateAccounts(ctx context.Context, accounts []AccountRequest) error {
	return c.post(ctx, "/accounts/create", accounts)
}

// CreateTransfers creates transfers in TigerBeetle.
func (c *Client) CreateTransfers(ctx context.Context, transfers []TransferRequest) error {
	return c.post(ctx, "/transfers/create", transfers)
}

// LookupAccounts looks up accounts by their IDs.
func (c *Client) LookupAccounts(ctx context.Context, ids [][16]byte) ([]AccountBalance, error) {
	body, err := json.Marshal(ids)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/accounts/lookup", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lookup accounts: %w", err)
	}
	defer resp.Body.Close()
	var result []AccountBalance
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// ClusterStatus returns cluster node status information.
type ClusterStatus struct {
	ClusterID   uint64        `json:"cluster_id"`
	ReplicaCount int          `json:"replica_count"`
	Nodes       []NodeStatus  `json:"nodes"`
}

type NodeStatus struct {
	Index     int       `json:"index"`
	Status    string    `json:"status"`
	Address   string    `json:"address"`
	LastPing  time.Time `json:"last_ping"`
}

func (c *Client) GetClusterStatus(ctx context.Context) (*ClusterStatus, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/status", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cluster status: %w", err)
	}
	defer resp.Body.Close()
	var status ClusterStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return &status, nil
}

func (c *Client) post(ctx context.Context, path string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("TigerBeetle error: status %d on %s", resp.StatusCode, path)
	}
	return nil
}
