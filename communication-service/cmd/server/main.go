package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/insurance-platform/communication-service/internal/channels"
	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/insurance-platform/communication-service/internal/router"
	"github.com/insurance-platform/communication-service/internal/templates"
	"github.com/insurance-platform/communication-service/pkg/sms"
	"github.com/insurance-platform/communication-service/pkg/telegram"
	"github.com/insurance-platform/communication-service/pkg/ussd"
	"github.com/insurance-platform/communication-service/pkg/whatsapp"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize logger: %v", err))
	}
	defer logger.Sync()

	logger.Info("Starting Communication Service")

	// Load configuration
	config := loadConfig()

	// Initialize database
	db, err := sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		logger.Fatal("Failed to ping database", zap.Error(err))
	}

	logger.Info("Database connected")

	// Initialize Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     config.RedisAddr,
		Password: config.RedisPassword,
		DB:       0,
	})

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		logger.Fatal("Failed to connect to Redis", zap.Error(err))
	}

	logger.Info("Redis connected")

	// Initialize channel clients
	whatsappClient := whatsapp.NewClient(
		config.WhatsAppAPIURL,
		config.WhatsAppAccessToken,
		config.WhatsAppPhoneID,
		logger,
	)

	smsClient := sms.NewClient(
		config.TwilioAccountSID,
		config.TwilioAuthToken,
		config.TwilioFromNumber,
		logger,
	)

	telegramClient, err := telegram.NewClient(config.TelegramBotToken, logger)
	if err != nil {
		logger.Fatal("Failed to initialize Telegram client", zap.Error(err))
	}

	// Initialize template manager
	templateManager := templates.NewManager(db, logger)

	// Initialize default templates
	if err := templateManager.InitializeDefaultTemplates(context.Background()); err != nil {
		logger.Error("Failed to initialize default templates", zap.Error(err))
	}

	// Initialize message router
	messageRouter := router.NewRouter(
		whatsappClient,
		smsClient,
		telegramClient,
		templateManager,
		db,
		logger,
	)

	// Initialize USSD handler
	ussdHandler := ussd.NewHandler(redisClient, db, logger)

	// Start Kafka consumer
	kafkaConsumer := channels.NewKafkaConsumer(
		config.KafkaBrokers,
		config.KafkaTopic,
		config.KafkaGroupID,
		messageRouter,
		logger,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := kafkaConsumer.Start(ctx); err != nil {
			logger.Error("Kafka consumer error", zap.Error(err))
		}
	}()

	// Start Telegram polling
	go func() {
		if err := telegramClient.StartPolling(ctx, func(msg *models.InboundMessage) {
			logger.Info("Received inbound Telegram message",
				zap.String("sender", msg.Sender),
				zap.String("content", msg.Content))
			// Handle inbound message (e.g., save to database, trigger workflow)
		}); err != nil && err != context.Canceled {
			logger.Error("Telegram polling error", zap.Error(err))
		}
	}()

	// Initialize HTTP server
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}).Methods("GET")

	// Send message endpoint
	r.HandleFunc("/api/v1/messages", func(w http.ResponseWriter, r *http.Request) {
		var req models.SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		resp, err := messageRouter.SendMessage(r.Context(), &req)
		if err != nil {
			logger.Error("Failed to send message", zap.Error(err))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}).Methods("POST")

	// Get message status endpoint
	r.HandleFunc("/api/v1/messages/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		messageID := vars["id"]

		message, err := messageRouter.GetMessageStatus(r.Context(), messageID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(message)
	}).Methods("GET")

	// USSD endpoint
	r.HandleFunc("/api/v1/ussd", func(w http.ResponseWriter, r *http.Request) {
		var req models.USSDRequest
		
		// Parse form data (USSD gateways typically send form data)
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		req.SessionID = r.FormValue("sessionId")
		req.PhoneNumber = r.FormValue("phoneNumber")
		req.ServiceCode = r.FormValue("serviceCode")
		req.Text = r.FormValue("text")
		req.NetworkCode = r.FormValue("networkCode")

		resp, err := ussdHandler.HandleRequest(r.Context(), &req)
		if err != nil {
			logger.Error("Failed to handle USSD request", zap.Error(err))
			http.Error(w, "Service temporarily unavailable", http.StatusInternalServerError)
			return
		}

		// Return response in format expected by USSD gateway
		w.Header().Set("Content-Type", "text/plain")
		if resp.Continue {
			fmt.Fprintf(w, "CON %s", resp.Message)
		} else {
			fmt.Fprintf(w, "END %s", resp.Message)
		}
	}).Methods("POST")

	// WhatsApp webhook endpoint
	r.HandleFunc("/api/v1/webhooks/whatsapp", func(w http.ResponseWriter, r *http.Request) {
		// Verify webhook (for initial setup)
		if r.Method == "GET" {
			mode := r.URL.Query().Get("hub.mode")
			token := r.URL.Query().Get("hub.verify_token")
			challenge := r.URL.Query().Get("hub.challenge")

			if mode == "subscribe" && token == config.WhatsAppVerifyToken {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(challenge))
				return
			}
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Handle incoming messages
		body := make([]byte, r.ContentLength)
		r.Body.Read(body)

		inboundMsg, err := whatsappClient.HandleWebhook(r.Context(), body)
		if err != nil {
			logger.Error("Failed to handle WhatsApp webhook", zap.Error(err))
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		if inboundMsg != nil {
			logger.Info("Received inbound WhatsApp message",
				zap.String("sender", inboundMsg.Sender),
				zap.String("content", inboundMsg.Content))
		}

		w.WriteHeader(http.StatusOK)
	}).Methods("GET", "POST")

	// SMS webhook endpoint (Twilio)
	r.HandleFunc("/api/v1/webhooks/sms", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		params := make(map[string]string)
		for key, values := range r.Form {
			if len(values) > 0 {
				params[key] = values[0]
			}
		}

		inboundMsg, err := smsClient.HandleWebhook(r.Context(), params)
		if err != nil {
			logger.Error("Failed to handle SMS webhook", zap.Error(err))
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		if inboundMsg != nil {
			logger.Info("Received inbound SMS",
				zap.String("sender", inboundMsg.Sender),
				zap.String("content", inboundMsg.Content))
		}

		w.WriteHeader(http.StatusOK)
	}).Methods("POST")

	// Start HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", config.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("HTTP server starting", zap.String("port", config.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server error", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("Server forced to shutdown", zap.Error(err))
	}

	cancel() // Cancel context for background goroutines

	logger.Info("Server stopped")
}

