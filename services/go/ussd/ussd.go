package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/IBM/sarama"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

// Configuration
var (
	redisClient   *redis.Client
	kafkaProducer sarama.SyncProducer
	ctx           = context.Background()
)

// Metrics
var (
	ussdRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ussd_requests_total", Help: "Total USSD requests"},
		[]string{"service_code", "status"},
	)
	ussdSessionDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{Name: "ussd_session_duration_seconds", Help: "USSD session duration"},
		[]string{"service_code"},
	)
	activeSessionsGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{Name: "ussd_active_sessions", Help: "Number of active USSD sessions"},
	)
)

func init() {
	prometheus.MustRegister(ussdRequestsTotal, ussdSessionDuration, activeSessionsGauge)
}

// Session represents a USSD session
type Session struct {
	SessionID    string                 `json:"session_id"`
	PhoneNumber  string                 `json:"phone_number"`
	ServiceCode  string                 `json:"service_code"`
	State        string                 `json:"state"`
	Level        int                    `json:"level"`
	Data         map[string]interface{} `json:"data"`
	CreatedAt    time.Time              `json:"created_at"`
	LastActivity time.Time              `json:"last_activity"`
	UserID       string                 `json:"user_id,omitempty"`
}

// USSDRequest represents incoming USSD request
type USSDRequest struct {
	SessionID   string `json:"session_id"`
	PhoneNumber string `json:"phone_number"`
	ServiceCode string `json:"service_code"`
	Input       string `json:"input"`
	NetworkCode string `json:"network_code,omitempty"`
}

// USSDResponse represents USSD response
type USSDResponse struct {
	SessionID string `json:"session_id"`
	Response  string `json:"response"`
	EndSession bool   `json:"end_session"`
}

// Menu definitions
type MenuItem struct {
	ID          string
	Text        string
	NextState   string
	Handler     func(*Session, string) (string, bool)
}

type Menu struct {
	Title string
	Items []MenuItem
}

// In-memory session store (fallback if Redis unavailable)
var (
	sessions     = make(map[string]*Session)
	sessionMutex sync.RWMutex
)

// Menu definitions for fintech USSD
var menus = map[string]Menu{
	"main": {
		Title: "Welcome to FinTech\n",
		Items: []MenuItem{
			{ID: "1", Text: "Check Balance", NextState: "balance"},
			{ID: "2", Text: "Transfer Money", NextState: "transfer_amount"},
			{ID: "3", Text: "Buy Airtime", NextState: "airtime_amount"},
			{ID: "4", Text: "Pay Bills", NextState: "bills_menu"},
			{ID: "5", Text: "Mini Statement", NextState: "statement"},
			{ID: "6", Text: "My Account", NextState: "account_menu"},
			{ID: "0", Text: "Exit", NextState: "exit"},
		},
	},
	"bills_menu": {
		Title: "Pay Bills\n",
		Items: []MenuItem{
			{ID: "1", Text: "Electricity", NextState: "bill_electricity"},
			{ID: "2", Text: "Cable TV", NextState: "bill_cable"},
			{ID: "3", Text: "Internet", NextState: "bill_internet"},
			{ID: "4", Text: "Water", NextState: "bill_water"},
			{ID: "0", Text: "Back", NextState: "main"},
		},
	},
	"account_menu": {
		Title: "My Account\n",
		Items: []MenuItem{
			{ID: "1", Text: "Change PIN", NextState: "change_pin"},
			{ID: "2", Text: "Block Card", NextState: "block_card"},
			{ID: "3", Text: "Update Profile", NextState: "update_profile"},
			{ID: "0", Text: "Back", NextState: "main"},
		},
	},
}

