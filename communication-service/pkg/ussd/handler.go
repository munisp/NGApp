package ussd

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Handler handles USSD requests and manages sessions
type Handler struct {
	redisClient *redis.Client
	db          *sql.DB
	menus       map[string]*models.USSDMenu
	logger      *zap.Logger
}

// NewHandler creates a new USSD handler
func NewHandler(redisClient *redis.Client, db *sql.DB, logger *zap.Logger) *Handler {
	handler := &Handler{
		redisClient: redisClient,
		db:          db,
		menus:       make(map[string]*models.USSDMenu),
		logger:      logger,
	}

	// Initialize menus
	handler.initializeMenus()

	return handler
}

// HandleRequest processes a USSD request
func (h *Handler) HandleRequest(ctx context.Context, req *models.USSDRequest) (*models.USSDResponse, error) {
	h.logger.Info("Handling USSD request",
		zap.String("session_id", req.SessionID),
		zap.String("phone_number", req.PhoneNumber),
		zap.String("text", req.Text))

	// Get or create session
	session, err := h.getSession(ctx, req.SessionID, req.PhoneNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Parse user input
	userInput := ""
	if req.Text != "" {
		parts := strings.Split(req.Text, "*")
		if len(parts) > 0 {
			userInput = parts[len(parts)-1]
		}
	}

	// Get current menu
	menu, exists := h.menus[session.CurrentMenu]
	if !exists {
		h.logger.Error("Menu not found",
			zap.String("menu_id", session.CurrentMenu))
		return h.endSession(ctx, session, "Service temporarily unavailable. Please try again later.")
	}

	// Process user input
	if userInput != "" && session.CurrentMenu != "main" {
		nextMenu, action, err := h.processInput(ctx, session, menu, userInput)
		if err != nil {
			return h.continueSession(ctx, session, menu, fmt.Sprintf("Invalid input. %s\n\n%s", err.Error(), h.renderMenu(menu)))
		}

		// Execute action if specified
		if action != "" {
			result, err := h.executeAction(ctx, session, action)
			if err != nil {
				h.logger.Error("Failed to execute action",
					zap.String("action", action),
					zap.Error(err))
				return h.endSession(ctx, session, "An error occurred. Please try again later.")
			}

			// If action returns a result, display it and end session
			if result != "" {
				return h.endSession(ctx, session, result)
			}
		}

		// Move to next menu
		if nextMenu != "" {
			session.CurrentMenu = nextMenu
			menu = h.menus[nextMenu]
		}
	}

	// Render current menu
	message := h.renderMenu(menu)
	return h.continueSession(ctx, session, menu, message)
}

// processInput processes user input and determines next menu
func (h *Handler) processInput(ctx context.Context, session *models.USSDSession, menu *models.USSDMenu, input string) (string, string, error) {
	input = strings.TrimSpace(input)

	switch menu.InputType {
	case models.USSDInputTypeMenu:
		// Find matching option
		for _, option := range menu.Options {
			if option.Key == input {
				// Store selection in session state
				if session.State == nil {
					session.State = make(map[string]interface{})
				}
				session.State[menu.ID] = input

				return option.NextMenu, option.Action, nil
			}
		}
		return "", "", fmt.Errorf("Invalid option. Please select a valid option.")

	case models.USSDInputTypeNumber:
		// Validate numeric input
		if !isNumeric(input) {
			return "", "", fmt.Errorf("Please enter a valid number.")
		}
		session.State[menu.ID] = input
		return menu.NextMenu, menu.Action, nil

	case models.USSDInputTypeText:
		// Store text input
		session.State[menu.ID] = input
		return menu.NextMenu, menu.Action, nil

	default:
		return menu.NextMenu, menu.Action, nil
	}
}

// executeAction executes a USSD action
func (h *Handler) executeAction(ctx context.Context, session *models.USSDSession, action string) (string, error) {
	h.logger.Info("Executing USSD action",
		zap.String("action", action),
		zap.String("phone_number", session.PhoneNumber))

	switch action {
	case "check_balance":
		return h.checkBalance(ctx, session)
	case "get_policy_info":
		return h.getPolicyInfo(ctx, session)
	case "make_payment":
		return h.initiatePayment(ctx, session)
	case "file_claim":
		return h.fileClaim(ctx, session)
	case "contact_support":
		return h.contactSupport(ctx, session)
	default:
		return "", fmt.Errorf("unknown action: %s", action)
	}
}

// checkBalance checks the customer's account balance
func (h *Handler) checkBalance(ctx context.Context, session *models.USSDSession) (string, error) {
	// Query customer's policy balance
	query := `
		SELECT p.policy_number, p.premium_amount, p.status
		FROM policies p
		JOIN customers c ON p.customer_id = c.id
		WHERE c.phone = $1
		ORDER BY p.created_at DESC
		LIMIT 1
	`

	var policyNumber string
	var premiumAmount float64
	var status string

	err := h.db.QueryRowContext(ctx, query, session.PhoneNumber).Scan(&policyNumber, &premiumAmount, &status)
	if err != nil {
		if err == sql.ErrNoRows {
			return "No active policies found for your number.", nil
		}
		return "", fmt.Errorf("failed to query balance: %w", err)
	}

	return fmt.Sprintf("Policy: %s\nPremium: ₦%.2f\nStatus: %s\n\nThank you for using our service!", 
		policyNumber, premiumAmount, status), nil
}

// getPolicyInfo retrieves policy information
func (h *Handler) getPolicyInfo(ctx context.Context, session *models.USSDSession) (string, error) {
	policyNumber, ok := session.State["policy_number"].(string)
	if !ok {
		return "", fmt.Errorf("policy number not found in session")
	}

	query := `
		SELECT p.policy_type, p.sum_assured, p.premium_amount, p.start_date, p.end_date, p.status
		FROM policies p
		JOIN customers c ON p.customer_id = c.id
		WHERE c.phone = $1 AND p.policy_number = $2
	`

	var policyType string
	var sumAssured, premiumAmount float64
	var startDate, endDate time.Time
	var status string

	err := h.db.QueryRowContext(ctx, query, session.PhoneNumber, policyNumber).Scan(
		&policyType, &sumAssured, &premiumAmount, &startDate, &endDate, &status,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return "Policy not found or does not belong to your number.", nil
		}
		return "", fmt.Errorf("failed to query policy: %w", err)
	}

	return fmt.Sprintf("Policy: %s\nType: %s\nSum Assured: ₦%.2f\nPremium: ₦%.2f\nStart: %s\nEnd: %s\nStatus: %s",
		policyNumber, policyType, sumAssured, premiumAmount,
		startDate.Format("02-Jan-2006"), endDate.Format("02-Jan-2006"), status), nil
}

