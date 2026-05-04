package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/banking-crm-integration/go/models"
	pb "github.com/banking-crm-integration/proto/banking"
	"github.com/golang/protobuf/ptypes"
	"github.com/golang/protobuf/ptypes/timestamp"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// BankingEventService implements the banking event service
type BankingEventService struct {
	logger         *zap.Logger
	redisClient    *redis.Client
	eventStore     EventStore
	authService    AuthService
	subscribers    map[string]map[string]chan *models.CustomerEvent
	subscribersMu  sync.RWMutex
	txSubscribers  map[string]map[string]chan *models.TransactionEvent
	txSubscribersMu sync.RWMutex
	acctSubscribers map[string]map[string]chan *models.AccountEvent
	acctSubscribersMu sync.RWMutex
}

// EventStore defines the interface for event storage
type EventStore interface {
	StoreCustomerEvent(ctx context.Context, event *models.CustomerEvent) error
	StoreTransactionEvent(ctx context.Context, event *models.TransactionEvent) error
	StoreAccountEvent(ctx context.Context, event *models.AccountEvent) error
	GetCustomerEvents(ctx context.Context, customerIDs []string, eventTypes []string, startTime time.Time) ([]*models.CustomerEvent, error)
	GetTransactionEvents(ctx context.Context, customerIDs []string, eventTypes []string, startTime time.Time) ([]*models.TransactionEvent, error)
	GetAccountEvents(ctx context.Context, customerIDs []string, eventTypes []string, startTime time.Time) ([]*models.AccountEvent, error)
}

// AuthService defines the interface for authentication
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (bool, string, error)
	HasPermission(ctx context.Context, userID, resource, action string) (bool, error)
}

// NewBankingEventService creates a new banking event service
func NewBankingEventService(logger *zap.Logger, redisClient *redis.Client, eventStore EventStore, authService AuthService) *BankingEventService {
	return &BankingEventService{
		logger:         logger,
		redisClient:    redisClient,
		eventStore:     eventStore,
		authService:    authService,
		subscribers:    make(map[string]map[string]chan *models.CustomerEvent),
		txSubscribers:  make(map[string]map[string]chan *models.TransactionEvent),
		acctSubscribers: make(map[string]map[string]chan *models.AccountEvent),
	}
}

