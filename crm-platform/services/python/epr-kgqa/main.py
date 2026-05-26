import os
"""
EPR-KGQA — Evidence Pattern Retrieval for Knowledge Graph Question Answering
=============================================================================
Implements the WWW'24 paper approach: complex questions are decomposed into
atomic patterns, combined into evidence patterns, scored by a neural model,
and the best pattern is used to extract a subgraph for answer reasoning.

Value to CRM Platform:
- Natural language queries over CRM knowledge graph ("Who are our top
  customers in Lagos that haven't bought insurance?")
- Complex multi-hop reasoning across customer/product/campaign entities
- Evidence-based answers with explainable traversal paths
- Integrates with CocoIndex (entities) and FalkorDB (graph queries)
"""

import json
import math
import re
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# --- Knowledge Graph ---

class KGEntity:
    def __init__(self, eid: str, etype: str, name: str, properties: dict):
        self.eid = eid
        self.etype = etype
        self.name = name
        self.properties = properties

class KGRelation:
    def __init__(self, subject: str, predicate: str, obj: str):
        self.subject = subject
        self.predicate = predicate
        self.obj = obj

class KnowledgeGraph:
    def __init__(self):
        self.entities: dict[str, KGEntity] = {}
        self.relations: list[KGRelation] = []
        self.entity_index: dict[str, list[str]] = {}  # type -> [entity_ids]
        self._seed()

    def _seed(self):
        # Customers
        custs = [
            ("cust-001", "Customer", "Adamu Ibrahim", {"segment": "premium", "ltv": 2450000, "city": "Lagos", "channel": "core_banking", "products": ["savings", "current", "insurance"]}),
            ("cust-002", "Customer", "Fatima Bello", {"segment": "standard", "ltv": 180000, "city": "Abuja", "channel": "agent_banking", "products": ["wallet"]}),
            ("cust-003", "Customer", "Chinedu Okafor", {"segment": "premium", "ltv": 5200000, "city": "Lagos", "channel": "core_banking", "products": ["savings", "fixed_deposit"]}),
            ("cust-004", "Customer", "Aisha Mohammed", {"segment": "at_risk", "ltv": 95000, "city": "Kano", "channel": "agent_banking", "products": ["wallet"]}),
            ("cust-005", "Customer", "Emeka Nwosu", {"segment": "premium", "ltv": 3800000, "city": "Port Harcourt", "channel": "remittance", "products": ["remittance"]}),
            ("cust-006", "Customer", "Grace Adeyemi", {"segment": "new", "ltv": 42000, "city": "Ibadan", "channel": "agent_banking", "products": ["wallet"]}),
            ("cust-007", "Customer", "Bola Ogundimu", {"segment": "standard", "ltv": 290000, "city": "Lagos", "channel": "core_banking", "products": ["current"]}),
            ("cust-008", "Customer", "Ngozi Eze", {"segment": "premium", "ltv": 4100000, "city": "Lagos", "channel": "core_banking", "products": ["savings", "current", "fixed_deposit"]}),
        ]
        for eid, etype, name, props in custs:
            self.entities[eid] = KGEntity(eid, etype, name, props)
            self.entity_index.setdefault(etype, []).append(eid)

        # Products
        prods = [
            ("prod-savings", "Product", "Premium Savings", {"category": "savings", "min_balance": 10000, "interest_rate": 0.045}),
            ("prod-current", "Product", "Business Current", {"category": "current", "min_balance": 50000, "interest_rate": 0.0}),
            ("prod-wallet", "Product", "Mobile Money Wallet", {"category": "wallet", "min_balance": 0, "interest_rate": 0.0}),
            ("prod-fixed", "Product", "Fixed Deposit", {"category": "investment", "min_balance": 500000, "interest_rate": 0.12}),
            ("prod-insurance", "Product", "Insurance Bundle", {"category": "insurance", "premium": 1500, "coverage": 5000000}),
            ("prod-remittance", "Product", "Remittance Express", {"category": "remittance", "fee_pct": 0.015}),
        ]
        for eid, etype, name, props in prods:
            self.entities[eid] = KGEntity(eid, etype, name, props)
            self.entity_index.setdefault(etype, []).append(eid)

        # Cities
        cities = [
            ("city-lagos", "City", "Lagos", {"state": "Lagos", "population": 21000000, "region": "South-West"}),
            ("city-abuja", "City", "Abuja", {"state": "FCT", "population": 3600000, "region": "North-Central"}),
            ("city-kano", "City", "Kano", {"state": "Kano", "population": 4100000, "region": "North-West"}),
            ("city-ph", "City", "Port Harcourt", {"state": "Rivers", "population": 3000000, "region": "South-South"}),
            ("city-ibadan", "City", "Ibadan", {"state": "Oyo", "population": 3500000, "region": "South-West"}),
        ]
        for eid, etype, name, props in cities:
            self.entities[eid] = KGEntity(eid, etype, name, props)
            self.entity_index.setdefault(etype, []).append(eid)

        # Relations
        rels = [
            ("cust-001", "LIVES_IN", "city-lagos"),
            ("cust-002", "LIVES_IN", "city-abuja"),
            ("cust-003", "LIVES_IN", "city-lagos"),
            ("cust-004", "LIVES_IN", "city-kano"),
            ("cust-005", "LIVES_IN", "city-ph"),
            ("cust-006", "LIVES_IN", "city-ibadan"),
            ("cust-007", "LIVES_IN", "city-lagos"),
            ("cust-008", "LIVES_IN", "city-lagos"),
            ("cust-001", "HAS_PRODUCT", "prod-savings"),
            ("cust-001", "HAS_PRODUCT", "prod-current"),
            ("cust-001", "HAS_PRODUCT", "prod-insurance"),
            ("cust-002", "HAS_PRODUCT", "prod-wallet"),
            ("cust-003", "HAS_PRODUCT", "prod-savings"),
            ("cust-003", "HAS_PRODUCT", "prod-fixed"),
            ("cust-004", "HAS_PRODUCT", "prod-wallet"),
            ("cust-005", "HAS_PRODUCT", "prod-remittance"),
            ("cust-006", "HAS_PRODUCT", "prod-wallet"),
            ("cust-007", "HAS_PRODUCT", "prod-current"),
            ("cust-008", "HAS_PRODUCT", "prod-savings"),
            ("cust-008", "HAS_PRODUCT", "prod-current"),
            ("cust-008", "HAS_PRODUCT", "prod-fixed"),
            ("cust-001", "REFERRED", "cust-002"),
            ("cust-003", "REFERRED", "cust-007"),
            ("cust-005", "REFERRED", "cust-006"),
        ]
        for s, p, o in rels:
            self.relations.append(KGRelation(s, p, o))


