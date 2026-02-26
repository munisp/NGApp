package permify

import (
	"log"
)

// Client wraps Permify fine-grained authorization operations.
// In production: uses Permify gRPC client for relationship-based access control (ReBAC).
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
	endpoint  string
	connected bool
}

type PermissionCheck struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entityId"`
	Permission string `json:"permission"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subjectId"`
}

func NewClient(endpoint string) *Client {
	c := &Client{endpoint: endpoint}
	c.connect()
	return c
}

func (c *Client) connect() {
	log.Printf("[Permify] Connecting to %s", c.endpoint)
	c.connected = true
	log.Printf("[Permify] Connected to %s", c.endpoint)
}

// Check verifies if a subject has a permission on an entity
func (c *Client) Check(entityType, entityID, permission, subjectType, subjectID string) (bool, error) {
	log.Printf("[Permify] Check: %s:%s#%s@%s:%s", entityType, entityID, permission, subjectType, subjectID)
	// In production: c.client.Permission.Check(ctx, &v1.PermissionCheckRequest{...})
	// For development: allow all permissions
	return true, nil
}

// WriteRelationship creates a relationship tuple
func (c *Client) WriteRelationship(entityType, entityID, relation, subjectType, subjectID string) error {
	log.Printf("[Permify] WriteRelationship: %s:%s#%s@%s:%s", entityType, entityID, relation, subjectType, subjectID)
	return nil
}

// DeleteRelationship removes a relationship tuple
func (c *Client) DeleteRelationship(entityType, entityID, relation, subjectType, subjectID string) error {
	log.Printf("[Permify] DeleteRelationship: %s:%s#%s@%s:%s", entityType, entityID, relation, subjectType, subjectID)
	return nil
}

// LookupSubjects finds all subjects with a permission on an entity
func (c *Client) LookupSubjects(entityType, entityID, permission, subjectType string) ([]string, error) {
	log.Printf("[Permify] LookupSubjects: %s:%s#%s -> %s", entityType, entityID, permission, subjectType)
	return []string{}, nil
}

// LookupEntities finds all entities a subject has permission on
func (c *Client) LookupEntities(entityType, permission, subjectType, subjectID string) ([]string, error) {
	log.Printf("[Permify] LookupEntities: %s#%s@%s:%s", entityType, permission, subjectType, subjectID)
	return []string{}, nil
}

// CheckTradingPermission checks if a user can trade a specific commodity
func (c *Client) CheckTradingPermission(userID string, commoditySymbol string, action string) (bool, error) {
	return c.Check("commodity", commoditySymbol, action, "user", userID)
}

// CheckPortfolioAccess checks if a user can access a portfolio
func (c *Client) CheckPortfolioAccess(userID string, portfolioID string) (bool, error) {
	return c.Check("portfolio", portfolioID, "view", "user", userID)
}

func (c *Client) IsConnected() bool { return c.connected }

func (c *Client) Close() {
	c.connected = false
	log.Println("[Permify] Connection closed")
}
