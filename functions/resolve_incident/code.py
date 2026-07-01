#input_type_name: ResolveIncidentInput
#output_type_name: ResolveIncidentOutput
#function_name: resolve_incident
"""Resolve an incident: set status=closed, record resolution notes, and audit log."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _require_manager(ctx, action):
    user_id = str(ctx.user_id) if ctx.user_id else None
    if not user_id:
        raise RuntimeError("Insufficient permissions: must be authenticated")
    pod = Pod.from_env()
    try:
        rows = pod.records.list("user_roles", {"filters": {"user_id": user_id}, "limit": 1})
        items = rows.get("items") or rows.get("data") or []
        if items and items[0].get("role") == "support_manager":
            return
    except Exception:
        pass
    raise RuntimeError(f"Insufficient permissions: support_manager role required to {action}.")

class ResolveIncidentInput(BaseModel):
    incident_id: str
    resolution_notes: Optional[str] = None
    actor_user_id: Optional[str] = None

class ResolveIncidentOutput(BaseModel):
    incident_id: str
    status: str

async def resolve_incident(ctx: FunctionContext, data: ResolveIncidentInput) -> ResolveIncidentOutput:
    _require_manager(ctx, "resolve incident")
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()
    actor = data.actor_user_id or (str(ctx.user_id) if ctx.user_id else None)
    upd = {"status": "closed", "closed_at": now}
    if data.resolution_notes:
        upd["resolution_notes"] = data.resolution_notes
    updated = pod.records.update("incidents", data.incident_id, upd)
    if not updated:
        raise RuntimeError(f"incident {data.incident_id} not found")
    inc = pod.records.get("incidents", data.incident_id)
    # Audit log
    try:
        pod.records.create("audit_logs", {
            "actor_type": "user",
            "actor_user_id": actor,
            "action": "incident.resolved",
            "resource_type": "incident",
            "resource_id": data.incident_id,
            "signal_id": str(inc.get("signal_id")) if inc and inc.get("signal_id") else None,
            "details": {"resolution_notes": data.resolution_notes, "title": inc.get("title") if inc else None},
        })
    except Exception:
        pass
    return ResolveIncidentOutput(incident_id=data.incident_id, status="closed")
