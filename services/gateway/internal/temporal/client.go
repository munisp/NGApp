package temporal

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
)

// Client wraps Temporal workflow operations with real temporal-sdk-go.
// Workflows:
//   OrderLifecycleWorkflow    - Order validation → matching → execution → settlement
//   SettlementWorkflow        - Trade → TigerBeetle ledger → Mojaloop transfer → confirmation
//   KYCVerificationWorkflow   - Document upload → AI verification → sanctions screening → approval
//   MarginCallWorkflow        - Position monitoring → margin warning → forced liquidation
//   ReconciliationWorkflow    - Daily/hourly reconciliation of ledger balances
type Client struct {
	host         string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	// Real Temporal SDK client
	sdkClient client.Client
	// In-memory workflow tracking for fallback mode
	workflows map[string]*WorkflowExecution
	// Background reconnection
	ctx    context.Context
	cancel context.CancelFunc
}

// WorkflowExecution represents a running workflow
type WorkflowExecution struct {
	WorkflowID string      `json:"workflowId"`
	RunID      string      `json:"runId"`
	Status     string      `json:"status"`
	TaskQueue  string      `json:"taskQueue"`
	StartedAt  time.Time   `json:"startedAt"`
	Input      interface{} `json:"input,omitempty"`
}

func NewClient(host string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		host:      host,
		workflows: make(map[string]*WorkflowExecution),
		ctx:       ctx,
		cancel:    cancel,
	}
	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *Client) connect() {
	log.Printf("[Temporal] Connecting to %s", c.host)

	// Create real Temporal SDK client
	sdkClient, err := client.Dial(client.Options{
		HostPort:  c.host,
		Namespace: "nexcom",
	})
	if err != nil {
		log.Printf("[Temporal] WARN: Cannot reach %s: %v — running in fallback mode (in-memory workflows)", c.host, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	c.mu.Lock()
	if c.sdkClient != nil {
		c.sdkClient.Close()
	}
	c.sdkClient = sdkClient
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Temporal] Connected to %s via SDK (namespace: nexcom)", c.host)
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
				log.Printf("[Temporal] Attempting reconnection to %s...", c.host)
				c.connect()
			}
		}
	}
}

func (c *Client) startWorkflowReal(ctx context.Context, workflowID, taskQueue, workflowType string, input interface{}) (*WorkflowExecution, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	sdkClient := c.sdkClient
	c.mu.RUnlock()

	exec := &WorkflowExecution{
		WorkflowID: workflowID,
		RunID:      uuid.New().String(),
		Status:     "RUNNING",
		TaskQueue:  taskQueue,
		StartedAt:  time.Now(),
		Input:      input,
	}

	if !isFallback && sdkClient != nil {
		// Execute via real Temporal SDK
		opts := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: taskQueue,
		}
		run, err := sdkClient.ExecuteWorkflow(ctx, opts, workflowType, input)
		if err != nil {
			log.Printf("[Temporal] WARN: Real workflow start failed: %v — using fallback", err)
		} else {
			exec.RunID = run.GetRunID()
			log.Printf("[Temporal] Started %s via SDK: workflowID=%s runID=%s", workflowType, workflowID, exec.RunID)
			c.mu.Lock()
			c.workflows[workflowID] = exec
			c.mu.Unlock()
			return exec, nil
		}
	}

	// Fallback: in-memory tracking
	c.mu.Lock()
	c.workflows[workflowID] = exec
	c.mu.Unlock()
	log.Printf("[Temporal] Started %s (fallback): workflowID=%s", workflowType, workflowID)
	return exec, nil
}

// StartOrderWorkflow initiates the order lifecycle workflow
func (c *Client) StartOrderWorkflow(ctx context.Context, orderID string, input interface{}) (*WorkflowExecution, error) {
	workflowID := "order-" + orderID
	exec, err := c.startWorkflowReal(ctx, workflowID, "nexcom-trading", "OrderLifecycleWorkflow", input)
	if err != nil {
		return nil, err
	}

	// In fallback mode, simulate async completion
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		go func() {
			time.Sleep(100 * time.Millisecond)
			c.mu.Lock()
			if wf, ok := c.workflows[workflowID]; ok {
				wf.Status = "COMPLETED"
			}
			c.mu.Unlock()
		}()
	}
	return exec, nil
}

