package auth

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("auth-service")
}

func EmitLoginSuccess(ctx context.Context, userID, deviceID, ipAddress string) error {
	return events.EmitAuthLoginSuccess(ctx, userID, deviceID, ipAddress)
}

func EmitLoginFailed(ctx context.Context, userID, deviceID, ipAddress, reason string) error {
	return events.GetEmitter().Emit(ctx, events.EventAuthLoginFailed, "user", userID, map[string]interface{}{
		"device_id":  deviceID,
		"ip_address": ipAddress,
		"reason":     reason,
		"failed_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func Emit2FAVerified(ctx context.Context, userID, method string) error {
	return events.GetEmitter().Emit(ctx, events.EventAuth2FAVerified, "user", userID, map[string]interface{}{
		"method":      method,
		"verified_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitDeviceTrusted(ctx context.Context, userID, deviceID, deviceName string) error {
	return events.GetEmitter().Emit(ctx, events.EventAuthDeviceTrusted, "user", userID, map[string]interface{}{
		"device_id":   deviceID,
		"device_name": deviceName,
		"trusted_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitPasswordChanged(ctx context.Context, userID string) error {
	return events.GetEmitter().Emit(ctx, "auth.password.changed", "user", userID, map[string]interface{}{
		"changed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitAccountLocked(ctx context.Context, userID, reason string, failedAttempts int) error {
	return events.GetEmitter().Emit(ctx, "auth.account.locked", "user", userID, map[string]interface{}{
		"reason":          reason,
		"failed_attempts": failedAttempts,
		"locked_at":       time.Now().UTC().Format(time.RFC3339),
	})
}

type AuthServiceWithEvents struct {
	service interface{}
}

func NewAuthServiceWithEvents(service interface{}) *AuthServiceWithEvents {
	return &AuthServiceWithEvents{service: service}
}

func (s *AuthServiceWithEvents) Login(ctx context.Context, userID, deviceID, ipAddress string, success bool, failReason string) error {
	if success {
		if err := EmitLoginSuccess(ctx, userID, deviceID, ipAddress); err != nil {
			log.Printf("Failed to emit login success event: %v", err)
		}
	} else {
		if err := EmitLoginFailed(ctx, userID, deviceID, ipAddress, failReason); err != nil {
			log.Printf("Failed to emit login failed event: %v", err)
		}
	}
	return nil
}

func (s *AuthServiceWithEvents) Verify2FA(ctx context.Context, userID, method string) error {
	if err := Emit2FAVerified(ctx, userID, method); err != nil {
		log.Printf("Failed to emit 2FA verified event: %v", err)
	}
	return nil
}

func (s *AuthServiceWithEvents) TrustDevice(ctx context.Context, userID, deviceID, deviceName string) error {
	if err := EmitDeviceTrusted(ctx, userID, deviceID, deviceName); err != nil {
		log.Printf("Failed to emit device trusted event: %v", err)
	}
	return nil
}
