#input_type_name: CreateTicketInput
#output_type_name: CreateTicketOutput
#function_name: create_ticket
"""Create a brand-new tickets row from a submitted intake form."""
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

class CreateTicketInput(BaseModel):
    title: str
    body: str
    customer_email: str
    customer_name: Optional[str] = None
    channel: Optional[str] = "email"
    priority: Optional[str] = None
    category: Optional[str] = None

class CreateTicketOutput(BaseModel):
    ticket_id: str
    ticket_number: Optional[int] = None

async def create_ticket(ctx: FunctionContext, data: CreateTicketInput) -> CreateTicketOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()
    record = {"title": data.title, "body": data.body,
               "customer_email": data.customer_email, "customer_name": data.customer_name,
               "channel": data.channel or "email", "status": "new", "received_at": now}
    if data.priority:
        record["priority"] = data.priority
    if data.category:
        record["category"] = data.category
    row = pod.records.create("tickets", record)
    _audit(pod, "ticket.created", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="ticket", resource_id=row["id"], ticket_id=row["id"],
           details={"channel": data.channel or "email", "title": data.title})
    return CreateTicketOutput(ticket_id=row["id"], ticket_number=row.get("number"))
