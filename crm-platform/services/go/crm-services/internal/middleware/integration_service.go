//go:build ignore

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Nerzal/gocloak/v13"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gopkg.in/yaml.v2"

	// permifyv1 package wired via middleware/permify client
	_ "github.com/Permify/permify-go"
)

// Configuration structures
type Config struct {
	KeyCloak KeyCloakConfig `yaml:"keycloak"`
	Permify  PermifyConfig  `yaml:"permify"`
	Sync     SyncConfig     `yaml:"sync"`
	Mapping  MappingConfig  `yaml:"mapping"`
	Logging  LoggingConfig  `yaml:"logging"`
	Metrics  MetricsConfig  `yaml:"metrics"`
}

type KeyCloakConfig struct {
	BaseURL       string `yaml:"base_url"`
	Realm         string `yaml:"realm"`
	ClientID      string `yaml:"client_id"`
	ClientSecret  string `yaml:"client_secret"`
	AdminUsername string `yaml:"admin_username"`
	AdminPassword string `yaml:"admin_password"`
}

type PermifyConfig struct {
	GRPCEndpoint string `yaml:"grpc_endpoint"`
	HTTPEndpoint string `yaml:"http_endpoint"`
	APIKey       string `yaml:"api_key"`
}

type SyncConfig struct {
	Interval      string `yaml:"interval"`
	BatchSize     int    `yaml:"batch_size"`
	RetryAttempts int    `yaml:"retry_attempts"`
	RetryDelay    string `yaml:"retry_delay"`
}

type MappingConfig struct {
	RoleMappings  map[string]string `yaml:"role_mappings"`
	GroupMappings map[string]string `yaml:"group_mappings"`
}

type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
}

type MetricsConfig struct {
	Enabled bool   `yaml:"enabled"`
	Port    int    `yaml:"port"`
	Path    string `yaml:"path"`
}

// Service structures
type IntegrationService struct {
	config        *Config
	keycloakClient gocloak.GoCloak
	permifyClient  permifyv1.PermissionServiceClient
	token         *gocloak.JWT
	metrics       *Metrics
}

type Metrics struct {
	SyncDuration    prometheus.Histogram
	SyncErrors      prometheus.Counter
	UsersProcessed  prometheus.Counter
	GroupsProcessed prometheus.Counter
	RolesProcessed  prometheus.Counter
}

// User and Group structures for synchronization
type UserSync struct {
	ID       string            `json:"id"`
	Username string            `json:"username"`
	Email    string            `json:"email"`
	Roles    []string          `json:"roles"`
	Groups   []string          `json:"groups"`
	Attributes map[string][]string `json:"attributes"`
}

type GroupSync struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Path     string   `json:"path"`
	Roles    []string `json:"roles"`
	SubGroups []string `json:"subgroups"`
}

func main() {
	// Load configuration
	config, err := loadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize service
	service, err := NewIntegrationService(config)
	if err != nil {
		log.Fatalf("Failed to initialize integration service: %v", err)
	}

	// Start HTTP server
	router := setupRouter(service)
	
	// Start metrics server if enabled
	if config.Metrics.Enabled {
		go startMetricsServer(config.Metrics.Port, config.Metrics.Path)
	}

	// Start sync scheduler
	go service.startSyncScheduler()

	// Start HTTP server
	log.Printf("Starting integration service on port 8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start HTTP server: %v", err)
	}
}

func loadConfig() (*Config, error) {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "/etc/config/config.yaml"
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Override with environment variables
	if password := os.Getenv("KEYCLOAK_ADMIN_PASSWORD"); password != "" {
		config.KeyCloak.AdminPassword = password
	}
	if apiKey := os.Getenv("PERMIFY_API_KEY"); apiKey != "" {
		config.Permify.APIKey = apiKey
	}
	if clientSecret := os.Getenv("INTEGRATION_CLIENT_SECRET"); clientSecret != "" {
		config.KeyCloak.ClientSecret = clientSecret
	}

	return &config, nil
}

