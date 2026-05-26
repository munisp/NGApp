package pbac

import (
	"fmt"
	"sync"
	"time"
)

type PolicyEffect string

const (
	EffectAllow PolicyEffect = "ALLOW"
	EffectDeny  PolicyEffect = "DENY"
)

type AttributeType string

const (
	AttrRole          AttributeType = "role"
	AttrDepartment    AttributeType = "department"
	AttrBranch        AttributeType = "branch"
	AttrRegion        AttributeType = "region"
	AttrSecurityLevel AttributeType = "security_level"
	AttrIPRange       AttributeType = "ip_range"
	AttrTimeWindow    AttributeType = "time_window"
	AttrTxnAmount     AttributeType = "transaction_amount"
	AttrTxnCurrency   AttributeType = "transaction_currency"
	AttrChannel       AttributeType = "channel"
	AttrDeviceType    AttributeType = "device_type"
	AttrRiskScore     AttributeType = "risk_score"
)

type Condition struct {
	Attribute AttributeType
	Operator  string // "eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "between", "regex"
	Value     interface{}
}

type Policy struct {
	ID          string
	Name        string
	Description string
	Effect      PolicyEffect
	Resources   []string
	Actions     []string
	Conditions  []Condition
	Priority    int
	Enabled     bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CreatedBy   string
	Tags        []string
}

type Subject struct {
	ID         string
	Type       string // "user", "service", "api_key"
	Attributes map[AttributeType]interface{}
}

type Resource struct {
	Type       string
	ID         string
	Attributes map[AttributeType]interface{}
}

type AccessRequest struct {
	Subject   Subject
	Resource  Resource
	Action    string
	Context   map[string]interface{}
	Timestamp time.Time
}

type AccessDecision struct {
	Allowed      bool
	PolicyID     string
	PolicyName   string
	Effect       PolicyEffect
	Reason       string
	EvaluationMs int64
	AuditTrail   []AuditEntry
}

type AuditEntry struct {
	PolicyID   string
	Effect     PolicyEffect
	Matched    bool
	Reason     string
	Timestamp  time.Time
}

type PBACEngine struct {
	mu       sync.RWMutex
	policies []Policy
	metrics  EngineMetrics
}

type EngineMetrics struct {
	TotalEvaluations   int64
	AllowedRequests    int64
	DeniedRequests     int64
	AvgEvaluationUs    int64
	PoliciesLoaded     int
	LastPolicyUpdate   time.Time
}