func main() {
	// Initialize Redis
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	redisClient = redis.NewClient(&redis.Options{
		Addr: strings.TrimPrefix(redisAddr, "redis://"),
	})

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		fmt.Printf("[USSD] Redis not available, using in-memory sessions: %v\n", err)
		redisClient = nil
	} else {
		fmt.Println("[USSD] Connected to Redis")
	}

	// Initialize Kafka producer
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "kafka:9092"
	}
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	config.Producer.RequiredAcks = sarama.WaitForAll

	var err error
	kafkaProducer, err = sarama.NewSyncProducer(strings.Split(kafkaBrokers, ","), config)
	if err != nil {
		fmt.Printf("[USSD] Kafka not available: %v\n", err)
		kafkaProducer = nil
	} else {
		fmt.Println("[USSD] Connected to Kafka")
		defer kafkaProducer.Close()
	}

	// HTTP server
	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ussd", ussdHandler)
	mux.HandleFunc("/sessions", sessionsHandler)
	mux.HandleFunc("/metrics", promhttp.Handler().ServeHTTP)

	port := os.Getenv("USSD_SERVICE_PORT")
	if port == "" {
		port = "8132"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		fmt.Printf("[USSD] Service listening on :%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "[USSD] Server error: %v\n", err)
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("[USSD] Shutting down...")
	server.Close()
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	redisConnected := redisClient != nil && redisClient.Ping(ctx).Err() == nil
	kafkaConnected := kafkaProducer != nil

	sessionCount := 0
	if redisClient != nil {
		keys, _ := redisClient.Keys(ctx, "ussd:session:*").Result()
		sessionCount = len(keys)
	} else {
		sessionMutex.RLock()
		sessionCount = len(sessions)
		sessionMutex.RUnlock()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":           "healthy",
		"service":          "ussd",
		"version":          "1.0.0",
		"redis_connected":  redisConnected,
		"kafka_connected":  kafkaConnected,
		"active_sessions":  sessionCount,
		"supported_codes":  []string{"*123#", "*456#", "*789#"},
	})
}

func ussdHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req USSDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get or create session
	session := getSession(req.SessionID)
	if session == nil {
		session = createSession(req)
	}

	// Process input and get response
	response, endSession := processUSSD(session, req.Input)

	// Update session
	session.LastActivity = time.Now()
	if endSession {
		deleteSession(session.SessionID)
	} else {
		saveSession(session)
	}

	// Publish to Kafka
	publishEvent("ussd.requests", map[string]interface{}{
		"session_id":   req.SessionID,
		"phone_number": req.PhoneNumber,
		"service_code": req.ServiceCode,
		"input":        req.Input,
		"state":        session.State,
		"end_session":  endSession,
	})

	// Update metrics
	status := "continue"
	if endSession {
		status = "end"
	}
	ussdRequestsTotal.WithLabelValues(req.ServiceCode, status).Inc()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(USSDResponse{
		SessionID:  req.SessionID,
		Response:   response,
		EndSession: endSession,
	})
}

func processUSSD(session *Session, input string) (string, bool) {
	input = strings.TrimSpace(input)

	switch session.State {
	case "main":
		return processMainMenu(session, input)
	case "balance":
		return processBalance(session)
	case "transfer_amount":
		return processTransferAmount(session, input)
	case "transfer_recipient":
		return processTransferRecipient(session, input)
	case "transfer_pin":
		return processTransferPIN(session, input)
	case "airtime_amount":
		return processAirtimeAmount(session, input)
	case "airtime_phone":
		return processAirtimePhone(session, input)
	case "airtime_pin":
		return processAirtimePIN(session, input)
	case "bills_menu":
		return processBillsMenu(session, input)
	case "statement":
		return processStatement(session)
	case "account_menu":
		return processAccountMenu(session, input)
	case "exit":
		return "Thank you for using FinTech USSD. Goodbye!", true
	default:
		session.State = "main"
		return renderMenu("main"), false
	}
}

func processMainMenu(session *Session, input string) (string, bool) {
	menu := menus["main"]
	for _, item := range menu.Items {
		if item.ID == input {
			session.State = item.NextState
			session.Level++
			if item.NextState == "exit" {
				return "Thank you for using FinTech USSD. Goodbye!", true
			}
			return processUSSD(session, "")
		}
	}
	return "Invalid option. " + renderMenu("main"), false
}

