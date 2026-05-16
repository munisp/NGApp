package temporal

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/activity"
	"openimis-insurance-integration/internal/events"
	"openimis-insurance-integration/internal/metrics"
)

// Activities struct holds dependencies for Temporal activities
type Activities struct {
	log *logrus.Entry
	metrics *metrics.Metrics
}

// NewActivities creates a new Activities instance
func NewActivities(m *metrics.Metrics) *Activities {
	return &Activities{
		log: logrus.WithField("component", "TemporalActivities"),
		metrics: m,
	}
}

// ProcessPremiumAdjustmentActivity simulates the activity of processing a premium adjustment
func (a *Activities) ProcessPremiumAdjustmentActivity(ctx context.Context, event events.ActuarialEvent) (string, error) {
	startTime := time.Now()
	activityInfo := activity.Get  ActivityInfo(ctx)
	log := a.log.WithFields(logrus.Fields{
		"workflow_id": activityInfo.WorkflowExecution.ID,
		"run_id": activityInfo.WorkflowExecution.RunID,
		"activity_id": activityInfo.ActivityID,
		"event_id": event.EventID,
	})

	var payload events.PremiumAdjustmentPayload
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		log.WithError(err).Error("Failed to unmarshal PremiumAdjustmentPayload")
		a.metrics.ActivityDuration.WithLabelValues("ProcessPremiumAdjustmentActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", fmt.Errorf("failed to unmarshal PremiumAdjustmentPayload: %w", err)
	}

	log.WithFields(logrus.Fields{
		"policy_id": payload.PolicyID,
		"amount": payload.AdjustmentAmount,
	}).Info("Executing ProcessPremiumAdjustmentActivity")

	// Simulate complex business logic and external service call
	time.Sleep(2 * time.Second)

	// Simulate success
	result := fmt.Sprintf("Premium adjustment for policy %s processed successfully. New premium: %.2f", payload.PolicyID, 1000.0+payload.AdjustmentAmount)
	log.Info("ProcessPremiumAdjustmentActivity completed")
	a.metrics.ActivityDuration.WithLabelValues("ProcessPremiumAdjustmentActivity", "success").Observe(time.Since(startTime).Seconds())
	return result, nil
}

// ProcessReserveAdjustmentActivity simulates the activity of processing a reserve adjustment
func (a *Activities) ProcessReserveAdjustmentActivity(ctx context.Context, event events.ActuarialEvent) (string, error) {
	startTime := time.Now()
	activityInfo := activity.GetActivityInfo(ctx)
	log := a.log.WithFields(logrus.Fields{
		"workflow_id": activityInfo.WorkflowExecution.ID,
		"run_id": activityInfo.WorkflowExecution.RunID,
		"activity_id": activityInfo.ActivityID,
		"event_id": event.EventID,
	})

	var payload events.ReserveAdjustmentPayload
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		log.WithError(err).Error("Failed to unmarshal ReserveAdjustmentPayload")
		a.metrics.ActivityDuration.WithLabelValues("ProcessReserveAdjustmentActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", fmt.Errorf("failed to unmarshal ReserveAdjustmentPayload: %w", err)
	}

	log.WithFields(logrus.Fields{
		"policy_id": payload.PolicyID,
		"type": payload.ReserveType,
		"amount": payload.AdjustmentAmount,
	}).Info("Executing ProcessReserveAdjustmentActivity")

	// Simulate complex business logic and external service call
	time.Sleep(1 * time.Second)

	// Simulate success
	result := fmt.Sprintf("Reserve adjustment (%s) for policy %s processed successfully.", payload.ReserveType, payload.PolicyID)
	log.Info("ProcessReserveAdjustmentActivity completed")
	a.metrics.ActivityDuration.WithLabelValues("ProcessReserveAdjustmentActivity", "success").Observe(time.Since(startTime).Seconds())
	return result, nil
}