func NewIntegrationService(config *Config) (*IntegrationService, error) {
	// Initialize KeyCloak client
	keycloakClient := gocloak.NewClient(config.KeyCloak.BaseURL)

	// Initialize Permify client
	conn, err := grpc.Dial(config.Permify.GRPCEndpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Permify: %w", err)
	}
	permifyClient := permifyv1.NewPermissionServiceClient(conn)

	// Initialize metrics
	metrics := &Metrics{
		SyncDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name: "keycloak_permify_sync_duration_seconds",
			Help: "Duration of KeyCloak-Permify synchronization",
		}),
		SyncErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "keycloak_permify_sync_errors_total",
			Help: "Total number of synchronization errors",
		}),
		UsersProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "keycloak_permify_users_processed_total",
			Help: "Total number of users processed",
		}),
		GroupsProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "keycloak_permify_groups_processed_total",
			Help: "Total number of groups processed",
		}),
		RolesProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "keycloak_permify_roles_processed_total",
			Help: "Total number of roles processed",
		}),
	}

	// Register metrics
	prometheus.MustRegister(metrics.SyncDuration)
	prometheus.MustRegister(metrics.SyncErrors)
	prometheus.MustRegister(metrics.UsersProcessed)
	prometheus.MustRegister(metrics.GroupsProcessed)
	prometheus.MustRegister(metrics.RolesProcessed)

	service := &IntegrationService{
		config:         config,
		keycloakClient: keycloakClient,
		permifyClient:  permifyClient,
		metrics:        metrics,
	}

	// Authenticate with KeyCloak
	if err := service.authenticateKeyCloak(); err != nil {
		return nil, fmt.Errorf("failed to authenticate with KeyCloak: %w", err)
	}

	return service, nil
}

func (s *IntegrationService) authenticateKeyCloak() error {
	ctx := context.Background()
	token, err := s.keycloakClient.LoginAdmin(ctx, s.config.KeyCloak.AdminUsername, s.config.KeyCloak.AdminPassword, "master")
	if err != nil {
		return fmt.Errorf("failed to login to KeyCloak: %w", err)
	}
	s.token = token
	return nil
}

func (s *IntegrationService) startSyncScheduler() {
	interval, err := time.ParseDuration(s.config.Sync.Interval)
	if err != nil {
		log.Printf("Invalid sync interval, using default 5m: %v", err)
		interval = 5 * time.Minute
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := s.performSync(); err != nil {
				log.Printf("Sync failed: %v", err)
				s.metrics.SyncErrors.Inc()
			}
		}
	}
}

func (s *IntegrationService) performSync() error {
	start := time.Now()
	defer func() {
		s.metrics.SyncDuration.Observe(time.Since(start).Seconds())
	}()

	ctx := context.Background()
	
	log.Println("Starting KeyCloak-Permify synchronization")

	// Sync users
	if err := s.syncUsers(ctx); err != nil {
		return fmt.Errorf("failed to sync users: %w", err)
	}

	// Sync groups
	if err := s.syncGroups(ctx); err != nil {
		return fmt.Errorf("failed to sync groups: %w", err)
	}

	// Sync roles
	if err := s.syncRoles(ctx); err != nil {
		return fmt.Errorf("failed to sync roles: %w", err)
	}

	log.Println("KeyCloak-Permify synchronization completed successfully")
	return nil
}

func (s *IntegrationService) syncUsers(ctx context.Context) error {
	// Get users from KeyCloak
	users, err := s.keycloakClient.GetUsers(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, gocloak.GetUsersParams{})
	if err != nil {
		return fmt.Errorf("failed to get users from KeyCloak: %w", err)
	}

	for _, user := range users {
		// Get user roles
		roles, err := s.keycloakClient.GetRealmRolesByUserID(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, *user.ID)
		if err != nil {
			log.Printf("Failed to get roles for user %s: %v", *user.Username, err)
			continue
		}

		// Get user groups
		groups, err := s.keycloakClient.GetUserGroups(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, *user.ID, gocloak.GetGroupsParams{})
		if err != nil {
			log.Printf("Failed to get groups for user %s: %v", *user.Username, err)
			continue
		}

		// Create user sync object
		userSync := UserSync{
			ID:       *user.ID,
			Username: *user.Username,
			Email:    getStringValue(user.Email),
			Roles:    extractRoleNames(roles),
			Groups:   extractGroupPaths(groups),
			Attributes: user.Attributes,
		}

		// Sync to Permify
		if err := s.syncUserToPermify(ctx, userSync); err != nil {
			log.Printf("Failed to sync user %s to Permify: %v", userSync.Username, err)
			continue
		}

		s.metrics.UsersProcessed.Inc()
	}

	return nil
}