func processBalance(session *Session) (string, bool) {
	// Trigger balance inquiry workflow
	publishEvent("ussd.balance.inquiry", map[string]interface{}{
		"phone_number": session.PhoneNumber,
		"session_id":   session.SessionID,
	})

	session.State = "main"
	return "Your balance is:\nMain: NGN 125,000.00\nSavings: NGN 50,000.00\n\n" + renderMenu("main"), false
}

func processTransferAmount(session *Session, input string) (string, bool) {
	if input == "" {
		return "Enter amount to transfer:", false
	}

	amount, err := strconv.ParseFloat(strings.ReplaceAll(input, ",", ""), 64)
	if err != nil || amount <= 0 {
		return "Invalid amount. Enter amount to transfer:", false
	}

	session.Data["amount"] = amount
	session.State = "transfer_recipient"
	return fmt.Sprintf("Amount: NGN %.2f\nEnter recipient phone number:", amount), false
}

func processTransferRecipient(session *Session, input string) (string, bool) {
	if input == "" || len(input) < 10 {
		return "Invalid phone number. Enter recipient phone number:", false
	}

	session.Data["recipient"] = input
	session.State = "transfer_pin"
	amount := session.Data["amount"].(float64)
	return fmt.Sprintf("Transfer NGN %.2f to %s\nEnter your PIN to confirm:", amount, input), false
}

func processTransferPIN(session *Session, input string) (string, bool) {
	if len(input) != 4 {
		return "Invalid PIN. Enter your 4-digit PIN:", false
	}

	// Trigger transfer workflow
	publishEvent("ussd.transfer.initiate", map[string]interface{}{
		"phone_number": session.PhoneNumber,
		"amount":       session.Data["amount"],
		"recipient":    session.Data["recipient"],
		"session_id":   session.SessionID,
	})

	amount := session.Data["amount"].(float64)
	recipient := session.Data["recipient"].(string)
	session.State = "main"
	session.Data = make(map[string]interface{})

	return fmt.Sprintf("Transfer successful!\nNGN %.2f sent to %s\nRef: TRF%d\n\n%s", 
		amount, recipient, time.Now().Unix()%100000, renderMenu("main")), false
}

func processAirtimeAmount(session *Session, input string) (string, bool) {
	if input == "" {
		return "Enter airtime amount:", false
	}

	amount, err := strconv.ParseFloat(strings.ReplaceAll(input, ",", ""), 64)
	if err != nil || amount <= 0 {
		return "Invalid amount. Enter airtime amount:", false
	}

	session.Data["amount"] = amount
	session.State = "airtime_phone"
	return fmt.Sprintf("Amount: NGN %.2f\nEnter phone number (or 0 for self):", amount), false
}

func processAirtimePhone(session *Session, input string) (string, bool) {
	phone := input
	if input == "0" {
		phone = session.PhoneNumber
	}
	if len(phone) < 10 {
		return "Invalid phone number. Enter phone number:", false
	}

	session.Data["phone"] = phone
	session.State = "airtime_pin"
	amount := session.Data["amount"].(float64)
	return fmt.Sprintf("Buy NGN %.2f airtime for %s\nEnter PIN to confirm:", amount, phone), false
}

func processAirtimePIN(session *Session, input string) (string, bool) {
	if len(input) != 4 {
		return "Invalid PIN. Enter your 4-digit PIN:", false
	}

	// Trigger airtime workflow
	publishEvent("ussd.airtime.purchase", map[string]interface{}{
		"phone_number": session.PhoneNumber,
		"amount":       session.Data["amount"],
		"target_phone": session.Data["phone"],
		"session_id":   session.SessionID,
	})

	amount := session.Data["amount"].(float64)
	phone := session.Data["phone"].(string)
	session.State = "main"
	session.Data = make(map[string]interface{})

	return fmt.Sprintf("Airtime purchase successful!\nNGN %.2f to %s\nRef: AIR%d\n\n%s",
		amount, phone, time.Now().Unix()%100000, renderMenu("main")), false
}

func processBillsMenu(session *Session, input string) (string, bool) {
	menu := menus["bills_menu"]
	for _, item := range menu.Items {
		if item.ID == input {
			if item.NextState == "main" {
				session.State = "main"
				return renderMenu("main"), false
			}
			session.State = item.NextState
			session.Data["bill_type"] = item.Text
			return fmt.Sprintf("Pay %s Bill\nEnter meter/account number:", item.Text), false
		}
	}
	return "Invalid option. " + renderMenu("bills_menu"), false
}

