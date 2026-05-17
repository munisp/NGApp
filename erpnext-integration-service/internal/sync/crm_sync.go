package sync

import (
	"context"
	"fmt"
	"log"

	"erpnext-integration-service/internal/erpnext"
	"erpnext-integration-service/internal/models"
)

// CRMSyncService handles synchronization of customer data to ERPNext CRM
type CRMSyncService struct {
	erpnextClient *erpnext.Client
}

// NewCRMSyncService creates a new CRM sync service
func NewCRMSyncService(erpnextClient *erpnext.Client) *CRMSyncService {
	return &CRMSyncService{
		erpnextClient: erpnextClient,
	}
}

// SyncCustomerCreated syncs a newly created customer to ERPNext
func (s *CRMSyncService) SyncCustomerCreated(ctx context.Context, event *models.CustomerCreatedEvent) (string, error) {
	log.Printf("Syncing new customer: CustomerID=%s, Name=%s", event.CustomerID, event.CustomerName)

	customer := &erpnext.Customer{
		CustomerName:  event.CustomerName,
		CustomerType:  "Individual",
		CustomerGroup: "Individual",
		Territory:     "Nigeria",
		EmailID:       event.Email,
		MobileNo:      event.Phone,
		TaxID:         event.NIN, // Use NIN as Tax ID
	}

	customerID, err := s.erpnextClient.CreateCustomer(ctx, customer)
	if err != nil {
		return "", fmt.Errorf("failed to create customer in ERPNext: %w", err)
	}

	log.Printf("Created customer in ERPNext: %s", customerID)

	return customerID, nil
}

// SyncCustomerUpdated syncs customer updates to ERPNext
func (s *CRMSyncService) SyncCustomerUpdated(ctx context.Context, event *models.CustomerUpdatedEvent) error {
	log.Printf("Syncing customer update: CustomerID=%s, Name=%s", event.CustomerID, event.CustomerName)

	// First, try to get the existing customer
	existingCustomer, err := s.erpnextClient.GetCustomer(ctx, event.CustomerName)
	if err != nil {
		// If customer doesn't exist, create it
		log.Printf("Customer not found in ERPNext, creating new customer")
		_, err := s.SyncCustomerCreated(ctx, &models.CustomerCreatedEvent{
			EventID:      event.EventID,
			EventType:    "customer.created",
			Timestamp:    event.Timestamp,
			CustomerID:   event.CustomerID,
			CustomerName: event.CustomerName,
			Email:        event.Email,
			Phone:        event.Phone,
			NIN:          event.NIN,
			DateOfBirth:  event.DateOfBirth,
			Address:      event.Address,
		})
		return err
	}

	// Update the customer
	existingCustomer.EmailID = event.Email
	existingCustomer.MobileNo = event.Phone
	existingCustomer.TaxID = event.NIN

	if err := s.erpnextClient.UpdateCustomer(ctx, event.CustomerName, existingCustomer); err != nil {
		return fmt.Errorf("failed to update customer in ERPNext: %w", err)
	}

	log.Printf("Updated customer in ERPNext: %s", event.CustomerName)

	return nil
}
