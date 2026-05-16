package kafka

import (
	"context"
	"encoding/json"
	"time"

	"github.com/openimis/actuarial-data-transformer/config"
	"github.com/openimis/actuarial-data-transformer/pkg/logging"
	"github.com/openimis/actuarial-data-transformer/pkg/models"
	"github.com/segmentio/kafka-go"
	"github.com/sirupsen/logrus"
)

// Consumer represents the Kafka consumer for raw claim events.
type Consumer struct {
	reader *kafka.Reader
	log    *logrus.Entry
}

// Producer represents the Kafka producer for aggregated data.
type Producer struct {
	writer *kafka.Writer
	log    *logrus.Entry
}

// NewConsumer creates a new Kafka Consumer.
func NewConsumer(cfg *config.Config) *Consumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Kafka.Brokers,
		Topic:    cfg.Kafka.InputTopic,
		GroupID:  cfg.Kafka.GroupID,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
		MaxWait:  1 * time.Second,
	})
	return &Consumer{
		reader: reader,
		log:    logging.Logger.WithField("component", "kafka-consumer"),
	}
}

// NewProducer creates a new Kafka Producer.
func NewProducer(cfg *config.Config) *Producer {
	writer := kafka.NewWriter(kafka.WriterConfig{
		Brokers:  cfg.Kafka.Brokers,
		Topic:    cfg.Kafka.OutputTopic,
		Balancer: &kafka.LeastBytes{},
		// Implement retry logic
		MaxAttempts: 5,
		BatchTimeout: 10 * time.Millisecond,
	})
	return &Producer{
		writer: writer,
		log:    logging.Logger.WithField("component", "kafka-producer"),
	}
}

// ReadMessage reads a single raw claim event from Kafka.
func (c *Consumer) ReadMessage(ctx context.Context) (*models.ClaimEvent, error) {
	m, err := c.reader.ReadMessage(ctx)
	if err != nil {
		return nil, err
	}

	var event models.ClaimEvent
	if err := json.Unmarshal(m.Value, &event); err != nil {
		c.log.WithError(err).Error("Failed to unmarshal Kafka message")
		return nil, err
	}

	c.log.WithFields(logrus.Fields{
		"topic": m.Topic,
		"partition": m.Partition,
		"offset": m.Offset,
		"claim_id": event.ClaimID,
	}).Debug("Message read successfully")

	return &event, nil
}

// ProduceAggregation sends an aggregated data point to Kafka.
func (p *Producer) ProduceAggregation(ctx context.Context, agg *models.LossRatioAggregation) error {
	value, err := json.Marshal(agg)
	if err != nil {
		p.log.WithError(err).Error("Failed to marshal aggregation data")
		return err
	}

	msg := kafka.Message{
		Key:   []byte(agg.AggregationKey),
		Value: value,
	}

	err = p.writer.WriteMessages(ctx, msg)
	if err != nil {
		p.log.WithError(err).Error("Failed to write message to Kafka")
		return err
	}

	p.log.WithField("key", agg.AggregationKey).Info("Aggregation produced to Kafka")
	return nil
}

// Close closes the consumer and producer connections.
func (c *Consumer) Close() error {
	return c.reader.Close()
}

func (p *Producer) Close() error {
	return p.writer.Close()
}
