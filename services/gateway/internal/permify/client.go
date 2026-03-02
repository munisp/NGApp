package permify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
)

// Client wraps Permify fine-grained authorization with real HTTP/gRPC connectivity.
// Schema defines:
//   entity user {}
//   entity organization { relation member @user; relation admin @user }
//   entity commodity { relation exchange @organization }
//   entity order { relation owner @user; relation commodity @commodity }
//   entity portfolio { relation owner @user }
//   entity alert { relation owner @user }
//   entity report { relation viewer @user; relation organization @organization }
//
// Permission model:
//   Farmers: can trade agricultural commodities, view own portfolio
//   Retail traders: can trade all commodities, full portfolio access
//   Institutional: all permissions + bulk orders + API access + advanced analytics
//   Cooperative: shared portfolio management, delegated trading
type Client struct {
	endpoint     string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	httpClient   *http.Client
	cb           *gobreaker.CircuitBreaker[[]byte]
	ctx          context.Context
	cancel       context.CancelFunc
	// In-memory relationship tuples for fallback
	relationships []RelationshipTuple
}

type PermissionCheck struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entityId"`
	Permission string `json:"permission"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subjectId"`
}

type RelationshipTuple struct {
	EntityType  string `json:"entityType"`
	EntityID    string `json:"entityId"`
	Relation    string `json:"relation"`
	SubjectType string `json:"subjectType"`
	SubjectID   string `json:"subjectId"`
}

// TenantID is the Permify tenant for NEXCOM Exchange.
// Supports multi-tenancy: each exchange instance gets its own tenant.
var TenantID = getEnvOrDefault("PERMIFY_TENANT_ID", "nexcom")

func getEnvOrDefault(key, fallback string) string {
	val, ok := os.LookupEnv(key)
	if ok && val != "" {
		return val
	}
	return fallback
}

// NexcomPermifySchema defines the full authorization model for NEXCOM Exchange.
// This is written to Permify on startup to bootstrap the permission system.
const NexcomPermifySchema = `
entity user {}

entity organization {
    relation member @user
    relation admin @user
    relation compliance_officer @user

    permission manage = admin
    permission view = admin or member or compliance_officer
}

entity commodity {
    relation exchange @organization
    relation listed_by @user

    permission trade = exchange.member
    permission view = exchange.member
    permission delist = exchange.admin
}

entity order {
    relation owner @user
    relation commodity @commodity

    permission view = owner
    permission cancel = owner
    permission list = owner
}

entity portfolio {
    relation owner @user
    relation delegate @user

    permission view = owner or delegate
    permission trade = owner
    permission manage = owner
}

entity alert {
    relation owner @user

    permission view = owner
    permission edit = owner
    permission delete = owner
}

entity report {
    relation viewer @user
    relation organization @organization

    permission view = viewer or organization.admin or organization.compliance_officer
    permission export = organization.admin
}

entity kyc_application {
    relation applicant @user
    relation reviewer @user
    relation organization @organization

    permission view = applicant or reviewer or organization.compliance_officer
    permission approve = reviewer or organization.compliance_officer
    permission reject = reviewer or organization.compliance_officer
}

entity warehouse_receipt {
    relation owner @user
    relation warehouse @organization

    permission view = owner or warehouse.member
    permission transfer = owner
    permission verify = warehouse.admin
}

entity digital_asset {
    relation issuer @user
    relation holder @user
    relation exchange @organization

    permission trade = holder or exchange.member
    permission view = holder or exchange.member
    permission transfer = holder
    permission fractionalize = issuer or exchange.admin
}

entity surveillance_alert {
    relation organization @organization

    permission view = organization.compliance_officer or organization.admin
    permission resolve = organization.compliance_officer
}

entity settlement {
    relation buyer @user
    relation seller @user
    relation exchange @organization

    permission view = buyer or seller or exchange.admin
    permission finalize = exchange.admin
}
`

func NewClient(endpoint string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		endpoint:      endpoint,
		relationships: make([]RelationshipTuple, 0),
		httpClient:    &http.Client{Timeout: 5 * time.Second},
		ctx:           ctx,
		cancel:        cancel,
	}
	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name: "permify", MaxRequests: 3, Interval: 30 * time.Second, Timeout: 10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool { return counts.ConsecutiveFailures >= 5 },
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Permify] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})
	c.connect()
	if c.connected {
		c.bootstrapSchema()
		c.seedDefaultRelationships()
	}
	go c.reconnectLoop()
	return c
}

