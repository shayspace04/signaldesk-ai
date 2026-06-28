#input_type_name: RejectDraftInput
#output_type_name: RejectDraftOutput
#function_name: reject_draft
"""Support agent rejects a draft: mark rejected, return ticket to triaged, and record the rejection."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

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

class RejectDraftInput(BaseModel):
    draft_id: str
    reviewer_user_id: Optional[str] = None
    reviewer_notes: Optional[str] = None

class RejectDraftOutput(BaseModel):
    ticket_id: str
    draft_id: str
    approval_id: str

async def reject_draft(ctx: FunctionContext, data: RejectDraftInput) -> RejectDraftOutput:
    pod = Pod.from_env()
    decided_at = datetime.now(timezone.utc).isoformat()
    actor = data.reviewer_user_id or (str(ctx.user_id) if ctx.user_id else None)
    upd = {"status": "rejected", "decided_at": decided_at}
    if data.reviewer_user_id: upd["reviewer_user_id"] = data.reviewer_user_id
    if data.reviewer_notes: upd["reviewer_notes"] = data.reviewer_notes
    updated = pod.records.update("drafts", data.draft_id, upd)
    if not updated:
        raise RuntimeError(f"draft {data.draft_id} not found")
    draft = pod.records.get("drafts", data.draft_id)
    ticket_id = draft.get("ticket_id")
    if ticket_id:
        pod.records.update("tickets", str(ticket_id), {"status": "triaged"})
    # Record the rejection decision
    appr = pod.records.create("approvals", {
        "approval_type": "draft", "resource_id": data.draft_id,
        "ticket_id": str(ticket_id) if ticket_id else None,
        "ticket_number": draft.get("ticket_number"),
        "action": "reject", "actor_user_id": actor, "notes": data.reviewer_notes,
        "decided_at": decided_at,
    })
    _audit(pod, "draft.rejected", actor_type="user", actor_user_id=actor,
           resource_type="draft", resource_id=data.draft_id,
           ticket_id=str(ticket_id) if ticket_id else None,
           details={"reviewer_notes": data.reviewer_notes, "approval_id": appr["id"]})
    return RejectDraftOutput(ticket_id=str(ticket_id) if ticket_id else "", draft_id=data.draft_id, approval_id=appr["id"])