var DefaultPolicies = []Policy{
	{
		ID: "pol-001", Name: "NIP Payment Authorization",
		Description: "Only authorized tellers and systems can initiate NIP payments",
		Effect: EffectAllow, Resources: []string{"payment:nip:*"}, Actions: []string{"create", "approve"},
		Conditions: []Condition{
			{Attribute: AttrRole, Operator: "in", Value: []string{"teller", "supervisor", "system"}},
			{Attribute: AttrSecurityLevel, Operator: "gte", Value: 3},
		},
		Priority: 100, Enabled: true, Tags: []string{"nip", "payment"},
	},
	{
		ID: "pol-002", Name: "High Value Transaction Approval",
		Description: "Transactions above ₦10M require supervisor approval",
		Effect: EffectDeny, Resources: []string{"payment:*:*"}, Actions: []string{"approve"},
		Conditions: []Condition{
			{Attribute: AttrTxnAmount, Operator: "gt", Value: 10000000},
			{Attribute: AttrRole, Operator: "neq", Value: "supervisor"},
		},
		Priority: 200, Enabled: true, Tags: []string{"high-value", "approval"},
	},
	{
		ID: "pol-003", Name: "Cross-Border Remittance",
		Description: "Only compliance-verified users can process cross-border",
		Effect: EffectAllow, Resources: []string{"remittance:outbound:*", "remittance:inbound:*"}, Actions: []string{"create", "approve", "release"},
		Conditions: []Condition{
			{Attribute: AttrRole, Operator: "in", Value: []string{"remittance_officer", "compliance_officer", "supervisor"}},
			{Attribute: AttrSecurityLevel, Operator: "gte", Value: 4},
		},
		Priority: 150, Enabled: true, Tags: []string{"remittance", "compliance"},
	},
	{
		ID: "pol-004", Name: "After Hours Restriction",
		Description: "Block non-system transactions outside business hours in Nigeria",
		Effect: EffectDeny, Resources: []string{"payment:*:*"}, Actions: []string{"create"},
		Conditions: []Condition{
			{Attribute: AttrTimeWindow, Operator: "not_in", Value: "06:00-22:00"},
			{Attribute: AttrRole, Operator: "neq", Value: "system"},
			{Attribute: AttrTxnAmount, Operator: "gt", Value: 5000000},
		},
		Priority: 180, Enabled: true, Tags: []string{"time-restriction"},
	},
	{
		ID: "pol-005", Name: "Sanctions Screening Block",
		Description: "Block all transactions flagged by sanctions screening",
		Effect: EffectDeny, Resources: []string{"payment:*:*", "remittance:*:*"}, Actions: []string{"create", "approve", "release"},
		Conditions: []Condition{
			{Attribute: AttrRiskScore, Operator: "gte", Value: 0.9},
		},
		Priority: 300, Enabled: true, Tags: []string{"sanctions", "compliance"},
	},
	{
		ID: "pol-006", Name: "API Key Scope Restriction",
		Description: "API keys can only access their scoped resources",
		Effect: EffectDeny, Resources: []string{"admin:*:*", "config:*:*"}, Actions: []string{"create", "update", "delete"},
		Conditions: []Condition{
			{Attribute: AttrRole, Operator: "eq", Value: "api_key"},
		},
		Priority: 250, Enabled: true, Tags: []string{"api", "scope"},
	},
	{
		ID: "pol-007", Name: "Regional Branch Access",
		Description: "Branch users can only access their regional data",
		Effect: EffectDeny, Resources: []string{"branch:*:*"}, Actions: []string{"read", "update"},
		Conditions: []Condition{
			{Attribute: AttrBranch, Operator: "neq", Value: "{{resource.branch_id}}"},
			{Attribute: AttrRole, Operator: "not_in", Value: []string{"admin", "supervisor", "auditor"}},
		},
		Priority: 160, Enabled: true, Tags: []string{"branch", "access"},
	},
	{
		ID: "pol-008", Name: "Settlement Authorization",
		Description: "Only treasury and settlement officers can authorize settlements",
		Effect: EffectAllow, Resources: []string{"settlement:*:*"}, Actions: []string{"authorize", "release"},
		Conditions: []Condition{
			{Attribute: AttrRole, Operator: "in", Value: []string{"treasury_officer", "settlement_officer", "cfo"}},
			{Attribute: AttrSecurityLevel, Operator: "gte", Value: 5},
		},
		Priority: 220, Enabled: true, Tags: []string{"settlement", "treasury"},
	},
}

func NewPBACEngine() *PBACEngine {
	engine := &PBACEngine{
		policies: make([]Policy, len(DefaultPolicies)),
	}
	copy(engine.policies, DefaultPolicies)
	engine.metrics.PoliciesLoaded = len(engine.policies)
	engine.metrics.LastPolicyUpdate = time.Now()
	return engine
}

