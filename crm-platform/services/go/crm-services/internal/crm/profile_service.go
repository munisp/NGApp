//go:build ignore

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
	pb "github.com/banking-crm-integration/proto/crm"
	"github.com/golang/protobuf/ptypes"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// CRMProfileService implements the CRM profile service
type CRMProfileService struct {
	logger         *zap.Logger
	redisClient    *redis.Client
	profileStore   ProfileStore
	authService    AuthService
	subscribers    map[string]map[string]chan *models.CustomerProfileUpdate
	subscribersMu  sync.RWMutex
}

// ProfileStore defines the interface for profile storage
type ProfileStore interface {
	StoreProfileUpdate(ctx context.Context, update *models.CustomerProfileUpdate) error
	GetProfileUpdates(ctx context.Context, customerIDs []string, updateTypes []string, startTime time.Time) ([]*models.CustomerProfileUpdate, error)
	GetCustomerProfile(ctx context.Context, customerID string) (*models.CustomerProfile, error)
}

// NewCRMProfileService creates a new CRM profile service
func NewCRMProfileService(logger *zap.Logger, redisClient *redis.Client, profileStore ProfileStore, authService AuthService) *CRMProfileService {
	return &CRMProfileService{
		logger:         logger,
		redisClient:    redisClient,
		profileStore:   profileStore,
		authService:    authService,
		subscribers:    make(map[string]map[string]chan *models.CustomerProfileUpdate),
	}
}