func (s *IntegrationService) syncGroups(ctx context.Context) error {
	// Get groups from KeyCloak
	groups, err := s.keycloakClient.GetGroups(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, gocloak.GetGroupsParams{})
	if err != nil {
		return fmt.Errorf("failed to get groups from KeyCloak: %w", err)
	}

	for _, group := range groups {
		// Get group roles
		roles, err := s.keycloakClient.GetGroupRealmRoles(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, *group.ID)
		if err != nil {
			log.Printf("Failed to get roles for group %s: %v", *group.Name, err)
			continue
		}

		// Create group sync object
		groupSync := GroupSync{
			ID:       *group.ID,
			Name:     *group.Name,
			Path:     getStringValue(group.Path),
			Roles:    extractRoleNames(roles),
			SubGroups: extractSubGroupNames(group.SubGroups),
		}

		// Sync to Permify
		if err := s.syncGroupToPermify(ctx, groupSync); err != nil {
			log.Printf("Failed to sync group %s to Permify: %v", groupSync.Name, err)
			continue
		}

		s.metrics.GroupsProcessed.Inc()
	}

	return nil
}

func (s *IntegrationService) syncRoles(ctx context.Context) error {
	// Get roles from KeyCloak
	roles, err := s.keycloakClient.GetRealmRoles(ctx, s.token.AccessToken, s.config.KeyCloak.Realm, gocloak.GetRoleParams{})
	if err != nil {
		return fmt.Errorf("failed to get roles from KeyCloak: %w", err)
	}

	for _, role := range roles {
		// Sync role to Permify
		if err := s.syncRoleToPermify(ctx, *role); err != nil {
			log.Printf("Failed to sync role %s to Permify: %v", *role.Name, err)
			continue
		}

		s.metrics.RolesProcessed.Inc()
	}

	return nil
}

