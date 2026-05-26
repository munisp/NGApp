package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// LivenessEvent represents an event published to Kafka/Dapr
type LivenessEvent struct {
	EventID     string      `json:"event_id"`
	EventType   string      `json:"event_type"`
	SessionID   string      `json:"session_id"`
	UserID      string      `json:"user_id,omitempty"`
	TenantID    string      `json:"tenant_id,omitempty"`
	Data        interface{} `json:"data"`
	Timestamp   time.Time   `json:"timestamp"`
	Source      string      `json:"source"`
}

// EventPublisher publishes liveness events to Kafka via Dapr sidecar
type EventPublisher struct {
	daprURL    string
	pubsubName string
	topicName  string
}

func NewEventPublisher() *EventPublisher {
	daprPort := os.Getenv("DAPR_HTTP_PORT")
	if daprPort == "" {
		daprPort = "3500"
	}
	pubsubName := os.Getenv("PUBSUB_NAME")
	if pubsubName == "" {
		pubsubName = "kafka-pubsub"
	}
	topicName := os.Getenv("LIVENESS_TOPIC")
	if topicName == "" {
		topicName = "liveness-events"
	}

	return &EventPublisher{
		daprURL:    fmt.Sprintf("http://localhost:%s", daprPort),
		pubsubName: pubsubName,
		topicName:  topicName,
	}
}

func (ep *EventPublisher) PublishLivenessResult(result *LivenessResult, userID, tenantID string) {
	event := LivenessEvent{
		EventID:   generateSessionID(),
		EventType: "liveness.check." + result.Method,
		SessionID: result.SessionID,
		UserID:    userID,
		TenantID:  tenantID,
		Data: map[string]interface{}{
			"is_live":      result.IsLive,
			"confidence":   result.Confidence,
			"method":       result.Method,
			"spoof_type":   result.SpoofType,
			"processing_ms": result.ProcessingMs,
			"scores":       result.AntiSpoofScores,
		},
		Timestamp: time.Now(),
		Source:    "liveness-service",
	}

	ep.publish(event)
}

func (ep *EventPublisher) PublishSpoofDetection(result *LivenessResult, userID, tenantID string) {
	if result.SpoofType == "none" {
		return
	}

	event := LivenessEvent{
		EventID:   generateSessionID(),
		EventType: "security.spoof_detected",
		SessionID: result.SessionID,
		UserID:    userID,
		TenantID:  tenantID,
		Data: map[string]interface{}{
			"spoof_type":  result.SpoofType,
			"confidence":  result.Confidence,
			"scores":      result.AntiSpoofScores,
			"alert_level": alertLevel(result.Confidence),
		},
		Timestamp: time.Now(),
		Source:    "liveness-service",
	}

	ep.publish(event)
}

func (ep *EventPublisher) PublishFaceMatch(matchResult *FaceMatchResult, userID, tenantID string) {
	event := LivenessEvent{
		EventID:   generateSessionID(),
		EventType: "face.match.completed",
		UserID:    userID,
		TenantID:  tenantID,
		Data: map[string]interface{}{
			"matched":    matchResult.Matched,
			"similarity": matchResult.Similarity,
			"confidence": matchResult.Confidence,
			"threshold":  matchResult.Threshold,
		},
		Timestamp: time.Now(),
		Source:    "liveness-service",
	}

	ep.publish(event)
}

func (ep *EventPublisher) publish(event LivenessEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal event: %v", err)
		return
	}

	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", ep.daprURL, ep.pubsubName, ep.topicName)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("Failed to publish event %s: %v", event.EventType, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("Event publish returned status %d for %s", resp.StatusCode, event.EventType)
	} else {
		log.Printf("Published event %s (session: %s)", event.EventType, event.SessionID)
	}
}

func alertLevel(confidence float64) string {
	if confidence >= 0.9 {
		return "critical"
	}
	if confidence >= 0.7 {
		return "high"
	}
	if confidence >= 0.5 {
		return "medium"
	}
	return "low"
}
