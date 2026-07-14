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
    analysis_confidence: Optional[int] = None

class CreateSignalOutput(BaseModel):
    signal_id: str
    evidence_linked: int

async def create_signal(ctx: FunctionContext, data: CreateSignalInput) -> CreateSignalOutput:
    import time as _time
    _t0 = _time.time()
    print(f"[profile] create_signal started at {datetime.now(timezone.utc).isoformat()}", flush=True)

    pod = Pod.from_env()
    _t1 = _time.time()
    _elapsed = round((_t1 - _t0) * 1000)
    if _elapsed > 1000:
        print(f"[profile] ** Pod.from_env() took {_elapsed}ms **", flush=True)
    else:
        print(f"[profile] Pod.from_env() took {_elapsed}ms", flush=True)

    now = datetime.now(timezone.utc).isoformat()
    sig = pod.records.create("signals", {
        "name": data.name, "summary": data.summary, "category": data.category,
        "evidence_count": data.evidence_count,
        "example_ticket_ids": data.example_ticket_ids or [],
        "recurring_terms": data.recurring_terms or [],
        "proposed_priority": data.proposed_priority or "normal",
        "analysis_confidence": data.analysis_confidence,
        "status": "pending", "workflowStage": "new", "detected_at": now,
    })
    _t2 = _time.time()
    _elapsed = round((_t2 - _t1) * 1000)
    if _elapsed > 1000:
        print(f"[profile] ** pod.records.create('signals') took {_elapsed}ms **", flush=True)
    else:
        print(f"[profile] pod.records.create('signals') took {_elapsed}ms", flush=True)

    linked = 0
    for tid in (data.example_ticket_ids or []):
        try:
            pod.records.update("tickets", tid, {"signal_id": sig["id"]})
            linked += 1
        except Exception:
            pass
    _t3 = _time.time()
    _elapsed = round((_t3 - _t2) * 1000)
    if _elapsed > 1000:
        print(f"[profile] ** ticket link loop ({linked} tickets) took {_elapsed}ms **", flush=True)
    else:
        print(f"[profile] ticket link loop ({linked} tickets) took {_elapsed}ms", flush=True)

    _audit(pod, "signal.created", actor_type="agent", actor_agent_name="signal-detector",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="signal", resource_id=sig["id"], signal_id=sig["id"],
           details={"name": data.name, "evidence_count": data.evidence_count, "priority": data.proposed_priority})
    _t4 = _time.time()
    _elapsed = round((_t4 - _t3) * 1000)
    if _elapsed > 1000:
        print(f"[profile] ** audit log took {_elapsed}ms **", flush=True)
    else:
        print(f"[profile] audit log took {_elapsed}ms", flush=True)

    _total = round((_t4 - _t0) * 1000)
    print(f"[profile] create_signal total: {_total}ms", flush=True)
    if _total > 1000:
        print(f"[profile] ** WARNING: create_signal exceeds 1s target ({_total}ms) **", flush=True)

    return CreateSignalOutput(signal_id=sig["id"], evidence_linked=linked)