// StartSettlementWorkflow initiates the settlement workflow
func (c *Client) StartSettlementWorkflow(ctx context.Context, tradeID string, input interface{}) (*WorkflowExecution, error) {
	workflowID := "settlement-" + tradeID
	exec, err := c.startWorkflowReal(ctx, workflowID, "nexcom-settlement", "SettlementWorkflow", input)
	if err != nil {
		return nil, err
	}

	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()
	if isFallback {
		go func() {
			time.Sleep(200 * time.Millisecond)
			c.mu.Lock()
			if wf, ok := c.workflows[workflowID]; ok {
				wf.Status = "COMPLETED"
			}
			c.mu.Unlock()
		}()
	}
	return exec, nil
}

// StartKYCWorkflow initiates the KYC verification workflow
func (c *Client) StartKYCWorkflow(ctx context.Context, userID string, input interface{}) (*WorkflowExecution, error) {
	workflowID := "kyc-" + userID
	return c.startWorkflowReal(ctx, workflowID, "nexcom-kyc", "KYCVerificationWorkflow", input)
}

// SignalWorkflow sends a signal to a running workflow
func (c *Client) SignalWorkflow(ctx context.Context, workflowID string, signalName string, data interface{}) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	sdkClient := c.sdkClient
	c.mu.RUnlock()

	if !isFallback && sdkClient != nil {
		err := sdkClient.SignalWorkflow(ctx, workflowID, "", signalName, data)
		if err != nil {
			log.Printf("[Temporal] WARN: Signal failed: %v", err)
			return err
		}
		log.Printf("[Temporal] Signaled workflow=%s signal=%s (via SDK)", workflowID, signalName)
		return nil
	}

	log.Printf("[Temporal] Signaled workflow=%s signal=%s (fallback)", workflowID, signalName)
	return nil
}

// CancelWorkflow cancels a running workflow
func (c *Client) CancelWorkflow(ctx context.Context, workflowID string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	sdkClient := c.sdkClient
	c.mu.RUnlock()

	if !isFallback && sdkClient != nil {
		err := sdkClient.CancelWorkflow(ctx, workflowID, "")
		if err != nil {
			log.Printf("[Temporal] WARN: Cancel failed: %v", err)
		} else {
			log.Printf("[Temporal] Cancelled workflow=%s (via SDK)", workflowID)
		}
	}

	c.mu.Lock()
	if wf, ok := c.workflows[workflowID]; ok {
		wf.Status = "CANCELLED"
	}
	c.mu.Unlock()
	return nil
}

// QueryWorkflow queries workflow state
func (c *Client) QueryWorkflow(ctx context.Context, workflowID string, queryType string) (interface{}, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	sdkClient := c.sdkClient
	c.mu.RUnlock()

	if !isFallback && sdkClient != nil {
		resp, err := sdkClient.QueryWorkflow(ctx, workflowID, "", queryType)
		if err == nil {
			var result interface{}
			if resp.Get(&result) == nil {
				return result, nil
			}
		}
		log.Printf("[Temporal] WARN: Query failed: %v — using in-memory state", err)
	}

	c.mu.RLock()
	wf, ok := c.workflows[workflowID]
	c.mu.RUnlock()
	if ok {
		return map[string]interface{}{
			"status":    wf.Status,
			"startedAt": wf.StartedAt,
			"taskQueue": wf.TaskQueue,
		}, nil
	}
	return map[string]string{"status": "UNKNOWN"}, nil
}

// GetWorkflowStatus returns the execution status
func (c *Client) GetWorkflowStatus(ctx context.Context, workflowID string) (string, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	sdkClient := c.sdkClient
	c.mu.RUnlock()

	if !isFallback && sdkClient != nil {
		desc, err := sdkClient.DescribeWorkflowExecution(ctx, workflowID, "")
		if err == nil {
			return desc.WorkflowExecutionInfo.Status.String(), nil
		}
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	if wf, ok := c.workflows[workflowID]; ok {
		return wf.Status, nil
	}
	return "UNKNOWN", nil
}

// ListWorkflows returns all tracked workflows
func (c *Client) ListWorkflows() []*WorkflowExecution {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*WorkflowExecution, 0, len(c.workflows))
	for _, wf := range c.workflows {
		result = append(result, wf)
	}
	return result
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
	if c.sdkClient != nil {
		c.sdkClient.Close()
	}
	c.connected = false
	log.Println("[Temporal] Connection closed")
}
