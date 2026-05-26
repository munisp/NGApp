package adapters

import (
	"context"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// ChannelAdapter defines the interface for channel-specific message adapters.
type ChannelAdapter interface {
	SendMessage(ctx context.Context, msg *models.Message) error
	ReceiveMessage(ctx context.Context) (*models.Message, error)
	GetDeliveryStatus(ctx context.Context, messageID string) (models.MessageStatus, error)
	Name() string
}