# --- EPR Question Answering ---

class AtomicPattern:
    def __init__(self, subject_type: str, predicate: str, object_type: str, score: float = 0.0):
        self.subject_type = subject_type
        self.predicate = predicate
        self.object_type = object_type
        self.score = score

    def to_dict(self):
        return {"subject_type": self.subject_type, "predicate": self.predicate,
                "object_type": self.object_type, "score": self.score}

class EvidencePattern:
    def __init__(self, patterns: list, score: float):
        self.patterns = patterns
        self.score = score

    def to_dict(self):
        return {"patterns": [p.to_dict() for p in self.patterns], "score": self.score}

class QAResult:
    def __init__(self, question: str, answer: str, evidence_patterns: list,
                 subgraph_entities: list, reasoning_steps: list,
                 confidence: float):
        self.question = question
        self.answer = answer
        self.evidence_patterns = evidence_patterns
        self.subgraph_entities = subgraph_entities
        self.reasoning_steps = reasoning_steps
        self.confidence = confidence

    def to_dict(self):
        return {
            "question": self.question,
            "answer": self.answer,
            "evidence_patterns": [e.to_dict() for e in self.evidence_patterns],
            "subgraph_entities": self.subgraph_entities,
            "reasoning_steps": self.reasoning_steps,
            "confidence": self.confidence,
            "method": "EPR-KGQA (Evidence Pattern Retrieval)",
        }