// StreamCustomerProfileUpdates streams customer profile updates to the client
func (s *CRMProfileService) StreamCustomerProfileUpdates(req *pb.ProfileUpdateRequest, stream pb.CustomerProfileService_StreamCustomerProfileUpdatesServer) error {
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
	hasPermission, err := s.authService.HasPermission(ctx, userID, "customer_profiles", "read")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !hasPermission {
		return status.Errorf(codes.PermissionDenied, "no permission to read customer profiles")
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
	
	// Get historical updates
	updates, err := s.profileStore.GetProfileUpdates(ctx, req.CustomerIds, req.UpdateTypes, startTime)
	if err != nil {
		s.logger.Error("Failed to get profile updates", zap.Error(err))
		return status.Errorf(codes.Internal, "failed to get profile updates: %v", err)
	}
	
	// Send historical updates
	for _, update := range updates {
		pbUpdate, err := s.convertProfileUpdateToProto(update)
		if err != nil {
			s.logger.Error("Failed to convert profile update to proto", zap.Error(err))
			continue
		}
		
		if err := stream.Send(pbUpdate); err != nil {
			s.logger.Error("Failed to send profile update", zap.Error(err))
			return status.Errorf(codes.Internal, "failed to send update: %v", err)
		}
	}
	
	// Subscribe to new updates
	subscriberID := uuid.New().String()
	updateChan := make(chan *models.CustomerProfileUpdate, 100)
	
	s.subscribersMu.Lock()
	if _, ok := s.subscribers[req.CrmId]; !ok {
		s.subscribers[req.CrmId] = make(map[string]chan *models.CustomerProfileUpdate)
	}
	s.subscribers[req.CrmId][subscriberID] = updateChan
	s.subscribersMu.Unlock()
	
	// Cleanup on exit
	defer func() {
		s.subscribersMu.Lock()
		if subs, ok := s.subscribers[req.CrmId]; ok {
			delete(subs, subscriberID)
			if len(subs) == 0 {
				delete(s.subscribers, req.CrmId)
			}
		}
		s.subscribersMu.Unlock()
		close(updateChan)
	}()
	
	// Stream new updates
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case update := <-updateChan:
			// Filter by customer ID if specified
			if len(req.CustomerIds) > 0 {
				found := false
				for _, id := range req.CustomerIds {
					if id == update.CustomerID {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			// Filter by update type if specified
			if len(req.UpdateTypes) > 0 {
				found := false
				for _, t := range req.UpdateTypes {
					if t == string(update.Type) {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			
			pbUpdate, err := s.convertProfileUpdateToProto(update)
			if err != nil {
				s.logger.Error("Failed to convert profile update to proto", zap.Error(err))
				continue
			}
			
			if err := stream.Send(pbUpdate); err != nil {
				s.logger.Error("Failed to send profile update", zap.Error(err))
				return status.Errorf(codes.Internal, "failed to send update: %v", err)
			}
		}
	}
}

// BatchCustomerProfileUpdates processes a batch of customer profile updates
func (s *CRMProfileService) BatchCustomerProfileUpdates(ctx context.Context, req *pb.BatchProfileUpdateRequest) (*pb.BatchProfileUpdateResponse, error) {
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
	hasPermission, err := s.authService.HasPermission(ctx, userID, "customer_profiles", "write")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !hasPermission {
		return nil, status.Errorf(codes.PermissionDenied, "no permission to write customer profiles")
	}
	
	response := &pb.BatchProfileUpdateResponse{
		Success:       true,
		ProcessedCount: 0,
		FailedCount:   0,
		FailedUpdates: make(map[string]string),
		RequestId:     req.RequestId,
	}
	
	// Process each update
	for _, pbUpdate := range req.Updates {
		update, err := s.convertProtoToProfileUpdate(pbUpdate)
		if err != nil {
			s.logger.Error("Failed to convert proto to profile update", zap.Error(err))
			response.FailedCount++
			response.FailedUpdates[pbUpdate.UpdateId] = fmt.Sprintf("failed to convert update: %v", err)
			continue
		}
		
		// Store the update
		if err := s.profileStore.StoreProfileUpdate(ctx, update); err != nil {
			s.logger.Error("Failed to store profile update", zap.Error(err))
			response.FailedCount++
			response.FailedUpdates[pbUpdate.UpdateId] = fmt.Sprintf("failed to store update: %v", err)
			continue
		}
		
		// Publish the update to subscribers
		s.publishProfileUpdate(update)
		
		response.ProcessedCount++
	}
	
	if response.FailedCount > 0 {
		response.Success = false
		response.ErrorMessage = fmt.Sprintf("failed to process %d updates", response.FailedCount)
	}
	
	return response, nil
}

// AcknowledgeUpdate acknowledges receipt of an update
func (s *CRMProfileService) AcknowledgeUpdate(ctx context.Context, req *pb.UpdateAcknowledgement) (*pb.AcknowledgementResponse, error) {
	// Store acknowledgement in Redis with TTL
	key := fmt.Sprintf("ack:%s", req.UpdateId)
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

// GetCustomerProfile gets a customer profile by ID
func (s *CRMProfileService) GetCustomerProfile(ctx context.Context, req *pb.CustomerProfileRequest) (*pb.CustomerProfile, error) {
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
	hasPermission, err := s.authService.HasPermission(ctx, userID, "customer_profiles", "read")
	if err != nil {
		s.logger.Error("Failed to check permissions", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to check permissions")
	}
	if !hasPermission {
		return nil, status.Errorf(codes.PermissionDenied, "no permission to read customer profiles")
	}
	
	// Get the profile
	profile, err := s.profileStore.GetCustomerProfile(ctx, req.CustomerId)
	if err != nil {
		s.logger.Error("Failed to get customer profile", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to get customer profile: %v", err)
	}
	
	if profile == nil {
		return nil, status.Errorf(codes.NotFound, "customer profile not found")
	}
	
	// Convert to proto
	pbProfile, err := s.convertProfileToProto(profile)
	if err != nil {
		s.logger.Error("Failed to convert profile to proto", zap.Error(err))
		return nil, status.Errorf(codes.Internal, "failed to convert profile: %v", err)
	}
	
	return pbProfile, nil
}

// Helper functions for converting between models and protos

func (s *CRMProfileService) convertProfileUpdateToProto(update *models.CustomerProfileUpdate) (*pb.CustomerProfileUpdate, error) {
	ts, err := ptypes.TimestampProto(update.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to convert timestamp: %v", err)
	}
	
	var pbProfile *pb.CustomerProfile
	if update.Profile != nil {
		pbProfile, err = s.convertProfileToProto(update.Profile)
		if err != nil {
			return nil, fmt.Errorf("failed to convert profile: %v", err)
		}
	}
	
	return &pb.CustomerProfileUpdate{
		UpdateId:      update.ID,
		CustomerId:    update.CustomerID,
		UpdateType:    string(update.Type),
		Timestamp:     ts,
		UpdatedFields: update.UpdatedFields,
		Profile:       pbProfile,
		CrmId:         update.CRMID,
		Version:       update.Version,
		CorrelationId: update.CorrelationID,
	}, nil
}

func (s *CRMProfileService) convertProtoToProfileUpdate(pbUpdate *pb.CustomerProfileUpdate) (*models.CustomerProfileUpdate, error) {
	ts, err := ptypes.Timestamp(pbUpdate.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to convert timestamp: %v", err)
	}
	
	var profile *models.CustomerProfile
	if pbUpdate.Profile != nil {
		profile, err = s.convertProtoToProfile(pbUpdate.Profile)
		if err != nil {
			return nil, fmt.Errorf("failed to convert profile: %v", err)
		}
	}
	
	return &models.CustomerProfileUpdate{
		ID:            pbUpdate.UpdateId,
		CustomerID:    pbUpdate.CustomerId,
		Type:          models.UpdateType(pbUpdate.UpdateType),
		Timestamp:     ts,
		UpdatedFields: pbUpdate.UpdatedFields,
		Profile:       profile,
		CRMID:         pbUpdate.CrmId,
		Version:       pbUpdate.Version,
		CorrelationID: pbUpdate.CorrelationId,
	}, nil
}

func (s *CRMProfileService) convertProfileToProto(profile *models.CustomerProfile) (*pb.CustomerProfile, error) {
	customerSince, err := ptypes.TimestampProto(profile.CustomerSince)
	if err != nil {
		return nil, fmt.Errorf("failed to convert customer_since timestamp: %v", err)
	}
	
	lastUpdated, err := ptypes.TimestampProto(profile.LastUpdated)
	if err != nil {
		return nil, fmt.Errorf("failed to convert last_updated timestamp: %v", err)
	}
	
	dataStruct, err := structFromMap(profile.AdditionalData)
	if err != nil {
		return nil, fmt.Errorf("failed to convert additional_data: %v", err)
	}
	
	var personalInfo *pb.PersonalInfo
	if profile.PersonalInfo != nil {
		var documents []*pb.IdentificationDocument
		for _, doc := range profile.PersonalInfo.Documents {
			documents = append(documents, &pb.IdentificationDocument{
				Type:              doc.Type,
				Number:            doc.Number,
				IssuingCountry:    doc.IssuingCountry,
				IssueDate:         doc.IssueDate,
				ExpiryDate:        doc.ExpiryDate,
				VerificationStatus: doc.VerificationStatus,
			})
		}
		
		personalInfo = &pb.PersonalInfo{
			FirstName:   profile.PersonalInfo.FirstName,
			LastName:    profile.PersonalInfo.LastName,
			DateOfBirth: profile.PersonalInfo.DateOfBirth,
			Gender:      profile.PersonalInfo.Gender,
			Nationality: profile.PersonalInfo.Nationality,
			Documents:   documents,
		}
	}
	
	var contactInfo *pb.ContactInfo
	if profile.ContactInfo != nil {
		var address *pb.Address
		if profile.ContactInfo.Address != nil {
			address = &pb.Address{
				Street:            profile.ContactInfo.Address.Street,
				City:              profile.ContactInfo.Address.City,
				State:             profile.ContactInfo.Address.State,
				PostalCode:        profile.ContactInfo.Address.PostalCode,
				Country:           profile.ContactInfo.Address.Country,
				Type:              profile.ContactInfo.Address.Type,
				VerificationStatus: profile.ContactInfo.Address.VerificationStatus,
			}
		}
		
		contactInfo = &pb.ContactInfo{
			Email:                 profile.ContactInfo.Email,
			Phone:                 profile.ContactInfo.Phone,
			Address:               address,
			PreferredContactMethod: profile.ContactInfo.PreferredContactMethod,
			ContactTimePreference:  profile.ContactInfo.ContactTimePreference,
		}
	}
	
	var preferences *pb.CustomerPreferences
	if profile.Preferences != nil {
		var communication *pb.CommunicationPreferences
		if profile.Preferences.Communication != nil {
			communication = &pb.CommunicationPreferences{
				EmailEnabled: profile.Preferences.Communication.EmailEnabled,
				SmsEnabled:   profile.Preferences.Communication.SMSEnabled,
				PushEnabled:  profile.Preferences.Communication.PushEnabled,
				PhoneEnabled: profile.Preferences.Communication.PhoneEnabled,
				MailEnabled:  profile.Preferences.Communication.MailEnabled,
				Frequency:    profile.Preferences.Communication.Frequency,
			}
		}
		
		preferences = &pb.CustomerPreferences{
			Language:           profile.Preferences.Language,
			Communication:      communication,
			ProductInterests:   profile.Preferences.ProductInterests,
			ChannelPreferences: profile.Preferences.ChannelPreferences,
			MarketingConsent:   profile.Preferences.MarketingConsent,
			DataSharingConsent: profile.Preferences.DataSharingConsent,
		}
	}
	
	return &pb.CustomerProfile{
		CustomerId:    profile.CustomerID,
		PersonalInfo:  personalInfo,
		ContactInfo:   contactInfo,
		Preferences:   preferences,
		KycStatus:     profile.KYCStatus,
		Segment:       profile.Segment,
		LifetimeValue: profile.LifetimeValue,
		CustomerSince: customerSince,
		LastUpdated:   lastUpdated,
		Data:          dataStruct,
	}, nil
}

func (s *CRMProfileService) convertProtoToProfile(pbProfile *pb.CustomerProfile) (*models.CustomerProfile, error) {
	customerSince, err := ptypes.Timestamp(pbProfile.CustomerSince)
	if err != nil {
		return nil, fmt.Errorf("failed to convert customer_since timestamp: %v", err)
	}
	
	lastUpdated, err := ptypes.Timestamp(pbProfile.LastUpdated)
	if err != nil {
		return nil, fmt.Errorf("failed to convert last_updated timestamp: %v", err)
	}
	
	additionalData, err := mapFromStruct(pbProfile.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to convert data: %v", err)
	}
	
	var personalInfo *models.PersonalInfo
	if pbProfile.PersonalInfo != nil {
		var documents []*models.IdentificationDocument
		for _, doc := range pbProfile.PersonalInfo.Documents {
			documents = append(documents, &models.IdentificationDocument{
				Type:              doc.Type,
				Number:            doc.Number,
				IssuingCountry:    doc.IssuingCountry,
				IssueDate:         doc.IssueDate,
				ExpiryDate:        doc.ExpiryDate,
				VerificationStatus: doc.VerificationStatus,
			})
		}
		
		personalInfo = &models.PersonalInfo{
			FirstName:   pbProfile.PersonalInfo.FirstName,
			LastName:    pbProfile.PersonalInfo.LastName,
			DateOfBirth: pbProfile.PersonalInfo.DateOfBirth,
			Gender:      pbProfile.PersonalInfo.Gender,
			Nationality: pbProfile.PersonalInfo.Nationality,
			Documents:   documents,
		}
	}
	
	var contactInfo *models.ContactInfo
	if pbProfile.ContactInfo != nil {
		var address *models.Address
		if pbProfile.ContactInfo.Address != nil {
			address = &models.Address{
				Street:            pbProfile.ContactInfo.Address.Street,
				City:              pbProfile.ContactInfo.Address.City,
				State:             pbProfile.ContactInfo.Address.State,
				PostalCode:        pbProfile.ContactInfo.Address.PostalCode,
				Country:           pbProfile.ContactInfo.Address.Country,
				Type:              pbProfile.ContactInfo.Address.Type,
				VerificationStatus: pbProfile.ContactInfo.Address.VerificationStatus,
			}
		}
		
		contactInfo = &models.ContactInfo{
			Email:                 pbProfile.ContactInfo.Email,
			Phone:                 pbProfile.ContactInfo.Phone,
			Address:               address,
			PreferredContactMethod: pbProfile.ContactInfo.PreferredContactMethod,
			ContactTimePreference:  pbProfile.ContactInfo.ContactTimePreference,
		}
	}
	
	var preferences *models.CustomerPreferences
	if pbProfile.Preferences != nil {
		var communication *models.CommunicationPreferences
		if pbProfile.Preferences.Communication != nil {
			communication = &models.CommunicationPreferences{
				EmailEnabled: pbProfile.Preferences.Communication.EmailEnabled,
				SMSEnabled:   pbProfile.Preferences.Communication.SmsEnabled,
				PushEnabled:  pbProfile.Preferences.Communication.PushEnabled,
				PhoneEnabled: pbProfile.Preferences.Communication.PhoneEnabled,
				MailEnabled:  pbProfile.Preferences.Communication.MailEnabled,
				Frequency:    pbProfile.Preferences.Communication.Frequency,
			}
		}
		
		preferences = &models.CustomerPreferences{
			Language:           pbProfile.Preferences.Language,
			Communication:      communication,
			ProductInterests:   pbProfile.Preferences.ProductInterests,
			ChannelPreferences: pbProfile.Preferences.ChannelPreferences,
			MarketingConsent:   pbProfile.Preferences.MarketingConsent,
			DataSharingConsent: pbProfile.Preferences.DataSharingConsent,
		}
	}
	
	return &models.CustomerProfile{
		CustomerID:     pbProfile.CustomerId,
		PersonalInfo:   personalInfo,
		ContactInfo:    contactInfo,
		Preferences:    preferences,
		KYCStatus:      pbProfile.KycStatus,
		Segment:        pbProfile.Segment,
		LifetimeValue:  pbProfile.LifetimeValue,
		CustomerSince:  customerSince,
		LastUpdated:    lastUpdated,
		AdditionalData: additionalData,
	}, nil
}

// Helper function for publishing updates

func (s *CRMProfileService) publishProfileUpdate(update *models.CustomerProfileUpdate) {
	s.subscribersMu.RLock()
	defer s.subscribersMu.RUnlock()
	
	// Publish to CRM-specific subscribers
	if subs, ok := s.subscribers[update.CRMID]; ok {
		for _, ch := range subs {
			select {
			case ch <- update:
				// Update sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Subscriber channel is full, dropping profile update",
					zap.String("update_id", update.ID),
					zap.String("crm_id", update.CRMID))
			}
		}
	}
	
	// Publish to wildcard subscribers (empty CRM ID)
	if subs, ok := s.subscribers[""]; ok {
		for _, ch := range subs {
			select {
			case ch <- update:
				// Update sent successfully
			default:
				// Channel buffer is full, log and continue
				s.logger.Warn("Wildcard subscriber channel is full, dropping profile update",
					zap.String("update_id", update.ID))
			}
		}
	}
}

