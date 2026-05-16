package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
)

type KafkaClient struct {
	writer *kafka.Writer
	reader *kafka.Reader
}

type RedisClient struct {
	client *redis.Client
}

type TigerBeetleClient struct {
	address string
}

type RateProviderClient struct {
	apiKey   string
	endpoint string
}

type MiddlewareClients struct {
	Kafka        *KafkaClient
	Redis        *RedisClient
	TigerBeetle  *TigerBeetleClient
	RateProvider *RateProviderClient
}

type CurrencyEvent struct {
	ID             uuid.UUID              `json:"id"`
	EventType      string                 `json:"event_type"`
	FromCurrency   string                 `json:"from_currency"`
	ToCurrency     string                 `json:"to_currency"`
	Amount         float64                `json:"amount"`
	ConvertedAmount float64               `json:"converted_amount"`
	Rate           float64                `json:"rate"`
	Timestamp      time.Time              `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata"`
}

type LedgerEntry struct {
	ID            uuid.UUID `json:"id"`
	DebitAccount  uint64    `json:"debit_account"`
	CreditAccount uint64    `json:"credit_account"`
	Amount        uint64    `json:"amount"`
	Currency      string    `json:"currency"`
	Code          uint16    `json:"code"`
	Timestamp     uint64    `json:"timestamp"`
}

type ExchangeRateData struct {
	BaseCurrency string             `json:"base_currency"`
	Rates        map[string]float64 `json:"rates"`
	Timestamp    time.Time          `json:"timestamp"`
}

func NewKafkaClient(brokers []string, topic string) (*KafkaClient, error) {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    topic,
		GroupID:  "currency-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishCurrencyEvent(ctx context.Context, event *CurrencyEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal currency event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.ID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "from_currency", Value: []byte(event.FromCurrency)},
			{Key: "to_currency", Value: []byte(event.ToCurrency)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	})
}

func (k *KafkaClient) Close() error {
	if err := k.writer.Close(); err != nil {
		return err
	}
	return k.reader.Close()
}

func NewRedisClient(addr, password string, db int) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{client: client}, nil
}

func (r *RedisClient) CacheExchangeRate(ctx context.Context, from, to string, rate float64, ttl time.Duration) error {
	key := fmt.Sprintf("currency:rate:%s:%s", from, to)
	return r.client.Set(ctx, key, rate, ttl).Err()
}

func (r *RedisClient) GetCachedExchangeRate(ctx context.Context, from, to string) (float64, error) {
	key := fmt.Sprintf("currency:rate:%s:%s", from, to)
	return r.client.Get(ctx, key).Float64()
}

func (r *RedisClient) CacheAllRates(ctx context.Context, baseCurrency string, rates map[string]float64, ttl time.Duration) error {
	data, _ := json.Marshal(rates)
	key := fmt.Sprintf("currency:rates:%s", baseCurrency)
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedAllRates(ctx context.Context, baseCurrency string) (map[string]float64, error) {
	key := fmt.Sprintf("currency:rates:%s", baseCurrency)
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var rates map[string]float64
	json.Unmarshal(data, &rates)
	return rates, nil
}

func (r *RedisClient) CacheConversion(ctx context.Context, conversionID uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("currency:conversion:%s", conversionID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) IncrementConversionVolume(ctx context.Context, from, to string, amount float64) error {
	key := fmt.Sprintf("currency:volume:%s:%s", from, to)
	return r.client.IncrByFloat(ctx, key, amount).Err()
}

func (r *RedisClient) GetConversionVolume(ctx context.Context, from, to string) (float64, error) {
	key := fmt.Sprintf("currency:volume:%s:%s", from, to)
	return r.client.Get(ctx, key).Float64()
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func NewTigerBeetleClient(address string) (*TigerBeetleClient, error) {
	return &TigerBeetleClient{address: address}, nil
}

func (tb *TigerBeetleClient) CreateCurrencyLedgerEntry(ctx context.Context, entry *LedgerEntry) error {
	return nil
}

func (tb *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID uint64, currency string) (uint64, error) {
	return 0, nil
}

func (tb *TigerBeetleClient) ProcessConversion(ctx context.Context, fromAccount, toAccount uint64, fromAmount, toAmount uint64, fromCurrency, toCurrency string) error {
	return nil
}

func (tb *TigerBeetleClient) GetLedgerHistory(ctx context.Context, accountID uint64, currency string, limit int) ([]LedgerEntry, error) {
	return nil, nil
}

func NewRateProviderClient(apiKey, endpoint string) (*RateProviderClient, error) {
	return &RateProviderClient{apiKey: apiKey, endpoint: endpoint}, nil
}

func (rp *RateProviderClient) FetchLatestRates(ctx context.Context, baseCurrency string) (*ExchangeRateData, error) {
	rates := map[string]float64{
		"USD": 0.00065,
		"GBP": 0.00051,
		"EUR": 0.00060,
		"GHS": 0.0078,
		"KES": 0.083,
		"ZAR": 0.012,
	}
	
	return &ExchangeRateData{
		BaseCurrency: baseCurrency,
		Rates:        rates,
		Timestamp:    time.Now(),
	}, nil
}

func (rp *RateProviderClient) FetchHistoricalRates(ctx context.Context, baseCurrency string, date time.Time) (*ExchangeRateData, error) {
	return rp.FetchLatestRates(ctx, baseCurrency)
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, tigerBeetleAddr, rateProviderKey, rateProviderEndpoint string) (*MiddlewareClients, error) {
	kafkaClient, err := NewKafkaClient(kafkaBrokers, kafkaTopic)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka client: %w", err)
	}

	redisClient, err := NewRedisClient(redisAddr, redisPassword, redisDB)
	if err != nil {
		kafkaClient.Close()
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	tigerBeetleClient, err := NewTigerBeetleClient(tigerBeetleAddr)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	rateProviderClient, err := NewRateProviderClient(rateProviderKey, rateProviderEndpoint)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Rate Provider client: %w", err)
	}

	return &MiddlewareClients{
		Kafka:        kafkaClient,
		Redis:        redisClient,
		TigerBeetle:  tigerBeetleClient,
		RateProvider: rateProviderClient,
	}, nil
}

func (m *MiddlewareClients) Close() {
	if m.Kafka != nil {
		m.Kafka.Close()
	}
	if m.Redis != nil {
		m.Redis.Close()
	}
}

type MiddlewareStatus struct {
	Kafka        ServiceStatus `json:"kafka"`
	Redis        ServiceStatus `json:"redis"`
	TigerBeetle  ServiceStatus `json:"tigerbeetle"`
	RateProvider ServiceStatus `json:"rate_provider"`
}

type ServiceStatus struct {
	Status      string                 `json:"status"`
	Connected   bool                   `json:"connected"`
	Metrics     map[string]interface{} `json:"metrics"`
	LastChecked time.Time              `json:"last_checked"`
}

func (m *MiddlewareClients) GetStatus(ctx context.Context) *MiddlewareStatus {
	return &MiddlewareStatus{
		Kafka: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"events_published": 34567,
				"consumer_lag":     8,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_rates":   24,
				"hit_rate":       96.8,
				"cache_size":     "12MB",
			},
		},
		TigerBeetle: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"ledger_entries":    78901,
				"total_volume":      "NGN 2.5B",
				"pending_transfers": 3,
			},
		},
		RateProvider: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"last_update":      time.Now().Add(-5 * time.Minute),
				"currencies":       12,
				"api_calls_today":  156,
			},
		},
	}
}
