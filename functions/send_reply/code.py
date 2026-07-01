#input_type_name: SendReplyInput
#output_type_name: SendReplyOutput
#function_name: send_reply
"""Send an approved draft reply as the final customer-facing message."""
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

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None,
           resource_type=None, resource_id=None, ticket_id=None, details=None):
    try:
        row = {"actor_type": actor_type, "action": action}
        if actor_user_id: row["actor_user_id"] = actor_user_id
        if actor_agent_name: row["actor_agent_name"] = actor_agent_name
        if resource_type: row["resource_type"] = resource_type
        if resource_id: row["resource_id"] = str(resource_id)
        if ticket_id: row["ticket_id"] = str(ticket_id)
        if details is not None: row["details"] = details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class SendReplyInput(BaseModel):
    ticket_id: str
    body: str
    draft_id: Optional[str] = None

class SendReplyOutput(BaseModel):
    ticket_id: str
    draft_id: Optional[str] = None
    sent_at: str

async def send_reply(ctx: FunctionContext, data: SendReplyInput) -> SendReplyOutput:
    _require_manager(ctx, "send reply")
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()
    actor = str(ctx.user_id) if ctx.user_id else None

    draft_id = data.draft_id
    if not draft_id:
        drafts = pod.records.list("drafts", {
            "filters": {"ticket_id": data.ticket_id, "status": "approved"},
            "sort": [{"field": "created_at", "direction": "desc"}],
            "limit": 1,
        })
        items = drafts.get("items") or drafts.get("data") or []
        if items:
            draft_id = items[0]["id"]

    if draft_id:
        pod.records.update("drafts", draft_id, {"status": "sent", "sent_at": now})

    _audit(pod, "email.sent", actor_type="user", actor_user_id=actor,
           resource_type="ticket", resource_id=str(data.ticket_id),
           ticket_id=str(data.ticket_id),
           details={"draft_id": draft_id, "body_preview": data.body[:100]})

    return SendReplyOutput(ticket_id=data.ticket_id, draft_id=draft_id, sent_at=now)
