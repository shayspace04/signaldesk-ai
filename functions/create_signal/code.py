#input_type_name: CreateSignalInput
#output_type_name: CreateSignalOutput
#function_name: create_signal
"""Write a pending signal proposal and link its evidence tickets to it."""
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None, resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
    try:
        row={"actor_type":actor_type,"action":action}
        if actor_user_id: row["actor_user_id"]=actor_user_id
        if actor_agent_name: row["actor_agent_name"]=actor_agent_name
        if resource_type: row["resource_type"]=resource_type
        if resource_id: row["resource_id"]=str(resource_id)
        if ticket_id: row["ticket_id"]=str(ticket_id)
        if signal_id: row["signal_id"]=str(signal_id)
        if details is not None: row["details"]=details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class CreateSignalInput(BaseModel):
    name: str
    summary: str
    category: Optional[str] = None
    evidence_count: int = 0
    example_ticket_ids: Optional[List[str]] = None
    recurring_terms: Optional[List[str]] = None
    proposed_priority: Optional[str] = "normal"

class CreateSignalOutput(BaseModel):
    signal_id: str
    evidence_linked: int

async def create_signal(ctx: FunctionContext, data: CreateSignalInput) -> CreateSignalOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()
    sig = pod.records.create("signals", {
        "name": data.name, "summary": data.summary, "category": data.category,
        "evidence_count": data.evidence_count,
        "example_ticket_ids": data.example_ticket_ids or [],
        "recurring_terms": data.recurring_terms or [],
        "proposed_priority": data.proposed_priority or "normal",
        "status": "pending", "workflowStage": "new", "detected_at": now,
    })
    linked = 0
    for tid in (data.example_ticket_ids or []):
        try:
            pod.records.update("tickets", tid, {"signal_id": sig["id"]})
            linked += 1
        except Exception:
            pass
    _audit(pod, "signal.created", actor_type="agent", actor_agent_name="signal-detector",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="signal", resource_id=sig["id"], signal_id=sig["id"],
           details={"name": data.name, "evidence_count": data.evidence_count, "priority": data.proposed_priority})
    return CreateSignalOutput(signal_id=sig["id"], evidence_linked=linked)
