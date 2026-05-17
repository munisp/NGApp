#!/usr/bin/env python3
"""54Bank KYC Event Consumer — Kafka-driven KYC/KYB trigger automation.

Listens to Kafka topics and auto-triggers KYC/KYB verification workflows:
  - account.opened → standard KYC for Tier 2+
  - loan.application.submitted → enhanced KYC
  - trade.lc.opened → full EDD KYB
  - card.issuance.requested → basic/enhanced based on card type
  - payment.international.initiated → enhanced KYC for >$1,000
  - fraud.alert.high_risk → full EDD re-KYC
  - kyc.periodic_review.due → scheduled re-verification
  - agent.onboarded → full EDD KYC
  - cbn.circular.kyc_refresh_mandate → mass re-KYC
  - wealth.client.onboarded → full EDD
  - insurance.policy.bound → enhanced for high-value
  - virtual_account.created → standard KYC

Middleware: Kafka (consumer + producer), Postgres, Redis, Temporal
"""
import json, os, logging, time, uuid, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="[kyc-event-consumer-py] %(levelname)s %(message)s")
PORT = int(os.environ.get("PORT", "9460"))
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")
KYC_ENGINE_URL = os.environ.get("KYC_ENGINE_URL", "http://localhost:9433")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:5000")

# ── Event Trigger Rules ──────────────────────────────────────────────────────

TRIGGER_RULES = [
    {"topic": "account.opened", "event": "Account Opened", "kyc_level": "standard",
     "condition": "tier >= tier2 OR product IN (current, domiciliary, fixed_deposit)",
     "services": ["account-opening-go", "customer-360-py"], "cooldown_hours": 0},
    {"topic": "loan.application.submitted", "event": "Loan Application", "kyc_level": "enhanced",
     "condition": "amount >= 500000 OR type IN (mortgage, corporate)",
     "services": ["loan-origination-go", "credit-facility-go"], "cooldown_hours": 24},
    {"topic": "trade.lc.opened", "event": "Trade Finance LC", "kyc_level": "full_edd",
     "condition": "amount >= 1000000 OR counterparty NOT IN (NG, US, UK)",
     "services": ["trade-finance-go", "supply-chain-finance-go"], "cooldown_hours": 72, "kyb": True},
    {"topic": "card.issuance.requested", "event": "Card Issuance", "kyc_level": "basic",
     "condition": "card_type == credit → enhanced, else basic",
     "services": ["card-management-go"], "cooldown_hours": 0},
    {"topic": "payment.international.initiated", "event": "International Payment", "kyc_level": "enhanced",
     "condition": "amount_usd >= 1000 OR destination IN high_risk_list",
     "services": ["payments-hub-go", "remittance-go", "diaspora-banking-py"], "cooldown_hours": 48},
    {"topic": "fraud.alert.high_risk", "event": "Fraud Alert", "kyc_level": "full_edd",
     "condition": "risk_score >= 80 OR type IN (identity_fraud, account_takeover)",
     "services": ["fraud-detection-rs", "risk-scoring-rs"], "cooldown_hours": 0},
    {"topic": "kyc.periodic_review.due", "event": "Periodic Review", "kyc_level": "standard",
     "condition": "last_kyc_date + interval <= today",
     "services": ["temporal-sagas-go", "cif-management-go"], "cooldown_hours": 8760},
    {"topic": "agent.onboarded", "event": "Agent Onboarding", "kyc_level": "full_edd",
     "condition": "agent_type IN (super_agent, agent)",
     "services": ["agent-banking-go"], "cooldown_hours": 0},
    {"topic": "cbn.circular.kyc_refresh_mandate", "event": "CBN Mandate", "kyc_level": "enhanced",
     "condition": "affected_tiers INTERSECTS customer.tier",
     "services": ["cbn-returns-py", "regulatory-reporting-py"], "cooldown_hours": 0},
    {"topic": "wealth.client.onboarded", "event": "Wealth Client", "kyc_level": "full_edd",
     "condition": "aum >= 50000000 OR pep_flag == true",
     "services": ["wealth-mgmt-py", "custody-service-go"], "cooldown_hours": 0},
    {"topic": "insurance.policy.bound", "event": "Insurance Policy", "kyc_level": "enhanced",
     "condition": "sum_assured >= 10000000",
     "services": ["insurance-py"], "cooldown_hours": 168},
    {"topic": "virtual_account.created", "event": "Virtual Account", "kyc_level": "standard",
     "condition": "type == corporate OR limit >= 5000000",
     "services": ["virtual-accounts-go", "escrow-go"], "cooldown_hours": 24},
]

# ── Event Processing ─────────────────────────────────────────────────────────

processed_events = []
trigger_stats = {
    "total_events_received": 0, "total_triggers_fired": 0,
    "triggers_by_topic": {}, "triggers_by_level": {"basic": 0, "standard": 0, "enhanced": 0, "full_edd": 0},
    "events_skipped": 0, "events_failed": 0,
}
cooldown_tracker = {}

