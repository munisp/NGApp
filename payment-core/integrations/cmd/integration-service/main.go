// Package main provides the entry point for the unified integration service
package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the service configuration
type Config struct {
	Server struct {
		Port int `yaml:"port"`
	} `yaml:"server"`

	OpenAppSec struct {
		ManagementURL   string        `yaml:"management_url"`
		AgentURL        string        `yaml:"agent_url"`
		APIKey          string        `yaml:"api_key"`
		RefreshInterval time.Duration `yaml:"refresh_interval"`
		EnableBlocking  bool          `yaml:"enable_blocking"`
		EnableLearning  bool          `yaml:"enable_learning"`
	} `yaml:"openappsec"`

	OpenCTI struct {
		URL             string        `yaml:"url"`
		APIToken        string        `yaml:"api_token"`
		RefreshInterval time.Duration `yaml:"refresh_interval"`
		AutoEnforce     bool          `yaml:"auto_enforce"`
		ThreatThreshold float64       `yaml:"threat_threshold"`
		FraudServiceURL string        `yaml:"fraud_service_url"`
		GatewayURL      string        `yaml:"gateway_url"`
	} `yaml:"opencti"`

	Wazuh struct {
		ManagerURL      string        `yaml:"manager_url"`
		APIUser         string        `yaml:"api_user"`
		APIPassword     string        `yaml:"api_password"`
		RefreshInterval time.Duration `yaml:"refresh_interval"`
		AlertThreshold  int           `yaml:"alert_threshold"`
		AuditLogURL     string        `yaml:"audit_log_url"`
		IncidentURL     string        `yaml:"incident_url"`
	} `yaml:"wazuh"`

	OpenSearch struct {
		URL           string        `yaml:"url"`
		Username      string        `yaml:"username"`
		Password      string        `yaml:"password"`
		IndexPrefix   string        `yaml:"index_prefix"`
		RetentionDays int           `yaml:"retention_days"`
		BulkSize      int           `yaml:"bulk_size"`
		FlushInterval time.Duration `yaml:"flush_interval"`
	} `yaml:"opensearch"`

	Kubecost struct {
		URL               string        `yaml:"url"`
		RefreshInterval   time.Duration `yaml:"refresh_interval"`
		CostOptimizerURL  string        `yaml:"cost_optimizer_url"`
		AdminDashboardURL string        `yaml:"admin_dashboard_url"`
		BudgetAlerts      []struct {
			Name      string  `yaml:"name"`
			Namespace string  `yaml:"namespace"`
			Budget    float64 `yaml:"budget"`
			Period    string  `yaml:"period"`
			AlertAt   float64 `yaml:"alert_at"`
		} `yaml:"budget_alerts"`
	} `yaml:"kubecost"`

	Kafka struct {
		Brokers []string `yaml:"brokers"`
		Topic   string   `yaml:"topic"`
	} `yaml:"kafka"`

	Alerting struct {
		WebhookURL string `yaml:"webhook_url"`
	} `yaml:"alerting"`
}

func main() {
	configPath := flag.String("config", "/etc/config/config.yaml", "Path to configuration file")
	flag.Parse()

	// Load configuration
	config, err := loadConfig(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Override with environment variables
	overrideFromEnv(config)

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal")
		cancel()
	}()

	// Start HTTP health server
	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"status":"healthy","service":"integration-service"}`)
		})
		mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"status":"ready","service":"integration-service"}`)
		})
		fmt.Printf("Health server on :%d\n", config.Server.Port)
		http.ListenAndServe(fmt.Sprintf(":%d", config.Server.Port), mux)
	}()

	// Start the unified integration service
	fmt.Printf("Starting Unified Integration Service on port %d\n", config.Server.Port)
	fmt.Println("Integrations:")
	fmt.Printf("  - OpenAppSec: %s\n", config.OpenAppSec.ManagementURL)
	fmt.Printf("  - OpenCTI: %s\n", config.OpenCTI.URL)
	fmt.Printf("  - Wazuh: %s\n", config.Wazuh.ManagerURL)
	fmt.Printf("  - OpenSearch: %s\n", config.OpenSearch.URL)
	fmt.Printf("  - Kubecost: %s\n", config.Kubecost.URL)

	<-ctx.Done()
	fmt.Println("Shutting down...")
}

func loadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &config, nil
}

func overrideFromEnv(config *Config) {
	if v := os.Getenv("OPENAPPSEC_API_KEY"); v != "" {
		config.OpenAppSec.APIKey = v
	}
	if v := os.Getenv("OPENCTI_API_TOKEN"); v != "" {
		config.OpenCTI.APIToken = v
	}
	if v := os.Getenv("WAZUH_API_USER"); v != "" {
		config.Wazuh.APIUser = v
	}
	if v := os.Getenv("WAZUH_API_PASSWORD"); v != "" {
		config.Wazuh.APIPassword = v
	}
	if v := os.Getenv("OPENSEARCH_USERNAME"); v != "" {
		config.OpenSearch.Username = v
	}
	if v := os.Getenv("OPENSEARCH_PASSWORD"); v != "" {
		config.OpenSearch.Password = v
	}
}
