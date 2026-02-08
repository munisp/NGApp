package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
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

// Provider configuration
var (
	twilioAccountSID  = os.Getenv("TWILIO_ACCOUNT_SID")
	twilioAuthToken   = os.Getenv("TWILIO_AUTH_TOKEN")
	twilioPhoneNumber = os.Getenv("TWILIO_PHONE_NUMBER")
	atAPIKey          = os.Getenv("AFRICASTALKING_API_KEY")
	atUsername        = os.Getenv("AFRICASTALKING_USERNAME")
	atShortCode       = os.Getenv("AFRICASTALKING_SHORTCODE")
)

// Metrics
var (
	smsSentTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "sms_sent_total", Help: "Total SMS sent"},
		[]string{"provider", "status"},
	)
	smsDeliveryLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{Name: "sms_delivery_latency_seconds", Help: "SMS delivery latency"},
		[]string{"provider"},
	)
	smsQueueSize = prometheus.NewGauge(
		prometheus.GaugeOpts{Name: "sms_queue_size", Help: "SMS queue size"},
	)
)

func init() {
	prometheus.MustRegister(smsSentTotal, smsDeliveryLatency, smsQueueSize)
}

// SMS represents an SMS message
type SMS struct {
	MessageID     string                 `json:"message_id"`
	To            string                 `json:"to"`
	From          string                 `json:"from"`
	Body          string                 `json:"body"`
	Provider      string                 `json:"provider"`
	Status        string                 `json:"status"`
	StatusCode    string                 `json:"status_code,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
	SegmentCount  int                    `json:"segment_count"`
	CreatedAt     time.Time              `json:"created_at"`
	SentAt        *time.Time             `json:"sent_at,omitempty"`
	DeliveredAt   *time.Time             `json:"delivered_at,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	TemplateID    string                 `json:"template_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
}

// SMSTemplate represents a message template
type SMSTemplate struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Body       string   `json:"body"`
	Variables  []string `json:"variables"`
	Category   string   `json:"category"`
	CreatedAt  time.Time `json:"created_at"`
}

