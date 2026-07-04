#input_type_name: ResolveTicketInput
#output_type_name: ResolveTicketOutput
#function_name: resolve_ticket
"""Apply a support agent approval: mark the draft approved, ticket resolved, and record the approval."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _items(rows):
    if rows is None:
        return []
    if hasattr(rows, "items"):
        items = rows.items
        if not items:
            return []
        if hasattr(items[0], "to_dict"):
            return [item.to_dict() for item in items]
        return list(items)
    if isinstance(rows, dict) and "data" in rows:
        return rows["data"]
    if isinstance(rows, list):
        return rows
    return []

def _require_manager(ctx, action):
    user_id = str(ctx.user_id) if ctx.user_id else None
    if not user_id:
        raise RuntimeError("Insufficient permissions: must be authenticated")
    pod = Pod.from_env()
    try:
        rows = pod.records.list("user_roles", filter=[{"field": "user_id", "op": "eq", "value": user_id}], limit=1)
        items = _items(rows)
        if items and items[0].get("role") == "support_manager":
            return
    except Exception:
        pass
    raise RuntimeError(f"Insufficient permissions: support_manager role required to {action}.")

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None,
           resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
    try:
        row = {"actor_type": actor_type, "action": action}
        if actor_user_id: row["actor_user_id"] = actor_user_id
        if actor_agent_name: row["actor_agent_name"] = actor_agent_name
        if resource_type: row["resource_type"] = resource_type
        if resource_id: row["resource_id"] = str(resource_id)
        if ticket_id: row["ticket_id"] = str(ticket_id)
        if signal_id: row["signal_id"] = str(signal_id)
        if details is not None: row["details"] = details
        pod.records.create("audit_logs", row)
    except Exception:
        pass
class ResolveTicketInput(BaseModel):
    ticket_id: str
    draft_id: Optional[str] = None
    reviewer_user_id: Optional[str] = None
    reviewer_notes: Optional[str] = None


class ResolveTicketOutput(BaseModel):
    ticket_id: str
    draft_id: str
    approval_id: str


async def resolve_ticket(ctx: FunctionContext, data: ResolveTicketInput) -> ResolveTicketOutput:
    _require_manager(ctx, "approve draft and resolve ticket")
    pod = Pod.from_env()
    decided_at = datetime.now(timezone.utc).isoformat()
    actor = data.reviewer_user_id or (str(ctx.user_id) if ctx.user_id else None)

    draft_id = data.draft_id
    if not draft_id:
        drafts = pod.records.list("drafts", filter=[
            {"field": "ticket_id", "op": "eq", "value": data.ticket_id},
            {"field": "status", "op": "eq", "value": "pending"},
        ], sort=[{"field": "created_at", "direction": "desc"}], limit=1)
        items = _items(drafts)
        if not items:
            raise RuntimeError(f"no pending draft for ticket {data.ticket_id}")
        draft_id = items[0]["id"]

    upd = {"status": "approved", "decided_at": decided_at}
    if data.reviewer_user_id: upd["reviewer_user_id"] = data.reviewer_user_id
    if data.reviewer_notes: upd["reviewer_notes"] = data.reviewer_notes
    pod.records.update("drafts", draft_id, upd)

    draft = pod.records.get("drafts", draft_id)
    ticket_id = draft.get("ticket_id")
    if not ticket_id:
        raise RuntimeError(f"draft {draft_id} has no ticket_id")
    pod.records.update("tickets", str(ticket_id), {"status": "resolved"})

    appr = pod.records.create("approvals", {
        "approval_type": "draft", "resource_id": draft_id,
        "ticket_id": str(ticket_id), "ticket_number": draft.get("ticket_number"),
        "action": "approve", "actor_user_id": actor, "notes": data.reviewer_notes,
        "decided_at": decided_at,
    })
    _audit(pod, "draft.approved", actor_type="user", actor_user_id=actor,
           resource_type="draft", resource_id=draft_id, ticket_id=str(ticket_id),
           details={"reviewer_notes": data.reviewer_notes, "approval_id": appr["id"]})
    return ResolveTicketOutput(ticket_id=str(ticket_id), draft_id=draft_id, approval_id=appr["id"])