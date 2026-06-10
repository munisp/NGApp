"""
OpenSearch Indexer - Transaction indexing and search for payment switch platform.
Provides full-text search, analytics aggregations, and real-time monitoring.
"""

import json
import os
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional


OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")

# Index mappings for payment switch data
TRANSACTION_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "transaction_id": {"type": "keyword"},
            "sender_id": {"type": "keyword"},
            "recipient_id": {"type": "keyword"},
            "amount": {"type": "double"},
            "currency": {"type": "keyword"},
            "status": {"type": "keyword"},
            "payment_method": {"type": "keyword"},
            "country": {"type": "keyword"},
            "description": {"type": "text", "analyzer": "standard"},
            "tags": {"type": "keyword"},
            "created_at": {"type": "date"},
            "processed_at": {"type": "date"},
            "ip_address": {"type": "ip"},
            "risk_score": {"type": "integer"},
            "fee_amount": {"type": "double"},
        }
    },
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "index.refresh_interval": "5s",
    }
}

AUDIT_LOG_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "event_id": {"type": "keyword"},
            "user_id": {"type": "keyword"},
            "action": {"type": "keyword"},
            "resource": {"type": "keyword"},
            "resource_id": {"type": "keyword"},
            "ip_address": {"type": "ip"},
            "user_agent": {"type": "text"},
            "details": {"type": "object", "enabled": True},
            "timestamp": {"type": "date"},
        }
    }
}


@dataclass
class SearchQuery:
    """Structured search query for transactions."""
    query_text: Optional[str] = None
    sender_id: Optional[str] = None
    recipient_id: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    country: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    page: int = 1
    page_size: int = 20
    sort_field: str = "created_at"
    sort_order: str = "desc"


class OpenSearchIndexer:
    """Manages OpenSearch indexing and querying for the payment platform."""

    def __init__(self, url: Optional[str] = None):
        self.base_url = url or OPENSEARCH_URL
        self.transaction_index = "transactions"
        self.audit_index = "audit-logs"
        self.compliance_index = "compliance-alerts"

    def build_search_query(self, search: SearchQuery) -> dict:
        """Build an OpenSearch query from structured search parameters."""
        must_clauses = []
        filter_clauses = []

        if search.query_text:
            must_clauses.append({
                "multi_match": {
                    "query": search.query_text,
                    "fields": ["description", "transaction_id", "sender_id", "recipient_id"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            })

        if search.sender_id:
            filter_clauses.append({"term": {"sender_id": search.sender_id}})
        if search.recipient_id:
            filter_clauses.append({"term": {"recipient_id": search.recipient_id}})
        if search.currency:
            filter_clauses.append({"term": {"currency": search.currency}})
        if search.status:
            filter_clauses.append({"term": {"status": search.status}})
        if search.country:
            filter_clauses.append({"term": {"country": search.country}})

        if search.min_amount is not None or search.max_amount is not None:
            range_filter = {"range": {"amount": {}}}
            if search.min_amount is not None:
                range_filter["range"]["amount"]["gte"] = search.min_amount
            if search.max_amount is not None:
                range_filter["range"]["amount"]["lte"] = search.max_amount
            filter_clauses.append(range_filter)

        if search.date_from or search.date_to:
            date_range = {"range": {"created_at": {}}}
            if search.date_from:
                date_range["range"]["created_at"]["gte"] = search.date_from
            if search.date_to:
                date_range["range"]["created_at"]["lte"] = search.date_to
            filter_clauses.append(date_range)

        query = {
            "query": {
                "bool": {
                    "must": must_clauses if must_clauses else [{"match_all": {}}],
                    "filter": filter_clauses,
                }
            },
            "from": (search.page - 1) * search.page_size,
            "size": search.page_size,
            "sort": [{search.sort_field: {"order": search.sort_order}}],
        }

        return query

    def build_analytics_aggregation(self, period: str = "day") -> dict:
        """Build aggregation query for transaction analytics."""
        interval = "1d" if period == "day" else "1w" if period == "week" else "1M"
        return {
            "size": 0,
            "aggs": {
                "transactions_over_time": {
                    "date_histogram": {
                        "field": "created_at",
                        "calendar_interval": interval,
                    },
                    "aggs": {
                        "total_amount": {"sum": {"field": "amount"}},
                        "avg_amount": {"avg": {"field": "amount"}},
                        "total_fees": {"sum": {"field": "fee_amount"}},
                    }
                },
                "by_currency": {
                    "terms": {"field": "currency", "size": 10},
                    "aggs": {"total": {"sum": {"field": "amount"}}}
                },
                "by_status": {
                    "terms": {"field": "status", "size": 10}
                },
                "by_country": {
                    "terms": {"field": "country", "size": 20},
                    "aggs": {"total": {"sum": {"field": "amount"}}}
                },
                "risk_distribution": {
                    "histogram": {"field": "risk_score", "interval": 10}
                },
            }
        }
