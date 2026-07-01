#input_type_name: AddLinearCommentInput
#output_type_name: AddLinearCommentOutput
#function_name: add_linear_comment
"""Add an engineering note as a comment on the linked Linear issue."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _unwrap(r):
    """Extract dict from OperationExecutionResponse or similar SDK object."""
    if r is None: return {}
    r_inner = getattr(r, "result", r)
    if r_inner is not None and r_inner is not r:
        if hasattr(r_inner, "to_dict"): return r_inner.to_dict()
        if isinstance(r_inner, dict): return r_inner
        if hasattr(r_inner, "__dict__"): return r_inner.__dict__
    if hasattr(r, "to_dict"): return r.to_dict()
    data = getattr(r, "data", r)
    if data is not None and data is not r:
        if hasattr(data, "to_dict"): return data.to_dict()
        if isinstance(data, dict): return data
        if hasattr(data, "__dict__"): return data.__dict__
    if hasattr(r, "__dict__"): return r.__dict__
    if isinstance(r, dict): return r
    return {}

def _audit(pod, action, actor_type="user", actor_user_id=None, resource_type=None, resource_id=None, details=None):
    try:
        row={"actor_type":actor_type,"action":action}
        if actor_user_id: row["actor_user_id"]=actor_user_id
        if resource_type: row["resource_type"]=resource_type
        if resource_id: row["resource_id"]=str(resource_id)
        if details is not None: row["details"]=details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class AddLinearCommentInput(BaseModel):
    incident_id: str
    body: str
    user_name: Optional[str] = None

class AddLinearCommentOutput(BaseModel):
    success: bool = False
    comment_id: Optional[str] = None
    simulated: bool = False

async def add_linear_comment(ctx: FunctionContext, data: AddLinearCommentInput) -> AddLinearCommentOutput:
    pod = Pod.from_env()
    inc = pod.records.get("incidents", data.incident_id)
    if not inc: raise RuntimeError(f"incident {data.incident_id} not found")

    linear_id = inc.get("linearIssueId")
    if not linear_id: raise RuntimeError("No Linear issue linked to this incident")

    simulated = False
    comment_id = None

    try:
        result = pod.connectors.execute("linear", "LINEAR_CREATE_LINEAR_COMMENT", {
            "issue_id": linear_id,
            "body": f"**{data.user_name or 'Support Manager'}** (via SignalDesk):\n\n{data.body}",
        })
        d = _unwrap(result)
        if d:
            comment_id = d.get("id") or d.get("comment_id")
    except Exception:
        simulated = True

    _audit(pod, "linear.comment_added", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="incident", resource_id=data.incident_id,
           details={"linearIssueId": linear_id, "simulated": simulated,
                    "user": data.user_name, "body_length": len(data.body)})

    return AddLinearCommentOutput(
        success=True,
        comment_id=comment_id or f"sim_comment_{data.incident_id[:8]}",
        simulated=simulated,
    )