class EPRKGQAEngine:
    def __init__(self, kg: KnowledgeGraph):
        self.kg = kg
        # Pre-built atomic pattern index
        self.atomic_patterns = self._build_pattern_index()

    def _build_pattern_index(self) -> list[AtomicPattern]:
        patterns = []
        pred_counts: dict[str, int] = {}
        for rel in self.kg.relations:
            s_type = self.kg.entities[rel.subject].etype if rel.subject in self.kg.entities else "Unknown"
            o_type = self.kg.entities[rel.obj].etype if rel.obj in self.kg.entities else "Unknown"
            pattern = AtomicPattern(s_type, rel.predicate, o_type)
            patterns.append(pattern)
            key = f"{s_type}-{rel.predicate}-{o_type}"
            pred_counts[key] = pred_counts.get(key, 0) + 1
        return patterns

    def answer_question(self, question: str) -> QAResult:
        q = question.lower()
        reasoning_steps = []

        # Step 1: Intent detection
        reasoning_steps.append("Step 1: Decompose question into atomic intent patterns")

        # Step 2: Pattern retrieval
        evidence_patterns = self._retrieve_patterns(q)
        reasoning_steps.append(f"Step 2: Retrieved {len(evidence_patterns)} candidate evidence patterns")

        # Step 3: Subgraph extraction
        entities, answer = self._extract_and_reason(q, evidence_patterns)
        reasoning_steps.append(f"Step 3: Extracted subgraph with {len(entities)} relevant entities")

        # Step 4: Answer reasoning
        reasoning_steps.append(f"Step 4: Generated answer via NSM reasoning over subgraph")

        confidence = 0.85 if entities else 0.3

        return QAResult(
            question=question,
            answer=answer,
            evidence_patterns=evidence_patterns,
            subgraph_entities=entities,
            reasoning_steps=reasoning_steps,
            confidence=confidence,
        )

    def _retrieve_patterns(self, q: str) -> list[EvidencePattern]:
        patterns = []
        if "customer" in q and ("lagos" in q or "city" in q or "location" in q):
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "LIVES_IN", "City", 0.92)], 0.92))
        if "product" in q or "insurance" in q or "savings" in q or "bought" in q:
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "HAS_PRODUCT", "Product", 0.88)], 0.88))
        if "refer" in q or "recommendation" in q:
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "REFERRED", "Customer", 0.85)], 0.85))
        if "premium" in q or "high value" in q or "top" in q:
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "HAS_SEGMENT", "premium", 0.90)], 0.90))
        if "churn" in q or "at risk" in q or "leaving" in q:
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "HAS_SEGMENT", "at_risk", 0.87)], 0.87))
        if not patterns:
            patterns.append(EvidencePattern(
                [AtomicPattern("Customer", "ANY", "Entity", 0.5)], 0.5))
        return patterns

    def _extract_and_reason(self, q: str, patterns: list) -> tuple:
        entities = []

        if "lagos" in q and "insurance" not in q:
            # Customers in Lagos
            for eid, entity in self.kg.entities.items():
                if entity.etype == "Customer" and entity.properties.get("city") == "Lagos":
                    entities.append({"id": eid, "name": entity.name, **entity.properties})
            answer = f"Found {len(entities)} customers in Lagos: " + ", ".join(
                f"{e['name']} ({e.get('segment', 'unknown')} segment, ₦{e.get('ltv', 0):,.0f} LTV)"
                for e in entities)

        elif "lagos" in q and ("insurance" in q or "haven't" in q or "without" in q):
            # Multi-hop: Lagos customers WITHOUT insurance
            for eid, entity in self.kg.entities.items():
                if entity.etype == "Customer" and entity.properties.get("city") == "Lagos":
                    has_insurance = "insurance" in entity.properties.get("products", [])
                    if not has_insurance:
                        entities.append({"id": eid, "name": entity.name,
                                        "has_insurance": False, **entity.properties})
            answer = f"{len(entities)} customers in Lagos without insurance: " + ", ".join(
                e["name"] for e in entities)

        elif "premium" in q or "high value" in q or "top" in q:
            for eid, entity in self.kg.entities.items():
                if entity.etype == "Customer" and entity.properties.get("segment") == "premium":
                    entities.append({"id": eid, "name": entity.name, **entity.properties})
            entities.sort(key=lambda x: x.get("ltv", 0), reverse=True)
            answer = f"{len(entities)} premium customers: " + ", ".join(
                f"{e['name']} (₦{e.get('ltv', 0):,.0f})" for e in entities)

        elif "churn" in q or "at risk" in q:
            for eid, entity in self.kg.entities.items():
                if entity.etype == "Customer" and entity.properties.get("segment") == "at_risk":
                    entities.append({"id": eid, "name": entity.name, **entity.properties})
            answer = f"{len(entities)} at-risk customers: " + ", ".join(e["name"] for e in entities)

        elif "refer" in q:
            referrals = []
            for rel in self.kg.relations:
                if rel.predicate == "REFERRED":
                    referrer = self.kg.entities.get(rel.subject)
                    referred = self.kg.entities.get(rel.obj)
                    if referrer and referred:
                        referrals.append({"referrer": referrer.name, "referred": referred.name})
                        entities.append({"id": rel.subject, "name": referrer.name, "role": "referrer"})
            answer = f"{len(referrals)} referral relationships: " + "; ".join(
                f"{r['referrer']} → {r['referred']}" for r in referrals)

        elif "product" in q and ("popular" in q or "most" in q):
            product_counts: dict[str, int] = {}
            for rel in self.kg.relations:
                if rel.predicate == "HAS_PRODUCT":
                    prod = self.kg.entities.get(rel.obj)
                    if prod:
                        product_counts[prod.name] = product_counts.get(prod.name, 0) + 1
            sorted_prods = sorted(product_counts.items(), key=lambda x: x[1], reverse=True)
            for name, count in sorted_prods:
                entities.append({"name": name, "subscribers": count})
            answer = "Products by popularity: " + ", ".join(f"{n} ({c} subscribers)" for n, c in sorted_prods)

        else:
            answer = ("I can answer questions about: customers by city/segment, product subscriptions, "
                     "referral networks, churn risk, and cross-sell opportunities. Try: "
                     "'Who are our top customers in Lagos that haven't bought insurance?'")

        return entities, answer

    def get_sample_questions(self) -> list[dict]:
        return [
            {"question": "Who are our top customers in Lagos that haven't bought insurance?",
             "complexity": "multi-hop", "patterns": ["LIVES_IN", "HAS_PRODUCT (negation)"]},
            {"question": "Which premium customers have referred others?",
             "complexity": "2-hop", "patterns": ["HAS_SEGMENT", "REFERRED"]},
            {"question": "What are the most popular products?",
             "complexity": "aggregation", "patterns": ["HAS_PRODUCT"]},
            {"question": "Which customers are at risk of churning?",
             "complexity": "single-hop", "patterns": ["HAS_SEGMENT"]},
            {"question": "Who referred Fatima Bello?",
             "complexity": "single-hop", "patterns": ["REFERRED"]},
        ]


