package menu

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/munisp/NGApp/ussd-gateway/internal/session"
	"github.com/munisp/NGApp/ussd-gateway/internal/store"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type Engine struct {
	store       *store.Store
	sessionMgr  *session.Manager
	kafkaWriter *kafka.Writer
	logger      *zap.Logger
	menus       map[string]Menu
}

type Menu struct {
	ID      string
	Title   string
	Options []MenuOption
	Handler func(ctx context.Context, sess *session.Session, input string) (string, bool)
}

type MenuOption struct {
	Key   string
	Label string
	Next  string // next menu ID or empty for action
}

type USSDResponse struct {
	Message string `json:"message"`
	End     bool   `json:"end"` // true = END session, false = CON (continue)
}

func NewEngine(s *store.Store, sm *session.Manager, kafkaBroker string, logger *zap.Logger) *Engine {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        "ussd.events",
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 5 * time.Millisecond,
	}

	e := &Engine{
		store:       s,
		sessionMgr:  sm,
		kafkaWriter: writer,
		logger:      logger,
		menus:       make(map[string]Menu),
	}

	e.registerMenus()
	return e
}

func (e *Engine) registerMenus() {
	e.menus["main"] = Menu{
		ID:    "main",
		Title: "Welcome to A&G Insurance *919#",
		Options: []MenuOption{
			{Key: "1", Label: "Buy Insurance", Next: "buy_insurance"},
			{Key: "2", Label: "Check Policy", Next: "check_policy"},
			{Key: "3", Label: "File a Claim", Next: "file_claim"},
			{Key: "4", Label: "Pay Premium", Next: "pay_premium"},
			{Key: "5", Label: "Motor (NMID)", Next: "nmid_verify"},
			{Key: "6", Label: "Get Help", Next: "help"},
		},
	}

	e.menus["buy_insurance"] = Menu{
		ID:    "buy_insurance",
		Title: "Select Insurance Product",
		Options: []MenuOption{
			{Key: "1", Label: "Motor Insurance (Third Party)", Next: "motor_tp"},
			{Key: "2", Label: "Motor Insurance (Comprehensive)", Next: "motor_comp"},
			{Key: "3", Label: "Life Insurance", Next: "life"},
			{Key: "4", Label: "Health Insurance", Next: "health"},
			{Key: "5", Label: "Home Insurance", Next: "home"},
			{Key: "6", Label: "Micro Insurance (from N500)", Next: "micro"},
			{Key: "0", Label: "Back", Next: "main"},
		},
	}

	e.menus["check_policy"] = Menu{
		ID:    "check_policy",
		Title: "Policy Services",
		Options: []MenuOption{
			{Key: "1", Label: "View Active Policies", Next: "view_policies"},
			{Key: "2", Label: "Renewal Status", Next: "renewal_status"},
			{Key: "3", Label: "Download Certificate", Next: "download_cert"},
			{Key: "4", Label: "Policy Details", Next: "policy_details"},
			{Key: "0", Label: "Back", Next: "main"},
		},
	}

	e.menus["file_claim"] = Menu{
		ID:    "file_claim",
		Title: "File a Claim (Digital FNOL)",
		Options: []MenuOption{
			{Key: "1", Label: "Motor Accident", Next: "claim_motor"},
			{Key: "2", Label: "Theft/Burglary", Next: "claim_theft"},
			{Key: "3", Label: "Health Claim", Next: "claim_health"},
			{Key: "4", Label: "Death/Disability", Next: "claim_life"},
			{Key: "5", Label: "Track Existing Claim", Next: "claim_track"},
			{Key: "0", Label: "Back", Next: "main"},
		},
	}

	e.menus["pay_premium"] = Menu{
		ID:    "pay_premium",
		Title: "Premium Payment",
		Options: []MenuOption{
			{Key: "1", Label: "Pay via Mobile Money", Next: "pay_mobile"},
			{Key: "2", Label: "Pay via Bank Transfer", Next: "pay_bank"},
			{Key: "3", Label: "View Outstanding", Next: "pay_outstanding"},
			{Key: "4", Label: "Payment History", Next: "pay_history"},
			{Key: "0", Label: "Back", Next: "main"},
		},
	}

	e.menus["nmid_verify"] = Menu{
		ID:    "nmid_verify",
		Title: "NMID Motor Insurance Verification\nEnter vehicle registration number:",
	}

	e.menus["help"] = Menu{
		ID:    "help",
		Title: "Help & Support",
		Options: []MenuOption{
			{Key: "1", Label: "Call Center (0800-AG-INSURE)", Next: "end_call"},
			{Key: "2", Label: "WhatsApp Support", Next: "end_whatsapp"},
			{Key: "3", Label: "Find Nearest Branch", Next: "find_branch"},
			{Key: "4", Label: "FAQ", Next: "faq"},
			{Key: "0", Label: "Back", Next: "main"},
		},
	}

	// Product purchase flows
	for _, product := range []string{"motor_tp", "motor_comp", "life", "health", "home", "micro"} {
		e.menus[product] = Menu{
			ID:    product,
			Title: fmt.Sprintf("Enter your details for %s:\nFull Name:", strings.Replace(product, "_", " ", -1)),
		}
	}
}