func (c *Client) connect() {
	log.Printf("[Permify] Connecting to %s (tenant: %s)", c.endpoint, TenantID)

	conn, err := net.DialTimeout("tcp", c.endpoint, 3*time.Second)
	if err != nil {
		log.Printf("[Permify] WARN: Cannot reach %s: %v -- fallback mode", c.endpoint, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}
	conn.Close()

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Permify] Connected to %s (TCP verified)", c.endpoint)
}

func (c *Client) reconnectLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			fb := c.fallbackMode
			c.mu.RUnlock()
			if fb {
				log.Printf("[Permify] Attempting reconnection to %s...", c.endpoint)
				c.connect()
				c.mu.RLock()
				nowConnected := c.connected
				c.mu.RUnlock()
				if nowConnected {
					c.bootstrapSchema()
					c.seedDefaultRelationships()
				}
			}
		}
	}
}

// bootstrapSchema writes the NEXCOM authorization schema to Permify on startup.
func (c *Client) bootstrapSchema() {
	log.Printf("[Permify] Bootstrapping authorization schema for tenant %s", TenantID)

	reqBody := map[string]interface{}{
		"schema": NexcomPermifySchema,
	}
	body, _ := json.Marshal(reqBody)
	url := fmt.Sprintf("http://%s/v1/tenants/%s/schemas/write", c.endpoint, TenantID)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[Permify] WARN: Schema bootstrap failed: %v", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if json.Unmarshal(respBody, &result) == nil {
		if version, ok := result["schema_version"].(string); ok {
			log.Printf("[Permify] Schema bootstrapped successfully (version: %s)", version)
			return
		}
	}
	log.Printf("[Permify] Schema write response: %s", string(respBody))
}

// seedDefaultRelationships creates the initial NEXCOM organization and admin relationships.
func (c *Client) seedDefaultRelationships() {
	log.Printf("[Permify] Seeding default relationships")

	// Create NEXCOM organization with default admin
	defaultRelationships := []RelationshipTuple{
		{EntityType: "organization", EntityID: "nexcom", Relation: "admin", SubjectType: "user", SubjectID: "admin-001"},
		{EntityType: "organization", EntityID: "nexcom", Relation: "member", SubjectType: "user", SubjectID: "admin-001"},
		{EntityType: "organization", EntityID: "nexcom", Relation: "compliance_officer", SubjectType: "user", SubjectID: "admin-001"},
		// Demo trader
		{EntityType: "organization", EntityID: "nexcom", Relation: "member", SubjectType: "user", SubjectID: "usr-001"},
		{EntityType: "portfolio", EntityID: "portfolio-usr-001", Relation: "owner", SubjectType: "user", SubjectID: "usr-001"},
		// List default commodities on the exchange
		{EntityType: "commodity", EntityID: "CORN", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "WHEAT", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "SOYBEAN", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "GOLD", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "CRUDE_OIL", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "COCOA", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "COFFEE", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "COTTON", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
		{EntityType: "commodity", EntityID: "COPPER", Relation: "exchange", SubjectType: "organization", SubjectID: "nexcom"},
	}

	for _, rel := range defaultRelationships {
		if err := c.WriteRelationship(rel.EntityType, rel.EntityID, rel.Relation, rel.SubjectType, rel.SubjectID); err != nil {
			log.Printf("[Permify] WARN: Failed to seed relationship: %v", err)
		}
	}

	log.Printf("[Permify] Seeded %d default relationships", len(defaultRelationships))
}

// Check verifies if a subject has a permission on an entity.
// In production mode (ENVIRONMENT=production), denies by default when Permify is unreachable.
// In development mode, allows access when Permify is unreachable to enable local development.
func (c *Client) Check(entityType, entityID, permission, subjectType, subjectID string) (bool, error) {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		// Real Permify permission check via REST API
		reqBody := map[string]interface{}{
			"metadata": map[string]interface{}{
				"schema_version": "",
				"snap_token":     "",
				"depth":          20,
			},
			"entity": map[string]string{
				"type": entityType,
				"id":   entityID,
			},
			"permission": permission,
			"subject": map[string]interface{}{
				"type": subjectType,
				"id":   subjectID,
			},
		}
		body, _ := json.Marshal(reqBody)
		url := fmt.Sprintf("http://%s/v1/tenants/%s/permissions/check", c.endpoint, TenantID)
		resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(body))
		if err == nil {
			defer resp.Body.Close()
			respBody, _ := io.ReadAll(resp.Body)
			var result map[string]interface{}
			if json.Unmarshal(respBody, &result) == nil {
				if can, ok := result["can"].(string); ok {
					return can == "CHECK_RESULT_ALLOWED", nil
				}
			}
		}
		log.Printf("[Permify] WARN: Permission check via API failed, using fallback")
	}

	// Fallback: check in-memory relationships
	c.mu.RLock()
	for _, rel := range c.relationships {
		if rel.EntityType == entityType && rel.EntityID == entityID &&
			rel.Relation == permission && rel.SubjectType == subjectType &&
			rel.SubjectID == subjectID {
			c.mu.RUnlock()
			return true, nil
		}
	}
	c.mu.RUnlock()

	// Production: deny by default when no relationship found
	env := getEnvOrDefault("ENVIRONMENT", "development")
	if env == "production" {
		log.Printf("[Permify] DENIED: %s:%s#%s@%s:%s (production mode)", entityType, entityID, permission, subjectType, subjectID)
		return false, nil
	}

	// Development: allow to enable local development without Permify running
	return true, nil
}