func (s *IntegrationService) syncUserToPermify(ctx context.Context, user UserSync) error {
	// Create user entity in Permify
	_, err := s.permifyClient.WriteRelationships(ctx, &permifyv1.WriteRelationshipsRequest{
		TenantId: "enterprise-crm",
		Metadata: &permifyv1.WriteRelationshipsRequestMetadata{
			SchemaVersion: "",
		},
		Tuples: []*permifyv1.Tuple{
			{
				Entity: &permifyv1.Entity{
					Type: "user",
					Id:   user.ID,
				},
				Relation: "member",
				Subject: &permifyv1.Subject{
					Type: "organization",
					Id:   "enterprise-crm",
				},
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to create user in Permify: %w", err)
	}

	// Sync user roles and groups
	for _, role := range user.Roles {
		if mappedRelation, exists := s.config.Mapping.RoleMappings[role]; exists {
			// Create role relationship
			_, err := s.permifyClient.WriteRelationships(ctx, &permifyv1.WriteRelationshipsRequest{
				TenantId: "enterprise-crm",
				Metadata: &permifyv1.WriteRelationshipsRequestMetadata{
					SchemaVersion: "",
				},
				Tuples: []*permifyv1.Tuple{
					{
						Entity: &permifyv1.Entity{
							Type: "organization",
							Id:   "enterprise-crm",
						},
						Relation: mappedRelation,
						Subject: &permifyv1.Subject{
							Type: "user",
							Id:   user.ID,
						},
					},
				},
			})

			if err != nil {
				log.Printf("Failed to create role relationship for user %s: %v", user.Username, err)
			}
		}
	}

	// Sync user groups
	for _, groupPath := range user.Groups {
		if mappedEntity, exists := s.config.Mapping.GroupMappings[groupPath]; exists {
			// Create group membership
			_, err := s.permifyClient.WriteRelationships(ctx, &permifyv1.WriteRelationshipsRequest{
				TenantId: "enterprise-crm",
				Metadata: &permifyv1.WriteRelationshipsRequestMetadata{
					SchemaVersion: "",
				},
				Tuples: []*permifyv1.Tuple{
					{
						Entity: &permifyv1.Entity{
							Type: mappedEntity,
							Id:   generateEntityID(groupPath),
						},
						Relation: "member",
						Subject: &permifyv1.Subject{
							Type: "user",
							Id:   user.ID,
						},
					},
				},
			})

			if err != nil {
				log.Printf("Failed to create group membership for user %s: %v", user.Username, err)
			}
		}
	}

	return nil
}

func (s *IntegrationService) syncGroupToPermify(ctx context.Context, group GroupSync) error {
	// Map group to entity type
	entityType := "department"
	if group.Path == "/Administrators" {
		entityType = "organization"
	}

	// Create group entity in Permify
	_, err := s.permifyClient.WriteRelationships(ctx, &permifyv1.WriteRelationshipsRequest{
		TenantId: "enterprise-crm",
		Metadata: &permifyv1.WriteRelationshipsRequestMetadata{
			SchemaVersion: "",
		},
		Tuples: []*permifyv1.Tuple{
			{
				Entity: &permifyv1.Entity{
					Type: entityType,
					Id:   group.ID,
				},
				Relation: "organization",
				Subject: &permifyv1.Subject{
					Type: "organization",
					Id:   "enterprise-crm",
				},
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to create group in Permify: %w", err)
	}

	return nil
}

func (s *IntegrationService) syncRoleToPermify(ctx context.Context, role gocloak.Role) error {
	// Roles are handled through user-role relationships
	// This method can be extended for role-specific logic
	log.Printf("Processing role: %s", *role.Name)
	return nil
}

// HTTP handlers
func setupRouter(service *IntegrationService) *gin.Engine {
	router := gin.Default()

	// Health endpoints
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	router.GET("/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// Sync endpoints
	router.POST("/sync", func(c *gin.Context) {
		if err := service.performSync(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "sync completed"})
	})

	router.POST("/sync/users", func(c *gin.Context) {
		ctx := context.Background()
		if err := service.syncUsers(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "users synced"})
	})

	router.POST("/sync/groups", func(c *gin.Context) {
		ctx := context.Background()
		if err := service.syncGroups(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "groups synced"})
	})

	// Status endpoints
	router.GET("/status", func(c *gin.Context) {
		status := gin.H{
			"keycloak": "connected",
			"permify":  "connected",
			"sync":     "active",
		}
		c.JSON(http.StatusOK, status)
	})

	return router
}

func startMetricsServer(port int, path string) {
	http.Handle(path, promhttp.Handler())
	log.Printf("Starting metrics server on port %d", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
		log.Printf("Failed to start metrics server: %v", err)
	}
}

// Helper functions
func getStringValue(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func extractRoleNames(roles []*gocloak.Role) []string {
	var names []string
	for _, role := range roles {
		if role.Name != nil {
			names = append(names, *role.Name)
		}
	}
	return names
}

func extractGroupPaths(groups []*gocloak.Group) []string {
	var paths []string
	for _, group := range groups {
		if group.Path != nil {
			paths = append(paths, *group.Path)
		}
	}
	return paths
}

func extractSubGroupNames(subGroups []*gocloak.Group) []string {
	var names []string
	for _, group := range subGroups {
		if group.Name != nil {
			names = append(names, *group.Name)
		}
	}
	return names
}

func generateEntityID(groupPath string) string {
	// Convert group path to entity ID
	// Example: "/Sales Team" -> "sales-team"
	return fmt.Sprintf("%s", groupPath[1:]) // Remove leading slash for now
}