// SendSMSRequest represents a send SMS request
type SendSMSRequest struct {
	To         string                 `json:"to"`
	Body       string                 `json:"body,omitempty"`
	TemplateID string                 `json:"template_id,omitempty"`
	Variables  map[string]string      `json:"variables,omitempty"`
	Provider   string                 `json:"provider,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	UserID     string                 `json:"user_id,omitempty"`
}

// BulkSMSRequest represents a bulk SMS request
type BulkSMSRequest struct {
	Recipients []string               `json:"recipients"`
	Body       string                 `json:"body,omitempty"`
	TemplateID string                 `json:"template_id,omitempty"`
	Variables  map[string]string      `json:"variables,omitempty"`
	Provider   string                 `json:"provider,omitempty"`
}

// In-memory stores
var (
	messages     = make(map[string]*SMS)
	messagesMu   sync.RWMutex
	templates    = make(map[string]*SMSTemplate)
	templatesMu  sync.RWMutex
	messageQueue = make(chan *SMS, 10000)
)

// Fintech SMS templates
var fintechTemplates = []SMSTemplate{
	{ID: "otp", Name: "OTP Verification", Body: "Your verification code is {code}. Valid for {minutes} minutes. Do not share.", Variables: []string{"code", "minutes"}, Category: "authentication"},
	{ID: "txn_alert", Name: "Transaction Alert", Body: "{type} of {currency}{amount} on your account ending {last4}. Balance: {currency}{balance}. Ref: {ref}", Variables: []string{"type", "currency", "amount", "last4", "balance", "ref"}, Category: "transactional"},
	{ID: "payment_success", Name: "Payment Success", Body: "Payment of {currency}{amount} to {recipient} successful. Ref: {ref}. Thank you for using FinTech.", Variables: []string{"currency", "amount", "recipient", "ref"}, Category: "transactional"},
	{ID: "loan_reminder", Name: "Loan Reminder", Body: "Reminder: Your loan repayment of {currency}{amount} is due on {date}. Ensure sufficient balance.", Variables: []string{"currency", "amount", "date"}, Category: "transactional"},
	{ID: "low_balance", Name: "Low Balance Alert", Body: "Alert: Your account balance is low ({currency}{balance}). Top up to avoid service interruption.", Variables: []string{"currency", "balance"}, Category: "transactional"},
	{ID: "login_alert", Name: "Login Alert", Body: "New login to your account from {device} at {time}. If not you, call {hotline} immediately.", Variables: []string{"device", "time", "hotline"}, Category: "security"},
	{ID: "card_blocked", Name: "Card Blocked", Body: "Your card ending {last4} has been blocked. Contact support at {hotline} to unblock.", Variables: []string{"last4", "hotline"}, Category: "security"},
	{ID: "welcome", Name: "Welcome Message", Body: "Welcome to FinTech! Your account is active. Download our app: {app_link}. Need help? Call {hotline}.", Variables: []string{"app_link", "hotline"}, Category: "marketing"},
}

func main() {
	// Initialize templates
	for _, t := range fintechTemplates {
		t.CreatedAt = time.Now()
		templates[t.ID] = &t
	}

	// Initialize Redis
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	redisClient = redis.NewClient(&redis.Options{
		Addr: strings.TrimPrefix(redisAddr, "redis://"),
	})

	if err := redisClient.Ping(ctx).Err(); err != nil {
		fmt.Printf("[SMS] Redis not available: %v\n", err)
		redisClient = nil
	} else {
		fmt.Println("[SMS] Connected to Redis")
	}

	// Initialize Kafka
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "kafka:9092"
	}
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true

	var err error
	kafkaProducer, err = sarama.NewSyncProducer(strings.Split(kafkaBrokers, ","), config)
	if err != nil {
		fmt.Printf("[SMS] Kafka not available: %v\n", err)
		kafkaProducer = nil
	} else {
		fmt.Println("[SMS] Connected to Kafka")
		defer kafkaProducer.Close()
	}

	// Start message processor
	go processMessageQueue()

	// HTTP server
	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/send", sendHandler)
	mux.HandleFunc("/bulk", bulkHandler)
	mux.HandleFunc("/messages/", messageHandler)
	mux.HandleFunc("/templates", templatesHandler)
	mux.HandleFunc("/webhook/twilio", twilioWebhookHandler)
	mux.HandleFunc("/webhook/africastalking", atWebhookHandler)
	mux.HandleFunc("/metrics", promhttp.Handler().ServeHTTP)

	port := os.Getenv("SMS_SERVICE_PORT")
	if port == "" {
		port = "8133"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		fmt.Printf("[SMS] Service listening on :%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "[SMS] Server error: %v\n", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("[SMS] Shutting down...")
	server.Close()
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	redisConnected := redisClient != nil && redisClient.Ping(ctx).Err() == nil
	kafkaConnected := kafkaProducer != nil

	messagesMu.RLock()
	msgCount := len(messages)
	messagesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "healthy",
		"service":         "sms",
		"version":         "1.0.0",
		"redis_connected": redisConnected,
		"kafka_connected": kafkaConnected,
		"messages_sent":   msgCount,
		"queue_size":      len(messageQueue),
		"templates":       len(templates),
		"providers": map[string]bool{
			"twilio":         twilioAccountSID != "",
			"africastalking": atAPIKey != "",
		},
	})
}

func sendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendSMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Resolve template if provided
	body := req.Body
	if req.TemplateID != "" {
		templatesMu.RLock()
		tmpl, ok := templates[req.TemplateID]
		templatesMu.RUnlock()
		if !ok {
			http.Error(w, "Template not found", http.StatusBadRequest)
			return
		}
		body = resolveTemplate(tmpl.Body, req.Variables)
	}

	if body == "" {
		http.Error(w, "Message body required", http.StatusBadRequest)
		return
	}

	// Select provider
	provider := req.Provider
	if provider == "" {
		provider = selectProvider(req.To)
	}

	// Create SMS
	sms := &SMS{
		MessageID:    fmt.Sprintf("sms_%d_%s", time.Now().UnixNano(), randomString(8)),
		To:           req.To,
		From:         getFromNumber(provider),
		Body:         body,
		Provider:     provider,
		Status:       "queued",
		SegmentCount: calculateSegments(body),
		CreatedAt:    time.Now(),
		Metadata:     req.Metadata,
		TemplateID:   req.TemplateID,
		UserID:       req.UserID,
	}

	// Store and queue
	messagesMu.Lock()
	messages[sms.MessageID] = sms
	messagesMu.Unlock()

	messageQueue <- sms
	smsQueueSize.Set(float64(len(messageQueue)))

	// Publish to Kafka
	publishEvent("sms.outbound", map[string]interface{}{
		"message_id": sms.MessageID,
		"to":         sms.To,
		"provider":   sms.Provider,
		"template":   sms.TemplateID,
		"user_id":    sms.UserID,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message_id":    sms.MessageID,
		"status":        sms.Status,
		"provider":      sms.Provider,
		"segment_count": sms.SegmentCount,
	})
}

func bulkHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req BulkSMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	body := req.Body
	if req.TemplateID != "" {
		templatesMu.RLock()
		tmpl, ok := templates[req.TemplateID]
		templatesMu.RUnlock()
		if !ok {
			http.Error(w, "Template not found", http.StatusBadRequest)
			return
		}
		body = resolveTemplate(tmpl.Body, req.Variables)
	}

	results := make([]map[string]interface{}, 0, len(req.Recipients))
	for _, to := range req.Recipients {
		provider := req.Provider
		if provider == "" {
			provider = selectProvider(to)
		}

		sms := &SMS{
			MessageID:    fmt.Sprintf("sms_%d_%s", time.Now().UnixNano(), randomString(8)),
			To:           to,
			From:         getFromNumber(provider),
			Body:         body,
			Provider:     provider,
			Status:       "queued",
			SegmentCount: calculateSegments(body),
			CreatedAt:    time.Now(),
			TemplateID:   req.TemplateID,
		}

		messagesMu.Lock()
		messages[sms.MessageID] = sms
		messagesMu.Unlock()

		messageQueue <- sms

		results = append(results, map[string]interface{}{
			"to":         to,
			"message_id": sms.MessageID,
			"status":     "queued",
		})
	}

	smsQueueSize.Set(float64(len(messageQueue)))

	// Publish bulk event
	publishEvent("sms.bulk", map[string]interface{}{
		"recipient_count": len(req.Recipients),
		"template":        req.TemplateID,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":   len(req.Recipients),
		"queued":  len(results),
		"results": results,
	})
}

func messageHandler(w http.ResponseWriter, r *http.Request) {
	messageID := strings.TrimPrefix(r.URL.Path, "/messages/")
	if messageID == "" {
		// List messages
		messagesMu.RLock()
		msgList := make([]*SMS, 0, len(messages))
		for _, m := range messages {
			msgList = append(msgList, m)
		}
		messagesMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"messages": msgList,
			"total":    len(msgList),
		})
		return
	}

	messagesMu.RLock()
	sms, ok := messages[messageID]
	messagesMu.RUnlock()

	if !ok {
		http.Error(w, "Message not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sms)
}

func templatesHandler(w http.ResponseWriter, r *http.Request) {
	templatesMu.RLock()
	tmplList := make([]*SMSTemplate, 0, len(templates))
	for _, t := range templates {
		tmplList = append(tmplList, t)
	}
	templatesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": tmplList,
		"total":     len(tmplList),
	})
}

func twilioWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.ParseForm()
	messageSid := r.FormValue("MessageSid")
	status := r.FormValue("MessageStatus")
	errorCode := r.FormValue("ErrorCode")

	// Update message status
	messagesMu.Lock()
	for _, sms := range messages {
		if sms.StatusCode == messageSid {
			sms.Status = status
			if status == "delivered" {
				now := time.Now()
				sms.DeliveredAt = &now
				smsDeliveryLatency.WithLabelValues("twilio").Observe(now.Sub(sms.CreatedAt).Seconds())
			}
			if errorCode != "" {
				sms.ErrorMessage = errorCode
			}
			break
		}
	}
	messagesMu.Unlock()

	publishEvent("sms.status", map[string]interface{}{
		"provider":    "twilio",
		"message_sid": messageSid,
		"status":      status,
	})

	w.WriteHeader(http.StatusOK)
}

func atWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.ParseForm()
	messageID := r.FormValue("id")
	status := r.FormValue("status")
	failureReason := r.FormValue("failureReason")

	messagesMu.Lock()
	if sms, ok := messages[messageID]; ok {
		sms.Status = status
		if status == "Success" {
			now := time.Now()
			sms.DeliveredAt = &now
			smsDeliveryLatency.WithLabelValues("africastalking").Observe(now.Sub(sms.CreatedAt).Seconds())
		}
		if failureReason != "" {
			sms.ErrorMessage = failureReason
		}
	}
	messagesMu.Unlock()

	publishEvent("sms.status", map[string]interface{}{
		"provider":   "africastalking",
		"message_id": messageID,
		"status":     status,
	})

	w.WriteHeader(http.StatusOK)
}

func processMessageQueue() {
	for sms := range messageQueue {
		smsQueueSize.Set(float64(len(messageQueue)))

		// Simulate sending (in production, call actual provider API)
		time.Sleep(50 * time.Millisecond)

		messagesMu.Lock()
		sms.Status = "sent"
		now := time.Now()
		sms.SentAt = &now
		sms.StatusCode = fmt.Sprintf("%s_%d", sms.Provider, now.UnixNano())
		messagesMu.Unlock()

		smsSentTotal.WithLabelValues(sms.Provider, "sent").Inc()

		publishEvent("sms.sent", map[string]interface{}{
			"message_id": sms.MessageID,
			"to":         sms.To,
			"provider":   sms.Provider,
		})
	}
}

func selectProvider(phoneNumber string) string {
	// Nigerian numbers use AfricasTalking, others use Twilio
	if strings.HasPrefix(phoneNumber, "+234") || strings.HasPrefix(phoneNumber, "234") {
		if atAPIKey != "" {
			return "africastalking"
		}
	}
	if twilioAccountSID != "" {
		return "twilio"
	}
	return "africastalking" // Default
}

func getFromNumber(provider string) string {
	if provider == "twilio" && twilioPhoneNumber != "" {
		return twilioPhoneNumber
	}
	if provider == "africastalking" && atShortCode != "" {
		return atShortCode
	}
	return "FINTECH"
}

func resolveTemplate(body string, variables map[string]string) string {
	result := body
	for key, value := range variables {
		result = strings.ReplaceAll(result, "{"+key+"}", value)
	}
	return result
}

func calculateSegments(body string) int {
	length := len(body)
	if length <= 160 {
		return 1
	}
	return (length + 152) / 153 // 153 chars per segment for multipart
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

func publishEvent(topic string, event map[string]interface{}) {
	if kafkaProducer == nil {
		return
	}

	event["timestamp"] = time.Now().Unix()
	event["service"] = "sms"

	data, _ := json.Marshal(event)
	msg := &sarama.ProducerMessage{
		Topic: topic,
		Value: sarama.ByteEncoder(data),
	}

	kafkaProducer.SendMessage(msg)
}

func verifyTwilioSignature(r *http.Request) bool {
	if twilioAuthToken == "" {
		return true // Skip in dev mode
	}

	signature := r.Header.Get("X-Twilio-Signature")
	if signature == "" {
		return false
	}

	url := "https://" + r.Host + r.URL.Path
	r.ParseForm()

	var params []string
	for key, values := range r.PostForm {
		for _, value := range values {
			params = append(params, key+value)
		}
	}

	data := url + strings.Join(params, "")
	mac := hmac.New(sha256.New, []byte(twilioAuthToken))
	mac.Write([]byte(data))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expected))
}
