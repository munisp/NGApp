package security

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("security-service")
}

func EmitSecurityAlertRaised(ctx context.Context, alertID, alertType, severity, userID string, details map[string]interface{}) error {
	data := map[string]interface{}{
		"alert_type": alertType,
		"severity":   severity,
		"user_id":    userID,
		"raised_at":  time.Now().UTC().Format(time.RFC3339),
	}
	for k, v := range details {
		data[k] = v
	}
	return events.GetEmitter().Emit(ctx, "security.alert.raised", "security_alert", alertID, data)
}

func EmitSuspiciousActivityDetected(ctx context.Context, userID, activityType string, riskScore float64) error {
	return events.GetEmitter().Emit(ctx, "security.suspicious.activity", "user", userID, map[string]interface{}{
		"activity_type": activityType,
		"risk_score":    riskScore,
		"detected_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAccountCompromised(ctx context.Context, userID, reason string) error {
	return events.GetEmitter().Emit(ctx, "security.account.compromised", "user", userID, map[string]interface{}{
		"reason":      reason,
		"detected_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitIPBlocked(ctx context.Context, ipAddress, reason string) error {
	return events.GetEmitter().Emit(ctx, "security.ip.blocked", "ip_address", ipAddress, map[string]interface{}{
		"reason":     reason,
		"blocked_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitRateLimitExceeded(ctx context.Context, userID, endpoint string, requestCount int) error {
	return events.GetEmitter().Emit(ctx, "security.rate_limit.exceeded", "user", userID, map[string]interface{}{
		"endpoint":      endpoint,
		"request_count": requestCount,
		"exceeded_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

type SecurityServiceWithEvents struct {
	service interface{}
}

func NewSecurityServiceWithEvents(service interface{}) *SecurityServiceWithEvents {
	return &SecurityServiceWithEvents{service: service}
}

func (s *SecurityServiceWithEvents) RaiseAlert(ctx context.Context, alertType, severity, userID string, details map[string]interface{}) (string, error) {
	alertID := generateAlertID()
	
	if err := EmitSecurityAlertRaised(ctx, alertID, alertType, severity, userID, details); err != nil {
		log.Printf("Failed to emit security alert event: %v", err)
	}
	
	return alertID, nil
}

func (s *SecurityServiceWithEvents) DetectSuspiciousActivity(ctx context.Context, userID, activityType string, riskScore float64) error {
	if riskScore > 0.7 {
		if err := EmitSuspiciousActivityDetected(ctx, userID, activityType, riskScore); err != nil {
			log.Printf("Failed to emit suspicious activity event: %v", err)
		}
	}
	return nil
}

func (s *SecurityServiceWithEvents) BlockIP(ctx context.Context, ipAddress, reason string) error {
	if err := EmitIPBlocked(ctx, ipAddress, reason); err != nil {
		log.Printf("Failed to emit IP blocked event: %v", err)
	}
	return nil
}

func generateAlertID() string {
	return "sec_" + time.Now().Format("20060102150405")
}
