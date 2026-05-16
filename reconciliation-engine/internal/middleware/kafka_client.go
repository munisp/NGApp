package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type KafkaClient struct {
	brokers       []string
	writer        *kafka.Writer
	readers       map[string]*kafka.Reader
	consumerGroup string
}

type ReconciliationEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	Timestamp     time.Time              `json:"timestamp"`
	JobID         string                 `json:"job_id,omitempty"`
	ItemID        string                 `json:"item_id,omitempty"`
	Status        string                 `json:"status,omitempty"`
	MatchStatus   string                 `json:"match_status,omitempty"`
	SourceAmount  float64                `json:"source_amount,omitempty"`
	TargetAmount  float64                `json:"target_amount,omitempty"`
	Variance      float64                `json:"variance,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

const (
	TopicReconciliationJobCreated    = "reconciliation.job.created"
	TopicReconciliationJobStarted    = "reconciliation.job.started"
	TopicReconciliationJobCompleted  = "reconciliation.job.completed"
	TopicReconciliationJobFailed     = "reconciliation.job.failed"
	TopicReconciliationItemMatched   = "reconciliation.item.matched"
	TopicReconciliationItemUnmatched = "reconciliation.item.unmatched"
	TopicReconciliationItemDisputed  = "reconciliation.item.disputed"
	TopicReconciliationItemResolved  = "reconciliation.item.resolved"
	TopicReconciliationVarianceAlert = "reconciliation.variance.alert"
	TopicStatementUploaded           = "reconciliation.statement.uploaded"
	TopicStatementProcessed          = "reconciliation.statement.processed"
)

func NewKafkaClient(brokers []string, consumerGroup string) (*KafkaClient, error) {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireAll,
	}

	return &KafkaClient{
		brokers:       brokers,
		writer:        writer,
		readers:       make(map[string]*kafka.Reader),
		consumerGroup: consumerGroup,
	}, nil
}

func (k *KafkaClient) PublishEvent(ctx context.Context, topic string, event *ReconciliationEvent) error {
	if event.EventID == "" {
		event.EventID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Topic: topic,
		Key:   []byte(event.JobID),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	}

	return k.writer.WriteMessages(ctx, msg)
}

func (k *KafkaClient) PublishJobCreated(ctx context.Context, jobID string, jobName string, reconciliationType string) error {
	return k.PublishEvent(ctx, TopicReconciliationJobCreated, &ReconciliationEvent{
		EventType: "JOB_CREATED",
		JobID:     jobID,
		Metadata: map[string]interface{}{
			"job_name":            jobName,
			"reconciliation_type": reconciliationType,
		},
	})
}

func (k *KafkaClient) PublishJobStarted(ctx context.Context, jobID string) error {
	return k.PublishEvent(ctx, TopicReconciliationJobStarted, &ReconciliationEvent{
		EventType: "JOB_STARTED",
		JobID:     jobID,
		Status:    "IN_PROGRESS",
	})
}

func (k *KafkaClient) PublishJobCompleted(ctx context.Context, jobID string, matchedCount, unmatchedCount int, totalVariance float64) error {
	return k.PublishEvent(ctx, TopicReconciliationJobCompleted, &ReconciliationEvent{
		EventType: "JOB_COMPLETED",
		JobID:     jobID,
		Status:    "COMPLETED",
		Variance:  totalVariance,
		Metadata: map[string]interface{}{
			"matched_count":   matchedCount,
			"unmatched_count": unmatchedCount,
		},
	})
}

func (k *KafkaClient) PublishJobFailed(ctx context.Context, jobID string, errorMsg string) error {
	return k.PublishEvent(ctx, TopicReconciliationJobFailed, &ReconciliationEvent{
		EventType: "JOB_FAILED",
		JobID:     jobID,
		Status:    "FAILED",
		Metadata: map[string]interface{}{
			"error": errorMsg,
		},
	})
}

func (k *KafkaClient) PublishItemMatched(ctx context.Context, jobID, itemID string, sourceAmount, targetAmount float64) error {
	return k.PublishEvent(ctx, TopicReconciliationItemMatched, &ReconciliationEvent{
		EventType:    "ITEM_MATCHED",
		JobID:        jobID,
		ItemID:       itemID,
		MatchStatus:  "MATCHED",
		SourceAmount: sourceAmount,
		TargetAmount: targetAmount,
		Variance:     sourceAmount - targetAmount,
	})
}

func (k *KafkaClient) PublishItemUnmatched(ctx context.Context, jobID, itemID string, sourceAmount, targetAmount, variance float64) error {
	return k.PublishEvent(ctx, TopicReconciliationItemUnmatched, &ReconciliationEvent{
		EventType:    "ITEM_UNMATCHED",
		JobID:        jobID,
		ItemID:       itemID,
		MatchStatus:  "UNMATCHED",
		SourceAmount: sourceAmount,
		TargetAmount: targetAmount,
		Variance:     variance,
	})
}

func (k *KafkaClient) PublishVarianceAlert(ctx context.Context, jobID string, totalVariance float64, threshold float64) error {
	return k.PublishEvent(ctx, TopicReconciliationVarianceAlert, &ReconciliationEvent{
		EventType: "VARIANCE_ALERT",
		JobID:     jobID,
		Variance:  totalVariance,
		Metadata: map[string]interface{}{
			"threshold":          threshold,
			"exceeds_threshold":  totalVariance > threshold,
			"variance_percentage": (totalVariance / threshold) * 100,
		},
	})
}

func (k *KafkaClient) Subscribe(ctx context.Context, topic string, handler func(event *ReconciliationEvent) error) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        k.brokers,
		Topic:          topic,
		GroupID:        k.consumerGroup,
		MinBytes:       10e3,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
	})
	k.readers[topic] = reader

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				msg, err := reader.ReadMessage(ctx)
				if err != nil {
					continue
				}

				var event ReconciliationEvent
				if err := json.Unmarshal(msg.Value, &event); err != nil {
					continue
				}

				if err := handler(&event); err != nil {
					continue
				}
			}
		}
	}()

	return nil
}

func (k *KafkaClient) Close() error {
	if k.writer != nil {
		k.writer.Close()
	}
	for _, reader := range k.readers {
		reader.Close()
	}
	return nil
}