func (e *PBACEngine) Evaluate(req AccessRequest) AccessDecision {
	start := time.Now()
	e.mu.RLock()
	defer e.mu.RUnlock()

	e.metrics.TotalEvaluations++

	decision := AccessDecision{
		Allowed: false,
		Effect:  EffectDeny,
		Reason:  "No matching policy found — default deny",
	}

	var auditTrail []AuditEntry

	for _, policy := range e.policies {
		if !policy.Enabled {
			continue
		}

		resourceMatch := matchResources(policy.Resources, req.Resource)
		actionMatch := matchAction(policy.Actions, req.Action)

		if !resourceMatch || !actionMatch {
			auditTrail = append(auditTrail, AuditEntry{
				PolicyID: policy.ID, Effect: policy.Effect, Matched: false,
				Reason: "Resource or action mismatch", Timestamp: time.Now(),
			})
			continue
		}

		conditionsMatch := evaluateConditions(policy.Conditions, req)

		auditTrail = append(auditTrail, AuditEntry{
			PolicyID: policy.ID, Effect: policy.Effect, Matched: conditionsMatch,
			Reason: fmt.Sprintf("Conditions evaluated: %v", conditionsMatch), Timestamp: time.Now(),
		})

		if conditionsMatch {
			if policy.Effect == EffectDeny {
				decision = AccessDecision{
					Allowed:    false,
					PolicyID:   policy.ID,
					PolicyName: policy.Name,
					Effect:     EffectDeny,
					Reason:     fmt.Sprintf("Denied by policy: %s", policy.Name),
					AuditTrail: auditTrail,
				}
				e.metrics.DeniedRequests++
				decision.EvaluationMs = time.Since(start).Microseconds()
				return decision
			}
			decision = AccessDecision{
				Allowed:    true,
				PolicyID:   policy.ID,
				PolicyName: policy.Name,
				Effect:     EffectAllow,
				Reason:     fmt.Sprintf("Allowed by policy: %s", policy.Name),
				AuditTrail: auditTrail,
			}
		}
	}

	if decision.Allowed {
		e.metrics.AllowedRequests++
	} else {
		e.metrics.DeniedRequests++
	}

	decision.EvaluationMs = time.Since(start).Microseconds()
	decision.AuditTrail = auditTrail
	return decision
}

func (e *PBACEngine) AddPolicy(p Policy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	e.policies = append(e.policies, p)
	e.metrics.PoliciesLoaded = len(e.policies)
	e.metrics.LastPolicyUpdate = time.Now()
}

func (e *PBACEngine) RemovePolicy(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, p := range e.policies {
		if p.ID == id {
			e.policies = append(e.policies[:i], e.policies[i+1:]...)
			e.metrics.PoliciesLoaded = len(e.policies)
			return true
		}
	}
	return false
}

func (e *PBACEngine) ListPolicies() []Policy {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Policy, len(e.policies))
	copy(result, e.policies)
	return result
}

func (e *PBACEngine) GetMetrics() EngineMetrics {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.metrics
}

func matchResources(patterns []string, res Resource) bool {
	target := fmt.Sprintf("%s:%s", res.Type, res.ID)
	for _, pattern := range patterns {
		if pattern == target || pattern == res.Type+":*:*" || pattern == res.Type+":*" || pattern == "*" {
			return true
		}
	}
	return false
}

func matchAction(allowed []string, action string) bool {
	for _, a := range allowed {
		if a == action || a == "*" {
			return true
		}
	}
	return false
}

func evaluateConditions(conditions []Condition, req AccessRequest) bool {
	for _, cond := range conditions {
		subjectVal, ok := req.Subject.Attributes[cond.Attribute]
		if !ok {
			return false
		}
		if !evaluateCondition(cond, subjectVal) {
			return false
		}
	}
	return true
}

func evaluateCondition(cond Condition, actual interface{}) bool {
	switch cond.Operator {
	case "eq":
		return fmt.Sprintf("%v", actual) == fmt.Sprintf("%v", cond.Value)
	case "neq":
		return fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", cond.Value)
	case "in":
		if values, ok := cond.Value.([]string); ok {
			for _, v := range values {
				if fmt.Sprintf("%v", actual) == v {
					return true
				}
			}
		}
		return false
	case "not_in":
		if values, ok := cond.Value.([]string); ok {
			for _, v := range values {
				if fmt.Sprintf("%v", actual) == v {
					return false
				}
			}
		}
		return true
	case "gte":
		return toFloat(actual) >= toFloat(cond.Value)
	case "gt":
		return toFloat(actual) > toFloat(cond.Value)
	case "lte":
		return toFloat(actual) <= toFloat(cond.Value)
	case "lt":
		return toFloat(actual) < toFloat(cond.Value)
	default:
		return false
	}
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case float64:
		return val
	case float32:
		return float64(val)
	default:
		return 0
	}
}
