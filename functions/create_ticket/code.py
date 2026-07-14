#input_type_name: CreateTicketInput
#output_type_name: CreateTicketOutput
#function_name: create_ticket
"""Create a brand-new tickets row from a submitted intake form."""
import time
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
    trigger_detection: Optional[bool] = True

class CreateTicketOutput(BaseModel):
    ticket_id: str
    ticket_number: Optional[int] = None
    timing_ms: Optional[dict] = None

async def create_ticket(ctx: FunctionContext, data: CreateTicketInput) -> CreateTicketOutput:
    t0 = time.perf_counter()
    pod = Pod.from_env()
    t_pod = time.perf_counter() - t0

    now = datetime.now(timezone.utc).isoformat()
    record = {"title": data.title, "body": data.body,
               "customer_email": data.customer_email, "customer_name": data.customer_name,
               "channel": data.channel or "email", "status": "new", "received_at": now}
    if data.priority:
        record["priority"] = data.priority
    if data.category:
        record["category"] = data.category
    t_build = time.perf_counter() - t0 - t_pod

    t_create = time.perf_counter()
    row = pod.records.create("tickets", record)
    t_create_elapsed = time.perf_counter() - t_create

    t_audit = time.perf_counter()
    if data.trigger_detection:
        _audit(pod, "ticket.created", actor_type="user",
               actor_user_id=str(ctx.user_id) if ctx.user_id else None,
               resource_type="ticket", resource_id=row["id"], ticket_id=row["id"],
               details={"channel": data.channel or "email", "title": data.title})
    t_audit_elapsed = time.perf_counter() - t_audit

    total = time.perf_counter() - t0
    timing = {
        "pod_init_ms": round(t_pod * 1000, 1),
        "build_record_ms": round(t_build * 1000, 1),
        "persist_record_ms": round(t_create_elapsed * 1000, 1),
        "audit_log_ms": round(t_audit_elapsed * 1000, 1),
        "total_ms": round(total * 1000, 1),
    }

    print(
        f"[create_ticket] trigger_detection={data.trigger_detection} "
        f"title=\"{data.title[:60]}\" "
        f"timing={timing}"
    )

    return CreateTicketOutput(
        ticket_id=row["id"],
        ticket_number=row.get("number"),
        timing_ms=timing,
    )
