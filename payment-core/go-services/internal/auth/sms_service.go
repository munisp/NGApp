package auth

import "context"

// SMSService interface for sending SMS messages
type SMSService interface {
	SendSMS(ctx context.Context, phoneNumber, message string) error
}