func (e *Engine) ProcessInput(ctx context.Context, sess *session.Session, input string) *USSDResponse {
	// Handle back navigation
	if input == "0" {
		e.sessionMgr.GoBack(sess)
		return e.renderMenu(sess)
	}

	currentMenu, exists := e.menus[sess.CurrentMenu]
	if !exists {
		return &USSDResponse{Message: "Invalid menu. Please try again.", End: true}
	}

	// Check if input matches a menu option
	for _, opt := range currentMenu.Options {
		if opt.Key == input {
			e.sessionMgr.Navigate(sess, opt.Next)
			e.sessionMgr.Save(ctx, sess)

			// Publish navigation event to Kafka
			e.publishEvent(ctx, sess, "menu_navigation", map[string]string{
				"from": sess.CurrentMenu,
				"to":   opt.Next,
				"input": input,
			})

			return e.renderMenu(sess)
		}
	}

	// Handle free-text input (e.g., vehicle registration, phone number)
	return e.handleFreeInput(ctx, sess, input)
}

func (e *Engine) renderMenu(sess *session.Session) *USSDResponse {
	menu, exists := e.menus[sess.CurrentMenu]
	if !exists {
		return &USSDResponse{Message: "Service temporarily unavailable", End: true}
	}

	var sb strings.Builder
	sb.WriteString(menu.Title)

	if len(menu.Options) > 0 {
		sb.WriteString("\n")
		for _, opt := range menu.Options {
			sb.WriteString(fmt.Sprintf("\n%s. %s", opt.Key, opt.Label))
		}
	}

	return &USSDResponse{Message: sb.String(), End: false}
}

func (e *Engine) handleFreeInput(ctx context.Context, sess *session.Session, input string) *USSDResponse {
	switch sess.CurrentMenu {
	case "nmid_verify":
		// NMID verification - check vehicle registration
		sess.Data["vehicle_reg"] = input
		e.sessionMgr.Save(ctx, sess)
		return &USSDResponse{
			Message: fmt.Sprintf("NMID Verification\nVehicle: %s\nStatus: INSURED\nPolicy: AG/MOT/2026/xxxxx\nExpiry: 31-Dec-2026\nInsurer: A&G Insurance Plc", input),
			End:     true,
		}
	default:
		return &USSDResponse{Message: "Invalid input. Please try again.", End: false}
	}
}

func (e *Engine) GetMainMenu() *USSDResponse {
	return e.renderMenu(&session.Session{CurrentMenu: "main"})
}

func (e *Engine) publishEvent(ctx context.Context, sess *session.Session, eventType string, data map[string]string) {
	event := map[string]interface{}{
		"type":         eventType,
		"session_id":   sess.ID,
		"phone_number": sess.PhoneNumber,
		"data":         data,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}
	payload, _ := json.Marshal(event)
	e.kafkaWriter.WriteMessages(ctx, kafka.Message{Key: []byte(sess.ID), Value: payload})
}
