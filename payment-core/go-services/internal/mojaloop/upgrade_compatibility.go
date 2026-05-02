// Package mojaloop provides Mojaloop upgrade compatibility layer
package mojaloop

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// UpgradeCompatibilityLayer provides clean adapter boundary for Mojaloop upgrades
// Minimizes fork divergence and preserves upstream upgrade paths
type UpgradeCompatibilityLayer struct {
	// Version adapters
	adapters map[string]VersionAdapter
	
	// Current active version
	activeVersion string
	
	// Schema registry for API versioning
	schemaRegistry *SchemaRegistry
	
	// Migration manager
	migrationMgr *MigrationManager
	
	// Stats
	requestsHandled uint64
	versionMismatches uint64
	
	mu sync.RWMutex
}

// VersionAdapter adapts between Mojaloop API versions
type VersionAdapter interface {
	// Version returns the adapter version
	Version() string
	
	// TransformRequest transforms a request to internal format
	TransformRequest(ctx context.Context, req interface{}) (interface{}, error)
	
	// TransformResponse transforms a response to external format
	TransformResponse(ctx context.Context, resp interface{}) (interface{}, error)
	
	// ValidateRequest validates a request against the version schema
	ValidateRequest(ctx context.Context, req interface{}) error
	
	// SupportedOperations returns supported operations for this version
	SupportedOperations() []string
}

// SchemaRegistry manages API schemas across versions
type SchemaRegistry struct {
	schemas map[string]map[string]interface{} // version -> operation -> schema
	mu      sync.RWMutex
}

// MigrationManager handles data migrations between versions
type MigrationManager struct {
	migrations []Migration
	applied    map[string]bool
	mu         sync.RWMutex
}

// Migration represents a data migration
type Migration struct {
	ID          string
	FromVersion string
	ToVersion   string
	Description string
	Up          func(ctx context.Context) error
	Down        func(ctx context.Context) error
	AppliedAt   *time.Time
}

// NewUpgradeCompatibilityLayer creates a new upgrade compatibility layer
func NewUpgradeCompatibilityLayer() *UpgradeCompatibilityLayer {
	layer := &UpgradeCompatibilityLayer{
		adapters:       make(map[string]VersionAdapter),
		schemaRegistry: NewSchemaRegistry(),
		migrationMgr:   NewMigrationManager(),
	}
	
	// Register default adapters
	layer.RegisterAdapter(NewV1Adapter())
	layer.RegisterAdapter(NewV2Adapter())
	
	// Set active version
	layer.activeVersion = "v2"
	
	return layer
}

// RegisterAdapter registers a version adapter
func (l *UpgradeCompatibilityLayer) RegisterAdapter(adapter VersionAdapter) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.adapters[adapter.Version()] = adapter
}

// HandleRequest handles a request with version compatibility
func (l *UpgradeCompatibilityLayer) HandleRequest(ctx context.Context, version string, operation string, req interface{}) (interface{}, error) {
	l.mu.RLock()
	adapter, ok := l.adapters[version]
	if !ok {
		l.mu.RUnlock()
		return nil, fmt.Errorf("unsupported version: %s", version)
	}
	l.mu.RUnlock()
	
	// Validate request
	if err := adapter.ValidateRequest(ctx, req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// Transform to internal format
	internalReq, err := adapter.TransformRequest(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("request transformation failed: %w", err)
	}
	
	// Process request (would call actual Mojaloop service)
	internalResp, err := l.processRequest(ctx, operation, internalReq)
	if err != nil {
		return nil, err
	}
	
	// Transform response to external format
	resp, err := adapter.TransformResponse(ctx, internalResp)
	if err != nil {
		return nil, fmt.Errorf("response transformation failed: %w", err)
	}
	
	return resp, nil
}

// processRequest processes the internal request
func (l *UpgradeCompatibilityLayer) processRequest(ctx context.Context, operation string, req interface{}) (interface{}, error) {
	// This would call the actual Mojaloop service
	// For now, return a placeholder
	return map[string]interface{}{
		"status": "success",
		"operation": operation,
	}, nil
}

// GetActiveVersion returns the active version
func (l *UpgradeCompatibilityLayer) GetActiveVersion() string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.activeVersion
}

