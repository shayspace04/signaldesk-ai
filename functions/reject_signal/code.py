#input_type_name: RejectSignalInput
#output_type_name: RejectSignalOutput
#function_name: reject_signal
"""Manager rejects a proposed signal: flip status to rejected and record the rejection."""
from datetime import datetime, timezone
from typing import Optional
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

class RejectSignalInput(BaseModel):
    signal_id: str
    approver_user_id: Optional[str] = None
    approver_notes: Optional[str] = None

class RejectSignalOutput(BaseModel):
    signal_id: str
    status: str
    approval_id: str

async def reject_signal(ctx: FunctionContext, data: RejectSignalInput) -> RejectSignalOutput:
    pod = Pod.from_env()
    decided_at = datetime.now(timezone.utc).isoformat()
    actor = data.approver_user_id or (str(ctx.user_id) if ctx.user_id else None)
    upd = {"status": "rejected", "decided_at": decided_at}
    if data.approver_user_id: upd["approver_user_id"] = data.approver_user_id
    if data.approver_notes: upd["approver_notes"] = data.approver_notes
    updated = pod.records.update("signals", data.signal_id, upd)
    if not updated:
        raise RuntimeError(f"signal {data.signal_id} not found")
    # Record the rejection decision
    appr = pod.records.create("approvals", {
        "approval_type": "signal", "resource_id": data.signal_id,
        "signal_id": data.signal_id,
        "action": "reject", "actor_user_id": actor, "notes": data.approver_notes,
        "decided_at": decided_at,
    })
    _audit(pod, "signal.rejected", actor_type="user", actor_user_id=actor,
           resource_type="signal", resource_id=data.signal_id, signal_id=data.signal_id,
           details={"approver_notes": data.approver_notes, "approval_id": appr["id"]})
    return RejectSignalOutput(signal_id=data.signal_id, status="rejected", approval_id=appr["id"])
