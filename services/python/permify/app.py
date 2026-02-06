import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Permify Authorization Service", version="1.0.0")

PERMIFY_HOST = os.getenv("PERMIFY_HOST", "localhost")
PERMIFY_PORT = int(os.getenv("PERMIFY_PORT", "3476"))
PERMIFY_GRPC_PORT = int(os.getenv("PERMIFY_GRPC_PORT", "3478"))


SCHEMA = """
entity user {}

entity organization {
    relation owner @user
    relation admin @user
    relation member @user

    permission manage = owner or admin
    permission view = owner or admin or member
}

entity account {
    relation owner @user
    relation organization @organization

    permission view = owner or organization.member
    permission transfer = owner or organization.admin
    permission close = owner or organization.owner
}

entity transaction {
    relation account @account
    relation initiator @user

    permission view = initiator or account.owner
    permission approve = account.owner
    permission reverse = account.owner
}

entity payment {
    relation sender @user
    relation receiver @user
    relation account @account

    permission initiate = sender or account.owner
    permission approve = account.owner
    permission view = sender or receiver or account.owner
}

entity budget {
    relation owner @user
    relation shared_with @user

    permission view = owner or shared_with
    permission edit = owner
    permission delete = owner
}

entity kyc_document {
    relation owner @user
    relation reviewer @user

    permission upload = owner
    permission view = owner or reviewer
    permission approve = reviewer
    permission reject = reviewer
}

entity savings_goal {
    relation owner @user
    relation contributor @user

    permission view = owner or contributor
    permission contribute = owner or contributor
    permission withdraw = owner
    permission close = owner
}

entity loan {
    relation borrower @user
    relation approver @user

    permission apply = borrower
    permission view = borrower or approver
    permission approve = approver
    permission disburse = approver
}

entity bill {
    relation payer @user
    relation account @account

    permission view = payer or account.owner
    permission pay = payer or account.owner
    permission schedule = payer
}

entity report {
    relation owner @user
    relation organization @organization

    permission view = owner or organization.admin
    permission generate = owner or organization.admin
    permission export = owner or organization.owner
}
"""


@dataclass
class Relationship:
    entity_type: str
    entity_id: str
    relation: str
    subject_type: str
    subject_id: str
    created_at: float = field(default_factory=time.time)


relationships: list[Relationship] = []
schema_version: str = "v1"
connected = False


class WriteRelationshipRequest(BaseModel):
    entity_type: str
    entity_id: str
    relation: str
    subject_type: str
    subject_id: str


class CheckPermissionRequest(BaseModel):
    entity_type: str
    entity_id: str
    permission: str
    subject_type: str
    subject_id: str


class LookupEntityRequest(BaseModel):
    entity_type: str
    permission: str
    subject_type: str
    subject_id: str


class DeleteRelationshipRequest(BaseModel):
    entity_type: str
    entity_id: str
    relation: str
    subject_type: str
    subject_id: str


@app.on_event("startup")
async def startup():
    global connected
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"http://{PERMIFY_HOST}:{PERMIFY_PORT}/healthz")
            if resp.status_code == 200:
                connected = True
                print(f"[Permify] Connected to {PERMIFY_HOST}:{PERMIFY_PORT}")
    except Exception:
        connected = False
        print(f"[Permify] Server not available, running in local mode")

    _seed_relationships()


def _seed_relationships():
    seeds = [
        ("organization", "org-1", "owner", "user", "admin-1"),
        ("organization", "org-1", "admin", "user", "admin-2"),
        ("organization", "org-1", "member", "user", "user-1"),
        ("organization", "org-1", "member", "user", "user-2"),
        ("account", "acc-checking-1", "owner", "user", "user-1"),
        ("account", "acc-savings-1", "owner", "user", "user-1"),
        ("account", "acc-checking-1", "organization", "organization", "org-1"),
        ("budget", "budget-1", "owner", "user", "user-1"),
        ("budget", "budget-1", "shared_with", "user", "user-2"),
        ("savings_goal", "goal-1", "owner", "user", "user-1"),
        ("savings_goal", "goal-1", "contributor", "user", "user-2"),
    ]
    for entity_type, entity_id, relation, subject_type, subject_id in seeds:
        relationships.append(Relationship(
            entity_type=entity_type,
            entity_id=entity_id,
            relation=relation,
            subject_type=subject_type,
            subject_id=subject_id,
        ))


@app.get("/health")
async def health():
    return {
        "connected": connected,
        "host": PERMIFY_HOST,
        "port": PERMIFY_PORT,
        "schema_version": schema_version,
        "relationships_count": len(relationships),
    }


@app.get("/schema")
async def get_schema():
    return {"schema": SCHEMA, "version": schema_version}


@app.post("/schema/write")
async def write_schema(schema_text: str = SCHEMA):
    global schema_version
    schema_version = f"v{int(time.time())}"
    return {"schema_version": schema_version}


