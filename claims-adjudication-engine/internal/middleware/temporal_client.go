package middleware

import (
	"context"
	"fmt"
	"log"
	"time"
)

type TemporalConfig struct {
	Host      string
	Port      int
	Namespace string
	TaskQueue string
}

type TemporalClient struct {
	config    TemporalConfig
	connected bool
}

func NewTemporalClient(config TemporalConfig) *TemporalClient {
	if config.Host == "" { config.Host = "localhost" }
	if config.Port == 0 { config.Port = 7233 }
	if config.Namespace == "" { config.Namespace = "claims-adjudication" }
	if config.TaskQueue == "" { config.TaskQueue = "claims-queue" }
	return &TemporalClient{config: config}
}

func (c *TemporalClient) Connect() error {
	log.Printf("Connecting to Temporal at %s:%d namespace=%s", c.config.Host, c.config.Port, c.config.Namespace)
	c.connected = true
	return nil
}

func (c *TemporalClient) IsConnected() bool { return c.connected }

func (c *TemporalClient) StartClaimWorkflow(ctx context.Context, claimID string, claimData map[string]interface{}) (string, error) {
	if !c.connected { return "", fmt.Errorf("temporal client not connected") }
	workflowID := fmt.Sprintf("claim-adjudication-%s-%d", claimID, time.Now().Unix())
	log.Printf("Starting claim adjudication workflow: %s for claim %s", workflowID, claimID)
	return workflowID, nil
}

func (c *TemporalClient) StartSLAWorkflow(ctx context.Context, claimID string, slaHours int) (string, error) {
	if !c.connected { return "", fmt.Errorf("temporal client not connected") }
	workflowID := fmt.Sprintf("sla-monitor-%s-%d", claimID, time.Now().Unix())
	log.Printf("Starting SLA monitoring workflow: %s for claim %s (SLA: %dh)", workflowID, claimID, slaHours)
	return workflowID, nil
}

func (c *TemporalClient) GetWorkflowStatus(ctx context.Context, workflowID string) (string, error) {
	if !c.connected { return "", fmt.Errorf("temporal client not connected") }
	return "running", nil
}

func (c *TemporalClient) CancelWorkflow(ctx context.Context, workflowID string) error {
	if !c.connected { return fmt.Errorf("temporal client not connected") }
	log.Printf("Cancelling workflow: %s", workflowID)
	return nil
}

func (c *TemporalClient) Close() {
	c.connected = false
	log.Println("Temporal client closed")
}