// Config holds application configuration
type Config struct {
	Port                  string
	DatabaseURL           string
	RedisAddr             string
	RedisPassword         string
	WhatsAppAPIURL        string
	WhatsAppAccessToken   string
	WhatsAppPhoneID       string
	WhatsAppVerifyToken   string
	TwilioAccountSID      string
	TwilioAuthToken       string
	TwilioFromNumber      string
	TelegramBotToken      string
	KafkaBrokers          []string
	KafkaTopic            string
	KafkaGroupID          string
}

// loadConfig loads configuration from environment variables
func loadConfig() *Config {
	return &Config{
		Port:                  getEnv("PORT", "8080"),
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/communication?sslmode=disable"),
		RedisAddr:             getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:         getEnv("REDIS_PASSWORD", ""),
		WhatsAppAPIURL:        getEnv("WHATSAPP_API_URL", "https://graph.facebook.com/v18.0"),
		WhatsAppAccessToken:   getEnv("WHATSAPP_ACCESS_TOKEN", ""),
		WhatsAppPhoneID:       getEnv("WHATSAPP_PHONE_ID", ""),
		WhatsAppVerifyToken:   getEnv("WHATSAPP_VERIFY_TOKEN", "verify_token_12345"),
		TwilioAccountSID:      getEnv("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:       getEnv("TWILIO_AUTH_TOKEN", ""),
		TwilioFromNumber:      getEnv("TWILIO_FROM_NUMBER", ""),
		TelegramBotToken:      getEnv("TELEGRAM_BOT_TOKEN", ""),
		KafkaBrokers:          []string{getEnv("KAFKA_BROKERS", "localhost:9092")},
		KafkaTopic:            getEnv("KAFKA_TOPIC", "notification-events"),
		KafkaGroupID:          getEnv("KAFKA_GROUP_ID", "communication-service"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