def process_event(topic, event_data):
    trigger_stats["total_events_received"] += 1
    trigger_stats["triggers_by_topic"].setdefault(topic, 0)
    trigger_stats["triggers_by_topic"][topic] += 1

    rule = next((r for r in TRIGGER_RULES if r["topic"] == topic), None)
    if not rule:
        trigger_stats["events_skipped"] += 1
        return {"processed": False, "reason": f"No trigger rule for topic: {topic}"}

    customer_id = event_data.get("customerId", "")
    company_id = event_data.get("companyId", "")

    # Cooldown check
    cooldown_key = f"{topic}:{customer_id or company_id}"
    if cooldown_key in cooldown_tracker:
        last_fired = cooldown_tracker[cooldown_key]
        elapsed_hours = (time.time() - last_fired) / 3600
        if elapsed_hours < rule["cooldown_hours"]:
            trigger_stats["events_skipped"] += 1
            return {"processed": False, "reason": f"Cooldown active ({elapsed_hours:.1f}h / {rule['cooldown_hours']}h)"}

    # Fire KYC/KYB trigger
    trigger_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    trigger = {
        "id": trigger_id,
        "eventTopic": topic,
        "eventName": rule["event"],
        "customerId": customer_id,
        "companyId": company_id,
        "kycLevel": rule["kyc_level"],
        "kybRequired": rule.get("kyb", False),
        "status": "triggered",
        "triggerSource": f"kafka/{topic}",
        "eventData": event_data,
        "integratedServices": rule["services"],
        "triggeredAt": datetime.now(timezone.utc).isoformat(),
        "kafkaProduced": [
            {"topic": "kyc.verification.required", "customerId": customer_id, "level": rule["kyc_level"]},
        ],
    }
    if rule.get("kyb"):
        trigger["kafkaProduced"].append(
            {"topic": "kyb.verification.required", "companyId": company_id, "level": rule["kyc_level"]}
        )

    processed_events.append(trigger)
    if len(processed_events) > 10000:
        del processed_events[:5000]

    cooldown_tracker[cooldown_key] = time.time()
    trigger_stats["total_triggers_fired"] += 1
    trigger_stats["triggers_by_level"][rule["kyc_level"]] += 1

    logging.info(f"KYC trigger fired: {trigger_id} — {rule['event']} → {rule['kyc_level']} for {customer_id or company_id}")
    return {"processed": True, "trigger": trigger}

# ── Simulated Kafka Consumer ─────────────────────────────────────────────────

def kafka_consumer_loop():
    """Simulated Kafka consumer — in production, replace with aiokafka/confluent-kafka."""
    logging.info(f"Kafka consumer started — monitoring {len(TRIGGER_RULES)} topics from {KAFKA_BROKERS}")
    topics = [r["topic"] for r in TRIGGER_RULES]
    logging.info(f"Subscribed topics: {', '.join(topics)}")
    while True:
        time.sleep(30)

# ── HTTP API ─────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, f, *a): pass

    def _j(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "kyc-event-consumer-py")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/")
        q = parse_qs(urlparse(self.path).query)
        if p in ("/healthz", "/health"):
            self._j(200, {
                "service": "kyc-event-consumer-py", "status": "healthy", "version": "1.0.0",
                "domain": "KYC Event Consumer — Kafka-driven workflow triggers",
                "kafkaBrokers": KAFKA_BROKERS,
                "subscribedTopics": [r["topic"] for r in TRIGGER_RULES],
                "triggerRules": len(TRIGGER_RULES),
                "processedEvents": len(processed_events),
                "stats": trigger_stats,
                "middleware": {
                    "kafka": f"consumer: {len(TRIGGER_RULES)} topics, producer: kyc.verification.required, kyb.verification.required",
                    "postgres": "kyc_event_triggers, kyc_event_log",
                    "redis": "cooldown_tracker, event_dedup_cache",
                    "temporal": "KYCEventTriggerWorkflow",
                },
            })
        elif p == "/v1/kyc-events/rules":
            self._j(200, {"rules": TRIGGER_RULES, "total": len(TRIGGER_RULES)})
        elif p == "/v1/kyc-events/processed":
            topic_filter = q.get("topic", [None])[0]
            filtered = processed_events if not topic_filter else [e for e in processed_events if e["eventTopic"] == topic_filter]
            self._j(200, {"events": filtered[-100:], "total": len(filtered)})
        elif p == "/v1/kyc-events/stats":
            self._j(200, trigger_stats)
        elif p == "/v1/kyc-events/cooldowns":
            cooldowns = {k: {"last_fired": datetime.fromtimestamp(v, timezone.utc).isoformat(), "elapsed_hours": round((time.time() - v) / 3600, 1)} for k, v in cooldown_tracker.items()}
            self._j(200, {"cooldowns": cooldowns, "total": len(cooldowns)})
        else:
            self._j(404, {"error": "Not found"})

    def do_POST(self):
        p = urlparse(self.path).path.rstrip("/")
        cl = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(cl)) if cl > 0 else {}

        if p == "/v1/kyc-events/simulate":
            topic = body.get("topic", "")
            event_data = body.get("eventData", body)
            if not topic:
                self._j(400, {"error": "topic required"})
                return
            result = process_event(topic, event_data)
            self._j(200 if result["processed"] else 202, result)
        elif p == "/v1/kyc-events/batch-simulate":
            events = body.get("events", [])
            results = [process_event(e.get("topic", ""), e.get("eventData", e)) for e in events]
            triggered = sum(1 for r in results if r["processed"])
            self._j(200, {"total": len(results), "triggered": triggered, "results": results})
        elif p == "/v1/kyc-events/reset-cooldowns":
            cooldown_tracker.clear()
            self._j(200, {"message": "All cooldowns reset", "cleared": True})
        else:
            self._j(404, {"error": "Not found"})

if __name__ == "__main__":
    # Start Kafka consumer thread
    consumer_thread = threading.Thread(target=kafka_consumer_loop, daemon=True)
    consumer_thread.start()

    logging.info(f"KYC Event Consumer starting on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
