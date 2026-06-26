#input_type_name: UpdateStatusInput
#output_type_name: UpdateStatusOutput
#function_name: update_status
"""Generic validated status update for a ticket or incident, with resolution notes support."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

ALLOWED = {
    "tickets": ["new", "triaged", "waiting_approval", "resolved"],
    "incidents": ["open", "investigating", "closed"],
}

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

class UpdateStatusInput(BaseModel):
    table: str
    record_id: str
    status: str
    actor_user_id: Optional[str] = None
    resolution_notes: Optional[str] = None

class UpdateStatusOutput(BaseModel):
    table: str
    record_id: str
    status: str

async def update_status(ctx: FunctionContext, data: UpdateStatusInput) -> UpdateStatusOutput:
    if data.table not in ALLOWED:
        raise RuntimeError(f"table {data.table} not supported; use one of {list(ALLOWED)}")
    if data.status not in ALLOWED[data.table]:
        raise RuntimeError(f"status {data.status} not valid for {data.table}; use {ALLOWED[data.table]}")
    pod = Pod.from_env()
    upd = {"status": data.status}
    # When closing an incident, stamp closed_at and store resolution notes
    if data.table == "incidents" and data.status == "closed":
        upd["closed_at"] = datetime.now(timezone.utc).isoformat()
        if data.resolution_notes:
            upd["resolution_notes"] = data.resolution_notes
    updated = pod.records.update(data.table, data.record_id, upd)
    if not updated:
        raise RuntimeError(f"{data.table} {data.record_id} not found")

    action = f"{data.table}.status_changed"
    if data.table == "incidents" and data.status == "closed":
        action = "incident.resolved"
    elif data.table == "tickets" and data.status == "resolved":
        action = "ticket.resolved"

    # Get signal_id for incident audit
    sig_id = None
    if data.table == "incidents":
        try:
            inc = pod.records.get("incidents", data.record_id)
            sig_id = str(inc.get("signal_id")) if inc and inc.get("signal_id") else None
        except Exception:
            pass

    _audit(pod, action, actor_type="user",
           actor_user_id=data.actor_user_id or (str(ctx.user_id) if ctx.user_id else None),
           resource_type=data.table[:-1] if data.table.endswith("s") else data.table,
           resource_id=data.record_id,
           ticket_id=data.record_id if data.table == "tickets" else None,
           signal_id=sig_id,
           details={"status": data.status, "resolution_notes": data.resolution_notes})
    return UpdateStatusOutput(table=data.table, record_id=data.record_id, status=data.status)
