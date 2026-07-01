#input_type_name: FetchLinearIssueInput
#output_type_name: FetchLinearIssueOutput
#function_name: fetch_linear_issue
"""Fetch current state of a Linear issue and update the incident record."""
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

def _items(rows):
    if rows is None: return []
    if hasattr(rows, "items"):
        items = rows.items
        if not items: return []
        if hasattr(items[0], "to_dict"): return [item.to_dict() for item in items]
        return list(items)
    if isinstance(rows, dict) and "data" in rows: return rows["data"]
    if isinstance(rows, list): return rows
    return []

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

class FetchLinearIssueInput(BaseModel):
    incident_id: str

class FetchLinearIssueOutput(BaseModel):
    success: bool = False
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    identifier: Optional[str] = None
    simulated: bool = False

async def fetch_linear_issue(ctx: FunctionContext, data: FetchLinearIssueInput) -> FetchLinearIssueOutput:
    pod = Pod.from_env()
    inc = pod.records.get("incidents", data.incident_id)
    if not inc: raise RuntimeError(f"incident {data.incident_id} not found")

    linear_id = inc.get("linearIssueId")
    if not linear_id: raise RuntimeError("No Linear issue linked to this incident")

    simulated = False
    status = inc.get("linearStatus") or "Todo"
    priority = inc.get("linearPriority") or "medium"
    assignee = inc.get("linearAssignee")
    title = None
    url = inc.get("linearIssueUrl") or ""
    identifier = inc.get("linearIssueIdentifier") or ""

    try:
        result = pod.connectors.execute("linear", "LINEAR_GET_LINEAR_ISSUE", {"issue_id": linear_id})
        d = _unwrap(result)
        if d:
            state = d.get("state", {})
            if isinstance(state, dict): status = state.get("name") or status
            prio_val = d.get("priority")
            if prio_val is not None: priority = str(prio_val) if not isinstance(prio_val, str) else prio_val
            a = d.get("assignee")
            if isinstance(a, dict): assignee = a.get("name") or assignee
            elif a: assignee = str(a)
            title = d.get("title") or title
            url = d.get("url") or url
            identifier = d.get("identifier") or identifier
    except Exception:
        simulated = True

    now = datetime.now(timezone.utc).isoformat()
    try:
        pod.records.update("incidents", data.incident_id, {
            "linearStatus": status,
            "linearPriority": priority,
            "linearAssignee": assignee,
            "linearSyncedAt": now,
        })
    except Exception:
        pass

    _audit(pod, "linear.issue_fetched", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="incident", resource_id=data.incident_id,
           details={"linearIssueId": linear_id, "status": status, "priority": priority})

    return FetchLinearIssueOutput(
        success=True, status=status, priority=priority,
        assignee=assignee, title=title, url=url,
        identifier=identifier, simulated=simulated,
    )