// initiatePayment initiates a premium payment
func (h *Handler) initiatePayment(ctx context.Context, session *models.USSDSession) (string, error) {
	policyNumber, ok := session.State["policy_number_payment"].(string)
	if !ok {
		return "", fmt.Errorf("policy number not found in session")
	}

	// In a real implementation, this would integrate with a payment gateway
	// For now, we'll just return a payment instruction

	return fmt.Sprintf("To pay premium for policy %s:\n\n1. Dial *123*456*%s#\n2. Or visit our website\n3. Or visit any of our branches\n\nThank you!",
		policyNumber, policyNumber), nil
}

// fileClaim initiates a claim filing process
func (h *Handler) fileClaim(ctx context.Context, session *models.USSDSession) (string, error) {
	policyNumber, ok1 := session.State["policy_number_claim"].(string)
	claimType, ok2 := session.State["claim_type"].(string)

	if !ok1 || !ok2 {
		return "", fmt.Errorf("required information not found in session")
	}

	// Create a claim record
	claimID := fmt.Sprintf("CLM-%d", time.Now().UnixNano())

	query := `
		INSERT INTO claims (id, policy_id, claim_type, status, created_at)
		SELECT $1, p.id, $2, 'PENDING', NOW()
		FROM policies p
		JOIN customers c ON p.customer_id = c.id
		WHERE c.phone = $3 AND p.policy_number = $4
	`

	_, err := h.db.ExecContext(ctx, query, claimID, claimType, session.PhoneNumber, policyNumber)
	if err != nil {
		return "", fmt.Errorf("failed to create claim: %w", err)
	}

	return fmt.Sprintf("Claim filed successfully!\n\nClaim ID: %s\nPolicy: %s\nType: %s\n\nOur team will contact you within 24 hours.",
		claimID, policyNumber, claimType), nil
}

// contactSupport provides contact information
func (h *Handler) contactSupport(ctx context.Context, session *models.USSDSession) (string, error) {
	return "Contact Us:\n\nPhone: 0800-INSURANCE\nEmail: support@insurance.ng\nWebsite: www.insurance.ng\n\nBusiness Hours: Mon-Fri 8AM-5PM", nil
}

