#input_type_name: CreateDraftInput
#output_type_name: CreateDraftOutput
#function_name: create_draft
"""Persist the reply-agent draft as a pending drafts row."""
from typing import Optional, List
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _audit(pod, action, actor_type="agent", actor_user_id=None, actor_agent_name=None, resource_type=None, resource_id=None, ticket_id=None, details=None):
    try:
        row={"actor_type":actor_type,"action":action}
        if actor_user_id: row["actor_user_id"]=actor_user_id
        if actor_agent_name: row["actor_agent_name"]=actor_agent_name
        if resource_type: row["resource_type"]=resource_type
        if resource_id: row["resource_id"]=str(resource_id)
        if ticket_id: row["ticket_id"]=str(ticket_id)
        if details is not None: row["details"]=details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class Grounding(BaseModel):
    path: str
    snippet: str
    page: Optional[int] = None

class CreateDraftInput(BaseModel):
    ticket_id: str
    body: str
    grounded_in: List[Grounding] = []
    confidence: int = 50
    notes: Optional[str] = None
    ticket_number: Optional[int] = None

class CreateDraftOutput(BaseModel):
    draft_id: str
    ticket_id: str
    ticket_number: Optional[int] = None

async def create_draft(ctx: FunctionContext, data: CreateDraftInput) -> CreateDraftOutput:
    pod = Pod.from_env()
    tnum = data.ticket_number
    if tnum is None:
        try:
            t = pod.records.get("tickets", data.ticket_id)
            tnum = t.get("number") if t else None
        except Exception:
            tnum = None
    row = pod.records.create("drafts", {
        "ticket_id": data.ticket_id, "ticket_number": tnum, "body": data.body,
        "grounded_in": [g.model_dump(exclude_none=True) for g in data.grounded_in],
        "confidence": data.confidence, "status": "pending",
        "reviewer_notes": data.notes,
    })
    _audit(pod, "draft.created", actor_type="agent", actor_agent_name="reply-agent",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="draft", resource_id=row["id"], ticket_id=data.ticket_id,
           details={"ticket_number": tnum, "confidence": data.confidence})
    return CreateDraftOutput(draft_id=row["id"], ticket_id=data.ticket_id, ticket_number=tnum)