// SetActiveVersion sets the active version
func (l *UpgradeCompatibilityLayer) SetActiveVersion(version string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	
	if _, ok := l.adapters[version]; !ok {
		return fmt.Errorf("version not registered: %s", version)
	}
	
	l.activeVersion = version
	return nil
}

// NewSchemaRegistry creates a new schema registry
func NewSchemaRegistry() *SchemaRegistry {
	return &SchemaRegistry{
		schemas: make(map[string]map[string]interface{}),
	}
}

// RegisterSchema registers a schema for a version and operation
func (r *SchemaRegistry) RegisterSchema(version, operation string, schema interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if r.schemas[version] == nil {
		r.schemas[version] = make(map[string]interface{})
	}
	r.schemas[version][operation] = schema
}

// GetSchema retrieves a schema
func (r *SchemaRegistry) GetSchema(version, operation string) (interface{}, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	if ops, ok := r.schemas[version]; ok {
		schema, ok := ops[operation]
		return schema, ok
	}
	return nil, false
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager() *MigrationManager {
	return &MigrationManager{
		migrations: make([]Migration, 0),
		applied:    make(map[string]bool),
	}
}

// RegisterMigration registers a migration
func (m *MigrationManager) RegisterMigration(migration Migration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.migrations = append(m.migrations, migration)
}

// ApplyMigrations applies pending migrations
func (m *MigrationManager) ApplyMigrations(ctx context.Context, targetVersion string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	for _, migration := range m.migrations {
		if m.applied[migration.ID] {
			continue
		}
		
		if migration.ToVersion == targetVersion || migration.ToVersion < targetVersion {
			if err := migration.Up(ctx); err != nil {
				return fmt.Errorf("migration %s failed: %w", migration.ID, err)
			}
			
			now := time.Now()
			migration.AppliedAt = &now
			m.applied[migration.ID] = true
		}
	}
	
	return nil
}

// V1Adapter adapts Mojaloop v1 API
type V1Adapter struct {
	version string
}

// NewV1Adapter creates a new v1 adapter
func NewV1Adapter() *V1Adapter {
	return &V1Adapter{version: "v1"}
}

func (a *V1Adapter) Version() string { return a.version }

func (a *V1Adapter) TransformRequest(ctx context.Context, req interface{}) (interface{}, error) {
	// Transform v1 request to internal format
	reqMap, ok := req.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid request format")
	}
	
	// V1 uses different field names
	internal := make(map[string]interface{})
	
	// Map v1 fields to internal fields
	if transferId, ok := reqMap["transferId"]; ok {
		internal["transfer_id"] = transferId
	}
	if payerFsp, ok := reqMap["payerFsp"]; ok {
		internal["payer_fsp_id"] = payerFsp
	}
	if payeeFsp, ok := reqMap["payeeFsp"]; ok {
		internal["payee_fsp_id"] = payeeFsp
	}
	if amount, ok := reqMap["amount"]; ok {
		internal["amount"] = amount
	}
	
	return internal, nil
}

func (a *V1Adapter) TransformResponse(ctx context.Context, resp interface{}) (interface{}, error) {
	// Transform internal response to v1 format
	respMap, ok := resp.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format")
	}
	
	external := make(map[string]interface{})
	
	// Map internal fields to v1 fields
	if transferId, ok := respMap["transfer_id"]; ok {
		external["transferId"] = transferId
	}
	if status, ok := respMap["status"]; ok {
		external["transferState"] = status
	}
	
	return external, nil
}