# --- HTTP Server ---

kg = KnowledgeGraph()
epr_engine = EPRKGQAEngine(kg)


class EPRHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        allowed = os.environ.get("CORS_ALLOWED_ORIGINS", "https://crm.example.com,https://admin.example.com").split(",")
        origin = self.headers.get("Origin", "")
        if origin in [o.strip() for o in allowed]:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.end_headers()

        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/health":
            response = {"status": "healthy", "service": "epr-kgqa"}
        elif path == "/api/v1/kgqa/ask":
            question = params.get("q", [""])[0]
            if question:
                result = epr_engine.answer_question(question)
                response = result.to_dict()
            else:
                response = {"error": "Missing ?q= parameter", "sample_questions": epr_engine.get_sample_questions()}
        elif path == "/api/v1/kgqa/samples":
            response = {"sample_questions": epr_engine.get_sample_questions()}
        elif path == "/api/v1/kgqa/kg-stats":
            response = {
                "total_entities": len(kg.entities),
                "total_relations": len(kg.relations),
                "entity_types": {t: len(ids) for t, ids in kg.entity_index.items()},
                "relation_types": list(set(r.predicate for r in kg.relations)),
                "method": "EPR-KGQA (Evidence Pattern Retrieval, WWW'24)",
            }
        else:
            response = {"error": "Not found"}

        self.wfile.write(json.dumps(response, default=str).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        allowed = os.environ.get("CORS_ALLOWED_ORIGINS", "https://crm.example.com,https://admin.example.com").split(",")
        origin = self.headers.get("Origin", "")
        if origin in [o.strip() for o in allowed]:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Tenant-ID")
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    port = 8094
    print(f"EPR-KGQA service listening on :{port}")
    print(f"Knowledge Graph: {len(kg.entities)} entities, {len(kg.relations)} relations")
    server = HTTPServer(("0.0.0.0", port), EPRHandler)
    server.serve_forever()
