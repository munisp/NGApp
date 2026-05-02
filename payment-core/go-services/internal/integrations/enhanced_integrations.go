// Package integrations provides enhanced integration features
// Priority 6: Multi-Provider Fallback, UBO Verification, List Management
package integrations

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// =============================================================================
// Priority 6.1: Multi-Provider Fallback for AML/Sanctions
// =============================================================================

// MultiProviderAMLService provides multi-provider AML screening with fallback
type MultiProviderAMLService struct {
	providers       []AMLProvider
	primaryIdx      int
	circuitBreakers map[string]*CircuitBreaker
	cache           *AMLCache
	db              *sql.DB
	mu              sync.RWMutex
}

// AMLProvider interface for AML screening providers
type AMLProvider interface {
	GetName() string
	Screen(ctx context.Context, request *AMLScreeningRequest) (*AMLScreeningResult, error)
	GetHealthStatus() ProviderHealth
	GetPriority() int
}

// ProviderHealth represents provider health status
type ProviderHealth struct {
	Healthy       bool      `json:"healthy"`
	LastCheck     time.Time `json:"last_check"`
	SuccessRate   float64   `json:"success_rate"`
	AvgLatencyMs  int64     `json:"avg_latency_ms"`
	ErrorCount    int64     `json:"error_count"`
}

// AMLScreeningRequest represents an AML screening request
type AMLScreeningRequest struct {
	RequestID     string            `json:"request_id"`
	CustomerID    string            `json:"customer_id"`
	FullName      string            `json:"full_name"`
	DateOfBirth   string            `json:"date_of_birth,omitempty"`
	Nationality   string            `json:"nationality,omitempty"`
	Country       string            `json:"country,omitempty"`
	IDNumber      string            `json:"id_number,omitempty"`
	IDType        string            `json:"id_type,omitempty"`
	EntityType    string            `json:"entity_type"` // INDIVIDUAL, BUSINESS
	BusinessName  string            `json:"business_name,omitempty"`
	RegistrationNo string           `json:"registration_no,omitempty"`
	ListTypes     []string          `json:"list_types"` // OFAC, UN, EU, PEP, etc.
	Metadata      map[string]string `json:"metadata"`
}

// AMLScreeningResult represents an AML screening result
type AMLScreeningResult struct {
	RequestID       string       `json:"request_id"`
	CustomerID      string       `json:"customer_id"`
	Provider        string       `json:"provider"`
	ScreenedAt      time.Time    `json:"screened_at"`
	OverallStatus   string       `json:"overall_status"` // CLEAR, POTENTIAL_MATCH, MATCH
	MatchScore      float64      `json:"match_score"`
	Matches         []AMLMatch   `json:"matches"`
	ListsScreened   []string     `json:"lists_screened"`
	LatencyMs       int64        `json:"latency_ms"`
	CacheHit        bool         `json:"cache_hit"`
	FallbackUsed    bool         `json:"fallback_used"`
	FallbackReason  string       `json:"fallback_reason,omitempty"`
}

// AMLMatch represents a potential match
type AMLMatch struct {
	MatchID       string            `json:"match_id"`
	ListType      string            `json:"list_type"`
	ListName      string            `json:"list_name"`
	MatchedName   string            `json:"matched_name"`
	MatchScore    float64           `json:"match_score"`
	MatchType     string            `json:"match_type"` // EXACT, FUZZY, ALIAS
	EntityType    string            `json:"entity_type"`
	Sanctions     []string          `json:"sanctions,omitempty"`
	PEPStatus     string            `json:"pep_status,omitempty"`
	AdverseMedia  bool              `json:"adverse_media"`
	Details       map[string]string `json:"details"`
}

// CircuitBreaker provides circuit breaker pattern
type CircuitBreaker struct {
	Name          string
	State         int32 // 0=CLOSED, 1=OPEN, 2=HALF_OPEN
	FailureCount  int64
	SuccessCount  int64
	LastFailure   time.Time
	Threshold     int64
	ResetTimeout  time.Duration
	mu            sync.Mutex
}

// AMLCache provides caching for AML results
type AMLCache struct {
	entries map[string]*CachedAMLResult
	ttl     time.Duration
	mu      sync.RWMutex
}

// CachedAMLResult represents a cached AML result
type CachedAMLResult struct {
	Result    *AMLScreeningResult
	CachedAt  time.Time
	ExpiresAt time.Time
}