func processStatement(session *Session) (string, bool) {
	publishEvent("ussd.statement.request", map[string]interface{}{
		"phone_number": session.PhoneNumber,
		"session_id":   session.SessionID,
	})

	session.State = "main"
	return "Mini Statement:\n1. -5,000 Transfer\n2. +50,000 Salary\n3. -2,500 Airtime\n4. -15,000 Bills\n\n" + renderMenu("main"), false
}

func processAccountMenu(session *Session, input string) (string, bool) {
	menu := menus["account_menu"]
	for _, item := range menu.Items {
		if item.ID == input {
			if item.NextState == "main" {
				session.State = "main"
				return renderMenu("main"), false
			}
			session.State = item.NextState
			return fmt.Sprintf("%s - Coming soon\n\n%s", item.Text, renderMenu("account_menu")), false
		}
	}
	return "Invalid option. " + renderMenu("account_menu"), false
}

func renderMenu(menuName string) string {
	menu, ok := menus[menuName]
	if !ok {
		return "Menu not found"
	}

	var sb strings.Builder
	sb.WriteString(menu.Title)
	for _, item := range menu.Items {
		sb.WriteString(fmt.Sprintf("%s. %s\n", item.ID, item.Text))
	}
	return sb.String()
}

func getSession(sessionID string) *Session {
	if redisClient != nil {
		data, err := redisClient.Get(ctx, "ussd:session:"+sessionID).Bytes()
		if err == nil {
			var session Session
			if json.Unmarshal(data, &session) == nil {
				return &session
			}
		}
	}

	sessionMutex.RLock()
	session := sessions[sessionID]
	sessionMutex.RUnlock()
	return session
}

func createSession(req USSDRequest) *Session {
	session := &Session{
		SessionID:    req.SessionID,
		PhoneNumber:  req.PhoneNumber,
		ServiceCode:  req.ServiceCode,
		State:        "main",
		Level:        0,
		Data:         make(map[string]interface{}),
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
	}
	saveSession(session)
	activeSessionsGauge.Inc()
	return session
}

func saveSession(session *Session) {
	if redisClient != nil {
		data, _ := json.Marshal(session)
		redisClient.Set(ctx, "ussd:session:"+session.SessionID, data, 5*time.Minute)
	}

	sessionMutex.Lock()
	sessions[session.SessionID] = session
	sessionMutex.Unlock()
}

func deleteSession(sessionID string) {
	if redisClient != nil {
		redisClient.Del(ctx, "ussd:session:"+sessionID)
	}

	sessionMutex.Lock()
	delete(sessions, sessionID)
	sessionMutex.Unlock()
	activeSessionsGauge.Dec()
}

func sessionsHandler(w http.ResponseWriter, r *http.Request) {
	var sessionList []*Session

	if redisClient != nil {
		keys, _ := redisClient.Keys(ctx, "ussd:session:*").Result()
		for _, key := range keys {
			data, err := redisClient.Get(ctx, key).Bytes()
			if err == nil {
				var session Session
				if json.Unmarshal(data, &session) == nil {
					sessionList = append(sessionList, &session)
				}
			}
		}
	} else {
		sessionMutex.RLock()
		for _, s := range sessions {
			sessionList = append(sessionList, s)
		}
		sessionMutex.RUnlock()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessions": sessionList,
		"total":    len(sessionList),
	})
}

func publishEvent(topic string, event map[string]interface{}) {
	if kafkaProducer == nil {
		return
	}

	event["timestamp"] = time.Now().Unix()
	event["service"] = "ussd"

	data, _ := json.Marshal(event)
	msg := &sarama.ProducerMessage{
		Topic: topic,
		Value: sarama.ByteEncoder(data),
	}

	_, _, err := kafkaProducer.SendMessage(msg)
	if err != nil {
		fmt.Printf("[USSD] Failed to publish to Kafka: %v\n", err)
	}
}
