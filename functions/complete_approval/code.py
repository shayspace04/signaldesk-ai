#input_type_name: CompleteApprovalInput
#output_type_name: CompleteApprovalOutput
#function_name: complete_approval
"""Finalize the approval workflow: mark the ticket as resolved and record the completion."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

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

class CompleteApprovalInput(BaseModel):
    draft_id: str
    ticket_id: str
    reviewer_notes: Optional[str] = None

class CompleteApprovalOutput(BaseModel):
    ticket_id: str
    draft_id: str
    completed_at: str

async def complete_approval(ctx: FunctionContext, data: CompleteApprovalInput) -> CompleteApprovalOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()
    actor = str(ctx.user_id) if ctx.user_id else None

    draft = pod.records.get("drafts", data.draft_id)
    if not draft:
        raise RuntimeError(f"draft {data.draft_id} not found")

    pod.records.update("tickets", data.ticket_id, {"status": "resolved", "resolved_at": now})
    pod.records.update("drafts", data.draft_id, {"status": "complete", "completed_at": now})

    appr = pod.records.create("approvals", {
        "approval_type": "draft", "resource_id": data.draft_id,
        "ticket_id": data.ticket_id,
        "ticket_number": draft.get("ticket_number"),
        "action": "complete", "actor_user_id": actor,
        "notes": data.reviewer_notes, "decided_at": now,
    })

    _audit(pod, "approval.completed", actor_type="user", actor_user_id=actor,
           resource_type="draft", resource_id=data.draft_id, ticket_id=data.ticket_id,
           details={"approval_id": appr["id"], "reviewer_notes": data.reviewer_notes})

    return CompleteApprovalOutput(ticket_id=data.ticket_id, draft_id=data.draft_id, completed_at=now)
