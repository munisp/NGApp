package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	port         = getEnv("RULES_ENGINE_PORT", "8145")
	kafkaBrokers = getEnv("KAFKA_BROKERS", "kafka:9092")
	redisURL     = getEnv("REDIS_URL", "redis://redis:6379")
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// RuleAction defines what happens when a rule matches
type RuleAction string

const (
	ActionAllow     RuleAction = "allow"
	ActionBlock     RuleAction = "block"
	ActionReview    RuleAction = "review"
	ActionChallenge RuleAction = "challenge"
)

// RuleOperator defines comparison operators
type RuleOperator string

const (
	OpEquals          RuleOperator = "equals"
	OpNotEquals       RuleOperator = "not_equals"
	OpGreaterThan     RuleOperator = "greater_than"
	OpLessThan        RuleOperator = "less_than"
	OpGreaterOrEqual  RuleOperator = "greater_or_equal"
	OpLessOrEqual     RuleOperator = "less_or_equal"
	OpContains        RuleOperator = "contains"
	OpNotContains     RuleOperator = "not_contains"
	OpIn              RuleOperator = "in"
	OpNotIn           RuleOperator = "not_in"
	OpRegex           RuleOperator = "regex"
	OpIsTrue          RuleOperator = "is_true"
	OpIsFalse         RuleOperator = "is_false"
)

// Condition represents a single rule condition
type Condition struct {
	Field    string       `json:"field"`
	Operator RuleOperator `json:"operator"`
	Value    interface{}  `json:"value"`
}

// Rule represents a fraud detection rule
type Rule struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Conditions  []Condition `json:"conditions"`
	LogicType   string      `json:"logic_type"` // "all" (AND) or "any" (OR)
	Action      RuleAction  `json:"action"`
	Priority    int         `json:"priority"` // Higher = evaluated first
	Enabled     bool        `json:"enabled"`
	MerchantID  string      `json:"merchant_id"` // "" = global rule
	CreatedAt   int64       `json:"created_at"`
	UpdatedAt   int64       `json:"updated_at"`
	CreatedBy   string      `json:"created_by"`
	MatchCount  int64       `json:"match_count"`
	LastMatched int64       `json:"last_matched"`
}

// RuleEvalResult is the result of evaluating a single rule
type RuleEvalResult struct {
	RuleID        string     `json:"rule_id"`
	RuleName      string     `json:"rule_name"`
	Matched       bool       `json:"matched"`
	Action        RuleAction `json:"action"`
	MatchedConds  []string   `json:"matched_conditions"`
	FailedConds   []string   `json:"failed_conditions"`
	Priority      int        `json:"priority"`
}

// EvalResponse is the full evaluation response
type EvalResponse struct {
	TransactionID string           `json:"transaction_id"`
	FinalAction   RuleAction       `json:"final_action"`
	RulesMatched  int              `json:"rules_matched"`
	RulesEvaluated int             `json:"rules_evaluated"`
	Results       []RuleEvalResult `json:"results"`
	EvalTimeMs    float64          `json:"eval_time_ms"`
}

// RuleStore manages rules
type RuleStore struct {
	mu    sync.RWMutex
	rules map[string]*Rule
}

func NewRuleStore() *RuleStore {
	rs := &RuleStore{
		rules: make(map[string]*Rule),
	}
	rs.loadDefaultRules()
	return rs
}