// NewMultiProviderAMLService creates a new multi-provider AML service
func NewMultiProviderAMLService(db *sql.DB) *MultiProviderAMLService {
	return &MultiProviderAMLService{
		providers:       make([]AMLProvider, 0),
		circuitBreakers: make(map[string]*CircuitBreaker),
		cache: &AMLCache{
			entries: make(map[string]*CachedAMLResult),
			ttl:     24 * time.Hour,
		},
		db: db,
	}
}

// RegisterProvider registers an AML provider
func (s *MultiProviderAMLService) RegisterProvider(provider AMLProvider) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.providers = append(s.providers, provider)
	s.circuitBreakers[provider.GetName()] = &CircuitBreaker{
		Name:         provider.GetName(),
		Threshold:    5,
		ResetTimeout: 30 * time.Second,
	}
	
	// Sort by priority
	sort.Slice(s.providers, func(i, j int) bool {
		return s.providers[i].GetPriority() < s.providers[j].GetPriority()
	})
}

// Screen performs AML screening with fallback
func (s *MultiProviderAMLService) Screen(ctx context.Context, request *AMLScreeningRequest) (*AMLScreeningResult, error) {
	// Check cache first
	cacheKey := s.generateCacheKey(request)
	if cached := s.cache.Get(cacheKey); cached != nil {
		cached.CacheHit = true
		return cached, nil
	}
	
	s.mu.RLock()
	providers := make([]AMLProvider, len(s.providers))
	copy(providers, s.providers)
	s.mu.RUnlock()
	
	var lastError error
	var fallbackUsed bool
	var fallbackReason string
	
	for i, provider := range providers {
		// Check circuit breaker
		cb := s.circuitBreakers[provider.GetName()]
		if !cb.AllowRequest() {
			if i == 0 {
				fallbackUsed = true
				fallbackReason = fmt.Sprintf("Primary provider %s circuit open", provider.GetName())
			}
			continue
		}
		
		// Try provider
		start := time.Now()
		result, err := provider.Screen(ctx, request)
		latency := time.Since(start).Milliseconds()
		
		if err != nil {
			cb.RecordFailure()
			lastError = err
			if i == 0 {
				fallbackUsed = true
				fallbackReason = fmt.Sprintf("Primary provider %s failed: %v", provider.GetName(), err)
			}
			continue
		}
		
		cb.RecordSuccess()
		result.LatencyMs = latency
		result.FallbackUsed = fallbackUsed
		result.FallbackReason = fallbackReason
		
		// Cache result
		s.cache.Set(cacheKey, result)
		
		// Persist result
		s.persistResult(ctx, result)
		
		return result, nil
	}
	
	return nil, fmt.Errorf("all AML providers failed: %w", lastError)
}

// generateCacheKey generates a cache key for a request
func (s *MultiProviderAMLService) generateCacheKey(request *AMLScreeningRequest) string {
	data := fmt.Sprintf("%s:%s:%s:%s", request.CustomerID, request.FullName, request.DateOfBirth, request.Nationality)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// Get retrieves a cached result
func (c *AMLCache) Get(key string) *AMLScreeningResult {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.ExpiresAt) {
		return nil
	}
	
	return entry.Result
}

// Set stores a result in cache
func (c *AMLCache) Set(key string, result *AMLScreeningResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.entries[key] = &CachedAMLResult{
		Result:    result,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(c.ttl),
	}
}

// AllowRequest checks if a request should be allowed
func (cb *CircuitBreaker) AllowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	state := atomic.LoadInt32(&cb.State)
	
	switch state {
	case 0: // CLOSED
		return true
	case 1: // OPEN
		if time.Since(cb.LastFailure) > cb.ResetTimeout {
			atomic.StoreInt32(&cb.State, 2) // HALF_OPEN
			return true
		}
		return false
	case 2: // HALF_OPEN
		return true
	}
	
	return false
}

// RecordSuccess records a successful request
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	atomic.AddInt64(&cb.SuccessCount, 1)
	
	if atomic.LoadInt32(&cb.State) == 2 { // HALF_OPEN
		atomic.StoreInt32(&cb.State, 0) // CLOSED
		atomic.StoreInt64(&cb.FailureCount, 0)
	}
}

// RecordFailure records a failed request
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	
	atomic.AddInt64(&cb.FailureCount, 1)
	cb.LastFailure = time.Now()
	
	if atomic.LoadInt64(&cb.FailureCount) >= cb.Threshold {
		atomic.StoreInt32(&cb.State, 1) // OPEN
	}
}

