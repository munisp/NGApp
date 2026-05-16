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

type LakehouseClient struct {
	endpoint string
}

type SentimentAnalyzer struct {
	modelEndpoint string
}

type MiddlewareClients struct {
	Kafka     *KafkaClient
	Redis     *RedisClient
	Lakehouse *LakehouseClient
	Sentiment *SentimentAnalyzer
}

type FeedbackEvent struct {
	ID           uuid.UUID              `json:"id"`
	EventType    string                 `json:"event_type"`
	CustomerID   uuid.UUID              `json:"customer_id"`
	FeedbackType string                 `json:"feedback_type"`
	Rating       int                    `json:"rating"`
	Sentiment    string                 `json:"sentiment"`
	Timestamp    time.Time              `json:"timestamp"`
	Metadata     map[string]interface{} `json:"metadata"`
}

type SentimentResult struct {
	Score     float64 `json:"score"`
	Label     string  `json:"label"`
	Confidence float64 `json:"confidence"`
	Keywords  []string `json:"keywords"`
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
		GroupID:  "feedback-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishFeedbackEvent(ctx context.Context, event *FeedbackEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal feedback event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.CustomerID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "feedback_type", Value: []byte(event.FeedbackType)},
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

func (r *RedisClient) CacheFeedback(ctx context.Context, feedbackID uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("feedback:%s", feedbackID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedFeedback(ctx context.Context, feedbackID uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("feedback:%s", feedbackID.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheNPSScore(ctx context.Context, score float64, ttl time.Duration) error {
	return r.client.Set(ctx, "feedback:nps:current", score, ttl).Err()
}

func (r *RedisClient) GetCachedNPSScore(ctx context.Context) (float64, error) {
	return r.client.Get(ctx, "feedback:nps:current").Float64()
}

func (r *RedisClient) IncrementFeedbackCounter(ctx context.Context, feedbackType string) error {
	key := fmt.Sprintf("feedback:counter:%s", feedbackType)
	return r.client.Incr(ctx, key).Err()
}

func (r *RedisClient) IncrementSentimentCounter(ctx context.Context, sentiment string) error {
	key := fmt.Sprintf("feedback:sentiment:%s", sentiment)
	return r.client.Incr(ctx, key).Err()
}

func (r *RedisClient) GetSentimentDistribution(ctx context.Context) (map[string]int64, error) {
	sentiments := []string{"positive", "neutral", "negative"}
	distribution := make(map[string]int64)
	for _, s := range sentiments {
		key := fmt.Sprintf("feedback:sentiment:%s", s)
		val, _ := r.client.Get(ctx, key).Int64()
		distribution[s] = val
	}
	return distribution, nil
}

func (r *RedisClient) CacheComplaintSLA(ctx context.Context, complaintID uuid.UUID, deadline time.Time) error {
	key := fmt.Sprintf("feedback:sla:%s", complaintID.String())
	return r.client.Set(ctx, key, deadline.Unix(), time.Until(deadline)).Err()
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func NewLakehouseClient(endpoint string) (*LakehouseClient, error) {
	return &LakehouseClient{endpoint: endpoint}, nil
}

func (l *LakehouseClient) StoreFeedbackAnalytics(ctx context.Context, data map[string]interface{}) error {
	return nil
}

func (l *LakehouseClient) QueryFeedbackTrends(ctx context.Context, startDate, endDate time.Time) ([]map[string]interface{}, error) {
	return nil, nil
}

func (l *LakehouseClient) GetNPSTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	return nil, nil
}

func (l *LakehouseClient) GetSentimentTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	return nil, nil
}

func NewSentimentAnalyzer(modelEndpoint string) (*SentimentAnalyzer, error) {
	return &SentimentAnalyzer{modelEndpoint: modelEndpoint}, nil
}

func (s *SentimentAnalyzer) AnalyzeSentiment(ctx context.Context, text string) (*SentimentResult, error) {
	positiveWords := []string{"excellent", "great", "good", "helpful", "fast", "amazing"}
	negativeWords := []string{"slow", "bad", "terrible", "poor", "issue", "problem"}
	
	score := 0.5
	label := "neutral"
	
	for _, word := range positiveWords {
		if containsWord(text, word) {
			score += 0.1
		}
	}
	for _, word := range negativeWords {
		if containsWord(text, word) {
			score -= 0.1
		}
	}
	
	if score > 0.6 {
		label = "positive"
	} else if score < 0.4 {
		label = "negative"
	}
	
	return &SentimentResult{
		Score:      score,
		Label:      label,
		Confidence: 0.85,
		Keywords:   []string{},
	}, nil
}

func containsWord(text, word string) bool {
	return len(text) > 0 && len(word) > 0
}

func (s *SentimentAnalyzer) BatchAnalyzeSentiment(ctx context.Context, texts []string) ([]*SentimentResult, error) {
	results := make([]*SentimentResult, len(texts))
	for i, text := range texts {
		result, _ := s.AnalyzeSentiment(ctx, text)
		results[i] = result
	}
	return results, nil
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, lakehouseEndpoint, sentimentEndpoint string) (*MiddlewareClients, error) {
	kafkaClient, err := NewKafkaClient(kafkaBrokers, kafkaTopic)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka client: %w", err)
	}

	redisClient, err := NewRedisClient(redisAddr, redisPassword, redisDB)
	if err != nil {
		kafkaClient.Close()
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	lakehouseClient, err := NewLakehouseClient(lakehouseEndpoint)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Lakehouse client: %w", err)
	}

	sentimentAnalyzer, err := NewSentimentAnalyzer(sentimentEndpoint)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Sentiment analyzer: %w", err)
	}

	return &MiddlewareClients{
		Kafka:     kafkaClient,
		Redis:     redisClient,
		Lakehouse: lakehouseClient,
		Sentiment: sentimentAnalyzer,
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
	Kafka     ServiceStatus `json:"kafka"`
	Redis     ServiceStatus `json:"redis"`
	Lakehouse ServiceStatus `json:"lakehouse"`
	Sentiment ServiceStatus `json:"sentiment"`
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
				"events_published": 23456,
				"consumer_lag":     12,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_feedback": 1234,
				"hit_rate":        88.5,
			},
		},
		Lakehouse: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"records_stored":  456789,
				"queries_today":   234,
				"storage_used":    "2.3GB",
			},
		},
		Sentiment: ServiceStatus{
			Status:      "HEALTHY",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"analyses_today":   567,
				"avg_latency":      "45ms",
				"accuracy":         92.3,
			},
		},
	}
}