func (a *V1Adapter) ValidateRequest(ctx context.Context, req interface{}) error {
	reqMap, ok := req.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid request format")
	}
	
	// V1 required fields
	required := []string{"transferId", "payerFsp", "payeeFsp", "amount"}
	for _, field := range required {
		if _, ok := reqMap[field]; !ok {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	
	return nil
}

func (a *V1Adapter) SupportedOperations() []string {
	return []string{
		"POST /transfers",
		"GET /transfers/{id}",
		"PUT /transfers/{id}",
		"POST /quotes",
		"GET /quotes/{id}",
		"POST /parties/{type}/{id}",
		"GET /parties/{type}/{id}",
	}
}

// V2Adapter adapts Mojaloop v2 API
type V2Adapter struct {
	version string
}

// NewV2Adapter creates a new v2 adapter
func NewV2Adapter() *V2Adapter {
	return &V2Adapter{version: "v2"}
}

func (a *V2Adapter) Version() string { return a.version }

func (a *V2Adapter) TransformRequest(ctx context.Context, req interface{}) (interface{}, error) {
	// V2 uses internal format directly
	return req, nil
}

func (a *V2Adapter) TransformResponse(ctx context.Context, resp interface{}) (interface{}, error) {
	// V2 uses internal format directly
	return resp, nil
}

func (a *V2Adapter) ValidateRequest(ctx context.Context, req interface{}) error {
	reqMap, ok := req.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid request format")
	}
	
	// V2 required fields (snake_case)
	required := []string{"transfer_id", "payer_fsp_id", "payee_fsp_id", "amount"}
	for _, field := range required {
		if _, ok := reqMap[field]; !ok {
			return fmt.Errorf("missing required field: %s", field)
		}
	}
	
	return nil
}

func (a *V2Adapter) SupportedOperations() []string {
	return []string{
		"POST /v2/transfers",
		"GET /v2/transfers/{id}",
		"PUT /v2/transfers/{id}",
		"DELETE /v2/transfers/{id}",
		"POST /v2/quotes",
		"GET /v2/quotes/{id}",
		"POST /v2/parties/{type}/{id}",
		"GET /v2/parties/{type}/{id}",
		"POST /v2/bulk-transfers",
		"POST /v2/fx-quotes",
	}
}

// UpgradeReport generates an upgrade compatibility report
type UpgradeReport struct {
	CurrentVersion    string                 `json:"current_version"`
	TargetVersion     string                 `json:"target_version"`
	CompatibilityScore float64               `json:"compatibility_score"`
	BreakingChanges   []BreakingChange       `json:"breaking_changes"`
	Migrations        []MigrationInfo        `json:"migrations"`
	Recommendations   []string               `json:"recommendations"`
}

// BreakingChange represents a breaking change
type BreakingChange struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Impact      string `json:"impact"`
	Mitigation  string `json:"mitigation"`
}

// MigrationInfo represents migration information
type MigrationInfo struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Reversible  bool   `json:"reversible"`
}

// GenerateUpgradeReport generates an upgrade compatibility report
func (l *UpgradeCompatibilityLayer) GenerateUpgradeReport(currentVersion, targetVersion string) (*UpgradeReport, error) {
	report := &UpgradeReport{
		CurrentVersion:    currentVersion,
		TargetVersion:     targetVersion,
		CompatibilityScore: 0.95, // Would be calculated based on actual analysis
		BreakingChanges:   make([]BreakingChange, 0),
		Migrations:        make([]MigrationInfo, 0),
		Recommendations:   make([]string, 0),
	}
	
	// Analyze breaking changes
	if currentVersion == "v1" && targetVersion == "v2" {
		report.BreakingChanges = append(report.BreakingChanges, BreakingChange{
			Type:        "FIELD_RENAME",
			Description: "Field names changed from camelCase to snake_case",
			Impact:      "All API clients need to update field names",
			Mitigation:  "Use version adapter to transform requests/responses",
		})
		
		report.BreakingChanges = append(report.BreakingChanges, BreakingChange{
			Type:        "NEW_REQUIRED_FIELD",
			Description: "correlation_id is now required on all requests",
			Impact:      "Clients without correlation_id will fail validation",
			Mitigation:  "Generate correlation_id if not provided",
		})
	}
	
	// List required migrations
	l.migrationMgr.mu.RLock()
	for _, m := range l.migrationMgr.migrations {
		if m.ToVersion == targetVersion {
			report.Migrations = append(report.Migrations, MigrationInfo{
				ID:          m.ID,
				Description: m.Description,
				Reversible:  m.Down != nil,
			})
		}
	}
	l.migrationMgr.mu.RUnlock()
	
	// Add recommendations
	report.Recommendations = []string{
		"Run migrations in a maintenance window",
		"Test with shadow traffic before full cutover",
		"Keep v1 adapter active for 30 days after upgrade",
		"Monitor error rates closely during transition",
	}
	
	return report, nil
}