func (s *MultiProviderAMLService) persistResult(ctx context.Context, result *AMLScreeningResult) error {
	if s.db == nil {
		return nil
	}
	
	matchesJSON, _ := json.Marshal(result.Matches)
	listsJSON, _ := json.Marshal(result.ListsScreened)
	
	query := `
		INSERT INTO aml_screening_results (
			request_id, customer_id, provider, screened_at, overall_status,
			match_score, matches, lists_screened, latency_ms, cache_hit,
			fallback_used, fallback_reason
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	
	_, err := s.db.ExecContext(ctx, query,
		result.RequestID, result.CustomerID, result.Provider, result.ScreenedAt,
		result.OverallStatus, result.MatchScore, matchesJSON, listsJSON,
		result.LatencyMs, result.CacheHit, result.FallbackUsed, result.FallbackReason,
	)
	
	return err
}

// =============================================================================
// Priority 6.2: UBO Verification for KYB
// =============================================================================

// UBOVerificationService provides Ultimate Beneficial Owner verification
type UBOVerificationService struct {
	db              *sql.DB
	corporateAPI    CorporateRegistryAPI
	amlService      *MultiProviderAMLService
	ownershipThreshold float64 // Default 25%
	mu              sync.RWMutex
}

// CorporateRegistryAPI interface for corporate registry lookups
type CorporateRegistryAPI interface {
	GetCompanyDetails(ctx context.Context, registrationNo, country string) (*CompanyDetails, error)
	GetShareholders(ctx context.Context, registrationNo, country string) ([]Shareholder, error)
	GetDirectors(ctx context.Context, registrationNo, country string) ([]Director, error)
}

// CompanyDetails represents company details
type CompanyDetails struct {
	RegistrationNo    string    `json:"registration_no"`
	CompanyName       string    `json:"company_name"`
	TradingName       string    `json:"trading_name,omitempty"`
	CompanyType       string    `json:"company_type"`
	Status            string    `json:"status"`
	IncorporationDate time.Time `json:"incorporation_date"`
	Country           string    `json:"country"`
	Address           string    `json:"address"`
	Industry          string    `json:"industry,omitempty"`
	LastFilingDate    time.Time `json:"last_filing_date,omitempty"`
}

// Shareholder represents a shareholder
type Shareholder struct {
	ShareholderID   string  `json:"shareholder_id"`
	Name            string  `json:"name"`
	Type            string  `json:"type"` // INDIVIDUAL, CORPORATE
	Nationality     string  `json:"nationality,omitempty"`
	Country         string  `json:"country,omitempty"`
	OwnershipPercent float64 `json:"ownership_percent"`
	ShareClass      string  `json:"share_class,omitempty"`
	VotingRights    float64 `json:"voting_rights,omitempty"`
	// For corporate shareholders
	RegistrationNo  string  `json:"registration_no,omitempty"`
}

// Director represents a company director
type Director struct {
	DirectorID      string    `json:"director_id"`
	Name            string    `json:"name"`
	Role            string    `json:"role"` // DIRECTOR, CEO, CFO, etc.
	Nationality     string    `json:"nationality,omitempty"`
	DateOfBirth     string    `json:"date_of_birth,omitempty"`
	AppointmentDate time.Time `json:"appointment_date"`
	ResignationDate *time.Time `json:"resignation_date,omitempty"`
	Address         string    `json:"address,omitempty"`
}

// UBOVerificationRequest represents a UBO verification request
type UBOVerificationRequest struct {
	RequestID       string `json:"request_id"`
	CustomerID      string `json:"customer_id"`
	CompanyName     string `json:"company_name"`
	RegistrationNo  string `json:"registration_no"`
	Country         string `json:"country"`
	MaxDepth        int    `json:"max_depth"` // Max levels to traverse
	IncludeDirectors bool  `json:"include_directors"`
}

// UBOVerificationResult represents UBO verification result
type UBOVerificationResult struct {
	RequestID         string              `json:"request_id"`
	CustomerID        string              `json:"customer_id"`
	CompanyDetails    *CompanyDetails     `json:"company_details"`
	UBOs              []UBO               `json:"ubos"`
	Directors         []Director          `json:"directors,omitempty"`
	OwnershipStructure *OwnershipNode     `json:"ownership_structure"`
	AMLResults        map[string]*AMLScreeningResult `json:"aml_results"`
	VerifiedAt        time.Time           `json:"verified_at"`
	Status            string              `json:"status"` // COMPLETE, PARTIAL, FAILED
	Warnings          []string            `json:"warnings"`
}

// UBO represents an Ultimate Beneficial Owner
type UBO struct {
	UBOID           string  `json:"ubo_id"`
	Name            string  `json:"name"`
	Type            string  `json:"type"` // INDIVIDUAL, CORPORATE
	Nationality     string  `json:"nationality,omitempty"`
	DateOfBirth     string  `json:"date_of_birth,omitempty"`
	OwnershipPercent float64 `json:"ownership_percent"`
	OwnershipPath   []string `json:"ownership_path"` // Chain of ownership
	ControlType     string  `json:"control_type"` // DIRECT, INDIRECT, VOTING, BOARD
	AMLStatus       string  `json:"aml_status,omitempty"`
	PEPStatus       string  `json:"pep_status,omitempty"`
	Verified        bool    `json:"verified"`
}

// OwnershipNode represents a node in the ownership structure
type OwnershipNode struct {
	EntityID        string           `json:"entity_id"`
	Name            string           `json:"name"`
	Type            string           `json:"type"`
	OwnershipPercent float64         `json:"ownership_percent"`
	Children        []*OwnershipNode `json:"children,omitempty"`
}

// NewUBOVerificationService creates a new UBO verification service
func NewUBOVerificationService(db *sql.DB, corporateAPI CorporateRegistryAPI, amlService *MultiProviderAMLService) *UBOVerificationService {
	return &UBOVerificationService{
		db:                 db,
		corporateAPI:       corporateAPI,
		amlService:         amlService,
		ownershipThreshold: 25.0,
	}
}

// VerifyUBOs verifies Ultimate Beneficial Owners for a company
func (s *UBOVerificationService) VerifyUBOs(ctx context.Context, request *UBOVerificationRequest) (*UBOVerificationResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	result := &UBOVerificationResult{
		RequestID:  request.RequestID,
		CustomerID: request.CustomerID,
		UBOs:       make([]UBO, 0),
		AMLResults: make(map[string]*AMLScreeningResult),
		VerifiedAt: time.Now().UTC(),
		Warnings:   make([]string, 0),
	}
	
	// Get company details
	if s.corporateAPI != nil {
		companyDetails, err := s.corporateAPI.GetCompanyDetails(ctx, request.RegistrationNo, request.Country)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to get company details: %v", err))
		} else {
			result.CompanyDetails = companyDetails
		}
	}
	
	// Build ownership structure
	maxDepth := request.MaxDepth
	if maxDepth == 0 {
		maxDepth = 4
	}
	
	ownershipRoot := &OwnershipNode{
		EntityID:         request.RegistrationNo,
		Name:             request.CompanyName,
		Type:             "CORPORATE",
		OwnershipPercent: 100,
	}
	
	// Traverse ownership structure
	visited := make(map[string]bool)
	s.traverseOwnership(ctx, ownershipRoot, request.Country, 0, maxDepth, visited, result)
	result.OwnershipStructure = ownershipRoot
	
	// Get directors if requested
	if request.IncludeDirectors && s.corporateAPI != nil {
		directors, err := s.corporateAPI.GetDirectors(ctx, request.RegistrationNo, request.Country)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to get directors: %v", err))
		} else {
			result.Directors = directors
			
			// Check directors for control
			for _, director := range directors {
				if director.Role == "CEO" || director.Role == "MANAGING_DIRECTOR" {
					ubo := UBO{
						UBOID:           fmt.Sprintf("ubo_%s", director.DirectorID),
						Name:            director.Name,
						Type:            "INDIVIDUAL",
						Nationality:     director.Nationality,
						DateOfBirth:     director.DateOfBirth,
						OwnershipPercent: 0,
						ControlType:     "BOARD",
						Verified:        true,
					}
					result.UBOs = append(result.UBOs, ubo)
				}
			}
		}
	}
	
	// Screen all UBOs against AML
	for i := range result.UBOs {
		ubo := &result.UBOs[i]
		if ubo.Type == "INDIVIDUAL" && s.amlService != nil {
			amlRequest := &AMLScreeningRequest{
				RequestID:   fmt.Sprintf("%s_ubo_%s", request.RequestID, ubo.UBOID),
				CustomerID:  request.CustomerID,
				FullName:    ubo.Name,
				DateOfBirth: ubo.DateOfBirth,
				Nationality: ubo.Nationality,
				EntityType:  "INDIVIDUAL",
				ListTypes:   []string{"OFAC", "UN", "EU", "PEP"},
			}
			
			amlResult, err := s.amlService.Screen(ctx, amlRequest)
			if err != nil {
				result.Warnings = append(result.Warnings, fmt.Sprintf("AML screening failed for %s: %v", ubo.Name, err))
			} else {
				result.AMLResults[ubo.UBOID] = amlResult
				ubo.AMLStatus = amlResult.OverallStatus
				
				// Check for PEP
				for _, match := range amlResult.Matches {
					if match.PEPStatus != "" {
						ubo.PEPStatus = match.PEPStatus
						break
					}
				}
			}
		}
	}
	
	// Determine overall status
	if len(result.UBOs) > 0 {
		result.Status = "COMPLETE"
	} else if len(result.Warnings) > 0 {
		result.Status = "PARTIAL"
	} else {
		result.Status = "FAILED"
	}
	
	// Persist result
	s.persistResult(ctx, result)
	
	return result, nil
}

// traverseOwnership recursively traverses ownership structure
func (s *UBOVerificationService) traverseOwnership(ctx context.Context, node *OwnershipNode, country string, depth, maxDepth int, visited map[string]bool, result *UBOVerificationResult) {
	if depth >= maxDepth || visited[node.EntityID] {
		return
	}
	visited[node.EntityID] = true
	
	// Get shareholders
	var shareholders []Shareholder
	if s.corporateAPI != nil && node.Type == "CORPORATE" {
		var err error
		shareholders, err = s.corporateAPI.GetShareholders(ctx, node.EntityID, country)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to get shareholders for %s: %v", node.Name, err))
			return
		}
	}
	
	for _, shareholder := range shareholders {
		// Calculate effective ownership
		effectiveOwnership := node.OwnershipPercent * shareholder.OwnershipPercent / 100
		
		childNode := &OwnershipNode{
			EntityID:         shareholder.ShareholderID,
			Name:             shareholder.Name,
			Type:             shareholder.Type,
			OwnershipPercent: shareholder.OwnershipPercent,
		}
		node.Children = append(node.Children, childNode)
		
		if shareholder.Type == "INDIVIDUAL" {
			// Check if qualifies as UBO
			if effectiveOwnership >= s.ownershipThreshold {
				ubo := UBO{
					UBOID:            fmt.Sprintf("ubo_%s", shareholder.ShareholderID),
					Name:             shareholder.Name,
					Type:             "INDIVIDUAL",
					Nationality:      shareholder.Nationality,
					OwnershipPercent: effectiveOwnership,
					OwnershipPath:    []string{node.Name},
					ControlType:      "DIRECT",
					Verified:         true,
				}
				if depth > 0 {
					ubo.ControlType = "INDIRECT"
				}
				result.UBOs = append(result.UBOs, ubo)
			}
		} else if shareholder.Type == "CORPORATE" {
			// Recurse into corporate shareholder
			s.traverseOwnership(ctx, childNode, shareholder.Country, depth+1, maxDepth, visited, result)
		}
	}
}

func (s *UBOVerificationService) persistResult(ctx context.Context, result *UBOVerificationResult) error {
	if s.db == nil {
		return nil
	}
	
	ubosJSON, _ := json.Marshal(result.UBOs)
	directorsJSON, _ := json.Marshal(result.Directors)
	structureJSON, _ := json.Marshal(result.OwnershipStructure)
	warningsJSON, _ := json.Marshal(result.Warnings)
	
	query := `
		INSERT INTO ubo_verification_results (
			request_id, customer_id, company_name, registration_no,
			ubos, directors, ownership_structure, verified_at, status, warnings
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	
	companyName := ""
	regNo := ""
	if result.CompanyDetails != nil {
		companyName = result.CompanyDetails.CompanyName
		regNo = result.CompanyDetails.RegistrationNo
	}
	
	_, err := s.db.ExecContext(ctx, query,
		result.RequestID, result.CustomerID, companyName, regNo,
		ubosJSON, directorsJSON, structureJSON, result.VerifiedAt, result.Status, warningsJSON,
	)
	
	return err
}

// =============================================================================
// Priority 6.3: List Management Pipeline
// =============================================================================

// ListManagementService manages sanctions and watchlist updates
type ListManagementService struct {
	db            *sql.DB
	sources       map[string]ListSource
	lists         map[string]*ManagedList
	updateChan    chan ListUpdate
	mu            sync.RWMutex
}

// ListSource interface for list sources
type ListSource interface {
	GetSourceName() string
	FetchList(ctx context.Context) (*ListData, error)
	GetUpdateFrequency() time.Duration
}

// ListData represents list data from a source
type ListData struct {
	SourceName    string       `json:"source_name"`
	ListType      string       `json:"list_type"`
	FetchedAt     time.Time    `json:"fetched_at"`
	PublishedAt   time.Time    `json:"published_at"`
	Version       string       `json:"version"`
	Entries       []ListEntry  `json:"entries"`
	ContentHash   string       `json:"content_hash"`
}

// ListEntry represents an entry in a list
type ListEntry struct {
	EntryID       string            `json:"entry_id"`
	EntityType    string            `json:"entity_type"` // INDIVIDUAL, ENTITY, VESSEL, AIRCRAFT
	PrimaryName   string            `json:"primary_name"`
	Aliases       []string          `json:"aliases"`
	DateOfBirth   string            `json:"date_of_birth,omitempty"`
	Nationality   []string          `json:"nationality,omitempty"`
	Addresses     []string          `json:"addresses,omitempty"`
	IDNumbers     []IDNumber        `json:"id_numbers,omitempty"`
	Programs      []string          `json:"programs"` // Sanctions programs
	ListingDate   time.Time         `json:"listing_date"`
	Remarks       string            `json:"remarks,omitempty"`
	Attributes    map[string]string `json:"attributes"`
}

// IDNumber represents an ID number
type IDNumber struct {
	Type   string `json:"type"`
	Number string `json:"number"`
	Country string `json:"country,omitempty"`
}

// ManagedList represents a managed list
type ManagedList struct {
	ListID        string       `json:"list_id"`
	ListType      string       `json:"list_type"`
	SourceName    string       `json:"source_name"`
	Version       string       `json:"version"`
	EntryCount    int          `json:"entry_count"`
	LastUpdated   time.Time    `json:"last_updated"`
	NextUpdate    time.Time    `json:"next_update"`
	Status        string       `json:"status"` // ACTIVE, UPDATING, ERROR
	ContentHash   string       `json:"content_hash"`
	entries       map[string]*ListEntry
	mu            sync.RWMutex
}

// ListUpdate represents a list update event
type ListUpdate struct {
	ListID        string    `json:"list_id"`
	UpdateType    string    `json:"update_type"` // FULL, INCREMENTAL
	EntriesAdded  int       `json:"entries_added"`
	EntriesRemoved int      `json:"entries_removed"`
	EntriesModified int     `json:"entries_modified"`
	OldVersion    string    `json:"old_version"`
	NewVersion    string    `json:"new_version"`
	UpdatedAt     time.Time `json:"updated_at"`
	Status        string    `json:"status"`
	Error         string    `json:"error,omitempty"`
}

// NewListManagementService creates a new list management service
func NewListManagementService(db *sql.DB) *ListManagementService {
	svc := &ListManagementService{
		db:         db,
		sources:    make(map[string]ListSource),
		lists:      make(map[string]*ManagedList),
		updateChan: make(chan ListUpdate, 100),
	}
	
	// Start update processor
	go svc.processUpdates()
	
	return svc
}

// RegisterSource registers a list source
func (s *ListManagementService) RegisterSource(source ListSource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.sources[source.GetSourceName()] = source
	
	// Initialize managed list
	s.lists[source.GetSourceName()] = &ManagedList{
		ListID:     fmt.Sprintf("list_%s", source.GetSourceName()),
		SourceName: source.GetSourceName(),
		Status:     "ACTIVE",
		entries:    make(map[string]*ListEntry),
	}
}

// UpdateList updates a list from its source
func (s *ListManagementService) UpdateList(ctx context.Context, sourceName string) (*ListUpdate, error) {
	s.mu.RLock()
	source, ok := s.sources[sourceName]
	list := s.lists[sourceName]
	s.mu.RUnlock()
	
	if !ok {
		return nil, fmt.Errorf("source not found: %s", sourceName)
	}
	
	// Mark as updating
	list.mu.Lock()
	list.Status = "UPDATING"
	oldVersion := list.Version
	list.mu.Unlock()
	
	// Fetch new data
	data, err := source.FetchList(ctx)
	if err != nil {
		list.mu.Lock()
		list.Status = "ERROR"
		list.mu.Unlock()
		
		return &ListUpdate{
			ListID:     list.ListID,
			UpdateType: "FULL",
			OldVersion: oldVersion,
			UpdatedAt:  time.Now().UTC(),
			Status:     "FAILED",
			Error:      err.Error(),
		}, err
	}
	
	// Calculate diff
	update := s.applyUpdate(list, data)
	update.OldVersion = oldVersion
	update.NewVersion = data.Version
	
	// Send update notification
	s.updateChan <- *update
	
	// Persist update
	s.persistUpdate(ctx, update)
	
	return update, nil
}

// applyUpdate applies list data to managed list
func (s *ListManagementService) applyUpdate(list *ManagedList, data *ListData) *ListUpdate {
	list.mu.Lock()
	defer list.mu.Unlock()
	
	update := &ListUpdate{
		ListID:     list.ListID,
		UpdateType: "FULL",
		UpdatedAt:  time.Now().UTC(),
		Status:     "SUCCESS",
	}
	
	// Track changes
	newEntries := make(map[string]*ListEntry)
	for i := range data.Entries {
		entry := &data.Entries[i]
		newEntries[entry.EntryID] = entry
		
		if _, exists := list.entries[entry.EntryID]; !exists {
			update.EntriesAdded++
		} else {
			// Check if modified (simplified - just check name)
			if list.entries[entry.EntryID].PrimaryName != entry.PrimaryName {
				update.EntriesModified++
			}
		}
	}
	
	// Check for removed entries
	for id := range list.entries {
		if _, exists := newEntries[id]; !exists {
			update.EntriesRemoved++
		}
	}
	
	// Update list
	list.entries = newEntries
	list.Version = data.Version
	list.ContentHash = data.ContentHash
	list.EntryCount = len(data.Entries)
	list.LastUpdated = time.Now().UTC()
	list.ListType = data.ListType
	list.Status = "ACTIVE"
	
	return update
}

// SearchList searches a list for matches
func (s *ListManagementService) SearchList(ctx context.Context, sourceName, query string, threshold float64) ([]ListEntry, error) {
	s.mu.RLock()
	list, ok := s.lists[sourceName]
	s.mu.RUnlock()
	
	if !ok {
		return nil, fmt.Errorf("list not found: %s", sourceName)
	}
	
	list.mu.RLock()
	defer list.mu.RUnlock()
	
	var matches []ListEntry
	queryLower := toLower(query)
	
	for _, entry := range list.entries {
		// Check primary name
		score := fuzzyMatch(queryLower, toLower(entry.PrimaryName))
		if score >= threshold {
			matches = append(matches, *entry)
			continue
		}
		
		// Check aliases
		for _, alias := range entry.Aliases {
			score := fuzzyMatch(queryLower, toLower(alias))
			if score >= threshold {
				matches = append(matches, *entry)
				break
			}
		}
	}
	
	return matches, nil
}

// GetListStats returns statistics for a list
func (s *ListManagementService) GetListStats(sourceName string) map[string]interface{} {
	s.mu.RLock()
	list, ok := s.lists[sourceName]
	s.mu.RUnlock()
	
	if !ok {
		return nil
	}
	
	list.mu.RLock()
	defer list.mu.RUnlock()
	
	// Count by entity type
	byType := make(map[string]int)
	for _, entry := range list.entries {
		byType[entry.EntityType]++
	}
	
	return map[string]interface{}{
		"list_id":      list.ListID,
		"source_name":  list.SourceName,
		"list_type":    list.ListType,
		"version":      list.Version,
		"entry_count":  list.EntryCount,
		"last_updated": list.LastUpdated,
		"status":       list.Status,
		"by_type":      byType,
	}
}

// processUpdates processes list updates
func (s *ListManagementService) processUpdates() {
	for update := range s.updateChan {
		// Log update
		fmt.Printf("List update: %s - Added: %d, Removed: %d, Modified: %d\n",
			update.ListID, update.EntriesAdded, update.EntriesRemoved, update.EntriesModified)
	}
}

func (s *ListManagementService) persistUpdate(ctx context.Context, update *ListUpdate) error {
	if s.db == nil {
		return nil
	}
	
	query := `
		INSERT INTO list_updates (
			list_id, update_type, entries_added, entries_removed, entries_modified,
			old_version, new_version, updated_at, status, error_message
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	
	_, err := s.db.ExecContext(ctx, query,
		update.ListID, update.UpdateType, update.EntriesAdded, update.EntriesRemoved,
		update.EntriesModified, update.OldVersion, update.NewVersion, update.UpdatedAt,
		update.Status, update.Error,
	)
	
	return err
}

// Helper functions
func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		result[i] = c
	}
	return string(result)
}

func fuzzyMatch(query, target string) float64 {
	if query == target {
		return 1.0
	}
	
	if len(query) == 0 || len(target) == 0 {
		return 0.0
	}
	
	// Simple Levenshtein-based similarity
	distance := levenshtein(query, target)
	maxLen := len(query)
	if len(target) > maxLen {
		maxLen = len(target)
	}
	
	return 1.0 - float64(distance)/float64(maxLen)
}

func levenshtein(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}
	
	// Create matrix
	matrix := make([][]int, len(s1)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(s2)+1)
		matrix[i][0] = i
	}
	for j := range matrix[0] {
		matrix[0][j] = j
	}
	
	// Fill matrix
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 1
			if s1[i-1] == s2[j-1] {
				cost = 0
			}
			
			matrix[i][j] = min(
				matrix[i-1][j]+1,
				min(matrix[i][j-1]+1, matrix[i-1][j-1]+cost),
			)
		}
	}
	
	return matrix[len(s1)][len(s2)]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// =============================================================================
// Database Schema
// =============================================================================

// IntegrationsSchema returns the database schema for integration components
func IntegrationsSchema() string {
	return `
	-- AML screening results
	CREATE TABLE IF NOT EXISTS aml_screening_results (
		request_id VARCHAR(128) PRIMARY KEY,
		customer_id VARCHAR(128) NOT NULL,
		provider VARCHAR(64) NOT NULL,
		screened_at TIMESTAMP NOT NULL,
		overall_status VARCHAR(32) NOT NULL,
		match_score DECIMAL(5,4),
		matches JSONB,
		lists_screened JSONB,
		latency_ms INTEGER,
		cache_hit BOOLEAN DEFAULT FALSE,
		fallback_used BOOLEAN DEFAULT FALSE,
		fallback_reason TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_aml_customer ON aml_screening_results(customer_id);
	CREATE INDEX IF NOT EXISTS idx_aml_status ON aml_screening_results(overall_status);
	CREATE INDEX IF NOT EXISTS idx_aml_time ON aml_screening_results(screened_at);

	-- UBO verification results
	CREATE TABLE IF NOT EXISTS ubo_verification_results (
		request_id VARCHAR(128) PRIMARY KEY,
		customer_id VARCHAR(128) NOT NULL,
		company_name VARCHAR(512),
		registration_no VARCHAR(128),
		ubos JSONB,
		directors JSONB,
		ownership_structure JSONB,
		verified_at TIMESTAMP NOT NULL,
		status VARCHAR(32) NOT NULL,
		warnings JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_ubo_customer ON ubo_verification_results(customer_id);
	CREATE INDEX IF NOT EXISTS idx_ubo_company ON ubo_verification_results(registration_no);

	-- List updates
	CREATE TABLE IF NOT EXISTS list_updates (
		update_id SERIAL PRIMARY KEY,
		list_id VARCHAR(128) NOT NULL,
		update_type VARCHAR(32) NOT NULL,
		entries_added INTEGER DEFAULT 0,
		entries_removed INTEGER DEFAULT 0,
		entries_modified INTEGER DEFAULT 0,
		old_version VARCHAR(64),
		new_version VARCHAR(64),
		updated_at TIMESTAMP NOT NULL,
		status VARCHAR(32) NOT NULL,
		error_message TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_list_update_list ON list_updates(list_id);
	CREATE INDEX IF NOT EXISTS idx_list_update_time ON list_updates(updated_at);

	-- Managed lists metadata
	CREATE TABLE IF NOT EXISTS managed_lists (
		list_id VARCHAR(128) PRIMARY KEY,
		list_type VARCHAR(64) NOT NULL,
		source_name VARCHAR(128) NOT NULL,
		version VARCHAR(64),
		entry_count INTEGER DEFAULT 0,
		last_updated TIMESTAMP,
		next_update TIMESTAMP,
		status VARCHAR(32) NOT NULL,
		content_hash VARCHAR(64)
	);
	CREATE INDEX IF NOT EXISTS idx_managed_list_source ON managed_lists(source_name);
	`
}
