package temporal

import (
	"log"

	"go.temporal.io/sdk/client"
)

// Client is a wrapper around the Temporal client.
type Client struct {
	client.Client
}

// NewClient creates a new Temporal client.
func NewClient(hostPort, namespace string) (*Client, error) {
	// The hostPort and namespace are typically configured via environment variables or config file.
	// For simplicity, we'll use the provided hostPort and namespace.
	c, err := client.Dial(client.Options{
		HostPort:  hostPort,
		Namespace: namespace,
	})
	if err != nil {
		return nil, err
	}
	return &Client{Client: c}, nil
}

// Close closes the Temporal client connection.
func (c *Client) Close() {
	c.Client.Close()
	log.Println("Temporal client closed.")
}