func (rs *RuleStore) loadDefaultRules() {
	defaultRules := []*Rule{
		{
			ID:          "rule_001",
			Name:        "Block high-velocity card usage",
			Description: "Block if more than 5 transactions per card in 1 hour",
			Conditions: []Condition{
				{Field: "txns_per_card_1h", Operator: OpGreaterThan, Value: float64(5)},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  100,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_002",
			Name:        "Block multiple cards from same IP",
			Description: "Block if more than 3 different cards used from same IP in 1 hour",
			Conditions: []Condition{
				{Field: "cards_per_ip_1h", Operator: OpGreaterThan, Value: float64(3)},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  95,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_003",
			Name:        "Challenge on country mismatch",
			Description: "Require 3DS if IP country doesn't match card country",
			Conditions: []Condition{
				{Field: "country_mismatch", Operator: OpIsTrue, Value: nil},
			},
			LogicType: "all",
			Action:    ActionChallenge,
			Priority:  80,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_004",
			Name:        "Block impossible travel",
			Description: "Block transaction if impossible travel detected",
			Conditions: []Condition{
				{Field: "impossible_travel", Operator: OpIsTrue, Value: nil},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  99,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_005",
			Name:        "Block throwaway emails",
			Description: "Block transactions using throwaway email addresses",
			Conditions: []Condition{
				{Field: "is_throwaway_email", Operator: OpIsTrue, Value: nil},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  90,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_006",
			Name:        "Review large transactions",
			Description: "Flag transactions over $10,000 for manual review",
			Conditions: []Condition{
				{Field: "amount", Operator: OpGreaterThan, Value: float64(10000)},
			},
			LogicType: "all",
			Action:    ActionReview,
			Priority:  50,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_007",
			Name:        "Block emulator transactions",
			Description: "Block transactions from emulated devices",
			Conditions: []Condition{
				{Field: "is_emulator", Operator: OpIsTrue, Value: nil},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  92,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_008",
			Name:        "Challenge VPN transactions above threshold",
			Description: "Require verification for VPN transactions over $500",
			Conditions: []Condition{
				{Field: "is_vpn", Operator: OpIsTrue, Value: nil},
				{Field: "amount", Operator: OpGreaterThan, Value: float64(500)},
			},
			LogicType: "all",
			Action:    ActionChallenge,
			Priority:  70,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_009",
			Name:        "Block high-risk BIN with high amount",
			Description: "Block if card BIN has high fraud rate and amount > $1000",
			Conditions: []Condition{
				{Field: "bin_fraud_rate_network", Operator: OpGreaterThan, Value: float64(0.03)},
				{Field: "amount", Operator: OpGreaterThan, Value: float64(1000)},
			},
			LogicType: "all",
			Action:    ActionBlock,
			Priority:  85,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
		{
			ID:          "rule_010",
			Name:        "Allow known safe merchants",
			Description: "Allow transactions from pre-approved merchants",
			Conditions: []Condition{
				{Field: "merchant_id", Operator: OpIn, Value: "merchant_safe_001,merchant_safe_002,merchant_safe_003"},
			},
			LogicType: "all",
			Action:    ActionAllow,
			Priority:  200,
			Enabled:   true,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
			CreatedBy: "system",
		},
	}

	for _, rule := range defaultRules {
		rs.rules[rule.ID] = rule
	}
}

func (rs *RuleStore) Add(rule *Rule) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rule.CreatedAt = time.Now().Unix()
	rule.UpdatedAt = time.Now().Unix()
	rs.rules[rule.ID] = rule
}

func (rs *RuleStore) Get(id string) (*Rule, bool) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	rule, ok := rs.rules[id]
	return rule, ok
}

func (rs *RuleStore) Delete(id string) bool {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if _, ok := rs.rules[id]; ok {
		delete(rs.rules, id)
		return true
	}
	return false
}

func (rs *RuleStore) Update(id string, updated *Rule) bool {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if _, ok := rs.rules[id]; ok {
		updated.ID = id
		updated.UpdatedAt = time.Now().Unix()
		rs.rules[id] = updated
		return true
	}
	return false
}

func (rs *RuleStore) ListEnabled(merchantID string) []*Rule {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	var rules []*Rule
	for _, rule := range rs.rules {
		if rule.Enabled && (rule.MerchantID == "" || rule.MerchantID == merchantID) {
			rules = append(rules, rule)
		}
	}

	// Sort by priority (descending)
	for i := 0; i < len(rules); i++ {
		for j := i + 1; j < len(rules); j++ {
			if rules[j].Priority > rules[i].Priority {
				rules[i], rules[j] = rules[j], rules[i]
			}
		}
	}

	return rules
}

func (rs *RuleStore) ListAll() []*Rule {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	rules := make([]*Rule, 0, len(rs.rules))
	for _, rule := range rs.rules {
		rules = append(rules, rule)
	}
	return rules
}

// evaluateCondition checks if a single condition is met
func evaluateCondition(cond Condition, data map[string]interface{}) bool {
	fieldVal, exists := data[cond.Field]
	if !exists {
		return false
	}

	switch cond.Operator {
	case OpEquals:
		return fmt.Sprintf("%v", fieldVal) == fmt.Sprintf("%v", cond.Value)
	case OpNotEquals:
		return fmt.Sprintf("%v", fieldVal) != fmt.Sprintf("%v", cond.Value)
	case OpGreaterThan:
		return toFloat(fieldVal) > toFloat(cond.Value)
	case OpLessThan:
		return toFloat(fieldVal) < toFloat(cond.Value)
	case OpGreaterOrEqual:
		return toFloat(fieldVal) >= toFloat(cond.Value)
	case OpLessOrEqual:
		return toFloat(fieldVal) <= toFloat(cond.Value)
	case OpContains:
		return strings.Contains(fmt.Sprintf("%v", fieldVal), fmt.Sprintf("%v", cond.Value))
	case OpNotContains:
		return !strings.Contains(fmt.Sprintf("%v", fieldVal), fmt.Sprintf("%v", cond.Value))
	case OpIn:
		valStr := fmt.Sprintf("%v", fieldVal)
		allowedList := strings.Split(fmt.Sprintf("%v", cond.Value), ",")
		for _, v := range allowedList {
			if strings.TrimSpace(v) == valStr {
				return true
			}
		}
		return false
	case OpNotIn:
		valStr := fmt.Sprintf("%v", fieldVal)
		blockedList := strings.Split(fmt.Sprintf("%v", cond.Value), ",")
		for _, v := range blockedList {
			if strings.TrimSpace(v) == valStr {
				return false
			}
		}
		return true
	case OpIsTrue:
		return toBool(fieldVal)
	case OpIsFalse:
		return !toBool(fieldVal)
	}

	return false
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case json.Number:
		f, _ := val.Float64()
		return f
	}
	return 0
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "1"
	case float64:
		return val != 0
	case int:
		return val != 0
	}
	return false
}

// evaluateRule checks all conditions of a rule
func evaluateRule(rule *Rule, data map[string]interface{}) RuleEvalResult {
	result := RuleEvalResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Action:   rule.Action,
		Priority: rule.Priority,
	}

	matchedConds := make([]string, 0)
	failedConds := make([]string, 0)

	for _, cond := range rule.Conditions {
		condStr := fmt.Sprintf("%s %s %v", cond.Field, cond.Operator, cond.Value)
		if evaluateCondition(cond, data) {
			matchedConds = append(matchedConds, condStr)
		} else {
			failedConds = append(failedConds, condStr)
		}
	}

	result.MatchedConds = matchedConds
	result.FailedConds = failedConds

	if rule.LogicType == "any" {
		result.Matched = len(matchedConds) > 0
	} else {
		result.Matched = len(failedConds) == 0 && len(matchedConds) > 0
	}

	return result
}

// Global rule store
var ruleStore = NewRuleStore()

// Action priority: block > challenge > review > allow
func actionPriority(action RuleAction) int {
	switch action {
	case ActionBlock:
		return 4
	case ActionChallenge:
		return 3
	case ActionReview:
		return 2
	case ActionAllow:
		return 1
	}
	return 0
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	rules := ruleStore.ListAll()
	enabledCount := 0
	for _, r := range rules {
		if r.Enabled {
			enabledCount++
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "healthy",
		"service":       "rules-engine",
		"version":       "1.0.0",
		"total_rules":   len(rules),
		"enabled_rules": enabledCount,
		"operators":     []string{"equals", "not_equals", "greater_than", "less_than", "contains", "in", "not_in", "is_true", "is_false"},
		"actions":       []string{"allow", "block", "review", "challenge"},
		"middleware": map[string]string{
			"kafka": kafkaBrokers,
			"redis": redisURL,
		},
	})
}

func evaluateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		TransactionID string                 `json:"transaction_id"`
		MerchantID    string                 `json:"merchant_id"`
		Data          map[string]interface{} `json:"data"`
	}

	decoder := json.NewDecoder(r.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	start := time.Now()

	rules := ruleStore.ListEnabled(req.MerchantID)

	var results []RuleEvalResult
	finalAction := ActionAllow
	matchedCount := 0

	for _, rule := range rules {
		result := evaluateRule(rule, req.Data)
		results = append(results, result)

		if result.Matched {
			matchedCount++

			// Update match stats
			rule.MatchCount++
			rule.LastMatched = time.Now().Unix()

			// Allow rules with highest priority override everything
			if result.Action == ActionAllow && rule.Priority > 150 {
				finalAction = ActionAllow
				break
			}

			// Otherwise, take the most restrictive action
			if actionPriority(result.Action) > actionPriority(finalAction) {
				finalAction = result.Action
			}
		}
	}

	evalTime := float64(time.Since(start).Microseconds()) / 1000.0

	log.Printf("[Kafka] Rules evaluated: txn=%s, rules=%d, matched=%d, action=%s, time=%.2fms",
		req.TransactionID, len(rules), matchedCount, finalAction, evalTime)

	writeJSON(w, http.StatusOK, EvalResponse{
		TransactionID:  req.TransactionID,
		FinalAction:    finalAction,
		RulesMatched:   matchedCount,
		RulesEvaluated: len(rules),
		Results:        results,
		EvalTimeMs:     evalTime,
	})
}

