#input_type_name: AssignIncidentInput
#output_type_name: AssignIncidentOutput
#function_name: assign_incident
"""Assign an owner to an incident and write audit log."""
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class AssignIncidentInput(BaseModel):
    incident_id: str
    owner_user_id: str
    actor_user_id: Optional[str] = None

class AssignIncidentOutput(BaseModel):
    incident_id: str
    owner_user_id: str

async def assign_incident(ctx: FunctionContext, data: AssignIncidentInput) -> AssignIncidentOutput:
    pod = Pod.from_env()
    actor = data.actor_user_id or (str(ctx.user_id) if ctx.user_id else None)
    updated = pod.records.update("incidents", data.incident_id, {"owner_user_id": data.owner_user_id})
    if not updated:
        raise RuntimeError(f"incident {data.incident_id} not found")
    inc = pod.records.get("incidents", data.incident_id)
    try:
        pod.records.create("audit_logs", {
            "actor_type": "user",
            "actor_user_id": actor,
            "action": "incident.assigned",
            "resource_type": "incident",
            "resource_id": data.incident_id,
            "signal_id": str(inc.get("signal_id")) if inc and inc.get("signal_id") else None,
            "details": {"owner_user_id": data.owner_user_id, "title": inc.get("title") if inc else None},
        })
    except Exception:
        pass
    return AssignIncidentOutput(incident_id=data.incident_id, owner_user_id=data.owner_user_id)
