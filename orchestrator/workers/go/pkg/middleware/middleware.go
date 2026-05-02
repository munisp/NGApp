package middleware

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"

	"github.com/payment-switch/orchestrator/pkg/config"
)

// Middleware holds all middleware connections
type Middleware struct {
	DB          *sql.DB
	Redis       *redis.Client
	Kafka       *KafkaClient
	Dapr        *DaprClient
	Keycloak    *KeycloakClient
	Permify     *PermifyClient
	TigerBeetle *TigerBeetleClient
	Fluvio      *FluvioClient
	Lakehouse   *LakehouseClient
}

// NewMiddleware initializes all middleware connections
func NewMiddleware(cfg *config.Config) (*Middleware, error) {
	mw := &Middleware{}

	// Initialize MySQL database
	if cfg.DatabaseURL != "" {
		db, err := sql.Open("mysql", cfg.DatabaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to database: %w", err)
		}
		if err := db.Ping(); err != nil {
			return nil, fmt.Errorf("failed to ping database: %w", err)
		}
		mw.DB = db
	}

	// Initialize Redis
	mw.Redis = redis.NewClient(&redis.Options{
		Addr:     cfg.RedisHost,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	if err := mw.Redis.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// Initialize Kafka
	mw.Kafka = NewKafkaClient(cfg.KafkaBrokers)

	// Initialize Dapr
	mw.Dapr = NewDaprClient(cfg.DaprHost, cfg.DaprPort)

	// Initialize Keycloak
	mw.Keycloak = NewKeycloakClient(cfg.KeycloakURL, cfg.KeycloakRealm, cfg.KeycloakClientID)

	// Initialize Permify
	mw.Permify = NewPermifyClient(cfg.PermifyHost, cfg.PermifyPort)

	// Initialize TigerBeetle
	mw.TigerBeetle = NewTigerBeetleClient(cfg.TigerBeetleHost, cfg.TigerBeetlePort)

	// Initialize Fluvio
	mw.Fluvio = NewFluvioClient(cfg.FluvioHost)

	// Initialize Lakehouse
	mw.Lakehouse = NewLakehouseClient(cfg.LakehouseURL)

	return mw, nil
}

// Close closes all middleware connections
func (mw *Middleware) Close() error {
	if mw.DB != nil {
		mw.DB.Close()
	}
	if mw.Redis != nil {
		mw.Redis.Close()
	}
	if mw.Kafka != nil {
		mw.Kafka.Close()
	}
	if mw.Dapr != nil {
		mw.Dapr.Close()
	}
	if mw.TigerBeetle != nil {
		mw.TigerBeetle.Close()
	}
	if mw.Fluvio != nil {
		mw.Fluvio.Close()
	}
	return nil
}

// KafkaClient wraps Kafka operations
type KafkaClient struct {
	brokers []string
	writers map[string]*kafka.Writer
}

func NewKafkaClient(brokers []string) *KafkaClient {
	return &KafkaClient{
		brokers: brokers,
		writers: make(map[string]*kafka.Writer),
	}
}

func (k *KafkaClient) Publish(ctx context.Context, topic string, key, value []byte) error {
	writer, ok := k.writers[topic]
	if !ok {
		writer = &kafka.Writer{
			Addr:     kafka.TCP(k.brokers...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		}
		k.writers[topic] = writer
	}

	return writer.WriteMessages(ctx, kafka.Message{
		Key:   key,
		Value: value,
	})
}

func (k *KafkaClient) Close() error {
	for _, writer := range k.writers {
		writer.Close()
	}
	return nil
}

// DaprClient wraps Dapr operations
type DaprClient struct {
	host string
	port int
}

func NewDaprClient(host string, port int) *DaprClient {
	return &DaprClient{
		host: host,
		port: port,
	}
}

func (d *DaprClient) InvokeService(ctx context.Context, serviceID, method string, data []byte) ([]byte, error) {
	// Implementation would use Dapr SDK
	// For now, this is a placeholder
	return nil, nil
}

func (d *DaprClient) Close() error {
	return nil
}

// KeycloakClient wraps Keycloak operations
type KeycloakClient struct {
	url      string
	realm    string
	clientID string
}

func NewKeycloakClient(url, realm, clientID string) *KeycloakClient {
	return &KeycloakClient{
		url:      url,
		realm:    realm,
		clientID: clientID,
	}
}

func (k *KeycloakClient) ValidateToken(ctx context.Context, token string) (bool, error) {
	// Implementation would validate JWT token
	return true, nil
}

// PermifyClient wraps Permify operations
type PermifyClient struct {
	host string
	port int
}

func NewPermifyClient(host string, port int) *PermifyClient {
	return &PermifyClient{
		host: host,
		port: port,
	}
}

func (p *PermifyClient) CheckPermission(ctx context.Context, userID, resource, action string) (bool, error) {
	// Implementation would check permission via Permify API
	return true, nil
}

// TigerBeetleClient wraps TigerBeetle operations
type TigerBeetleClient struct {
	host string
	port int
}

func NewTigerBeetleClient(host string, port int) *TigerBeetleClient {
	return &TigerBeetleClient{
		host: host,
		port: port,
	}
}

type Transfer struct {
	ID              string
	DebitAccountID  string
	CreditAccountID string
	Amount          int64
	Currency        string
	Timestamp       int64
}

func (t *TigerBeetleClient) CreateTransfer(ctx context.Context, transfer Transfer) error {
	// Implementation would create transfer in TigerBeetle
	return nil
}

func (t *TigerBeetleClient) GetBalance(ctx context.Context, accountID string) (int64, error) {
	// Implementation would get account balance
	return 0, nil
}

func (t *TigerBeetleClient) Close() error {
	return nil
}

// FluvioClient wraps Fluvio operations
type FluvioClient struct {
	host string
}

func NewFluvioClient(host string) *FluvioClient {
	return &FluvioClient{
		host: host,
	}
}

func (f *FluvioClient) Produce(ctx context.Context, topic string, data []byte) error {
	// Implementation would produce to Fluvio stream
	return nil
}

func (f *FluvioClient) Close() error {
	return nil
}

// LakehouseClient wraps Lakehouse operations
type LakehouseClient struct {
	url string
}

func NewLakehouseClient(url string) *LakehouseClient {
	return &LakehouseClient{
		url: url,
	}
}

func (l *LakehouseClient) WriteData(ctx context.Context, table string, data interface{}) error {
	// Implementation would write to Lakehouse
	return nil
}

func (l *LakehouseClient) Query(ctx context.Context, query string) ([]map[string]interface{}, error) {
	// Implementation would query Lakehouse
	return nil, nil
}
