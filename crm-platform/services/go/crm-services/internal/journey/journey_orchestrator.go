package journey

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// JourneyStatus represents the lifecycle state of a journey
type JourneyStatus string

const (
	JourneyStatusDraft     JourneyStatus = "draft"
	JourneyStatusActive    JourneyStatus = "active"
	JourneyStatusPaused    JourneyStatus = "paused"
	JourneyStatusCompleted JourneyStatus = "completed"
	JourneyStatusArchived  JourneyStatus = "archived"
)

// StepType defines the kind of action in a journey step
type StepType string

const (
	StepTypeSMS       StepType = "sms"
	StepTypeWhatsApp  StepType = "whatsapp"
	StepTypeTelegram  StepType = "telegram"
	StepTypeVoice     StepType = "voice"
	StepTypeEmail     StepType = "email"
	StepTypeWait      StepType = "wait"
	StepTypeCondition StepType = "condition"
	StepTypeAction    StepType = "action"
)

// JourneyStep represents a single step in a customer journey
type JourneyStep struct {
	ID          string            `json:"id"`
	Type        StepType          `json:"type"`
	Label       string            `json:"label"`
	Delay       time.Duration     `json:"delay"`
	Condition   *StepCondition    `json:"condition,omitempty"`
	Template    string            `json:"template,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	NextStepYes string            `json:"next_step_yes,omitempty"`
	NextStepNo  string            `json:"next_step_no,omitempty"`
}

// StepCondition defines a branching condition
type StepCondition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

// Journey represents a multi-step customer journey definition
type Journey struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      JourneyStatus `json:"status"`
	Trigger     JourneyTrigger `json:"trigger"`
	Steps       []JourneyStep `json:"steps"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// JourneyTrigger defines what initiates a journey
type JourneyTrigger struct {
	Type       string            `json:"type"`
	EventName  string            `json:"event_name"`
	Conditions map[string]string `json:"conditions,omitempty"`
}

// Enrollment tracks a customer's progress through a journey
type Enrollment struct {
	ID          string    `json:"id"`
	JourneyID   string    `json:"journey_id"`
	CustomerID  string    `json:"customer_id"`
	CurrentStep string    `json:"current_step"`
	Status      string    `json:"status"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	StepHistory []StepExecution `json:"step_history"`
}

// StepExecution records the execution of a journey step
type StepExecution struct {
	StepID     string    `json:"step_id"`
	ExecutedAt time.Time `json:"executed_at"`
	Result     string    `json:"result"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// JourneyOrchestrator manages journey lifecycle and enrollment processing
type JourneyOrchestrator struct {
	mu          sync.RWMutex
	journeys    map[string]*Journey
	enrollments map[string]*Enrollment
	metrics     *JourneyMetrics
}

// JourneyMetrics tracks aggregate journey performance
type JourneyMetrics struct {
	TotalEnrolled  int64   `json:"total_enrolled"`
	TotalCompleted int64   `json:"total_completed"`
	TotalFailed    int64   `json:"total_failed"`
	AvgDuration    float64 `json:"avg_duration_hours"`
	ConversionRate float64 `json:"conversion_rate"`
}

// NewJourneyOrchestrator creates a new orchestrator instance
func NewJourneyOrchestrator() *JourneyOrchestrator {
	return &JourneyOrchestrator{
		journeys:    make(map[string]*Journey),
		enrollments: make(map[string]*Enrollment),
		metrics:     &JourneyMetrics{},
	}
}

// CreateJourney creates a new journey definition
func (o *JourneyOrchestrator) CreateJourney(ctx context.Context, journey *Journey) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if journey.ID == "" {
		journey.ID = fmt.Sprintf("JRN-%d", time.Now().UnixNano())
	}
	journey.Status = JourneyStatusDraft
	journey.CreatedAt = time.Now()
	journey.UpdatedAt = time.Now()

	o.journeys[journey.ID] = journey
	log.Printf("[JourneyOrchestrator] Created journey %s: %s", journey.ID, journey.Name)
	return nil
}

// ActivateJourney starts accepting enrollments for a journey
func (o *JourneyOrchestrator) ActivateJourney(ctx context.Context, journeyID string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	journey, exists := o.journeys[journeyID]
	if !exists {
		return fmt.Errorf("journey %s not found", journeyID)
	}

	if len(journey.Steps) == 0 {
		return fmt.Errorf("journey %s has no steps", journeyID)
	}

	journey.Status = JourneyStatusActive
	journey.UpdatedAt = time.Now()
	log.Printf("[JourneyOrchestrator] Activated journey %s", journeyID)
	return nil
}

// EnrollCustomer enrolls a customer into a journey
func (o *JourneyOrchestrator) EnrollCustomer(ctx context.Context, journeyID, customerID string) (*Enrollment, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	journey, exists := o.journeys[journeyID]
	if !exists {
		return nil, fmt.Errorf("journey %s not found", journeyID)
	}

	if journey.Status != JourneyStatusActive {
		return nil, fmt.Errorf("journey %s is not active", journeyID)
	}

	enrollmentID := fmt.Sprintf("ENR-%d", time.Now().UnixNano())
	enrollment := &Enrollment{
		ID:          enrollmentID,
		JourneyID:   journeyID,
		CustomerID:  customerID,
		CurrentStep: journey.Steps[0].ID,
		Status:      "in_progress",
		StartedAt:   time.Now(),
		StepHistory: []StepExecution{},
	}

	o.enrollments[enrollmentID] = enrollment
	o.metrics.TotalEnrolled++
	log.Printf("[JourneyOrchestrator] Enrolled customer %s in journey %s", customerID, journeyID)
	return enrollment, nil
}

// ProcessStep executes the current step for an enrollment
func (o *JourneyOrchestrator) ProcessStep(ctx context.Context, enrollmentID string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	enrollment, exists := o.enrollments[enrollmentID]
	if !exists {
		return fmt.Errorf("enrollment %s not found", enrollmentID)
	}

	journey, exists := o.journeys[enrollment.JourneyID]
	if !exists {
		return fmt.Errorf("journey %s not found", enrollment.JourneyID)
	}

	var currentStep *JourneyStep
	for i := range journey.Steps {
		if journey.Steps[i].ID == enrollment.CurrentStep {
			currentStep = &journey.Steps[i]
			break
		}
	}

	if currentStep == nil {
		return fmt.Errorf("step %s not found in journey", enrollment.CurrentStep)
	}

	execution := StepExecution{
		StepID:     currentStep.ID,
		ExecutedAt: time.Now(),
		Result:     "success",
		Metadata:   make(map[string]string),
	}

	switch currentStep.Type {
	case StepTypeSMS, StepTypeWhatsApp, StepTypeTelegram, StepTypeEmail:
		execution.Metadata["channel"] = string(currentStep.Type)
		execution.Metadata["template"] = currentStep.Template
		log.Printf("[JourneyOrchestrator] Sending %s to customer %s", currentStep.Type, enrollment.CustomerID)

	case StepTypeVoice:
		execution.Metadata["channel"] = "voice"
		log.Printf("[JourneyOrchestrator] Initiating voice call to customer %s", enrollment.CustomerID)

	case StepTypeWait:
		execution.Metadata["delay"] = currentStep.Delay.String()
		log.Printf("[JourneyOrchestrator] Waiting %v for enrollment %s", currentStep.Delay, enrollmentID)

	case StepTypeCondition:
		execution.Metadata["condition"] = fmt.Sprintf("%s %s %s",
			currentStep.Condition.Field,
			currentStep.Condition.Operator,
			currentStep.Condition.Value,
		)

	case StepTypeAction:
		execution.Metadata["action"] = currentStep.Label
		log.Printf("[JourneyOrchestrator] Executing CRM action: %s", currentStep.Label)
	}

	enrollment.StepHistory = append(enrollment.StepHistory, execution)

	// Advance to next step
	stepIdx := -1
	for i, s := range journey.Steps {
		if s.ID == currentStep.ID {
			stepIdx = i
			break
		}
	}

	if stepIdx < len(journey.Steps)-1 {
		enrollment.CurrentStep = journey.Steps[stepIdx+1].ID
	} else {
		enrollment.Status = "completed"
		now := time.Now()
		enrollment.CompletedAt = &now
		o.metrics.TotalCompleted++
		o.updateConversionRate()
		log.Printf("[JourneyOrchestrator] Enrollment %s completed journey", enrollmentID)
	}

	return nil
}

// GetJourneyMetrics returns aggregate metrics for all journeys
func (o *JourneyOrchestrator) GetJourneyMetrics() *JourneyMetrics {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.metrics
}

// ListJourneys returns all journey definitions
func (o *JourneyOrchestrator) ListJourneys(ctx context.Context) []*Journey {
	o.mu.RLock()
	defer o.mu.RUnlock()

	result := make([]*Journey, 0, len(o.journeys))
	for _, j := range o.journeys {
		result = append(result, j)
	}
	return result
}

// GetEnrollment returns an enrollment by ID
func (o *JourneyOrchestrator) GetEnrollment(ctx context.Context, enrollmentID string) (*Enrollment, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	enrollment, exists := o.enrollments[enrollmentID]
	if !exists {
		return nil, fmt.Errorf("enrollment %s not found", enrollmentID)
	}
	return enrollment, nil
}

func (o *JourneyOrchestrator) updateConversionRate() {
	if o.metrics.TotalEnrolled > 0 {
		o.metrics.ConversionRate = float64(o.metrics.TotalCompleted) / float64(o.metrics.TotalEnrolled) * 100
	}
}

// MarshalJSON implements custom JSON marshaling for JourneyMetrics
func (m *JourneyMetrics) MarshalJSON() ([]byte, error) {
	type Alias JourneyMetrics
	return json.Marshal(&struct {
		*Alias
	}{
		Alias: (*Alias)(m),
	})
}