// StreamCustomerEvents streams customer events to the client
func (s *BankingEventService) StreamCustomerEvents(req *pb.CustomerEventRequest, stream pb.CustomerEventService_StreamCustomerEventsServer) error {
	ctx := stream.Context()
	
	// Validate authentication token
	valid, userID, err := s.authService.ValidateToken(ctx, req.AuthToken)
	if err != nil {
		s.logger.Error("Failed to validate token", zap.Error(err))
		return status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	if !valid {
		return status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	
	// Check permissions
	hasPermission, err := s.authService.HasPermission(ctx, userID, "customer_events", "read")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !hasPermission {
		return status.Errorf(codes.PermissionDenied, "no permission to read customer events")
	}
	
	// Parse start time
	var startTime time.Time
	if req.StartTime != nil {
		startTime, err = ptypes.Timestamp(req.StartTime)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid start time: %v", err)
		}
	} else {
		startTime = time.Now().Add(-1 * time.Hour) // Default to 1 hour ago
	}
	
	// Get historical events
	events, err := s.eventStore.GetCustomerEvents(ctx, req.CustomerIds, req.EventTypes, startTime)
	if err != nil {
		s.logger.Error("Failed to get customer events", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to get customer events: %v", err)
	}
	
	// Send historical events
	for _, event := range events {
		pbEvent, err := s.convertCustomerEventToProto(event)
		if err != nil {
			s.logger.Error("Failed to convert customer event to proto", zap.Error(err))
			continue
		}
		
		if err := stream.Send(pbEvent); err != nil {
			s.logger.Error("Failed to send customer event", zap.Error(err))
			return status.Errorf(codes.Internal, "failed to send event: %v", err)
		}
	}
	
	// Subscribe to new events
	subscriberID := uuid.New().String()
	eventChan := make(chan *models.CustomerEvent, 100)
	
	s.subscribersMu.Lock()
	if _, ok := s.subscribers[req.PlatformId]; !ok {
		s.subscribers[req.PlatformId] = make(map[string]chan *models.CustomerEvent)
	}
	s.subscribers[req.PlatformId][subscriberID] = eventChan
	s.subscribersMu.Unlock()
	
	// Cleanup on exit
	defer func() {
		s.subscribersMu.Lock()
		if subs, ok := s.subscribers[req.PlatformId]; ok {
			delete(subs, subscriberID)
			if len(subs) == 0 {
				delete(s.subscribers, req.PlatformId)
			}
		}
		s.subscribersMu.Unlock()
		close(eventChan)
	}()
	
	// Stream new events
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-eventChan:
			// Filter by customer ID if specified
			if len(req.CustomerIds) > 0 {
				found := false
				for _, id := range req.CustomerIds {
					if id == event.CustomerID {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			// Filter by event type if specified
			if len(req.EventTypes) > 0 {
				found := false
				for _, t := range req.EventTypes {
					if t == string(event.Type) {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			pbEvent, err := s.convertCustomerEventToProto(event)
			if err != nil {
				s.logger.Error("Failed to convert customer event to proto", zap.Error(err))
				continue
			}
			
			if err := stream.Send(pbEvent); err != nil {
				s.logger.Error("Failed to send customer event", zap.Error(err))
				return status.Errorf(codes.Internal, "failed to send event: %v", err)
			}
		}
	}
}

// BatchCustomerEvents processes a batch of customer events
func (s *BankingEventService) BatchCustomerEvents(ctx context.Context, req *pb.BatchCustomerEventRequest) (*pb.BatchCustomerEventResponse, error) {
	// Validate authentication token
	valid, userID, err := s.authService.ValidateToken(ctx, req.AuthToken)
	if err != nil {
		s.logger.Error("Failed to validate token", zap.Error(err))
		return nil, status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	if !valid {
		return nil, status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	
	// Check permissions
	hasPermission, err := s.authService.HasPermission(ctx, userID, "customer_events", "write")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !valid {
		return nil, status.Errorf(codes.PermissionDenied, "no permission to write customer events")
	}
	
	response := &pb.BatchCustomerEventResponse{
		Success:       true,
		ProcessedCount: 0,
		FailedCount:   0,
		FailedEvents:  make(map[string]string),
		RequestId:     req.RequestId,
	}
	
	// Process each event
	for _, pbEvent := range req.Events {
		event, err := s.convertProtoToCustomerEvent(pbEvent)
		if err != nil {
			s.logger.Error("Failed to convert proto to customer event", zap.Error(err))
			response.FailedCount++
			response.FailedEvents[pbEvent.EventId] = fmt.Sprintf("failed to convert event: %v", err)
			continue
		}
		
		// Store the event
		if err := s.eventStore.StoreCustomerEvent(ctx, event); err != nil {
			s.logger.Error("Failed to store customer event", zap.Error(err))
			response.FailedCount++
			response.FailedEvents[pbEvent.EventId] = fmt.Sprintf("failed to store event: %v", err)
			continue
		}
		
		// Publish the event to subscribers
		s.publishCustomerEvent(event)
		
		response.ProcessedCount++
	}
	
	if response.FailedCount > 0 {
		response.Success = false
		response.ErrorMessage = fmt.Sprintf("failed to process %d events", response.FailedCount)
	}
	
	return response, nil
}

// AcknowledgeEvent acknowledges receipt of an event
func (s *BankingEventService) AcknowledgeEvent(ctx context.Context, req *pb.EventAcknowledgement) (*pb.AcknowledgementResponse, error) {
	// Store acknowledgement in Redis with TTL
	key := fmt.Sprintf("ack:%s", req.EventId)
	value, err := json.Marshal(req)
	if err != nil {
		s.logger.Error("Failed to marshal acknowledgement", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to process acknowledgement")
	}
	
	if err := s.redisClient.Set(ctx, key, value, 24*time.Hour).Err(); err != nil {
		s.logger.Error("Failed to store acknowledgement", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to store acknowledgement")
	}
	
	return &pb.AcknowledgementResponse{
		Success: true,
	}, nil
}

// StreamTransactionEvents streams transaction events to the client
func (s *BankingEventService) StreamTransactionEvents(req *pb.TransactionEventRequest, stream pb.TransactionEventService_StreamTransactionEventsServer) error {
	ctx := stream.Context()
	
	// Validate authentication token
	valid, userID, err := s.authService.ValidateToken(ctx, req.AuthToken)
	if err != nil {
		s.logger.Error("Failed to validate token", zap.Error(err))
		return status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	if !valid {
		return status.Errorf(codes.Unauthenticated, "invalid authentication token")
	}
	
	// Check permissions
	hasPermission, err := s.authService.HasPermission(ctx, userID, "transaction_events", "read")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !hasPermission {
		return status.Errorf(codes.PermissionDenied, "no permission to read transaction events")
	}
	
	// Parse start time
	var startTime time.Time
	if req.StartTime != nil {
		startTime, err = ptypes.Timestamp(req.StartTime)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid start time: %v", err)
		}
	} else {
		startTime = time.Now().Add(-1 * time.Hour) // Default to 1 hour ago
	}
	
	// Get historical events
	events, err := s.eventStore.GetTransactionEvents(ctx, req.CustomerIds, req.EventTypes, startTime)
	if err != nil {
		s.logger.Error("Failed to get transaction events", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to get transaction events: %v", err)
	}
	
	// Send historical events
	for _, event := range events {
		pbEvent, err := s.convertTransactionEventToProto(event)
		if err != nil {
			s.logger.Error("Failed to convert transaction event to proto", zap.Error(err))
			continue
		}
		
		if err := stream.Send(pbEvent); err != nil {
			s.logger.Error("Failed to send transaction event", zap.Error(err))
			return status.Errorf(codes.Internal, "failed to send event: %v", err)
		}
	}
	
	// Subscribe to new events
	subscriberID := uuid.New().String()
	eventChan := make(chan *models.TransactionEvent, 100)
	
	s.txSubscribersMu.Lock()
	if _, ok := s.txSubscribers[req.PlatformId]; !ok {
		s.txSubscribers[req.PlatformId] = make(map[string]chan *models.TransactionEvent)
	}
	s.txSubscribers[req.PlatformId][subscriberID] = eventChan
	s.txSubscribersMu.Unlock()
	
	// Cleanup on exit
	defer func() {
		s.txSubscribersMu.Lock()
		if subs, ok := s.txSubscribers[req.PlatformId]; ok {
			delete(subs, subscriberID)
			if len(subs) == 0 {
				delete(s.txSubscribers, req.PlatformId)
			}
		}
		s.txSubscribersMu.Unlock()
		close(eventChan)
	}()
	
	// Stream new events
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-eventChan:
			// Filter by customer ID if specified
			if len(req.CustomerIds) > 0 {
				found := false
				for _, id := range req.CustomerIds {
					if id == event.CustomerID {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			// Filter by event type if specified
			if len(req.EventTypes) > 0 {
				found := false
				for _, t := range req.EventTypes {
					if t == string(event.Type) {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			pbEvent, err := s.convertTransactionEventToProto(event)
			if err != nil {
				s.logger.Error("Failed to convert transaction event to proto", zap.Error(err))
				continue
			}
			
			if err := stream.Send(pbEvent); err != nil {
				s.logger.Error("Failed to send transaction event", zap.Error(err))
				return status.Errorf(codes.Internal, "failed to send event: %v", err)
			}
		}
	}
}

// Helper functions for converting between models and protos

func (s *BankingEventService) convertCustomerEventToProto(event *models.CustomerEvent) (*pb.CustomerEvent, error) {
	ts, err := ptypes.TimestampProto(event.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to convert timestamp: %v", err)
	}
	
	dataStruct, err := structFromMap(event.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to convert data: %v", err)
	}
	
	return &pb.CustomerEvent{
		EventId:      event.ID,
		CustomerId:   event.CustomerID,
		EventType:    string(event.Type),
		Timestamp:    ts,
		Data:         dataStruct,
		PlatformId:   event.PlatformID,
		Version:      event.Version,
		CorrelationId: event.CorrelationID,
	}, nil
}

func (s *BankingEventService) convertProtoToCustomerEvent(pbEvent *pb.CustomerEvent) (*models.CustomerEvent, error) {
	ts, err := ptypes.Timestamp(pbEvent.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to convert timestamp: %v", err)
	}
	
	data, err := mapFromStruct(pbEvent.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to convert data: %v", err)
	}
	
	return &models.CustomerEvent{
		ID:            pbEvent.EventId,
		CustomerID:    pbEvent.CustomerId,
		Type:          models.EventType(pbEvent.EventType),
		Timestamp:     ts,
		Data:          data,
		PlatformID:    pbEvent.PlatformId,
		Version:       pbEvent.Version,
		CorrelationID: pbEvent.CorrelationId,
	}, nil
}

func (s *BankingEventService) convertTransactionEventToProto(event *models.TransactionEvent) (*pb.TransactionEvent, error) {
	ts, err := ptypes.TimestampProto(event.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to convert timestamp: %v", err)
	}
	
	dataStruct, err := structFromMap(event.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to convert data: %v", err)
	}
	
	var merchant *pb.MerchantInfo
	if event.Merchant != nil {
		merchant = &pb.MerchantInfo{
			MerchantId:   event.Merchant.MerchantID,
			Name:         event.Merchant.Name,
			CategoryCode: event.Merchant.CategoryCode,
			Location:     event.Merchant.Location,
		}
	}
	
	return &pb.TransactionEvent{
		EventId:        event.ID,
		TransactionId:  event.TransactionID,
		CustomerId:     event.CustomerID,
		EventType:      string(event.Type),
		Timestamp:      ts,
		Amount:         event.Amount,
		Currency:       event.Currency,
		Status:         event.Status,
		TransactionType: event.TransactionType,
		Merchant:       merchant,
		Data:           dataStruct,
		PlatformId:     event.PlatformID,
		Version:        event.Version,
		CorrelationId:  event.CorrelationID,
	}, nil
}

// Helper functions for publishing events

func (s *BankingEventService) publishCustomerEvent(event *models.CustomerEvent) {
	s.subscribersMu.RLock()
	defer s.subscribersMu.RUnlock()
	
	// Publish to platform-specific subscribers
	if subs, ok := s.subscribers[event.PlatformID]; ok {
		for _, ch := range subs {
			select {
			case ch <- event:
				// Event sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Subscriber channel is full, dropping event",
					zap.String("event_id", event.ID),
					zap.String("platform_id", event.PlatformID))
			}
		}
	}
	
	// Publish to wildcard subscribers (empty platform ID)
	if subs, ok := s.subscribers[""]; ok {
		for _, ch := range subs {
			select {
			case ch <- event:
				// Event sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Wildcard subscriber channel is full, dropping event",
					zap.String("event_id", event.ID))
			}
		}
	}
}

func (s *BankingEventService) publishTransactionEvent(event *models.TransactionEvent) {
	s.txSubscribersMu.RLock()
	defer s.txSubscribersMu.RUnlock()
	
	// Publish to platform-specific subscribers
	if subs, ok := s.txSubscribers[event.PlatformID]; ok {
		for _, ch := range subs {
			select {
			case ch <- event:
				// Event sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Subscriber channel is full, dropping transaction event",
					zap.String("event_id", event.ID),
					zap.String("platform_id", event.PlatformID))
			}
		}
	}
	
	// Publish to wildcard subscribers (empty platform ID)
	if subs, ok := s.txSubscribers[""]; ok {
		for _, ch := range subs {
			select {
			case ch <- event:
				// Event sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Wildcard subscriber channel is full, dropping transaction event",
					zap.String("event_id", event.ID))
			}
		}
	}
}

// Helper functions for struct conversion

func structFromMap(m map[string]interface{}) (*pb.Struct, error) {
	if m == nil {
		return nil, nil
	}
	
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	
	pbStruct := &pb.Struct{}
	if err := json.Unmarshal(jsonBytes, pbStruct); err != nil {
		return nil, err
	}
	
	return pbStruct, nil
}

func mapFromStruct(s *pb.Struct) (map[string]interface{}, error) {
	if s == nil {
		return nil, nil
	}
	
	jsonBytes, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	
	var m map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &m); err != nil {
		return nil, err
	}
	
	return m, nil
}

// Helper function to convert Go time.Time to protobuf Timestamp
func timeToProtoTimestamp(t time.Time) (*timestamp.Timestamp, error) {
	return ptypes.TimestampProto(t)
}

