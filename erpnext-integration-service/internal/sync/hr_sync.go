package sync

import (
	"context"
	"fmt"
	"log"

	"erpnext-integration-service/internal/erpnext"
	"erpnext-integration-service/internal/models"
)

// HRSyncService handles synchronization of agent/employee data to ERPNext HR
type HRSyncService struct {
	erpnextClient *erpnext.Client
	company       string
}

// NewHRSyncService creates a new HR sync service
func NewHRSyncService(erpnextClient *erpnext.Client, company string) *HRSyncService {
	return &HRSyncService{
		erpnextClient: erpnextClient,
		company:       company,
	}
}

// SyncAgentCreated syncs a newly created agent to ERPNext as an Employee
func (s *HRSyncService) SyncAgentCreated(ctx context.Context, event *models.AgentCreatedEvent) (string, error) {
	log.Printf("Syncing new agent: AgentID=%s, Name=%s %s", event.AgentID, event.FirstName, event.LastName)

	employee := &erpnext.Employee{
		FirstName:      event.FirstName,
		LastName:       event.LastName,
		Company:        s.company,
		DateOfJoining:  event.DateOfJoining,
		Gender:         event.Gender,
		Status:         "Active",
		EmployeeNumber: event.AgentID,
		CellNumber:     event.Phone,
		PersonalEmail:  event.Email,
	}

	employeeID, err := s.erpnextClient.CreateEmployee(ctx, employee)
	if err != nil {
		return "", fmt.Errorf("failed to create employee in ERPNext: %w", err)
	}

	log.Printf("Created employee in ERPNext: %s", employeeID)

	return employeeID, nil
}
