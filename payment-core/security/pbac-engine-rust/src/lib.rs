use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq)]
pub enum PolicyEffect {
    Allow,
    Deny,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Operator {
    Eq,
    Neq,
    Gt,
    Lt,
    Gte,
    Lte,
    In,
    NotIn,
    Between,
}

#[derive(Debug, Clone)]
pub struct Condition {
    pub attribute: String,
    pub operator: Operator,
    pub value: ConditionValue,
}

#[derive(Debug, Clone)]
pub enum ConditionValue {
    String(String),
    Number(f64),
    StringList(Vec<String>),
    Range(f64, f64),
}

#[derive(Debug, Clone)]
pub struct Policy {
    pub id: String,
    pub name: String,
    pub effect: PolicyEffect,
    pub resources: Vec<String>,
    pub actions: Vec<String>,
    pub conditions: Vec<Condition>,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug)]
pub struct AccessRequest {
    pub subject_id: String,
    pub subject_type: String,
    pub attributes: HashMap<String, AttributeValue>,
    pub resource_type: String,
    pub resource_id: String,
    pub action: String,
}

#[derive(Debug, Clone)]
pub enum AttributeValue {
    String(String),
    Number(f64),
}

#[derive(Debug)]
pub struct AccessDecision {
    pub allowed: bool,
    pub policy_id: Option<String>,
    pub effect: PolicyEffect,
    pub reason: String,
    pub evaluation_us: u128,
}

pub struct PBACEngine {
    policies: Vec<Policy>,
    total_evaluations: u64,
    allowed_count: u64,
    denied_count: u64,
}

impl PBACEngine {
    pub fn new() -> Self {
        let mut engine = PBACEngine {
            policies: Vec::new(),
            total_evaluations: 0,
            allowed_count: 0,
            denied_count: 0,
        };
        engine.load_default_policies();
        engine
    }

    pub fn evaluate(&mut self, req: &AccessRequest) -> AccessDecision {
        let start = Instant::now();
        self.total_evaluations += 1;

        let mut best_deny: Option<&Policy> = None;
        let mut best_allow: Option<&Policy> = None;

        for policy in &self.policies {
            if !policy.enabled {
                continue;
            }
            if !self.matches_resource(&policy.resources, &req.resource_type, &req.resource_id) {
                continue;
            }
            if !policy.actions.iter().any(|a| a == &req.action || a == "*") {
                continue;
            }
            if !self.evaluate_conditions(&policy.conditions, &req.attributes) {
                continue;
            }

            match policy.effect {
                PolicyEffect::Deny => {
                    if best_deny.is_none() || policy.priority > best_deny.unwrap().priority {
                        best_deny = Some(policy);
                    }
                }
                PolicyEffect::Allow => {
                    if best_allow.is_none() || policy.priority > best_allow.unwrap().priority {
                        best_allow = Some(policy);
                    }
                }
            }
        }

        let elapsed = start.elapsed().as_micros();

        // Deny takes precedence over allow at same or higher priority
        if let Some(deny_policy) = best_deny {
            if best_allow.is_none() || deny_policy.priority >= best_allow.unwrap().priority {
                self.denied_count += 1;
                return AccessDecision {
                    allowed: false,
                    policy_id: Some(deny_policy.id.clone()),
                    effect: PolicyEffect::Deny,
                    reason: format!("Denied by policy: {}", deny_policy.name),
                    evaluation_us: elapsed,
                };
            }
        }

        if let Some(allow_policy) = best_allow {
            self.allowed_count += 1;
            return AccessDecision {
                allowed: true,
                policy_id: Some(allow_policy.id.clone()),
                effect: PolicyEffect::Allow,
                reason: format!("Allowed by policy: {}", allow_policy.name),
                evaluation_us: elapsed,
            };
        }

        self.denied_count += 1;
        AccessDecision {
            allowed: false,
            policy_id: None,
            effect: PolicyEffect::Deny,
            reason: "No matching policy — default deny".to_string(),
            evaluation_us: elapsed,
        }
    }

    pub fn add_policy(&mut self, policy: Policy) {
        self.policies.push(policy);
    }

    pub fn remove_policy(&mut self, id: &str) -> bool {
        if let Some(pos) = self.policies.iter().position(|p| p.id == id) {
            self.policies.remove(pos);
            true
        } else {
            false
        }
    }

    pub fn list_policies(&self) -> &[Policy] {
        &self.policies
    }

    fn matches_resource(&self, patterns: &[String], res_type: &str, res_id: &str) -> bool {
        let target = format!("{}:{}", res_type, res_id);
        patterns.iter().any(|p| {
            p == &target || p == &format!("{}:*:*", res_type) || p == &format!("{}:*", res_type) || p == "*"
        })
    }

    fn evaluate_conditions(&self, conditions: &[Condition], attrs: &HashMap<String, AttributeValue>) -> bool {
        conditions.iter().all(|cond| {
            if let Some(attr_val) = attrs.get(&cond.attribute) {
                self.evaluate_condition(cond, attr_val)
            } else {
                false
            }
        })
    }

