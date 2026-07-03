#input_type_name: SyncLinearIssueInput
#output_type_name: SyncLinearIssueOutput
#function_name: sync_linear_issue
"""Sync incident details (title, severity, status, description) into its linked Linear issue."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

SEVERITY_MAP = {"low": "Low", "normal": "Medium", "high": "High", "urgent": "Urgent"}
LINEAR_SEVERITY = {"low": 4, "normal": 3, "high": 2, "urgent": 1}
LINEAR_PRIORITY_LABEL = {4: "Low", 3: "Normal", 2: "High", 1: "Urgent"}
STATUS_MAP = {"open": "Todo", "investigating": "In Progress", "waiting": "In Review", "resolved": "Done", "closed": "Done"}
LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628"

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

class SyncLinearIssueInput(BaseModel):
    incident_id: str

class SyncLinearIssueOutput(BaseModel):
    success: bool = False
    updated: bool = False
    status: Optional[str] = None
    priority: Optional[str] = None
    message: Optional[str] = None

async def sync_linear_issue(ctx: FunctionContext, data: SyncLinearIssueInput) -> SyncLinearIssueOutput:
    pod = Pod.from_env()
    inc = pod.records.get("incidents", data.incident_id)
    if not inc: raise RuntimeError(f"incident {data.incident_id} not found")

    linear_id = inc.get("linearIssueId")
    if not linear_id: raise RuntimeError("No Linear issue linked to this incident")

    sev = inc.get("severity", "normal")
    inc_status = inc.get("status", "open")
    title = inc.get("title") or f"Incident {data.incident_id}"

    linked_tickets = []
    try:
        tix = _items(pod.records.list("ticket_incidents", filter=[
            {"field": "incident_id", "op": "eq", "value": data.incident_id},
        ], limit=50))
        for link in tix:
            t = pod.records.get("tickets", link.get("ticket_id"))
            if t: linked_tickets.append(t)
    except Exception: pass

    sig = None
    if inc.get("signal_id"):
        try: sig = pod.records.get("signals", inc["signal_id"])
        except Exception: pass

    parts = [
        f"**Incident ID**: {data.incident_id}",
        f"**Workspace**: {inc.get('workspaceName', 'SignalDesk')}",
        f"**Severity**: {SEVERITY_MAP.get(sev, 'Medium')}",
        f"**Current Status**: {inc_status}",
    ]

    ai_root = inc.get('summary') or (sig.get('summary') if sig else None) or None
    if ai_root:
        parts.append(f"\n**AI Root Cause**:\n{ai_root}")

    if sig:
        parts.append(f"\n**Linked Signal**: {sig.get('name') or sig.get('id', '')}")

    cust_set = set()
    if linked_tickets:
        for t in linked_tickets:
            cust_set.add(t.get("customer_email") or t.get("customer_name") or f"ticket_{t['id']}")
    affected_customers = len(cust_set) if cust_set else inc.get("affected_ticket_count")
    if affected_customers:
        parts.append(f"\n**Affected Customers**: {affected_customers}")

    aff_tix = inc.get("affected_ticket_count")
    if aff_tix:
        parts.append(f"\n**Affected Tickets**: {aff_tix}")

    blast = inc.get("blast_radius")
    if blast:
        parts.append(f"\n**Customer Impact**: {blast}")

    timeline = []
    opened = inc.get("opened_at")
    if opened:
        timeline.append(f"- Incident opened: {opened}")
    if sig:
        detected = sig.get("detected_at")
        if detected:
            timeline.append(f"- Signal detected: {detected}")
    if timeline:
        parts.append(f"\n**Timeline Summary**:\n" + "\n".join(timeline))

    parts.append(f"\n**SignalDesk Dashboard URL**: https://incident-desk.apps.lemma.work/incidents/{data.incident_id}")
    description_body = "\n\n".join(parts)

    linear_sev = LINEAR_SEVERITY.get(sev, "medium")
    linear_status = STATUS_MAP.get(inc_status, "Todo")

    updated = False

    try:
        result = pod.connectors.execute("linear", "LINEAR_UPDATE_ISSUE", {
            "issue_id": linear_id,
            "title": title,
            "description": description_body,
            "priority": linear_sev,
        })
        updated = True
    except Exception as e:
        return SyncLinearIssueOutput(
            success=False,
            message=f"Linear connector error: {e}",
        )

    now = datetime.now(timezone.utc).isoformat()
    try:
        pod.records.update("incidents", data.incident_id, {
            "linearStatus": linear_status,
            "linearPriority": LINEAR_PRIORITY_LABEL.get(linear_sev, "Normal"),
            "linearSyncedAt": now,
            "lastSyncResult": "synced",
        })
    except Exception:
        pass

    _audit(pod, "linear.issue_synced", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="incident", resource_id=data.incident_id,
           details={"linearIssueId": linear_id, "status": linear_status,
                    "priority": linear_sev, "simulated": False,
                    "updated": updated})

    return SyncLinearIssueOutput(
        success=True, updated=updated,
        status=linear_status, priority=str(linear_sev),
        message=f"Synced to Linear: {linear_status}",
    )
