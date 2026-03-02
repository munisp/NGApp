"""
Permify fine-grained authorization client for the NEXCOM Analytics service.
Implements relationship-based access control (ReBAC).
Makes real HTTP calls to Permify REST API with fallback to in-memory checks.
"""

import logging
import os
import socket
from typing import List

import requests

logger = logging.getLogger(__name__)

# Tenant ID for multi-tenancy support
TENANT_ID = os.getenv("PERMIFY_TENANT_ID", "nexcom")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


class PermifyClient:
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self._connected = False
        self._fallback_mode = True
        self._relationships: list = []
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})
        logger.info(f"[Permify] Initialized with endpoint: {endpoint} (tenant: {TENANT_ID})")
        self._connect()

    def _connect(self) -> None:
        """Attempt TCP connection to Permify server."""
        try:
            host, port_str = self.endpoint.rsplit(":", 1)
            port = int(port_str)
            sock = socket.create_connection((host, port), timeout=3)
            sock.close()
            self._connected = True
            self._fallback_mode = False
            logger.info(f"[Permify] Connected to {self.endpoint} (TCP verified)")
        except (socket.error, ValueError, OSError) as e:
            logger.warning(
                f"[Permify] Cannot reach {self.endpoint}: {e} — running in fallback mode"
            )
            self._connected = False
            self._fallback_mode = True

    def check(
        self,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_type: str,
        subject_id: str,
    ) -> bool:
        """Check if a subject has a permission on an entity via Permify REST API."""
        if not self._fallback_mode:
            try:
                url = f"http://{self.endpoint}/v1/tenants/{TENANT_ID}/permissions/check"
                payload = {
                    "metadata": {
                        "schema_version": "",
                        "snap_token": "",
                        "depth": 20,
                    },
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id},
                }
                resp = self._session.post(url, json=payload, timeout=5)
                if resp.ok:
                    result = resp.json()
                    can = result.get("can", "")
                    return can == "CHECK_RESULT_ALLOWED"
            except Exception as e:
                logger.warning(f"[Permify] Permission check via API failed: {e}")

        # Fallback: check in-memory relationships
        for rel in self._relationships:
            if (
                rel["entity_type"] == entity_type
                and rel["entity_id"] == entity_id
                and rel["relation"] == permission
                and rel["subject_type"] == subject_type
                and rel["subject_id"] == subject_id
            ):
                return True

        # Production: deny by default
        if ENVIRONMENT == "production":
            logger.warning(
                f"[Permify] DENIED: {entity_type}:{entity_id}#{permission}"
                f"@{subject_type}:{subject_id}"
            )
            return False

        # Development: allow to enable local dev without Permify running
        return True

    def write_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str,
    ) -> None:
        """Create a relationship tuple via Permify REST API."""
        if not self._fallback_mode:
            try:
                url = f"http://{self.endpoint}/v1/tenants/{TENANT_ID}/relationships/write"
                payload = {
                    "metadata": {"schema_version": ""},
                    "tuples": [
                        {
                            "entity": {"type": entity_type, "id": entity_id},
                            "relation": relation,
                            "subject": {"type": subject_type, "id": subject_id},
                        }
                    ],
                }
                resp = self._session.post(url, json=payload, timeout=5)
                if resp.ok:
                    logger.info(
                        f"[Permify] WriteRelationship: {entity_type}:{entity_id}#{relation}"
                        f"@{subject_type}:{subject_id} (via API)"
                    )
                    return
            except Exception as e:
                logger.warning(f"[Permify] WriteRelationship API failed: {e}")

        # Fallback: store in memory
        self._relationships.append(
            {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "relation": relation,
                "subject_type": subject_type,
                "subject_id": subject_id,
            }
        )
        logger.info(
            f"[Permify] WriteRelationship: {entity_type}:{entity_id}#{relation}"
            f"@{subject_type}:{subject_id} (fallback)"
        )

    def delete_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str,
    ) -> None:
        """Delete a relationship tuple."""
        if not self._fallback_mode:
            try:
                url = f"http://{self.endpoint}/v1/tenants/{TENANT_ID}/relationships/delete"
                payload = {
                    "filter": {
                        "entity": {"type": entity_type, "ids": [entity_id]},
                        "relation": relation,
                        "subject": {"type": subject_type, "ids": [subject_id]},
                    }
                }
                self._session.post(url, json=payload, timeout=5)
            except Exception as e:
                logger.warning(f"[Permify] DeleteRelationship API failed: {e}")

        # Also remove from in-memory
        self._relationships = [
            r
            for r in self._relationships
            if not (
                r["entity_type"] == entity_type
                and r["entity_id"] == entity_id
                and r["relation"] == relation
                and r["subject_type"] == subject_type
                and r["subject_id"] == subject_id
            )
        ]

    def lookup_subjects(
        self, entity_type: str, entity_id: str, permission: str, subject_type: str
    ) -> List[str]:
        """Find all subjects with a permission on an entity."""
        if not self._fallback_mode:
            try:
                url = f"http://{self.endpoint}/v1/tenants/{TENANT_ID}/permissions/lookup-subject"
                payload = {
                    "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject_reference": {"type": subject_type},
                }
                resp = self._session.post(url, json=payload, timeout=5)
                if resp.ok:
                    return resp.json().get("subject_ids", [])
            except Exception as e:
                logger.warning(f"[Permify] LookupSubjects API failed: {e}")

        # Fallback
        return [
            r["subject_id"]
            for r in self._relationships
            if r["entity_type"] == entity_type
            and r["entity_id"] == entity_id
            and r["relation"] == permission
            and r["subject_type"] == subject_type
        ]

    def check_analytics_access(self, user_id: str, report_type: str) -> bool:
        """Check if user can access a specific analytics report."""
        return self.check("report", report_type, "view", "user", user_id)

    def check_surveillance_access(self, user_id: str) -> bool:
        """Check if user can view surveillance alerts (compliance officers only)."""
        return self.check("surveillance_alert", "nexcom", "view", "user", user_id)

    def is_connected(self) -> bool:
        return self._connected

    def is_fallback(self) -> bool:
        return self._fallback_mode

    def close(self) -> None:
        self._connected = False
        self._session.close()
        logger.info("[Permify] Connection closed")
