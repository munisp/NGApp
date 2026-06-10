"""
Sanctions Screening Engine
Real-time screening against OFAC SDN, UN Security Council, EU sanctions,
Nigeria EFCC watchlist, and PEP databases.
"""
import hashlib
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class SanctionsList(Enum):
    OFAC_SDN = "OFAC_SDN"
    UN_SECURITY_COUNCIL = "UN_SECURITY_COUNCIL"
    EU_SANCTIONS = "EU_SANCTIONS"
    EFCC_WATCHLIST = "EFCC_WATCHLIST"
    PEP_DATABASE = "PEP_DATABASE"
    NFIU_WATCHLIST = "NFIU_WATCHLIST"
    INTERPOL_RED = "INTERPOL_RED_NOTICE"


class MatchType(Enum):
    EXACT = "EXACT"
    FUZZY = "FUZZY"
    PARTIAL = "PARTIAL"
    ALIAS = "ALIAS"


class ScreeningResult(Enum):
    CLEAR = "CLEAR"
    POTENTIAL_MATCH = "POTENTIAL_MATCH"
    CONFIRMED_MATCH = "CONFIRMED_MATCH"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    PENDING_REVIEW = "PENDING_REVIEW"


@dataclass
class SanctionedEntity:
    id: str
    name: str
    aliases: list[str]
    nationality: str
    list_source: SanctionsList
    designation_date: str
    reason: str
    identifiers: dict = field(default_factory=dict)  # BVN, passport, etc.
    active: bool = True


@dataclass
class ScreeningHit:
    entity_id: str
    entity_name: str
    list_source: SanctionsList
    match_type: MatchType
    match_score: float
    matched_field: str
    query_value: str
    result: ScreeningResult


@dataclass
class ScreeningRequest:
    transaction_id: str
    sender_name: str
    sender_bvn: str = ""
    sender_nationality: str = ""
    recipient_name: str = ""
    recipient_bvn: str = ""
    recipient_country: str = ""
    amount: float = 0.0
    currency: str = "NGN"


@dataclass
class ScreeningResponse:
    request_id: str
    transaction_id: str
    overall_result: ScreeningResult
    hits: list[ScreeningHit] = field(default_factory=list)
    screening_time_ms: float = 0.0
    lists_checked: list[str] = field(default_factory=list)
    risk_score: float = 0.0
    recommended_action: str = "PROCEED"


# Seed sanctioned entities for testing
SEED_ENTITIES: list[SanctionedEntity] = [
    SanctionedEntity(
        id="OFAC-001", name="Test Sanctioned Person One",
        aliases=["T.S. Person", "Person One Test"],
        nationality="IR", list_source=SanctionsList.OFAC_SDN,
        designation_date="2020-01-15", reason="Weapons proliferation",
    ),
    SanctionedEntity(
        id="UN-001", name="Test Restricted Entity Corp",
        aliases=["TRE Corp", "Restricted Entity"],
        nationality="KP", list_source=SanctionsList.UN_SECURITY_COUNCIL,
        designation_date="2019-06-20", reason="Nuclear program support",
    ),
    SanctionedEntity(
        id="EFCC-001", name="Test Fraud Suspect Nigeria",
        aliases=["Fraud Suspect NG"],
        nationality="NG", list_source=SanctionsList.EFCC_WATCHLIST,
        designation_date="2024-03-01", reason="Advanced fee fraud",
        identifiers={"bvn": "12345678901"},
    ),
    SanctionedEntity(
        id="PEP-001", name="Test Political Figure",
        aliases=["T. Political"],
        nationality="NG", list_source=SanctionsList.PEP_DATABASE,
        designation_date="2023-01-01", reason="Politically Exposed Person",
    ),
]


class SanctionsEngine:
    def __init__(self) -> None:
        self.entities: list[SanctionedEntity] = list(SEED_ENTITIES)
        self.total_screenings = 0
        self.total_hits = 0
        self.false_positives = 0

    def screen(self, request: ScreeningRequest) -> ScreeningResponse:
        start = time.time()
        self.total_screenings += 1

        hits: list[ScreeningHit] = []
        lists_checked = [lst.value for lst in SanctionsList]

        for entity in self.entities:
            if not entity.active:
                continue

            # Check sender name
            score = self._fuzzy_match(request.sender_name, entity.name, entity.aliases)
            if score >= 0.8:
                hits.append(ScreeningHit(
                    entity_id=entity.id, entity_name=entity.name,
                    list_source=entity.list_source,
                    match_type=MatchType.EXACT if score >= 0.95 else MatchType.FUZZY,
                    match_score=score, matched_field="sender_name",
                    query_value=request.sender_name,
                    result=ScreeningResult.CONFIRMED_MATCH if score >= 0.95 else ScreeningResult.POTENTIAL_MATCH,
                ))

            # Check recipient name
            if request.recipient_name:
                score = self._fuzzy_match(request.recipient_name, entity.name, entity.aliases)
                if score >= 0.8:
                    hits.append(ScreeningHit(
                        entity_id=entity.id, entity_name=entity.name,
                        list_source=entity.list_source,
                        match_type=MatchType.EXACT if score >= 0.95 else MatchType.FUZZY,
                        match_score=score, matched_field="recipient_name",
                        query_value=request.recipient_name,
                        result=ScreeningResult.CONFIRMED_MATCH if score >= 0.95 else ScreeningResult.POTENTIAL_MATCH,
                    ))

            # Check BVN
            if request.sender_bvn and entity.identifiers.get("bvn") == request.sender_bvn:
                hits.append(ScreeningHit(
                    entity_id=entity.id, entity_name=entity.name,
                    list_source=entity.list_source,
                    match_type=MatchType.EXACT, match_score=1.0,
                    matched_field="sender_bvn", query_value=request.sender_bvn,
                    result=ScreeningResult.CONFIRMED_MATCH,
                ))

        self.total_hits += len(hits)
        elapsed_ms = (time.time() - start) * 1000

        if not hits:
            overall = ScreeningResult.CLEAR
            risk_score = 0.0
            action = "PROCEED"
        elif any(h.result == ScreeningResult.CONFIRMED_MATCH for h in hits):
            overall = ScreeningResult.CONFIRMED_MATCH
            risk_score = 1.0
            action = "BLOCK"
        else:
            overall = ScreeningResult.POTENTIAL_MATCH
            risk_score = max(h.match_score for h in hits)
            action = "REVIEW"

        return ScreeningResponse(
            request_id=hashlib.md5(f"{request.transaction_id}:{time.time()}".encode()).hexdigest()[:12],
            transaction_id=request.transaction_id,
            overall_result=overall,
            hits=hits,
            screening_time_ms=elapsed_ms,
            lists_checked=lists_checked,
            risk_score=risk_score,
            recommended_action=action,
        )

    def _fuzzy_match(self, query: str, name: str, aliases: list[str]) -> float:
        query_norm = self._normalize(query)
        best = self._similarity(query_norm, self._normalize(name))
        for alias in aliases:
            score = self._similarity(query_norm, self._normalize(alias))
            best = max(best, score)
        return best

    @staticmethod
    def _normalize(s: str) -> str:
        return re.sub(r"[^a-z0-9 ]", "", s.lower().strip())

    @staticmethod
    def _similarity(a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        if a == b:
            return 1.0
        a_tokens = set(a.split())
        b_tokens = set(b.split())
        if not a_tokens or not b_tokens:
            return 0.0
        intersection = a_tokens & b_tokens
        union = a_tokens | b_tokens
        return len(intersection) / len(union)