    fn evaluate_condition(&self, cond: &Condition, actual: &AttributeValue) -> bool {
        match (&cond.operator, &cond.value, actual) {
            (Operator::Eq, ConditionValue::String(expected), AttributeValue::String(actual)) => actual == expected,
            (Operator::Neq, ConditionValue::String(expected), AttributeValue::String(actual)) => actual != expected,
            (Operator::In, ConditionValue::StringList(list), AttributeValue::String(actual)) => list.contains(actual),
            (Operator::NotIn, ConditionValue::StringList(list), AttributeValue::String(actual)) => !list.contains(actual),
            (Operator::Gt, ConditionValue::Number(expected), AttributeValue::Number(actual)) => actual > expected,
            (Operator::Gte, ConditionValue::Number(expected), AttributeValue::Number(actual)) => actual >= expected,
            (Operator::Lt, ConditionValue::Number(expected), AttributeValue::Number(actual)) => actual < expected,
            (Operator::Lte, ConditionValue::Number(expected), AttributeValue::Number(actual)) => actual <= expected,
            (Operator::Eq, ConditionValue::Number(expected), AttributeValue::Number(actual)) => (actual - expected).abs() < f64::EPSILON,
            _ => false,
        }
    }

    fn load_default_policies(&mut self) {
        self.policies = vec![
            Policy {
                id: "pol-001".into(), name: "NIP Payment Authorization".into(),
                effect: PolicyEffect::Allow, resources: vec!["payment:nip:*".into()],
                actions: vec!["create".into(), "approve".into()],
                conditions: vec![
                    Condition { attribute: "role".into(), operator: Operator::In, value: ConditionValue::StringList(vec!["teller".into(), "supervisor".into(), "system".into()]) },
                    Condition { attribute: "security_level".into(), operator: Operator::Gte, value: ConditionValue::Number(3.0) },
                ],
                priority: 100, enabled: true,
            },
            Policy {
                id: "pol-002".into(), name: "High Value Transaction Block".into(),
                effect: PolicyEffect::Deny, resources: vec!["payment:*:*".into()],
                actions: vec!["approve".into()],
                conditions: vec![
                    Condition { attribute: "transaction_amount".into(), operator: Operator::Gt, value: ConditionValue::Number(10_000_000.0) },
                    Condition { attribute: "role".into(), operator: Operator::Neq, value: ConditionValue::String("supervisor".into()) },
                ],
                priority: 200, enabled: true,
            },
            Policy {
                id: "pol-003".into(), name: "Sanctions Block".into(),
                effect: PolicyEffect::Deny, resources: vec!["payment:*:*".into(), "remittance:*:*".into()],
                actions: vec!["create".into(), "approve".into()],
                conditions: vec![
                    Condition { attribute: "risk_score".into(), operator: Operator::Gte, value: ConditionValue::Number(0.9) },
                ],
                priority: 300, enabled: true,
            },
            Policy {
                id: "pol-004".into(), name: "Settlement Authorization".into(),
                effect: PolicyEffect::Allow, resources: vec!["settlement:*:*".into()],
                actions: vec!["authorize".into(), "release".into()],
                conditions: vec![
                    Condition { attribute: "role".into(), operator: Operator::In, value: ConditionValue::StringList(vec!["treasury_officer".into(), "settlement_officer".into(), "cfo".into()]) },
                    Condition { attribute: "security_level".into(), operator: Operator::Gte, value: ConditionValue::Number(5.0) },
                ],
                priority: 220, enabled: true,
            },
        ];
    }
}

impl Default for PBACEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allow_nip_payment() {
        let mut engine = PBACEngine::new();
        let mut attrs = HashMap::new();
        attrs.insert("role".into(), AttributeValue::String("teller".into()));
        attrs.insert("security_level".into(), AttributeValue::Number(3.0));

        let req = AccessRequest {
            subject_id: "user-001".into(), subject_type: "user".into(),
            attributes: attrs, resource_type: "payment".into(),
            resource_id: "nip:txn-001".into(), action: "create".into(),
        };
        let decision = engine.evaluate(&req);
        assert!(decision.allowed);
    }

    #[test]
    fn test_deny_high_value() {
        let mut engine = PBACEngine::new();
        let mut attrs = HashMap::new();
        attrs.insert("role".into(), AttributeValue::String("teller".into()));
        attrs.insert("security_level".into(), AttributeValue::Number(3.0));
        attrs.insert("transaction_amount".into(), AttributeValue::Number(15_000_000.0));

        let req = AccessRequest {
            subject_id: "user-002".into(), subject_type: "user".into(),
            attributes: attrs, resource_type: "payment".into(),
            resource_id: "nip:txn-002".into(), action: "approve".into(),
        };
        let decision = engine.evaluate(&req);
        assert!(!decision.allowed);
    }

    #[test]
    fn test_deny_sanctions() {
        let mut engine = PBACEngine::new();
        let mut attrs = HashMap::new();
        attrs.insert("role".into(), AttributeValue::String("teller".into()));
        attrs.insert("risk_score".into(), AttributeValue::Number(0.95));

        let req = AccessRequest {
            subject_id: "user-003".into(), subject_type: "user".into(),
            attributes: attrs, resource_type: "remittance".into(),
            resource_id: "outbound:txn-003".into(), action: "create".into(),
        };
        let decision = engine.evaluate(&req);
        assert!(!decision.allowed);
    }
}
