package service

import (
	"context"
	"fmt"
	"native-mobile-ios/internal/models"
	"native-mobile-ios/internal/repository"
	"time"
)

type MobileService struct{ repo *repository.MobileRepository }
func NewMobileService(repo *repository.MobileRepository) *MobileService { return &MobileService{repo: repo} }

func (s *MobileService) RegisterUser(ctx context.Context, req RegisterUserRequest) (*models.MobileUser, error) {
	user := &models.MobileUser{
		UserRef: fmt.Sprintf("USR-%d", time.Now().UnixNano()%1000000),
		FirstName: req.FirstName, LastName: req.LastName, Email: req.Email, Phone: req.Phone,
		BVN: req.BVN, DeviceType: "ios", DeviceModel: req.DeviceModel,
		OSVersion: req.OSVersion, AppVersion: req.AppVersion, PushToken: req.PushToken,
	}
	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to register user: %w", err)
	}
	s.repo.CreateNotification(ctx, &models.PushNotification{
		UserRef: user.UserRef, Title: "Welcome!", Body: "Your insurance account is ready.",
		Type: "general",
	})
	return user, nil
}

func (s *MobileService) GetProfile(ctx context.Context, userRef string) (*models.MobileUser, error) {
	user, err := s.repo.GetUser(ctx, userRef)
	if err != nil { return nil, fmt.Errorf("user not found") }
	now := time.Now(); user.LastActiveAt = &now
	s.repo.UpdateUser(ctx, user)
	return user, nil
}

func (s *MobileService) UpdatePreferences(ctx context.Context, userRef string, req UpdatePrefsRequest) error {
	user, err := s.repo.GetUser(ctx, userRef)
	if err != nil { return fmt.Errorf("user not found") }
	if req.BiometricEnabled != nil { user.BiometricEnabled = *req.BiometricEnabled }
	if req.NotificationPrefs != nil { user.NotificationPrefs = req.NotificationPrefs }
	if req.PushToken != "" { user.PushToken = req.PushToken }
	return s.repo.UpdateUser(ctx, user)
}

func (s *MobileService) GetPolicies(ctx context.Context, userRef string) ([]models.MobilePolicy, error) {
	return s.repo.GetPolicies(ctx, userRef)
}

func (s *MobileService) SubmitClaim(ctx context.Context, req SubmitClaimRequest) (*models.MobileClaim, error) {
	claim := &models.MobileClaim{
		ClaimRef: fmt.Sprintf("CLM-%d", time.Now().UnixNano()%1000000),
		UserRef: req.UserRef, PolicyNumber: req.PolicyNumber, ClaimType: req.ClaimType,
		Description: req.Description, AmountClaimed: req.AmountClaimed,
		Documents: req.Documents, Status: "submitted",
	}
	if err := s.repo.CreateClaim(ctx, claim); err != nil {
		return nil, fmt.Errorf("failed to submit claim: %w", err)
	}
	s.repo.CreateNotification(ctx, &models.PushNotification{
		UserRef: req.UserRef, Title: "Claim Submitted",
		Body: fmt.Sprintf("Your claim %s has been submitted successfully.", claim.ClaimRef),
		Type: "claim_update",
	})
	return claim, nil
}

func (s *MobileService) GetClaims(ctx context.Context, userRef string) ([]models.MobileClaim, error) {
	return s.repo.GetClaims(ctx, userRef)
}

func (s *MobileService) MakePayment(ctx context.Context, req MakePaymentRequest) (*models.MobilePayment, error) {
	payment := &models.MobilePayment{
		UserRef: req.UserRef, PolicyNumber: req.PolicyNumber, Amount: req.Amount,
		PaymentMethod: req.PaymentMethod, TransactionRef: req.TransactionRef,
		Status: "pending",
	}
	if err := s.repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to process payment: %w", err)
	}
	now := time.Now(); payment.Status = "successful"; payment.PaidAt = &now
	s.repo.CreateNotification(ctx, &models.PushNotification{
		UserRef: req.UserRef, Title: "Payment Successful",
		Body: fmt.Sprintf("Payment of NGN %.2f for policy %s received.", req.Amount, req.PolicyNumber),
		Type: "payment_due",
	})
	return payment, nil
}

func (s *MobileService) GetPayments(ctx context.Context, userRef string) ([]models.MobilePayment, error) {
	return s.repo.GetPayments(ctx, userRef)
}

func (s *MobileService) GetNotifications(ctx context.Context, userRef string, unreadOnly bool) ([]models.PushNotification, error) {
	return s.repo.GetNotifications(ctx, userRef, unreadOnly)
}

func (s *MobileService) MarkNotificationRead(ctx context.Context, userRef, notifID string) error {
	notifications, _ := s.repo.GetNotifications(ctx, userRef, false)
	for _, n := range notifications {
		if n.ID.String() == notifID { return s.repo.MarkNotificationRead(ctx, n.ID) }
	}
	return fmt.Errorf("notification not found")
}
