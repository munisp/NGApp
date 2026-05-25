package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a Kafka REST Proxy and Schema Registry client.
type Client struct {
	restURL           string
	schemaRegistryURL string
	http              *http.Client
}

// NewClient creates a Kafka client from environment.
func NewClient() *Client {
	return &Client{
		restURL:           envOr("KAFKA_REST_URL", "http://kafka-rest:8082"),
		schemaRegistryURL: envOr("SCHEMA_REGISTRY_URL", "http://schema-registry:8081"),
		http:              &http.Client{Timeout: 10 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies Kafka REST proxy is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.restURL+"/brokers", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("kafka health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("kafka unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// BrokerInfo represents Kafka broker metadata.
type BrokerInfo struct {
	Brokers []int `json:"brokers"`
}

// GetBrokers returns active broker IDs.
func (c *Client) GetBrokers(ctx context.Context) (*BrokerInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.restURL+"/brokers", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info BrokerInfo
	json.NewDecoder(resp.Body).Decode(&info)
	return &info, nil
}

// TopicInfo represents a Kafka topic.
type TopicInfo struct {
	Name       string            `json:"name"`
	Partitions int               `json:"partitions"`
	Replicas   int               `json:"replication_factor"`
	Config     map[string]string `json:"configs"`
}

// ListTopics returns all Kafka topics.
func (c *Client) ListTopics(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.restURL+"/topics", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var topics []string
	json.NewDecoder(resp.Body).Decode(&topics)
	return topics, nil
}

// GetTopic returns metadata for a specific topic.
func (c *Client) GetTopic(ctx context.Context, name string) (*TopicInfo, error) {
	url := fmt.Sprintf("%s/topics/%s", c.restURL, name)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info TopicInfo
	json.NewDecoder(resp.Body).Decode(&info)
	return &info, nil
}

// ConsumerGroupInfo represents a consumer group.
type ConsumerGroupInfo struct {
	GroupID     string          `json:"group_id"`
	State       string          `json:"state"`
	Members     int             `json:"members"`
	TotalLag    int64           `json:"total_lag"`
	Partitions  []PartitionLag  `json:"partitions"`
}

type PartitionLag struct {
	Topic     string `json:"topic"`
	Partition int    `json:"partition"`
	Lag       int64  `json:"lag"`
}

// GetConsumerGroups returns consumer group information.
func (c *Client) GetConsumerGroups(ctx context.Context) ([]ConsumerGroupInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.restURL+"/consumer-groups", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var groups []ConsumerGroupInfo
	json.NewDecoder(resp.Body).Decode(&groups)
	return groups, nil
}

// SchemaInfo represents a Schema Registry subject.
type SchemaInfo struct {
	Subject    string `json:"subject"`
	Version    int    `json:"version"`
	ID         int    `json:"id"`
	SchemaType string `json:"schemaType"`
	Schema     string `json:"schema"`
}

// ListSchemaSubjects returns all Schema Registry subjects.
func (c *Client) ListSchemaSubjects(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.schemaRegistryURL+"/subjects", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var subjects []string
	json.NewDecoder(resp.Body).Decode(&subjects)
	return subjects, nil
}

// GetSchemaVersion retrieves a specific schema version.
func (c *Client) GetSchemaVersion(ctx context.Context, subject string, version int) (*SchemaInfo, error) {
	url := fmt.Sprintf("%s/subjects/%s/versions/%d", c.schemaRegistryURL, subject, version)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info SchemaInfo
	json.NewDecoder(resp.Body).Decode(&info)
	return &info, nil
}

// GetCompatibilityLevel returns the compatibility level for a subject.
func (c *Client) GetCompatibilityLevel(ctx context.Context, subject string) (string, error) {
	url := fmt.Sprintf("%s/config/%s", c.schemaRegistryURL, subject)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		CompatibilityLevel string `json:"compatibilityLevel"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.CompatibilityLevel, nil
}