func listRulesHandler(w http.ResponseWriter, r *http.Request) {
	rules := ruleStore.ListAll()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rules": rules,
		"total": len(rules),
	})
}

func createRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var rule Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if rule.ID == "" {
		rule.ID = fmt.Sprintf("rule_%d", time.Now().UnixNano())
	}

	ruleStore.Add(&rule)

	log.Printf("[Kafka] Rule created: id=%s, name=%s, action=%s", rule.ID, rule.Name, rule.Action)

	writeJSON(w, http.StatusCreated, rule)
}

func getRuleHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/rules/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Rule ID required"})
		return
	}

	rule, ok := ruleStore.Get(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rule not found"})
		return
	}

	writeJSON(w, http.StatusOK, rule)
}

func updateRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/rules/update/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Rule ID required"})
		return
	}

	var updated Rule
	if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if !ruleStore.Update(id, &updated) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rule not found"})
		return
	}

	log.Printf("[Kafka] Rule updated: id=%s", id)

	writeJSON(w, http.StatusOK, updated)
}

func deleteRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/rules/delete/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Rule ID required"})
		return
	}

	if !ruleStore.Delete(id) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rule not found"})
		return
	}

	log.Printf("[Kafka] Rule deleted: id=%s", id)

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

func toggleRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/rules/toggle/")
	rule, ok := ruleStore.Get(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rule not found"})
		return
	}

	rule.Enabled = !rule.Enabled
	rule.UpdatedAt = time.Now().Unix()

	log.Printf("[Kafka] Rule toggled: id=%s, enabled=%v", id, rule.Enabled)

	writeJSON(w, http.StatusOK, rule)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	rules := ruleStore.ListAll()

	totalMatches := int64(0)
	topRules := make([]map[string]interface{}, 0)

	for _, rule := range rules {
		totalMatches += rule.MatchCount
		if rule.MatchCount > 0 {
			topRules = append(topRules, map[string]interface{}{
				"id":          rule.ID,
				"name":        rule.Name,
				"match_count": rule.MatchCount,
				"action":      rule.Action,
			})
		}
	}

	// Sort by match count
	for i := 0; i < len(topRules); i++ {
		for j := i + 1; j < len(topRules); j++ {
			if topRules[j]["match_count"].(int64) > topRules[i]["match_count"].(int64) {
				topRules[i], topRules[j] = topRules[j], topRules[i]
			}
		}
	}

	if len(topRules) > 10 {
		topRules = topRules[:10]
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total_rules":    len(rules),
		"total_matches":  totalMatches,
		"top_rules":      topRules,
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/evaluate", evaluateHandler)
	mux.HandleFunc("/rules", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			listRulesHandler(w, r)
		case http.MethodPost:
			createRuleHandler(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
	})
	mux.HandleFunc("/rules/", getRuleHandler)
	mux.HandleFunc("/rules/update/", updateRuleHandler)
	mux.HandleFunc("/rules/delete/", deleteRuleHandler)
	mux.HandleFunc("/rules/toggle/", toggleRuleHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	log.Printf("Custom Rules Engine starting on port %s", port)
	log.Printf("Default rules loaded: %d", len(ruleStore.ListAll()))
	log.Printf("Connected to Kafka=%s, Redis=%s", kafkaBrokers, redisURL)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
