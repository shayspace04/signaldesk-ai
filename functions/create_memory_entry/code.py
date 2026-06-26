#input_type_name: CreateMemoryEntryInput
#output_type_name: CreateMemoryEntryOutput
#function_name: create_memory_entry
"""Create a standalone organizational memory entry."""
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

class CreateMemoryEntryInput(BaseModel):
    title: str
    body: str
    source_signal_id: Optional[str] = None
    related_incident_id: Optional[str] = None
    tags: Optional[List[str]] = None
    confidence: Optional[int] = 80

class CreateMemoryEntryOutput(BaseModel):
    memory_entry_id: str

async def create_memory_entry(ctx: FunctionContext, data: CreateMemoryEntryInput) -> CreateMemoryEntryOutput:
    pod = Pod.from_env()
    mem = pod.records.create("memory_entries", {
        "title": data.title, "body": data.body,
        "source_signal_id": data.source_signal_id,
        "related_incident_id": data.related_incident_id,
        "tags": data.tags, "confidence": data.confidence,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    })
    _audit(pod, "memory.created", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="memory_entry", resource_id=mem["id"],
           signal_id=data.source_signal_id, details={"title": data.title})
    return CreateMemoryEntryOutput(memory_entry_id=mem["id"])
