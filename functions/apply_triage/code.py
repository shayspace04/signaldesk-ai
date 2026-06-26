#input_type_name: ApplyTriageInput
#output_type_name: ApplyTriageOutput
#function_name: apply_triage
"""Persist the triage-agent classification onto the ticket row (status -> triaged)."""
from datetime import datetime, timezone, timedelta
from typing import Optional
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

class ApplyTriageInput(BaseModel):
    ticket_id: str
    priority: str
    category: str
    sentiment: str
    summary: str
    reasoning: Optional[str] = None
    sla_first_reply_hours: int

class ApplyTriageOutput(BaseModel):
    ticket_id: str
    status: str
    priority: str
    category: str

async def apply_triage(ctx: FunctionContext, data: ApplyTriageInput) -> ApplyTriageOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc)
    sla_due = (now + timedelta(hours=data.sla_first_reply_hours)).isoformat()
    upd = {"priority": data.priority, "category": data.category, "sentiment": data.sentiment,
           "summary": data.summary, "status": "triaged",
           "triaged_at": now.isoformat(), "sla_due_at": sla_due}
    if data.reasoning is not None:
        upd["reasoning"] = data.reasoning
    updated = pod.records.update("tickets", data.ticket_id, upd)
    if not updated:
        raise RuntimeError(f"ticket {data.ticket_id} not found")
    _audit(pod, "ticket.triaged", actor_type="agent", actor_agent_name="triage-agent",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="ticket", resource_id=data.ticket_id, ticket_id=data.ticket_id,
           details={"priority": data.priority, "category": data.category, "sentiment": data.sentiment})
    return ApplyTriageOutput(ticket_id=data.ticket_id, status="triaged", priority=data.priority, category=data.category)