@app.post("/relationships/write")
async def write_relationship(req: WriteRelationshipRequest):
    for rel in relationships:
        if (rel.entity_type == req.entity_type and rel.entity_id == req.entity_id
                and rel.relation == req.relation and rel.subject_type == req.subject_type
                and rel.subject_id == req.subject_id):
            return {"status": "already_exists"}

    relationships.append(Relationship(
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        relation=req.relation,
        subject_type=req.subject_type,
        subject_id=req.subject_id,
    ))
    return {"status": "created"}


@app.post("/relationships/delete")
async def delete_relationship(req: DeleteRelationshipRequest):
    global relationships
    before = len(relationships)
    relationships = [
        r for r in relationships
        if not (r.entity_type == req.entity_type and r.entity_id == req.entity_id
                and r.relation == req.relation and r.subject_type == req.subject_type
                and r.subject_id == req.subject_id)
    ]
    deleted = before - len(relationships)
    return {"deleted": deleted}


@app.post("/permissions/check")
async def check_permission(req: CheckPermissionRequest):
    allowed = _check_permission_recursive(
        req.entity_type, req.entity_id, req.permission, req.subject_type, req.subject_id, set()
    )
    return {
        "allowed": allowed,
        "entity": f"{req.entity_type}:{req.entity_id}",
        "permission": req.permission,
        "subject": f"{req.subject_type}:{req.subject_id}",
    }


def _check_permission_recursive(entity_type: str, entity_id: str, permission: str,
                                 subject_type: str, subject_id: str, visited: set) -> bool:
    key = f"{entity_type}:{entity_id}:{permission}:{subject_type}:{subject_id}"
    if key in visited:
        return False
    visited.add(key)

    for rel in relationships:
        if rel.entity_type == entity_type and rel.entity_id == entity_id:
            if rel.relation == permission and rel.subject_type == subject_type and rel.subject_id == subject_id:
                return True

            if rel.subject_type != "user":
                if _check_permission_recursive(
                    rel.subject_type, rel.subject_id, permission, subject_type, subject_id, visited
                ):
                    return True

    relation_map = {
        ("account", "view"): ["owner"],
        ("account", "transfer"): ["owner"],
        ("account", "close"): ["owner"],
        ("transaction", "view"): ["initiator"],
        ("transaction", "approve"): [],
        ("payment", "initiate"): ["sender"],
        ("payment", "view"): ["sender", "receiver"],
        ("budget", "view"): ["owner", "shared_with"],
        ("budget", "edit"): ["owner"],
        ("budget", "delete"): ["owner"],
        ("savings_goal", "view"): ["owner", "contributor"],
        ("savings_goal", "contribute"): ["owner", "contributor"],
        ("savings_goal", "withdraw"): ["owner"],
        ("organization", "manage"): ["owner", "admin"],
        ("organization", "view"): ["owner", "admin", "member"],
    }

    direct_relations = relation_map.get((entity_type, permission), [])
    for rel_name in direct_relations:
        for rel in relationships:
            if (rel.entity_type == entity_type and rel.entity_id == entity_id
                    and rel.relation == rel_name
                    and rel.subject_type == subject_type and rel.subject_id == subject_id):
                return True

    return False


@app.post("/permissions/lookup-entity")
async def lookup_entity(req: LookupEntityRequest):
    entities = set()
    for rel in relationships:
        if rel.entity_type == req.entity_type and rel.subject_type == req.subject_type and rel.subject_id == req.subject_id:
            if _check_permission_recursive(
                req.entity_type, rel.entity_id, req.permission, req.subject_type, req.subject_id, set()
            ):
                entities.add(rel.entity_id)

    return {"entity_ids": sorted(entities)}


@app.post("/permissions/lookup-subject")
async def lookup_subject(entity_type: str, entity_id: str, permission: str):
    subjects = set()
    all_users = set()
    for rel in relationships:
        if rel.subject_type == "user":
            all_users.add(rel.subject_id)

    for user_id in all_users:
        if _check_permission_recursive(entity_type, entity_id, permission, "user", user_id, set()):
            subjects.add(user_id)

    return {"subject_ids": sorted(subjects)}


@app.get("/relationships")
async def list_relationships(entity_type: Optional[str] = None, entity_id: Optional[str] = None):
    results = relationships
    if entity_type:
        results = [r for r in results if r.entity_type == entity_type]
    if entity_id:
        results = [r for r in results if r.entity_id == entity_id]

    return [
        {
            "entity": f"{r.entity_type}:{r.entity_id}",
            "relation": r.relation,
            "subject": f"{r.subject_type}:{r.subject_id}",
        }
        for r in results
    ]


@app.get("/metrics")
async def get_metrics():
    entity_types: dict[str, int] = {}
    for rel in relationships:
        entity_types[rel.entity_type] = entity_types.get(rel.entity_type, 0) + 1

    return {
        "total_relationships": len(relationships),
        "entity_types": entity_types,
        "schema_version": schema_version,
        "connected": connected,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PERMIFY_SERVICE_PORT", "8089"))
    uvicorn.run(app, host="0.0.0.0", port=port)