// WriteRelationship creates a relationship tuple
func (c *Client) WriteRelationship(entityType, entityID, relation, subjectType, subjectID string) error {
	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		reqBody := map[string]interface{}{
			"metadata": map[string]interface{}{
				"schema_version": "",
			},
			"tuples": []map[string]interface{}{
				{
					"entity":   map[string]string{"type": entityType, "id": entityID},
					"relation": relation,
					"subject":  map[string]interface{}{"type": subjectType, "id": subjectID},
				},
			},
		}
		body, _ := json.Marshal(reqBody)
		url := fmt.Sprintf("http://%s/v1/tenants/%s/relationships/write", c.endpoint, TenantID)
		resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(body))
		if err == nil {
			resp.Body.Close()
			log.Printf("[Permify] WriteRelationship: %s:%s#%s@%s:%s (via API)", entityType, entityID, relation, subjectType, subjectID)
			return nil
		}
	}

	// Fallback: store in memory
	c.mu.Lock()
	c.relationships = append(c.relationships, RelationshipTuple{
		EntityType: entityType, EntityID: entityID, Relation: relation,
		SubjectType: subjectType, SubjectID: subjectID,
	})
	c.mu.Unlock()
	log.Printf("[Permify] WriteRelationship: %s:%s#%s@%s:%s (fallback)", entityType, entityID, relation, subjectType, subjectID)
	return nil
}

// DeleteRelationship removes a relationship tuple
func (c *Client) DeleteRelationship(entityType, entityID, relation, subjectType, subjectID string) error {
	c.mu.Lock()
	for i, rel := range c.relationships {
		if rel.EntityType == entityType && rel.EntityID == entityID &&
			rel.Relation == relation && rel.SubjectType == subjectType &&
			rel.SubjectID == subjectID {
			c.relationships = append(c.relationships[:i], c.relationships[i+1:]...)
			break
		}
	}
	c.mu.Unlock()
	log.Printf("[Permify] DeleteRelationship: %s:%s#%s@%s:%s", entityType, entityID, relation, subjectType, subjectID)
	return nil
}

// LookupSubjects finds all subjects with a permission on an entity
func (c *Client) LookupSubjects(entityType, entityID, permission, subjectType string) ([]string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var subjects []string
	for _, rel := range c.relationships {
		if rel.EntityType == entityType && rel.EntityID == entityID &&
			rel.Relation == permission && rel.SubjectType == subjectType {
			subjects = append(subjects, rel.SubjectID)
		}
	}
	return subjects, nil
}

// LookupEntities finds all entities a subject has permission on
func (c *Client) LookupEntities(entityType, permission, subjectType, subjectID string) ([]string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var entities []string
	for _, rel := range c.relationships {
		if rel.EntityType == entityType && rel.Relation == permission &&
			rel.SubjectType == subjectType && rel.SubjectID == subjectID {
			entities = append(entities, rel.EntityID)
		}
	}
	return entities, nil
}

// CheckTradingPermission checks if a user can trade a specific commodity
func (c *Client) CheckTradingPermission(userID string, commoditySymbol string, action string) (bool, error) {
	return c.Check("commodity", commoditySymbol, action, "user", userID)
}

// CheckPortfolioAccess checks if a user can access a portfolio
func (c *Client) CheckPortfolioAccess(userID string, portfolioID string) (bool, error) {
	return c.Check("portfolio", portfolioID, "view", "user", userID)
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

func (c *Client) Close() {
	c.cancel()
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[Permify] Connection closed")
}
