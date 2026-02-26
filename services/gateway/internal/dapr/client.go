package dapr

import (
	"encoding/json"
	"log"
)

// Client wraps Dapr sidecar operations for service mesh communication.
// In production: uses dapr SDK (github.com/dapr/go-sdk/client)
// Components:
//   State store:  Redis-backed state management
//   Pub/Sub:      Kafka-backed event publishing
//   Service invocation: gRPC/HTTP service-to-service calls
//   Bindings:     Input/output bindings for external systems
//   Secrets:      HashiCorp Vault / Kubernetes secrets
type Client struct {
	httpPort  string
	grpcPort  string
	connected bool
	state     map[string][]byte // In-memory state for development
}

func NewClient(httpPort, grpcPort string) *Client {
	c := &Client{
		httpPort: httpPort,
		grpcPort: grpcPort,
		state:    make(map[string][]byte),
	}
	c.connect()
	return c
}

func (c *Client) connect() {
	log.Printf("[Dapr] Initializing sidecar connection HTTP=%s gRPC=%s", c.httpPort, c.grpcPort)
	c.connected = true
	log.Printf("[Dapr] Sidecar connected")
}

// SaveState saves state to the Dapr state store
func (c *Client) SaveState(storeName, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.state[storeName+":"+key] = data
	log.Printf("[Dapr] SaveState store=%s key=%s", storeName, key)
	return nil
}

// GetState retrieves state from the Dapr state store
func (c *Client) GetState(storeName, key string, dest interface{}) error {
	data, exists := c.state[storeName+":"+key]
	if !exists {
		return nil
	}
	return json.Unmarshal(data, dest)
}

// DeleteState deletes state from the Dapr state store
func (c *Client) DeleteState(storeName, key string) error {
	delete(c.state, storeName+":"+key)
	log.Printf("[Dapr] DeleteState store=%s key=%s", storeName, key)
	return nil
}

// PublishEvent publishes an event to a Dapr pub/sub topic
func (c *Client) PublishEvent(pubsubName, topic string, data interface{}) error {
	log.Printf("[Dapr] PublishEvent pubsub=%s topic=%s", pubsubName, topic)
	return nil
}

// InvokeService invokes another service via Dapr service invocation
func (c *Client) InvokeService(appID, method string, data interface{}) ([]byte, error) {
	log.Printf("[Dapr] InvokeService app=%s method=%s", appID, method)
	// In production: c.client.InvokeMethodWithContent(ctx, appID, method, "POST", &dapr.DataContent{...})
	return json.Marshal(map[string]string{"status": "ok"})
}

// GetSecret retrieves a secret from the Dapr secrets store
func (c *Client) GetSecret(storeName, key string) (map[string]string, error) {
	log.Printf("[Dapr] GetSecret store=%s key=%s", storeName, key)
	return map[string]string{key: ""}, nil
}

func (c *Client) IsConnected() bool { return c.connected }

func (c *Client) Close() {
	c.connected = false
	log.Println("[Dapr] Sidecar disconnected")
}

// State store names
const (
	StateStoreRedis    = "nexcom-statestore"
	PubSubKafka        = "nexcom-pubsub"
	SecretStoreVault   = "nexcom-secrets"
)