// renderMenu renders a USSD menu
func (h *Handler) renderMenu(menu *models.USSDMenu) string {
	var builder strings.Builder

	builder.WriteString(menu.Title)
	builder.WriteString("\n\n")

	for _, option := range menu.Options {
		builder.WriteString(fmt.Sprintf("%s. %s\n", option.Key, option.Label))
	}

	return builder.String()
}

// getSession retrieves or creates a USSD session
func (h *Handler) getSession(ctx context.Context, sessionID, phoneNumber string) (*models.USSDSession, error) {
	key := fmt.Sprintf("ussd:session:%s", sessionID)

	// Try to get existing session from Redis
	data, err := h.redisClient.Get(ctx, key).Result()
	if err == nil {
		var session models.USSDSession
		if err := json.Unmarshal([]byte(data), &session); err == nil {
			return &session, nil
		}
	}

	// Create new session
	session := &models.USSDSession{
		SessionID:   sessionID,
		PhoneNumber: phoneNumber,
		CurrentMenu: "main",
		State:       make(map[string]interface{}),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(5 * time.Minute),
	}

	// Save to Redis
	if err := h.saveSession(ctx, session); err != nil {
		return nil, err
	}

	return session, nil
}

// saveSession saves a USSD session to Redis
func (h *Handler) saveSession(ctx context.Context, session *models.USSDSession) error {
	key := fmt.Sprintf("ussd:session:%s", session.SessionID)
	session.UpdatedAt = time.Now()

	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	ttl := time.Until(session.ExpiresAt)
	if ttl < 0 {
		ttl = 5 * time.Minute
	}

	return h.redisClient.Set(ctx, key, data, ttl).Err()
}

// continueSession continues a USSD session
func (h *Handler) continueSession(ctx context.Context, session *models.USSDSession, menu *models.USSDMenu, message string) (*models.USSDResponse, error) {
	if err := h.saveSession(ctx, session); err != nil {
		h.logger.Error("Failed to save session", zap.Error(err))
	}

	return &models.USSDResponse{
		Message:  message,
		Type:     models.USSDTypeContinue,
		Continue: true,
	}, nil
}

// endSession ends a USSD session
func (h *Handler) endSession(ctx context.Context, session *models.USSDSession, message string) (*models.USSDResponse, error) {
	// Delete session from Redis
	key := fmt.Sprintf("ussd:session:%s", session.SessionID)
	h.redisClient.Del(ctx, key)

	return &models.USSDResponse{
		Message:  message,
		Type:     models.USSDTypeEnd,
		Continue: false,
	}, nil
}

// initializeMenus initializes USSD menus
func (h *Handler) initializeMenus() {
	h.menus["main"] = &models.USSDMenu{
		ID:        "main",
		Title:     "Welcome to Insurance Platform",
		InputType: models.USSDInputTypeMenu,
		Options: []models.USSDOption{
			{Key: "1", Label: "Check Balance", NextMenu: "check_balance", Action: "check_balance"},
			{Key: "2", Label: "Policy Information", NextMenu: "policy_info_input"},
			{Key: "3", Label: "Make Payment", NextMenu: "payment_input"},
			{Key: "4", Label: "File a Claim", NextMenu: "claim_input"},
			{Key: "5", Label: "Contact Support", Action: "contact_support"},
		},
	}

	h.menus["policy_info_input"] = &models.USSDMenu{
		ID:         "policy_info_input",
		Title:      "Enter your policy number:",
		InputType:  models.USSDInputTypeText,
		NextMenu:   "get_policy_info",
		Action:     "get_policy_info",
		Validation: "required",
		ErrorMsg:   "Policy number is required",
	}

	h.menus["payment_input"] = &models.USSDMenu{
		ID:         "payment_input",
		Title:      "Enter policy number to pay premium:",
		InputType:  models.USSDInputTypeText,
		NextMenu:   "make_payment",
		Action:     "make_payment",
		Validation: "required",
		ErrorMsg:   "Policy number is required",
	}

	h.menus["claim_input"] = &models.USSDMenu{
		ID:        "claim_input",
		Title:     "Enter policy number for claim:",
		InputType: models.USSDInputTypeText,
		NextMenu:  "claim_type_select",
	}

	h.menus["claim_type_select"] = &models.USSDMenu{
		ID:        "claim_type_select",
		Title:     "Select claim type:",
		InputType: models.USSDInputTypeMenu,
		Options: []models.USSDOption{
			{Key: "1", Label: "Health", Action: "file_claim"},
			{Key: "2", Label: "Motor", Action: "file_claim"},
			{Key: "3", Label: "Life", Action: "file_claim"},
			{Key: "4", Label: "Property", Action: "file_claim"},
		},
	}
}

// Helper functions

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
}