// NotifyUnderwritingActivity simulates notifying the underwriting service
func (a *Activities) NotifyUnderwritingActivity(ctx context.Context, event events.ActuarialEvent) (string, error) {
	startTime := time.Now()
	activityInfo := activity.GetActivityInfo(ctx)
	log := a.log.WithFields(logrus.Fields{
		"workflow_id": activityInfo.WorkflowExecution.ID,
		"run_id": activityInfo.WorkflowExecution.RunID,
		"activity_id": activityInfo.ActivityID,
		"event_id": event.EventID,
	})

	var payload interface{}
	switch event.EventType {
	case events.ProductConfigUpdate:
		payload = &events.ProductConfigUpdatePayload{}
	case events.LossRatioAlert:
		payload = &events.LossRatioAlertPayload{}
	default:
		err := fmt.Errorf("unsupported event type for NotifyUnderwritingActivity: %s", event.EventType)
		log.WithError(err).Error("Activity failed")
		a.metrics.ActivityDuration.WithLabelValues("NotifyUnderwritingActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", err
	}

	if err := json.Unmarshal(event.Payload, payload); err != nil {
		log.WithError(err).Error("Failed to unmarshal payload")
		a.metrics.ActivityDuration.WithLabelValues("NotifyUnderwritingActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", fmt.Errorf("failed to unmarshal payload for %s: %w", event.EventType, err)
	}

	log.WithField("event_type", event.EventType).Info("Executing NotifyUnderwritingActivity")

	// Simulate REST API call to Underwriting service
	time.Sleep(500 * time.Millisecond)

	// Simulate success
	result := fmt.Sprintf("Underwriting service notified of %s event.", event.EventType)
	log.Info("NotifyUnderwritingActivity completed")
	a.metrics.ActivityDuration.WithLabelValues("NotifyUnderwritingActivity", "success").Observe(time.Since(startTime).Seconds())
	return result, nil
}

// UpdatePolicyServiceActivity simulates updating the policy service
func (a *Activities) UpdatePolicyServiceActivity(ctx context.Context, event events.ActuarialEvent) (string, error) {
	startTime := time.Now()
	activityInfo := activity.GetActivityInfo(ctx)
	log := a.log.WithFields(logrus.Fields{
		"workflow_id": activityInfo.WorkflowExecution.ID,
		"run_id": activityInfo.WorkflowExecution.RunID,
		"activity_id": activityInfo.ActivityID,
		"event_id": event.EventID,
	})

	var payload interface{}
	switch event.EventType {
	case events.PremiumAdjustment:
		payload = &events.PremiumAdjustmentPayload{}
	case events.ProductConfigUpdate:
		payload = &events.ProductConfigUpdatePayload{}
	default:
		err := fmt.Errorf("unsupported event type for UpdatePolicyServiceActivity: %s", event.EventType)
		log.WithError(err).Error("Activity failed")
		a.metrics.ActivityDuration.WithLabelValues("UpdatePolicyServiceActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", err
	}

	if err := json.Unmarshal(event.Payload, payload); err != nil {
		log.WithError(err).Error("Failed to unmarshal payload")
		a.metrics.ActivityDuration.WithLabelValues("UpdatePolicyServiceActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", fmt.Errorf("failed to unmarshal payload for %s: %w", event.EventType, err)
	}

	log.WithField("event_type", event.EventType).Info("Executing UpdatePolicyServiceActivity")

	// Simulate Dapr service invocation to Policy service
	time.Sleep(500 * time.Millisecond)

	// Simulate success
	result := fmt.Sprintf("Policy service updated with %s event.", event.EventType)
	log.Info("UpdatePolicyServiceActivity completed")
	a.metrics.ActivityDuration.WithLabelValues("UpdatePolicyServiceActivity", "success").Observe(time.Since(startTime).Seconds())
	return result, nil
}

// UpdateClaimsServiceActivity simulates updating the claims service
func (a *Activities) UpdateClaimsServiceActivity(ctx context.Context, event events.ActuarialEvent) (string, error) {
	startTime := time.Now()
	activityInfo := activity.GetActivityInfo(ctx)
	log := a.log.WithFields(logrus.Fields{
		"workflow_id": activityInfo.WorkflowExecution.ID,
		"run_id": activityInfo.WorkflowExecution.RunID,
		"activity_id": activityInfo.ActivityID,
		"event_id": event.EventID,
	})

	var payload interface{}
	switch event.EventType {
	case events.ReserveAdjustment:
		payload = &events.ReserveAdjustmentPayload{}
	case events.LossRatioAlert:
		payload = &events.LossRatioAlertPayload{}
	default:
		err := fmt.Errorf("unsupported event type for UpdateClaimsServiceActivity: %s", event.EventType)
		log.WithError(err).Error("Activity failed")
		a.metrics.ActivityDuration.WithLabelValues("UpdateClaimsServiceActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", err
	}

	if err := json.Unmarshal(event.Payload, payload); err != nil {
		log.WithError(err).Error("Failed to unmarshal payload")
		a.metrics.ActivityDuration.WithLabelValues("UpdateClaimsServiceActivity", "error").Observe(time.Since(startTime).Seconds())
		return "", fmt.Errorf("failed to unmarshal payload for %s: %w", event.EventType, err)
	}

	log.WithField("event_type", event.EventType).Info("Executing UpdateClaimsServiceActivity")

	// Simulate REST API call to Claims service
	time.Sleep(500 * time.Millisecond)

	// Simulate success
	result := fmt.Sprintf("Claims service updated with %s event.", event.EventType)
	log.Info("UpdateClaimsServiceActivity completed")
	a.metrics.ActivityDuration.WithLabelValues("UpdateClaimsServiceActivity", "success").Observe(time.Since(startTime).Seconds())
	return result, nil
}
